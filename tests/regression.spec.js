"use strict";

const { test, expect } = require("@playwright/test");
const { waitForTestApi } = require("./helpers");

/*
 * 基本リグレッション: ブラウザでの起動と保存経路がStorageService移行後も健全であること。
 */

test("ブラウザで正常に起動しホーム画面が表示される", async ({ page }) => {
  const jsErrors = [];
  // 外部リソース(フォントCDN/favicon)の読み込み失敗はネットワークポリシー由来でありアプリの不具合ではないため除外し、
  // JS例外(pageerror)とアプリが出すconsole.errorのみを対象にする。
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/Failed to load resource|ERR_CONNECTION|favicon|net::/i.test(text)) return;
    jsErrors.push(text);
  });
  page.on("pageerror", (error) => jsErrors.push(String(error)));

  await page.goto("/");
  await page.waitForFunction(() => !!(window.GymLog && window.GymLog.storageService));

  const info = await page.evaluate(() => ({
    booted: !!window.GymLog,
    syncBackend: window.GymLog.storageService.isSyncBackend(),
    native: window.GymLog.storageService.isNative(),
    startupError: !!document.querySelector(".startup-error")
  }));

  expect(info.booted).toBe(true);
  expect(info.syncBackend).toBe(true);  // ブラウザ → localStorage同期バックエンド
  expect(info.native).toBe(false);
  expect(info.startupError).toBe(false);
  await expect(page.locator("#homeScreen")).toBeVisible();
  expect(jsErrors, "起動時にJSエラーが出ていない").toEqual([]);
});

test("StorageServiceはlocalStorageへ書き込み、リロード後も読める", async ({ page }) => {
  await page.addInitScript(() => { window.__GYMLOG_TEST_MODE = true; window.__GYMLOG_SKIP_INIT = true; });
  await page.goto("/");
  await waitForTestApi(page);

  await page.evaluate(() => window.GymLog.storageService.setItem("gymlog-probe-key", "probe-value"));
  // 同期バックエンドではlocalStorageへ直接反映される
  const inLocalStorage = await page.evaluate(() => localStorage.getItem("gymlog-probe-key"));
  expect(inLocalStorage).toBe("probe-value");

  await page.reload();
  await page.waitForFunction(() => !!(window.GymLog && window.GymLog.storageService));
  const afterReload = await page.evaluate(() => window.GymLog.storageService.getItem("gymlog-probe-key"));
  expect(afterReload).toBe("probe-value");
});
