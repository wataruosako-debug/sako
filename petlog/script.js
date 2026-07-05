/* うちのこ日誌 — シニアペット見守り記録アプリ MVP
   技術方針: ビルド無し / 単一IIFE / ES5スタイル / localStorage保存 / サーバー送信なし
   データ層（version付き・正規化・破損検疫・バックアップ）はジムログのパターンを流用。 */
(function () {
  "use strict";

  var STORAGE_KEY = "petlog-data-v1";
  var UI_KEY = "petlog-ui-settings-v1";
  var CURRENT_DATA_VERSION = 1;

  var HOLD_REPEAT_DELAY_MS = 380;
  var HOLD_REPEAT_START_INTERVAL_MS = 180;
  var HOLD_REPEAT_MIN_INTERVAL_MS = 60;
  var HOLD_REPEAT_ACCELERATION_MS = 12;

  var SPECIES = ["dog", "cat", "other"];
  var SPECIES_LABEL = { dog: "犬", cat: "猫", other: "その他" };
  var MEAL_CHOICES = [
    { value: "all", label: "完食", tone: "ok" },
    { value: "partial", label: "残した", tone: "warn" },
    { value: "none", label: "食べない", tone: "warn" }
  ];
  var STOOL_CHOICES = [
    { value: "normal", label: "普通", tone: "ok" },
    { value: "loose", label: "ゆるい", tone: "warn" },
    { value: "none", label: "出ていない", tone: "warn" }
  ];
  var WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
  var VET_ADVICE = "気になる場合はかかりつけの獣医師にご相談ください。";

  /* ===== DOM / 汎用ヘルパー ===== */
  function $(selector) { return document.querySelector(selector); }
  function $$(selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); }
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function clearNode(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }
  function cloneData(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }
  var idCounter = 0;
  function uid(prefix) {
    idCounter += 1;
    return prefix + "_" + Date.now().toString(36) + "_" + idCounter.toString(36);
  }
  function nowIso() { return new Date().toISOString(); }

  /* ===== 日付ヘルパー（テストで「今日」を注入できる作り） ===== */
  var injectedToday = null;
  function todayString() {
    if (injectedToday) return injectedToday;
    var date = new Date();
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }
  function pad2(value) { return String(value).length < 2 ? "0" + value : String(value); }
  function dateFromString(value) {
    var parts = String(value).split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  function dateToString(date) {
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }
  function addDays(value, delta) {
    var date = dateFromString(value);
    date.setDate(date.getDate() + delta);
    return dateToString(date);
  }
  function diffDays(a, b) {
    return Math.round((dateFromString(a).getTime() - dateFromString(b).getTime()) / 86400000);
  }
  function formatDateJa(value) {
    var date = dateFromString(value);
    return (date.getMonth() + 1) + "月" + date.getDate() + "日（" + WEEKDAYS[date.getDay()] + "）";
  }

  /* ===== データ層: 生成・正規化・検疫・永続化 ===== */
  var dataMigrationChanged = false;
  var dataLoadWarning = "";
  var dataRecoveryRequired = false;

  function blankData() {
    return {
      version: CURRENT_DATA_VERSION,
      activePetId: null,
      pets: [],
      dailyLogs: [],
      weights: [],
      meds: [],
      uiSettings: { theme: "terracotta" }
    };
  }

  function isPlausibleDataRoot(candidate) {
    return candidate && typeof candidate === "object" &&
      Array.isArray(candidate.pets) && Array.isArray(candidate.dailyLogs) &&
      Array.isArray(candidate.weights) && Array.isArray(candidate.meds);
  }

  // 破損データや将来バージョンの取りこぼしを最小化: 型を検査して整えた要素だけ残す
  function normalizeData(source) {
    var safe = blankData();
    if (!source || typeof source !== "object") return safe;

    var pets = [];
    (Array.isArray(source.pets) ? source.pets : []).forEach(function (pet) {
      if (!pet || typeof pet !== "object" || !pet.id || typeof pet.name !== "string" || !pet.name) return;
      pets.push({
        id: String(pet.id),
        name: String(pet.name).slice(0, 40),
        species: SPECIES.indexOf(pet.species) >= 0 ? pet.species : "other",
        birthMonth: typeof pet.birthMonth === "string" && /^\d{4}-\d{2}$/.test(pet.birthMonth) ? pet.birthMonth : null,
        createdAt: pet.createdAt || nowIso(),
        updatedAt: pet.updatedAt || nowIso()
      });
    });
    var petIds = {};
    pets.forEach(function (pet) { petIds[pet.id] = true; });
    safe.pets = pets;

    var meds = [];
    (Array.isArray(source.meds) ? source.meds : []).forEach(function (med) {
      if (!med || typeof med !== "object" || !med.id || !petIds[med.petId] || typeof med.name !== "string" || !med.name) return;
      meds.push({
        id: String(med.id), petId: String(med.petId),
        name: String(med.name).slice(0, 40),
        note: typeof med.note === "string" ? med.note.slice(0, 120) : "",
        isActive: med.isActive !== false,
        createdAt: med.createdAt || nowIso(), updatedAt: med.updatedAt || nowIso()
      });
    });
    safe.meds = meds;

    var logs = [];
    var logSeen = {};
    (Array.isArray(source.dailyLogs) ? source.dailyLogs : []).forEach(function (log) {
      if (!log || typeof log !== "object" || !petIds[log.petId]) return;
      if (typeof log.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(log.date)) return;
      var key = log.petId + "|" + log.date;
      if (logSeen[key]) return; // ペット×日付で1件（upsert）
      logSeen[key] = true;
      var medChecks = {};
      if (log.medChecks && typeof log.medChecks === "object") {
        Object.keys(log.medChecks).forEach(function (medId) { if (log.medChecks[medId] === true) medChecks[medId] = true; });
      }
      logs.push({
        id: log.id || uid("log"), petId: String(log.petId), date: log.date,
        meal: ["all", "partial", "none"].indexOf(log.meal) >= 0 ? log.meal : null,
        stool: ["normal", "loose", "none"].indexOf(log.stool) >= 0 ? log.stool : null,
        medChecks: medChecks,
        memo: typeof log.memo === "string" ? log.memo.slice(0, 500) : "",
        updatedAt: log.updatedAt || nowIso()
      });
    });
    safe.dailyLogs = logs;

    var weights = [];
    (Array.isArray(source.weights) ? source.weights : []).forEach(function (weight) {
      if (!weight || typeof weight !== "object" || !petIds[weight.petId]) return;
      if (typeof weight.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(weight.date)) return;
      var kg = Number(weight.kg);
      if (!isFinite(kg) || kg <= 0) return;
      weights.push({
        id: weight.id || uid("wt"), petId: String(weight.petId), date: weight.date,
        kg: Math.round(kg * 10) / 10,
        memo: typeof weight.memo === "string" ? weight.memo.slice(0, 120) : "",
        createdAt: weight.createdAt || nowIso()
      });
    });
    safe.weights = weights;

    var activePetId = source.activePetId && petIds[source.activePetId] ? String(source.activePetId) : (pets[0] ? pets[0].id : null);
    safe.activePetId = activePetId;
    if (source.uiSettings && typeof source.uiSettings === "object") {
      safe.uiSettings = { theme: "terracotta" };
    }
    return safe;
  }

  function migrateToCurrentVersion(parsed) {
    // v1が最新。将来のバージョン増加時はここで段階的に変換する。
    var working = parsed;
    var version = Number(working.version || 1);
    if (version > CURRENT_DATA_VERSION) throw new Error("Unsupported future version");
    return normalizeData(working);
  }

  function quarantineCorruptData(raw) {
    try {
      var key = STORAGE_KEY + "-corrupt-" + Date.now().toString(36);
      localStorage.setItem(key, raw);
    } catch (error) { /* 容量超過などは黙って諦める */ }
  }

  function loadData() {
    var saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return blankData();
      var parsed = JSON.parse(saved);
      if (!isPlausibleDataRoot(parsed)) throw new Error("Invalid root data");
      var originalVersion = Number(parsed.version || 1);
      var migrated = migrateToCurrentVersion(parsed);
      if (!isPlausibleDataRoot(migrated)) throw new Error("Invalid migrated data");
      if (originalVersion !== CURRENT_DATA_VERSION) dataMigrationChanged = true;
      return migrated;
    } catch (error) {
      console.error("Failed to load saved data", error);
      if (saved) { quarantineCorruptData(saved); dataRecoveryRequired = true; }
      dataLoadWarning = "保存データを正常に読み込めませんでした";
      return blankData();
    }
  }

  var data = loadData();

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
    catch (error) { console.error("Failed to persist data", error); showToast("保存に失敗しました"); }
  }

  /* ===== ペット ===== */
  function activePet() {
    if (!data.activePetId) return null;
    return findById(data.pets, data.activePetId);
  }
  function findById(list, id) {
    for (var i = 0; i < list.length; i += 1) { if (list[i].id === id) return list[i]; }
    return null;
  }
  function ageLabel(pet) {
    if (!pet || !pet.birthMonth) return "";
    var parts = pet.birthMonth.split("-").map(Number);
    var today = dateFromString(todayString());
    var months = (today.getFullYear() - parts[0]) * 12 + (today.getMonth() + 1 - parts[1]);
    if (months < 0) return "";
    if (months < 12) return months + "ヶ月";
    return Math.floor(months / 12) + "歳";
  }
  function addPet(fields) {
    var pet = {
      id: uid("pet"), name: fields.name.slice(0, 40),
      species: SPECIES.indexOf(fields.species) >= 0 ? fields.species : "other",
      birthMonth: fields.birthMonth || null, createdAt: nowIso(), updatedAt: nowIso()
    };
    data.pets.push(pet);
    if (!data.activePetId) data.activePetId = pet.id;
    persist();
    return pet;
  }
  function updatePet(id, fields) {
    var pet = findById(data.pets, id);
    if (!pet) return;
    pet.name = fields.name.slice(0, 40);
    pet.species = SPECIES.indexOf(fields.species) >= 0 ? fields.species : "other";
    pet.birthMonth = fields.birthMonth || null;
    pet.updatedAt = nowIso();
    persist();
  }
  function deletePet(id) {
    data.pets = data.pets.filter(function (pet) { return pet.id !== id; });
    data.dailyLogs = data.dailyLogs.filter(function (log) { return log.petId !== id; });
    data.weights = data.weights.filter(function (weight) { return weight.petId !== id; });
    data.meds = data.meds.filter(function (med) { return med.petId !== id; });
    if (data.activePetId === id) data.activePetId = data.pets[0] ? data.pets[0].id : null;
    persist();
  }

  /* ===== お薬 ===== */
  function medsForPet(petId, activeOnly) {
    return data.meds.filter(function (med) {
      return med.petId === petId && (!activeOnly || med.isActive);
    });
  }
  function addMed(petId, fields) {
    var med = {
      id: uid("med"), petId: petId, name: fields.name.slice(0, 40),
      note: (fields.note || "").slice(0, 120), isActive: true,
      createdAt: nowIso(), updatedAt: nowIso()
    };
    data.meds.push(med);
    persist();
    return med;
  }
  function updateMed(id, fields) {
    var med = findById(data.meds, id);
    if (!med) return;
    if (fields.name != null) med.name = fields.name.slice(0, 40);
    if (fields.note != null) med.note = fields.note.slice(0, 120);
    if (fields.isActive != null) med.isActive = !!fields.isActive;
    med.updatedAt = nowIso();
    persist();
  }

  /* ===== 日別ログ ===== */
  function getLog(petId, date) {
    for (var i = 0; i < data.dailyLogs.length; i += 1) {
      if (data.dailyLogs[i].petId === petId && data.dailyLogs[i].date === date) return data.dailyLogs[i];
    }
    return null;
  }
  function ensureLog(petId, date) {
    var log = getLog(petId, date);
    if (log) return log;
    log = { id: uid("log"), petId: petId, date: date, meal: null, stool: null, medChecks: {}, memo: "", updatedAt: nowIso() };
    data.dailyLogs.push(log);
    return log;
  }
  function logHasContent(log) {
    if (!log) return false;
    if (log.meal || log.stool) return true;
    if (log.memo) return true;
    return Object.keys(log.medChecks || {}).some(function (medId) { return log.medChecks[medId] === true; });
  }
  function pruneEmptyLog(log) {
    if (logHasContent(log)) return;
    data.dailyLogs = data.dailyLogs.filter(function (item) { return item.id !== log.id; });
  }
  function setLogField(petId, date, field, value) {
    var log = ensureLog(petId, date);
    log[field] = value;
    log.updatedAt = nowIso();
    pruneEmptyLog(log);
    persist();
  }
  function toggleMedCheck(petId, date, medId) {
    var log = ensureLog(petId, date);
    if (log.medChecks[medId]) delete log.medChecks[medId];
    else log.medChecks[medId] = true;
    log.updatedAt = nowIso();
    pruneEmptyLog(log);
    persist();
  }
  // 「今日もぜんぶ順調」: ごはん完食 / うんち普通 / 有効な薬すべてチェック
  function markAllGood(petId, date) {
    var log = ensureLog(petId, date);
    log.meal = "all";
    log.stool = "normal";
    log.medChecks = {};
    medsForPet(petId, true).forEach(function (med) { log.medChecks[med.id] = true; });
    log.updatedAt = nowIso();
    persist();
  }

  /* ===== 体重 ===== */
  function weightsForPet(petId) {
    return data.weights.filter(function (weight) { return weight.petId === petId; })
      .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  function latestWeight(petId) {
    var list = weightsForPet(petId);
    return list.length ? list[list.length - 1] : null;
  }
  function upsertWeight(petId, date, kg, memo) {
    var existing = data.weights.filter(function (weight) { return weight.petId === petId && weight.date === date; })[0];
    if (existing) { existing.kg = kg; existing.memo = memo || ""; }
    else { data.weights.push({ id: uid("wt"), petId: petId, date: date, kg: kg, memo: memo || "", createdAt: nowIso() }); }
    persist();
  }

  /* ===== 異変アラート（3ルール。文言は事実指摘＋受診案内のみ） ===== */
  function twoDayStreakAlert(petId, field, badValues) {
    // 該当フィールドが記録されている日だけを対象に、直近2件が連続日か判定
    var recorded = data.dailyLogs
      .filter(function (log) { return log.petId === petId && log[field] != null; })
      .sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
    if (recorded.length < 2) return false;
    var newest = recorded[0], prev = recorded[1];
    if (diffDays(newest.date, prev.date) !== 1) return false; // 連続日でなければ解消扱い
    return badValues.indexOf(newest[field]) >= 0 && badValues.indexOf(prev[field]) >= 0;
  }
  function weightDropAlert(petId) {
    var list = weightsForPet(petId);
    if (list.length < 2) return null;
    var latest = list[list.length - 1], prev = list[list.length - 2];
    if (latest.kg <= prev.kg * 0.95) return { prev: prev.kg, latest: latest.kg };
    return null;
  }
  function computeAlerts(petId) {
    var alerts = [];
    if (twoDayStreakAlert(petId, "meal", ["none", "partial"])) {
      alerts.push({ type: "meal", text: "ごはんの食べ残しが続いています。" });
    }
    if (twoDayStreakAlert(petId, "stool", ["none"])) {
      alerts.push({ type: "stool", text: "うんちが2日出ていません。" });
    }
    var drop = weightDropAlert(petId);
    if (drop) {
      alerts.push({ type: "weight", text: "体重が減っています（前回" + formatKg(drop.prev) + "kg→今回" + formatKg(drop.latest) + "kg）。" });
    }
    return alerts;
  }
  function alertDatesForPet(petId) {
    // カレンダーセルの警告色対象日を集める（該当した日別ログの日付）
    var dates = {};
    var mealFire = twoDayStreakAlert(petId, "meal", ["none", "partial"]);
    var stoolFire = twoDayStreakAlert(petId, "stool", ["none"]);
    data.dailyLogs.forEach(function (log) {
      if (log.petId !== petId) return;
      if (mealFire && ["none", "partial"].indexOf(log.meal) >= 0) dates[log.date] = true;
      if (stoolFire && log.stool === "none") dates[log.date] = true;
    });
    return dates;
  }

  function formatKg(value) {
    return (Math.round(value * 10) / 10).toFixed(1);
  }

  /* ===== トースト / Undo スナックバー ===== */
  var toastTimer = null;
  var undoState = null;
  var undoTimer = null;
  function showToast(message) {
    hideUndo();
    var toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-visible"); }, 2400);
  }
  function hideUndo() {
    var snackbar = $("#undoSnackbar");
    if (snackbar) snackbar.classList.add("hidden");
    if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; }
    undoState = null;
  }
  function showUndo(message, restore) {
    var snackbar = $("#undoSnackbar");
    if (!snackbar) return;
    if (undoTimer) { clearTimeout(undoTimer); undoTimer = null; }
    undoState = { restore: restore };
    $("#undoSnackbarText").textContent = message;
    snackbar.classList.remove("hidden");
    undoTimer = setTimeout(hideUndo, 5000);
  }
  function runUndo() {
    var state = undoState;
    hideUndo();
    if (state && typeof state.restore === "function") state.restore();
  }

  /* ===== モーダル ===== */
  function openModal(id) {
    var modal = $("#" + id);
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }
  function closeModal(id) {
    var modal = $("#" + id);
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    if (!$(".modal.is-open")) document.body.classList.remove("modal-open");
  }
  var confirmCallback = null;
  function askConfirm(message, actionLabel, callback) {
    $("#confirmMessage").textContent = message;
    $("#confirmAccept").textContent = actionLabel || "削除する";
    confirmCallback = callback;
    openModal("confirmModal");
  }

  /* ===== ± 長押し連続増減 ===== */
  function bindHoldRepeat(target, onStep) {
    var button = typeof target === "string" ? $(target) : target;
    if (!button) return null;
    var holdTimer = null, repeatTimer = null, repeatCount = 0, suppressClick = false;
    function stopHold() {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      if (repeatTimer) { clearTimeout(repeatTimer); repeatTimer = null; }
    }
    function repeatStep() {
      suppressClick = true;
      onStep();
      repeatCount += 1;
      var interval = Math.max(HOLD_REPEAT_MIN_INTERVAL_MS, HOLD_REPEAT_START_INTERVAL_MS - Math.floor(repeatCount / 10) * HOLD_REPEAT_ACCELERATION_MS);
      repeatTimer = setTimeout(repeatStep, interval);
    }
    button.addEventListener("pointerdown", function (event) {
      if (event.button != null && event.button !== 0) return;
      stopHold(); suppressClick = false; repeatCount = 0;
      holdTimer = setTimeout(function () { holdTimer = null; repeatStep(); }, HOLD_REPEAT_DELAY_MS);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (type) { button.addEventListener(type, stopHold); });
    button.addEventListener("click", function () {
      if (suppressClick) { suppressClick = false; return; }
      onStep();
    });
    button.addEventListener("contextmenu", function (event) { event.preventDefault(); });
    return button;
  }

  /* ===== チェックリスト描画（ホーム・過去日モーダル共通UI） ===== */
  function renderChecklist(container, petId, date) {
    clearNode(container);
    var log = getLog(petId, date);

    container.appendChild(buildChoiceBlock("ごはん", MEAL_CHOICES, log ? log.meal : null, function (value) {
      var current = getLog(petId, date);
      var next = (current && current.meal === value) ? null : value;
      setLogField(petId, date, "meal", next);
      afterChecklistChange(petId, date);
    }));
    container.appendChild(buildChoiceBlock("うんち", STOOL_CHOICES, log ? log.stool : null, function (value) {
      var current = getLog(petId, date);
      var next = (current && current.stool === value) ? null : value;
      setLogField(petId, date, "stool", next);
      afterChecklistChange(petId, date);
    }));

    var activeMeds = medsForPet(petId, true);
    if (activeMeds.length) {
      var medBlock = el("div", "check-block");
      medBlock.appendChild(el("div", "check-block-title", "お薬"));
      var medList = el("div", "med-list");
      activeMeds.forEach(function (med) {
        var checked = !!(log && log.medChecks[med.id]);
        var row = el("button", "med-check" + (checked ? " is-checked" : ""));
        row.type = "button";
        row.setAttribute("data-med-check", med.id);
        var box = el("span", "med-check-box", "✓");
        var name = el("span", "med-check-name", med.name);
        row.appendChild(box); row.appendChild(name);
        row.addEventListener("click", function () {
          toggleMedCheck(petId, date, med.id);
          afterChecklistChange(petId, date);
        });
        medList.appendChild(row);
      });
      medBlock.appendChild(medList);
      container.appendChild(medBlock);
    }

    // メモ（折りたたみ）
    var memoBlock = el("div", "check-block");
    var hasMemo = !!(log && log.memo);
    var memoToggle = el("button", "memo-toggle", (hasMemo ? "メモ: " + log.memo : "＋ メモを追加"));
    memoToggle.type = "button";
    var memoInput = el("textarea", "memo-input hidden");
    memoInput.placeholder = "気づいたことをメモ（例: 夜だけ食欲なし）";
    memoInput.value = log ? log.memo : "";
    memoToggle.addEventListener("click", function () {
      memoInput.classList.toggle("hidden");
      if (!memoInput.classList.contains("hidden")) memoInput.focus();
    });
    memoInput.addEventListener("change", function () {
      setLogField(petId, date, "memo", memoInput.value.trim());
      afterChecklistChange(petId, date);
    });
    memoBlock.appendChild(memoToggle);
    memoBlock.appendChild(memoInput);
    container.appendChild(memoBlock);
  }

  function buildChoiceBlock(title, choices, selected, onPick) {
    var block = el("div", "check-block");
    block.appendChild(el("div", "check-block-title", title));
    var row = el("div", "choice-row");
    choices.forEach(function (choice) {
      var isSelected = selected === choice.value;
      var button = el("button", "choice-btn" + (isSelected ? " is-selected tone-" + choice.tone : ""), choice.label);
      button.type = "button";
      button.setAttribute("data-choice", choice.value);
      button.addEventListener("click", function () { onPick(choice.value); });
      row.appendChild(button);
    });
    block.appendChild(row);
    return block;
  }

  function afterChecklistChange(petId, date) {
    // 開いている画面・モーダルを再描画し、リング/カレンダー/アラートを整合させる
    if ($("#dayModal").classList.contains("is-open") && currentDayModalDate === date) {
      renderChecklist($("#dayChecklist"), petId, date);
    }
    renderHome();
  }

  /* ===== ホーム ===== */
  function renderHome() {
    var pet = activePet();
    if (!pet) return;
    $("#petSwitcherName").textContent = pet.name;
    var age = ageLabel(pet);
    $("#petSwitcherAge").textContent = age ? age : SPECIES_LABEL[pet.species];

    var today = todayString();
    renderChecklist($("#todayChecklist"), pet.id, today);
    updateAllGoodButton(pet.id, today);
    renderAlerts(pet.id);
    renderSummary(pet.id);
  }

  function isAllGood(petId, date) {
    var log = getLog(petId, date);
    if (!log || log.meal !== "all" || log.stool !== "normal") return false;
    var activeMeds = medsForPet(petId, true);
    return activeMeds.every(function (med) { return log.medChecks[med.id] === true; });
  }
  function updateAllGoodButton(petId, date) {
    var button = $("#allGoodButton");
    var complete = isAllGood(petId, date);
    button.classList.toggle("is-complete", complete);
    button.querySelector(".all-good-title").textContent = complete ? "今日は記録済み" : "今日もぜんぶ順調";
    button.querySelector(".all-good-sub").textContent = complete ? "タップで内容を確認・変更" : "タップで今日の記録を完了";
  }

  function renderAlerts(petId) {
    var area = $("#alertArea");
    clearNode(area);
    var alerts = computeAlerts(petId);
    if (!alerts.length) { area.classList.add("hidden"); return; }
    area.classList.remove("hidden");
    alerts.forEach(function (alert) {
      var card = el("div", "alert-card");
      card.appendChild(el("span", "alert-card-icon", "⚠️"));
      var body = el("div", "alert-card-body");
      body.appendChild(document.createTextNode(alert.text));
      body.appendChild(el("span", "alert-advice", VET_ADVICE));
      card.appendChild(body);
      area.appendChild(card);
    });
  }

  function renderSummary(petId) {
    var today = todayString();
    var todayDate = dateFromString(today);
    var year = todayDate.getFullYear(), month = todayDate.getMonth();
    var firstDay = new Date(year, month, 1);
    var daysInMonth = new Date(year, month + 1, 0).getDate();

    // 当月の記録日数
    var loggedDates = {};
    data.dailyLogs.forEach(function (log) {
      if (log.petId !== petId || !logHasContent(log)) return;
      var d = dateFromString(log.date);
      if (d.getFullYear() === year && d.getMonth() === month) loggedDates[log.date] = true;
    });
    var loggedCount = Object.keys(loggedDates).length;
    $("#monthRingCount").textContent = loggedCount;
    var progress = Math.round((loggedCount / daysInMonth) * 100);
    var ring = $("#monthRing");
    ring.style.setProperty("--ring-progress", progress + "%");
    ring.classList.toggle("is-complete", loggedCount >= daysInMonth);
    $("#miniCalTitle").textContent = (month + 1) + "月の記録";

    var alertDates = alertDatesForPet(petId);
    var grid = $("#miniCalGrid");
    clearNode(grid);
    WEEKDAYS.forEach(function (dow) { grid.appendChild(el("div", "mini-cal-dow", dow)); });
    for (var blank = 0; blank < firstDay.getDay(); blank += 1) grid.appendChild(el("div", "mini-cal-cell is-blank"));
    for (var day = 1; day <= daysInMonth; day += 1) {
      var dateStr = year + "-" + pad2(month + 1) + "-" + pad2(day);
      var cell = el("div", "mini-cal-cell", String(day));
      var future = diffDays(dateStr, today) > 0;
      if (alertDates[dateStr]) cell.classList.add("is-alert");
      else if (loggedDates[dateStr]) cell.classList.add("is-logged");
      if (dateStr === today) cell.classList.add("is-today");
      if (future) cell.classList.add("is-future");
      else {
        cell.classList.add("clickable");
        (function (openDate) {
          cell.addEventListener("click", function () { openDayModal(petId, openDate); });
        })(dateStr);
      }
      grid.appendChild(cell);
    }

    // 体重記録から7日以上経過していたらバッジ表示（通知はしない）
    renderWeightBadge(petId);
  }

  function renderWeightBadge(petId) {
    var existing = $("#weightBadge");
    if (existing) existing.parentNode.removeChild(existing);
    var latest = latestWeight(petId);
    var needsWeight = !latest || diffDays(todayString(), latest.date) >= 7;
    if (!needsWeight) return;
    var badge = el("div", "weight-badge");
    badge.id = "weightBadge";
    badge.appendChild(el("span", null, latest ? "体重を記録しませんか？（前回 " + formatDateJa(latest.date) + "）" : "体重を記録しませんか？"));
    var button = el("button", null, "記録する");
    button.type = "button";
    button.addEventListener("click", function () { openWeightModal(); });
    badge.appendChild(button);
    var checklist = $("#todayChecklist");
    checklist.parentNode.insertBefore(badge, checklist.nextSibling);
  }

  /* ===== 過去日モーダル ===== */
  var currentDayModalDate = null;
  function openDayModal(petId, date) {
    if (diffDays(date, todayString()) > 0) return; // 未来日は不可
    currentDayModalDate = date;
    $("#dayModalTitle").textContent = formatDateJa(date) + (date === todayString() ? "（今日）" : "");
    renderChecklist($("#dayChecklist"), petId, date);
    openModal("dayModal");
  }

  /* ===== グラフ ===== */
  var currentRange = "1m";
  function renderGraph() {
    var pet = activePet();
    if (!pet) return;
    var all = weightsForPet(pet.id);
    var filtered = filterWeightsByRange(all, currentRange);
    var chart = $("#weightChart");
    var empty = $("#weightChartEmpty");
    clearNode(chart);
    $("#weightReadout").textContent = "";
    if (!filtered.length) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");
    chart.appendChild(buildWeightSvg(filtered, 600, 220, true));
  }
  function filterWeightsByRange(list, range) {
    if (range === "all" || !list.length) return list;
    var today = todayString();
    var days = range === "1m" ? 31 : range === "3m" ? 92 : 366;
    return list.filter(function (weight) { return Math.abs(diffDays(today, weight.date)) <= days; });
  }
  function buildWeightSvg(points, width, height, interactive) {
    var pad = { top: 20, right: 16, bottom: 28, left: 40 };
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 " + width + " " + height);
    svg.setAttribute("preserveAspectRatio", "none");

    var kgs = points.map(function (p) { return p.kg; });
    var minKg = Math.min.apply(null, kgs), maxKg = Math.max.apply(null, kgs);
    var span = maxKg - minKg;
    if (span < 0.4) { minKg -= 0.3; maxKg += 0.3; } else { minKg -= span * 0.15; maxKg += span * 0.15; }
    var plotW = width - pad.left - pad.right, plotH = height - pad.top - pad.bottom;
    function x(index) { return points.length === 1 ? pad.left + plotW / 2 : pad.left + (plotW * index) / (points.length - 1); }
    function y(kg) { return pad.top + plotH * (1 - (kg - minKg) / (maxKg - minKg || 1)); }

    // 軸（最小・最大の目盛）
    [minKg, maxKg].forEach(function (kg, idx) {
      var line = document.createElementNS(svgNS, "line");
      line.setAttribute("class", "wc-axis");
      line.setAttribute("x1", pad.left); line.setAttribute("x2", width - pad.right);
      line.setAttribute("y1", y(kg)); line.setAttribute("y2", y(kg));
      svg.appendChild(line);
      var label = document.createElementNS(svgNS, "text");
      label.setAttribute("class", "wc-axis-label");
      label.setAttribute("x", 4); label.setAttribute("y", y(kg) + (idx === 0 ? -4 : 12));
      label.textContent = formatKg(kg);
      svg.appendChild(label);
    });

    if (points.length > 1) {
      var path = document.createElementNS(svgNS, "path");
      var d = points.map(function (p, index) { return (index === 0 ? "M" : "L") + x(index) + " " + y(p.kg); }).join(" ");
      path.setAttribute("class", "wc-line");
      path.setAttribute("d", d);
      svg.appendChild(path);
    }
    points.forEach(function (p, index) {
      var dot = document.createElementNS(svgNS, "circle");
      dot.setAttribute("class", "wc-dot");
      dot.setAttribute("cx", x(index)); dot.setAttribute("cy", y(p.kg));
      dot.setAttribute("r", 5);
      if (interactive) {
        dot.addEventListener("click", function () {
          $("#weightReadout").textContent = formatDateJa(p.date) + "  " + formatKg(p.kg) + "kg";
        });
      }
      svg.appendChild(dot);
    });
    return svg;
  }

  /* ===== 獣医レポート（直近14日） ===== */
  function renderReport() {
    var pet = activePet();
    var body = $("#reportBody");
    clearNode(body);
    if (!pet) return;
    body.appendChild(el("div", "report-head", pet.name + (ageLabel(pet) ? "（" + ageLabel(pet) + "）" : "")));

    var today = todayString();
    var meds = medsForPet(pet.id, false);
    var wrap = el("div", "report-table-wrap");
    var table = el("table", "report-table");
    var thead = el("thead");
    var headRow = el("tr");
    ["日付", "ごはん", "うんち", "薬", "メモ"].forEach(function (h) { headRow.appendChild(el("th", null, h)); });
    thead.appendChild(headRow);
    table.appendChild(thead);
    var tbody = el("tbody");
    for (var offset = 0; offset < 14; offset += 1) {
      var date = addDays(today, -offset);
      var log = getLog(pet.id, date);
      var tr = el("tr");
      var d = dateFromString(date);
      tr.appendChild(el("td", "rt-date", (d.getMonth() + 1) + "/" + d.getDate() + "(" + WEEKDAYS[d.getDay()] + ")"));
      tr.appendChild(reportCell(log ? log.meal : null, MEAL_CHOICES));
      tr.appendChild(reportCell(log ? log.stool : null, STOOL_CHOICES));
      var medCount = log ? meds.filter(function (m) { return log.medChecks[m.id]; }).length : 0;
      var medCell = el("td", meds.length ? null : "rt-none", meds.length ? (medCount + "/" + meds.length) : "-");
      tr.appendChild(medCell);
      var memoCell = el("td", log && log.memo ? null : "rt-none", log && log.memo ? log.memo : "-");
      tr.appendChild(memoCell);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    body.appendChild(wrap);

    // 体重ミニグラフ
    var weights = filterWeightsByRange(weightsForPet(pet.id), "1m");
    var miniWrap = el("div", "report-mini-chart");
    miniWrap.appendChild(el("div", "group-title", "体重（直近1ヶ月）"));
    if (weights.length) miniWrap.appendChild(buildWeightSvg(weights, 600, 100, false));
    else miniWrap.appendChild(el("div", "rt-none", "記録なし"));
    body.appendChild(miniWrap);
  }
  function reportCell(value, choices) {
    if (value == null) return el("td", "rt-none", "-");
    var choice = choices.filter(function (c) { return c.value === value; })[0];
    return el("td", choice.tone === "ok" ? "rt-ok" : "rt-warn", choice.label);
  }

  /* ===== 設定 ===== */
  function renderSettings() {
    var petList = $("#settingsPetList");
    clearNode(petList);
    data.pets.forEach(function (pet) {
      var item = el("div", "settings-item");
      var main = el("div", "settings-item-main");
      main.appendChild(el("div", "settings-item-name", pet.name));
      main.appendChild(el("div", "settings-item-sub", SPECIES_LABEL[pet.species] + (ageLabel(pet) ? " ・ " + ageLabel(pet) : "")));
      item.appendChild(main);
      var edit = el("button", "settings-item-action", "編集");
      edit.type = "button";
      edit.addEventListener("click", function () { openPetModal(pet); });
      item.appendChild(edit);
      var del = el("button", "settings-item-action danger", "削除");
      del.type = "button";
      del.addEventListener("click", function () {
        askConfirm(pet.name + "の記録をすべて削除します。よろしいですか？", "削除する", function () {
          deletePet(pet.id);
          if (!data.pets.length) { renderSettings(); startIfNeeded(); return; }
          renderSettings(); renderHome(); showToast("削除しました");
        });
      });
      item.appendChild(del);
      petList.appendChild(item);
    });

    var medList = $("#settingsMedList");
    clearNode(medList);
    var pet2 = activePet();
    if (!pet2) { medList.appendChild(el("div", "settings-item-sub", "うちのこを登録するとお薬を追加できます")); }
    else {
      var meds = medsForPet(pet2.id, false);
      if (!meds.length) medList.appendChild(el("div", "settings-item-sub", pet2.name + "のお薬はまだありません"));
      meds.forEach(function (med) {
        var item = el("div", "settings-item" + (med.isActive ? "" : " is-inactive"));
        var main = el("div", "settings-item-main");
        main.appendChild(el("div", "settings-item-name", med.name));
        if (med.note) main.appendChild(el("div", "settings-item-sub", med.note));
        item.appendChild(main);
        var edit = el("button", "settings-item-action", "編集");
        edit.type = "button";
        edit.addEventListener("click", function () { openMedModal(med); });
        item.appendChild(edit);
        var toggle = el("button", "settings-item-action", med.isActive ? "無効化" : "有効化");
        toggle.type = "button";
        toggle.addEventListener("click", function () {
          updateMed(med.id, { isActive: !med.isActive });
          renderSettings(); renderHome();
        });
        item.appendChild(toggle);
        medList.appendChild(item);
      });
    }
    $("#appearanceSelect").value = document.documentElement.dataset.appearanceSetting || "system";
  }

  /* ===== フォーム構築（オンボーディング・ペット） ===== */
  function buildPetFormFields(container, values, includeMed) {
    clearNode(container);
    var nameLabel = el("label", "field-label", "名前");
    nameLabel.setAttribute("for", "petNameInput");
    var nameInput = el("input", "text-input");
    nameInput.id = "petNameInput"; nameInput.type = "text"; nameInput.placeholder = "例: ぽち";
    nameInput.value = values.name || "";
    container.appendChild(nameLabel); container.appendChild(nameInput);

    container.appendChild(el("label", "field-label", "種類"));
    var seg = el("div", "seg-row");
    seg.id = "petSpeciesSeg";
    SPECIES.forEach(function (species) {
      var button = el("button", "seg-btn" + ((values.species || "dog") === species ? " is-selected" : ""), SPECIES_LABEL[species]);
      button.type = "button"; button.setAttribute("data-species", species);
      button.addEventListener("click", function () {
        $$("#petSpeciesSeg .seg-btn").forEach(function (b) { b.classList.remove("is-selected"); });
        button.classList.add("is-selected");
      });
      seg.appendChild(button);
    });
    container.appendChild(seg);

    var birthLabel = el("label", "field-label", "生まれ年月（任意）");
    birthLabel.setAttribute("for", "petBirthInput");
    var birthInput = el("input", "text-input");
    birthInput.id = "petBirthInput"; birthInput.type = "month"; birthInput.value = values.birthMonth || "";
    container.appendChild(birthLabel); container.appendChild(birthInput);

    if (includeMed) {
      var medLabel = el("label", "field-label", "飲んでいるお薬（任意）");
      medLabel.setAttribute("for", "petMedInput");
      var medInput = el("input", "text-input");
      medInput.id = "petMedInput"; medInput.type = "text"; medInput.placeholder = "例: 心臓のお薬";
      container.appendChild(medLabel); container.appendChild(medInput);
    }
  }
  function readPetForm() {
    var species = "dog";
    var selected = $("#petSpeciesSeg .seg-btn.is-selected");
    if (selected) species = selected.getAttribute("data-species");
    return {
      name: ($("#petNameInput").value || "").trim(),
      species: species,
      birthMonth: ($("#petBirthInput").value || "").trim() || null,
      med: $("#petMedInput") ? ($("#petMedInput").value || "").trim() : ""
    };
  }

  /* ===== モーダル: オンボーディング / ペット / お薬 / 体重 ===== */
  function openOnboarding() {
    buildPetFormFields($("#onboardingForm"), {}, true);
    openModal("onboardingModal");
    setTimeout(function () { var input = $("#petNameInput"); if (input) input.focus(); }, 60);
  }
  function submitOnboarding() {
    var fields = readPetForm();
    if (!fields.name) { showToast("名前を入力してください"); return; }
    var pet = addPet(fields);
    if (fields.med) addMed(pet.id, { name: fields.med });
    closeModal("onboardingModal");
    renderHome(); renderSettings();
  }

  var editingPetId = null;
  function openPetModal(pet) {
    editingPetId = pet ? pet.id : null;
    $("#petModalTitle").textContent = pet ? "うちのこを編集" : "うちのこを追加";
    buildPetFormFields($("#petForm"), pet || {}, false);
    openModal("petModal");
  }
  function submitPetModal() {
    var fields = readPetForm();
    if (!fields.name) { showToast("名前を入力してください"); return; }
    if (editingPetId) { updatePet(editingPetId, fields); showToast("保存しました"); }
    else { addPet(fields); showToast("追加しました"); }
    closeModal("petModal");
    renderSettings(); renderHome();
  }

  var editingMedId = null;
  function openMedModal(med) {
    editingMedId = med ? med.id : null;
    $("#medModalTitle").textContent = med ? "お薬を編集" : "お薬を追加";
    var container = $("#medForm");
    clearNode(container);
    var nameLabel = el("label", "field-label", "お薬の名前");
    nameLabel.setAttribute("for", "medNameInput");
    var nameInput = el("input", "text-input");
    nameInput.id = "medNameInput"; nameInput.type = "text"; nameInput.placeholder = "例: 心臓のお薬";
    nameInput.value = med ? med.name : "";
    var noteLabel = el("label", "field-label", "メモ（任意）");
    noteLabel.setAttribute("for", "medNoteInput");
    var noteInput = el("input", "text-input");
    noteInput.id = "medNoteInput"; noteInput.type = "text"; noteInput.placeholder = "例: 朝1錠";
    noteInput.value = med ? med.note : "";
    container.appendChild(nameLabel); container.appendChild(nameInput);
    container.appendChild(noteLabel); container.appendChild(noteInput);
    openModal("medModal");
  }
  function submitMedModal() {
    var pet = activePet();
    if (!pet) { closeModal("medModal"); return; }
    var name = ($("#medNameInput").value || "").trim();
    var note = ($("#medNoteInput").value || "").trim();
    if (!name) { showToast("お薬の名前を入力してください"); return; }
    if (editingMedId) updateMed(editingMedId, { name: name, note: note });
    else addMed(pet.id, { name: name, note: note });
    closeModal("medModal");
    renderSettings(); renderHome();
  }

  var weightDraft = 0;
  function openWeightModal() {
    var pet = activePet();
    if (!pet) return;
    var latest = latestWeight(pet.id);
    weightDraft = latest ? latest.kg : 4.0;
    updateWeightDisplay();
    $("#weightDate").value = todayString();
    $("#weightMemo").value = "";
    openModal("weightModal");
  }
  function updateWeightDisplay() {
    weightDraft = Math.max(0, Math.round(weightDraft * 10) / 10);
    $("#weightValue").textContent = formatKg(weightDraft);
  }
  function stepWeight(delta) { weightDraft = Math.max(0, weightDraft + delta); updateWeightDisplay(); }
  function submitWeight() {
    var pet = activePet();
    if (!pet) return;
    var date = $("#weightDate").value || todayString();
    var memo = ($("#weightMemo").value || "").trim();
    if (weightDraft <= 0) { showToast("体重を入力してください"); return; }
    var kg = Math.round(weightDraft * 10) / 10;
    var existing = data.weights.filter(function (w) { return w.petId === pet.id && w.date === date; })[0];
    if (existing) {
      askConfirm(formatDateJa(date) + "の記録を上書きします。よろしいですか？", "上書きする", function () {
        upsertWeight(pet.id, date, kg, memo);
        closeModal("weightModal"); finishWeightSave();
      });
      return;
    }
    upsertWeight(pet.id, date, kg, memo);
    closeModal("weightModal"); finishWeightSave();
  }
  function finishWeightSave() {
    showToast("体重を記録しました");
    renderHome(); renderGraph();
  }

  /* ===== バックアップ・復元・全削除 ===== */
  function exportBackup() {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "uchinoko-backup-" + todayString() + ".json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    showToast("バックアップを書き出しました");
  }
  function importBackup(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(reader.result);
        if (!isPlausibleDataRoot(parsed)) throw new Error("Invalid backup");
        var restored = migrateToCurrentVersion(parsed);
        data = restored;
        persist();
        showToast("復元しました");
        renderAll();
        startIfNeeded();
        switchTab("home");
      } catch (error) {
        console.error(error);
        showToast("このファイルは復元できません");
      }
    };
    reader.readAsText(file);
  }
  function deleteAllData() {
    askConfirm("すべてのデータを削除します。この操作は取り消せません。", "削除する", function () {
      askConfirm("本当に削除しますか？（2段階目の確認）", "完全に削除する", function () {
        data = blankData();
        try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
        renderAll();
        startIfNeeded();
        switchTab("home");
        showToast("すべて削除しました");
      });
    });
  }

  /* ===== タブ切替 ===== */
  var currentTab = "home";
  function switchTab(name) {
    currentTab = name;
    ["home", "graph", "report", "settings"].forEach(function (screen) {
      $("#screen-" + screen).classList.toggle("hidden", screen !== name);
    });
    $$(".tab-item").forEach(function (item) {
      item.classList.toggle("is-active", item.getAttribute("data-tab") === name);
    });
    if (name === "home") renderHome();
    if (name === "graph") renderGraph();
    if (name === "report") renderReport();
    if (name === "settings") renderSettings();
  }

  /* ===== ペット切替ピッカー ===== */
  function openPetPicker() {
    if (data.pets.length <= 1) return;
    var list = $("#petPickerList");
    clearNode(list);
    data.pets.forEach(function (pet) {
      var item = el("button", "picker-item" + (pet.id === data.activePetId ? " is-active" : ""));
      item.type = "button";
      item.appendChild(el("span", "picker-item-name", pet.name));
      item.appendChild(el("span", "picker-item-age", ageLabel(pet) || SPECIES_LABEL[pet.species]));
      item.addEventListener("click", function () {
        data.activePetId = pet.id; persist();
        closeModal("petPickerModal");
        renderAll();
      });
      list.appendChild(item);
    });
    openModal("petPickerModal");
  }

  /* ===== テーマ ===== */
  function applyAppearance(setting) {
    var resolved = setting === "system"
      ? (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : setting;
    document.documentElement.dataset.appearance = resolved;
    document.documentElement.dataset.appearanceSetting = setting;
    var meta = $("#themeColorMeta");
    if (meta) meta.setAttribute("content", resolved === "dark" ? "#120D09" : "#FAF6F1");
    try {
      localStorage.setItem(UI_KEY, JSON.stringify({ appearance: setting, colorTheme: "terracotta" }));
    } catch (error) { /* noop */ }
  }

  /* ===== 全再描画 / 起動判定 ===== */
  function renderAll() { renderHome(); if (currentTab === "graph") renderGraph(); if (currentTab === "report") renderReport(); if (currentTab === "settings") renderSettings(); }
  function startIfNeeded() {
    if (!data.pets.length) openOnboarding();
    else closeModal("onboardingModal");
  }

  /* ===== イベント配線 ===== */
  function bindEvents() {
    $$(".tab-item").forEach(function (item) {
      item.addEventListener("click", function () { switchTab(item.getAttribute("data-tab")); });
    });
    $("#fabWeight").addEventListener("click", function () {
      if (!activePet()) { showToast("先にうちのこを登録してください"); return; }
      openWeightModal();
    });
    $("#petSwitcher").addEventListener("click", openPetPicker);

    $("#allGoodButton").addEventListener("click", function () {
      var pet = activePet();
      if (!pet) return;
      var date = todayString();
      if (isAllGood(pet.id, date)) { openDayModal(pet.id, date); return; }
      var previous = cloneData(getLog(pet.id, date));
      markAllGood(pet.id, date);
      renderHome();
      showUndo("今日の記録を完了しました", function () {
        data.dailyLogs = data.dailyLogs.filter(function (log) { return !(log.petId === pet.id && log.date === date); });
        if (previous) data.dailyLogs.push(previous);
        persist();
        renderHome();
      });
    });

    // 体重ステッパー
    bindHoldRepeat("#weightMinusBig", function () { stepWeight(-1); });
    bindHoldRepeat("#weightPlusBig", function () { stepWeight(1); });
    bindHoldRepeat("#weightMinusSmall", function () { stepWeight(-0.1); });
    bindHoldRepeat("#weightPlusSmall", function () { stepWeight(0.1); });
    $("#weightSubmit").addEventListener("click", submitWeight);

    // グラフ期間切替
    $$("#weightRangeTabs .range-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        currentRange = tab.getAttribute("data-range");
        $$("#weightRangeTabs .range-tab").forEach(function (t) { t.classList.remove("is-active"); });
        tab.classList.add("is-active");
        renderGraph();
      });
    });

    // 設定
    $("#addPetButton").addEventListener("click", function () { openPetModal(null); });
    $("#addMedButton").addEventListener("click", function () {
      if (!activePet()) { showToast("先にうちのこを登録してください"); return; }
      openMedModal(null);
    });
    $("#appearanceSelect").addEventListener("change", function () { applyAppearance($("#appearanceSelect").value); });
    $("#backupButton").addEventListener("click", exportBackup);
    $("#restoreButton").addEventListener("click", function () { $("#restoreFileInput").click(); });
    $("#restoreFileInput").addEventListener("change", function (event) {
      if (event.target.files && event.target.files[0]) importBackup(event.target.files[0]);
      event.target.value = "";
    });
    $("#deleteAllButton").addEventListener("click", deleteAllData);

    // モーダルのフォーム送信
    $("#onboardingSubmit").addEventListener("click", submitOnboarding);
    $("#petSubmit").addEventListener("click", submitPetModal);
    $("#medSubmit").addEventListener("click", submitMedModal);

    // 汎用: data-close で閉じる
    $$("[data-close]").forEach(function (node) {
      node.addEventListener("click", function () { closeModal(node.getAttribute("data-close")); });
    });

    // 確認ダイアログ
    $("#confirmAccept").addEventListener("click", function () {
      var callback = confirmCallback; confirmCallback = null;
      closeModal("confirmModal");
      if (callback) callback();
    });
    $("#confirmCancel").addEventListener("click", function () { confirmCallback = null; closeModal("confirmModal"); });

    // Undo
    $("#undoSnackbarButton").addEventListener("click", runUndo);

    // システムテーマ追従
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var listener = function () { if ((document.documentElement.dataset.appearanceSetting || "system") === "system") applyAppearance("system"); };
      if (mq.addEventListener) mq.addEventListener("change", listener); else if (mq.addListener) mq.addListener(listener);
    }
  }

  /* ===== テストAPI（__PETLOG_TEST_MODE） ===== */
  function buildTestApi() {
    return {
      getData: function () { return cloneData(data); },
      setData: function (next) { data = normalizeData(next); persist(); renderAll(); startIfNeeded(); },
      reset: function () { data = blankData(); try { localStorage.removeItem(STORAGE_KEY); } catch (e) {} renderAll(); startIfNeeded(); },
      setToday: function (dateStr) { injectedToday = dateStr || null; renderAll(); },
      today: function () { return todayString(); },
      getActivePet: function () { return activePet() ? cloneData(activePet()) : null; },
      setActivePet: function (petId) { if (findById(data.pets, petId)) { data.activePetId = petId; persist(); renderAll(); } },
      getTodayLog: function () { var pet = activePet(); return pet ? cloneData(getLog(pet.id, todayString())) : null; },
      getLog: function (petId, date) { return cloneData(getLog(petId, date)); },
      addPet: function (fields) { var pet = addPet(fields); renderAll(); startIfNeeded(); return pet.id; },
      addMed: function (petId, fields) { var med = addMed(petId, fields); renderAll(); return med.id; },
      tapAllGood: function () { $("#allGoodButton").click(); },
      tapChecklist: function (field, value) {
        var pet = activePet(); if (!pet) return;
        setLogField(pet.id, todayString(), field, value); renderHome();
      },
      addWeight: function (petId, date, kg, memo) { upsertWeight(petId, date, kg, memo); renderAll(); },
      getAlerts: function () { var pet = activePet(); return pet ? computeAlerts(pet.id) : []; },
      switchTab: switchTab,
      openDay: function (date) { var pet = activePet(); if (pet) openDayModal(pet.id, date); }
    };
  }

  /* ===== 起動 ===== */
  function init() {
    bindEvents();
    applyAppearance(document.documentElement.dataset.appearanceSetting || "system");
    if (dataRecoveryRequired || dataLoadWarning) {
      setTimeout(function () { showToast("保存データを読み込めなかったため、新しく始めます"); }, 300);
    }
    switchTab("home");
    startIfNeeded();
    window.PetLog = { __test__: buildTestApi() };
    if (window.__PETLOG_TEST_MODE) window.__test = window.PetLog.__test__;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
