(function () {
  "use strict";

  window.GymLog = window.GymLog || {};

  /* Configuration and shared UI helpers */
  var STORAGE_KEY = "gymlog-data-v1";
  var DRAFT_STORAGE_KEY = "gymlog-draft-v1";
  var PRE_RESTORE_STORAGE_KEY = "gymlog-pre-restore-v1";
  var UI_SETTINGS_KEY = "gymlog-ui-settings-v1";
  var DEFAULT_UI_SETTINGS = { appearance: "system", colorTheme: "urban-blue" };
  var APPEARANCE_OPTIONS = ["system", "light", "dark"];
  var COLOR_THEME_OPTIONS = ["urban-blue", "midnight", "graphite-lime"];
  var APPEARANCE_LABELS = { system: "端末に合わせる", light: "ライト", dark: "ダーク" };
  var COLOR_THEME_LABELS = { "urban-blue": "Urban Blue", midnight: "Midnight", "graphite-lime": "Graphite Lime" };
  var systemColorSchemeQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  var systemAppearanceListenerBound = false;
  var CURRENT_DATA_VERSION = 2;
  var CATEGORY_LABELS = {
    BARBELL: "バーベル",
    DUMBBELL: "ダンベル",
    MACHINE: "マシン",
    BODYWEIGHT: "自重",
    CARDIO: "有酸素"
  };
  var WEIGHT_STEPS = { BARBELL: 2.5, DUMBBELL: 0.5, MACHINE: 1, BODYWEIGHT: 0 };
  var RIR_LABELS = { "0": "限界", "1": "かなりキツい", "2-3": "結構キツい", "4+": "まだ余裕", "": "未入力" };
  var RIR_METS = { "0": 7, "1": 6, "2-3": 5, "4+": 3.5, "": 5 };
  // The legacy entry keeps previously saved localStorage records readable.
  var CARDIO_METS = { "ウォーキング": 3.5, "傾斜ウォーク": 5, "ジョギング": 7, "ランニング": 9.8, "バイク": 6.8, "クロストレーナー": 5.5, "階段": 8.8 };
  var CARDIO_TYPES = ["ウォーキング", "ジョギング", "ランニング", "バイク", "クロストレーナー", "階段"];
  var STRENGTH_METRICS = {
    maxWeight: { label: "最大重量", unit: "kg", decimals: 1, help: "その日に扱った中で一番重い重量です。" },
    maxReps: { label: "最高回数", unit: "回", decimals: 0, help: "その日の1セットで一番多くできた回数です。" },
    volume: { label: "総ボリューム", unit: "kg分", decimals: 0, help: "重量 × 回数 の合計です。その日にどれくらい積み重ねたかを表します。" },
    oneRm: { label: "推定1RM", unit: "kg", decimals: 1, help: "1回だけ挙げられる重さの目安です。" },
    totalReps: { label: "合計回数", unit: "回", decimals: 0, help: "その日に行った回数をすべて合計した値です。" }
  };
  var CARDIO_METRICS = {
    distance: { label: "距離", unit: "km", decimals: 1, help: "同じ日に行った距離の合計です。" },
    duration: { label: "時間", unit: "分", decimals: 0, help: "同じ日に運動した時間の合計です。" },
    speed: { label: "平均速度", unit: "km/h", decimals: 1, help: "合計距離と合計時間から計算した平均速度です。" },
    calories: { label: "概算消費カロリー", unit: "kcal", decimals: 0, help: "同じ日の概算消費カロリーの合計です。" }
  };
  var BODY_PARTS = [
    { id: "chest", label: "胸" }, { id: "shoulder", label: "肩" }, { id: "arm", label: "腕" },
    { id: "back", label: "背中" }, { id: "legs", label: "脚" }, { id: "abs", label: "腹" },
    { id: "cardio", label: "有酸素" }, { id: "other", label: "その他" }
  ];
  var EXERCISE_CATALOG_GROUPS = [
    { bodyPart: "chest", entries: [
      ["ベンチプレス", "BARBELL"], ["インクラインベンチプレス", "BARBELL"], ["デクラインベンチプレス", "BARBELL"],
      ["チェストプレス", "MACHINE"], ["インクラインチェストプレス", "MACHINE"], ["ダンベルプレス", "DUMBBELL"],
      ["インクラインダンベルプレス", "DUMBBELL"], ["ダンベルフライ", "DUMBBELL"], ["ペックフライ", "MACHINE"],
      ["ケーブルクロスオーバー", "MACHINE"], ["腕立て伏せ", "BODYWEIGHT"], ["ディップス", "BODYWEIGHT"]
    ] },
    { bodyPart: "shoulder", entries: [
      ["ショルダープレス", "MACHINE"], ["ミリタリープレス", "BARBELL"], ["ダンベルショルダープレス", "DUMBBELL"],
      ["サイドレイズ", "DUMBBELL"], ["フロントレイズ", "DUMBBELL"], ["リアレイズ", "DUMBBELL"],
      ["リアデルト", "MACHINE"], ["アーノルドプレス", "DUMBBELL"], ["アップライトロウ", "BARBELL"],
      ["シュラッグ", "DUMBBELL"], ["ラテラルレイズマシン", "MACHINE"]
    ] },
    { bodyPart: "arm", entries: [
      ["アームカール", "MACHINE"], ["バーベルカール", "BARBELL"], ["EZバーアームカール", "BARBELL"],
      ["ダンベルカール", "DUMBBELL"], ["ハンマーカール", "DUMBBELL"], ["インクラインダンベルカール", "DUMBBELL"],
      ["コンセントレーションカール", "DUMBBELL"], ["ケーブルカール", "MACHINE"], ["トライセプスプレス", "MACHINE"],
      ["ケーブルプレスダウン", "MACHINE"], ["ナローベンチプレス", "BARBELL"], ["スカルクラッシャー", "BARBELL"],
      ["ダンベルキックバック", "DUMBBELL"], ["フレンチプレス", "DUMBBELL"], ["ベンチディップス", "BODYWEIGHT"]
    ] },
    { bodyPart: "back", entries: [
      ["ラットプルダウン", "MACHINE"], ["シーテッドロー", "MACHINE"], ["ローロー", "MACHINE"], ["ハイロー", "MACHINE"],
      ["デッドリフト", "BARBELL"], ["ベントオーバーロウ", "BARBELL"], ["Tバーロウ", "BARBELL"],
      ["ワンハンドロー", "DUMBBELL"], ["ダンベルロー", "DUMBBELL"], ["ダンベルプルオーバー", "DUMBBELL"],
      ["バックエクステンション", "BODYWEIGHT"], ["アシストチンニング", "MACHINE"], ["懸垂", "BODYWEIGHT"], ["チンニング", "BODYWEIGHT"]
    ] },
    { bodyPart: "legs", entries: [
      ["スクワット", "BARBELL"], ["フロントスクワット", "BARBELL"], ["レッグプレス", "MACHINE"],
      ["レッグエクステンション", "MACHINE"], ["レッグカール", "MACHINE"], ["ヒップアダクション", "MACHINE"],
      ["ヒップアブダクション", "MACHINE"], ["カーフレイズ", "MACHINE"], ["グルートマシン", "MACHINE"],
      ["ルーマニアンデッドリフト", "BARBELL"], ["ブルガリアンスクワット", "BODYWEIGHT"], ["ダンベルスクワット", "DUMBBELL"],
      ["ダンベルランジ", "DUMBBELL"], ["ダンベルブルガリアンスクワット", "DUMBBELL"], ["ダンベルルーマニアンデッドリフト", "DUMBBELL"],
      ["自重スクワット", "BODYWEIGHT"], ["スクワット自重", "BODYWEIGHT"], ["ランジ", "BODYWEIGHT"],
      ["ヒップリフト", "BODYWEIGHT"], ["カーフレイズ自重", "BODYWEIGHT"]
    ] },
    { bodyPart: "abs", entries: [
      ["アブドミナル", "MACHINE"], ["ロータリートルソー", "MACHINE"], ["クランチ", "BODYWEIGHT"],
      ["シットアップ", "BODYWEIGHT"], ["レッグレイズ", "BODYWEIGHT"], ["プランク", "BODYWEIGHT"],
      ["サイドプランク", "BODYWEIGHT"], ["バイシクルクランチ", "BODYWEIGHT"], ["マウンテンクライマー", "BODYWEIGHT"],
      ["ロシアンツイスト", "BODYWEIGHT"]
    ] },
    { bodyPart: "cardio", entries: CARDIO_TYPES.map(function (name) { return [name, "CARDIO"]; }) },
    { bodyPart: "other", entries: [
      ["ストレッチ", "BODYWEIGHT"], ["ヨガ", "BODYWEIGHT"], ["フォームローラー", "BODYWEIGHT"],
      ["体幹トレーニング", "BODYWEIGHT"], ["その他トレーニング", "BODYWEIGHT"]
    ] }
  ];

  var $ = function (selector, root) { return (root || document).querySelector(selector); };
  var $$ = function (selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); };
  function normalizeUiSettings(candidate) {
    var settings = candidate && typeof candidate === "object" ? candidate : {};
    var appearance = APPEARANCE_OPTIONS.indexOf(settings.appearance) >= 0 ? settings.appearance : DEFAULT_UI_SETTINGS.appearance;
    var colorTheme = COLOR_THEME_OPTIONS.indexOf(settings.colorTheme) >= 0 ? settings.colorTheme : DEFAULT_UI_SETTINGS.colorTheme;
    return { appearance: appearance, colorTheme: colorTheme };
  }
  function loadUiSettings() {
    try {
      return normalizeUiSettings(JSON.parse(localStorage.getItem(UI_SETTINGS_KEY) || "null"));
    } catch (error) {
      console.error("Failed to load UI settings", error);
      return normalizeUiSettings(null);
    }
  }
  var uiSettings = loadUiSettings();
  function saveUiSettings(settings) {
    try {
      localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(normalizeUiSettings(settings)));
      return true;
    } catch (error) {
      console.error("Failed to save UI settings", error);
      showToast("外観設定を保存できませんでした");
      return false;
    }
  }
  function resolveAppearance(appearance) {
    if (appearance === "light" || appearance === "dark") return appearance;
    return systemColorSchemeQuery && systemColorSchemeQuery.matches ? "dark" : "light";
  }
  function updateThemeColorMeta(resolvedAppearance) {
    var meta = $("#themeColorMeta");
    if (!meta) return;
    var lightColors = { "urban-blue": "#F1F3F6", midnight: "#F4F6F9", "graphite-lime": "#EEF0F3" };
    var darkColors = { "urban-blue": "#0B0F14", midnight: "#070B12", "graphite-lime": "#0A0D10" };
    meta.setAttribute("content", resolvedAppearance === "dark" ? (darkColors[uiSettings.colorTheme] || "#0B0F14") : (lightColors[uiSettings.colorTheme] || "#F1F3F6"));
  }
  function renderAppearanceSettings() {
    var summary = $("#settingsAppearanceSummary");
    if (summary) summary.textContent = APPEARANCE_LABELS[uiSettings.appearance] + "・" + COLOR_THEME_LABELS[uiSettings.colorTheme];
    $$("[data-appearance-option]").forEach(function (button) {
      var isSelected = button.dataset.appearanceOption === uiSettings.appearance;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
    $$("[data-color-theme-option]").forEach(function (button) {
      var isSelected = button.dataset.colorThemeOption === uiSettings.colorTheme;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", isSelected ? "true" : "false");
    });
  }
  function applyUiSettings(settings) {
    uiSettings = normalizeUiSettings(settings);
    var resolvedAppearance = resolveAppearance(uiSettings.appearance);
    var root = document.documentElement;
    if (root && root.dataset) {
      root.dataset.appearance = resolvedAppearance;
      root.dataset.appearanceSetting = uiSettings.appearance;
      root.dataset.colorTheme = uiSettings.colorTheme;
    }
    updateThemeColorMeta(resolvedAppearance);
    renderAppearanceSettings();
  }
  function setAppearanceSetting(appearance) {
    applyUiSettings({ appearance: appearance, colorTheme: uiSettings.colorTheme });
    if (saveUiSettings(uiSettings)) showToast("外観を変更しました");
  }
  function setColorTheme(colorTheme) {
    applyUiSettings({ appearance: uiSettings.appearance, colorTheme: colorTheme });
    if (saveUiSettings(uiSettings)) showToast("テーマを変更しました");
  }
  function handleSystemAppearanceChange() {
    if (uiSettings.appearance === "system") applyUiSettings(uiSettings);
  }
  function bindSystemAppearanceListener() {
    if (!systemColorSchemeQuery || systemAppearanceListenerBound) return;
    systemAppearanceListenerBound = true;
    if (systemColorSchemeQuery.addEventListener) systemColorSchemeQuery.addEventListener("change", handleSystemAppearanceChange);
    else if (systemColorSchemeQuery.addListener) systemColorSchemeQuery.addListener(handleSystemAppearanceChange);
  }
  function on(selector, eventName, handler) {
    var element = $(selector);
    if (!element) {
      console.warn("Element not found:", selector);
      return null;
    }
    element.addEventListener(eventName, handler);
    return element;
  }
  var nowIso = function () { return new Date().toISOString(); };
  var makeId = function (prefix) {
    var random = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    return prefix + "_" + random;
  };
  var escapeHtml = function (value) {
    return String(value == null ? "" : value).replace(/[&<>'"]/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char];
    });
  };
  var numberValue = function (selector) {
    var value = parseFloat($(selector).value);
    return Number.isFinite(value) ? value : 0;
  };
  function getNumericInputValue(inputElement) {
    var value = parseFloat(inputElement.value);
    return Number.isFinite(value) ? value : 0;
  }
  function formatNumberForInput(value, step) {
    var precision = (String(step).split(".")[1] || "").length;
    var factor = Math.pow(10, precision);
    var rounded = Math.round(value * factor) / factor;
    return precision ? rounded.toFixed(precision) : String(Math.round(rounded));
  }
  function incrementInputValue(inputElement, step, min) {
    var current = getNumericInputValue(inputElement);
    var next = Math.max(min == null ? 0 : min, current + step);
    inputElement.value = formatNumberForInput(next, step);
  }
  function decrementInputValue(inputElement, step, min) {
    var current = getNumericInputValue(inputElement);
    var next = Math.max(min == null ? 0 : min, current - step);
    inputElement.value = formatNumberForInput(next, step);
  }
  var todayString = function () {
    var date = new Date();
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  };
  var dateFromString = function (value) {
    var parts = value.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  };
  var formatDateJa = function (value) {
    var date = dateFromString(value);
    var weekdays = ["日", "月", "火", "水", "木", "金", "土"];
    return date.getFullYear() + "年" + (date.getMonth() + 1) + "月" + date.getDate() + "日（" + weekdays[date.getDay()] + "）";
  };

  function exerciseCatalog() {
    var result = [];
    EXERCISE_CATALOG_GROUPS.forEach(function (group) {
      group.entries.forEach(function (entry) { result.push({ name: entry[0], category: entry[1], bodyPart: group.bodyPart }); });
    });
    return result;
  }

  function inferBodyPart(name, category) {
    if (category === "CARDIO") return "cardio";
    var catalogMatch = exerciseCatalog().find(function (item) { return item.name === name; });
    if (catalogMatch) return catalogMatch.bodyPart;
    var rules = [
      ["chest", ["チェスト", "ベンチ", "ダンベルプレス", "フライ", "腕立て", "ディップス", "ケーブルクロス"]],
      ["shoulder", ["ショルダー", "サイドレイズ", "フロントレイズ", "リアレイズ", "リアデルト", "アーノルド", "アップライト", "シュラッグ", "ラテラル"]],
      ["arm", ["カール", "トライセプス", "プレスダウン", "スカル", "キックバック", "フレンチ"]],
      ["back", ["ラット", "ロー", "ロウ", "デッドリフト", "チンニング", "懸垂", "バックエクステンション"]],
      ["legs", ["スクワット", "レッグ", "ヒップ", "カーフ", "ランジ", "ルーマニアン", "グルート"]],
      ["abs", ["アブドミナル", "クランチ", "シットアップ", "レッグレイズ", "プランク", "マウンテン", "ロシアン", "ロータリー", "体幹"]]
    ];
    for (var index = 0; index < rules.length; index += 1) {
      if (rules[index][1].some(function (keyword) { return name.indexOf(keyword) >= 0; })) return rules[index][0];
    }
    return "other";
  }

  var exerciseMigrationChanged = false;
  var dataMigrationChanged = false;
  var dataLoadWarning = "";
  var dataRecoveryRequired = false;
  var corruptDataRaw = null;
  var corruptDataKey = null;

  function cloneData(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function normalizeVersion2Data(source) {
    var normalized = cloneData(source || {});
    var arrays = ["exercises", "sessions", "records", "sets", "cardios", "recentExerciseIds", "routines", "scheduledRoutines"];
    arrays.forEach(function (key) { if (!Array.isArray(normalized[key])) normalized[key] = []; });
    normalized.profile = normalized.profile && typeof normalized.profile === "object" && !Array.isArray(normalized.profile) ? normalized.profile : null;
    normalized.exercises = normalized.exercises.filter(function (exercise) { return exercise && exercise.id && exercise.name && exercise.category; }).map(function (exercise) {
      exercise.bodyPart = exercise.bodyPart || inferBodyPart(exercise.name, exercise.category);
      exercise.defaultWeightStep = Number.isFinite(Number(exercise.defaultWeightStep)) ? Number(exercise.defaultWeightStep) : (WEIGHT_STEPS[exercise.category] || 0);
      exercise.isFavorite = !!exercise.isFavorite;
      return exercise;
    });
    var exerciseIds = {};
    normalized.exercises.forEach(function (exercise) { exerciseIds[exercise.id] = true; });
    normalized.sessions = normalized.sessions.filter(function (session) { return session && session.id && /^\d{4}-\d{2}-\d{2}$/.test(session.date || "") && (session.locationType === "gym" || session.locationType === "home"); });
    var sessionIds = {};
    normalized.sessions.forEach(function (session) { sessionIds[session.id] = true; });
    normalized.records = normalized.records.filter(function (record) { return record && record.id && sessionIds[record.sessionId] && exerciseIds[record.exerciseId]; });
    var recordsBySession = {};
    normalized.records.forEach(function (record) { (recordsBySession[record.sessionId] || (recordsBySession[record.sessionId] = [])).push(record); });
    Object.keys(recordsBySession).forEach(function (sessionId) {
      recordsBySession[sessionId].sort(function (a, b) { return Number(a.orderIndex || 0) - Number(b.orderIndex || 0); }).forEach(function (record, index) { record.orderIndex = index; });
    });
    var recordIds = {};
    normalized.records.forEach(function (record) { recordIds[record.id] = true; });
    normalized.sets = normalized.sets.filter(function (set) { return set && set.id && recordIds[set.recordId] && Number.isFinite(Number(set.weight)) && Number.isFinite(Number(set.reps)); });
    var setsByRecord = {};
    normalized.sets.forEach(function (set) { (setsByRecord[set.recordId] || (setsByRecord[set.recordId] = [])).push(set); });
    Object.keys(setsByRecord).forEach(function (recordId) {
      setsByRecord[recordId].sort(function (a, b) { return Number(a.setNumber || 0) - Number(b.setNumber || 0); }).forEach(function (set, index) {
        set.setNumber = index + 1;
        set.weight = Math.max(0, Number(set.weight || 0));
        set.reps = Math.max(0, Number(set.reps || 0));
        set.rir = set.rir == null ? "" : set.rir;
        set.restSeconds = Math.max(0, Number(set.restSeconds || 90));
        set.memo = set.memo || "";
      });
    });
    var recordSequence = {};
    normalized.records.forEach(function (record, index) { recordSequence[record.id] = index; });
    normalized.sets.sort(function (a, b) {
      var recordDifference = recordSequence[a.recordId] - recordSequence[b.recordId];
      return recordDifference || Number(a.setNumber) - Number(b.setNumber);
    });
    normalized.cardios = normalized.cardios.filter(function (cardio) { return cardio && cardio.id && sessionIds[cardio.sessionId] && cardio.type; }).map(function (cardio) {
      cardio.distanceKm = Math.max(0, Number(cardio.distanceKm || 0));
      cardio.durationMinutes = Math.max(0, Number(cardio.durationMinutes || 0));
      cardio.inclinePercent = Math.max(0, Number(cardio.inclinePercent || 0));
      cardio.memo = cardio.memo || "";
      return cardio;
    });
    var exerciseByName = {};
    normalized.exercises.forEach(function (exercise) { exerciseByName[exercise.name] = exercise.id; });
    normalized.routines = normalized.routines.filter(function (routine) { return routine && routine.id; }).map(function (routine) {
      var entries = Array.isArray(routine.exercises) ? routine.exercises : [];
      if (!entries.length && Array.isArray(routine.records)) entries = routine.records.map(function (record) { return { exerciseId: record.exerciseId }; });
      if (Array.isArray(routine.cardios)) routine.cardios.forEach(function (cardio) { if (exerciseByName[cardio.type]) entries.push({ exerciseId: exerciseByName[cardio.type] }); });
      var used = {};
      routine.exercises = entries.map(function (entry) { return typeof entry === "string" ? entry : entry && entry.exerciseId; }).filter(function (exerciseId) {
        if (!exerciseIds[exerciseId] || used[exerciseId]) return false;
        used[exerciseId] = true;
        return true;
      }).map(function (exerciseId, index) { return { exerciseId: exerciseId, orderIndex: index }; });
      delete routine.records;
      delete routine.cardios;
      routine.locationType = routine.locationType === "home" ? "home" : "gym";
      routine.name = routine.name || "ルーティーン";
      return routine;
    });
    var routineIds = {};
    normalized.routines.forEach(function (routine) { routineIds[routine.id] = true; });
    normalized.scheduledRoutines = normalized.scheduledRoutines.filter(function (schedule) { return schedule && schedule.id && routineIds[schedule.routineId] && /^\d{4}-\d{2}-\d{2}$/.test(schedule.date || ""); });
    normalized.recentExerciseIds = normalized.recentExerciseIds.filter(function (id, index, ids) { return exerciseIds[id] && ids.indexOf(id) === index; });
    normalized.version = CURRENT_DATA_VERSION;
    delete normalized.exportedAt;
    return normalized;
  }

  function migrateVersion1To2(source) { return normalizeVersion2Data(source); }

  function migrateDataToCurrentVersion(source) {
    var migrated = cloneData(source);
    var version = Number(migrated.version || 1);
    if (version > CURRENT_DATA_VERSION || version < 1) throw new Error("Unsupported data version");
    while (version < CURRENT_DATA_VERSION) {
      if (version === 1) {
        migrated = migrateVersion1To2(migrated);
        version = 2;
      } else throw new Error("Unsupported data version");
    }
    return normalizeVersion2Data(migrated);
  }

  function validateCurrentData(candidate) {
    if (!candidate || Number(candidate.version) !== CURRENT_DATA_VERSION) return false;
    var keys = ["exercises", "sessions", "records", "sets", "cardios", "recentExerciseIds", "routines", "scheduledRoutines"];
    if (!keys.every(function (key) { return Array.isArray(candidate[key]); })) return false;
    var exerciseIds = {}, sessionIds = {}, recordIds = {};
    candidate.exercises.forEach(function (exercise) { if (exercise && exercise.id) exerciseIds[exercise.id] = true; });
    candidate.sessions.forEach(function (session) { if (session && session.id) sessionIds[session.id] = true; });
    candidate.records.forEach(function (record) { if (record && record.id) recordIds[record.id] = true; });
    return candidate.records.every(function (record) { return sessionIds[record.sessionId] && exerciseIds[record.exerciseId]; }) && candidate.sets.every(function (set) { return recordIds[set.recordId]; }) && candidate.cardios.every(function (cardio) { return sessionIds[cardio.sessionId]; });
  }

  function isPlausibleDataRoot(candidate) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
    var knownKeys = ["profile", "exercises", "sessions", "records", "sets", "cardios", "recentExerciseIds", "routines", "scheduledRoutines"];
    return knownKeys.some(function (key) { return Object.prototype.hasOwnProperty.call(candidate, key); });
  }

  function corruptStorageTimestamp() {
    var date = new Date();
    return date.getFullYear() + String(date.getMonth() + 1).padStart(2, "0") + String(date.getDate()).padStart(2, "0") + "-" + String(date.getHours()).padStart(2, "0") + String(date.getMinutes()).padStart(2, "0") + String(date.getSeconds()).padStart(2, "0");
  }

  function quarantineCorruptData(raw) {
    corruptDataRaw = raw;
    corruptDataKey = "gymlog-data-corrupt-" + corruptStorageTimestamp();
    try { localStorage.setItem(corruptDataKey, raw); }
    catch (error) { console.error("Failed to quarantine corrupt data", error); }
  }

  function migrateExercises(exercises) {
    var result = Array.isArray(exercises) ? exercises : [];
    var catalog = exerciseCatalog();
    var names = {};
    result.forEach(function (exercise) {
      names[exercise.name] = true;
      if (!exercise.bodyPart) {
        exercise.bodyPart = inferBodyPart(exercise.name, exercise.category);
        exercise.updatedAt = nowIso();
        exerciseMigrationChanged = true;
      }
    });
    catalog.forEach(function (item) {
      if (names[item.name]) return;
      var stamp = nowIso();
      result.push({ id: makeId("ex"), name: item.name, category: item.category, bodyPart: item.bodyPart, defaultWeightStep: WEIGHT_STEPS[item.category] || 0, isFavorite: false, createdAt: stamp, updatedAt: stamp });
      names[item.name] = true;
      exerciseMigrationChanged = true;
    });
    return result;
  }

  function seedExercises() {
    var stamp = nowIso();
    return exerciseCatalog().map(function (item) {
      return { id: makeId("ex"), name: item.name, category: item.category, bodyPart: item.bodyPart, defaultWeightStep: WEIGHT_STEPS[item.category] || 0, isFavorite: false, createdAt: stamp, updatedAt: stamp };
    });
  }

  function blankData() {
    return { version: CURRENT_DATA_VERSION, profile: null, exercises: seedExercises(), sessions: [], records: [], sets: [], cardios: [], recentExerciseIds: [], routines: [], scheduledRoutines: [] };
  }

  function loadData() {
    var saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return blankData();
      var parsed = JSON.parse(saved);
      if (!isPlausibleDataRoot(parsed)) throw new Error("Invalid root data");
      var originalVersion = Number(parsed.version || 1);
      var migrated = migrateDataToCurrentVersion(parsed);
      if (!validateCurrentData(migrated)) throw new Error("Invalid migrated data");
      migrated.exercises = migrateExercises(migrated.exercises);
      if (!validateCurrentData(migrated)) throw new Error("Invalid catalog data");
      if (originalVersion !== CURRENT_DATA_VERSION) dataMigrationChanged = true;
      return migrated;
    } catch (error) {
      console.error("Failed to load saved data", error);
      if (saved) {
        quarantineCorruptData(saved);
        dataRecoveryRequired = true;
      }
      dataLoadWarning = "保存データを正常に読み込めませんでした";
      return blankData();
    }
  }

  var data = loadData();
  var dataIndexes = null;

  /* In-memory data access indexes; localStorage data remains the source of truth. */
  function rebuildDataIndexes() {
    try {
      var indexes = {
        sessionsByDate: Object.create(null), sessionById: Object.create(null),
        recordsBySessionId: Object.create(null), recordById: Object.create(null), recordsByExerciseId: Object.create(null),
        setsByRecordId: Object.create(null), cardiosBySessionId: Object.create(null),
        routineById: Object.create(null), scheduledRoutinesByDate: Object.create(null), exerciseById: Object.create(null)
      };
      data.exercises.forEach(function (exercise) { indexes.exerciseById[exercise.id] = exercise; });
      data.sessions.forEach(function (session) {
        indexes.sessionById[session.id] = session;
        (indexes.sessionsByDate[session.date] || (indexes.sessionsByDate[session.date] = [])).push(session);
      });
      Object.keys(indexes.sessionsByDate).forEach(function (date) {
        indexes.sessionsByDate[date].sort(function (a, b) { return String(b.createdAt || b.updatedAt || "").localeCompare(String(a.createdAt || a.updatedAt || "")); });
      });
      data.records.forEach(function (record) {
        indexes.recordById[record.id] = record;
        (indexes.recordsBySessionId[record.sessionId] || (indexes.recordsBySessionId[record.sessionId] = [])).push(record);
        (indexes.recordsByExerciseId[record.exerciseId] || (indexes.recordsByExerciseId[record.exerciseId] = [])).push(record);
      });
      Object.keys(indexes.recordsBySessionId).forEach(function (sessionId) {
        indexes.recordsBySessionId[sessionId].sort(function (a, b) { return Number(a.orderIndex || 0) - Number(b.orderIndex || 0); });
      });
      data.sets.forEach(function (set) { (indexes.setsByRecordId[set.recordId] || (indexes.setsByRecordId[set.recordId] = [])).push(set); });
      Object.keys(indexes.setsByRecordId).forEach(function (recordId) {
        indexes.setsByRecordId[recordId].sort(function (a, b) { return Number(a.setNumber || 0) - Number(b.setNumber || 0); });
      });
      data.cardios.forEach(function (cardio) { (indexes.cardiosBySessionId[cardio.sessionId] || (indexes.cardiosBySessionId[cardio.sessionId] = [])).push(cardio); });
      data.routines.forEach(function (routine) { indexes.routineById[routine.id] = routine; });
      data.scheduledRoutines.forEach(function (schedule) { (indexes.scheduledRoutinesByDate[schedule.date] || (indexes.scheduledRoutinesByDate[schedule.date] = [])).push(schedule); });
      dataIndexes = indexes;
      return true;
    } catch (error) {
      console.error("Failed to build data indexes", error);
      dataIndexes = null;
      return false;
    }
  }

  rebuildDataIndexes();
  var calendarCursor = new Date();
  calendarCursor.setDate(1);
  var draft = null;
  var selectedExerciseId = null;
  var selectedRir = null;
  var selectedRest = 90;
  var editingSetTempId = null;
  var isAddingSet = false;
  var editingCardioTempId = null;
  var pendingExerciseId = null;
  var activeExerciseBodyPart = "chest";
  var exercisePickerMode = "workout";
  var progressState = { tab: "strength", exerciseId: null, cardioType: "ウォーキング", metric: "maxWeight", range: "6m" };
  var toastTimer = null;
  var confirmCallback = null;
  var confirmCancelCallback = null;
  var copySourceSessionId = null;
  var routineEditingId = null;
  var routineEditorState = null;
  var routinePendingExerciseIds = [];
  var routineTargetDate = null;
  var routineListMode = "use";
  var pendingRestoreData = null;
  var pendingCopyConflict = null;
  var pendingSaveConflict = null;
  var pendingSavedDraft = null;
  var draftSaveTimer = null;
  var nextSetExerciseId = null;

  function writeDataToStorage() {
    if (dataRecoveryRequired) {
      console.warn("Persist blocked while data recovery is required");
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error("Failed to save data", error);
      showToast("保存できませんでした。ブラウザの保存設定を確認してください");
      return false;
    }
  }

  function persist() {
    rebuildDataIndexes();
    return writeDataToStorage();
  }

  function runDataTransaction(mutator) {
    var beforeData = cloneData(data);
    try {
      mutator(data);
      rebuildDataIndexes();
      if (!writeDataToStorage()) throw new Error("persist failed");
      return true;
    } catch (error) {
      console.error("Transaction failed", error);
      data = beforeData;
      rebuildDataIndexes();
      showToast("保存できませんでした");
      return false;
    }
  }

  function runButtonLocked(button, action) {
    if (!button || button.disabled) return;
    button.disabled = true;
    try { action(); }
    catch (error) {
      console.error("Conflict action failed", error);
      showToast("保存処理に失敗しました");
    }
    finally { button.disabled = false; }
  }

  function backupPayload() {
    var payload = JSON.parse(JSON.stringify(data));
    payload.exportedAt = nowIso();
    return payload;
  }

  function downloadBackupData(prefix) {
    try {
      var blob = new Blob([JSON.stringify(backupPayload(), null, 2)], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = (prefix || "gymlog-backup") + "-" + todayString() + ".json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 0);
      return true;
    } catch (error) {
      console.error("Failed to create backup", error);
      showToast("バックアップを保存できませんでした");
      return false;
    }
  }

  function validateBackupData(candidate) {
    try {
      if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
      var version = Number(candidate.version || 1);
      if (!Number.isFinite(version) || version < 1 || version > CURRENT_DATA_VERSION) return false;
      var requiredArrays = ["exercises", "sessions", "records", "sets", "cardios"];
      if (!requiredArrays.every(function (key) { return Array.isArray(candidate[key]); })) return false;
      return validateCurrentData(migrateDataToCurrentVersion(candidate));
    }
    catch (error) { console.error("Backup validation failed", error); return false; }
  }

  function normalizeBackupData(candidate) {
    var restored = migrateDataToCurrentVersion(candidate);
    restored.exercises = migrateExercises(restored.exercises);
    if (!validateCurrentData(restored)) throw new Error("Invalid backup data");
    return restored;
  }

  function savePreRestoreSnapshot() {
    try {
      localStorage.setItem(PRE_RESTORE_STORAGE_KEY, JSON.stringify({ savedAt: nowIso(), data: cloneData(data) }));
      return true;
    } catch (error) {
      console.error("Failed to save pre-restore snapshot", error);
      return false;
    }
  }

  function applyPendingRestore(skipSnapshot) {
    if (!pendingRestoreData) return;
    if (skipSnapshot !== true && !savePreRestoreSnapshot()) {
      askConfirm("現在のデータを退避できませんでした。バックアップなしで復元を続けると、現在の記録を元に戻せない可能性があります。", "バックアップなしで続ける", function () { applyPendingRestore(true); }, "復元を中止", function () { pendingRestoreData = null; });
      return;
    }
    downloadBackupData("gymlog-before-restore");
    var restored = cloneData(pendingRestoreData);
    var recoveryWasRequired = dataRecoveryRequired;
    dataRecoveryRequired = false;
    if (!runDataTransaction(function () { data = restored; })) { dataRecoveryRequired = recoveryWasRequired; return; }
    pendingRestoreData = null;
    draft = null;
    clearSavedDraft();
    calendarCursor = new Date();
    calendarCursor.setDate(1);
    renderHome();
    renderRoutineList();
    closeModal("settingsMenuModal");
    closeModal("dataRecoveryModal");
    showScreen("home");
    showToast("バックアップから復元しました");
  }

  function readBackupFile(file) {
    if (!file) return;
    pendingRestoreData = null;
    var input = $("#restoreDataInput");
    if (input) input.disabled = true;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var parsed = JSON.parse(String(reader.result || ""));
        if (!validateBackupData(parsed)) throw new Error("invalid");
        pendingRestoreData = normalizeBackupData(parsed);
        askConfirm("バックアップからデータを復元します。現在のデータは上書きされます。", "復元する", applyPendingRestore, "キャンセル", function () { pendingRestoreData = null; });
      } catch (error) {
        console.error("Failed to read backup", error);
        pendingRestoreData = null;
        showToast("このバックアップファイルは読み込めません");
      } finally {
        if (input) input.disabled = false;
      }
    };
    reader.onerror = function (error) {
      console.error("Failed to read backup file", error);
      pendingRestoreData = null;
      if (input) input.disabled = false;
      showToast("バックアップファイルを読み込めませんでした");
    };
    reader.readAsText(file, "UTF-8");
  }

  function restorePreRestoreSnapshot() {
    try {
      var saved = localStorage.getItem(PRE_RESTORE_STORAGE_KEY);
      if (!saved) { showToast("復元前データはありません"); return; }
      var parsed = JSON.parse(saved);
      pendingRestoreData = normalizeBackupData(parsed.data);
      askConfirm("直前の復元前データに戻します。現在のデータは上書きされます。", "元に戻す", applyPendingRestore, "キャンセル", function () { pendingRestoreData = null; });
    } catch (error) {
      console.error("Failed to restore snapshot", error);
      pendingRestoreData = null;
      showToast("復元前データを読み込めませんでした");
    }
  }

  function downloadCorruptData() {
    if (!corruptDataRaw) { showToast("書き出せる破損データはありません"); return; }
    try {
      var blob = new Blob([corruptDataRaw], { type: "application/json" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = (corruptDataKey || "gymlog-corrupt-data") + ".json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    } catch (error) { console.error("Failed to export corrupt data", error); showToast("破損データを書き出せませんでした"); }
  }

  function startWithFreshData() {
    var previousData = data;
    data = blankData();
    dataRecoveryRequired = false;
    if (!persist()) { data = previousData; dataRecoveryRequired = true; rebuildDataIndexes(); return; }
    clearSavedDraft();
    closeModal("dataRecoveryModal");
    renderHome();
    showScreen("home");
    showToast("新しいデータで開始しました");
  }

  function draftStoragePayload() {
    var editorState = captureEditorState();
    return {
      draft: draft,
      selectedExerciseId: selectedExerciseId,
      editingSetTempId: editingSetTempId,
      isAddingSet: isAddingSet,
      editingCardioTempId: editingCardioTempId,
      selectedRir: selectedRir,
      selectedRest: selectedRest,
      editorState: editorState,
      savedAt: nowIso()
    };
  }

  function editorInputValue(selector) {
    var element = $(selector);
    return element ? String(element.value == null ? "" : element.value) : "";
  }

  function captureEditorState() {
    var exercise = getExercise(selectedExerciseId);
    var mode = "none";
    if (exercise && exercise.category === "CARDIO") mode = "cardio";
    else if (editingSetTempId) mode = "editSet";
    else if (isAddingSet && selectedExerciseId) mode = "addSet";
    return {
      mode: mode,
      exerciseId: selectedExerciseId,
      editingSetTempId: editingSetTempId,
      editingCardioTempId: editingCardioTempId,
      weightKg: editorInputValue("#weightInput"),
      reps: editorInputValue("#repsInput"),
      rir: selectedRir,
      restSeconds: Number(selectedRest || 90),
      setMemo: editorInputValue("#setMemo"),
      cardioType: editorInputValue("#cardioType"),
      durationMinutes: editorInputValue("#cardioDuration"),
      distanceKm: editorInputValue("#cardioDistance"),
      inclinePercent: editorInputValue("#cardioIncline"),
      cardioMemo: editorInputValue("#cardioMemo")
    };
  }

  function hasMeaningfulDraftContent(draftValue, editorState) {
    if (!draftValue) return false;
    if ((draftValue.records || []).length) return true;
    if ((draftValue.cardios || []).length) return true;
    if ((draftValue.pendingCardioTypes || []).length) return true;
    if (String(draftValue.memo || "").trim()) return true;
    if (!editorState || editorState.mode === "none") return false;
    if (editorState.mode === "cardio") {
      return !!(String(editorState.durationMinutes || "").trim() || String(editorState.distanceKm || "").trim() || String(editorState.inclinePercent || "").trim() || String(editorState.cardioMemo || "").trim());
    }
    return !!(
      String(editorState.weightKg || "").trim() ||
      String(editorState.reps || "").trim() ||
      String(editorState.setMemo || "").trim() ||
      editorState.rir !== null ||
      Number(editorState.restSeconds || 90) !== 90
    );
  }

  function saveDraftNow() {
    clearTimeout(draftSaveTimer);
    draftSaveTimer = null;
    if (!draft) return false;
    try {
      var payload = draftStoragePayload();
      if (!hasMeaningfulDraftContent(draft, payload.editorState)) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        return false;
      }
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
      return true;
    } catch (error) {
      console.error("Failed to save draft", error);
      showToast("入力途中の内容を自動保存できませんでした");
      return false;
    }
  }

  function scheduleDraftSave() {
    clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(saveDraftNow, 400);
  }

  function clearSavedDraft() {
    clearTimeout(draftSaveTimer);
    draftSaveTimer = null;
    try { localStorage.removeItem(DRAFT_STORAGE_KEY); }
    catch (error) { console.error("Failed to clear saved draft", error); }
    pendingSavedDraft = null;
  }

  function loadSavedDraft() {
    try {
      var saved = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!saved) return null;
      var parsed = JSON.parse(saved);
      if (!parsed || !parsed.draft || !Array.isArray(parsed.draft.records) || !Array.isArray(parsed.draft.cardios)) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        return null;
      }
      if (!hasMeaningfulDraftContent(parsed.draft, parsed.editorState || { mode: "none" })) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch (error) {
      console.error("Failed to load draft", error);
      try { localStorage.removeItem(DRAFT_STORAGE_KEY); }
      catch (removeError) { console.error("Failed to remove invalid draft", removeError); }
      return null;
    }
  }

  function showSavedDraftPrompt(savedState) {
    if (!savedState || !savedState.draft) return;
    pendingSavedDraft = savedState;
    var savedDraft = savedState.draft;
    var setCount = savedDraft.records.reduce(function (sum, record) { return sum + (Array.isArray(record.sets) ? record.sets.length : 0); }, 0);
    var exerciseCount = savedDraft.records.length + savedDraft.cardios.length + (savedDraft.pendingCardioTypes || []).length;
    var locationLabel = savedDraft.locationType === "home" ? "自宅トレーニング" : "ジムトレーニング";
    $("#draftResumeSummary").textContent = formatDateJa(savedDraft.date) + "\n" + locationLabel + "\n" + exerciseCount + "種目・" + setCount + "セット";
    openModal("draftResumeModal");
  }

  function resumeSavedDraft() {
    if (!pendingSavedDraft || !pendingSavedDraft.draft) return;
    var savedState = pendingSavedDraft;
    var editorState = savedState.editorState || { mode: "none" };
    draft = savedState.draft;
    if (!Object.prototype.hasOwnProperty.call(draft, "originalSessionId")) {
      draft.originalSessionId = draft.id || null;
    }
    resetCardioForm();
    selectedExerciseId = null;
    editingSetTempId = null;
    isAddingSet = false;
    editingCardioTempId = null;
    selectedRir = null;
    selectedRest = 90;
    if (editorState.mode === "addSet" && getExercise(editorState.exerciseId)) {
      selectedExerciseId = editorState.exerciseId;
      isAddingSet = true;
    } else if (editorState.mode === "editSet" && findDraftSet(editorState.editingSetTempId)) {
      selectedExerciseId = editorState.exerciseId;
      editingSetTempId = editorState.editingSetTempId;
    } else if (editorState.mode === "cardio") {
      var cardioExercise = getExercise(editorState.exerciseId) || data.exercises.find(function (exercise) { return exercise.category === "CARDIO" && exercise.name === editorState.cardioType; });
      if (cardioExercise) selectedExerciseId = cardioExercise.id;
      if ((draft.cardios || []).some(function (cardio) { return cardio.tempId === editorState.editingCardioTempId; })) editingCardioTempId = editorState.editingCardioTempId;
    }
    selectedRir = editorState.rir == null ? null : editorState.rir;
    selectedRest = Number(editorState.restSeconds || 90);
    pendingSavedDraft = null;
    renderWorkout();
    if (editorState.mode === "addSet" || editorState.mode === "editSet") {
      $("#weightInput").value = editorState.weightKg;
      $("#repsInput").value = editorState.reps;
      $("#setMemo").value = editorState.setMemo || "";
      selectedRir = editorState.rir == null ? null : editorState.rir;
      selectedRest = Number(editorState.restSeconds || 90);
      renderSetChoices();
    } else if (editorState.mode === "cardio" && selectedExerciseId) {
      $("#cardioType").value = editorState.cardioType || getExercise(selectedExerciseId).name;
      $("#cardioDuration").value = editorState.durationMinutes;
      $("#cardioDistance").value = editorState.distanceKm;
      $("#cardioIncline").value = editorState.inclinePercent;
      $("#cardioMemo").value = editorState.cardioMemo || "";
      updateCardioPreview();
    }
    closeModal("draftResumeModal");
    showScreen("workout");
    saveDraftNow();
  }

  function discardSavedDraft() {
    clearSavedDraft();
    closeModal("draftResumeModal");
    showToast("保存途中の内容を破棄しました");
  }

  function showToast(message) {
    var toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-visible"); }, 2400);
  }

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

  function askConfirm(message, actionLabel, callback, cancelLabel, cancelCallback) {
    $("#confirmMessage").textContent = message;
    $("#confirmAccept").textContent = actionLabel || "削除する";
    $("#confirmCancel").textContent = cancelLabel || "キャンセル";
    confirmCallback = callback;
    confirmCancelCallback = cancelCallback || null;
    openModal("confirmModal");
  }

  function cancelConfirmModal() {
    var callback = confirmCancelCallback;
    confirmCallback = null;
    confirmCancelCallback = null;
    closeModal("confirmModal");
    if (callback) callback();
  }

  function acceptConfirmModal(button) {
    runButtonLocked(button, function () {
      var callback = confirmCallback;
      confirmCallback = null;
      confirmCancelCallback = null;
      closeModal("confirmModal");
      if (callback) callback();
    });
  }

  function getExercise(id) {
    if (dataIndexes && dataIndexes.exerciseById[id]) return dataIndexes.exerciseById[id];
    return data.exercises.find(function (exercise) { return exercise.id === id; });
  }
  function getSession(id) {
    if (dataIndexes && dataIndexes.sessionById[id]) return dataIndexes.sessionById[id];
    return data.sessions.find(function (session) { return session.id === id; });
  }
  function getRoutine(id) {
    if (dataIndexes && dataIndexes.routineById[id]) return dataIndexes.routineById[id];
    return data.routines.find(function (routine) { return routine.id === id; });
  }
  function getSessionRecords(sessionId) {
    if (dataIndexes) return (dataIndexes.recordsBySessionId[sessionId] || []).slice();
    return data.records.filter(function (record) { return record.sessionId === sessionId; }).sort(function (a, b) { return a.orderIndex - b.orderIndex; });
  }
  function getRecordSets(recordId) {
    if (dataIndexes) return (dataIndexes.setsByRecordId[recordId] || []).slice();
    return data.sets.filter(function (set) { return set.recordId === recordId; }).sort(function (a, b) { return a.setNumber - b.setNumber; });
  }
  function getSessionCardios(sessionId) {
    if (dataIndexes) return (dataIndexes.cardiosBySessionId[sessionId] || []).slice();
    return data.cardios.filter(function (cardio) { return cardio.sessionId === sessionId; });
  }
  function profileWeight() { return data.profile && Number(data.profile.weightKg) > 0 ? Number(data.profile.weightKg) : 60; }

  /* Training calculations */
  function calculateStrengthCalories(sets) {
    if (!sets.length) return 0;
    var weight = profileWeight();
    return sets.reduce(function (total, set, index) {
      var activeSeconds = Number(set.reps || 0) * 4;
      var restSeconds = index === sets.length - 1 ? 0 : Number(set.restSeconds || 0);
      var mets = RIR_METS[set.rir == null ? "" : set.rir] || 5;
      return total + mets * 3.5 * weight / 200 * ((activeSeconds + restSeconds) / 60);
    }, 0);
  }

  function calculateStrengthCaloriesForRecords(records) {
    return (records || []).reduce(function (total, record) {
      var sets = Array.isArray(record.sets) ? record.sets : getRecordSets(record.id);
      return total + calculateStrengthCalories(sets);
    }, 0);
  }

  function calculateSessionCalories(sessionId) {
    var strength = calculateStrengthCaloriesForRecords(getSessionRecords(sessionId));
    var cardio = getSessionCardios(sessionId).reduce(function (sum, item) {
      var saved = Number(item.calories);
      return sum + (item.calories !== null && item.calories !== undefined && item.calories !== "" && Number.isFinite(saved) ? saved : calculateCardio(item).calories);
    }, 0);
    return strength + cardio;
  }

  function calculateCardio(cardio) {
    var duration = Number(cardio.durationMinutes || 0);
    var distance = Number(cardio.distanceKm || 0);
    var incline = Number(cardio.inclinePercent || 0);
    var speed = duration > 0 && distance > 0 ? distance / (duration / 60) : 0;
    var mets;
    if (speed > 0) {
      var speedMMin = speed * 1000 / 60;
      var grade = incline / 100;
      var vo2 = speed < 8 ? (0.1 * speedMMin + 1.8 * speedMMin * grade + 3.5) : (0.2 * speedMMin + 0.9 * speedMMin * grade + 3.5);
      mets = Math.max(1, vo2 / 3.5);
    } else {
      mets = CARDIO_METS[cardio.type] || 5;
    }
    return { speedKmh: speed, calories: mets * 3.5 * profileWeight() / 200 * duration };
  }

  function draftCalories() {
    if (!draft) return 0;
    var cardioCalories = draft.cardios.reduce(function (sum, cardio) { return sum + calculateCardio(cardio).calories; }, 0);
    return calculateStrengthCaloriesForRecords(draft.records) + cardioCalories;
  }

  function getMonthlySummary(year, month) {
    var prefix = year + "-" + String(month + 1).padStart(2, "0");
    var monthSessions = dataIndexes ? Object.keys(dataIndexes.sessionsByDate).filter(function (date) { return date.indexOf(prefix) === 0; }).reduce(function (items, date) {
      return items.concat(dataIndexes.sessionsByDate[date]);
    }, []) : data.sessions.filter(function (session) { return session.date.indexOf(prefix) === 0; });
    var sessionIds = {};
    monthSessions.forEach(function (session) { sessionIds[session.id] = true; });
    var strengthCalories = 0;
    var cardioCalories = 0;
    var upperBodyVolumeKg = 0;
    var lowerBodyVolumeKg = 0;
    var cardioDistanceKm = 0;
    var upperBodyParts = { chest: true, shoulder: true, arm: true, back: true, abs: true };

    data.records.forEach(function (record) {
      if (!sessionIds[record.sessionId]) return;
      var sets = getRecordSets(record.id);
      strengthCalories += calculateStrengthCaloriesForRecords([record]);
      var exercise = getExercise(record.exerciseId);
      if (!exercise || (!upperBodyParts[exercise.bodyPart] && exercise.bodyPart !== "legs")) return;
      var volumeKg = sets.reduce(function (sum, set) {
        return sum + Number(set.weight || 0) / 1000 * Number(set.reps || 0);
      }, 0);
      if (upperBodyParts[exercise.bodyPart]) upperBodyVolumeKg += volumeKg;
      else lowerBodyVolumeKg += volumeKg;
    });

    data.cardios.forEach(function (cardio) {
      if (!sessionIds[cardio.sessionId]) return;
      var savedCalories = Number(cardio.calories);
      var hasSavedCalories = cardio.calories !== null && cardio.calories !== undefined && cardio.calories !== "" && Number.isFinite(savedCalories);
      cardioCalories += hasSavedCalories ? savedCalories : calculateCardio(cardio).calories;
      cardioDistanceKm += Math.max(0, Number(cardio.distanceKm || 0));
    });

    return {
      workoutDays: Object.keys(monthSessions.reduce(function (dates, session) { dates[session.date] = true; return dates; }, {})).length,
      gymVisits: monthSessions.filter(function (session) { return session.locationType === "gym"; }).length,
      homeVisits: monthSessions.filter(function (session) { return session.locationType === "home"; }).length,
      totalCalories: strengthCalories + cardioCalories,
      strengthCalories: strengthCalories,
      cardioCalories: cardioCalories,
      totalStrengthVolumeKg: upperBodyVolumeKg + lowerBodyVolumeKg,
      upperBodyVolumeKg: upperBodyVolumeKg,
      lowerBodyVolumeKg: lowerBodyVolumeKg,
      cardioDistanceKm: cardioDistanceKm
    };
  }

  function renderMonthlySummary() {
    var year = calendarCursor.getFullYear();
    var month = calendarCursor.getMonth();
    var summary = getMonthlySummary(year, month);
    var monthLabel = (month + 1) + "月";
    var formatVolume = function (value) {
      return Number(value || 0).toLocaleString("ja-JP", { maximumFractionDigits: 1 });
    };
    $("#monthlyVisits").textContent = summary.workoutDays;
    $("#monthlyGymVisits").textContent = summary.gymVisits;
    $("#monthlyHomeVisits").textContent = summary.homeVisits;
    $("#monthlyCalories").textContent = Math.round(summary.totalCalories).toLocaleString("ja-JP");
    $("#monthlyStrengthCalories").textContent = Math.round(summary.strengthCalories).toLocaleString("ja-JP");
    $("#monthlyCardioCalories").textContent = Math.round(summary.cardioCalories).toLocaleString("ja-JP");
    $("#monthlyTotalVolume").textContent = formatVolume(summary.totalStrengthVolumeKg);
    $("#monthlyUpperVolume").textContent = formatVolume(summary.upperBodyVolumeKg);
    $("#monthlyLowerVolume").textContent = formatVolume(summary.lowerBodyVolumeKg);
    $("#monthlyCardioDistance").textContent = summary.cardioDistanceKm.toFixed(1);
    var summaryMonth = $("#monthlySummaryMonth");
    if (summaryMonth) summaryMonth.textContent = year + "年" + monthLabel;
    $("#monthlySummaryLabel").textContent = "運動";
    $("#monthlyCaloriesLabel").textContent = "カロリー";
    $("#monthlyVolumeLabel").textContent = "ボリューム";
  }

  function renderHome() {
    renderMonthlySummary();
    renderCalendar();
  }

  function getSessionsForDate(dateValue) {
    if (dataIndexes) return (dataIndexes.sessionsByDate[dateValue] || []).slice();
    return data.sessions.filter(function (session) { return session.date === dateValue; }).sort(function (a, b) {
      return String(b.createdAt || b.updatedAt || "").localeCompare(String(a.createdAt || a.updatedAt || ""));
    });
  }

  function cardioExerciseId(type) {
    var normalizedType = type === "傾斜ウォーク" ? "ウォーキング" : type;
    var exercise = data.exercises.find(function (item) { return item.category === "CARDIO" && item.name === normalizedType; });
    return exercise ? exercise.id : "";
  }

  function copyLatestPastMenu() {
    var latest = data.sessions.filter(function (session) { return session.date < todayString(); }).sort(function (a, b) {
      var dateOrder = String(b.date || "").localeCompare(String(a.date || ""));
      if (dateOrder) return dateOrder;
      return String(b.createdAt || b.updatedAt || "").localeCompare(String(a.createdAt || a.updatedAt || ""));
    })[0];
    if (!latest) { showToast("コピーできる過去メニューがありません"); return; }
    openCopyDestination(latest.id);
  }

  /* Routine management */
  function routineExerciseEntries(routine) {
    if (Array.isArray(routine.exercises)) {
      return routine.exercises.slice().sort(function (a, b) { return Number(a.orderIndex || 0) - Number(b.orderIndex || 0); });
    }
    var entries = (routine.records || []).map(function (record, index) {
      return { exerciseId: record.exerciseId, orderIndex: Number.isFinite(Number(record.orderIndex)) ? Number(record.orderIndex) : index };
    });
    (routine.cardios || []).forEach(function (cardio) {
      var exerciseId = cardioExerciseId(cardio.type);
      if (exerciseId) entries.push({ exerciseId: exerciseId, orderIndex: entries.length });
    });
    return entries;
  }

  function routineItemCount(routine) {
    return routineExerciseEntries(routine).length;
  }

  function routineExerciseIdsFromDraft() {
    if (!draft) return [];
    var ids = draft.records.slice().sort(function (a, b) { return Number(a.orderIndex || 0) - Number(b.orderIndex || 0); }).map(function (record) { return record.exerciseId; });
    draft.cardios.forEach(function (cardio) {
      var exerciseId = cardioExerciseId(cardio.type);
      if (exerciseId) ids.push(exerciseId);
    });
    (draft.pendingCardioTypes || []).forEach(function (type) {
      var exerciseId = cardioExerciseId(type);
      if (exerciseId) ids.push(exerciseId);
    });
    return ids.filter(function (id, index, all) { return id && all.indexOf(id) === index; });
  }

  function renderRoutineEditor() {
    if (!routineEditorState) return;
    $("#routineSaveTitle").textContent = routineEditingId ? "ルーティーンを編集" : "ルーティーン登録";
    $("#routineNameInput").value = routineEditorState.name || "";
    $("#routineLocationType").value = routineEditorState.locationType === "home" ? "home" : "gym";
    $("#confirmRoutineSave").textContent = routineEditingId ? "変更を保存" : "このルーティーンを保存";
    var ids = routineEditorState.exerciseIds || [];
    $("#routineEditorExerciseList").innerHTML = ids.length ? ids.map(function (exerciseId, index) {
      var exercise = getExercise(exerciseId);
      return '<div class="routine-editor-row"><span class="routine-editor-index">' + (index + 1) + '</span><span class="routine-editor-name"><strong>' + escapeHtml(exercise ? exercise.name : "不明な種目") + '</strong><small>' + escapeHtml(exercise ? (exercise.category === "CARDIO" ? "有酸素" : CATEGORY_LABELS[exercise.category]) : "") + '</small></span><div class="routine-editor-controls"><button type="button" data-move-routine-exercise="' + index + '" data-move-direction="-1" aria-label="上へ"' + (index === 0 ? " disabled" : "") + '>↑</button><button type="button" data-move-routine-exercise="' + index + '" data-move-direction="1" aria-label="下へ"' + (index === ids.length - 1 ? " disabled" : "") + '>↓</button><button class="routine-editor-remove" type="button" data-remove-routine-exercise="' + index + '">削除</button></div></div>';
    }).join("") : '<div class="empty-state">種目を追加してください</div>';
  }

  function openRoutineCreator(prefillFromDraft) {
    routineEditingId = null;
    routineEditorState = {
      name: "",
      locationType: prefillFromDraft && draft ? draft.locationType : "gym",
      exerciseIds: prefillFromDraft ? routineExerciseIdsFromDraft() : []
    };
    renderRoutineEditor();
    openModal("routineSaveModal");
    setTimeout(function () { $("#routineNameInput").focus(); }, 40);
  }

  function openRoutineSaveModal() {
    openRoutineCreator(true);
  }

  function openRoutineEditor(routineId) {
    var routine = getRoutine(routineId);
    if (!routine) return;
    routineEditingId = routineId;
    routineEditorState = {
      name: routine.name || "",
      locationType: routine.locationType === "home" ? "home" : "gym",
      exerciseIds: routineExerciseEntries(routine).map(function (entry) { return entry.exerciseId; }).filter(Boolean)
    };
    closeModal("routineListModal");
    renderRoutineEditor();
    openModal("routineSaveModal");
  }

  function cancelRoutineEditor() {
    routineEditingId = null;
    routineEditorState = null;
    routinePendingExerciseIds = [];
    exercisePickerMode = "workout";
    closeModal("exerciseModal");
    closeModal("routineSaveModal");
  }

  function openRoutineExercisePicker() {
    if (!routineEditorState) return;
    routineEditorState.name = $("#routineNameInput").value;
    routineEditorState.locationType = $("#routineLocationType").value === "home" ? "home" : "gym";
    exercisePickerMode = "routine";
    routinePendingExerciseIds = routineEditorState.exerciseIds.slice();
    pendingExerciseId = null;
    activeExerciseBodyPart = "chest";
    $("#exerciseModalTitle").textContent = "ルーティーンに種目を追加";
    $("#confirmExerciseSelection").textContent = "完了";
    $("#confirmExerciseSelection").disabled = false;
    renderExerciseBodyPartTabs();
    renderExerciseList();
    openModal("exerciseModal");
  }

  function saveRoutineFromDraft() {
    if (!routineEditorState) return;
    routineEditorState.name = $("#routineNameInput").value.trim();
    routineEditorState.locationType = $("#routineLocationType").value === "home" ? "home" : "gym";
    if (!routineEditorState.name) { showToast("ルーティーン名を入力してください"); $("#routineNameInput").focus(); return; }
    if (!routineEditorState.exerciseIds.length) { showToast("種目を1つ以上追加してください"); return; }
    var existingIndex = data.routines.findIndex(function (routine) { return routine.id === routineEditingId; });
    var existing = existingIndex >= 0 ? data.routines[existingIndex] : null;
    var stamp = nowIso();
    var routine = {
      id: existing ? existing.id : makeId("routine"),
      name: routineEditorState.name,
      locationType: routineEditorState.locationType,
      exercises: routineEditorState.exerciseIds.map(function (exerciseId, index) { return { exerciseId: exerciseId, orderIndex: index }; }),
      createdAt: existing ? existing.createdAt : stamp,
      updatedAt: stamp
    };
    var wasEditing = !!existing;
    var saved = runDataTransaction(function () {
      if (existingIndex >= 0) data.routines[existingIndex] = routine;
      else data.routines.push(routine);
    });
    if (!saved) return;
    routineEditingId = null;
    routineEditorState = null;
    closeModal("routineSaveModal");
    renderRoutineList();
    showToast(wasEditing ? "ルーティーンを更新しました" : "ルーティーンを保存しました");
  }

  function renderRoutineList() {
    $("#routineListTitle").textContent = routineListMode === "manage" ? "ルーティーン管理" : "ルーティーンを選ぶ";
    var lead = $("#routineListModal .modal-lead");
    if (lead) lead.textContent = routineListMode === "manage" ? "登録済みの内容を編集・削除できます。" : formatDateJa(routineTargetDate || todayString()) + "の記録に追加します。";
    if (!data.routines.length) {
      $("#routineList").innerHTML = '<div class="empty-state">ルーティーンはまだありません。</div><button class="outline-button outline-button--blue" type="button" data-create-routine>ルーティーンを登録</button>';
      return;
    }
    $("#routineList").innerHTML = data.routines.slice().sort(function (a, b) { return String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")); }).map(function (routine) {
      var entries = routineExerciseEntries(routine);
      var preview = entries.map(function (entry) { var exercise = getExercise(entry.exerciseId); return exercise ? exercise.name : "不明な種目"; }).join("・");
      var updated = String(routine.updatedAt || "").slice(0, 10).replace(/-/g, "/");
      var action = routineListMode === "manage" ? "" : '<button class="routine-today-button" type="button" data-use-routine="' + routine.id + '">このルーティーンで登録</button>';
      return '<article class="routine-card"><div class="routine-card-head"><div><strong>' + escapeHtml(routine.name) + '</strong><small>' + (routine.locationType === "home" ? "自宅" : "ジム") + '・' + entries.length + '種目・更新 ' + updated + '</small></div></div><p class="routine-card-preview">' + escapeHtml(preview || "種目なし") + '</p>' + action + '<div class="routine-card-actions"><button class="routine-edit-button" type="button" data-edit-routine="' + routine.id + '">編集</button><button class="routine-delete-button" type="button" data-delete-routine="' + routine.id + '">削除</button></div></article>';
    }).join("") + '<button class="outline-button outline-button--blue" type="button" data-create-routine>新しいルーティーンを登録</button>';
  }

  function openRoutineList(dateValue, mode) {
    routineTargetDate = dateValue || todayString();
    routineListMode = mode || "use";
    renderRoutineList();
    openModal("routineListModal");
  }

  function draftFromRoutine(routine, dateValue, scheduleId) {
    draft = { id: null, originalSessionId: null, date: dateValue, locationType: routine.locationType, memo: "", records: [], cardios: [], pendingCardioTypes: [], createdAt: nowIso(), sourceScheduleId: scheduleId || null };
    var legacyRecords = Array.isArray(routine.records) ? routine.records : [];
    legacyRecords.forEach(function (record, recordIndex) {
      draft.records.push({
        tempId: makeId("draftrecord"), exerciseId: record.exerciseId, orderIndex: recordIndex,
        sets: (record.sets || []).map(function (set, setIndex) {
          return { tempId: makeId("draftset"), setNumber: setIndex + 1, weight: Number(set.weight || 0), reps: Number(set.reps || 0), rir: set.rir || "", restSeconds: Number(set.restSeconds || 90), memo: set.memo || "" };
        })
      });
    });
    (routine.cardios || []).forEach(function (cardio) {
      var copied = { tempId: makeId("draftcardio"), type: cardio.type, durationMinutes: Number(cardio.durationMinutes || 0), distanceKm: Number(cardio.distanceKm || 0), inclinePercent: Number(cardio.inclinePercent || 0), memo: cardio.memo || "" };
      var result = calculateCardio(copied);
      copied.speedKmh = result.speedKmh;
      copied.calories = result.calories;
      draft.cardios.push(copied);
    });
    if (!legacyRecords.length && Array.isArray(routine.exercises)) {
      routineExerciseEntries(routine).forEach(function (entry, index) {
        var exercise = getExercise(entry.exerciseId);
        if (!exercise) return;
        if (exercise.category === "CARDIO") {
          draft.pendingCardioTypes.push(exercise.name);
        } else {
          draft.records.push({ tempId: makeId("draftrecord"), exerciseId: exercise.id, orderIndex: index, sets: [] });
        }
      });
    }
    selectedExerciseId = null;
    editingSetTempId = null;
    isAddingSet = false;
    editingCardioTempId = null;
    selectedRir = null;
    selectedRest = 90;
    resetCardioForm();
    renderWorkout();
    closeModal("routineListModal");
    closeModal("dayModal");
    showScreen("workout");
    saveDraftNow();
  }

  function useRoutineToday(routineId) {
    var routine = getRoutine(routineId);
    if (!routine) return;
    routineEditingId = null;
    draftFromRoutine(routine, routineTargetDate || todayString(), null);
    showToast("ルーティーンを追加しました。保存するまで記録には反映されません");
  }

  function editRoutine(routineId) {
    openRoutineEditor(routineId);
  }

  function scheduleRoutine(routineId, dateValue) {
    var routine = getRoutine(routineId);
    if (!routine || !dateValue) { showToast("追加先の日付を選んでください"); return; }
    var existing = data.scheduledRoutines.find(function (schedule) { return schedule.routineId === routineId && schedule.date === dateValue; });
    if (!existing) {
      var stamp = nowIso();
      if (!runDataTransaction(function () { data.scheduledRoutines.push({ id: makeId("schedule"), routineId: routineId, date: dateValue, createdAt: stamp, updatedAt: stamp }); })) return;
    }
    renderCalendar();
    renderRoutineList();
    showToast("ルーティーンを予定に追加しました。実施して保存するまで記録には反映されません");
  }

  function startScheduledRoutine(scheduleId) {
    var schedule = data.scheduledRoutines.find(function (item) { return item.id === scheduleId; });
    if (!schedule) return;
    var routine = getRoutine(schedule.routineId);
    if (!routine) return;
    routineEditingId = null;
    draftFromRoutine(routine, schedule.date, schedule.id);
  }

  function deleteSchedule(scheduleId) {
    if (!runDataTransaction(function () { data.scheduledRoutines = data.scheduledRoutines.filter(function (item) { return item.id !== scheduleId; }); })) return;
    closeModal("dayModal");
    renderHome();
    showToast("予定を削除しました");
  }

  function deleteRoutine(routineId) {
    if (!runDataTransaction(function () {
      data.routines = data.routines.filter(function (routine) { return routine.id !== routineId; });
      data.scheduledRoutines = data.scheduledRoutines.filter(function (schedule) { return schedule.routineId !== routineId; });
    })) return;
    renderRoutineList();
    renderHome();
    showToast("ルーティーンを削除しました");
  }

  /* Home calendar and monthly summaries */
  function renderCalendar() {
    var year = calendarCursor.getFullYear();
    var month = calendarCursor.getMonth();
    $("#calendarYear").textContent = year;
    $("#calendarMonth").textContent = month + 1;
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var previousMonthDays = new Date(year, month, 0).getDate();
    var rows = Math.ceil((firstDay + daysInMonth) / 7);
    var totalCells = rows * 7;
    var html = "";
    var today = todayString();
    for (var index = 0; index < totalCells; index += 1) {
      var day = index - firstDay + 1;
      var cellDate;
      var outside = false;
      var displayDay = day;
      if (day < 1) {
        displayDay = previousMonthDays + day;
        cellDate = new Date(year, month - 1, displayDay);
        outside = true;
      } else if (day > daysInMonth) {
        displayDay = day - daysInMonth;
        cellDate = new Date(year, month + 1, displayDay);
        outside = true;
      } else {
        cellDate = new Date(year, month, day);
      }
      var dateValue = cellDate.getFullYear() + "-" + String(cellDate.getMonth() + 1).padStart(2, "0") + "-" + String(cellDate.getDate()).padStart(2, "0");
      var daySessions = getSessionsForDate(dateValue);
      var daySchedules = dataIndexes ? (dataIndexes.scheduledRoutinesByDate[dateValue] || []) : data.scheduledRoutines.filter(function (schedule) { return schedule.date === dateValue; });
      var hasSchedule = daySchedules.some(function (schedule) { return !!getRoutine(schedule.routineId); });
      var hasGym = daySessions.some(function (session) { return session.locationType === "gym"; });
      var hasHome = daySessions.some(function (session) { return session.locationType === "home"; });
      var classes = ["calendar-day"];
      if (outside) classes.push("calendar-day--outside");
      if (dateValue === today) classes.push("calendar-day--today");
      if (hasSchedule) classes.push("calendar-day--planned");
      if (hasGym && hasHome) classes.push("calendar-day--both", "calendar-day--has-record");
      else if (hasGym) classes.push("calendar-day--gym", "calendar-day--has-record");
      else if (hasHome) classes.push("calendar-day--home", "calendar-day--has-record");
      html += '<button type="button" role="gridcell" class="' + classes.join(" ") + '" data-calendar-date="' + dateValue + '" aria-label="' + formatDateJa(dateValue) + (daySessions.length ? " 記録あり" : "") + (hasSchedule ? " 予定あり" : "") + '">' + displayDay + "</button>";
    }
    $("#calendarGrid").innerHTML = html;
  }

  function showScreen(name) {
    $$(".screen").forEach(function (screen) { screen.classList.remove("screen--active"); });
    $("#" + name + "Screen").classList.add("screen--active");
    window.scrollTo(0, 0);
  }

  /* Progress analysis and chart rendering */
  function getStrengthProgress(exerciseId, metric) {
    var daily = {};
    var records = dataIndexes ? (dataIndexes.recordsByExerciseId[exerciseId] || []) : data.records.filter(function (record) { return record.exerciseId === exerciseId; });
    records.forEach(function (record) {
      var session = getSession(record.sessionId);
      if (!session) return;
      var sets = getRecordSets(record.id);
      if (!sets.length) return;
      if (!daily[session.date]) daily[session.date] = [];
      daily[session.date] = daily[session.date].concat(sets);
    });
    return Object.keys(daily).sort().map(function (date) {
      var sets = daily[date];
      var value = 0;
      if (metric === "maxWeight") {
        value = Math.max.apply(null, sets.map(function (set) { return Number(set.weight || 0) / 1000; }));
      } else if (metric === "maxReps") {
        value = Math.max.apply(null, sets.map(function (set) { return Number(set.reps || 0); }));
      } else if (metric === "volume") {
        value = sets.reduce(function (sum, set) { return sum + Number(set.weight || 0) / 1000 * Number(set.reps || 0); }, 0);
      } else if (metric === "oneRm") {
        value = Math.max.apply(null, sets.map(function (set) {
          var weight = Number(set.weight || 0) / 1000;
          return weight * (1 + Number(set.reps || 0) / 30);
        }));
      } else if (metric === "totalReps") {
        value = sets.reduce(function (sum, set) { return sum + Number(set.reps || 0); }, 0);
      }
      return { date: date, value: value };
    });
  }

  function getCardioProgress(cardioType, metric) {
    var daily = {};
    data.cardios.forEach(function (cardio) {
      var normalizedType = cardio.type === "傾斜ウォーク" ? "ウォーキング" : cardio.type;
      if (normalizedType !== cardioType) return;
      var session = getSession(cardio.sessionId);
      if (!session) return;
      if (!daily[session.date]) daily[session.date] = { distance: 0, duration: 0, calories: 0 };
      daily[session.date].distance += Number(cardio.distanceKm || 0);
      daily[session.date].duration += Number(cardio.durationMinutes || 0);
      var storedCalories = Number(cardio.calories);
      daily[session.date].calories += Number.isFinite(storedCalories) ? storedCalories : calculateCardio(cardio).calories;
    });
    return Object.keys(daily).sort().map(function (date) {
      var totals = daily[date];
      var speed = totals.duration > 0 ? totals.distance / (totals.duration / 60) : 0;
      var values = { distance: totals.distance, duration: totals.duration, speed: speed, calories: totals.calories };
      return { date: date, value: values[metric] || 0 };
    });
  }

  function filterProgressPointsByRange(points, range) {
    if (!points.length || range === "all") return points.slice();
    var months = { "1m": 1, "3m": 3, "6m": 6, "1y": 12 }[range] || 6;
    var latest = dateFromString(points[points.length - 1].date);
    var targetMonthIndex = latest.getFullYear() * 12 + latest.getMonth() - months;
    var targetYear = Math.floor(targetMonthIndex / 12);
    var targetMonth = ((targetMonthIndex % 12) + 12) % 12;
    var targetDay = Math.min(latest.getDate(), new Date(targetYear, targetMonth + 1, 0).getDate());
    var startDate = new Date(targetYear, targetMonth, targetDay);
    return points.filter(function (point) { return dateFromString(point.date) >= startDate; });
  }

  function progressDateLabel(dateValue) {
    var date = dateFromString(dateValue);
    return (date.getMonth() + 1) + "/" + date.getDate();
  }

  function formatProgressNumber(value, definition) {
    if (!Number.isFinite(value)) return "--";
    return value.toLocaleString("ja-JP", {
      minimumFractionDigits: definition.decimals,
      maximumFractionDigits: definition.decimals
    }) + definition.unit;
  }

  function formatProgressChange(value, definition) {
    var threshold = Math.pow(10, -definition.decimals) / 2;
    if (Math.abs(value) < threshold) return "±0" + definition.unit;
    var absolute = Math.abs(value).toLocaleString("ja-JP", {
      minimumFractionDigits: definition.decimals,
      maximumFractionDigits: definition.decimals
    });
    return (value > 0 ? "+" : "-") + absolute + definition.unit;
  }

  function getProgressDisplayCopy(tab, metric) {
    var copies = {
      maxWeight: {
        title: "扱える重さを振り返ろう",
        description: "昔と比べて、どれくらい重くできるようになったかを確認できます。",
        first: "初回重量", latest: "最新重量"
      },
      maxReps: {
        title: "できた回数を振り返ろう",
        description: "昔と比べて、同じ種目で何回できるようになったかを確認できます。",
        first: "初回回数", latest: "最新回数"
      },
      totalReps: {
        title: "できた回数を振り返ろう",
        description: "その日にできた回数の合計を、昔の記録と比べられます。",
        first: "初回の合計回数", latest: "最新の合計回数"
      },
      volume: {
        title: "合計運動量を振り返ろう",
        description: "重量×回数の合計です。その日にどれくらい積み重ねたかを確認できます。",
        first: "初回の合計運動量", latest: "最新の合計運動量"
      },
      oneRm: {
        title: "1回だけ挙げられる重さの目安",
        description: "重量と回数から計算した目安です。実際に無理して試す必要はありません。",
        first: "初回の目安", latest: "最新の目安"
      },
      distance: {
        title: "動けた距離を振り返ろう",
        description: "昔と比べて、どれくらい長い距離を動けるようになったかを確認できます。",
        first: "初回距離", latest: "最新距離"
      },
      duration: {
        title: "続けられた時間を振り返ろう",
        description: "昔と比べて、どれくらい長く運動できるようになったかを確認できます。",
        first: "初回時間", latest: "最新時間"
      },
      speed: {
        title: "動けた速さを振り返ろう",
        description: "距離と時間から計算した平均速度の変化を確認できます。",
        first: "初回速度", latest: "最新速度"
      },
      calories: {
        title: "運動量を振り返ろう",
        description: "運動内容から計算した概算消費カロリーの変化を確認できます。",
        first: "初回の消費量", latest: "最新の消費量"
      }
    };
    return copies[metric] || (tab === "strength" ? copies.maxWeight : copies.distance);
  }

  function getProgressMessage(points, definition, metric) {
    if (!points.length) return "記録を始めると、ここに成長が表示されます。";
    if (points.length === 1) return "最初の記録ができました。ここからの変化を楽しみに続けましょう。";
    var first = points[0].value;
    var latest = points[points.length - 1].value;
    var best = Math.max.apply(null, points.map(function (point) { return point.value; }));
    var change = latest - first;
    var amount = formatProgressNumber(Math.abs(change), definition);
    if (change === 0) return "安定して続けられています。積み重ねが次の成長につながります。";
    if (change < 0) return "記録を重ねています。今日の記録も次の一歩につながる大切なデータです。";
    var bestSuffix = latest >= best - 0.0001 ? " 自己ベスト更新中です。" : "";
    if (metric === "maxWeight") return "前より" + amount + "重くできるようになりました。この調子です。" + bestSuffix;
    if (metric === "maxReps" || metric === "totalReps") return "前より" + amount + "多くできるようになりました。しっかり伸びています。" + bestSuffix;
    if (metric === "volume") return "前より" + amount + "多く積み重ねられています。運動量が増えています。" + bestSuffix;
    if (metric === "oneRm") return "前より" + amount + "、力の目安が伸びています。" + bestSuffix;
    if (metric === "distance") return "前より" + amount + "長く動けるようになりました。" + bestSuffix;
    if (metric === "duration") return "前より" + amount + "長く続けられるようになりました。" + bestSuffix;
    if (metric === "speed") return "前より" + amount + "速く動けるようになりました。" + bestSuffix;
    return "運動量が前より" + amount + "増えました。" + bestSuffix;
  }

  function getProgressTickStep(metric, minValue, maxValue) {
    var span = Math.max(0, maxValue - minValue);
    if (metric === "maxWeight" || metric === "oneRm") return 5;
    if (metric === "volume") {
      var volumeTarget = span > 0 ? span / 5 : maxValue / 5;
      if (volumeTarget <= 100) return 100;
      if (volumeTarget <= 500) return 500;
      if (span <= 12000) return 1000;
      return Math.ceil(volumeTarget / 1000) * 1000;
    }
    if (metric === "maxReps") return span <= 5 ? 1 : 5;
    if (metric === "totalReps") return span <= 10 ? 1 : (span <= 30 ? 5 : 10);
    if (metric === "distance") return span <= 3 ? 0.5 : 1;
    if (metric === "duration") return span <= 15 ? 5 : (span <= 60 ? 10 : 30);
    if (metric === "speed") return span <= 3 ? 0.5 : 1;
    if (metric === "calories") {
      var calorieTarget = span > 0 ? span / 5 : maxValue / 5;
      if (calorieTarget <= 50) return 50;
      if (calorieTarget <= 100) return 100;
      if (calorieTarget <= 500) return 500;
      return Math.ceil(calorieTarget / 500) * 500;
    }
    return 1;
  }

  function buildProgressScale(points, metric) {
    var values = points.map(function (point) { return Number(point.value || 0); });
    var minValue = Math.min.apply(null, values);
    var maxValue = Math.max.apply(null, values);
    var step = getProgressTickStep(metric, minValue, maxValue);
    var yMin = Math.floor(minValue / step) * step;
    var yMax = Math.ceil(maxValue / step) * step;
    if (Math.abs(minValue - yMin) < 0.000001 && yMin > 0) yMin -= step;
    if (Math.abs(maxValue - yMax) < 0.000001) yMax += step;
    yMin = Math.max(0, yMin);
    if (yMax <= yMin) yMax = yMin + step * 2;
    var ticks = [];
    for (var value = yMin, guard = 0; value <= yMax + step * 0.001 && guard < 200; value += step, guard += 1) {
      ticks.push(Math.round(value * 1000) / 1000);
    }
    return { min: yMin, max: yMax, step: step, ticks: ticks };
  }

  function progressTooltipDate(dateValue) {
    var date = dateFromString(dateValue);
    return (date.getMonth() + 1) + "月" + date.getDate() + "日";
  }

  function renderProgressChart(points, definition, chartLabel) {
    var container = $("#progressChart");
    if (!points.length) {
      container.innerHTML = '<div class="chart-empty"><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18 10 12l4 4 6-8"/><path d="M15 8h5v5"/></svg><p>まだ記録がありません</p><small>トレーニングを記録するとグラフが表示されます</small></div></div>';
      return;
    }
    var metric = progressState.metric;
    var scale = buildProgressScale(points, metric);
    var margin = { top: 28, right: 28, bottom: 52, left: 70 };
    var width = Math.max(340, margin.left + margin.right + Math.max(1, points.length - 1) * 70);
    var height = Math.max(340, margin.top + margin.bottom + Math.max(1, scale.ticks.length - 1) * 32);
    var plotWidth = width - margin.left - margin.right;
    var plotHeight = height - margin.top - margin.bottom;
    var coordinates = points.map(function (point, index) {
      var x = points.length === 1 ? margin.left + plotWidth / 2 : margin.left + index * plotWidth / (points.length - 1);
      var y = margin.top + (scale.max - point.value) / (scale.max - scale.min) * plotHeight;
      return { x: x, y: y, point: point };
    });
    var grid = "";
    scale.ticks.slice().reverse().forEach(function (tickValue) {
      var y = margin.top + (scale.max - tickValue) / (scale.max - scale.min) * plotHeight;
      var tickDecimals = scale.step < 1 ? 1 : 0;
      var tickText = tickValue.toLocaleString("ja-JP", { minimumFractionDigits: tickDecimals, maximumFractionDigits: tickDecimals });
      grid += '<line class="chart-grid-line" x1="' + margin.left + '" y1="' + y.toFixed(1) + '" x2="' + (width - margin.right) + '" y2="' + y.toFixed(1) + '"/><text class="chart-axis-label" x="' + (margin.left - 9) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="end">' + tickText + '</text>';
    });
    var linePath = coordinates.map(function (coordinate, index) { return (index ? "L" : "M") + coordinate.x.toFixed(1) + " " + coordinate.y.toFixed(1); }).join(" ");
    var areaPath = coordinates.length > 1 ? linePath + " L" + coordinates[coordinates.length - 1].x.toFixed(1) + " " + (margin.top + plotHeight) + " L" + coordinates[0].x.toFixed(1) + " " + (margin.top + plotHeight) + " Z" : "";
    var dateLabels = coordinates.map(function (coordinate) {
      return '<text class="chart-axis-label" x="' + coordinate.x.toFixed(1) + '" y="' + (height - 17) + '" text-anchor="middle">' + progressDateLabel(coordinate.point.date) + '</text>';
    }).join("");
    var circles = coordinates.map(function (coordinate, index) {
      var latestClass = index === coordinates.length - 1 ? " chart-point--latest" : "";
      var radius = index === coordinates.length - 1 ? 6 : 4;
      var dateLabel = progressTooltipDate(coordinate.point.date);
      var valueLabel = formatProgressNumber(coordinate.point.value, definition);
      return '<g class="chart-point-target" tabindex="0" role="button" aria-label="' + escapeHtml(dateLabel + " " + definition.label + " " + valueLabel) + '" data-chart-point data-chart-x="' + coordinate.x.toFixed(1) + '" data-chart-y="' + coordinate.y.toFixed(1) + '" data-chart-width="' + width + '" data-chart-date="' + escapeHtml(dateLabel) + '" data-chart-metric="' + escapeHtml(definition.label) + '" data-chart-value="' + escapeHtml(valueLabel) + '"><circle class="chart-point-hit" cx="' + coordinate.x.toFixed(1) + '" cy="' + coordinate.y.toFixed(1) + '" r="15"/><circle class="chart-point' + latestClass + '" cx="' + coordinate.x.toFixed(1) + '" cy="' + coordinate.y.toFixed(1) + '" r="' + radius + '"/></g>';
    }).join("");
    container.innerHTML = '<div class="progress-chart-scroll"><div class="progress-chart-inner" style="width:' + width + 'px;height:' + height + 'px"><svg width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + escapeHtml(chartLabel) + '"><defs><linearGradient id="progressAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7aa5fa" stop-opacity=".36"/><stop offset="100%" stop-color="#7aa5fa" stop-opacity=".02"/></linearGradient></defs>' + grid + (areaPath ? '<path class="chart-area" d="' + areaPath + '"/>' : "") + (coordinates.length > 1 ? '<path class="chart-line" d="' + linePath + '"/>' : "") + circles + dateLabels + '</svg><div id="progressChartTooltip" class="progress-chart-tooltip" role="status" aria-live="polite"></div></div></div>';
  }

  function showProgressChartTooltip(pointElement) {
    var tooltip = $("#progressChartTooltip");
    if (!tooltip || !pointElement) return;
    var x = Number(pointElement.dataset.chartX || 0);
    var y = Number(pointElement.dataset.chartY || 0);
    var chartWidth = Number(pointElement.dataset.chartWidth || 340);
    var tooltipWidth = 168;
    var left = Math.max(8, Math.min(chartWidth - tooltipWidth - 8, x - tooltipWidth / 2));
    var top = y > 88 ? y - 74 : y + 18;
    tooltip.innerHTML = '<strong>' + escapeHtml(pointElement.dataset.chartDate) + '</strong><span>' + escapeHtml(pointElement.dataset.chartMetric) + ' ' + escapeHtml(pointElement.dataset.chartValue) + '</span>';
    tooltip.style.left = left + "px";
    tooltip.style.top = Math.max(8, top) + "px";
    tooltip.classList.add("is-visible");
  }

  function hideProgressChartTooltip() {
    var tooltip = $("#progressChartTooltip");
    if (tooltip) tooltip.classList.remove("is-visible");
  }

  function renderProgressPage() {
    var isStrength = progressState.tab === "strength";
    $$('[data-progress-tab]').forEach(function (button) {
      var active = button.dataset.progressTab === progressState.tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    var exerciseSelect = $("#progressExerciseSelect");
    var metricSelect = $("#progressMetricSelect");
    var selectedLabel = "";
    var definition;
    var points;
    if (isStrength) {
      var exercises = data.exercises.filter(function (exercise) { return exercise.category !== "CARDIO"; });
      var recordedIds = data.records.map(function (record) { return record.exerciseId; });
      if (!progressState.exerciseId || !exercises.some(function (exercise) { return exercise.id === progressState.exerciseId; })) {
        var firstRecordedWeighted = exercises.find(function (exercise) { return exercise.category !== "BODYWEIGHT" && recordedIds.indexOf(exercise.id) >= 0; });
        var firstRecorded = exercises.find(function (exercise) { return recordedIds.indexOf(exercise.id) >= 0; });
        var firstWeighted = exercises.find(function (exercise) { return exercise.category !== "BODYWEIGHT"; });
        progressState.exerciseId = (firstRecordedWeighted || firstWeighted || firstRecorded || exercises[0] || {}).id || null;
      }
      exerciseSelect.innerHTML = exercises.map(function (exercise) { return '<option value="' + exercise.id + '">' + escapeHtml(exercise.name) + '</option>'; }).join("");
      exerciseSelect.value = progressState.exerciseId || "";
      var selectedExercise = getExercise(progressState.exerciseId);
      var metricKeys = selectedExercise && selectedExercise.category === "BODYWEIGHT" ? ["maxReps", "totalReps"] : ["maxWeight", "maxReps", "volume", "oneRm"];
      if (metricKeys.indexOf(progressState.metric) < 0) progressState.metric = metricKeys[0];
      metricSelect.innerHTML = metricKeys.map(function (key) { return '<option value="' + key + '">' + STRENGTH_METRICS[key].label + '</option>'; }).join("");
      metricSelect.value = progressState.metric;
      definition = STRENGTH_METRICS[progressState.metric];
      selectedLabel = selectedExercise ? selectedExercise.name : "種目";
      points = progressState.exerciseId ? getStrengthProgress(progressState.exerciseId, progressState.metric) : [];
      $("#progressExerciseLabel").textContent = "筋トレ種目";
    } else {
      if (CARDIO_TYPES.indexOf(progressState.cardioType) < 0) progressState.cardioType = CARDIO_TYPES[0];
      exerciseSelect.innerHTML = CARDIO_TYPES.map(function (type) { return '<option value="' + type + '">' + type + '</option>'; }).join("");
      exerciseSelect.value = progressState.cardioType;
      var cardioMetricKeys = ["distance", "duration", "speed", "calories"];
      if (cardioMetricKeys.indexOf(progressState.metric) < 0) progressState.metric = cardioMetricKeys[0];
      metricSelect.innerHTML = cardioMetricKeys.map(function (key) { return '<option value="' + key + '">' + CARDIO_METRICS[key].label + '</option>'; }).join("");
      metricSelect.value = progressState.metric;
      definition = CARDIO_METRICS[progressState.metric];
      selectedLabel = progressState.cardioType;
      points = getCardioProgress(progressState.cardioType, progressState.metric);
      $("#progressExerciseLabel").textContent = "有酸素種目";
    }
    points = filterProgressPointsByRange(points, progressState.range);
    $("#progressRangeSelect").value = progressState.range;
    var displayCopy = getProgressDisplayCopy(progressState.tab, progressState.metric);
    $("#progressHeroTitle").textContent = displayCopy.title;
    $("#progressHeroDescription").textContent = displayCopy.description;
    $("#progressFirstLabel").textContent = displayCopy.first;
    $("#progressLatestLabel").textContent = displayCopy.latest;
    $("#progressGrowthLabel").textContent = "伸び幅";
    $("#progressBestLabel").textContent = "自己ベスト";
    $("#progressMetricHelp").textContent = definition.help;
    $("#progressChartTitle").textContent = selectedLabel + "の" + definition.label + "推移";
    $("#progressChartMeta").textContent = "単位：" + definition.unit + (progressState.metric === "volume" ? "　｜　重量×回数の合計" : "");
    $("#progressPointCount").textContent = points.length + "回";
    var message = $("#progressMessage");
    message.textContent = getProgressMessage(points, definition, progressState.metric);
    message.classList.toggle("is-muted", !points.length);
    if (!points.length) {
      ["#progressFirstValue", "#progressLatestValue", "#progressGrowthValue", "#progressBestValue"].forEach(function (selector) { $(selector).textContent = "--"; });
      ["#progressFirstDate", "#progressLatestDate", "#progressBestDate"].forEach(function (selector) { $(selector).textContent = "--"; });
    } else {
      var first = points[0];
      var latest = points[points.length - 1];
      var best = points.reduce(function (currentBest, point) { return point.value >= currentBest.value ? point : currentBest; }, points[0]);
      $("#progressFirstValue").textContent = formatProgressNumber(first.value, definition);
      $("#progressLatestValue").textContent = formatProgressNumber(latest.value, definition);
      $("#progressGrowthValue").textContent = formatProgressChange(latest.value - first.value, definition);
      $("#progressBestValue").textContent = formatProgressNumber(best.value, definition);
      $("#progressFirstDate").textContent = progressDateLabel(first.date);
      $("#progressLatestDate").textContent = progressDateLabel(latest.date);
      $("#progressBestDate").textContent = progressDateLabel(best.date);
    }
    renderProgressChart(points, definition, selectedLabel + "の" + definition.label + "の推移");
  }

  function openProgressPage() {
    progressState.tab = "strength";
    progressState.metric = "maxWeight";
    progressState.exerciseId = null;
    progressState.range = "6m";
    renderProgressPage();
    showScreen("progress");
  }

  function openProfile() {
    var profile = data.profile || {};
    $("#profileWeight").value = profile.weightKg || "";
    $("#profileHeight").value = profile.heightCm || "";
    $("#profileAge").value = profile.age || "";
    $("#profileGender").value = profile.gender || "";
    openModal("profileModal");
  }

  function resetCardioForm() {
    editingCardioTempId = null;
    $("#cardioType").value = "ウォーキング";
    $("#cardioDuration").value = "";
    $("#cardioDistance").value = "";
    $("#cardioIncline").value = "";
    $("#cardioMemo").value = "";
    $("#cardioEditorCard").classList.add("hidden");
    $("#cardioEditorTitle").textContent = "有酸素の内容を入力";
    $("#saveCardioButton").textContent = "この有酸素記録を保存";
    updateCardioPreview();
  }

  function populateCardioForm(cardio) {
    if (!cardio) return;
    var normalizedType = cardio.type === "傾斜ウォーク" ? "ウォーキング" : cardio.type;
    var cardioExercise = data.exercises.find(function (exercise) {
      return exercise.category === "CARDIO" && exercise.name === normalizedType;
    });
    editingSetTempId = null;
    isAddingSet = false;
    editingCardioTempId = cardio.tempId;
    selectedExerciseId = cardioExercise ? cardioExercise.id : null;
    $("#cardioType").value = normalizedType;
    renderSelectedExercise();
    $("#cardioDuration").value = formatNumberForInput(Number(cardio.durationMinutes || 0), 1);
    $("#cardioDistance").value = formatNumberForInput(Number(cardio.distanceKm || 0), 0.1);
    $("#cardioIncline").value = formatNumberForInput(Number(cardio.inclinePercent || 0), 0.5);
    $("#cardioMemo").value = cardio.memo || "";
    $("#cardioEditorCard").classList.remove("hidden");
    $("#cardioEditorTitle").textContent = normalizedType + "を編集中";
    $("#saveCardioButton").textContent = "この有酸素記録を更新";
    updateCardioPreview();
    saveDraftNow();
  }

  /* Workout draft, editing, copy, and save flows */
  function newDraft(locationType, date) {
    routineEditingId = null;
    draft = { id: null, originalSessionId: null, date: date || todayString(), locationType: locationType, memo: "", records: [], cardios: [], createdAt: nowIso() };
    selectedExerciseId = null;
    selectedRir = null;
    selectedRest = 90;
    editingSetTempId = null;
    isAddingSet = false;
    resetCardioForm();
    renderWorkout();
    showScreen("workout");
    saveDraftNow();
  }

  function startTodayLocation(locationType) {
    var savedState = loadSavedDraft();
    if (savedState && savedState.draft) {
      if (savedState.draft.date === todayString() && savedState.draft.locationType === locationType) {
        pendingSavedDraft = savedState;
        resumeSavedDraft();
      } else {
        showSavedDraftPrompt(savedState);
      }
      return;
    }
    var existing = getSessionsForDate(todayString()).find(function (session) { return session.locationType === locationType; });
    if (existing) loadDraft(existing.id);
    else newDraft(locationType, todayString());
  }

  function loadDraft(sessionId) {
    var session = getSession(sessionId);
    if (!session) return;
    routineEditingId = null;
    draft = {
      id: session.id,
      originalSessionId: session.id,
      date: session.date,
      locationType: session.locationType,
      memo: session.memo || "",
      createdAt: session.createdAt,
      records: getSessionRecords(session.id).map(function (record) {
        return { tempId: record.id, exerciseId: record.exerciseId, orderIndex: record.orderIndex, sets: getRecordSets(record.id).map(function (set) { return Object.assign({}, set, { tempId: set.id }); }) };
      }),
      cardios: getSessionCardios(session.id).map(function (cardio) { return Object.assign({}, cardio, { tempId: cardio.id }); })
    };
    selectedExerciseId = null;
    selectedRir = null;
    selectedRest = 90;
    editingSetTempId = null;
    isAddingSet = false;
    resetCardioForm();
    renderWorkout();
    closeModal("dayModal");
    showScreen("workout");
    saveDraftNow();
  }

  function openCopyDestination(sessionId) {
    var source = getSession(sessionId);
    if (!source) return;
    copySourceSessionId = sessionId;
    $("#copySourceLabel").textContent = formatDateJa(source.date) + "のメニューをコピーします。";
    $("#copyTargetDate").value = todayString();
    $("#copyTodayLabel").textContent = formatDateJa(todayString());
    closeModal("dayModal");
    openModal("copyDestinationModal");
  }

  function appendRecordsAndCardiosToDraft(targetDraft, sourceRecords, sourceCardios) {
    (sourceRecords || []).forEach(function (sourceRecord) {
      var sourceSets = Array.isArray(sourceRecord.sets) ? sourceRecord.sets : getRecordSets(sourceRecord.id);
      if (!sourceSets.length) return;
      var targetRecord = targetDraft.records.find(function (record) { return record.exerciseId === sourceRecord.exerciseId; });
      if (!targetRecord) {
        targetRecord = { tempId: makeId("draftrecord"), exerciseId: sourceRecord.exerciseId, orderIndex: targetDraft.records.length, sets: [] };
        targetDraft.records.push(targetRecord);
      }
      sourceSets.forEach(function (sourceSet) {
        targetRecord.sets.push({ tempId: makeId("draftset"), setNumber: targetRecord.sets.length + 1, weight: Number(sourceSet.weight || 0), reps: Number(sourceSet.reps || 0), rir: sourceSet.rir || "", restSeconds: Number(sourceSet.restSeconds || 90), memo: sourceSet.memo || "" });
      });
    });
    (sourceCardios || []).forEach(function (sourceCardio) {
      var copiedCardio = { tempId: makeId("draftcardio"), type: sourceCardio.type, durationMinutes: Number(sourceCardio.durationMinutes || 0), distanceKm: Number(sourceCardio.distanceKm || 0), inclinePercent: Number(sourceCardio.inclinePercent || 0), memo: sourceCardio.memo || "" };
      var result = calculateCardio(copiedCardio);
      copiedCardio.speedKmh = result.speedKmh;
      copiedCardio.calories = result.calories;
      targetDraft.cardios.push(copiedCardio);
    });
  }

  function createDraftFromSession(sessionId, targetDate, keepSessionId) {
    var source = getSession(sessionId);
    if (!source) return null;
    var resultDraft = { id: keepSessionId ? source.id : null, originalSessionId: keepSessionId ? source.id : null, date: targetDate, locationType: source.locationType, memo: keepSessionId ? (source.memo || "") : "", records: [], cardios: [], createdAt: keepSessionId ? source.createdAt : nowIso() };
    appendRecordsAndCardiosToDraft(resultDraft, getSessionRecords(source.id), getSessionCardios(source.id));
    return resultDraft;
  }

  function finishCopiedDraft() {
    if (!draft) return;
    selectedExerciseId = null;
    selectedRir = null;
    selectedRest = 90;
    editingSetTempId = null;
    isAddingSet = false;
    resetCardioForm();
    renderWorkout();
    closeModal("dayModal");
    closeModal("copyDestinationModal");
    copySourceSessionId = null;
    showScreen("workout");
    saveDraftNow();
    showToast("メニューをコピーしました。保存するまで記録には反映されません");
  }

  function copySessionToDate(sessionId, targetDate) {
    var source = getSession(sessionId);
    if (!source || !targetDate) return;
    var existing = getSessionsForDate(targetDate).find(function (session) { return session.locationType === source.locationType; });
    if (existing) {
      pendingSaveConflict = null;
      pendingCopyConflict = { kind: "copy", sourceId: sessionId, targetDate: targetDate, existingId: existing.id };
      $("#copyConflictMessage").textContent = "この日の" + (source.locationType === "home" ? "自宅" : "ジム") + "記録はすでにあります。";
      $("#copyConflictCancel").textContent = "キャンセル";
      closeModal("copyDestinationModal");
      openModal("copyConflictModal");
      return;
    }
    routineEditingId = null;
    draft = createDraftFromSession(sessionId, targetDate, false);
    finishCopiedDraft();
  }

  function resolveCopyConflict(mode) {
    if (!pendingCopyConflict) {
      if (pendingSaveConflict) {
        if (mode === "append") appendToExistingAndSave();
        else replaceExistingAndSave();
        return;
      }
      showToast("保存処理の状態を確認できませんでした");
      closeModal("copyConflictModal");
      return;
    }
    var conflict = pendingCopyConflict;
    var existing = getSession(conflict.existingId);
    if (!existing) {
      pendingCopyConflict = null;
      copySourceSessionId = null;
      closeModal("copyConflictModal");
      showToast("対象の記録が見つかりませんでした");
      return;
    }
    if (mode === "append") {
      draft = createDraftFromSession(existing.id, conflict.targetDate, true);
      appendRecordsAndCardiosToDraft(draft, getSessionRecords(conflict.sourceId), getSessionCardios(conflict.sourceId));
    } else {
      draft = createDraftFromSession(conflict.sourceId, conflict.targetDate, false);
      draft.id = existing.id;
      draft.originalSessionId = existing.id;
      draft.createdAt = existing.createdAt;
    }
    pendingCopyConflict = null;
    routineEditingId = null;
    closeModal("copyConflictModal");
    finishCopiedDraft();
  }

  function cancelPendingCopyConflict() {
    var conflictKind = pendingCopyConflict && pendingCopyConflict.kind;
    pendingCopyConflict = null;
    if (conflictKind === "copy") copySourceSessionId = null;
    closeModal("copyConflictModal");
  }

  function returnToWorkoutDateInput() {
    pendingSaveConflict = null;
    closeModal("copyConflictModal");
    var scheduleFocus = window.requestAnimationFrame || function (callback) { setTimeout(callback, 40); };
    scheduleFocus(function () {
      var input = document.getElementById("sessionDate");
      if (!input) return;
      input.focus();
      input.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  function handleConflictModalAction(mode) {
    if (pendingSaveConflict) {
      if (mode === "append") appendToExistingAndSave();
      else replaceExistingAndSave();
      return;
    }
    if (pendingCopyConflict) {
      resolveCopyConflict(mode);
      return;
    }
    showToast("保存処理の状態を確認できませんでした");
    closeModal("copyConflictModal");
  }

  function handleConflictModalCancel() {
    if (pendingSaveConflict) {
      returnToWorkoutDateInput();
      return;
    }
    if (pendingCopyConflict) {
      cancelPendingCopyConflict();
      return;
    }
    showToast("保存処理の状態を確認できませんでした");
    closeModal("copyConflictModal");
  }

  function cancelPendingConflict() {
    handleConflictModalCancel();
  }

  function appendToExistingAndSave() {
    if (!pendingSaveConflict || !draft) return;
    var existing = getSession(pendingSaveConflict.existingSessionId);
    if (!existing) {
      showToast("追加先の記録が見つかりません");
      return;
    }
    var incomingDraft = cloneData(draft);
    var mergedDraft = createDraftFromSession(existing.id, draft.date, true);
    appendRecordsAndCardiosToDraft(mergedDraft, incomingDraft.records, incomingDraft.cardios);
    mergedDraft.memo = incomingDraft.memo || mergedDraft.memo;
    mergedDraft.originalSessionId = existing.id;
    if (incomingDraft.sourceScheduleId) mergedDraft.sourceScheduleId = incomingDraft.sourceScheduleId;
    var incomingOriginalSessionId = incomingDraft.originalSessionId || incomingDraft.id || null;
    if (incomingOriginalSessionId && incomingOriginalSessionId !== existing.id) {
      mergedDraft.previousSessionIdToRemove = incomingOriginalSessionId;
    }
    draft = mergedDraft;
    $("#sessionMemo").value = draft.memo || "";
    var warningConfirmed = pendingSaveConflict.warningConfirmed;
    pendingSaveConflict = null;
    closeModal("copyConflictModal");
    commitWorkoutSave({ warningConfirmed: warningConfirmed, skipConflictCheck: true });
  }

  function replaceExistingAndSave() {
    if (!pendingSaveConflict || !draft) return;
    var existing = getSession(pendingSaveConflict.existingSessionId);
    if (!existing) {
      showToast("置き換え先の記録が見つかりません");
      return;
    }
    var originalSessionId = draft.originalSessionId || draft.id || null;
    draft.id = existing.id;
    draft.originalSessionId = existing.id;
    draft.createdAt = existing.createdAt;
    if (originalSessionId && originalSessionId !== existing.id) {
      draft.previousSessionIdToRemove = originalSessionId;
    }
    var warningConfirmed = pendingSaveConflict.warningConfirmed;
    pendingSaveConflict = null;
    closeModal("copyConflictModal");
    commitWorkoutSave({ warningConfirmed: warningConfirmed, skipConflictCheck: true });
  }

  function mergeDraftWithExistingSession(existingSession) {
    if (!draft || !existingSession) return;
    var sourceSessionId = draft.originalSessionId || draft.id || null;
    var previousSessionId = sourceSessionId && sourceSessionId !== existingSession.id ? sourceSessionId : null;
    var incomingRecords = draft.records;
    var incomingCardios = draft.cardios;
    var incomingMemo = draft.memo;
    var incomingSourceScheduleId = draft.sourceScheduleId;
    var mergedDraft = createDraftFromSession(existingSession.id, draft.date, true);
    appendRecordsAndCardiosToDraft(mergedDraft, incomingRecords, incomingCardios);
    mergedDraft.memo = incomingMemo || mergedDraft.memo;
    if (incomingSourceScheduleId) mergedDraft.sourceScheduleId = incomingSourceScheduleId;
    if (previousSessionId) mergedDraft.previousSessionIdToRemove = previousSessionId;
    draft = mergedDraft;
  }

  function renderWorkout() {
    if (!draft) return;
    var isGym = draft.locationType === "gym";
    $("#locationBadge").textContent = isGym ? "GYM" : "HOME";
    $("#locationBadge").classList.toggle("location-badge--home", !isGym);
    $("#workoutTitle").textContent = isGym ? "ジムトレーニング" : "自宅トレーニング";
    $("#sessionDate").value = draft.date;
    $("#sessionMemo").value = draft.memo || "";
    $("#finishWorkoutButton").textContent = draft.id ? "変更を保存" : "トレーニングを保存";
    $("#saveRoutineButton").textContent = routineEditingId ? "ルーティーンを更新" : "ルーティーンとして保存";
    renderSelectedExercise();
    renderSavedSets();
    renderSavedCardios();
    updateDraftCalories();
  }

  function ensureDraftRecord(exerciseId) {
    var record = draft.records.find(function (item) { return item.exerciseId === exerciseId; });
    if (!record) {
      record = { tempId: makeId("draftrecord"), exerciseId: exerciseId, orderIndex: draft.records.length, sets: [] };
      draft.records.push(record);
    }
    return record;
  }

  function getLastHistoricalRecord(exerciseId) {
    var records = (dataIndexes ? (dataIndexes.recordsByExerciseId[exerciseId] || []).slice() : data.records.filter(function (record) { return record.exerciseId === exerciseId; })).sort(function (a, b) {
      var sessionA = getSession(a.sessionId) || {};
      var sessionB = getSession(b.sessionId) || {};
      var dateOrder = String(sessionB.date || "").localeCompare(String(sessionA.date || ""));
      if (dateOrder) return dateOrder;
      return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
    });
    return records.find(function (record) { return getRecordSets(record.id).length > 0; }) || null;
  }

  function getLastHistoricalSet(exerciseId) {
    var record = getLastHistoricalRecord(exerciseId);
    if (!record) return null;
    var sets = getRecordSets(record.id);
    return sets.length ? sets[sets.length - 1] : null;
  }

  function historicalExerciseSummary(exercise) {
    if (!exercise) return "前回の記録はありません";
    var record = getLastHistoricalRecord(exercise.id);
    if (!record) return "前回の記録はありません";
    var sets = getRecordSets(record.id);
    var lastSet = sets[sets.length - 1];
    if (!lastSet) return "前回の記録はありません";
    var weight = exercise.category === "BODYWEIGHT" ? "自重" : (Number(lastSet.weight || 0) / 1000).toFixed(1) + "kg";
    return "前回：" + weight + " × " + Number(lastSet.reps || 0) + "回 × " + sets.length + "セット";
  }

  function findDraftSet(tempId) {
    if (!draft || !tempId) return null;
    for (var recordIndex = 0; recordIndex < draft.records.length; recordIndex += 1) {
      var record = draft.records[recordIndex];
      for (var setIndex = 0; setIndex < record.sets.length; setIndex += 1) {
        if (record.sets[setIndex].tempId === tempId) return { record: record, set: record.sets[setIndex] };
      }
    }
    return null;
  }

  function renderSelectedExercise() {
    var exercise = getExercise(selectedExerciseId);
    var hasExercise = !!exercise;
    var isCardio = hasExercise && exercise.category === "CARDIO";
    var showSetEditor = hasExercise && !isCardio && (isAddingSet || !!editingSetTempId);
    $("#setEditorCard").classList.toggle("hidden", !showSetEditor);
    $("#cardioEditorCard").classList.toggle("hidden", !isCardio);
    if (!hasExercise) {
      $("#selectedExerciseIcon").textContent = "+";
      $("#selectedExerciseName").textContent = "種目を選択";
      $("#selectedExerciseMeta").textContent = "タップして一覧を開く";
      return;
    }
    $("#selectedExerciseIcon").textContent = exercise.name.slice(0, 1);
    $("#selectedExerciseName").textContent = exercise.name;
    if (isCardio) {
      $("#selectedExerciseMeta").textContent = "有酸素・時間や距離を入力";
      $("#cardioType").value = exercise.name;
      $("#cardioEditorTitle").textContent = editingCardioTempId ? exercise.name + "を編集中" : exercise.name + "を入力";
      $("#saveCardioButton").textContent = editingCardioTempId ? "この有酸素記録を更新" : "この有酸素記録を保存";
      updateCardioPreview();
      return;
    }
    $("#selectedExerciseMeta").textContent = CATEGORY_LABELS[exercise.category] + (exercise.category === "BODYWEIGHT" ? "・重量入力なし" : "・" + WEIGHT_STEPS[exercise.category].toFixed(1) + "kg刻み");
    if (!showSetEditor) return;
    var record = ensureDraftRecord(exercise.id);
    var editingRef = findDraftSet(editingSetTempId);
    if (editingRef && editingRef.record.exerciseId !== exercise.id) {
      editingSetTempId = null;
      editingRef = null;
    }
    var lastSet = record.sets.length ? record.sets[record.sets.length - 1] : getLastHistoricalSet(exercise.id);
    var inputSet = editingRef ? editingRef.set : lastSet;
    var nextNumber = record.sets.length + 1;
    var previousWeight = exercise.category === "BODYWEIGHT" ? "自重" : (inputSet ? (Number(inputSet.weight || 0) / 1000).toFixed(1) + "kg" : "--");
    $("#currentSetLabel").textContent = exercise.name + " セット" + (editingRef ? editingRef.set.setNumber : nextNumber);
    $("#setEditorSuffix").textContent = editingRef ? "を編集中" : "を入力";
    $("#previousSetSummary").textContent = inputSet ? "前回の記録：" + previousWeight + " × " + Number(inputSet.reps || 0) + "回" : "前回の記録はありません";
    $("#setEditorCard").classList.toggle("is-editing", !!editingRef);
    $("#saveSetButton").textContent = editingRef ? "このセットを更新" : "このセットを保存";
    $("#cancelSetEditButton").classList.toggle("hidden", !editingRef);
    $("#setSaveHint").textContent = editingRef ? "このセットを上書きします" : "保存後、次のセットを確認します";
    $("#weightBlock").classList.toggle("hidden", exercise.category === "BODYWEIGHT");
    $("#weightStepLabel").textContent = WEIGHT_STEPS[exercise.category].toFixed(1) + "kg刻み";
    $("#weightInput").step = WEIGHT_STEPS[exercise.category] || 1;
    $("#weightInput").value = exercise.category === "BODYWEIGHT" ? 0 : (inputSet ? (Number(inputSet.weight) / 1000).toFixed(1) : "0.0");
    $("#repsInput").value = inputSet ? inputSet.reps : 10;
    selectedRest = inputSet ? Number(inputSet.restSeconds) : 90;
    selectedRir = editingRef ? String(editingRef.set.rir == null ? "" : editingRef.set.rir) : null;
    $("#setMemo").value = editingRef ? (editingRef.set.memo || "") : "";
    renderSetChoices();
  }

  function renderSetChoices() {
    $$("#repsQuick button").forEach(function (button) {
      button.classList.toggle("is-selected", Number(button.dataset.reps) === Number($("#repsInput").value));
    });
    $$("#rirChoices button").forEach(function (button) { button.classList.toggle("is-selected", selectedRir !== null && button.dataset.rir === selectedRir); });
    $$("#restChoices button").forEach(function (button) { button.classList.toggle("is-selected", Number(button.dataset.rest) === Number(selectedRest)); });
  }

  function chooseExercise(exerciseId) {
    var exercise = getExercise(exerciseId);
    if (!exercise) return;
    editingSetTempId = null;
    editingCardioTempId = null;
    selectedExerciseId = exerciseId;
    isAddingSet = exercise.category !== "CARDIO";
    if (exercise.category !== "CARDIO") ensureDraftRecord(exerciseId);
    if (exercise.category === "CARDIO") {
      $("#cardioType").value = exercise.name;
      $("#cardioDuration").value = "";
      $("#cardioDistance").value = "";
      $("#cardioIncline").value = "";
      $("#cardioMemo").value = "";
    }
    closeModal("exerciseModal");
    renderSelectedExercise();
    renderSavedSets();
    renderSavedCardios();
    saveDraftNow();
    setTimeout(function () {
      $(exercise.category === "CARDIO" ? "#cardioEditorCard" : "#setEditorCard").scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  function renderExerciseBodyPartTabs() {
    $("#exerciseBodyPartTabs").innerHTML = BODY_PARTS.map(function (part) {
      var active = part.id === activeExerciseBodyPart;
      return '<button class="exercise-body-tab' + (active ? " is-active" : "") + '" type="button" role="tab" aria-selected="' + active + '" data-body-part="' + part.id + '">' + part.label + '</button>';
    }).join("");
  }

  function renderExerciseList() {
    var exercises = data.exercises.filter(function (exercise) {
      if (exercise.bodyPart !== activeExerciseBodyPart) return false;
      return activeExerciseBodyPart === "cardio" ? exercise.category === "CARDIO" : exercise.category !== "CARDIO";
    });
    if (!exercises.length) {
      $("#exerciseList").innerHTML = '<div class="empty-state">この部位の種目はまだありません</div>';
      return;
    }
    $("#exerciseList").innerHTML = exercises.map(function (exercise) {
      var selected = exercisePickerMode === "routine" ? routinePendingExerciseIds.indexOf(exercise.id) >= 0 : exercise.id === pendingExerciseId;
      return '<div class="exercise-choice-row' + (selected ? " is-selected" : "") + '"><button class="exercise-choice-main" type="button" data-exercise-id="' + exercise.id + '"><span class="exercise-choice-circle" aria-hidden="true"><i></i></span><span class="exercise-choice-name"><strong>' + escapeHtml(exercise.name) + '</strong><small>' + CATEGORY_LABELS[exercise.category] + '</small></span></button><button class="favorite-button ' + (exercise.isFavorite ? "is-favorite" : "") + '" type="button" data-favorite-id="' + exercise.id + '" aria-label="' + escapeHtml(exercise.name) + 'をお気に入りにする">★</button></div>';
    }).join("");
  }

  function openExercisePicker() {
    exercisePickerMode = "workout";
    var selected = getExercise(selectedExerciseId);
    pendingExerciseId = selectedExerciseId;
    activeExerciseBodyPart = selected && selected.bodyPart ? selected.bodyPart : "chest";
    $("#exerciseModalTitle").textContent = "種目を選択";
    $("#confirmExerciseSelection").textContent = "完了";
    $("#confirmExerciseSelection").disabled = !pendingExerciseId;
    renderExerciseBodyPartTabs();
    renderExerciseList();
    openModal("exerciseModal");
  }

  function cancelExerciseSelection() {
    pendingExerciseId = null;
    routinePendingExerciseIds = [];
    exercisePickerMode = "workout";
    closeModal("exerciseModal");
  }

  function confirmExerciseSelection() {
    if (exercisePickerMode === "routine") {
      routineEditorState.exerciseIds = routinePendingExerciseIds.filter(function (exerciseId, index, ids) {
        return ids.indexOf(exerciseId) === index && !!getExercise(exerciseId);
      });
      routinePendingExerciseIds = [];
      exercisePickerMode = "workout";
      pendingExerciseId = null;
      closeModal("exerciseModal");
      renderRoutineEditor();
      return;
    }
    if (!pendingExerciseId) return;
    var exerciseId = pendingExerciseId;
    pendingExerciseId = null;
    chooseExercise(exerciseId);
  }

  function setValueIssue(weightKg, reps, restSeconds) {
    if (![weightKg, reps, restSeconds].every(function (value) { return Number.isFinite(value) && value >= 0; })) return { invalid: "重量・回数・休憩時間には0以上の数値を入力してください" };
    if (weightKg >= 500) return { warning: "重量が" + weightKg + "kgになっています。入力内容に間違いはありませんか？" };
    if (reps >= 200) return { warning: "回数が" + reps + "回になっています。入力内容に間違いはありませんか？" };
    if (restSeconds >= 1800) return { warning: "休憩時間が" + restSeconds + "秒になっています。入力内容に間違いはありませんか？" };
    return {};
  }

  function cardioValueIssue(cardio) {
    var values = [cardio.durationMinutes, cardio.distanceKm, cardio.inclinePercent];
    if (!values.every(function (value) { return Number.isFinite(value) && value >= 0; })) return { invalid: "時間・距離・傾斜には0以上の数値を入力してください" };
    var result = calculateCardio(cardio);
    if (!Number.isFinite(result.speedKmh) || !Number.isFinite(result.calories)) return { invalid: "有酸素記録を正しく計算できません" };
    if (cardio.durationMinutes >= 600) return { warning: "運動時間が" + cardio.durationMinutes + "分になっています。入力内容に間違いはありませんか？" };
    if (cardio.distanceKm >= 200) return { warning: "距離が" + cardio.distanceKm + "kmになっています。入力内容に間違いはありませんか？" };
    if (cardio.inclinePercent > 40) return { warning: "傾斜が" + cardio.inclinePercent + "%になっています。入力内容に間違いはありませんか？" };
    if (result.speedKmh >= 50) return { warning: "平均速度が" + result.speedKmh.toFixed(1) + "km/hになっています。入力内容に間違いはありませんか？" };
    return {};
  }

  function draftValueIssue() {
    for (var recordIndex = 0; recordIndex < draft.records.length; recordIndex += 1) {
      var record = draft.records[recordIndex];
      for (var setIndex = 0; setIndex < record.sets.length; setIndex += 1) {
        var set = record.sets[setIndex];
        var setIssue = setValueIssue(Number(set.weight) / 1000, Number(set.reps), Number(set.restSeconds));
        if (setIssue.invalid || setIssue.warning) return setIssue;
      }
    }
    for (var cardioIndex = 0; cardioIndex < draft.cardios.length; cardioIndex += 1) {
      var cardioIssue = cardioValueIssue({
        type: draft.cardios[cardioIndex].type,
        durationMinutes: Number(draft.cardios[cardioIndex].durationMinutes),
        distanceKm: Number(draft.cardios[cardioIndex].distanceKm || 0),
        inclinePercent: Number(draft.cardios[cardioIndex].inclinePercent || 0)
      });
      if (cardioIssue.invalid || cardioIssue.warning) return cardioIssue;
    }
    return {};
  }

  function showNextSetConfirmation(exerciseId, completedSetNumber, wasUpdate) {
    if (nextSetExerciseId || !draft) return;
    var exercise = getExercise(exerciseId);
    var record = draft.records.find(function (item) { return item.exerciseId === exerciseId; });
    if (!exercise || !record) return;
    nextSetExerciseId = exerciseId;
    $("#nextSetConfirmTitle").textContent = exercise.name + "のセット" + completedSetNumber + (wasUpdate ? "を更新しました" : "を保存しました");
    $("#nextSetConfirmMessage").textContent = "続けて" + exercise.name + "のセット" + (record.sets.length + 1) + "を入力しますか？";
    openModal("nextSetConfirmModal");
  }

  function startConfirmedNextSet() {
    var exerciseId = nextSetExerciseId;
    nextSetExerciseId = null;
    closeModal("nextSetConfirmModal");
    if (!draft || !getExercise(exerciseId)) return;
    selectedExerciseId = exerciseId;
    editingSetTempId = null;
    isAddingSet = true;
    editingCardioTempId = null;
    selectedRir = null;
    renderSelectedExercise();
    renderSavedSets();
    updateDraftCalories();
    saveDraftNow();
    setTimeout(function () { $("#setEditorCard").scrollIntoView({ behavior: "smooth", block: "start" }); }, 50);
  }

  function closeNextSetInput() {
    nextSetExerciseId = null;
    closeModal("nextSetConfirmModal");
    selectedExerciseId = null;
    editingSetTempId = null;
    isAddingSet = false;
    editingCardioTempId = null;
    selectedRir = null;
    renderSelectedExercise();
    renderSavedSets();
    updateDraftCalories();
    saveDraftNow();
    setTimeout(function () { $("#savedSetsSection").scrollIntoView({ behavior: "smooth", block: "start" }); }, 50);
  }

  function saveCurrentSet(skipWarning) {
    var exercise = getExercise(selectedExerciseId);
    if (!exercise) return;
    if (!editingSetTempId && !isAddingSet) return;
    var rawReps = Number($("#repsInput").value);
    var rawWeight = exercise.category === "BODYWEIGHT" ? 0 : Number($("#weightInput").value);
    var rawRest = Number(selectedRest);
    var issue = setValueIssue(rawWeight, rawReps, rawRest);
    if (issue.invalid) { showToast(issue.invalid); return; }
    if (issue.warning && options.warningConfirmed !== true) {
      askConfirm(issue.warning, "このまま保存", function () { saveCurrentSet(true); }, "入力に戻る");
      return;
    }
    var reps = Math.round(rawReps);
    if (reps < 1) { showToast("回数を入力してください"); $("#repsInput").focus(); return; }
    var weightKg = rawWeight;
    var setValues = {
      weight: Math.round(weightKg * 1000),
      reps: reps,
      rir: selectedRir == null ? "" : selectedRir,
      restSeconds: rawRest,
      memo: $("#setMemo").value.trim()
    };
    var editingRef = findDraftSet(editingSetTempId);
    if (editingSetTempId) {
      if (!editingRef) {
        showToast("編集対象のセットが見つかりません");
        return;
      }
      editingRef.set.weight = setValues.weight;
      editingRef.set.reps = setValues.reps;
      editingRef.set.rir = setValues.rir;
      editingRef.set.restSeconds = setValues.restSeconds;
      editingRef.set.memo = setValues.memo;
      var updatedSetNumber = editingRef.set.setNumber;
      editingSetTempId = null;
      isAddingSet = false;
      selectedExerciseId = null;
      selectedRir = null;
      renderSelectedExercise();
      renderSavedSets();
      updateDraftCalories();
      saveDraftNow();
      showNextSetConfirmation(exercise.id, updatedSetNumber, true);
      return;
    }
    editingSetTempId = null;
    var record = ensureDraftRecord(exercise.id);
    record.sets.push({
      tempId: makeId("draftset"), setNumber: record.sets.length + 1, weight: setValues.weight, reps: setValues.reps,
      rir: setValues.rir, restSeconds: setValues.restSeconds, memo: setValues.memo
    });
    var savedSetNumber = record.sets.length;
    editingSetTempId = null;
    isAddingSet = false;
    selectedExerciseId = null;
    selectedRir = null;
    renderSelectedExercise();
    renderSavedSets();
    updateDraftCalories();
    saveDraftNow();
    showNextSetConfirmation(exercise.id, savedSetNumber, false);
  }

  function startEditSet(tempId) {
    var editingRef = findDraftSet(tempId);
    if (!editingRef) return;
    editingSetTempId = tempId;
    isAddingSet = false;
    selectedExerciseId = editingRef.record.exerciseId;
    renderSelectedExercise();
    var exercise = getExercise(editingRef.record.exerciseId);
    $("#weightInput").value = exercise && exercise.category === "BODYWEIGHT" ? 0 : (Number(editingRef.set.weight) / 1000).toFixed(1);
    $("#repsInput").value = editingRef.set.reps;
    selectedRir = String(editingRef.set.rir == null ? "" : editingRef.set.rir);
    selectedRest = Number(editingRef.set.restSeconds || 90);
    $("#setMemo").value = editingRef.set.memo || "";
    $("#currentSetLabel").textContent = (exercise ? exercise.name + " " : "") + "セット" + editingRef.set.setNumber;
    $("#setEditorSuffix").textContent = "を編集中";
    $("#saveSetButton").textContent = "このセットを更新";
    $("#cancelSetEditButton").classList.remove("hidden");
    renderSetChoices();
    renderSavedSets();
    saveDraftNow();
    setTimeout(function () { $("#setEditorCard").scrollIntoView({ behavior: "smooth", block: "start" }); }, 50);
  }

  function cancelSetEdit() {
    if (!editingSetTempId) return;
    editingSetTempId = null;
    isAddingSet = false;
    selectedExerciseId = null;
    renderSelectedExercise();
    renderSavedSets();
    showToast("編集をキャンセルしました");
  }

  function updateTodayMenuSummary() {
    if (!draft) return;
    var setCount = draft.records.reduce(function (sum, record) { return sum + record.sets.length; }, 0);
    var cardioCount = draft.cardios.length;
    var pendingCardioCount = (draft.pendingCardioTypes || []).length;
    var exerciseCount = draft.records.length + cardioCount + pendingCardioCount;
    var labels = [];
    if (setCount) labels.push(setCount + "セット");
    if (cardioCount) labels.push(cardioCount + "有酸素");
    if (!labels.length && exerciseCount) labels.push(exerciseCount + "種目");
    $("#savedSetsSection").classList.remove("hidden");
    $("#emptyDraftMenu").classList.toggle("hidden", exerciseCount > 0);
    $("#setCountBadge").textContent = labels.length ? labels.join("・") : "0件";
  }

  function renderSavedSets() {
    if (!draft) return;
    $("#savedSetsList").innerHTML = draft.records.map(function (record) {
      var exercise = getExercise(record.exerciseId);
      var previousSummary = historicalExerciseSummary(exercise);
      var setRows = record.sets.map(function (set) {
        var weightText = exercise && exercise.category === "BODYWEIGHT" ? "自重" : (Number(set.weight) / 1000).toFixed(1) + "kg";
        var editingClass = set.tempId === editingSetTempId ? " is-editing" : "";
        return '<div class="saved-item saved-item--editable' + editingClass + '" data-edit-set="' + set.tempId + '"><button class="saved-item-main" type="button" aria-label="セット' + set.setNumber + 'を編集"><span class="set-index">' + set.setNumber + '</span><span class="saved-item-text"><strong>' + weightText + ' × ' + set.reps + '回</strong><small>' + RIR_LABELS[set.rir || ""] + '・休憩' + set.restSeconds + '秒' + (set.memo ? '・' + escapeHtml(set.memo) : '') + '</small></span><span class="edit-cue">編集</span></button><button class="delete-mini" type="button" data-delete-set="' + set.tempId + '" aria-label="セットを削除">×</button></div>';
      }).join("");
      var content = record.sets.length ? '<div class="saved-current-label">今回の記録</div>' + setRows : '';
      return '<div class="saved-group"><div class="saved-group-head"><span class="saved-group-title"><strong>' + escapeHtml(exercise ? exercise.name : "不明な種目") + '</strong><small>' + escapeHtml(previousSummary) + '</small></span><span>' + record.sets.length + 'セット</span></div>' + content + '<button class="saved-set-add-button" type="button" data-add-set-exercise="' + record.exerciseId + '">＋ セットを追加</button></div>';
    }).join("");
    updateTodayMenuSummary();
  }

  function deleteDraftSet(tempId) {
    if (editingSetTempId === tempId) {
      editingSetTempId = null;
      isAddingSet = false;
      selectedExerciseId = null;
    }
    draft.records.forEach(function (record) {
      record.sets = record.sets.filter(function (set) { return set.tempId !== tempId; });
      record.sets.forEach(function (set, index) { set.setNumber = index + 1; });
    });
    draft.records = draft.records.filter(function (record) { return record.sets.length || record.exerciseId === selectedExerciseId; });
    renderSelectedExercise();
    renderSavedSets();
    updateDraftCalories();
    saveDraftNow();
  }

  function cardioFormValue() {
    return {
      type: $("#cardioType").value,
      durationMinutes: numberValue("#cardioDuration"),
      distanceKm: numberValue("#cardioDistance"),
      inclinePercent: numberValue("#cardioIncline"),
      memo: $("#cardioMemo").value.trim()
    };
  }

  function updateCardioPreview() {
    var cardio = cardioFormValue();
    if (!cardio.durationMinutes) {
      $("#cardioPreview").innerHTML = '<span>速度 <strong>--</strong></span><span>概算消費カロリー <strong>--</strong></span>';
      return;
    }
    var result = calculateCardio(cardio);
    $("#cardioPreview").innerHTML = '<span>速度 <strong>' + (result.speedKmh ? result.speedKmh.toFixed(1) + " km/h" : "距離未入力") + '</strong></span><span>概算消費カロリー <strong>' + Math.round(result.calories) + ' kcal</strong></span>';
  }

  function syncEditingCardioFromForm() {
    if (!draft || !editingCardioTempId) return;
    var index = draft.cardios.findIndex(function (cardio) { return cardio.tempId === editingCardioTempId; });
    if (index < 0) return;
    var values = cardioFormValue();
    var result = calculateCardio(values);
    draft.cardios[index] = {
      tempId: editingCardioTempId,
      type: values.type,
      durationMinutes: values.durationMinutes,
      distanceKm: values.distanceKm,
      inclinePercent: values.inclinePercent,
      memo: values.memo,
      speedKmh: result.speedKmh,
      calories: result.calories
    };
    renderSavedCardios();
    updateDraftCalories();
  }

  function handleCardioInputChange() {
    updateCardioPreview();
    scheduleDraftSave();
  }

  function saveCardio(skipWarning) {
    var cardio = cardioFormValue();
    var issue = cardioValueIssue(cardio);
    if (issue.invalid) { showToast(issue.invalid); return; }
    if (cardio.durationMinutes < 1) { showToast("運動時間を入力してください"); $("#cardioDuration").focus(); return; }
    if (issue.warning && options.warningConfirmed !== true) {
      askConfirm(issue.warning, "このまま保存", function () { saveCardio(true); }, "入力に戻る");
      return;
    }
    if (editingCardioTempId) {
      syncEditingCardioFromForm();
      editingCardioTempId = null;
      $("#cardioType").value = "ウォーキング";
      $("#cardioDuration").value = "";
      $("#cardioDistance").value = "";
      $("#cardioIncline").value = "";
      $("#cardioMemo").value = "";
      $("#cardioEditorTitle").textContent = cardio.type + "を入力";
      $("#saveCardioButton").textContent = "この有酸素記録を保存";
      updateCardioPreview();
      renderSavedCardios();
      updateDraftCalories();
      saveDraftNow();
      showToast("有酸素記録を更新しました");
      return;
    }
    var result = calculateCardio(cardio);
    cardio.tempId = makeId("draftcardio");
    cardio.speedKmh = result.speedKmh;
    cardio.calories = result.calories;
    draft.cardios.push(cardio);
    draft.pendingCardioTypes = (draft.pendingCardioTypes || []).filter(function (type) { return type !== cardio.type; });
    $("#cardioDuration").value = "";
    $("#cardioDistance").value = "";
    $("#cardioIncline").value = "";
    $("#cardioMemo").value = "";
    updateCardioPreview();
    renderSavedCardios();
    updateDraftCalories();
    saveDraftNow();
    showToast("有酸素運動を追加しました");
  }

  function renderSavedCardios() {
    if (!draft) return;
    var savedHtml = draft.cardios.map(function (cardio) {
      var result = calculateCardio(cardio);
      var editingClass = cardio.tempId === editingCardioTempId ? " is-editing" : "";
      var exerciseId = cardioExerciseId(cardio.type);
      var details = [formatNumberForInput(Number(cardio.durationMinutes || 0), 1) + "分"];
      if (Number(cardio.distanceKm || 0) > 0) details.push(formatNumberForInput(Number(cardio.distanceKm), 0.1) + "km");
      if (Number(cardio.inclinePercent || 0) > 0) details.push("傾斜" + formatNumberForInput(Number(cardio.inclinePercent), 0.5) + "%");
      details.push(Math.round(result.calories) + "kcal");
      return '<div class="saved-group saved-group--cardio"><div class="saved-group-head"><button class="saved-group-add" type="button" data-add-same-exercise="' + exerciseId + '"><span class="saved-group-title"><strong>' + escapeHtml(cardio.type) + '</strong><small>前回の記録</small></span><em>記録を追加</em></button><span>有酸素</span></div><div class="saved-item saved-item--editable' + editingClass + '" data-edit-cardio="' + cardio.tempId + '"><button class="saved-item-main" type="button" aria-label="' + escapeHtml(cardio.type) + 'を編集"><span class="set-index">' + (cardio.type === "ランニング" || cardio.type === "ジョギング" ? "走" : "有") + '</span><span class="saved-item-text"><strong>' + details.join(" / ") + '</strong><small>' + (result.speedKmh ? "平均速度 " + result.speedKmh.toFixed(1) + "km/h" : "距離なしでも保存できます") + (cardio.memo ? "・" + escapeHtml(cardio.memo) : "") + '</small></span><span class="edit-cue">編集</span></button><button class="delete-mini" type="button" data-delete-cardio="' + cardio.tempId + '" aria-label="有酸素記録を削除">×</button></div></div>';
    }).join("");
    var pendingHtml = (draft.pendingCardioTypes || []).map(function (type) {
      var exerciseId = cardioExerciseId(type);
      return '<div class="saved-group saved-group--cardio"><div class="saved-group-head"><button class="saved-group-add" type="button" data-add-same-exercise="' + exerciseId + '"><span class="saved-group-title"><strong>' + escapeHtml(type) + '</strong><small>まだ入力されていません</small></span><em>記録を入力</em></button><span>有酸素</span></div></div>';
    }).join("");
    $("#savedCardioList").innerHTML = savedHtml + pendingHtml;
    updateTodayMenuSummary();
  }

  function deleteDraftCardio(tempId) {
    draft.cardios = draft.cardios.filter(function (cardio) { return cardio.tempId !== tempId; });
    if (editingCardioTempId === tempId) {
      editingCardioTempId = null;
      $("#cardioDuration").value = "";
      $("#cardioDistance").value = "";
      $("#cardioIncline").value = "";
      $("#cardioMemo").value = "";
      $("#saveCardioButton").textContent = "この有酸素記録を保存";
      renderSelectedExercise();
      updateCardioPreview();
    }
    renderSavedCardios();
    updateDraftCalories();
    saveDraftNow();
  }

  function updateDraftCalories() { $("#sessionCalories").textContent = Math.round(draftCalories()); }

  function removeSessionData(sessionId) {
    if (!sessionId) return;
    var recordIds = data.records.filter(function (record) { return record.sessionId === sessionId; }).map(function (record) { return record.id; });
    data.sets = data.sets.filter(function (set) { return recordIds.indexOf(set.recordId) < 0; });
    data.records = data.records.filter(function (record) { return record.sessionId !== sessionId; });
    data.cardios = data.cardios.filter(function (cardio) { return cardio.sessionId !== sessionId; });
    data.sessions = data.sessions.filter(function (session) { return session.id !== sessionId; });
  }

  function warnDuplicateSameDateLocationSessions(dateValue, locationType) {
    var duplicateSessions = getSessionsForDate(dateValue).filter(function (session) {
      return session.locationType === locationType;
    });
    if (duplicateSessions.length > 1) {
      console.warn("Duplicate same-date same-location sessions", duplicateSessions);
    }
  }

  function findSaveConflictSession() {
    if (!draft) return null;
    warnDuplicateSameDateLocationSessions(draft.date, draft.locationType);
    return getSessionsForDate(draft.date).find(function (session) {
      var isSameLocation = session.locationType === draft.locationType;
      var isCurrentEditingSession = session.id === draft.id || session.id === draft.originalSessionId;
      return isSameLocation && !isCurrentEditingSession;
    }) || null;
  }

  function openSaveConflictModal(existingSession, warningConfirmed) {
    if (!draft || !existingSession) return;
    pendingCopyConflict = null;
    pendingSaveConflict = {
      existingSessionId: existingSession.id,
      originalSessionId: draft.originalSessionId || draft.id || null,
      targetDate: draft.date,
      locationType: draft.locationType,
      warningConfirmed: warningConfirmed === true
    };
    var conflictDate = dateFromString(draft.date);
    var locationLabel = draft.locationType === "home" ? "自宅" : "ジム";
    $("#copyConflictMessage").textContent = (conflictDate.getMonth() + 1) + "月" + conflictDate.getDate() + "日の" + locationLabel + "記録はすでにあります。";
    $("#copyConflictCancel").textContent = "日付入力に戻る";
    openModal("copyConflictModal");
  }

  function saveWorkout(skipWarning) {
    requestWorkoutSave({ warningConfirmed: skipWarning === true });
  }

  function requestWorkoutSave(options) {
    options = options || {};
    if (!draft) return;
    var setCount = draft.records.reduce(function (sum, record) { return sum + record.sets.length; }, 0);
    if (!setCount && !draft.cardios.length) { showToast("セットまたは有酸素運動を1件以上記録してください"); return; }
    draft.date = $("#sessionDate").value || todayString();
    draft.memo = $("#sessionMemo").value.trim();
    var issue = draftValueIssue();
    if (issue.invalid) { showToast(issue.invalid); return; }
    if (issue.warning && options.warningConfirmed !== true) {
      askConfirm(issue.warning, "このまま保存", function () { requestWorkoutSave({ warningConfirmed: true, skipConflictCheck: options.skipConflictCheck === true }); }, "入力に戻る");
      return;
    }
    var conflictSession = options.skipConflictCheck === true ? null : findSaveConflictSession();
    if (conflictSession) {
      openSaveConflictModal(conflictSession, options.warningConfirmed === true);
      return;
    }
    commitWorkoutSave({ warningConfirmed: options.warningConfirmed === true, skipConflictCheck: true });
  }

  function commitWorkoutSave(options) {
    options = options || {};
    if (!draft) return;
    draft.date = $("#sessionDate").value || draft.date || todayString();
    draft.memo = $("#sessionMemo").value.trim();
    var stamp = nowIso();
    var sessionId = draft.id || makeId("session");
    var oldSession = getSession(sessionId);
    var validRecords = draft.records.filter(function (record) { return record.sets.length > 0; });
    var cardioTotal = 0;
    var preparedCardios = draft.cardios.map(function (cardio) { var result = calculateCardio(cardio); cardioTotal += result.calories; return { cardio: cardio, result: result }; });
    var totalCalories = calculateStrengthCaloriesForRecords(validRecords) + cardioTotal;
    var usedExerciseIds = validRecords.map(function (record) { return record.exerciseId; });
    var previousSessionIdToRemove = draft.previousSessionIdToRemove;
    var saved = runDataTransaction(function () {
      if (oldSession) removeSessionData(sessionId);
      if (previousSessionIdToRemove && previousSessionIdToRemove !== sessionId) removeSessionData(previousSessionIdToRemove);
      validRecords.forEach(function (record, recordIndex) {
        var recordId = makeId("record");
        data.records.push({ id: recordId, sessionId: sessionId, exerciseId: record.exerciseId, orderIndex: recordIndex, createdAt: stamp, updatedAt: stamp });
        record.sets.forEach(function (set, setIndex) {
          data.sets.push({ id: makeId("set"), recordId: recordId, setNumber: setIndex + 1, weight: Math.round(Number(set.weight || 0)), reps: Number(set.reps), rir: set.rir || "", restSeconds: Number(set.restSeconds || 90), memo: set.memo || "", createdAt: stamp, updatedAt: stamp });
        });
      });
      preparedCardios.forEach(function (prepared) {
        var cardio = prepared.cardio, result = prepared.result;
        data.cardios.push({ id: makeId("cardio"), sessionId: sessionId, type: cardio.type, distanceKm: Number(cardio.distanceKm || 0), durationMinutes: Number(cardio.durationMinutes), speedKmh: result.speedKmh, inclinePercent: Number(cardio.inclinePercent || 0), calories: result.calories, memo: cardio.memo || "", createdAt: stamp, updatedAt: stamp });
      });
      data.sessions.push({ id: sessionId, date: draft.date, locationType: draft.locationType, totalCalories: totalCalories, memo: draft.memo, createdAt: oldSession ? oldSession.createdAt : stamp, updatedAt: stamp });
      if (draft.sourceScheduleId) data.scheduledRoutines = data.scheduledRoutines.filter(function (schedule) { return schedule.id !== draft.sourceScheduleId; });
      data.recentExerciseIds = usedExerciseIds.concat(data.recentExerciseIds.filter(function (id) { return usedExerciseIds.indexOf(id) < 0; })).slice(0, 12);
    });
    if (!saved) return;
    pendingSaveConflict = null;
    clearSavedDraft();
    var savedSessionDate = draft.date;
    draft = null;
    routineEditingId = null;
    selectedExerciseId = null;
    editingSetTempId = null;
    calendarCursor = dateFromString(savedSessionDate);
    calendarCursor.setDate(1);
    renderHome();
    showScreen("home");
    showToast(oldSession ? "トレーニングを更新しました" : "トレーニングを保存しました");
  }

  function renderDaySummary(dateValue) {
    var sessions = getSessionsForDate(dateValue);
    var schedules = data.scheduledRoutines.filter(function (schedule) { return schedule.date === dateValue; });
    $("#dayModalTitle").textContent = formatDateJa(dateValue);
    if (!sessions.length && !schedules.length) {
      $("#daySummaryContent").innerHTML = '<div class="empty-state">この日の記録はまだありません</div>';
      $("#daySummaryActions").innerHTML = '<button class="finish-button" type="button" data-day-start="gym" data-day-date="' + dateValue + '">ジムトレーニングを記録</button><button class="outline-button" type="button" data-day-start="home" data-day-date="' + dateValue + '">自宅トレーニングを記録</button><button class="outline-button outline-button--blue" type="button" data-day-routine-date="' + dateValue + '">ルーティーンから登録</button><button class="outline-button" type="button" data-close-modal="dayModal">閉じる</button>';
      openModal("dayModal");
      return;
    }
    var html = "";
    if (sessions.length) {
      var dayTotal = sessions.reduce(function (sum, session) { return sum + calculateSessionCalories(session.id); }, 0);
      html += '<div class="day-total"><span>概算消費カロリー</span><strong>' + Math.round(dayTotal) + ' kcal</strong></div><p class="day-section-label">実績</p>';
    }
    sessions.forEach(function (session) {
      var lines = [];
      getSessionRecords(session.id).forEach(function (record) {
        var exercise = getExercise(record.exerciseId);
        var sets = getRecordSets(record.id);
        var detail = sets.map(function (set) { return (exercise && exercise.category === "BODYWEIGHT" ? "自重" : (Number(set.weight) / 1000).toFixed(1) + "kg") + "×" + set.reps + "回"; }).join(" / ");
        lines.push('<div class="summary-line"><strong>' + escapeHtml(exercise ? exercise.name : "不明な種目") + '</strong><span>' + detail + '</span></div>');
      });
      getSessionCardios(session.id).forEach(function (cardio) {
        lines.push('<div class="summary-line"><strong>' + escapeHtml(cardio.type) + '</strong><span>' + cardio.durationMinutes + '分' + (cardio.distanceKm ? '・' + cardio.distanceKm + 'km' : '') + '</span></div>');
      });
      if (session.memo) lines.push('<div class="summary-line"><strong>メモ</strong><span>' + escapeHtml(session.memo) + '</span></div>');
      var sessionLabel = session.locationType === "gym" ? "ジムトレーニング" : "自宅トレーニング";
      var sessionActions = '<div class="summary-session-actions"><button type="button" data-copy-session="' + session.id + '">コピーして開始</button><button type="button" data-edit-session="' + session.id + '">編集</button><button class="danger-text" type="button" data-delete-session="' + session.id + '">削除</button></div>';
      html += '<section class="summary-session"><div class="summary-session-head"><strong>' + sessionLabel + '</strong><div class="summary-session-head-actions"><span>' + Math.round(calculateSessionCalories(session.id)) + ' kcal</span></div></div><div class="summary-lines">' + (lines.length ? lines.join("") : '<div class="summary-line"><span>記録内容なし</span></div>') + '</div>' + sessionActions + '</section>';
    });
    if (schedules.length) html += '<p class="day-section-label day-section-label--planned">予定メニュー</p>';
    schedules.forEach(function (schedule) {
      var routine = getRoutine(schedule.routineId);
      if (!routine) return;
      html += '<article class="planned-routine"><div><strong>' + escapeHtml(routine.name) + '</strong><small>' + (routine.locationType === "home" ? "自宅" : "ジム") + '・' + routineItemCount(routine) + '種目</small></div><button type="button" data-start-schedule="' + schedule.id + '">この予定で記録を始める</button><button type="button" data-delete-schedule="' + schedule.id + '">予定を削除</button></article>';
    });
    $("#daySummaryContent").innerHTML = html;
    if (sessions.length) {
      $("#daySummaryActions").innerHTML = '<button class="outline-button" type="button" data-close-modal="dayModal">閉じる</button>';
    } else {
      $("#daySummaryActions").innerHTML = '<button class="finish-button" type="button" data-day-start="gym" data-day-date="' + dateValue + '">ジムトレーニングを記録</button><button class="outline-button" type="button" data-day-start="home" data-day-date="' + dateValue + '">自宅トレーニングを記録</button><button class="outline-button outline-button--blue" type="button" data-day-routine-date="' + dateValue + '">ルーティーンから登録</button><button class="outline-button" type="button" data-close-modal="dayModal">閉じる</button>';
    }
    openModal("dayModal");
  }

  function deleteSession(sessionId) {
    if (!runDataTransaction(function () { removeSessionData(sessionId); })) return;
    closeModal("dayModal");
    renderHome();
    showToast("記録を削除しました");
  }

  function bindEvents() {
    on("#homeSettingsButton", "click", function () { openModal("settingsMenuModal"); });
    on("#homeRoutineMenuButton", "click", function () { openModal("routineMenuModal"); });
    on("#homeRecordMenuButton", "click", function () { openModal("recordMenuModal"); });
    on("#homeRoutineCreateButton", "click", function () { closeModal("routineMenuModal"); openRoutineCreator(false); });
    on("#homeGymStartButton", "click", function () { closeModal("recordMenuModal"); startTodayLocation("gym"); });
    on("#homeHomeStartButton", "click", function () { closeModal("recordMenuModal"); startTodayLocation("home"); });
    on("#settingsProfileButton", "click", function () { closeModal("settingsMenuModal"); openProfile(); });
    on("#settingsAppearanceButton", "click", function () { closeModal("settingsMenuModal"); renderAppearanceSettings(); openModal("appearanceSettingsModal"); });
    on("#appearanceSettingsModal", "click", function (event) {
      var appearanceButton = event.target.closest("[data-appearance-option]");
      if (appearanceButton) {
        setAppearanceSetting(appearanceButton.dataset.appearanceOption);
        return;
      }
      var themeButton = event.target.closest("[data-color-theme-option]");
      if (themeButton) setColorTheme(themeButton.dataset.colorThemeOption);
    });
    on("#settingsRoutineButton", "click", function () { closeModal("routineMenuModal"); openRoutineList(todayString(), "manage"); });
    on("#backupDataButton", "click", function () { var button = this; runButtonLocked(button, function () { downloadBackupData("gymlog-backup"); }); });
    on("#restoreDataButton", "click", function () { $("#restoreDataInput").value = ""; $("#restoreDataInput").click(); });
    on("#restoreSnapshotButton", "click", restorePreRestoreSnapshot);
    on("#restoreDataInput", "change", function () { readBackupFile(this.files && this.files[0]); });
    on("#exportCorruptDataButton", "click", downloadCorruptData);
    on("#recoveryRestoreButton", "click", function () { $("#restoreDataInput").value = ""; $("#restoreDataInput").click(); });
    on("#startFreshDataButton", "click", function () { var button = this; runButtonLocked(button, startWithFreshData); });
    on("#discardSavedDraft", "click", discardSavedDraft);
    on("#resumeSavedDraft", "click", resumeSavedDraft);
    on("#nextSetYesButton", "click", function () { var button = this; runButtonLocked(button, startConfirmedNextSet); });
    on("#nextSetNoButton", "click", function () { var button = this; runButtonLocked(button, closeNextSetInput); });
    on("#openProgressButton", "click", openProgressPage);
    on("#backFromProgressButton", "click", function () { renderHome(); showScreen("home"); });
    $$('[data-progress-tab]').forEach(function (button) {
      button.addEventListener("click", function () {
        progressState.tab = button.dataset.progressTab;
        progressState.metric = progressState.tab === "strength" ? "maxWeight" : "distance";
        renderProgressPage();
      });
    });
    on("#progressExerciseSelect", "change", function () {
      if (progressState.tab === "strength") progressState.exerciseId = this.value;
      else progressState.cardioType = this.value;
      renderProgressPage();
    });
    on("#progressMetricSelect", "change", function () { progressState.metric = this.value; renderProgressPage(); });
    on("#progressRangeSelect", "change", function () { progressState.range = this.value; renderProgressPage(); });
    on("#progressChart", "pointerover", function (event) {
      var point = event.target.closest("[data-chart-point]");
      if (point) showProgressChartTooltip(point);
    });
    on("#progressChart", "pointerout", function (event) {
      var point = event.target.closest("[data-chart-point]");
      if (point) hideProgressChartTooltip();
    });
    on("#progressChart", "click", function (event) {
      var point = event.target.closest("[data-chart-point]");
      if (point) { event.stopPropagation(); showProgressChartTooltip(point); }
      else hideProgressChartTooltip();
    });
    on("#progressChart", "focusin", function (event) {
      var point = event.target.closest("[data-chart-point]");
      if (point) showProgressChartTooltip(point);
    });
    on("#progressChart", "focusout", hideProgressChartTooltip);
    on("#openRoutineListButton", "click", function () { openRoutineList(draft ? draft.date : todayString(), "use"); });
    on("#saveRoutineButton", "click", openRoutineSaveModal);
    on("#confirmRoutineSave", "click", function () { var button = this; runButtonLocked(button, saveRoutineFromDraft); });
    on("#routineAddExerciseButton", "click", openRoutineExercisePicker);
    on("#routineNameInput", "input", function () { if (routineEditorState) routineEditorState.name = this.value; });
    on("#routineLocationType", "change", function () { if (routineEditorState) routineEditorState.locationType = this.value === "home" ? "home" : "gym"; });
    on("#emptyAddExerciseButton", "click", openExercisePicker);
    on("#emptyCopyPastButton", "click", copyLatestPastMenu);
    on("#prevMonth", "click", function () { calendarCursor.setMonth(calendarCursor.getMonth() - 1); renderHome(); });
    on("#nextMonth", "click", function () { calendarCursor.setMonth(calendarCursor.getMonth() + 1); renderHome(); });
    on("#todayMonth", "click", function () { calendarCursor = new Date(); calendarCursor.setDate(1); renderHome(); });
    on("#calendarGrid", "click", function (event) { var button = event.target.closest("[data-calendar-date]"); if (button) renderDaySummary(button.dataset.calendarDate); });
    on("#copyToTodayButton", "click", function () {
      if (copySourceSessionId) copySessionToDate(copySourceSessionId, todayString());
    });
    on("#copyToSelectedDateButton", "click", function () {
      var targetDate = $("#copyTargetDate").value;
      if (!targetDate) { showToast("コピー先の日付を選んでください"); $("#copyTargetDate").focus(); return; }
      if (copySourceSessionId) copySessionToDate(copySourceSessionId, targetDate);
    });
    on("#copyConflictAppend", "click", function () { var button = this; runButtonLocked(button, function () { handleConflictModalAction("append"); }); });
    on("#copyConflictReplace", "click", function () { var button = this; runButtonLocked(button, function () { handleConflictModalAction("replace"); }); });
    on("#copyConflictCancel", "click", function () { var button = this; runButtonLocked(button, handleConflictModalCancel); });

    on("#profileForm", "submit", function (event) {
      event.preventDefault();
      var submitButton = event.submitter || $("#profileForm button[type='submit']");
      if (submitButton && submitButton.disabled) return;
      if (submitButton) submitButton.disabled = true;
      var stamp = nowIso();
      var old = data.profile || {};
      var nextProfile = { id: old.id || makeId("profile"), weightKg: numberValue("#profileWeight"), heightCm: numberValue("#profileHeight"), age: Math.round(numberValue("#profileAge")), gender: $("#profileGender").value, createdAt: old.createdAt || stamp, updatedAt: stamp };
      if (!runDataTransaction(function () { data.profile = nextProfile; })) { if (submitButton) submitButton.disabled = false; return; }
      closeModal("profileModal"); renderHome(); if (draft) updateDraftCalories(); showToast("プロフィールを保存しました");
      if (submitButton) submitButton.disabled = false;
    });
    on("#resetDataButton", "click", function () {
      askConfirm("プロフィールとすべてのトレーニング記録を削除します。この操作は元に戻せません。", "すべて削除", function () {
        if (!runDataTransaction(function () { data = blankData(); })) return;
        clearSavedDraft(); closeModal("profileModal"); renderHome(); showToast("すべてのデータを削除しました");
      });
    });

    on("#backHomeButton", "click", function () { if (draft) saveDraftNow(); draft = null; routineEditingId = null; renderHome(); showScreen("home"); });
    on("#finishTopButton", "click", function () { var button = this; runButtonLocked(button, saveWorkout); });
    on("#finishWorkoutButton", "click", function () { var button = this; runButtonLocked(button, saveWorkout); });
    on("#sessionDate", "change", function () { if (draft) { draft.date = this.value; scheduleDraftSave(); } });
    on("#sessionMemo", "input", function () { if (draft) { draft.memo = this.value; scheduleDraftSave(); } });
    on("#exercisePickerButton", "click", openExercisePicker);
    on("#chooseAnotherExercise", "click", openExercisePicker);
    on("#cancelExerciseSelection", "click", cancelExerciseSelection);
    on("#confirmExerciseSelection", "click", confirmExerciseSelection);
    on("#exerciseBodyPartTabs", "click", function (event) {
      var tab = event.target.closest("[data-body-part]");
      if (!tab) return;
      activeExerciseBodyPart = tab.dataset.bodyPart;
      renderExerciseBodyPartTabs();
      renderExerciseList();
    });
    on("#exerciseList", "click", function (event) {
      var favorite = event.target.closest("[data-favorite-id]");
      if (favorite) {
        event.stopPropagation();
        var exercise = getExercise(favorite.dataset.favoriteId);
        if (exercise && runDataTransaction(function () { exercise.isFavorite = !exercise.isFavorite; exercise.updatedAt = nowIso(); })) renderExerciseList();
        return;
      }
      var option = event.target.closest("[data-exercise-id]");
      if (option) {
        if (exercisePickerMode === "routine") {
          var routineExerciseId = option.dataset.exerciseId;
          var selectedIndex = routinePendingExerciseIds.indexOf(routineExerciseId);
          if (selectedIndex >= 0) routinePendingExerciseIds.splice(selectedIndex, 1);
          else routinePendingExerciseIds.push(routineExerciseId);
          renderExerciseList();
          return;
        }
        pendingExerciseId = option.dataset.exerciseId;
        $("#confirmExerciseSelection").disabled = false;
        renderExerciseList();
      }
    });
    on("#openAddExercise", "click", function () {
      if (exercisePickerMode !== "routine") closeModal("exerciseModal");
      $("#newExerciseName").value = "";
      $("#newExerciseBodyPart").value = activeExerciseBodyPart === "cardio" ? "other" : activeExerciseBodyPart;
      openModal("addExerciseModal");
    });
    on("#addExerciseForm", "submit", function (event) {
      event.preventDefault();
      var name = $("#newExerciseName").value.trim();
      var category = $("#newExerciseCategory").value;
      var bodyPart = $("#newExerciseBodyPart").value;
      var existingExercise = data.exercises.find(function (item) { return item.name === name; });
      if (existingExercise) {
        closeModal("addExerciseModal");
        if (exercisePickerMode === "routine") {
          if (routinePendingExerciseIds.indexOf(existingExercise.id) < 0) routinePendingExerciseIds.push(existingExercise.id);
          renderExerciseList();
          showToast("種目を選択しました");
          return;
        }
        chooseExercise(existingExercise.id);
        showToast("同じ名前の種目を選択しました");
        return;
      }
      var stamp = nowIso();
      var exercise = { id: makeId("ex"), name: name, category: category, bodyPart: bodyPart, defaultWeightStep: WEIGHT_STEPS[category] || 0, isFavorite: false, createdAt: stamp, updatedAt: stamp };
      if (!runDataTransaction(function () { data.exercises.push(exercise); })) return;
      closeModal("addExerciseModal");
      if (exercisePickerMode === "routine") {
        routinePendingExerciseIds.push(exercise.id);
        renderExerciseList();
      } else chooseExercise(exercise.id);
      showToast("新しい種目を追加しました");
    });

    on("#weightMinus", "click", function () { changeWeight(-1); });
    on("#weightPlus", "click", function () { changeWeight(1); });
    on("#weightMinusLarge", "click", function () { changeWeightLarge(-1); });
    on("#weightPlusLarge", "click", function () { changeWeightLarge(1); });
    on("#repsMinus", "click", function () { changeReps(-1); });
    on("#repsPlus", "click", function () { changeReps(1); });
    on("#repsMinusLarge", "click", function () { changeRepsLarge(-1); });
    on("#repsPlusLarge", "click", function () { changeRepsLarge(1); });
    on("#weightInput", "focus", function () {
      if (getNumericInputValue(this) === 0) this.value = "";
    });
    on("#weightInput", "input", scheduleDraftSave);
    on("#weightInput", "blur", formatWeightInput);
    on("#repsQuick", "click", function (event) { var button = event.target.closest("[data-reps]"); if (!button) return; $("#repsInput").value = button.dataset.reps; renderSetChoices(); scheduleDraftSave(); });
    on("#repsInput", "input", function () { renderSetChoices(); scheduleDraftSave(); });
    on("#setMemo", "input", scheduleDraftSave);
    on("#rirChoices", "click", function (event) { var button = event.target.closest("[data-rir]"); if (!button) return; selectedRir = button.dataset.rir; renderSetChoices(); scheduleDraftSave(); });
    on("#restChoices", "click", function (event) { var button = event.target.closest("[data-rest]"); if (!button) return; selectedRest = Number(button.dataset.rest); renderSetChoices(); scheduleDraftSave(); });
    on("#saveSetButton", "click", function () { var button = this; runButtonLocked(button, saveCurrentSet); });
    on("#cancelSetEditButton", "click", cancelSetEdit);

    ["#cardioType", "#cardioDuration", "#cardioDistance", "#cardioIncline", "#cardioMemo"].forEach(function (selector) { on(selector, "input", handleCardioInputChange); });
    $$('[data-number-target]').forEach(function (button) {
      button.addEventListener("click", function () {
        changeNumericInput(button.dataset.numberTarget, Number(button.dataset.numberDirection));
      });
    });
    $$('[data-large-target]').forEach(function (button) {
      button.addEventListener("click", function () {
        changeNumericInputByStep(button.dataset.largeTarget, Number(button.dataset.largeDirection), Number(button.dataset.largeStep));
      });
    });
    on("#saveCardioButton", "click", function () { var button = this; runButtonLocked(button, saveCardio); });
    on("#savedCardioList", "click", function (event) {
      var deleteButton = event.target.closest("[data-delete-cardio]");
      if (deleteButton) {
        event.stopPropagation();
        var cardioTempId = deleteButton.dataset.deleteCardio;
        askConfirm("この有酸素記録を削除しますか？", "削除する", function () { deleteDraftCardio(cardioTempId); });
        return;
      }
      var editButton = event.target.closest("[data-edit-cardio]");
      if (!editButton) return;
      event.stopPropagation();
      var cardio = draft.cardios.find(function (item) { return item.tempId === editButton.dataset.editCardio; });
      if (!cardio) return;
      populateCardioForm(cardio);
      renderSavedCardios();
      setTimeout(function () { $("#cardioEditorCard").scrollIntoView({ behavior: "smooth", block: "start" }); }, 50);
    });

    document.addEventListener("click", function (event) {
      var deleteSetButton = event.target.closest("[data-delete-set]");
      if (deleteSetButton) {
        event.stopPropagation();
        var setTempId = deleteSetButton.dataset.deleteSet;
        askConfirm("このセットを削除しますか？", "削除する", function () { deleteDraftSet(setTempId); });
        return;
      }
      var addSetButton = event.target.closest("[data-add-set-exercise]");
      if (addSetButton) {
        event.stopPropagation();
        chooseExercise(addSetButton.dataset.addSetExercise);
        return;
      }
      var addSameExercise = event.target.closest("[data-add-same-exercise]");
      if (addSameExercise) {
        event.stopPropagation();
        chooseExercise(addSameExercise.dataset.addSameExercise);
        return;
      }
      var useRoutineButton = event.target.closest("[data-use-routine]");
      if (useRoutineButton) { useRoutineToday(useRoutineButton.dataset.useRoutine); return; }
      var createRoutineButton = event.target.closest("[data-create-routine]");
      if (createRoutineButton) { closeModal("routineListModal"); openRoutineCreator(false); return; }
      var cancelRoutineButton = event.target.closest("[data-cancel-routine-editor]");
      if (cancelRoutineButton) { cancelRoutineEditor(); return; }
      var removeRoutineExercise = event.target.closest("[data-remove-routine-exercise]");
      if (removeRoutineExercise && routineEditorState) {
        routineEditorState.exerciseIds.splice(Number(removeRoutineExercise.dataset.removeRoutineExercise), 1);
        renderRoutineEditor();
        return;
      }
      var moveRoutineExercise = event.target.closest("[data-move-routine-exercise]");
      if (moveRoutineExercise && routineEditorState) {
        var fromIndex = Number(moveRoutineExercise.dataset.moveRoutineExercise);
        var toIndex = fromIndex + Number(moveRoutineExercise.dataset.moveDirection);
        if (toIndex >= 0 && toIndex < routineEditorState.exerciseIds.length) {
          var movedExercise = routineEditorState.exerciseIds.splice(fromIndex, 1)[0];
          routineEditorState.exerciseIds.splice(toIndex, 0, movedExercise);
          renderRoutineEditor();
        }
        return;
      }
      var scheduleRoutineButton = event.target.closest("[data-schedule-routine]");
      if (scheduleRoutineButton) {
        var routineDateInput = $('[data-routine-date="' + scheduleRoutineButton.dataset.scheduleRoutine + '"]');
        scheduleRoutine(scheduleRoutineButton.dataset.scheduleRoutine, routineDateInput ? routineDateInput.value : "");
        return;
      }
      var editRoutineButton = event.target.closest("[data-edit-routine]");
      if (editRoutineButton) { editRoutine(editRoutineButton.dataset.editRoutine); return; }
      var deleteRoutineButton = event.target.closest("[data-delete-routine]");
      if (deleteRoutineButton) {
        var routineId = deleteRoutineButton.dataset.deleteRoutine;
        askConfirm("このルーティーンを削除しますか？ 過去のトレーニング記録は削除されません。", "削除する", function () { deleteRoutine(routineId); });
        return;
      }
      var startScheduleButton = event.target.closest("[data-start-schedule]");
      if (startScheduleButton) { startScheduledRoutine(startScheduleButton.dataset.startSchedule); return; }
      var deleteScheduleButton = event.target.closest("[data-delete-schedule]");
      if (deleteScheduleButton) {
        var scheduleId = deleteScheduleButton.dataset.deleteSchedule;
        askConfirm("この予定を削除しますか？", "削除する", function () { deleteSchedule(scheduleId); });
        return;
      }
      var editSetRow = event.target.closest("[data-edit-set]");
      if (editSetRow) {
        event.stopPropagation();
        startEditSet(editSetRow.dataset.editSet);
        return;
      }
      var close = event.target.closest("[data-close-modal]");
      if (close) {
        if (close.dataset.closeModal === "exerciseModal" && exercisePickerMode === "routine") cancelExerciseSelection();
        else {
          if (close.dataset.closeModal === "copyConflictModal") cancelPendingConflict();
          else if (close.dataset.closeModal === "copyDestinationModal") { copySourceSessionId = null; closeModal("copyDestinationModal"); }
          else if (close.dataset.closeModal === "confirmModal") cancelConfirmModal();
          else closeModal(close.dataset.closeModal);
        }
      }
      var dayStart = event.target.closest("[data-day-start]");
      if (dayStart) { closeModal("dayModal"); newDraft(dayStart.dataset.dayStart, dayStart.dataset.dayDate); }
      var dayRoutine = event.target.closest("[data-day-routine-date]");
      if (dayRoutine) { closeModal("dayModal"); openRoutineList(dayRoutine.dataset.dayRoutineDate, "use"); }
      var edit = event.target.closest("[data-edit-session]"); if (edit) loadDraft(edit.dataset.editSession);
      var copy = event.target.closest("[data-copy-session]"); if (copy) openCopyDestination(copy.dataset.copySession);
      var remove = event.target.closest("[data-delete-session]");
      if (remove) {
        var deleteTarget = getSession(remove.dataset.deleteSession);
        if (deleteTarget) {
          var deleteDate = dateFromString(deleteTarget.date);
          var deleteLabel = (deleteDate.getMonth() + 1) + "月" + deleteDate.getDate() + "日の" + (deleteTarget.locationType === "home" ? "自宅" : "ジム") + "トレーニングを削除しますか？";
          askConfirm(deleteLabel, "削除する", function () { deleteSession(deleteTarget.id); });
        }
      }
    });
    on("#confirmCancel", "click", cancelConfirmModal);
    on("#confirmAccept", "click", function () { acceptConfirmModal(this); });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var open = $$(".modal.is-open");
      if (!open.length) return;
      if (open[open.length - 1].id === "exerciseModal" && exercisePickerMode === "routine") cancelExerciseSelection();
      else if (open[open.length - 1].id === "nextSetConfirmModal") closeNextSetInput();
      else if (open[open.length - 1].id === "copyConflictModal") cancelPendingConflict();
      else if (open[open.length - 1].id === "copyDestinationModal") { copySourceSessionId = null; closeModal("copyDestinationModal"); }
      else if (open[open.length - 1].id === "confirmModal") cancelConfirmModal();
      else if (open[open.length - 1].id === "dataRecoveryModal" || open[open.length - 1].id === "draftResumeModal") return;
      else closeModal(open[open.length - 1].id);
    });
  }

  function changeWeight(direction) {
    var exercise = getExercise(selectedExerciseId);
    if (!exercise || exercise.category === "BODYWEIGHT") return;
    var step = WEIGHT_STEPS[exercise.category] || 1;
    var input = $("#weightInput");
    var current = getNumericInputValue(input);
    var value = Math.max(0, current + direction * step);
    input.value = (Math.round(value * 10) / 10).toFixed(1);
    scheduleDraftSave();
  }

  function changeWeightLarge(direction) {
    var exercise = getExercise(selectedExerciseId);
    if (!exercise || exercise.category === "BODYWEIGHT") return;
    var input = $("#weightInput");
    input.value = Math.max(0, getNumericInputValue(input) + direction * 10).toFixed(1);
    scheduleDraftSave();
  }

  function changeReps(direction) {
    var input = $("#repsInput");
    var current = Math.round(getNumericInputValue(input));
    if (current < 1) current = 10;
    input.value = Math.max(1, current + direction);
    renderSetChoices();
    scheduleDraftSave();
  }

  function changeRepsLarge(direction) {
    var input = $("#repsInput");
    var current = Math.round(getNumericInputValue(input));
    if (current < 1) current = 10;
    input.value = Math.max(1, current + direction * 10);
    renderSetChoices();
    scheduleDraftSave();
  }

  function formatWeightInput() {
    var input = $("#weightInput");
    var value = Math.max(0, getNumericInputValue(input));
    input.value = value.toFixed(1);
    scheduleDraftSave();
  }

  function changeNumericInput(targetId, direction) {
    var input = $("#" + targetId);
    if (!input) return;
    var step = parseFloat(input.step);
    if (!Number.isFinite(step) || step <= 0) step = 1;
    if (direction > 0) incrementInputValue(input, step, 0);
    else decrementInputValue(input, step, 0);
    var maximum = parseFloat(input.max);
    if (Number.isFinite(maximum) && getNumericInputValue(input) > maximum) input.value = formatNumberForInput(maximum, step);
    handleCardioInputChange();
  }

  function changeNumericInputByStep(targetId, direction, step) {
    var input = $("#" + targetId);
    if (!input || !Number.isFinite(step) || step <= 0) return;
    var next = Math.max(0, getNumericInputValue(input) + direction * step);
    var maximum = parseFloat(input.max);
    if (Number.isFinite(maximum)) next = Math.min(maximum, next);
    var formatStep = parseFloat(input.step);
    input.value = formatNumberForInput(next, Number.isFinite(formatStep) && formatStep > 0 ? formatStep : step);
    handleCardioInputChange();
  }

  window.GymLog.config = { storageKey: STORAGE_KEY, draftStorageKey: DRAFT_STORAGE_KEY, uiSettingsKey: UI_SETTINGS_KEY, cardioTypes: CARDIO_TYPES.slice() };
  window.GymLog.storage = { persist: persist, backup: downloadBackupData, validateBackup: validateBackupData, rebuildIndexes: rebuildDataIndexes };
  window.GymLog.calculations = { strengthCalories: calculateStrengthCaloriesForRecords, cardio: calculateCardio, monthlySummary: getMonthlySummary };
  window.GymLog.dataAccess = { getExercise: getExercise, getSession: getSession, getSessionsForDate: getSessionsForDate, getSessionRecords: getSessionRecords, getRecordSets: getRecordSets, getSessionCardios: getSessionCardios };
  window.GymLog.progress = { filterByRange: filterProgressPointsByRange, render: renderProgressPage };

  function initializeApp() {
    try {
      applyUiSettings(uiSettings);
      bindSystemAppearanceListener();
      bindEvents();
      if ((exerciseMigrationChanged || dataMigrationChanged) && !dataRecoveryRequired) persist();
      renderHome();
      if (dataRecoveryRequired) { openModal("dataRecoveryModal"); return; }
      if (dataLoadWarning) setTimeout(function () { showToast(dataLoadWarning); }, 100);
      var startupDraft = loadSavedDraft();
      if (startupDraft) setTimeout(function () { showSavedDraftPrompt(startupDraft); }, 250);
      else if (!data.profile || !data.profile.weightKg) setTimeout(openProfile, 350);
    } catch (error) {
      console.error("Failed to initialize app", error);
      var appRoot = document.getElementById("app");
      if (appRoot) {
        var notice = document.createElement("p");
        notice.className = "startup-error";
        notice.textContent = "データを読み込めませんでした。ページを開き直してください。";
        if (appRoot.insertBefore) appRoot.insertBefore(notice, appRoot.firstChild);
      }
    }
  }

  initializeApp();
})();
