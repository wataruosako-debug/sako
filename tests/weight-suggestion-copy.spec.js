"use strict";

const { test, expect } = require("@playwright/test");
const { installBrowserTestMode, waitForTestApi } = require("./helpers");

/*
 * 回帰テスト: 「次回に反映」で承認した増量提案を、前回セッションのコピーで作った下書きにも反映する。
 * (従来はコピー由来のセットは提案がスキップされていた不具合の修正)
 */

async function setupWithPending(page) {
  await installBrowserTestMode(page);
  await page.goto("/");
  await waitForTestApi(page);
  return page.evaluate(() => {
    const api = window.GymLog.__test__;
    const data = api.blankData();
    const bench = data.exercises.find((e) => e.name === "ベンチプレス"); // 胸 → +2.5kg
    const now = "2026-07-04T10:00:00.000Z";
    data.sessions.push({ id: "sN", date: "2026-07-04", locationType: "gym", createdAt: now, updatedAt: now });
    data.records.push({ id: "rN", sessionId: "sN", exerciseId: bench.id, orderIndex: 0, createdAt: now, updatedAt: now });
    data.sets.push({ id: "s1", recordId: "rN", setNumber: 1, weight: 50000, reps: 12, rir: "2-3", restSeconds: 90, createdAt: now, updatedAt: now });
    data.sets.push({ id: "s2", recordId: "rN", setNumber: 2, weight: 50000, reps: 11, rir: "1", restSeconds: 90, createdAt: now, updatedAt: now });
    api.setData(data);
    window.GymLog.storage.persist();
    api.storePendingSuggestion(bench.id); // 「次回に反映」相当
    return bench.id;
  });
}

test("コピー由来の下書きセットに承認済み提案(+2.5kg)が反映される", async ({ page }) => {
  const benchId = await setupWithPending(page);

  const result = await page.evaluate((benchId) => {
    const api = window.GymLog.__test__;
    // appendRecordsAndCardiosToDraft が作るコピー下書きの形(前回重量50kgが入っている)
    const records = [{
      tempId: "dr", exerciseId: benchId, orderIndex: 0,
      sets: [
        { tempId: "c1", setNumber: 1, weight: 50000, reps: 12, rir: "2-3", restSeconds: 90, memo: "" },
        { tempId: "c2", setNumber: 2, weight: 50000, reps: 11, rir: "1", restSeconds: 90, memo: "" },
        { tempId: "c3", setNumber: 3, weight: 45000, reps: 10, rir: "2-3", restSeconds: 90, memo: "" } // アップ重量(据え置き対象)
      ]
    }];
    api.applyPendingSuggestionsToDraftRecords(records);
    const weights = records[0].sets.map((s) => s.weight);
    // 冪等性: もう一度適用しても変化しない
    api.applyPendingSuggestionsToDraftRecords(records);
    const weightsAgain = records[0].sets.map((s) => s.weight);
    return { weights, weightsAgain };
  }, benchId);

  // メインセット(50kg)は52.5kgへ、アップ(45kg)は据え置き
  expect(result.weights).toEqual([52500, 52500, 45000]);
  // 二重適用されない(冪等)
  expect(result.weightsAgain).toEqual([52500, 52500, 45000]);
});

test("提案が無い種目のコピー下書きは変化しない", async ({ page }) => {
  await installBrowserTestMode(page);
  await page.goto("/");
  await waitForTestApi(page);

  const weights = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const data = api.blankData();
    const squat = data.exercises.find((e) => e.name === "スクワット");
    api.setData(data); // pendingSuggestions は空
    const records = [{ tempId: "dr", exerciseId: squat.id, orderIndex: 0, sets: [{ tempId: "c1", setNumber: 1, weight: 60000, reps: 10, rir: "", restSeconds: 90, memo: "" }] }];
    api.applyPendingSuggestionsToDraftRecords(records);
    return records[0].sets.map((s) => s.weight);
  });

  expect(weights).toEqual([60000]); // 承認済み提案が無いので据え置き
});
