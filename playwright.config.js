"use strict";

const { defineConfig, devices } = require("@playwright/test");

// 実オリジン上でlocalStorage/Preferences挙動を検証するため、依存ゼロの静的サーバを起動する。
const PORT = 4173;

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: "line",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "off",
    // この環境ではブラウザが /opt/pw-browsers に事前インストールされているため明示指定する。
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH || require("fs").existsSync("/opt/pw-browsers/chromium")
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium" }
      : {}
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } }
  ],
  webServer: {
    command: "node scripts/serve.js",
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 20000
  }
});
