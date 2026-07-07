"use strict";

const { test, expect } = require("@playwright/test");

/*
 * 指示書⑤ リグレッションテスト。
 * - 1: TOPのカレンダーが固定され、上にスクロールしてもズレない
 *      (原因だった vh/dvh 混在 → body/.app/.screen の高さがTOP画面と一致していること)
 * - 1: カレンダー下の余白が過剰でない(広告用の隙間は50〜70px、余りはカレンダーが吸収)
 * - 2: 「今月の運動」の数字が1桁/2桁とも円の上下左右中央に収まる
 * 注: vh と dvh の差は Chromium では常に0のため、Safari実機の差分そのものは再現できない。
 *     代わりに「文書のどの層(body/.app/#homeScreen)にもスクロール余地がない」ことを層ごとに検証する。
 */

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

async function bootApp(page) {
  await page.addInitScript(() => {
    window.__GYMLOG_TEST_MODE = true;
    if (!localStorage.getItem("gymlog-ui-settings-v1")) {
      localStorage.setItem("gymlog-ui-settings-v1", JSON.stringify({ restTimerEnabled: true, autoStartRestTimer: false, guideModeEnabled: true, guideHelpSeen: true }));
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

test("1: TOPはどの層にもスクロール余地がなく、カレンダーがズレない", async ({ page }) => {
  await bootApp(page);

  const state = await page.evaluate(() => {
    const doc = document.documentElement;
    const app = document.querySelector(".app");
    const home = document.querySelector("#homeScreen");
    const calBefore = document.querySelector(".calendar-card").getBoundingClientRect().top;
    window.scrollTo(0, 500);
    home.scrollTop = 500;
    return {
      calBefore: Math.round(calBefore),
      calAfter: Math.round(document.querySelector(".calendar-card").getBoundingClientRect().top),
      windowScrollY: window.scrollY,
      homeScrollTop: home.scrollTop,
      // 文書全体・アプリ枠・TOP画面のどれもビューポートより背が高くない(±1pxは丸め)
      docExcess: doc.scrollHeight - window.innerHeight,
      appExcess: Math.round(app.getBoundingClientRect().height) - window.innerHeight,
      homeExcess: home.scrollHeight - home.clientHeight
    };
  });

  expect(state.windowScrollY).toBe(0);
  expect(state.homeScrollTop).toBe(0);
  expect(state.docExcess).toBeLessThanOrEqual(1);
  expect(state.appExcess).toBeLessThanOrEqual(1);
  expect(state.homeExcess).toBeLessThanOrEqual(1);
  expect(state.calAfter).toBe(state.calBefore);
});

test("1: カレンダー下の余白は広告用の隙間(50〜70px)+小マージンだけで過剰でない", async ({ page }) => {
  await bootApp(page);

  const layout = await page.evaluate(() => {
    const cal = document.querySelector(".calendar-card").getBoundingClientRect();
    const slot = document.querySelector("#homeAdSlot").getBoundingClientRect();
    const tabbar = document.querySelector(".tabbar").getBoundingClientRect();
    return {
      slotHeight: slot.height,
      // カレンダー下端〜メニュー上端の実際の隙間
      gap: tabbar.top - cal.bottom,
      slotBelowCalendar: slot.top >= cal.bottom - 1
    };
  });

  // 広告(320×50/アダプティブ相当)が収まる高さは確保しつつ、それ以上は詰まっている
  expect(layout.slotHeight).toBeGreaterThanOrEqual(50);
  expect(layout.slotHeight).toBeLessThanOrEqual(70);
  expect(layout.gap).toBeGreaterThanOrEqual(50);
  expect(layout.gap).toBeLessThanOrEqual(90);
  expect(layout.slotBelowCalendar).toBe(true);
});

test("2: 今月の運動の数字が1桁でも2桁でも円の中央に収まる", async ({ page }) => {
  await bootApp(page);

  for (const viewport of [{ width: 390, height: 844 }, { width: 375, height: 667 }]) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(150);
    for (const value of ["4", "31"]) {
    const metrics = await page.evaluate((v) => {
      document.querySelector("#monthlyVisits").textContent = v;
      const ring = document.querySelector("#monthlyGoalRing").getBoundingClientRect();
      const num = document.querySelector("#monthlyVisits").getBoundingClientRect();
      const unit = document.querySelector(".hero-ring-center small").getBoundingClientRect();
      const block = {
        left: Math.min(num.left, unit.left),
        right: Math.max(num.right, unit.right),
        top: Math.min(num.top, unit.top),
        bottom: Math.max(num.bottom, unit.bottom)
      };
      return {
        ringCx: ring.left + ring.width / 2,
        ringCy: ring.top + ring.height / 2,
        blockCx: (block.left + block.right) / 2,
        blockCy: (block.top + block.bottom) / 2,
        // 数字+「日」のまとまりが円(リング帯の内側)からはみ出していない
        fitsX: block.left >= ring.left + 6 && block.right <= ring.right - 6,
        fitsY: block.top >= ring.top + 6 && block.bottom <= ring.bottom - 6,
        numOverlapsUnit: num.right > unit.left + 1
      };
    }, value);

      // 上下・左右とも中央(±4px)
      expect(Math.abs(metrics.blockCx - metrics.ringCx)).toBeLessThanOrEqual(4);
      expect(Math.abs(metrics.blockCy - metrics.ringCy)).toBeLessThanOrEqual(4);
      expect(metrics.fitsX).toBe(true);
      expect(metrics.fitsY).toBe(true);
      // 数字と「日」が重ならない
      expect(metrics.numOverlapsUnit).toBe(false);
    }
  }
});

test("2: レイアウト変更後もTOP・ヒーローカードが崩れていない", async ({ page }) => {
  await bootApp(page);

  await expect(page.locator(".hero-card")).toBeVisible();
  await expect(page.locator(".calendar-card")).toBeVisible();
  await expect(page.locator(".tabbar")).toBeVisible();

  const layout = await page.evaluate(() => {
    const legend = document.querySelector(".calendar-card .legend").getBoundingClientRect();
    const grid = document.querySelector("#calendarGrid");
    const firstDay = grid.querySelector("[data-calendar-date]").getBoundingClientRect();
    return {
      dayCount: grid.querySelectorAll("[data-calendar-date]").length,
      legendInViewport: legend.bottom <= window.innerHeight && legend.height > 0,
      // 日付セルはタップターゲットを維持(縦に潰れていない)
      dayCellSquare: Math.abs(firstDay.width - firstDay.height) <= 1 && firstDay.height >= 40
    };
  });

  expect(layout.dayCount).toBeGreaterThanOrEqual(28);
  expect(layout.legendInViewport).toBe(true);
  expect(layout.dayCellSquare).toBe(true);
});
