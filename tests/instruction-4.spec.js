"use strict";

const { test, expect } = require("@playwright/test");

/*
 * 指示書④ リグレッションテスト。
 * - 1: 設定画面のAIテキスト出力ボタンがプロフィールボタンと同じ見た目(サイズ・色・角丸・影)
 * - 1: AIテキスト出力の機能自体は従来どおり動作する
 * - 2: TOPページのカレンダーが固定され、上にスライドしない
 * - 2: カレンダー〜メニュー間に広告用の隙間(バナー320×50相当以上)が確保され、背景に馴染む空白である
 * - レイアウト変更が他の画面要素を崩していない
 */

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

// UIを完全初期化した状態で起動する(初回プロフィールモーダルを閉じてプロフィール設定済みにする)
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

test("1: AIテキスト出力ボタンがプロフィールボタンと同じ見た目になっている", async ({ page }) => {
  await bootApp(page);
  await page.click("#homeSettingsButton");
  await expect(page.locator("#settingsScreen")).toHaveClass(/screen--active/);

  const styles = await page.evaluate(() => {
    const pick = (el) => {
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        backgroundColor: cs.backgroundColor,
        borderColor: cs.borderTopColor,
        borderRadius: cs.borderTopLeftRadius,
        boxShadow: cs.boxShadow,
        paddingTop: cs.paddingTop,
        paddingLeft: cs.paddingLeft,
        textAlign: cs.textAlign
      };
    };
    return {
      profile: pick(document.querySelector("#settingsProfileCard")),
      ai: pick(document.querySelector("#aiExportButton")),
      sameClass: document.querySelector("#aiExportButton").classList.contains("settings-profile-card"),
      hasChevron: !!document.querySelector("#aiExportButton .settings-profile-chevron")
    };
  });

  expect(styles.sameClass).toBe(true);
  expect(styles.hasChevron).toBe(true);
  expect(styles.ai.width).toBe(styles.profile.width);
  expect(styles.ai.backgroundColor).toBe(styles.profile.backgroundColor);
  expect(styles.ai.borderColor).toBe(styles.profile.borderColor);
  expect(styles.ai.borderRadius).toBe(styles.profile.borderRadius);
  expect(styles.ai.boxShadow).toBe(styles.profile.boxShadow);
  expect(styles.ai.paddingTop).toBe(styles.profile.paddingTop);
  expect(styles.ai.paddingLeft).toBe(styles.profile.paddingLeft);
  expect(styles.ai.textAlign).toBe(styles.profile.textAlign);
});

test("1: AIテキスト出力の機能は従来どおり動作する", async ({ page }) => {
  await bootApp(page);
  await page.click("#homeSettingsButton");
  // 画面がきちんと切り替わっている(ホームが残って設定が画面外に押し出されていない)
  await expect(page.locator("#homeScreen")).toBeHidden();
  const settingsTop = await page.evaluate(() => document.querySelector("#settingsScreen").getBoundingClientRect().top);
  expect(settingsTop).toBeLessThan(100);
  await page.click("#aiExportButton");
  await expect(page.locator("#aiExportModal")).toHaveClass(/is-open/);
});

test("2: TOPページのカレンダーは固定され、上にスライドしない", async ({ page }) => {
  await bootApp(page);
  await expect(page.locator("#homeScreen")).toHaveClass(/screen--active/);

  const before = await page.evaluate(() => {
    const cal = document.querySelector(".calendar-card").getBoundingClientRect();
    return { calTop: Math.round(cal.top) };
  });

  // ページ/ホーム画面をスクロールしようとしても動かない
  const after = await page.evaluate(() => {
    window.scrollTo(0, 500);
    const home = document.querySelector("#homeScreen");
    home.scrollTop = 500;
    const cal = document.querySelector(".calendar-card").getBoundingClientRect();
    return {
      calTop: Math.round(cal.top),
      windowScrollY: window.scrollY,
      homeScrollTop: home.scrollTop,
      homeOverflowY: getComputedStyle(home).overflowY,
      // ホーム画面自体にスクロール可能な余剰がない(±1pxは丸め誤差)
      scrollableExcess: home.scrollHeight - home.clientHeight
    };
  });

  expect(after.windowScrollY).toBe(0);
  expect(after.homeScrollTop).toBe(0);
  expect(after.homeOverflowY).toBe("hidden");
  expect(after.scrollableExcess).toBeLessThanOrEqual(1);
  expect(after.calTop).toBe(before.calTop);
});

test("2: カレンダー〜メニュー間に広告用の隙間が確保され、背景に馴染む空白になっている", async ({ page }) => {
  await bootApp(page);

  const layout = await page.evaluate(() => {
    const slot = document.querySelector("#homeAdSlot");
    const cal = document.querySelector(".calendar-card").getBoundingClientRect();
    const tabbar = document.querySelector(".tabbar").getBoundingClientRect();
    const rect = slot.getBoundingClientRect();
    const cs = getComputedStyle(slot);
    return {
      height: rect.height,
      belowCalendar: rect.top >= cal.bottom - 1,
      aboveTabbar: rect.bottom <= tabbar.top + 1,
      backgroundColor: cs.backgroundColor,
      isEmpty: slot.childElementCount === 0 && slot.textContent.trim() === ""
    };
  });

  // 標準的なバナー広告(320×50/アダプティブ相当)が収まる高さ
  expect(layout.height).toBeGreaterThanOrEqual(50);
  expect(layout.belowCalendar).toBe(true);
  expect(layout.aboveTabbar).toBe(true);
  // 背景と自然に馴染む(透明=画面背景そのまま)ので「表示バグの空白」に見えない
  expect(layout.backgroundColor).toBe("rgba(0, 0, 0, 0)");
  expect(layout.isEmpty).toBe(true);
});

test("2: レイアウト変更後もTOPの主要要素が崩れていない", async ({ page }) => {
  await bootApp(page);

  await expect(page.locator(".hero-card")).toBeVisible();
  await expect(page.locator(".calendar-card")).toBeVisible();
  await expect(page.locator(".tabbar")).toBeVisible();

  const layout = await page.evaluate(() => {
    const grid = document.querySelector("#calendarGrid");
    const legend = document.querySelector(".calendar-card .legend").getBoundingClientRect();
    const slot = document.querySelector("#homeAdSlot").getBoundingClientRect();
    const hero = document.querySelector(".hero-card").getBoundingClientRect();
    return {
      dayCount: grid.querySelectorAll("[data-calendar-date]").length,
      legendVisibleInViewport: legend.bottom <= window.innerHeight && legend.height > 0,
      heroNotSquashed: hero.height >= 60,
      slotWidth: slot.width
    };
  });

  expect(layout.dayCount).toBeGreaterThanOrEqual(28);
  expect(layout.legendVisibleInViewport).toBe(true);
  expect(layout.heroNotSquashed).toBe(true);
  expect(layout.slotWidth).toBeGreaterThan(320);
});
