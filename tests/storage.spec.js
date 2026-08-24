"use strict";

const { test, expect } = require("@playwright/test");
const { installBrowserTestMode, installNativeMock, buildLegacyData, waitForTestApi } = require("./helpers");

/*
 * 指示書① リグレッションテスト(追加分)。
 * StorageService(A案: 起動時全ロード＋メモリキャッシュ)の移行が既存挙動を壊していないことを保証する。
 */

// 追加1: 記録 → リロード → データ保持(ブラウザ=localStorage同期バックエンド)
test("追加1: 記録 → リロード → データが保持される", async ({ page }) => {
  await installBrowserTestMode(page);
  await page.goto("/");
  await waitForTestApi(page);

  const sessionId = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const data = api.blankData();
    const now = new Date().toISOString();
    const sid = "sess-persist-1";
    data.sessions.push({ id: sid, date: "2026-07-05", locationType: "gym", createdAt: now, updatedAt: now });
    data.cardios.push({ id: "cardio-persist-1", sessionId: sid, type: "ランニング", durationMinutes: 30, distanceKm: 5, createdAt: now, updatedAt: now });
    api.setData(data);
    window.GymLog.storage.persist();
    return sid;
  });

  await page.reload();
  await waitForTestApi(page);

  const survived = await page.evaluate((sid) => {
    return window.GymLog.__test__.getData().sessions.some((s) => s.id === sid);
  }, sessionId);

  expect(survived).toBe(true);
});

// 追加2: 旧localStorageデータありの状態で初回起動 → マイグレーション後にデータが読める
test("追加2: 旧localStorageデータあり → 初回起動でマイグレーションされデータが読める", async ({ page }) => {
  const legacy = JSON.stringify(buildLegacyData("sess-legacy"));
  await installNativeMock(page, {
    prefsSeed: {},                                   // Preferencesは空(初回)
    localStorageSeed: { "gymlog-data-v1": legacy }   // 旧データはlocalStorageにある
  });
  await page.goto("/");
  await waitForTestApi(page);

  const result = await page.evaluate(() => ({
    hasSession: window.GymLog.__test__.getData().sessions.some((s) => s.id === "sess-legacy"),
    prefsHasData: !!window.__MOCK_PREFS_STORE__["gymlog-data-v1"],
    migratedFlag: window.__MOCK_PREFS_STORE__["gymlog-migrated-v1"],
    isNative: window.GymLog.storageService.isNative()
  }));

  expect(result.isNative).toBe(true);        // ネイティブ経路で動作している
  expect(result.hasSession).toBe(true);      // マイグレーション後のデータが読める
  expect(result.prefsHasData).toBe(true);    // Preferencesへコピーされた
  expect(result.migratedFlag).toBe("1");     // 完了フラグが立った
});

// 追加3: 重量提案が履歴を正しく参照する(オンザフライ計算が壊れていない)
test("追加3: 重量提案が履歴を正しく参照する(オンザフライ計算)", async ({ page }) => {
  await installBrowserTestMode(page);
  await page.goto("/");
  await waitForTestApi(page);

  const exerciseId = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const data = api.blankData();
    const bench = data.exercises.find((e) => e.name === "ベンチプレス"); // 胸(legs以外) → +2.5kg
    const now = new Date().toISOString();
    const sid = "sess-hist-1";
    const rid = "rec-hist-1";
    // 指示書⑨-3-2: 提案は同一ジムの履歴が2回以上あるときだけ出るため、古い履歴も1件用意する
    data.sessions.push({ id: "sess-hist-0", date: "2026-06-24", locationType: "gym", createdAt: "2026-06-24T00:00:00.000Z", updatedAt: "2026-06-24T00:00:00.000Z" });
    data.records.push({ id: "rec-hist-0", sessionId: "sess-hist-0", exerciseId: bench.id, orderIndex: 0, createdAt: now, updatedAt: now });
    data.sets.push({ id: "set-0", recordId: "rec-hist-0", setNumber: 1, weight: 47500, reps: 10, rir: "2-3", restSeconds: 90, createdAt: now, updatedAt: now });
    data.sessions.push({ id: sid, date: "2026-07-01", locationType: "gym", createdAt: now, updatedAt: now });
    data.records.push({ id: rid, sessionId: sid, exerciseId: bench.id, orderIndex: 0, createdAt: now, updatedAt: now });
    // メインセット2本とも 50kg(50000g) × 10回以上・RIRは限界(0)以外 → 昇格条件を満たす
    data.sets.push({ id: "set-1", recordId: rid, setNumber: 1, weight: 50000, reps: 12, rir: "2-3", restSeconds: 90, createdAt: now, updatedAt: now });
    data.sets.push({ id: "set-2", recordId: rid, setNumber: 2, weight: 50000, reps: 11, rir: "1", restSeconds: 90, createdAt: now, updatedAt: now });
    api.setData(data);
    window.GymLog.storage.persist();
    return bench.id;
  });

  // リロードして、StorageService経由で読み直したデータで提案が計算されることを確認する
  await page.reload();
  await waitForTestApi(page);

  const suggestion = await page.evaluate((id) => window.GymLog.__test__.calculateWeightSuggestion(id), exerciseId);

  expect(suggestion).not.toBeNull();
  expect(suggestion.baseWeight).toBe(50000);       // 前回の最大重量を正しく参照
  expect(suggestion.promoted).toBe(true);          // 昇格条件を満たす
  expect(suggestion.suggestedWeight).toBe(52500);  // 胸=+2.5kg のオンザフライ増量
});

// 追加4: マイグレーション済みフラグがある場合、2回目以降はマイグレーションをスキップ
test("追加4: マイグレーション済みフラグがあれば2回目以降はスキップする", async ({ page }) => {
  const prefsData = JSON.stringify(buildLegacyData("sess-from-prefs"));
  const localData = JSON.stringify(buildLegacyData("sess-from-localstorage"));
  await installNativeMock(page, {
    prefsSeed: { "gymlog-data-v1": prefsData, "gymlog-migrated-v1": "1" }, // 既にマイグレーション済み
    localStorageSeed: { "gymlog-data-v1": localData }                      // localStorageには別データ
  });
  await page.goto("/");
  await waitForTestApi(page);

  const result = await page.evaluate(() => ({
    fromPrefs: window.GymLog.__test__.getData().sessions.some((s) => s.id === "sess-from-prefs"),
    fromLocal: window.GymLog.__test__.getData().sessions.some((s) => s.id === "sess-from-localstorage"),
    prefsDataSessionId: JSON.parse(window.__MOCK_PREFS_STORE__["gymlog-data-v1"]).sessions[0].id
  }));

  expect(result.fromPrefs).toBe(true);                        // Preferencesのデータが使われる
  expect(result.fromLocal).toBe(false);                       // localStorageはコピーされていない
  expect(result.prefsDataSessionId).toBe("sess-from-prefs");  // Preferencesは上書きされていない
});

// 指示書⑨ マージ前確認2-1: version 2→3 移行の前に、移行前データを別キーへ退避する
test("追加5: version2→3の移行前に gymlog-pre-migration-v2 へ退避される", async ({ page }) => {
  const legacy = JSON.stringify(buildLegacyData("sess-v2"));
  await installNativeMock(page, {
    prefsSeed: {},
    localStorageSeed: { "gymlog-data-v1": legacy }
  });
  await page.goto("/");
  await waitForTestApi(page);

  const result = await page.evaluate(() => {
    const backup = window.__MOCK_PREFS_STORE__["gymlog-pre-migration-v2"];
    return {
      hasBackup: !!backup,
      backupIsOriginal: !!backup && JSON.parse(backup).version === 2 && JSON.parse(backup).sessions[0].id === "sess-v2",
      migratedVersion: window.GymLog.__test__.getData().version
    };
  });

  expect(result.hasBackup).toBe(true);          // 移行前データが退避されている
  expect(result.backupIsOriginal).toBe(true);   // 退避内容は移行前(version 2)そのまま
  expect(result.migratedVersion).toBe(3);       // 本体はversion 3へ移行済み
});
