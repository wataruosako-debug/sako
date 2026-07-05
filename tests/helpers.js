"use strict";

/*
 * テスト共通ヘルパー。
 * - installBrowserTestMode: ブラウザ(localStorage同期バックエンド)でのテストモード有効化
 * - installNativeMock: Capacitorネイティブ環境を偽装し、Preferencesをインメモリでモックする
 *   これによりマイグレーション・非同期書き込み・2回目スキップをブラウザ上のPlaywrightで検証できる
 * - buildLegacyData: validateCurrentData を通る最小の有効データを生成
 */

// テストモードのみ有効化(UIは初期化しない=データ層の検証に集中)
async function installBrowserTestMode(page) {
  await page.addInitScript(() => {
    window.__GYMLOG_TEST_MODE = true;
    window.__GYMLOG_SKIP_INIT = true;
  });
}

// ネイティブ(Capacitor + Preferences)環境の偽装をページ読み込み前に注入する
async function installNativeMock(page, options) {
  options = options || {};
  await page.addInitScript((opts) => {
    var prefsSeed = opts.prefsSeed || {};
    var localStorageSeed = opts.localStorageSeed || {};

    // 旧localStorageデータを事前投入(マイグレーション元)
    try {
      Object.keys(localStorageSeed).forEach(function (key) {
        localStorage.setItem(key, localStorageSeed[key]);
      });
    } catch (error) { /* noop */ }

    // インメモリのPreferencesストア(テストから中身を検証できるようwindowに公開)
    var store = Object.create(null);
    Object.keys(prefsSeed).forEach(function (key) { store[key] = prefsSeed[key]; });
    window.__MOCK_PREFS_STORE__ = store;

    var Preferences = {
      get: function (o) { return Promise.resolve({ value: store[o.key] == null ? null : store[o.key] }); },
      set: function (o) { store[o.key] = String(o.value); return Promise.resolve(); },
      remove: function (o) { delete store[o.key]; return Promise.resolve(); },
      keys: function () { return Promise.resolve({ keys: Object.keys(store) }); },
      clear: function () { Object.keys(store).forEach(function (k) { delete store[k]; }); return Promise.resolve(); }
    };
    window.__MOCK_PREFS__ = Preferences;

    window.Capacitor = {
      isNativePlatform: function () { return true; },
      registerPlugin: function (name) { return name === "Preferences" ? Preferences : {}; },
      Plugins: { Preferences: Preferences }
    };

    window.__GYMLOG_TEST_MODE = true;
    window.__GYMLOG_SKIP_INIT = true;
  }, { prefsSeed: options.prefsSeed || {}, localStorageSeed: options.localStorageSeed || {} });
}

// validateCurrentData を通る最小の有効データ(指定IDのセッションを1件持つ)
function buildLegacyData(sessionId) {
  var now = "2026-07-01T00:00:00.000Z";
  return {
    version: 2,
    profile: null,
    exercises: [],
    sessions: [{ id: sessionId, date: "2026-07-01", locationType: "gym", createdAt: now, updatedAt: now }],
    records: [],
    sets: [],
    cardios: [],
    recentExerciseIds: [],
    routines: [],
    scheduledRoutines: []
  };
}

// __test__(拡張API)が使えるまで待つ
async function waitForTestApi(page) {
  await page.waitForFunction(() => {
    return !!(window.GymLog && window.GymLog.__test__ && typeof window.GymLog.__test__.getData === "function" && window.GymLog.__test__.getData());
  });
}

module.exports = { installBrowserTestMode, installNativeMock, buildLegacyData, waitForTestApi };
