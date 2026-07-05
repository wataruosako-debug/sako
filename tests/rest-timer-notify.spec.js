"use strict";

const { test, expect } = require("@playwright/test");
const {
  installBrowserTestMode,
  installTimerNativeMock,
  simulateHiddenAndSync,
  waitForTestApi
} = require("./helpers");

/*
 * 指示書② リグレッションテスト。
 * レストタイマーの通知予約/キャンセル・許可拒否時フォールバック・通常フロー非自動起動(ロック済み設計)。
 * ネイティブ挙動は Capacitor(LocalNotifications/Haptics) モックで検証する。
 */

// 追加1: タイマー開始 → (background化で)通知予約 → 停止で予約キャンセル
test("追加1: タイマー開始→背面化で通知予約→停止でキャンセルされる", async ({ page }) => {
  await installTimerNativeMock(page, { checkResult: "granted" });
  await page.goto("/");
  await waitForTestApi(page);

  await page.evaluate(() => window.GymLog.__test__.startRestTimer(60));
  // 初回起動時に許可要求が走り、granted になるのを待つ
  await page.waitForFunction(() => window.GymLog.__test__.restTimerNotify.getPermissionState() === "granted");

  // フォアグラウンドのままなら予約は張らない(=二重通知回避)
  const scheduledWhileVisible = await page.evaluate(() => window.__NOTIF_CALLS__.schedule.length);
  expect(scheduledWhileVisible).toBe(0);

  // 背面化 → 終了時刻に通知予約(id=1001)
  await simulateHiddenAndSync(page);
  const afterHidden = await page.evaluate(() => ({
    scheduled: window.__NOTIF_CALLS__.schedule.length,
    id: window.__NOTIF_CALLS__.schedule.length ? window.__NOTIF_CALLS__.schedule[0].notifications[0].id : null
  }));
  expect(afterHidden.scheduled).toBeGreaterThan(0);
  expect(afterHidden.id).toBe(1001);

  // 停止 → 予約キャンセルが呼ばれる
  const cancelBefore = await page.evaluate(() => window.__NOTIF_CALLS__.cancel.length);
  await page.evaluate(() => window.GymLog.__test__.stopRestTimer());
  const cancelAfter = await page.evaluate(() => window.__NOTIF_CALLS__.cancel.length);
  expect(cancelAfter).toBeGreaterThan(cancelBefore);
});

// 追加2: 通知許可が拒否されてもタイマーは正常動作し、通知予約はしない(静かにフォールバック)
test("追加2: 通知許可拒否でもタイマーは正常動作する", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));

  await installTimerNativeMock(page, { checkResult: "prompt", requestResult: "denied" });
  await page.goto("/");
  await waitForTestApi(page);

  await page.evaluate(() => window.GymLog.__test__.startRestTimer(60));
  await page.waitForFunction(() => window.GymLog.__test__.restTimerNotify.getPermissionState() === "denied");

  const status = await page.evaluate(() => window.GymLog.__test__.getRestTimerState().status);
  expect(status).toBe("running"); // タイマーは表示・カウントとも正常動作

  // 背面化しても許可が無いので予約は張らない
  await simulateHiddenAndSync(page);
  const scheduled = await page.evaluate(() => window.__NOTIF_CALLS__.schedule.length);
  expect(scheduled).toBe(0);
  expect(errors, "拒否時にエラーを出さない").toEqual([]);
});

// 追加3: 通常フロー(非ガイド)でセット保存してもタイマーは自動起動しない(ロック済み設計の維持)
test("追加3: 通常フローのセット保存でタイマーが自動起動しない", async ({ page }) => {
  await installBrowserTestMode(page);
  await page.goto("/");
  await waitForTestApi(page);

  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const data = api.blankData();
    const bench = data.exercises.find((e) => e.name === "ベンチプレス");
    api.setData(data);
    // 非ガイドの下書きに1セット用意し、そのセットを編集保存する(通常フロー)
    api.setDraft({
      locationType: "gym",
      date: "2026-07-05",
      records: [{ exerciseId: bench.id, sets: [{ tempId: "t1", setNumber: 1, weight: 50000, reps: 10, rir: "", restSeconds: 90, memo: "" }] }],
      cardios: []
    });
    api.setEditor({ selectedExerciseId: bench.id, editingSetTempId: "t1", selectedRest: 90 });
    document.querySelector("#repsInput").value = "10";
    document.querySelector("#weightInput").value = "50";
    document.querySelector("#setMemo").value = "";

    const before = api.getRestTimerState().status;
    api.saveCurrentSet(true);
    return { before: before, after: api.getRestTimerState().status };
  });

  expect(result.before).toBe("idle");
  expect(result.after).toBe("idle"); // 通常フローでは自動起動しないまま
});
