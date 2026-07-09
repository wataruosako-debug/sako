"use strict";

const { test, expect } = require("@playwright/test");

/*
 * 指示書⑥ リグレッションテスト。
 * - 1: セット完了カードのボタンは進行状況(予定内/予定消化後)やメニュー内外にかかわらず
 *      常に同じ3つ・同じ順番(①この種目を続ける ②別の種目を行う ③メニューを終了)
 * - 2: 種目切替(別の種目を行う→メニュー内/メニュー外)で休憩タイマーが止まらない。
 *      終了確認を開いてキャンセルしてもタイマーは残る
 * - 3: コピー/ルーティン適用ではメモを引き継がない(重量・回数・セット構成は従来どおり)
 */

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

// 前回記録(ベンチ2セット・メモ入り)を持つ状態で起動する
async function bootApp(page) {
  await page.addInitScript(() => {
    window.__GYMLOG_TEST_MODE = true;
    if (!localStorage.getItem("gymlog-ui-settings-v1")) {
      localStorage.setItem("gymlog-ui-settings-v1", JSON.stringify({ restTimerEnabled: true, autoStartRestTimer: true, guideModeEnabled: true, guideHelpSeen: true }));
    }
  });
  await page.goto("/");
  await page.waitForFunction(() => !!(window.GymLog && window.GymLog.__test__ && window.GymLog.__test__.getData && window.GymLog.__test__.getData()));
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    document.querySelectorAll(".modal.is-open").forEach((m) => { m.classList.remove("is-open"); m.setAttribute("aria-hidden", "true"); });
    document.body.classList.remove("modal-open");
    const api = window.GymLog.__test__;
    const data = api.getData();
    data.profile = { weightKg: 70, heightCm: 170, age: 30, gender: "male" };
    const bench = data.exercises.find((e) => e.name === "ベンチプレス");
    const now = new Date().toISOString();
    data.sessions.push({ id: "s-prev", date: "2026-07-01", locationType: "gym", totalCalories: 100, memo: "前回のセッションメモ", createdAt: now, updatedAt: now });
    data.records.push({ id: "r-prev", sessionId: "s-prev", exerciseId: bench.id, orderIndex: 0 });
    data.sets.push({ id: "set-p1", recordId: "r-prev", setNumber: 1, weight: 50000, reps: 10, rir: "2-3", restSeconds: 90, memo: "前回のセットメモ1" });
    data.sets.push({ id: "set-p2", recordId: "r-prev", setNumber: 2, weight: 52500, reps: 8, rir: "1", restSeconds: 120, memo: "前回のセットメモ2" });
    api.setData(data);
  });
}

// 前回記録をコピーしてガイドモードを開始する(ジムでの実使用と同じ流れ)
async function startGuideFromCopy(page) {
  await page.evaluate(() => {
    const api = window.GymLog.__test__;
    api.setDraft(api.createDraftFromSession("s-prev", new Date().toISOString().slice(0, 10), false));
    api.finishCopiedDraft();
  });
  await page.click("#startGuideModeButton");
  await page.click("#guideStartSummary .guide-start-item-main");
  await expect(page.locator("#guideSetCard")).toBeVisible();
}

// 完了カードの可視ボタン(id/文言)をDOM順で取得
async function finishedCardButtons(page) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll("#guideFinishedSetCard .guide-complete-actions button"))
      .filter((b) => !b.classList.contains("hidden"))
      .map((b) => ({ id: b.id, text: b.textContent.trim() }));
  });
}

async function restTimerStatus(page) {
  return page.evaluate(() => window.GymLog.__test__.getRestTimerState().status);
}

test("1: 予定セット消化後・メニュー外種目でも完了カードのボタン構成が変わらない", async ({ page }) => {
  await bootApp(page);
  await startGuideFromCopy(page);

  // セット1完了(予定2セット中の1) → 予定内の完了カード
  await page.click("#completeGuideSetButton");
  await expect(page.locator("#guideFinishedSetCard")).toBeVisible();
  const withinPlan = await finishedCardButtons(page);

  // セット2完了 → 予定消化後の完了カード
  await page.click("#guideChooseNextExerciseButton");
  await page.waitForTimeout(1000);
  await page.click("#completeGuideSetButton");
  await expect(page.locator("#guideFinishedSetCard")).toBeVisible();
  const exhausted = await finishedCardButtons(page);

  // ボタンのID・数・並び順は同一。文言が変わるのは先頭(この種目を続ける)だけ
  expect(withinPlan.map((b) => b.id)).toEqual(["guideChooseNextExerciseButton", "guideAlternateExerciseButton", "guideEndMenuAfterSetButton"]);
  expect(exhausted.map((b) => b.id)).toEqual(withinPlan.map((b) => b.id));
  expect(withinPlan[0].text).toBe("次のセットを行う");
  expect(exhausted[0].text).toBe("セットを追加して続ける");
  expect(withinPlan.slice(1)).toEqual([
    { id: "guideAlternateExerciseButton", text: "別の種目を行う" },
    { id: "guideEndMenuAfterSetButton", text: "メニューを終了" }
  ]);
  expect(exhausted.slice(1)).toEqual(withinPlan.slice(1));

  // メニュー外の種目に切り替えてセット完了 → それでも同じ構成(以前は並び順が反転していた)
  await page.click("#guideAlternateExerciseButton");
  await page.click("#guideAddExerciseButton");
  await page.evaluate(() => document.querySelector("#exerciseList [data-exercise-id]").click());
  await expect(page.locator("#guideSetCard")).toBeVisible();
  await page.click("#completeGuideSetButton");
  await expect(page.locator("#guideFinishedSetCard")).toBeVisible();
  const external = await finishedCardButtons(page);
  expect(external.map((b) => b.id)).toEqual(withinPlan.map((b) => b.id));
  expect(external[0].text).toBe("セットを追加して続ける");
  expect(external.slice(1)).toEqual(withinPlan.slice(1));
});

test("2: 別の種目への切替(メニュー内・メニュー外)で休憩タイマーが止まらない", async ({ page }) => {
  await bootApp(page);
  // メニュー2種目(ベンチ+スクワット)のルーティンからガイド開始
  await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const data = api.getData();
    const bench = data.exercises.find((e) => e.name === "ベンチプレス");
    const squat = data.exercises.find((e) => e.name === "スクワット") || data.exercises[1];
    api.draftFromRoutine({ id: "rt-6", name: "テスト", locationType: "gym", exercises: [{ exerciseId: bench.id }, { exerciseId: squat.id }] }, new Date().toISOString().slice(0, 10), null);
  });
  await page.click("#startGuideModeButton");
  await page.click("#guideStartSummary .guide-start-item-main");
  await expect(page.locator("#guideSetCard")).toBeVisible();

  // セット完了でタイマー開始(ガイドの従来仕様)
  await page.click("#completeGuideSetButton");
  await expect(page.locator("#guideFinishedSetCard")).toBeVisible();
  expect(await restTimerStatus(page)).toBe("running");

  // 別の種目を行う → 確認モーダル(残りセットあり)→「後で行う」を選んでもタイマーは動き続ける
  await page.click("#guideAlternateExerciseButton");
  await expect(page.locator("#guideLeaveItemModal")).toHaveClass(/is-open/);
  await page.click("#guideLeaveDeferButton");
  await expect(page.locator("#guideSelectNextCard")).toBeVisible();
  expect(await restTimerStatus(page)).toBe("running");

  // メニュー内の種目(スクワット)を選んで開始してもタイマーは維持される
  await page.evaluate(() => document.querySelector("#guideNextChoiceList button").click());
  await expect(page.locator("#guideSetCard")).toBeVisible();
  expect(await restTimerStatus(page)).toBe("running");

  // そのセットを完了すれば従来どおり新しいタイマーが動く
  await page.click("#completeGuideSetButton");
  await expect(page.locator("#guideFinishedSetCard")).toBeVisible();
  expect(await restTimerStatus(page)).toBe("running");

  // メニュー外の種目へ切り替えてもタイマーは維持され、セット完了後も動く
  // (スクワットは残りセットがあるため確認モーダルを経由する)
  await page.click("#guideAlternateExerciseButton");
  await expect(page.locator("#guideLeaveItemModal")).toHaveClass(/is-open/);
  await page.click("#guideLeaveDeferButton");
  expect(await restTimerStatus(page)).toBe("running");
  await page.click("#guideAddExerciseButton");
  await page.evaluate(() => document.querySelector("#exerciseList [data-exercise-id]").click());
  await expect(page.locator("#guideSetCard")).toBeVisible();
  expect(await restTimerStatus(page)).toBe("running");
  await page.click("#completeGuideSetButton");
  await expect(page.locator("#guideFinishedSetCard")).toBeVisible();
  expect(await restTimerStatus(page)).toBe("running");

  // メニューを終了(確認を開く)→キャンセルしてもタイマーは殺されない
  await page.click("#guideEndMenuAfterSetButton");
  await expect(page.locator("#guideExitModal")).toHaveClass(/is-open/);
  await page.click("#cancelGuideExit");
  expect(await restTimerStatus(page)).toBe("running");
});

test("3: コピーではメモを引き継がず、重量・回数・セット構成は引き継ぐ", async ({ page }) => {
  await bootApp(page);
  const draftState = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    api.setDraft(api.createDraftFromSession("s-prev", new Date().toISOString().slice(0, 10), false));
    api.finishCopiedDraft();
    const d = api.getDraft();
    return {
      sessionMemo: d.memo,
      sets: d.records[0].sets.map((s) => ({ weight: s.weight, reps: s.reps, rir: s.rir, restSeconds: s.restSeconds, memo: s.memo }))
    };
  });
  expect(draftState.sessionMemo).toBe("");
  expect(draftState.sets).toEqual([
    { weight: 50000, reps: 10, rir: "2-3", restSeconds: 90, memo: "" },
    { weight: 52500, reps: 8, rir: "1", restSeconds: 120, memo: "" }
  ]);
});

test("3: ルーティン適用ではメモを引き継がず、セット構成は引き継ぐ", async ({ page }) => {
  await bootApp(page);
  const draftState = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const data = api.getData();
    const bench = data.exercises.find((e) => e.name === "ベンチプレス");
    // 旧形式(records持ち)ルーティン: セットにメモが保存されているケース
    api.draftFromRoutine({
      id: "rt-legacy",
      name: "旧形式",
      locationType: "gym",
      records: [{ exerciseId: bench.id, sets: [
        { setNumber: 1, weight: 40000, reps: 12, rir: "2-3", restSeconds: 60, memo: "ルーティンの古いメモ" },
        { setNumber: 2, weight: 42500, reps: 10, rir: "1", restSeconds: 90, memo: "ルーティンの古いメモ2" }
      ] }]
    }, new Date().toISOString().slice(0, 10), null);
    const d = api.getDraft();
    return {
      sessionMemo: d.memo,
      sets: d.records[0].sets.map((s) => ({ weight: s.weight, reps: s.reps, rir: s.rir, restSeconds: s.restSeconds, memo: s.memo }))
    };
  });
  expect(draftState.sessionMemo).toBe("");
  expect(draftState.sets).toEqual([
    { weight: 40000, reps: 12, rir: "2-3", restSeconds: 60, memo: "" },
    { weight: 42500, reps: 10, rir: "1", restSeconds: 90, memo: "" }
  ]);
});

test("3: ガイドのプリフィル(前回記録・メニュー外追加)でもメモ欄は空になる", async ({ page }) => {
  await bootApp(page);
  await startGuideFromCopy(page);

  // コピー由来のセット入力にメモが乗っていない
  const memoValue = await page.evaluate(() => document.querySelector("#guideSetMemo").value);
  expect(memoValue).toBe("");

  // メニュー外で同じ種目(前回メモあり)を追加してもメモ欄は空
  await page.click("#completeGuideSetButton");
  await expect(page.locator("#guideFinishedSetCard")).toBeVisible();
  await page.click("#guideAlternateExerciseButton");
  await expect(page.locator("#guideLeaveItemModal")).toHaveClass(/is-open/);
  await page.click("#guideLeaveDeferButton");
  await page.click("#guideAddExerciseButton");
  await page.evaluate(() => document.querySelector("#exerciseList [data-exercise-id]").click());
  await expect(page.locator("#guideSetCard")).toBeVisible();
  const externalMemo = await page.evaluate(() => document.querySelector("#guideSetMemo").value);
  expect(externalMemo).toBe("");
});
