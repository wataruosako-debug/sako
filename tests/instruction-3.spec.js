"use strict";

const { test, expect } = require("@playwright/test");

/*
 * 指示書③ リグレッションテスト。
 * - A-1/A-2: レストタイマーの追従表示(スクロールで上部バー・種目選択モーダル中も表示)
 * - A-3: ピンチ拡縮(クランプ・保持・1本指スクロール非干渉)
 * - B: ボタンのサイズ・色調整がレイアウトを崩していない
 * - C-1: 設定のプロフィール直下にAIテキスト出力
 * - C-2: コピー直後の種目が閉じた状態で表示される
 * - C-3: 完了サマリーから今日分だけをAIテキストでコピーできる
 * タイマーの非自動起動ロックは rest-timer-notify.spec.js(追加3)で担保済み。
 */

test.use({ hasTouch: true, viewport: { width: 390, height: 700 } });

// UIを完全初期化した状態で起動する(ガイド/タイマー設定ON・ヘルプ既読)
async function bootApp(page) {
  await page.addInitScript(() => {
    window.__GYMLOG_TEST_MODE = true;
    if (!localStorage.getItem("gymlog-ui-settings-v1")) {
      localStorage.setItem("gymlog-ui-settings-v1", JSON.stringify({ restTimerEnabled: true, autoStartRestTimer: true, guideModeEnabled: true, guideHelpSeen: true }));
    }
  });
  await page.goto("/");
  await page.waitForFunction(() => !!(window.GymLog && window.GymLog.__test__ && window.GymLog.__test__.getData && window.GymLog.__test__.getData()));
  // 初回起動のプロフィール設定モーダル(350ms遅延で開く)を閉じ、プロフィールを設定しておく
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

// ルーティンからガイドモードを開始し、休憩タイマーを起動する
async function startGuideWithTimer(page) {
  await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const data = api.getData();
    const bench = data.exercises.find((e) => e.name === "ベンチプレス");
    const squat = data.exercises.find((e) => e.name === "スクワット") || data.exercises[1];
    api.draftFromRoutine({ id: "rt-t", name: "テスト", locationType: "gym", exercises: [{ exerciseId: bench.id }, { exerciseId: squat.id }] }, new Date().toISOString().slice(0, 10), null);
  });
  await page.click("#startGuideModeButton");
  await page.click("#guideStartSummary .guide-start-item-main");
  await expect(page.locator("#guideWorkoutScreen")).toHaveClass(/screen--active/);
  await page.evaluate(() => window.GymLog.__test__.startRestTimer(95));
}

test("A-1: スクロールで上部バーに切り替わり、戻ると元の定位置表示だけになる", async ({ page }) => {
  await bootApp(page);
  await startGuideWithTimer(page);

  // 定位置のタイマーが見えている間は上部バーは出さない
  await expect(page.locator("#guideRestTimer")).toBeVisible();
  await expect(page.locator("#restTimerTopBar")).toBeHidden();

  // 下にスクロールしてタイマーが画面上端から外れる → 上部バーに残り時間が出続ける
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(page.locator("#restTimerTopBar")).toBeVisible();
  await expect(page.locator("#restTimerTopBarTime")).toHaveText(/^\d{2}:\d{2}$/);

  // 上部バーの一時停止も効く
  await page.click("#restTimerTopBarPause");
  expect(await page.evaluate(() => window.GymLog.__test__.getRestTimerState().status)).toBe("paused");
  await page.click("#restTimerTopBarPause");
  expect(await page.evaluate(() => window.GymLog.__test__.getRestTimerState().status)).toBe("running");

  // 元の位置に戻ると上部バーは消える
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(page.locator("#restTimerTopBar")).toBeHidden();
  await expect(page.locator("#guideRestTimer")).toBeVisible();
});

test("A-2: 種目選択のモーダル中もタイマーが継続表示される", async ({ page }) => {
  await bootApp(page);
  await startGuideWithTimer(page);

  // メニュー一覧(次の種目選択)モーダル → 上部バーで残り時間が見える
  await page.click("#guideMenuListButton");
  await expect(page.locator("#guideMenuModal")).toHaveClass(/is-open/);
  await expect(page.locator("#restTimerTopBar")).toBeVisible();

  // さらに「メニュー外の種目を行う」で種目選択モーダルを開いても見え続ける
  await page.click("#guideMenuAddExercise");
  await expect(page.locator("#exerciseModal")).toHaveClass(/is-open/);
  await expect(page.locator("#restTimerTopBar")).toBeVisible();

  // モーダルを全部閉じると定位置表示に戻り、バーは消える
  await page.click("#cancelExerciseSelection");
  await page.evaluate(() => {
    document.querySelectorAll(".modal.is-open .modal-close").forEach((b) => b.click());
  });
  await expect(page.locator("#restTimerTopBar")).toBeHidden();
});

test("A-3: ピンチで拡縮でき、範囲制限と保持が効き、1本指と競合しない", async ({ page }) => {
  await bootApp(page);
  await startGuideWithTimer(page);

  // 2本指ピンチ(80px→120px = 1.5倍)
  const pinched = await page.evaluate(() => {
    const box = document.querySelector("#guideRestTimer");
    const rect = box.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const mkTouch = (id, x, y) => new Touch({ identifier: id, target: box, clientX: x, clientY: y });
    const fire = (type, touches) => box.dispatchEvent(new TouchEvent(type, { touches, targetTouches: touches, changedTouches: touches, bubbles: true, cancelable: true }));
    fire("touchstart", [mkTouch(1, cx - 40, cy), mkTouch(2, cx + 40, cy)]);
    fire("touchmove", [mkTouch(1, cx - 60, cy), mkTouch(2, cx + 60, cy)]);
    fire("touchend", []);
    return {
      scale: window.GymLog.__test__.getUiSettings().restTimerScale,
      saved: JSON.parse(localStorage.getItem("gymlog-ui-settings-v1")).restTimerScale
    };
  });
  expect(pinched.scale).toBeCloseTo(1.5, 1);
  expect(pinched.saved).toBeCloseTo(1.5, 1); // Preferences(ブラウザはlocalStorage)に保存される

  // 1本指のタッチでは拡縮しない(スクロールと競合しない)
  const singleTouch = await page.evaluate(() => {
    const box = document.querySelector("#guideRestTimer");
    const rect = box.getBoundingClientRect();
    const mkTouch = (id, x, y) => new Touch({ identifier: id, target: box, clientX: x, clientY: y });
    const fire = (type, touches) => box.dispatchEvent(new TouchEvent(type, { touches, targetTouches: touches, changedTouches: touches, bubbles: true, cancelable: true }));
    fire("touchstart", [mkTouch(1, rect.left + 20, rect.top + 20)]);
    fire("touchmove", [mkTouch(1, rect.left + 20, rect.top + 90)]);
    fire("touchend", []);
    return window.GymLog.__test__.getUiSettings().restTimerScale;
  });
  expect(singleTouch).toBeCloseTo(1.5, 1);

  // 最小/最大でクランプされる
  const clamped = await page.evaluate(() => ({
    max: window.GymLog.__test__.setRestTimerScale(99),
    min: window.GymLog.__test__.setRestTimerScale(0.01)
  }));
  expect(clamped.max).toBe(1.6);
  expect(clamped.min).toBe(0.7);

  // リロードしても選んだサイズが維持される
  await page.evaluate(() => {
    const u = window.GymLog.__test__.getUiSettings();
    u.restTimerScale = 1.3;
    localStorage.setItem("gymlog-ui-settings-v1", JSON.stringify(u));
  });
  await page.reload();
  await page.waitForFunction(() => !!(window.GymLog && window.GymLog.__test__ && window.GymLog.__test__.getData && window.GymLog.__test__.getData()));
  const restored = await page.evaluate(() => ({
    setting: window.GymLog.__test__.getUiSettings().restTimerScale,
    varValue: document.documentElement.style.getPropertyValue("--rest-timer-scale")
  }));
  expect(restored.setting).toBe(1.3);
  expect(restored.varValue).toBe("1.3");
});

test("B: ボタンのサイズ・色調整(メニュー編集の統一 / メニュー外ボタン / 終了の淡い赤)", async ({ page }) => {
  await bootApp(page);
  await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const data = api.getData();
    const bench = data.exercises.find((e) => e.name === "ベンチプレス");
    api.draftFromRoutine({ id: "rt-b", name: "テスト", locationType: "gym", exercises: [{ exerciseId: bench.id }] }, new Date().toISOString().slice(0, 10), null);
  });

  // B-1: メニュー編集パネル内の3ボタンが同じサイズ・フォント
  const sizes = await page.evaluate(() => ["chooseAnotherExercise", "openRoutineListButton", "saveRoutineButton"].map((id) => {
    const el = document.getElementById(id);
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { w: Math.round(rect.width), h: Math.round(rect.height), fs: cs.fontSize };
  }));
  expect(sizes[1]).toEqual(sizes[0]);
  expect(sizes[2]).toEqual(sizes[0]);
  expect(sizes[0].h).toBeGreaterThan(0); // レイアウトが崩れて潰れていない

  // B-2: 「メニュー外の種目を行う」は種目選択ボタンと同系の見た目(青塗りではない)
  const addExternal = await page.evaluate(() => {
    const cs = getComputedStyle(document.getElementById("guideAddExerciseButton"));
    return { background: cs.backgroundColor, color: cs.color, minHeight: cs.minHeight };
  });
  const choiceItemColors = await page.evaluate(() => {
    const probe = document.createElement("button");
    probe.className = "guide-choice-item";
    document.querySelector("#guideNextChoiceList").appendChild(probe);
    const cs = getComputedStyle(probe);
    const result = { background: cs.backgroundColor, color: cs.color };
    probe.remove();
    return result;
  });
  expect(addExternal.background).toBe(choiceItemColors.background);
  expect(addExternal.color).toBe(choiceItemColors.color);
  expect(parseInt(addExternal.minHeight, 10)).toBeGreaterThanOrEqual(48);

  // B-3: 終了ボタン2つが淡い赤系(dangerの赤みを帯びた文字色)になっている
  const exitColors = await page.evaluate(() => ["guideExitButton", "guideExitFromSelectButton"].map((id) => getComputedStyle(document.getElementById(id)).color));
  for (const color of exitColors) {
    // "rgb(229, 72, 77)" と "color(srgb 0.81 0.31 0.34)" の両形式に対応して赤成分の優位を確認する
    let rgb = null;
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    const srgbMatch = color.match(/color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/);
    if (rgbMatch) rgb = [Number(rgbMatch[1]) / 255, Number(rgbMatch[2]) / 255, Number(rgbMatch[3]) / 255];
    else if (srgbMatch) rgb = [Number(srgbMatch[1]), Number(srgbMatch[2]), Number(srgbMatch[3])];
    expect(rgb, color).not.toBeNull();
    expect(rgb[0]).toBeGreaterThan(rgb[1] + 0.2); // 赤が支配的
    expect(rgb[0]).toBeGreaterThan(rgb[2] + 0.2);
  }
});

test("C-1: 設定のプロフィール直下からAIテキスト出力を開ける", async ({ page }) => {
  await bootApp(page);
  // プロフィールグループの中にAI出力ボタンがある
  const inProfileGroup = await page.evaluate(() => {
    const button = document.querySelector("#aiExportButton");
    const group = button && button.closest(".settings-group");
    return group ? group.getAttribute("aria-label") : null;
  });
  expect(inProfileGroup).toBe("プロフィール");

  await page.click("#homeSettingsButton");
  await expect(page.locator("#settingsScreen")).toHaveClass(/screen--active/);
  await page.click("#aiExportButton");
  await expect(page.locator("#aiExportModal")).toHaveClass(/is-open/);
});

test("C-2: メニューをコピーした直後は種目が閉じた状態で表示される", async ({ page }) => {
  await bootApp(page);
  const state = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const data = api.getData();
    const bench = data.exercises.find((e) => e.name === "ベンチプレス");
    const now = new Date().toISOString();
    data.sessions.push({ id: "s-copy", date: "2026-07-01", locationType: "gym", totalCalories: 100, memo: "", createdAt: now, updatedAt: now });
    data.records.push({ id: "r-copy", sessionId: "s-copy", exerciseId: bench.id, orderIndex: 0 });
    data.sets.push({ id: "set-copy", recordId: "r-copy", setNumber: 1, weight: 50000, reps: 10, rir: "2-3", restSeconds: 90, memo: "" });
    api.setData(data);
    api.setDraft(api.createDraftFromSession("s-copy", new Date().toISOString().slice(0, 10), false));
    api.finishCopiedDraft();
    return {
      workoutActive: document.querySelector("#workoutScreen").classList.contains("screen--active"),
      groupCount: document.querySelectorAll("#savedSetsList .saved-group").length,
      expandedCount: document.querySelectorAll("#savedSetsList .saved-group.is-expanded").length
    };
  });
  expect(state.workoutActive).toBe(true);
  expect(state.groupCount).toBe(1);
  expect(state.expandedCount).toBe(0); // 閉じた状態がデフォルト
});

test("C-3: 完了サマリーから今日行ったメニューだけをAIテキストでコピーできる", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await bootApp(page);
  await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const data = api.getData();
    const bench = data.exercises.find((e) => e.name === "ベンチプレス");
    const today = new Date().toISOString().slice(0, 10);
    const now = new Date().toISOString();
    // 今日のセッションと、対象外であるべき過去のセッションを入れる
    data.sessions.push({ id: "s-today", date: today, locationType: "gym", totalCalories: 120, memo: "", createdAt: now, updatedAt: now });
    data.records.push({ id: "r-today", sessionId: "s-today", exerciseId: bench.id, orderIndex: 0 });
    data.sets.push({ id: "set-today", recordId: "r-today", setNumber: 1, weight: 60000, reps: 8, rir: "1", restSeconds: 90, memo: "" });
    data.sessions.push({ id: "s-old", date: "2026-06-01", locationType: "home", totalCalories: 80, memo: "", createdAt: now, updatedAt: now });
    data.records.push({ id: "r-old", sessionId: "s-old", exerciseId: bench.id, orderIndex: 0 });
    data.sets.push({ id: "set-old", recordId: "r-old", setNumber: 1, weight: 40000, reps: 12, rir: "2-3", restSeconds: 60, memo: "" });
    api.setData(data);
    api.showWorkoutSummary({ date: today, records: [], cardios: [], calories: 120, volumeKg: 480, prEvents: [] });
  });
  await expect(page.locator("#workoutSummaryModal")).toHaveClass(/is-open/);
  await expect(page.locator("#copyWorkoutSummaryAiButton")).toBeVisible();
  await page.click("#copyWorkoutSummaryAiButton");
  await expect(page.locator("#workoutSummaryAiCopyStatus")).toHaveText(/コピーしました/);
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain("【ノビログ トレーニング記録】");
  expect(clipboard).toContain("ベンチプレス");
  expect(clipboard).toContain("60.0kg × 8回");
  expect(clipboard).not.toContain("40.0kg × 12回"); // 過去日の記録は含まれない
});
