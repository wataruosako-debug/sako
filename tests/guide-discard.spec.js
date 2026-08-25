"use strict";

const { test, expect } = require("@playwright/test");

/*
 * 指示書⑪ ガイドモードを記録せずに終了できることのテスト。
 * 空(完了セット0・有酸素なし)なら確認もモーダルもなく即終了、記録があれば確認ダイアログ経由で破棄。
 * 「保存して終了」の既存挙動と、破棄時のタイマー/通知の後始末も確認する。
 */

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

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
    api.setData(data);
  });
}

// ベンチ+スクワットのルーティンからガイドを開始し、1セット目の入力画面まで進める
async function startGuide(page) {
  await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const data = api.getData();
    const bench = data.exercises.find((e) => e.name === "ベンチプレス");
    const squat = data.exercises.find((e) => e.name === "スクワット") || data.exercises[1];
    api.draftFromRoutine({ id: "rt-discard", name: "テスト", locationType: "gym", exercises: [{ exerciseId: bench.id }, { exerciseId: squat.id }] }, new Date().toISOString().slice(0, 10), null);
  });
  await page.click("#startGuideModeButton");
  await page.click("#guideStartSummary .guide-start-item-main");
  await expect(page.locator("#guideSetCard")).toBeVisible();
}

async function sessionCount(page) {
  return page.evaluate(() => window.GymLog.__test__.getData().sessions.length);
}

test("1+2+3+10: 空の状態で終了すると確認なしで即終了し、セッションも下書きも残らない", async ({ page }) => {
  await bootApp(page);
  const before = await sessionCount(page);
  await startGuide(page);

  // 予定セットはプリフィルされているが、まだ1セットも完了していない状態
  expect(await page.evaluate(() => window.GymLog.__test__.guideHasAnyCompletedWork())).toBe(false);

  await page.click("#guideExitButton");

  // 10: モーダルが開かず、そのままホームへ戻る
  await expect(page.locator("#guideExitModal")).not.toHaveClass(/is-open/);
  await expect(page.locator("#confirmModal")).not.toHaveClass(/is-open/);
  await expect(page.locator("#homeScreen")).toHaveClass(/screen--active/);

  const state = await page.evaluate(() => ({
    sessions: window.GymLog.__test__.getData().sessions.length,
    draft: window.GymLog.__test__.getDraft(),
    savedDraft: localStorage.getItem("gymlog-draft-v1")
  }));
  expect(state.sessions).toBe(before);      // 2: セッションは保存されない
  expect(state.draft).toBeNull();           // 3: 下書きは破棄されている
  expect(state.savedDraft).toBeNull();      // 3: 保存済み下書きキーも消えている
});

test("3: 即終了後にリロードしても前のガイド状態が復元されない", async ({ page }) => {
  await bootApp(page);
  await startGuide(page);
  await page.click("#guideExitButton");
  await expect(page.locator("#homeScreen")).toHaveClass(/screen--active/);

  await page.reload();
  await page.waitForFunction(() => !!(window.GymLog && window.GymLog.__test__ && window.GymLog.__test__.getData()));
  await page.waitForTimeout(700);
  const state = await page.evaluate(() => ({
    draft: window.GymLog.__test__.getDraft(),
    resumeModalOpen: document.querySelector("#draftResumeModal").classList.contains("is-open"),
    guideActive: document.querySelector("#guideWorkoutScreen").classList.contains("screen--active")
  }));
  expect(state.draft).toBeNull();
  expect(state.resumeModalOpen).toBe(false);
  expect(state.guideActive).toBe(false);
});

test("4: 種目を選んで予定セットがプリフィルされただけの状態は「空」と判定される", async ({ page }) => {
  await bootApp(page);
  await startGuide(page);
  const state = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const item = api.getDraft().guideState.menuItems[0];
    return {
      hasWork: api.guideHasAnyCompletedWork(),
      plannedCount: item.plannedSets.length,     // 予定セットは存在する
      completedCount: item.completedSets.length  // 完了は0
    };
  });
  expect(state.plannedCount).toBeGreaterThan(0);
  expect(state.completedCount).toBe(0);
  expect(state.hasWork).toBe(false);
});

test("5: 有酸素の記録のみが入力されている状態は「空ではない」と判定される", async ({ page }) => {
  await bootApp(page);
  await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const data = api.getData();
    const walk = data.exercises.find((e) => e.name === "ウォーキング");
    api.draftFromRoutine({ id: "rt-cardio", name: "有酸素", locationType: "gym", exercises: [{ exerciseId: walk.id }] }, new Date().toISOString().slice(0, 10), null);
  });
  await page.click("#startGuideModeButton");
  await page.click("#guideStartSummary .guide-start-item-main");
  await expect(page.locator("#guideCardioCard")).toBeVisible();

  expect(await page.evaluate(() => window.GymLog.__test__.guideHasAnyCompletedWork())).toBe(false);

  // 時間を入力して有酸素を完了 → 「空ではない」になる
  await page.fill("#guideCardioDuration", "30");
  await page.click("#completeGuideCardioButton");
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.GymLog.__test__.guideHasAnyCompletedWork())).toBe(true);

  // 終了を押すと(空でないので)モーダルが開く
  await page.click("#guideExitButton");
  await expect(page.locator("#guideExitModal")).toHaveClass(/is-open/);
});

test("6+7: 記録がある状態の破棄は確認が出て、キャンセルすると記録が保持される", async ({ page }) => {
  await bootApp(page);
  await startGuide(page);
  await page.click("#completeGuideSetButton");
  await expect(page.locator("#guideFinishedSetCard")).toBeVisible();

  await page.click("#guideExitButton");
  await expect(page.locator("#guideExitModal")).toHaveClass(/is-open/);

  // 6: 「保存せず破棄」で確認ダイアログが出る
  await page.click("#discardGuideDraftButton");
  await expect(page.locator("#confirmModal")).toHaveClass(/is-open/);
  await expect(page.locator("#confirmMessage")).toHaveText("記録した内容は保存されません。破棄しますか？");

  // 7: キャンセルするとガイドに留まり、記録済みセットが保持される
  await page.click("#confirmCancel");
  const state = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const draft = api.getDraft();
    return {
      hasDraft: !!draft,
      completed: draft ? draft.guideState.menuItems[0].completedSets.length : 0,
      guideActive: document.querySelector("#guideWorkoutScreen").classList.contains("screen--active")
    };
  });
  expect(state.hasDraft).toBe(true);
  expect(state.completed).toBe(1);
  expect(state.guideActive).toBe(true);
});

test("8: 確認を承認すると下書きが破棄され、セッションが保存されない", async ({ page }) => {
  await bootApp(page);
  const before = await sessionCount(page);
  await startGuide(page);
  await page.click("#completeGuideSetButton");
  await expect(page.locator("#guideFinishedSetCard")).toBeVisible();

  await page.click("#guideExitButton");
  await page.click("#discardGuideDraftButton");
  await expect(page.locator("#confirmModal")).toHaveClass(/is-open/);
  await page.click("#confirmAccept");

  await expect(page.locator("#homeScreen")).toHaveClass(/screen--active/);
  const state = await page.evaluate(() => ({
    sessions: window.GymLog.__test__.getData().sessions.length,
    draft: window.GymLog.__test__.getDraft(),
    savedDraft: localStorage.getItem("gymlog-draft-v1"),
    timerStatus: window.GymLog.__test__.getRestTimerState().status
  }));
  expect(state.sessions).toBe(before);
  expect(state.draft).toBeNull();
  expect(state.savedDraft).toBeNull();
  // §5: 破棄時にレストタイマー(と予約通知)が後始末されている
  expect(state.timerStatus).toBe("idle");
});

test("9: 「保存して終了」の既存挙動は変わっていない(回帰)", async ({ page }) => {
  await bootApp(page);
  const before = await sessionCount(page);
  await startGuide(page);
  await page.click("#completeGuideSetButton");
  await expect(page.locator("#guideFinishedSetCard")).toBeVisible();

  await page.click("#guideExitButton");
  await expect(page.locator("#guideExitModal")).toHaveClass(/is-open/);
  await page.click("#saveGuideProgress");
  await page.waitForTimeout(600);

  const state = await page.evaluate(() => {
    const data = window.GymLog.__test__.getData();
    const session = data.sessions[data.sessions.length - 1];
    const records = session ? data.records.filter((r) => r.sessionId === session.id) : [];
    const sets = records.length ? data.sets.filter((s) => s.recordId === records[0].id) : [];
    return { sessions: data.sessions.length, setCount: sets.length };
  });
  expect(state.sessions).toBe(before + 1);   // セッションが保存されている
  expect(state.setCount).toBe(1);            // 記録したセットが保存されている
});

test("11: 3つの終了導線すべてで、空のときは同じ即終了挙動になる", async ({ page }) => {
  await bootApp(page);

  // (a) ヘッダーの戻る
  await startGuide(page);
  await page.click("#guideBackHomeButton");
  await expect(page.locator("#guideExitModal")).not.toHaveClass(/is-open/);
  await expect(page.locator("#homeScreen")).toHaveClass(/screen--active/);
  expect(await page.evaluate(() => window.GymLog.__test__.getDraft())).toBeNull();

  // (b) ヘッダーの終了
  await startGuide(page);
  await page.click("#guideExitButton");
  await expect(page.locator("#guideExitModal")).not.toHaveClass(/is-open/);
  await expect(page.locator("#homeScreen")).toHaveClass(/screen--active/);
  expect(await page.evaluate(() => window.GymLog.__test__.getDraft())).toBeNull();

  // (c) 種目選択カードの「終了する」(セット未記録のまま「その他の操作 → 別の種目を行う」で選択カードへ)
  await startGuide(page);
  await page.evaluate(() => { document.querySelector("#guideSetOtherActions").open = true; });
  await page.click("#replaceGuideItemButton");
  await expect(page.locator("#guideSelectNextCard")).toBeVisible();
  await page.click("#guideExitFromSelectButton");
  await expect(page.locator("#guideExitModal")).not.toHaveClass(/is-open/);
  await expect(page.locator("#homeScreen")).toHaveClass(/screen--active/);
  expect(await page.evaluate(() => window.GymLog.__test__.getDraft())).toBeNull();
});

test("12: 記録がある状態で終了を押すと従来どおりモーダルが開く", async ({ page }) => {
  await bootApp(page);
  await startGuide(page);
  await page.click("#completeGuideSetButton");
  await expect(page.locator("#guideFinishedSetCard")).toBeVisible();

  await page.click("#guideExitButton");
  await expect(page.locator("#guideExitModal")).toHaveClass(/is-open/);
  // 保存・戻る・破棄の3ボタンが並ぶ(破棄は最下部)
  const buttons = await page.evaluate(() => Array.from(document.querySelectorAll("#guideExitModal .modal-actions button")).map((b) => b.id));
  expect(buttons).toEqual(["saveGuideProgress", "cancelGuideExit", "discardGuideDraftButton"]);
});
