/* うちのこ日誌 E2E テスト
   ジムログと同じ「Playwright + ローカルHTTPサーバー」方式。
   実行: node tests/e2e.mjs   （既定 390x844 / ライト）
   環境: グローバル playwright を利用。ブラウザは PLAYWRIGHT_BROWSERS_PATH から自動解決。 */
import { createRequire } from "module";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const require = createRequire("/opt/node22/lib/node_modules/");
const { chromium } = require("playwright");

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };

function findChromium() {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    const dir = fs.readdirSync(base).find((d) => /^chromium-\d+$/.test(d));
    if (dir) return path.join(base, dir, "chrome-linux", "chrome");
  } catch (e) { /* fall through */ }
  return undefined; // playwright default
}

function startServer() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p === "/") p = "/index.html";
    const fp = path.join(ROOT, p);
    if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(fp, (err, buf) => {
      if (err) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "content-type": MIME[path.extname(fp)] || "text/plain" });
      res.end(buf);
    });
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

/* ==== 極小テストハーネス ==== */
let passed = 0, failed = 0;
const failures = [];
function assert(cond, message) {
  if (cond) { passed += 1; }
  else { failed += 1; failures.push(message); console.log("  ✗ " + message); }
}
function eq(actual, expected, message) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message + " (期待:" + JSON.stringify(expected) + " / 実際:" + JSON.stringify(actual) + ")");
}
async function testCase(name, fn) {
  console.log("• " + name);
  try { await fn(); } catch (e) { failed += 1; failures.push(name + ": " + e.message); console.log("  ✗ 例外: " + e.message); }
}

async function freshPage(context) {
  const page = await context.newPage();
  await page.addInitScript(() => { window.__PETLOG_TEST_MODE = true; });
  return page;
}

async function main() {
  const server = await startServer();
  const port = server.address().port;
  const url = `http://localhost:${port}/index.html`;
  const browser = await chromium.launch({ executablePath: findChromium() });

  async function newApp(viewport = { width: 390, height: 844 }, appearance) {
    const context = await browser.newContext({ viewport });
    // 外部フォント等（オフライン環境ではCONNECTION_RESET）を遮断してロードを速く安定させる
    await context.route(/^https?:\/\/(?!localhost)/, (route) => route.abort());
    const page = await freshPage(context);
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => !!window.__test);
    await page.evaluate(() => window.__test.reset());
    return { context, page };
  }

  // ---- タスク1: データ層 ----
  await testCase("初回起動でversion:1のデータが生成される", async () => {
    const { context, page } = await newApp();
    const version = await page.evaluate(() => window.__test.getData().version);
    eq(version, 1, "version が 1");
    await context.close();
  });

  await testCase("オンボーディングが初回に表示され、登録でホームへ", async () => {
    const { context, page } = await newApp();
    assert(await page.isVisible("#onboardingModal.is-open"), "オンボーディング表示");
    await page.fill("#petNameInput", "ぽち");
    await page.click("#onboardingSubmit");
    assert(!(await page.isVisible("#onboardingModal.is-open")), "登録後は閉じる");
    eq(await page.textContent("#petSwitcherName"), "ぽち", "ホームに名前表示");
    await context.close();
  });

  await testCase("不正データ投入時に検疫され、アプリが起動する", async () => {
    const { context, page } = await newApp();
    await page.evaluate(() => localStorage.setItem("petlog-data-v1", "{ this is : not json"));
    await page.reload();
    await page.waitForFunction(() => !!window.__test);
    const bootedPets = await page.evaluate(() => window.__test.getData().pets.length);
    eq(bootedPets, 0, "検疫後は空データで起動");
    const quarantined = await page.evaluate(() => Object.keys(localStorage).some((k) => k.indexOf("petlog-data-v1-corrupt-") === 0));
    assert(quarantined, "破損データが検疫キーに退避される");
    await context.close();
  });

  await testCase("バックアップ→全削除→復元で元に戻る", async () => {
    const { context, page } = await newApp();
    const petId = await page.evaluate(() => window.__test.addPet({ name: "ぽち", species: "dog" }));
    await page.evaluate((id) => window.__test.addWeight(id, window.__test.today(), 5.2), petId);
    const before = await page.evaluate(() => JSON.stringify(window.__test.getData()));
    await page.evaluate(() => window.__test.reset());
    eq(await page.evaluate(() => window.__test.getData().pets.length), 0, "全削除で空");
    await page.evaluate((snap) => window.__test.setData(JSON.parse(snap)), before);
    const after = await page.evaluate(() => window.__test.getData());
    eq(after.pets.length, 1, "復元でペット戻る");
    eq(after.weights.length, 1, "復元で体重戻る");
    await context.close();
  });

  // ---- タスク2: ペット ----
  await testCase("2匹目登録・切り替えで記録が混ざらない", async () => {
    const { context, page } = await newApp();
    const a = await page.evaluate(() => window.__test.addPet({ name: "ぽち", species: "dog" }));
    const b = await page.evaluate(() => window.__test.addPet({ name: "たま", species: "cat" }));
    await page.evaluate((id) => window.__test.setActivePet(id), a);
    await page.evaluate(() => window.__test.tapChecklist("meal", "all"));
    await page.evaluate((id) => window.__test.setActivePet(id), b);
    const bLog = await page.evaluate(() => window.__test.getTodayLog());
    eq(bLog, null, "別ペットには記録が付かない");
    await page.evaluate((id) => window.__test.setActivePet(id), a);
    const aLog = await page.evaluate(() => window.__test.getTodayLog());
    eq(aLog.meal, "all", "元ペットの記録は保持");
    await context.close();
  });

  await testCase("ペット削除で関連する全記録も削除される", async () => {
    const { context, page } = await newApp();
    const a = await page.evaluate(() => window.__test.addPet({ name: "ぽち", species: "dog" }));
    await page.evaluate((id) => window.__test.addWeight(id, window.__test.today(), 5.0), a);
    await page.evaluate(() => window.__test.tapChecklist("meal", "all"));
    await page.evaluate(() => window.__test.switchTab("settings"));
    // 削除→確認ダイアログ→承認
    await page.click("#settingsPetList .settings-item-action.danger");
    assert(await page.isVisible("#confirmModal.is-open"), "確認ダイアログ表示");
    await page.click("#confirmAccept");
    const d = await page.evaluate(() => window.__test.getData());
    eq([d.pets.length, d.weights.length, d.dailyLogs.length], [0, 0, 0], "全記録が削除される");
    await context.close();
  });

  // ---- タスク3: ホーム ----
  await testCase("今日もぜんぶ順調1タップで記録され、Undoで戻る", async () => {
    const { context, page } = await newApp();
    const a = await page.evaluate(() => window.__test.addPet({ name: "ぽち", species: "dog" }));
    await page.evaluate((id) => window.__test.addMed(id, { name: "心臓の薬" }), a);
    await page.click("#allGoodButton");
    let log = await page.evaluate(() => window.__test.getTodayLog());
    eq(log.meal, "all", "ごはん完食");
    eq(log.stool, "normal", "うんち普通");
    eq(Object.keys(log.medChecks).length, 1, "有効な薬がチェックされる");
    assert(await page.isVisible("#undoSnackbar:not(.hidden)"), "Undoスナックバー表示");
    await page.click("#undoSnackbarButton");
    log = await page.evaluate(() => window.__test.getTodayLog());
    eq(log, null, "Undoで全部戻る");
    await context.close();
  });

  await testCase("個別3択タップで即保存・リロード後も保持・上書きできる", async () => {
    const { context, page } = await newApp();
    await page.evaluate(() => window.__test.addPet({ name: "ぽち", species: "dog" }));
    // 「残した」を選ぶ（ごはんブロックの2番目）
    await page.click('#todayChecklist .check-block:nth-child(1) .choice-btn[data-choice="partial"]');
    eq(await page.evaluate(() => window.__test.getTodayLog().meal), "partial", "partial 保存");
    await page.reload();
    await page.waitForFunction(() => !!window.__test);
    eq(await page.evaluate(() => window.__test.getTodayLog().meal), "partial", "リロード後も保持");
    // 完食へ上書き
    await page.click('#todayChecklist .check-block:nth-child(1) .choice-btn[data-choice="all"]');
    eq(await page.evaluate(() => window.__test.getTodayLog().meal), "all", "上書きされる");
    await context.close();
  });

  await testCase("薬が未登録なら薬欄が表示されない", async () => {
    const { context, page } = await newApp();
    await page.evaluate(() => window.__test.addPet({ name: "ぽち", species: "dog" }));
    const hasMed = await page.evaluate(() => !!document.querySelector("[data-med-check]"));
    assert(!hasMed, "薬欄なし");
    await context.close();
  });

  await testCase("記録日数リングとミニカレンダー塗りが記録と一致", async () => {
    const { context, page } = await newApp();
    await page.evaluate(() => { window.__test.addPet({ name: "ぽち", species: "dog" }); window.__test.setToday("2026-03-15"); });
    await page.evaluate(() => window.__test.tapChecklist("meal", "all"));
    eq(await page.textContent("#monthRingCount"), "1", "リングの日数=1");
    const loggedCells = await page.evaluate(() => document.querySelectorAll("#miniCalGrid .mini-cal-cell.is-logged").length);
    eq(loggedCells, 1, "塗られたセル=1");
    await context.close();
  });

  // ---- タスク4: 過去日 ----
  await testCase("過去日タップで編集でき、未来日は開けない", async () => {
    const { context, page } = await newApp();
    await page.evaluate(() => { window.__test.addPet({ name: "ぽち", species: "dog" }); window.__test.setToday("2026-03-15"); });
    await page.evaluate(() => window.__test.openDay("2026-03-10"));
    assert(await page.isVisible("#dayModal.is-open"), "過去日モーダルが開く");
    await page.click('#dayChecklist .check-block:nth-child(2) .choice-btn[data-choice="none"]');
    eq(await page.evaluate(() => window.__test.getLog(window.__test.getActivePet().id, "2026-03-10").stool), "none", "過去日に記録される");
    await page.click('#dayModal button[data-close="dayModal"]');
    // 未来日
    await page.evaluate(() => window.__test.openDay("2026-03-20"));
    assert(!(await page.isVisible("#dayModal.is-open")), "未来日は開かない");
    await context.close();
  });

  // ---- タスク5: 体重 ----
  await testCase("体重: 前回値プリフィル・ステッパー・同日上書き確認", async () => {
    const { context, page } = await newApp();
    const a = await page.evaluate(() => window.__test.addPet({ name: "ぽち", species: "dog" }));
    await page.evaluate((id) => window.__test.addWeight(id, "2026-03-01", 5.0), a);
    await page.evaluate(() => window.__test.setToday("2026-03-10"));
    await page.click("#fabWeight");
    eq(await page.textContent("#weightValue"), "5.0", "前回値プリフィル");
    await page.click("#weightPlusSmall"); // 5.1
    await page.click("#weightPlusBig");   // 6.1
    eq(await page.textContent("#weightValue"), "6.1", "単押しステップ");
    await page.click("#weightMinusBig"); await page.click("#weightMinusBig"); // 4.1
    eq(await page.textContent("#weightValue"), "4.1", "減算・0未満不可の範囲内");
    await page.fill("#weightDate", "2026-03-01"); // 既存日
    await page.click("#weightSubmit");
    assert(await page.isVisible("#confirmModal.is-open"), "同日2回目は上書き確認");
    await page.click("#confirmAccept");
    eq(await page.evaluate(() => window.__test.getData().weights.filter((w) => w.date === "2026-03-01").length), 1, "同日は1件（上書き）");
    await context.close();
  });

  await testCase("グラフ: 0件・1件でも崩れず、期間切替が動く", async () => {
    const { context, page } = await newApp();
    const a = await page.evaluate(() => window.__test.addPet({ name: "ぽち", species: "dog" }));
    await page.evaluate(() => window.__test.switchTab("graph"));
    assert(await page.isVisible("#weightChartEmpty:not(.hidden)"), "0件は空表示");
    await page.evaluate((id) => window.__test.addWeight(id, window.__test.today(), 5.0), a);
    await page.evaluate(() => window.__test.switchTab("graph"));
    assert(await page.isVisible("#weightChart svg"), "1件でもSVG描画");
    await page.click('#weightRangeTabs .range-tab[data-range="1y"]');
    assert(await page.isVisible("#weightChart svg"), "期間切替後も描画");
    await context.close();
  });

  // ---- タスク6: お薬 ----
  await testCase("薬の無効化: 今日から消えるが過去記録・レポートには残る", async () => {
    const { context, page } = await newApp();
    const a = await page.evaluate(() => window.__test.addPet({ name: "ぽち", species: "dog" }));
    await page.evaluate(() => window.__test.setToday("2026-03-15"));
    const med = await page.evaluate((id) => window.__test.addMed(id, { name: "痛み止め" }), a);
    await page.evaluate(() => window.__test.tapAllGood()); // 薬チェック含む
    // 無効化
    await page.evaluate(() => window.__test.switchTab("settings"));
    const buttons = await page.$$("#settingsMedList .settings-item-action");
    await buttons[1].click(); // 無効化
    await page.evaluate(() => window.__test.switchTab("home"));
    const shownToday = await page.evaluate(() => !!document.querySelector("[data-med-check]"));
    assert(!shownToday, "無効化後は今日のリストから消える");
    const stillLogged = await page.evaluate((id) => window.__test.getLog(window.__test.getActivePet().id, "2026-03-15").medChecks[id], med);
    assert(stillLogged === true, "過去記録には残る");
    await context.close();
  });

  await testCase("薬名変更が過去記録の表示に反映（medId参照）", async () => {
    const { context, page } = await newApp();
    const a = await page.evaluate(() => window.__test.addPet({ name: "ぽち", species: "dog" }));
    const med = await page.evaluate((id) => window.__test.addMed(id, { name: "旧名" }), a);
    await page.evaluate(() => window.__test.switchTab("settings"));
    await page.click("#settingsMedList .settings-item-action"); // 編集
    await page.fill("#medNameInput", "新名");
    await page.click("#medSubmit");
    const name = await page.evaluate((id) => window.__test.getData().meds.find((m) => m.id === id).name, med);
    eq(name, "新名", "medId参照なので名前変更が反映");
    await context.close();
  });

  // ---- タスク7: 異変アラート ----
  await testCase("ルール1: ごはん2日連続の食べ残しで発火・解消", async () => {
    const { context, page } = await newApp();
    const a = await page.evaluate(() => window.__test.addPet({ name: "ぽち", species: "dog" }));
    await page.evaluate((id) => { window.__test.setToday("2026-03-16");
      window.__test.openDay("2026-03-15"); }, a);
    // 2日連続で partial を注入
    await page.evaluate((id) => {
      const d = window.__test.getData();
      d.dailyLogs.push({ id: "l1", petId: id, date: "2026-03-15", meal: "partial", stool: null, medChecks: {}, memo: "" });
      d.dailyLogs.push({ id: "l2", petId: id, date: "2026-03-16", meal: "partial", stool: null, medChecks: {}, memo: "" });
      window.__test.setData(d);
    }, a);
    let alerts = await page.evaluate(() => window.__test.getAlerts().map((x) => x.type));
    assert(alerts.indexOf("meal") >= 0, "食べ残しアラート発火");
    // 解消: 最新日を完食に
    await page.evaluate((id) => {
      const d = window.__test.getData();
      d.dailyLogs.find((l) => l.date === "2026-03-16").meal = "all";
      window.__test.setData(d);
    }, a);
    alerts = await page.evaluate(() => window.__test.getAlerts().map((x) => x.type));
    assert(alerts.indexOf("meal") < 0, "完食記録で解消");
    await context.close();
  });

  await testCase("ルール2: うんち2日連続なしで発火 / 未記録は連続に数えない", async () => {
    const { context, page } = await newApp();
    const a = await page.evaluate(() => window.__test.addPet({ name: "ぽち", species: "dog" }));
    // 連続でない2件（間に未記録日）→ 発火しない
    await page.evaluate((id) => {
      const d = window.__test.getData();
      window.__test.setToday("2026-03-20");
      d.dailyLogs.push({ id: "s1", petId: id, date: "2026-03-18", meal: null, stool: "none", medChecks: {}, memo: "" });
      d.dailyLogs.push({ id: "s2", petId: id, date: "2026-03-20", meal: null, stool: "none", medChecks: {}, memo: "" });
      window.__test.setData(d);
    }, a);
    let alerts = await page.evaluate(() => window.__test.getAlerts().map((x) => x.type));
    assert(alerts.indexOf("stool") < 0, "連続していなければ発火しない（未記録≠異常）");
    // 連続2日 → 発火
    await page.evaluate((id) => {
      const d = window.__test.getData();
      d.dailyLogs.push({ id: "s3", petId: id, date: "2026-03-19", meal: null, stool: "none", medChecks: {}, memo: "" });
      window.__test.setData(d);
    }, a);
    alerts = await page.evaluate(() => window.__test.getAlerts());
    const stool = alerts.find((x) => x.type === "stool");
    assert(!!stool, "連続2日で発火");
    assert(stool && !/病|診断|症|疑い|重[症篤]/.test(stool.text), "指摘文に診断的表現がない");
    const cardText = await page.textContent("#alertArea");
    assert(/獣医師にご相談ください/.test(cardText), "受診案内が画面に表示される");
    await context.close();
  });

  await testCase("ルール3: 体重-5%以上減で発火", async () => {
    const { context, page } = await newApp();
    const a = await page.evaluate(() => window.__test.addPet({ name: "ぽち", species: "dog" }));
    await page.evaluate((id) => { window.__test.addWeight(id, "2026-03-01", 5.0); window.__test.addWeight(id, "2026-03-10", 4.7); }, a);
    const alerts = await page.evaluate(() => window.__test.getAlerts());
    const w = alerts.find((x) => x.type === "weight");
    assert(!!w, "体重減アラート発火（-6%）");
    // -4% は発火しない
    await page.evaluate((id) => { const d = window.__test.getData(); d.weights.find((x) => x.date === "2026-03-10").kg = 4.85; window.__test.setData(d); }, a);
    const alerts2 = await page.evaluate(() => window.__test.getAlerts().map((x) => x.type));
    assert(alerts2.indexOf("weight") < 0, "-3%では発火しない");
    await context.close();
  });

  // ---- タスク8: レポート ----
  await testCase("レポート: 直近14日が表で見え、記録なしは「-」", async () => {
    const { context, page } = await newApp();
    const a = await page.evaluate(() => window.__test.addPet({ name: "ぽち", species: "dog" }));
    await page.evaluate((id) => { window.__test.setToday("2026-03-20"); window.__test.addWeight(id, "2026-03-19", 5.0); }, a);
    await page.evaluate(() => window.__test.tapChecklist("meal", "all"));
    await page.evaluate(() => window.__test.switchTab("report"));
    const rows = await page.evaluate(() => document.querySelectorAll("#reportBody .report-table tbody tr").length);
    eq(rows, 14, "14行");
    assert(await page.isVisible("#reportBody .report-mini-chart svg"), "体重ミニグラフ表示");
    const dashCount = await page.evaluate(() => Array.from(document.querySelectorAll("#reportBody .rt-none")).length);
    assert(dashCount > 0, "記録なしの日は「-」");
    await context.close();
  });

  // ---- タスク0/9: テーマ・レイアウト ----
  await testCase("ダーク切替が効く", async () => {
    const { context, page } = await newApp();
    await page.evaluate(() => window.__test.addPet({ name: "ぽち", species: "dog" }));
    await page.evaluate(() => window.__test.switchTab("settings"));
    await page.selectOption("#appearanceSelect", "dark");
    eq(await page.getAttribute("html", "data-appearance"), "dark", "dark 適用");
    await page.selectOption("#appearanceSelect", "light");
    eq(await page.getAttribute("html", "data-appearance"), "light", "light 適用");
    await context.close();
  });

  await testCase("横スクロールが出ない（390x844）", async () => {
    const { context, page } = await newApp();
    await page.evaluate(() => window.__test.addPet({ name: "ぽちながいなまえのこ", species: "dog" }));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert(!overflow, "body横スクロールなし");
    await context.close();
  });

  await browser.close();
  server.close();

  console.log("\n==== 結果 ====");
  console.log("PASS: " + passed + " / FAIL: " + failed);
  if (failed) { console.log("\n失敗:"); failures.forEach((f) => console.log(" - " + f)); process.exit(1); }
  else console.log("すべてグリーン ✓");
}

main().catch((e) => { console.error(e); process.exit(1); });
