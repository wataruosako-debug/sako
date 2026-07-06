"use strict";

const { test, expect } = require("@playwright/test");
const { installBrowserTestMode, waitForTestApi } = require("./helpers");

/*
 * 回帰テスト: コピーで作った下書きの有酸素は「予定」扱いになり、
 * 実際に記録しない限り保存(実績)に入らないこと。
 * (従来はコピー時に有酸素が記録済みリストへ直接入り、触らず保存すると実績になっていた不具合の修正)
 */

// 前日: ペックフライ(筋トレ) + ウォーキング(有酸素) を記録済みのデータを用意
async function setupSourceDay(page) {
  await installBrowserTestMode(page);
  await page.goto("/");
  await waitForTestApi(page);
  return page.evaluate(() => {
    const api = window.GymLog.__test__;
    const data = api.blankData();
    const pec = data.exercises.find((e) => e.name === "ペックフライ");
    const now = "2026-07-05T09:00:00.000Z";
    data.sessions.push({ id: "s_src", date: "2026-07-05", locationType: "gym", createdAt: now, updatedAt: now });
    data.records.push({ id: "r_src", sessionId: "s_src", exerciseId: pec.id, orderIndex: 0, createdAt: now, updatedAt: now });
    data.sets.push({ id: "set_1", recordId: "r_src", setNumber: 1, weight: 50000, reps: 10, rir: "2-3", restSeconds: 90, createdAt: now, updatedAt: now });
    data.cardios.push({ id: "cd_1", sessionId: "s_src", type: "ウォーキング", durationMinutes: 35, distanceKm: 3.2, inclinePercent: 6, speedKmh: 5.5, calories: 315, memo: "", createdAt: now, updatedAt: now });
    api.setData(data);
    window.GymLog.storage.persist();
    return pec.id;
  });
}

test("コピーした有酸素は予定になり、実績(cardios)には入らない", async ({ page }) => {
  await setupSourceDay(page);

  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const copied = api.createDraftFromSession("s_src", "2026-07-06", false);
    return {
      cardios: (copied.cardios || []).map((c) => c.type),
      pending: copied.pendingCardioTypes || [],
      recordSetCount: copied.records.length ? copied.records[0].sets.length : 0
    };
  });

  expect(result.cardios).toEqual([]);                 // 実績には入らない
  expect(result.pending).toEqual(["ウォーキング"]);   // 予定として引き継がれる
  expect(result.recordSetCount).toBe(1);              // 筋トレのコピーは従来どおり
});

test("コピー後、有酸素を触らず保存すると実績に有酸素が入らない", async ({ page }) => {
  await setupSourceDay(page);

  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const copied = api.createDraftFromSession("s_src", "2026-07-06", false);
    api.setDraft(copied);
    api.commitWorkoutSave();
    const data = api.getData();
    const newSession = data.sessions.find((s) => s.date === "2026-07-06");
    if (!newSession) return { saved: false };
    return {
      saved: true,
      savedCardios: data.cardios.filter((c) => c.sessionId === newSession.id).length,
      savedSets: data.records.filter((r) => r.sessionId === newSession.id).length,
      srcCardioKept: data.cardios.some((c) => c.sessionId === "s_src") // 元の日の実績は残る
    };
  });

  expect(result.saved).toBe(true);
  expect(result.savedCardios).toBe(0);   // やっていないウォーキングは保存されない
  expect(result.savedSets).toBe(1);      // 筋トレは保存される
  expect(result.srcCardioKept).toBe(true);
});

test("編集(保存済みセッションの再読込)では記録済み有酸素を維持する", async ({ page }) => {
  await setupSourceDay(page);

  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    // keepSessionId=true = 編集/マージ系の経路
    const edited = api.createDraftFromSession("s_src", "2026-07-05", true);
    return {
      cardios: (edited.cardios || []).map((c) => c.type),
      pending: edited.pendingCardioTypes || []
    };
  });

  expect(result.cardios).toEqual(["ウォーキング"]);  // 実際に記録した日を編集する時は維持
  expect(result.pending).toEqual([]);
});

test("旧「傾斜ウォーク」もコピー時はウォーキング予定に正規化される", async ({ page }) => {
  await installBrowserTestMode(page);
  await page.goto("/");
  await waitForTestApi(page);

  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const data = api.blankData();
    const now = "2026-07-05T09:00:00.000Z";
    data.sessions.push({ id: "s_legacy", date: "2026-07-05", locationType: "gym", createdAt: now, updatedAt: now });
    data.cardios.push({ id: "cd_legacy", sessionId: "s_legacy", type: "傾斜ウォーク", durationMinutes: 20, distanceKm: 1.5, inclinePercent: 8, speedKmh: 4.5, calories: 120, memo: "", createdAt: now, updatedAt: now });
    api.setData(data);
    const copied = api.createDraftFromSession("s_legacy", "2026-07-06", false);
    return { cardios: copied.cardios || [], pending: copied.pendingCardioTypes || [] };
  });

  expect(result.cardios).toEqual([]);
  expect(result.pending).toEqual(["ウォーキング"]);
});
