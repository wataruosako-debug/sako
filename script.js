(function () {
  "use strict";

  window.GymLog = window.GymLog || {};

  /* Configuration and shared UI helpers */
  var STORAGE_KEY = "gymlog-data-v1";
  var DRAFT_STORAGE_KEY = "gymlog-draft-v1";
  var PRE_RESTORE_STORAGE_KEY = "gymlog-pre-restore-v1";
  var UI_SETTINGS_KEY = "gymlog-ui-settings-v1";
  var DEFAULT_UI_SETTINGS = { appearance: "system", colorTheme: "urban-blue", restTimerEnabled: true, autoStartRestTimer: true, restTimerSound: false, restTimerVibration: true, guideModeEnabled: true, guideHelpSeen: false };
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
  var WEIGHT_STEPS = { BARBELL: 1, DUMBBELL: 0.5, MACHINE: 1, BODYWEIGHT: 0 };
  var WEIGHT_STEP_OPTIONS = [0.5, 1, 1.25, 2, 2.5, 5, 10];
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
  var OVERALL_METRICS = {
    totalCalories: { label: "総消費カロリー", unit: "kcal", decimals: 0, help: "筋トレと有酸素を合計した、1日ごとの概算消費カロリーです。" },
    totalVolume: { label: "総ボリューム", unit: "kg", decimals: 0, help: "その日に行った筋トレの重量×回数を合計した値です。" }
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
    return {
      appearance: appearance,
      colorTheme: colorTheme,
      restTimerEnabled: Object.prototype.hasOwnProperty.call(settings, "restTimerEnabled") ? !!settings.restTimerEnabled : DEFAULT_UI_SETTINGS.restTimerEnabled,
      autoStartRestTimer: Object.prototype.hasOwnProperty.call(settings, "autoStartRestTimer") ? !!settings.autoStartRestTimer : DEFAULT_UI_SETTINGS.autoStartRestTimer,
      restTimerSound: Object.prototype.hasOwnProperty.call(settings, "restTimerSound") ? !!settings.restTimerSound : DEFAULT_UI_SETTINGS.restTimerSound,
      restTimerVibration: Object.prototype.hasOwnProperty.call(settings, "restTimerVibration") ? !!settings.restTimerVibration : DEFAULT_UI_SETTINGS.restTimerVibration,
      guideModeEnabled: Object.prototype.hasOwnProperty.call(settings, "guideModeEnabled") ? !!settings.guideModeEnabled : DEFAULT_UI_SETTINGS.guideModeEnabled,
      guideHelpSeen: Object.prototype.hasOwnProperty.call(settings, "guideHelpSeen") ? !!settings.guideHelpSeen : DEFAULT_UI_SETTINGS.guideHelpSeen
    };
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
  function isRestTimerEnabled() {
    return uiSettings.restTimerEnabled !== false;
  }
  function isGuideModeEnabled() {
    return uiSettings.guideModeEnabled !== false;
  }
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
    var restEnabled = $("#restTimerEnabled");
    var autoStart = $("#autoStartRestTimer");
    var sound = $("#restTimerSound");
    var vibration = $("#restTimerVibration");
    var restSubSettings = $("#restTimerSubSettings");
    if (restEnabled) restEnabled.checked = isRestTimerEnabled();
    if (autoStart) autoStart.checked = !!uiSettings.autoStartRestTimer;
    if (sound) sound.checked = !!uiSettings.restTimerSound;
    if (vibration) vibration.checked = !!uiSettings.restTimerVibration;
    [autoStart, sound, vibration].forEach(function (input) { if (input) input.disabled = !isRestTimerEnabled(); });
    if (restSubSettings) {
      restSubSettings.classList.toggle("is-disabled", !isRestTimerEnabled());
      restSubSettings.setAttribute("aria-disabled", isRestTimerEnabled() ? "false" : "true");
    }
    var guideEnabled = $("#guideModeEnabled");
    if (guideEnabled) guideEnabled.checked = isGuideModeEnabled();
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
    if (!isRestTimerEnabled() && restTimerState && restTimerState.status !== "idle") stopRestTimer();
    renderAppearanceSettings();
    updateTodayMenuSummary();
  }
  function setAppearanceSetting(appearance) {
    applyUiSettings(Object.assign({}, uiSettings, { appearance: appearance }));
    if (saveUiSettings(uiSettings)) showToast("外観を変更しました");
  }
  function setColorTheme(colorTheme) {
    applyUiSettings(Object.assign({}, uiSettings, { colorTheme: colorTheme }));
    if (saveUiSettings(uiSettings)) showToast("テーマを変更しました");
  }
  function setTimerSetting(key, value) {
    if (key === "guideModeEnabled" && value === false && isGuideActive()) {
      var guideToggle = $("#guideModeEnabled");
      if (guideToggle) guideToggle.checked = true;
      openModal("guideModeOffModal");
      return;
    }
    var next = Object.assign({}, uiSettings);
    next[key] = !!value;
    applyUiSettings(next);
    if (key === "restTimerSound" && value) unlockWorkoutAudio();
    if (saveUiSettings(uiSettings)) showToast(key === "guideModeEnabled" ? "ガイドモード設定を保存しました" : "タイマー設定を保存しました");
  }
  function applyGuideModeEnabled(enabled) {
    applyUiSettings(Object.assign({}, uiSettings, { guideModeEnabled: !!enabled }));
    if (saveUiSettings(uiSettings)) showToast("ガイドモード設定を保存しました");
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
  function bindKeyboardActivation(element, callback) {
    if (!element) return;
    element.addEventListener("click", callback);
    element.addEventListener("keydown", function (event) {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      callback();
    });
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

  function normalizeSearchText(value) {
    return String(value || "").toLowerCase().replace(/[\u3000\s]+/g, " ").trim();
  }

  function moveArrayItem(array, fromIndex, toIndex) {
    if (!Array.isArray(array) || fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= array.length || toIndex >= array.length) return array;
    var item = array.splice(fromIndex, 1)[0];
    array.splice(toIndex, 0, item);
    return array;
  }

  function enableSortableList(container, options) {
    if (!container || container.dataset.sortableBound === "true") return;
    container.dataset.sortableBound = "true";
    var dragState = null;
    function sortableItems() {
      return Array.prototype.slice.call(container.querySelectorAll("[data-sort-item]"));
    }
    function finishDrag() {
      if (!dragState) return;
      dragState.item.classList.remove("is-dragging");
      var order = sortableItems().map(function (item) { return item.dataset.sortItem; }).filter(Boolean);
      var onChange = dragState.options && dragState.options.onChange;
      dragState = null;
      if (typeof onChange === "function") onChange(order);
    }
    container.addEventListener("pointerdown", function (event) {
      var handle = event.target.closest("[data-sort-handle]");
      if (!handle || !container.contains(handle)) return;
      var item = handle.closest("[data-sort-item]");
      if (!item) return;
      event.preventDefault();
      dragState = { item: item, options: options || {} };
      item.classList.add("is-dragging");
      if (handle.setPointerCapture) {
        try { handle.setPointerCapture(event.pointerId); } catch (error) { /* ignore unsupported capture */ }
      }
    });
    container.addEventListener("pointermove", function (event) {
      if (!dragState) return;
      event.preventDefault();
      var item = dragState.item;
      var next = sortableItems().filter(function (entry) { return entry !== item; }).find(function (entry) {
        var rect = entry.getBoundingClientRect();
        return event.clientY < rect.top + rect.height / 2;
      });
      if (next) container.insertBefore(item, next);
      else container.appendChild(item);
    });
    container.addEventListener("pointerup", finishDrag);
    container.addEventListener("pointercancel", finishDrag);
  }

  function estimatedOneRm(weightKg, reps) {
    return Number(weightKg || 0) * (1 + Number(reps || 0) / 30);
  }

  function normalizeVersion2Data(source) {
    var normalized = cloneData(source || {});
    var arrays = ["exercises", "sessions", "records", "sets", "cardios", "recentExerciseIds", "routines", "scheduledRoutines"];
    arrays.forEach(function (key) { if (!Array.isArray(normalized[key])) normalized[key] = []; });
    normalized.profile = normalized.profile && typeof normalized.profile === "object" && !Array.isArray(normalized.profile) ? normalized.profile : null;
    normalized.exercises = normalized.exercises.filter(function (exercise) { return exercise && exercise.id && exercise.name && exercise.category; }).map(function (exercise) {
      exercise.bodyPart = exercise.bodyPart || inferBodyPart(exercise.name, exercise.category);
      exercise.defaultWeightStep = normalizeExerciseWeightStep(exercise.defaultWeightStep, exercise.category);
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
      result.push({ id: makeId("ex"), name: item.name, category: item.category, bodyPart: item.bodyPart, defaultWeightStep: defaultWeightStepForCategory(item.category), isFavorite: false, createdAt: stamp, updatedAt: stamp });
      names[item.name] = true;
      exerciseMigrationChanged = true;
    });
    return result;
  }

  function seedExercises() {
    var stamp = nowIso();
    return exerciseCatalog().map(function (item) {
      return { id: makeId("ex"), name: item.name, category: item.category, bodyPart: item.bodyPart, defaultWeightStep: defaultWeightStepForCategory(item.category), isFavorite: false, createdAt: stamp, updatedAt: stamp };
    });
  }

  function presetRoutines(exercises) {
    var stamp = nowIso();
    var idByName = {};
    exercises.forEach(function (exercise) { idByName[exercise.name] = exercise.id; });
    var presets = [
      { name: "胸・腕の日", exerciseNames: ["ベンチプレス", "チェストプレス", "アームカール", "トライセプスプレス"] },
      { name: "背中・肩の日", exerciseNames: ["ラットプルダウン", "シーテッドロー", "ショルダープレス", "サイドレイズ"] },
      { name: "脚・腹の日", exerciseNames: ["スクワット", "レッグプレス", "レッグカール", "クランチ"] }
    ];
    return presets.map(function (preset) {
      var ids = preset.exerciseNames.map(function (name) { return idByName[name]; }).filter(Boolean);
      if (!ids.length) return null;
      return {
        id: makeId("routine"),
        name: preset.name,
        locationType: "gym",
        exercises: ids.map(function (exerciseId, index) { return { exerciseId: exerciseId, orderIndex: index }; }),
        createdAt: stamp,
        updatedAt: stamp
      };
    }).filter(Boolean);
  }

  function blankData() {
    var exercises = seedExercises();
    return { version: CURRENT_DATA_VERSION, profile: null, exercises: exercises, sessions: [], records: [], sets: [], cardios: [], recentExerciseIds: [], routines: presetRoutines(exercises), scheduledRoutines: [] };
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
  var progressState = { tab: "strength", exerciseId: null, cardioType: "ウォーキング", metric: "maxWeight", range: "6m", customStart: "", customEnd: "" };
  var toastTimer = null;
  var confirmCallback = null;
  var confirmCancelCallback = null;
  var copySourceSessionId = null;
  var routineEditingId = null;
  var routineEditorState = null;
  var routinePendingExerciseIds = [];
  var routineTargetDate = null;
  var routineListMode = "use";
  var routineDetailId = null;
  var pendingRestoreData = null;
  var pendingCopyConflict = null;
  var pendingSaveConflict = null;
  var pendingSavedDraft = null;
  var draftSaveTimer = null;
  var nextSetExerciseId = null;
  var nextSetActionState = null;
  var recentlySavedSetTempId = null;
  var recentlySavedSetTimer = null;
  var exerciseSearchTimer = null;
  var restTimerState = { status: "idle", totalSeconds: 0, remainingSeconds: 0, endAt: 0, intervalId: null, finishedNotified: false };
  var guideAudioState = { context: null, unlocked: false };
  var guideRestTimerDebugKey = "";
  var guideSetSaveLocked = false;
  var guideSetLockTimer = null;
  var guideSetNoticeTimer = null;
  var completedGuideSetTokens = {};
  var expandedDraftExerciseId = null;
  var expandedDraftCardioKey = null;
  var draftSortMode = false;
  var draftSortOriginalOrder = null;
  var personalBestTimer = null;
  var personalBestShownKeys = {};

  function defaultWeightStepForCategory(category) {
    return WEIGHT_STEPS[category] || 0;
  }

  function normalizeExerciseWeightStep(value, category) {
    if (category === "BODYWEIGHT" || category === "CARDIO") return 0;
    var numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 0) return numeric;
    return defaultWeightStepForCategory(category) || 1;
  }

  function getExerciseWeightStep(exercise) {
    if (!exercise) return 1;
    return normalizeExerciseWeightStep(exercise.defaultWeightStep, exercise.category);
  }

  function weightStepOptionHtml(selectedStep) {
    selectedStep = Number(selectedStep || 0);
    return WEIGHT_STEP_OPTIONS.map(function (step) {
      return '<option value="' + step + '"' + (Math.abs(step - selectedStep) < 0.0001 ? " selected" : "") + '>' + formatNumberForInput(step, step) + 'kg</option>';
    }).join("");
  }

  function createWorkoutDraft(options) {
    options = options || {};
    var result = {
      id: options.id || null,
      originalSessionId: options.originalSessionId || null,
      date: options.date || todayString(),
      locationType: options.locationType || "gym",
      memo: options.memo || "",
      records: Array.isArray(options.records) ? options.records : [],
      cardios: Array.isArray(options.cardios) ? options.cardios : [],
      pendingCardioTypes: Array.isArray(options.pendingCardioTypes) ? options.pendingCardioTypes : [],
      menuSource: options.menuSource || "manual",
      createdAt: options.createdAt || nowIso()
    };
    if (options.guideState) result.guideState = options.guideState;
    if (options.sourceScheduleId) result.sourceScheduleId = options.sourceScheduleId;
    if (options.previousSessionIdToRemove) result.previousSessionIdToRemove = options.previousSessionIdToRemove;
    return result;
  }

  function resetWorkoutEditorState(options) {
    options = options || {};
    selectedExerciseId = options.selectedExerciseId || null;
    selectedRir = Object.prototype.hasOwnProperty.call(options, "selectedRir") ? options.selectedRir : null;
    selectedRest = Object.prototype.hasOwnProperty.call(options, "selectedRest") ? Number(options.selectedRest) : 90;
    if (!Number.isFinite(selectedRest)) selectedRest = 90;
    editingSetTempId = options.editingSetTempId || null;
    isAddingSet = !!options.isAddingSet;
    editingCardioTempId = options.editingCardioTempId || null;
  }

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
    if (draft && draft.guideState && draft.guideState.active) captureGuideInputToState();
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
    if (draftValue.guideState && draftValue.guideState.active) return true;
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
    if (savedDraft.guideState && savedDraft.guideState.active && isGuideModeEnabled()) {
      $("#draftResumeTitle").textContent = "ガイドモードの途中です";
      $("#draftResumeSummary").textContent = formatDateJa(savedDraft.date) + "\n" + locationLabel + "\n完了 " + countGuideCompletedSets(savedDraft.guideState) + "セット";
      openModal("draftResumeModal");
      return;
    }
    $("#draftResumeTitle").textContent = "保存途中のトレーニングがあります";
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
    resetWorkoutEditorState();
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
    if (draft.guideState && draft.guideState.active && !isGuideModeEnabled()) {
      convertGuideDraftToNormalInput(false);
      closeModal("draftResumeModal");
      renderWorkout();
      showScreen("workout");
      saveDraftNow();
      showToast("ガイドモードはOFFです。通常入力で再開します");
      return;
    }
    if (draft.guideState && draft.guideState.active) {
      resetWorkoutEditorState();
      closeModal("draftResumeModal");
      renderGuideWorkout();
      showScreen("guideWorkout");
      saveDraftNow();
      return;
    }
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

  function isStrengthVolumeExercise(exercise) {
    return !!exercise && ["chest", "shoulder", "arm", "back", "abs", "legs"].indexOf(exercise.bodyPart) >= 0;
  }

  function isUpperBodyVolumeExercise(exercise) {
    return !!exercise && ["chest", "shoulder", "arm", "back", "abs"].indexOf(exercise.bodyPart) >= 0;
  }

  function calculateRecordStrengthVolume(record) {
    var exercise = getExercise(record.exerciseId);
    if (!isStrengthVolumeExercise(exercise)) return 0;
    return getRecordSets(record.id).reduce(function (total, set) {
      return total + Number(set.weight || 0) / 1000 * Number(set.reps || 0);
    }, 0);
  }

  function calculateSessionStrengthVolume(sessionId) {
    return getSessionRecords(sessionId).reduce(function (sessionTotal, record) {
      return sessionTotal + calculateRecordStrengthVolume(record);
    }, 0);
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

  function calculateDraftStrengthVolume(records) {
    return (records || []).reduce(function (total, record) {
      var exercise = getExercise(record.exerciseId);
      if (!isStrengthVolumeExercise(exercise)) return total;
      return total + (record.sets || []).reduce(function (setTotal, set) {
        return setTotal + Number(set.weight || 0) / 1000 * Number(set.reps || 0);
      }, 0);
    }, 0);
  }

  function formatDraftVolume(value) {
    var safeValue = Number(value || 0);
    var rounded = Math.round(safeValue * 10) / 10;
    var displayValue = Math.abs(rounded - Math.round(rounded)) < 0.0001 ? Math.round(rounded) : rounded;
    return displayValue.toLocaleString("ja-JP", { maximumFractionDigits: 1 });
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

    data.records.forEach(function (record) {
      if (!sessionIds[record.sessionId]) return;
      strengthCalories += calculateStrengthCaloriesForRecords([record]);
      var exercise = getExercise(record.exerciseId);
      var volumeKg = calculateRecordStrengthVolume(record);
      if (!volumeKg) return;
      if (isUpperBodyVolumeExercise(exercise)) upperBodyVolumeKg += volumeKg;
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
    $("#monthlyCaloriesLabel").textContent = "概算消費カロリー";
    $("#monthlyVolumeLabel").textContent = "ボリューム";
    var scheduleFit = window.requestAnimationFrame || function (callback) { setTimeout(callback, 0); };
    scheduleFit(fitMonthlySummaryMetrics);
  }

  function fitSummaryMetricValue(element) {
    if (!element || !element.style || !element.getBoundingClientRect) return;
    element.style.removeProperty("--metric-scale");
    var container = element.closest ? element.closest(".stat-value, .monthly-volume-total strong") : null;
    if (!container || !container.getBoundingClientRect) return;
    var unit = container.querySelector ? container.querySelector("small") : null;
    var unitWidth = unit && unit.getBoundingClientRect ? unit.getBoundingClientRect().width + 4 : 0;
    var availableWidth = container.getBoundingClientRect().width - unitWidth;
    var actualWidth = element.getBoundingClientRect().width;
    if (!actualWidth || !availableWidth || actualWidth <= availableWidth) {
      element.style.setProperty("--metric-scale", "1");
      return;
    }
    var scale = Math.max(0.78, Math.min(1, availableWidth / actualWidth));
    element.style.setProperty("--metric-scale", String(scale));
  }

  function fitMonthlySummaryMetrics() {
    ["monthlyVisits", "monthlyCalories", "monthlyTotalVolume"].forEach(function (id) {
      fitSummaryMetricValue(document.getElementById(id));
    });
  }

  function addDaysToDateString(value, days) {
    var date = dateFromString(value);
    date.setDate(date.getDate() + days);
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }

  function formatDateForAiExport(value) {
    return String(value || "").replace(/-/g, "/");
  }

  function locationLabelForAiExport(locationType) {
    return locationType === "home" ? "自宅" : "ジム";
  }

  function getAiExportDateRange(rangeType) {
    var today = todayString();
    var current = dateFromString(today);
    if (rangeType === "last7") return { start: addDaysToDateString(today, -6), end: today };
    if (rangeType === "last30") return { start: addDaysToDateString(today, -29), end: today };
    if (rangeType === "thisMonth") {
      var endThis = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      return { start: current.getFullYear() + "-" + String(current.getMonth() + 1).padStart(2, "0") + "-01", end: endThis.getFullYear() + "-" + String(endThis.getMonth() + 1).padStart(2, "0") + "-" + String(endThis.getDate()).padStart(2, "0") };
    }
    if (rangeType === "lastMonth") {
      var last = new Date(current.getFullYear(), current.getMonth() - 1, 1);
      var endLast = new Date(current.getFullYear(), current.getMonth(), 0);
      return { start: last.getFullYear() + "-" + String(last.getMonth() + 1).padStart(2, "0") + "-01", end: endLast.getFullYear() + "-" + String(endLast.getMonth() + 1).padStart(2, "0") + "-" + String(endLast.getDate()).padStart(2, "0") };
    }
    if (rangeType === "custom") {
      var start = $("#aiExportStartDate") ? $("#aiExportStartDate").value : "";
      var end = $("#aiExportEndDate") ? $("#aiExportEndDate").value : "";
      if (!start || !end) return { start: start, end: end, error: "開始日と終了日を選択してください。" };
      if (start > end) return { start: start, end: end, error: "終了日は開始日以降にしてください。" };
      return { start: start, end: end };
    }
    return { start: today, end: today };
  }

  function ensureAiExportCustomDates() {
    var start = $("#aiExportStartDate");
    var end = $("#aiExportEndDate");
    if (!start || !end) return;
    if (start.value && end.value) return;
    var today = todayString();
    var todayDate = dateFromString(today);
    var firstDay = todayDate.getFullYear() + "-" + String(todayDate.getMonth() + 1).padStart(2, "0") + "-01";
    if (!start.value) start.value = firstDay;
    if (!end.value) end.value = today;
  }

  function getAiExportTargetLabel(target, exerciseId) {
    if (target === "strength") return "筋トレのみ";
    if (target === "cardio") return "有酸素のみ";
    if (target === "exercise") {
      var exercise = getExercise(exerciseId);
      return exercise ? exercise.name : "特定種目";
    }
    return "すべて";
  }

  function aiExportExerciseOptionsHtml() {
    return data.exercises.slice().sort(function (a, b) {
      if (a.category === "CARDIO" && b.category !== "CARDIO") return 1;
      if (a.category !== "CARDIO" && b.category === "CARDIO") return -1;
      return String(a.name).localeCompare(String(b.name), "ja");
    }).map(function (exercise) {
      var suffix = exercise.category === "CARDIO" ? "有酸素" : (CATEGORY_LABELS[exercise.category] || "筋トレ");
      return '<option value="' + exercise.id + '">' + escapeHtml(exercise.name + "（" + suffix + "）") + '</option>';
    }).join("");
  }

  function getAiExportOptions() {
    var rangeType = $("#aiExportRange") ? $("#aiExportRange").value : "today";
    var target = $("#aiExportTarget") ? $("#aiExportTarget").value : "all";
    var range = getAiExportDateRange(rangeType);
    return { rangeType: rangeType, startDate: range.start, endDate: range.end, rangeError: range.error || "", target: target, exerciseId: target === "exercise" && $("#aiExportExercise") ? $("#aiExportExercise").value : "" };
  }

  function isAiExportTextCopyable(text) {
    var value = String(text || "").trim();
    return !!value &&
      value !== "指定した期間に記録がありません。" &&
      value !== "開始日と終了日を選択してください。" &&
      value !== "終了日は開始日以降にしてください。";
  }

  function recordMatchesAiExportTarget(record, options) {
    if (!record || options.target === "cardio") return false;
    return options.target !== "exercise" || record.exerciseId === options.exerciseId;
  }

  function cardioMatchesAiExportTarget(cardio, options) {
    if (!cardio || options.target === "strength") return false;
    if (options.target !== "exercise") return true;
    var exercise = getExercise(options.exerciseId);
    return !!(exercise && exercise.category === "CARDIO" && cardioExerciseId(cardio.type) === exercise.id);
  }

  function getAiExportSessions(options) {
    return data.sessions.filter(function (session) {
      return session.date >= options.startDate && session.date <= options.endDate;
    }).sort(function (a, b) {
      var dateOrder = String(a.date || "").localeCompare(String(b.date || ""));
      if (dateOrder) return dateOrder;
      if (a.locationType !== b.locationType) return a.locationType === "gym" ? -1 : 1;
      return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
    }).map(function (session) {
      var records = getSessionRecords(session.id).filter(function (record) { return recordMatchesAiExportTarget(record, options) && getRecordSets(record.id).length; });
      var cardios = getSessionCardios(session.id).filter(function (cardio) { return cardioMatchesAiExportTarget(cardio, options); });
      var hasMemo = !!(session.memo && options.target !== "exercise");
      if (!records.length && !cardios.length && !hasMemo) return null;
      return { session: session, records: records, cardios: cardios };
    }).filter(Boolean);
  }

  function formatWeightForAiExport(exercise, weightGram) {
    if (exercise && exercise.category === "BODYWEIGHT") return "自重";
    return formatNumberForInput(Number(weightGram || 0) / 1000, 0.1) + "kg";
  }

  function formatStrengthRecordForAiExport(record) {
    var exercise = getExercise(record.exerciseId);
    var lines = [exercise ? exercise.name : "不明な種目"];
    getRecordSets(record.id).forEach(function (set, index) {
      var parts = [formatWeightForAiExport(exercise, set.weight) + " × " + Number(set.reps || 0) + "回", "RIR " + (set.rir || "未入力"), "休憩" + Number(set.restSeconds || 0) + "秒"];
      if (set.memo) parts.push("メモ：" + set.memo);
      lines.push((Number(set.setNumber || 0) || index + 1) + "セット目：" + parts.join(" / "));
    });
    return lines.join("\n");
  }

  function formatCardioForAiExport(cardio) {
    var result = calculateCardio(cardio);
    var savedCalories = Number(cardio.calories);
    var calories = Number.isFinite(savedCalories) && savedCalories > 0 ? savedCalories : result.calories;
    var parts = [];
    if (Number(cardio.durationMinutes || 0) > 0) parts.push(formatNumberForInput(Number(cardio.durationMinutes || 0), 1) + "分");
    if (Number(cardio.distanceKm || 0) > 0) parts.push(formatNumberForInput(Number(cardio.distanceKm || 0), 0.1) + "km");
    if (Number(result.speedKmh || 0) > 0) parts.push("時速" + Number(result.speedKmh || 0).toFixed(1) + "km/h");
    if (Number(cardio.inclinePercent || 0) > 0) parts.push("傾斜" + formatNumberForInput(Number(cardio.inclinePercent || 0), 0.5) + "%");
    parts.push("約" + Math.round(calories) + "kcal");
    if (cardio.memo) parts.push("メモ：" + cardio.memo);
    return (cardio.type || "有酸素") + "：" + parts.join(" / ");
  }

  function buildAiExportText(options) {
    options = options || getAiExportOptions();
    if (options.rangeError) return options.rangeError;
    if (!options.startDate || !options.endDate) return "開始日と終了日を選択してください。";
    var entries = getAiExportSessions(options);
    if (!entries.length) return "指定した期間に記録がありません。";
    var workoutDates = {};
    var gymVisits = 0;
    var homeVisits = 0;
    var totalCalories = 0;
    var totalVolume = 0;
    var cardioDistance = 0;
    entries.forEach(function (entry) {
      workoutDates[entry.session.date] = true;
      if (entry.session.locationType === "home") homeVisits += 1;
      else gymVisits += 1;
      totalCalories += calculateStrengthCaloriesForRecords(entry.records);
      totalVolume += entry.records.reduce(function (sum, record) { return sum + calculateRecordStrengthVolume(record); }, 0);
      entry.cardios.forEach(function (cardio) {
        var savedCalories = Number(cardio.calories);
        totalCalories += Number.isFinite(savedCalories) && savedCalories > 0 ? savedCalories : calculateCardio(cardio).calories;
        cardioDistance += Number(cardio.distanceKm || 0);
      });
    });
    var lines = ["【ジムログ トレーニング記録】", "期間：" + formatDateForAiExport(options.startDate) + "〜" + formatDateForAiExport(options.endDate), "対象：" + getAiExportTargetLabel(options.target, options.exerciseId), "【サマリー】", "トレーニング日数：" + Object.keys(workoutDates).length + "日", "ジム：" + gymVisits + "回", "自宅：" + homeVisits + "回", "概算消費カロリー：" + Math.round(totalCalories).toLocaleString("ja-JP") + "kcal", "総ボリューム：" + formatDraftVolume(totalVolume) + "kg", "有酸素距離：" + cardioDistance.toLocaleString("ja-JP", { maximumFractionDigits: 1 }) + "km"];
    entries.forEach(function (entry) {
      lines.push("");
      lines.push("【" + formatDateForAiExport(entry.session.date) + " " + locationLabelForAiExport(entry.session.locationType) + "】");
      entry.records.forEach(function (record) { lines.push(formatStrengthRecordForAiExport(record)); });
      if (entry.cardios.length) {
        lines.push("有酸素");
        entry.cardios.forEach(function (cardio) { lines.push(formatCardioForAiExport(cardio)); });
      }
      if (entry.session.memo) {
        lines.push("メモ：");
        lines.push(entry.session.memo);
      }
    });
    return lines.join("\n");
  }

  function updateAiExportPreview() {
    var range = $("#aiExportRange");
    var custom = $("#aiExportCustomDates");
    var target = $("#aiExportTarget");
    var exerciseField = $("#aiExportExerciseField");
    if (range && range.value === "custom") ensureAiExportCustomDates();
    if (custom && range) custom.classList.toggle("hidden", range.value !== "custom");
    if (exerciseField && target) exerciseField.classList.toggle("hidden", target.value !== "exercise");
    var text = buildAiExportText(getAiExportOptions());
    var preview = $("#aiExportPreview");
    if (preview) {
      preview.disabled = false;
      preview.setAttribute("readonly", "readonly");
      preview.value = text;
    }
    var copyButton = $("#copyAiExportButton");
    var copyable = isAiExportTextCopyable(text);
    if (copyButton) {
      copyButton.hidden = false;
      copyButton.classList.remove("hidden");
      copyButton.disabled = !copyable;
      copyButton.setAttribute("aria-disabled", copyable ? "false" : "true");
      copyButton.textContent = "テキストをコピー";
    }
    var status = $("#aiExportStatus");
    if (status) status.textContent = copyable ? "" : text;
    return text;
  }

  function openAiExportModal() {
    var range = getAiExportDateRange("thisMonth");
    $("#aiExportRange").value = "thisMonth";
    $("#aiExportStartDate").value = range.start;
    $("#aiExportEndDate").value = range.end;
    $("#aiExportTarget").value = "all";
    $("#aiExportExercise").innerHTML = aiExportExerciseOptionsHtml();
    updateAiExportPreview();
    closeModal("settingsMenuModal");
    openModal("aiExportModal");
  }

  function fallbackCopyText(text) {
    var preview = $("#aiExportPreview");
    try {
      if (preview) {
        preview.disabled = false;
        preview.setAttribute("readonly", "readonly");
        preview.value = text;
        preview.focus();
        preview.select();
        if (preview.setSelectionRange) preview.setSelectionRange(0, text.length);
      }
      if (document.execCommand && document.execCommand("copy")) {
        if (preview) preview.setAttribute("readonly", "readonly");
        return true;
      }
    } catch (error) {
      console.warn("Clipboard fallback failed", error);
    }
    if (preview) preview.setAttribute("readonly", "readonly");
    return false;
  }

  function copyAiExportText() {
    updateAiExportPreview();
    var preview = $("#aiExportPreview");
    var text = preview ? preview.value : buildAiExportText(getAiExportOptions());
    if (!isAiExportTextCopyable(text)) {
      showToast("コピーできる記録がありません");
      return;
    }
    var onSuccess = function () {
      if (preview) preview.setAttribute("readonly", "readonly");
      showToast("コピーしました。ChatGPTなどに貼り付けて分析できます。");
    };
    var onFailure = function () {
      if (preview) {
        preview.disabled = false;
        preview.setAttribute("readonly", "readonly");
        preview.value = text;
        preview.focus();
        preview.select();
        if (preview.setSelectionRange) preview.setSelectionRange(0, text.length);
      }
      var status = $("#aiExportStatus");
      if (status) status.textContent = "コピーできませんでした。プレビュー欄から手動でコピーしてください。";
      showToast("コピーできませんでした。プレビュー欄から手動でコピーしてください。");
    };
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(function (error) {
        console.warn("Clipboard API failed", error);
        if (fallbackCopyText(text)) onSuccess();
        else onFailure();
      });
      return;
    }
    if (fallbackCopyText(text)) onSuccess();
    else onFailure();
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
      return '<div class="routine-editor-row" data-sort-item="' + escapeHtml(exerciseId) + '"><button class="drag-handle" type="button" data-sort-handle aria-label="' + escapeHtml(exercise ? exercise.name : "種目") + 'を並べ替え">☰</button><span class="routine-editor-index">' + (index + 1) + '</span><span class="routine-editor-name"><strong>' + escapeHtml(exercise ? exercise.name : "不明な種目") + '</strong><small>' + escapeHtml(exercise ? (exercise.category === "CARDIO" ? "有酸素" : CATEGORY_LABELS[exercise.category]) : "") + '</small></span><div class="routine-editor-controls"><button type="button" data-move-routine-exercise="' + index + '" data-move-direction="-1" aria-label="上へ"' + (index === 0 ? " disabled" : "") + '>↑</button><button type="button" data-move-routine-exercise="' + index + '" data-move-direction="1" aria-label="下へ"' + (index === ids.length - 1 ? " disabled" : "") + '>↓</button><button class="routine-editor-remove" type="button" data-remove-routine-exercise="' + index + '">削除</button></div></div>';
    }).join("") : '<div class="empty-state">種目を追加してください</div>';
    enableSortableList($("#routineEditorExerciseList"), {
      onChange: function (order) {
        if (!routineEditorState) return;
        routineEditorState.exerciseIds = order.filter(function (exerciseId) { return !!getExercise(exerciseId); });
        renderRoutineEditor();
      }
    });
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
    $("#confirmExerciseSelection").classList.remove("hidden");
    $("#confirmExerciseSelection").disabled = false;
    $("#exerciseSearch").value = "";
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
    routineDetailId = null;
    if (!data.routines.length) {
      $("#routineList").innerHTML = '<div class="empty-state">ルーティーンはまだありません。</div><button class="outline-button outline-button--blue" type="button" data-create-routine>ルーティーンを登録</button>';
      return;
    }
    $("#routineList").innerHTML = data.routines.slice().sort(function (a, b) { return String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")); }).map(function (routine) {
      var entries = routineExerciseEntries(routine);
      var updated = String(routine.updatedAt || "").slice(0, 10).replace(/-/g, "/");
      var detailAttr = routineListMode === "manage" ? "" : ' data-routine-detail="' + routine.id + '"';
      var head = '<button class="routine-card-main" type="button"' + detailAttr + '><span><strong>' + escapeHtml(routine.name) + '</strong><small>' + entries.length + '種目</small></span><em>' + (routine.locationType === "home" ? "自宅" : "ジム") + '</em></button>';
      var manage = '<div class="routine-card-actions"><button class="routine-edit-button" type="button" data-edit-routine="' + routine.id + '">編集</button><button class="routine-delete-button" type="button" data-delete-routine="' + routine.id + '">削除</button></div>';
      var meta = routineListMode === "manage" ? '<p class="routine-card-meta">更新 ' + updated + '</p>' : "";
      return '<article class="routine-card routine-card--compact">' + head + meta + (routineListMode === "manage" ? manage : "") + '</article>';
    }).join("") + '<button class="outline-button outline-button--blue" type="button" data-create-routine>新しいルーティーンを登録</button>';
  }

  function renderRoutineDetail(routineId) {
    var routine = getRoutine(routineId);
    if (!routine) {
      showToast("ルーティーンが見つかりません");
      renderRoutineList();
      return;
    }
    routineDetailId = routineId;
    $("#routineListTitle").textContent = routine.name;
    var lead = $("#routineListModal .modal-lead");
    if (lead) lead.textContent = "";
    var entries = routineExerciseEntries(routine).map(function (entry) {
      var exercise = getExercise(entry.exerciseId);
      return exercise ? exercise.name : "不明な種目";
    });
    var listHtml = entries.length
      ? '<ol class="routine-detail-exercises">' + entries.map(function (name) { return '<li>' + escapeHtml(name) + '</li>'; }).join("") + '</ol>'
      : '<div class="empty-state">種目はまだありません。</div>';
    $("#routineList").innerHTML = '<div class="routine-detail"><p class="routine-detail-label">このルーティーンに含まれる種目</p>' + listHtml + '<p class="routine-detail-question">このルーティーンを今日のメニューに追加しますか？</p><div class="routine-detail-actions"><button class="finish-button" type="button" data-use-routine="' + routine.id + '">はい</button><button class="outline-button" type="button" data-routine-detail-back>いいえ</button></div></div>';
  }

  function openRoutineList(dateValue, mode) {
    routineTargetDate = dateValue || todayString();
    routineListMode = mode || "use";
    routineDetailId = null;
    renderRoutineList();
    openModal("routineListModal");
  }

  function draftFromRoutine(routine, dateValue, scheduleId) {
    var appendToCurrentDraft = draft && draft.date === dateValue && draft.locationType === routine.locationType;
    if (!appendToCurrentDraft) {
      draft = createWorkoutDraft({ date: dateValue, locationType: routine.locationType, sourceScheduleId: scheduleId || null, menuSource: scheduleId ? "scheduled" : "routine" });
    } else {
      draft.pendingCardioTypes = draft.pendingCardioTypes || [];
      if (scheduleId) draft.sourceScheduleId = scheduleId;
      draft.menuSource = scheduleId ? "scheduled" : "routine";
    }
    var legacyRecords = Array.isArray(routine.records) ? routine.records : [];
    if (legacyRecords.length || (routine.cardios || []).length) appendRecordsAndCardiosToDraft(draft, legacyRecords, routine.cardios || []);
    if (!legacyRecords.length && Array.isArray(routine.exercises)) {
      routineExerciseEntries(routine).forEach(function (entry, index) {
        var exercise = getExercise(entry.exerciseId);
        if (!exercise) return;
        if (exercise.category === "CARDIO") {
          var alreadyPending = draft.pendingCardioTypes.indexOf(exercise.name) >= 0;
          var alreadyRecorded = draft.cardios.some(function (cardio) { return cardio.type === exercise.name; });
          if (!alreadyPending && !alreadyRecorded) draft.pendingCardioTypes.push(exercise.name);
        } else {
          if (!draft.records.some(function (record) { return record.exerciseId === exercise.id; })) {
            draft.records.push({ tempId: makeId("draftrecord"), exerciseId: exercise.id, orderIndex: draft.records.length, sets: [] });
          }
        }
      });
    }
    expandedDraftExerciseId = null;
    expandedDraftCardioKey = null;
    resetWorkoutEditorState();
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

  function getOverallProgress(metric) {
    var daily = {};
    data.sessions.forEach(function (session) {
      if (!daily[session.date]) daily[session.date] = { totalCalories: 0, totalVolume: 0 };
      daily[session.date].totalCalories += calculateSessionCalories(session.id);
      daily[session.date].totalVolume += calculateSessionStrengthVolume(session.id);
    });
    return Object.keys(daily).sort().map(function (date) {
      return { date: date, value: daily[date][metric] || 0 };
    }).filter(function (point) { return point.value > 0; });
  }

  function filterProgressPointsByRange(points, range, customStart, customEnd) {
    if (!points.length) return [];
    if (range === "all") return points.slice();
    if (range === "currentMonth") {
      var today = dateFromString(todayString());
      var start = new Date(today.getFullYear(), today.getMonth(), 1);
      var end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return points.filter(function (point) {
        var date = dateFromString(point.date);
        return date >= start && date <= end;
      });
    }
    if (range === "custom") {
      if (!customStart || !customEnd) return points.slice();
      return points.filter(function (point) {
        return point.date >= customStart && point.date <= customEnd;
      });
    }
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
      },
      totalCalories: {
        title: "消費カロリーを振り返ろう",
        description: "筋トレと有酸素を合計した、1日ごとの消費カロリーを確認できます。",
        first: "最初の記録", latest: "最新の記録"
      },
      totalVolume: {
        title: "トレーニング量を振り返ろう",
        description: "その日に積み重ねた筋トレの総ボリュームを確認できます。",
        first: "最初の記録", latest: "最新の記録"
      }
    };
    return copies[metric] || (tab === "overall" ? copies.totalCalories : (tab === "strength" ? copies.maxWeight : copies.distance));
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
    if (metric === "totalVolume") return "前より" + amount + "多く積み重ねられています。" + bestSuffix;
    if (metric === "totalCalories") return "前より" + amount + "多く動けています。" + bestSuffix;
    return "運動量が前より" + amount + "増えました。" + bestSuffix;
  }

  function getProgressTickStep(metric, minValue, maxValue) {
    var span = Math.max(0, maxValue - minValue);
    if (metric === "maxWeight" || metric === "oneRm") return 5;
    if (metric === "volume" || metric === "totalVolume") {
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
    if (metric === "calories" || metric === "totalCalories") {
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
      var axisLabelX = Math.round(margin.left - 9);
      var axisLabelY = Math.round(y + 4);
      var tickDecimals = scale.step < 1 ? 1 : 0;
      var tickText = tickValue.toLocaleString("ja-JP", { minimumFractionDigits: tickDecimals, maximumFractionDigits: tickDecimals });
      grid += '<line class="chart-grid-line" x1="' + margin.left + '" y1="' + y.toFixed(1) + '" x2="' + (width - margin.right) + '" y2="' + y.toFixed(1) + '"/><text class="chart-axis-label" x="' + axisLabelX + '" y="' + axisLabelY + '" text-anchor="end">' + tickText + '</text>';
    });
    var linePath = coordinates.map(function (coordinate, index) { return (index ? "L" : "M") + coordinate.x.toFixed(1) + " " + coordinate.y.toFixed(1); }).join(" ");
    var areaPath = coordinates.length > 1 ? linePath + " L" + coordinates[coordinates.length - 1].x.toFixed(1) + " " + (margin.top + plotHeight) + " L" + coordinates[0].x.toFixed(1) + " " + (margin.top + plotHeight) + " Z" : "";
    var dateLabels = coordinates.map(function (coordinate) {
      var axisLabelX = Math.round(coordinate.x);
      var axisLabelY = Math.round(height - 17);
      return '<text class="chart-axis-label" x="' + axisLabelX + '" y="' + axisLabelY + '" text-anchor="middle">' + progressDateLabel(coordinate.point.date) + '</text>';
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
    var isOverall = progressState.tab === "overall";
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
    var exerciseField = $("#progressExerciseField");
    if (exerciseField) exerciseField.classList.toggle("hidden", isOverall);
    $("#progressCustomRange").classList.toggle("hidden", progressState.range !== "custom");
    $("#progressCustomStart").value = progressState.customStart || "";
    $("#progressCustomEnd").value = progressState.customEnd || "";
    if (isOverall) {
      var overallMetricKeys = ["totalCalories", "totalVolume"];
      if (overallMetricKeys.indexOf(progressState.metric) < 0) progressState.metric = overallMetricKeys[0];
      metricSelect.innerHTML = overallMetricKeys.map(function (key) { return '<option value="' + key + '">' + OVERALL_METRICS[key].label + '</option>'; }).join("");
      metricSelect.value = progressState.metric;
      exerciseSelect.innerHTML = "";
      definition = OVERALL_METRICS[progressState.metric];
      selectedLabel = "";
      points = getOverallProgress(progressState.metric);
      $("#progressExerciseLabel").textContent = "種目";
    } else if (isStrength) {
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
    points = filterProgressPointsByRange(points, progressState.range, progressState.customStart, progressState.customEnd);
    $("#progressRangeSelect").value = progressState.range;
    var displayCopy = getProgressDisplayCopy(progressState.tab, progressState.metric);
    $("#progressHeroTitle").textContent = displayCopy.title;
    $("#progressHeroDescription").textContent = displayCopy.description;
    $("#progressFirstLabel").textContent = displayCopy.first;
    $("#progressLatestLabel").textContent = displayCopy.latest;
    $("#progressGrowthLabel").textContent = "伸び幅";
    $("#progressBestLabel").textContent = "自己ベスト";
    $("#progressMetricHelp").textContent = definition.help;
    var chartTitle = isOverall ? definition.label + "の推移" : selectedLabel + "の" + definition.label + "推移";
    $("#progressChartTitle").textContent = chartTitle;
    $("#progressChartMeta").textContent = "単位：" + definition.unit + (progressState.metric === "volume" || progressState.metric === "totalVolume" ? "　｜　重量×回数の合計" : "");
    $("#progressPointCount").textContent = points.length + "日";
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
    renderProgressChart(points, definition, chartTitle);
  }

  function defaultProgressMetric(tab) {
    if (tab === "overall") return "totalCalories";
    if (tab === "cardio") return "distance";
    return "maxWeight";
  }

  function openProgressPage(options) {
    options = options || {};
    progressState.tab = options.tab || "strength";
    progressState.metric = options.metric || defaultProgressMetric(progressState.tab);
    progressState.exerciseId = options.exerciseId || null;
    progressState.cardioType = options.cardioType || progressState.cardioType || "ウォーキング";
    progressState.range = options.range || "6m";
    progressState.customStart = options.customStart || "";
    progressState.customEnd = options.customEnd || "";
    renderProgressPage();
    showScreen("progress");
  }

  function getCalendarCursorMonthRange() {
    var year = calendarCursor.getFullYear();
    var month = calendarCursor.getMonth();
    var lastDay = new Date(year, month + 1, 0).getDate();
    return {
      start: year + "-" + String(month + 1).padStart(2, "0") + "-01",
      end: year + "-" + String(month + 1).padStart(2, "0") + "-" + String(lastDay).padStart(2, "0")
    };
  }

  function openDisplayedMonthCaloriesProgress() {
    var range = getCalendarCursorMonthRange();
    openProgressPage({ tab: "overall", metric: "totalCalories", range: "custom", customStart: range.start, customEnd: range.end });
  }

  function openDisplayedMonthVolumeProgress() {
    var range = getCalendarCursorMonthRange();
    openProgressPage({ tab: "overall", metric: "totalVolume", range: "custom", customStart: range.start, customEnd: range.end });
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
    resetWorkoutEditorState({ selectedExerciseId: cardioExercise ? cardioExercise.id : null, editingCardioTempId: cardio.tempId });
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
    stopRestTimer();
    routineEditingId = null;
    draft = createWorkoutDraft({ date: date || todayString(), locationType: locationType, menuSource: "manual" });
    expandedDraftExerciseId = null;
    expandedDraftCardioKey = null;
    resetWorkoutEditorState();
    resetCardioForm();
    renderWorkout();
    showScreen("workout");
    saveDraftNow();
  }

  function startTodayLocation(locationType) {
    unlockWorkoutAudio();
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
    stopRestTimer();
    routineEditingId = null;
    draft = createWorkoutDraft({
      id: session.id,
      originalSessionId: session.id,
      date: session.date,
      locationType: session.locationType,
      memo: session.memo || "",
      menuSource: "saved",
      createdAt: session.createdAt,
      records: getSessionRecords(session.id).map(function (record) {
        return { tempId: record.id, exerciseId: record.exerciseId, orderIndex: record.orderIndex, sets: getRecordSets(record.id).map(function (set) { return Object.assign({}, set, { tempId: set.id }); }) };
      }),
      cardios: getSessionCardios(session.id).map(function (cardio) { return Object.assign({}, cardio, { tempId: cardio.id }); })
    });
    expandedDraftExerciseId = null;
    expandedDraftCardioKey = null;
    resetWorkoutEditorState();
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
    var resultDraft = createWorkoutDraft({
      id: keepSessionId ? source.id : null,
      originalSessionId: keepSessionId ? source.id : null,
      date: targetDate,
      locationType: source.locationType,
      memo: keepSessionId ? (source.memo || "") : "",
      menuSource: keepSessionId ? "saved" : "copy",
      createdAt: keepSessionId ? source.createdAt : nowIso()
    });
    appendRecordsAndCardiosToDraft(resultDraft, getSessionRecords(source.id), getSessionCardios(source.id));
    return resultDraft;
  }

  function finishCopiedDraft() {
    if (!draft) return;
    expandedDraftExerciseId = null;
    expandedDraftCardioKey = null;
    resetWorkoutEditorState();
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
      draft.menuSource = "copy";
    } else {
      draft = createDraftFromSession(conflict.sourceId, conflict.targetDate, false);
      draft.id = existing.id;
      draft.originalSessionId = existing.id;
      draft.createdAt = existing.createdAt;
      draft.menuSource = "copy";
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

  function isPlannedDraftMenu() {
    return !!(draft && (draft.menuSource === "routine" || draft.menuSource === "copy" || draft.menuSource === "scheduled"));
  }

  function isGuideEligibleDraft(draftValue) {
    return !!(draftValue && (draftValue.menuSource === "routine" || draftValue.menuSource === "copy" || draftValue.menuSource === "scheduled"));
  }

  function shouldShowGuideModeActions() {
    return isGuideModeEnabled() && !!draft && isGuideEligibleDraft(draft) && !isGuideActive();
  }

  function isGuideActive() {
    return !!(draft && draft.guideState && draft.guideState.active);
  }

  function guideState() {
    return isGuideActive() ? draft.guideState : null;
  }

  function guideItems(state) {
    return state && Array.isArray(state.menuItems) ? state.menuItems : [];
  }

  function canUndoGuideLastAction(state) {
    return !!(state && state.lastAction && state.lastAction.type === "skipItem");
  }

  function renderGuideUndoActions(state) {
    var canUndo = canUndoGuideLastAction(state);
    ["#guideUndoLastActionButton", "#guideMenuUndoLastActionButton", "#guideExercisePickerUndoButton"].forEach(function (selector) {
      var button = $(selector);
      if (button) button.classList.toggle("hidden", !canUndo);
    });
  }

  function countGuideCompletedSets(state) {
    return guideItems(state).reduce(function (sum, item) {
      return sum + (Array.isArray(item.completedSets) ? item.completedSets.length : 0);
    }, 0);
  }

  function guideItemName(item) {
    if (!item) return "種目";
    if (item.type === "cardio") return item.cardioType || "有酸素";
    var exercise = getExercise(item.exerciseId);
    return exercise ? exercise.name : item.name || "種目";
  }

  function guideItemExercise(item) {
    return item && item.exerciseId ? getExercise(item.exerciseId) : null;
  }

  function guideItemPlannedSets(item) {
    if (!item || !Array.isArray(item.plannedSets)) return [];
    return item.plannedSets;
  }

  function guideItemCompletedSets(item) {
    if (!item) return [];
    if (!Array.isArray(item.completedSets)) item.completedSets = [];
    return item.completedSets;
  }

  function nextGuideCompletedOrder(state) {
    var usedOrders = guideItems(state).map(function (item) { return Number(item.completedOrder || 0); }).filter(function (value) { return value > 0; });
    return usedOrders.length ? Math.max.apply(null, usedOrders) + 1 : 1;
  }

  function markGuideItemCompleted(item, state) {
    if (!item || !state) return;
    item.status = "completed";
    if (!item.completedOrder) {
      item.completedOrder = nextGuideCompletedOrder(state);
      item.completedAt = nowIso();
    }
  }

  function guideStatusLabel(status) {
    return {
      pending: "未完了",
      active: "実行中",
      deferred: "後回し",
      completed: "完了",
      skipped: "今回はやらない"
    }[status] || "未完了";
  }

  function guideCurrentItem() {
    var state = guideState();
    if (!state) return null;
    return guideItems(state).find(function (item) { return item.id === state.currentItemId; }) || null;
  }

  function guideDefaultSetForExercise(exerciseId, index) {
    var historical = getLastHistoricalRecord(exerciseId);
    var historicalSets = historical ? getRecordSets(historical.id) : [];
    var source = historicalSets[index] || historicalSets[historicalSets.length - 1] || null;
    return {
      id: makeId("guideset"),
      status: "planned",
      weight: source ? Number(source.weight || 0) : 0,
      reps: source ? Number(source.reps || 10) : 10,
      rir: source && source.rir != null ? source.rir : "",
      restSeconds: source ? Number(source.restSeconds || 90) : 90,
      memo: source ? (source.memo || "") : ""
    };
  }

  function guideDefaultCardioForType(type, sourceCardio) {
    var normalizedType = type === "傾斜ウォーク" ? "ウォーキング" : type;
    var source = sourceCardio || getLastHistoricalCardio(normalizedType) || {};
    var result = calculateCardio({
      type: normalizedType,
      durationMinutes: Number(source.durationMinutes || 0),
      distanceKm: Number(source.distanceKm || 0),
      inclinePercent: Number(source.inclinePercent || 0),
      memo: source.memo || ""
    });
    return {
      tempId: source.tempId || null,
      type: normalizedType,
      durationMinutes: Number(source.durationMinutes || 0),
      distanceKm: Number(source.distanceKm || 0),
      inclinePercent: Number(source.inclinePercent || 0),
      memo: source.memo || "",
      speedKmh: result.speedKmh,
      calories: result.calories
    };
  }

  function cardioMetricSummary(cardio, emptyText) {
    var source = cardio || {};
    var distance = Number(source.distanceKm || 0);
    var duration = Number(source.durationMinutes || 0);
    var incline = Number(source.inclinePercent || 0);
    var speed = distance > 0 && duration > 0 ? distance / (duration / 60) : 0;
    var savedCalories = Number(source.calories);
    var calculated = duration > 0 ? calculateCardio(source).calories : 0;
    var calories = Number.isFinite(savedCalories) && savedCalories > 0 ? savedCalories : calculated;
    var details = [];
    if (duration > 0) details.push(formatNumberForInput(duration, 1) + "分");
    if (distance > 0) details.push(formatNumberForInput(distance, 0.1) + "km");
    if (speed > 0) details.push("時速" + speed.toFixed(1) + "km/h");
    if (incline > 0) details.push("傾斜" + formatNumberForInput(incline, 0.5) + "%");
    if (calories > 0) details.push("約" + Math.round(calories) + "kcal");
    return details.length ? details.join(" / ") : (emptyText || "距離・時間は記録時に入力");
  }

  function draftGuideMenuEntries() {
    if (!draft) return [];
    var entries = [];
    draft.records.slice().sort(function (a, b) { return Number(a.orderIndex || 0) - Number(b.orderIndex || 0); }).forEach(function (record) {
      entries.push({ key: "record:" + record.exerciseId, type: "record", exerciseId: record.exerciseId, record: record });
    });
    (draft.cardios || []).forEach(function (cardio) {
      entries.push({ key: "cardio:" + cardio.tempId, type: "cardio", exerciseId: cardioExerciseId(cardio.type), cardio: cardio });
    });
    (draft.pendingCardioTypes || []).forEach(function (type) {
      entries.push({ key: "pending-cardio:" + type, type: "pending-cardio", exerciseId: cardioExerciseId(type), cardioType: type });
    });
    var order = Array.isArray(draft.menuOrder) ? draft.menuOrder : [];
    if (!order.length) return entries;
    var fallbackIndex = entries.length;
    return entries.slice().sort(function (a, b) {
      var indexA = order.indexOf(a.key);
      var indexB = order.indexOf(b.key);
      if (indexA < 0) indexA = fallbackIndex + entries.indexOf(a);
      if (indexB < 0) indexB = fallbackIndex + entries.indexOf(b);
      return indexA - indexB;
    });
  }

  function applyDraftGuideMenuOrder(order) {
    if (!draft || !Array.isArray(order)) return;
    draft.menuOrder = order.slice();
    var recordOrder = order.filter(function (key) { return key.indexOf("record:") === 0; }).map(function (key) { return key.slice(7); });
    var cardioOrder = order.filter(function (key) { return key.indexOf("cardio:") === 0; }).map(function (key) { return key.slice(7); });
    var pendingOrder = order.filter(function (key) { return key.indexOf("pending-cardio:") === 0; }).map(function (key) { return key.slice(15); });
    draft.records.sort(function (a, b) {
      var indexA = recordOrder.indexOf(a.exerciseId);
      var indexB = recordOrder.indexOf(b.exerciseId);
      if (indexA < 0) indexA = draft.records.indexOf(a);
      if (indexB < 0) indexB = draft.records.indexOf(b);
      return indexA - indexB;
    });
    renumberDraftRecords();
    draft.cardios.sort(function (a, b) {
      var indexA = cardioOrder.indexOf(a.tempId);
      var indexB = cardioOrder.indexOf(b.tempId);
      if (indexA < 0) indexA = draft.cardios.indexOf(a);
      if (indexB < 0) indexB = draft.cardios.indexOf(b);
      return indexA - indexB;
    });
    draft.pendingCardioTypes = (draft.pendingCardioTypes || []).slice().sort(function (a, b) {
      var indexA = pendingOrder.indexOf(a);
      var indexB = pendingOrder.indexOf(b);
      if (indexA < 0) indexA = draft.pendingCardioTypes.indexOf(a);
      if (indexB < 0) indexB = draft.pendingCardioTypes.indexOf(b);
      return indexA - indexB;
    });
    saveDraftNow();
  }

  function buildGuidePlannedSets(record) {
    var sourceSets = Array.isArray(record.sets) ? record.sets : [];
    if (!sourceSets.length) {
      var historical = getLastHistoricalRecord(record.exerciseId);
      sourceSets = historical ? getRecordSets(historical.id) : [];
    }
    if (!sourceSets.length) {
      return [0, 1, 2].map(function (index) { return guideDefaultSetForExercise(record.exerciseId, index); });
    }
    return sourceSets.map(function (set) {
      return {
        id: makeId("guideset"),
        status: "planned",
        weight: Number(set.weight || 0),
        reps: Number(set.reps || 10),
        rir: set.rir == null ? "" : set.rir,
        restSeconds: Number(set.restSeconds || 90),
        memo: set.memo || ""
      };
    });
  }

  function createGuideItemFromExercise(exerciseId, plannedSets) {
    var exercise = getExercise(exerciseId);
    if (!exercise) return null;
    if (exercise.category === "CARDIO") {
      return {
        id: makeId("guideitem"),
        type: "cardio",
        exerciseId: exercise.id,
        cardioType: exercise.name,
        name: exercise.name,
        category: exercise.category,
        status: "pending",
        plannedCardio: guideDefaultCardioForType(exercise.name),
        completedCardio: null
      };
    }
    return {
      id: makeId("guideitem"),
      type: "strength",
      exerciseId: exercise.id,
      name: exercise.name,
      category: exercise.category,
      status: "pending",
      currentSetIndex: 0,
      plannedSets: plannedSets && plannedSets.length ? plannedSets : [0, 1, 2].map(function (index) { return guideDefaultSetForExercise(exercise.id, index); }),
      completedSets: [],
      isAddingExtraSets: false
    };
  }

  function buildGuideStateFromDraft(startExerciseId) {
    if (!draft) return null;
    var items = draftGuideMenuEntries().map(function (entry) {
      if (entry.type === "record") return createGuideItemFromExercise(entry.exerciseId, buildGuidePlannedSets(entry.record));
      if (entry.type === "cardio") {
        var cardioItem = createGuideItemFromExercise(entry.exerciseId);
        if (!cardioItem) return null;
        cardioItem.plannedCardio = guideDefaultCardioForType(entry.cardio.type, entry.cardio);
        return cardioItem;
      }
      if (entry.type === "pending-cardio") return createGuideItemFromExercise(entry.exerciseId);
      return null;
    }).filter(Boolean);
    if (!items.length) return null;
    var selectedItem = startExerciseId ? items.find(function (item) { return item.exerciseId === startExerciseId; }) : null;
    if (!selectedItem) selectedItem = items[0];
    selectedItem.status = "active";
    return {
      active: true,
      status: selectedItem.type === "cardio" ? "cardio" : "set",
      currentItemId: selectedItem.id,
      currentSetIndex: 0,
      startedAt: nowIso(),
      updatedAt: nowIso(),
      startExerciseId: selectedItem ? selectedItem.exerciseId : null,
      selectedNextItemId: null,
      selectNextMode: "alternate",
      currentInput: null,
      menuItems: items
    };
  }

  function currentGuidePlannedSet(item) {
    var state = guideState();
    var completedSets = guideItemCompletedSets(item);
    var completedCount = completedSets.length;
    var planned = guideItemPlannedSets(item);
    var index = Number(state && Number.isFinite(state.currentSetIndex) ? state.currentSetIndex : completedCount);
    if (index < completedCount) index = completedCount;
    if (completedCount > 0 && index >= completedCount) {
      var previousCompleted = completedSets[completedCount - 1];
      return Object.assign({}, previousCompleted, { id: makeId("guideset"), status: "planned", memo: "" });
    }
    if (index >= planned.length) {
      var lastCompleted = completedSets[completedCount - 1];
      return lastCompleted ? Object.assign({}, lastCompleted, { id: makeId("guideset"), status: "planned", memo: "" }) : guideDefaultSetForExercise(item.exerciseId, index);
    }
    return planned[index];
  }

  function guideWeightStep(exercise) {
    return exercise && exercise.category === "BODYWEIGHT" ? 0 : 1;
  }

  function guideInputValues() {
    var item = guideCurrentItem();
    var exercise = guideItemExercise(item);
    var rawWeight = exercise && exercise.category === "BODYWEIGHT" ? 0 : Number($("#guideWeightInput").value);
    var rawReps = Number($("#guideRepsInput").value);
    return {
      weight: Math.round((Number.isFinite(rawWeight) ? Math.max(0, rawWeight) : 0) * 1000),
      reps: Math.max(1, Math.round(Number.isFinite(rawReps) ? rawReps : 10)),
      rir: selectedRir == null ? "" : selectedRir,
      restSeconds: Number.isFinite(Number(selectedRest)) ? Number(selectedRest) : 90,
      memo: ($("#guideSetMemo") ? $("#guideSetMemo").value.trim() : "")
    };
  }

  function captureGuideInputToState() {
    var state = guideState();
    var item = guideCurrentItem();
    if (!state || !item || state.status !== "set") return;
    state.currentInput = Object.assign({ itemId: item.id, setIndex: Number(state.currentSetIndex || 0) }, guideInputValues());
    state.updatedAt = nowIso();
  }

  function populateGuideSetInputs(sourceSet) {
    var item = guideCurrentItem();
    var exercise = guideItemExercise(item);
    var set = sourceSet || currentGuidePlannedSet(item) || {};
    $("#guideWeightBlock").classList.toggle("hidden", exercise && exercise.category === "BODYWEIGHT");
    $("#guideWeightStepLabel").textContent = "10kg / 1kg / 0.5kg";
    $("#guideWeightInput").step = 0.5;
    $("#guideWeightInput").value = exercise && exercise.category === "BODYWEIGHT" ? 0 : (Number(set.weight || 0) / 1000).toFixed(1);
    $("#guideRepsInput").value = Number(set.reps || 10);
    selectedRir = set.rir === undefined || set.rir === null || set.rir === "" ? null : String(set.rir);
    selectedRest = Number(set.restSeconds || 90);
    $("#guideSetMemo").value = set.memo || "";
    renderGuideChoices();
  }

  function guideCardioFormValue() {
    var item = guideCurrentItem();
    var type = item && item.type === "cardio" ? item.cardioType : "ウォーキング";
    return {
      type: type,
      durationMinutes: numberValue("#guideCardioDuration"),
      distanceKm: numberValue("#guideCardioDistance"),
      inclinePercent: numberValue("#guideCardioIncline"),
      memo: $("#guideCardioMemo") ? $("#guideCardioMemo").value.trim() : ""
    };
  }

  function updateGuideCardioPreview() {
    var preview = $("#guideCardioPreview");
    if (!preview) return;
    var cardio = guideCardioFormValue();
    if (!cardio.durationMinutes) {
      preview.innerHTML = ['時間 <strong>--</strong>', '距離 <strong>--</strong>', '速度 <strong>--</strong>', '傾斜 <strong>--</strong>', '概算消費カロリー <strong>--</strong>'].map(function (part) { return "<span>" + part + "</span>"; }).join("");
      return;
    }
    var result = calculateCardio(cardio);
    var parts = [
      '時間 <strong>' + formatNumberForInput(Number(cardio.durationMinutes || 0), 1) + '分</strong>',
      '距離 <strong>' + (Number(cardio.distanceKm || 0) > 0 ? formatNumberForInput(Number(cardio.distanceKm || 0), 0.1) + 'km' : '--') + '</strong>',
      '速度 <strong>' + (result.speedKmh ? result.speedKmh.toFixed(1) + ' km/h' : '距離未入力') + '</strong>',
      '傾斜 <strong>' + (Number(cardio.inclinePercent || 0) > 0 ? formatNumberForInput(Number(cardio.inclinePercent || 0), 0.5) + '%' : '--') + '</strong>',
      '概算消費カロリー <strong>' + Math.round(result.calories) + ' kcal</strong>'
    ];
    preview.innerHTML = parts.map(function (part) { return "<span>" + part + "</span>"; }).join("");
  }

  function populateGuideCardioInputs(item) {
    if (!item || item.type !== "cardio") return;
    var source = item.currentCardioInput || item.completedCardio || item.plannedCardio || guideDefaultCardioForType(item.cardioType);
    $("#guideCardioTitle").textContent = guideItemName(item);
    $("#guideCardioDuration").value = source && Number(source.durationMinutes || 0) ? formatNumberForInput(Number(source.durationMinutes || 0), 1) : "";
    $("#guideCardioDistance").value = source && Number(source.distanceKm || 0) ? formatNumberForInput(Number(source.distanceKm || 0), 0.1) : "";
    $("#guideCardioIncline").value = source && Number(source.inclinePercent || 0) ? formatNumberForInput(Number(source.inclinePercent || 0), 0.5) : "";
    $("#guideCardioMemo").value = source && source.memo ? source.memo : "";
    updateGuideCardioPreview();
  }

  function captureGuideCardioInputToState() {
    var item = guideCurrentItem();
    var state = guideState();
    if (!state || !item || item.type !== "cardio" || state.status !== "cardio") return;
    item.currentCardioInput = guideCardioFormValue();
    state.updatedAt = nowIso();
  }

  function restoreGuideInputForCurrentItem() {
    var state = guideState();
    var item = guideCurrentItem();
    var input = state && state.currentInput;
    if (input && item && input.itemId === item.id && Number(input.setIndex || 0) === Number(state.currentSetIndex || 0)) {
      populateGuideSetInputs(input);
    } else {
      populateGuideSetInputs(currentGuidePlannedSet(item));
    }
  }

  function renderGuideChoices() {
    $$("#guideRirChoices button").forEach(function (button) {
      button.classList.toggle("is-selected", selectedRir !== null && button.dataset.guideRir === selectedRir);
    });
    $$("#guideRestChoices button").forEach(function (button) {
      button.classList.toggle("is-selected", Number(button.dataset.guideRest) === Number(selectedRest));
    });
  }

  function guideSetMeta(item) {
    var planned = guideItemPlannedSets(item);
    var completed = guideItemCompletedSets(item);
    var state = guideState();
    var setIndex = Number(state && Number.isFinite(state.currentSetIndex) ? state.currentSetIndex : completed.length);
    if (setIndex < completed.length) setIndex = completed.length;
    return {
      planned: planned,
      completed: completed,
      setIndex: setIndex,
      setNumber: setIndex + 1,
      totalSets: Math.max(planned.length, setIndex + 1)
    };
  }

  function guideSubmittedSetToken(item, plannedSet, setIndex) {
    return [
      item && item.id ? item.id : "guide-item",
      plannedSet && (plannedSet.id || plannedSet.tempId) ? (plannedSet.id || plannedSet.tempId) : "extra",
      Number(setIndex || 0)
    ].join(":");
  }

  function setGuideCompleteButtonLocked(locked, label) {
    var button = $("#completeGuideSetButton");
    if (!button) return;
    button.disabled = !!locked;
    if (label) button.textContent = label;
    button.setAttribute("aria-disabled", locked ? "true" : "false");
  }

  function releaseGuideSetSaveLockLater() {
    if (guideSetLockTimer) clearTimeout(guideSetLockTimer);
    guideSetLockTimer = setTimeout(function () {
      guideSetSaveLocked = false;
      renderGuideWorkout();
    }, 900);
  }

  function showGuideSetSavedNotice(savedSet, nextSetNumber, isFinal) {
    var notice = $("#guideSetSavedNotice");
    if (!notice) return;
    if (guideSetNoticeTimer) clearTimeout(guideSetNoticeTimer);
    var item = guideCurrentItem();
    var exercise = guideItemExercise(item);
    var savedSetNumber = typeof savedSet === "object" ? Number(savedSet.setNumber || 0) : Number(savedSet || 0);
    var set = typeof savedSet === "object" ? savedSet : null;
    var weightText = set ? formatWeightForAiExport(exercise, set.weight) : "";
    var repsText = set ? " × " + Number(set.reps || 0) + "回" : "";
    notice.innerHTML = isFinal
      ? savedSetNumber + "セット目を保存しました<br>" + escapeHtml(weightText + repsText)
      : savedSetNumber + "セット目を保存しました<br>" + escapeHtml(weightText + repsText) + "<br>次は" + nextSetNumber + "セット目です";
    notice.classList.remove("hidden");
    notice.classList.add("is-visible");
    guideSetNoticeTimer = setTimeout(function () {
      notice.classList.add("hidden");
      notice.classList.remove("is-visible");
    }, 1600);
  }

  function guideRestTimerFinishedMessage() {
    var item = guideCurrentItem();
    if (!item) return "休憩終了";
    var meta = guideSetMeta(item);
    return "休憩終了 / " + meta.setNumber + "セット目を開始できます";
  }

  function animateGuideSetStage() {
    var card = $("#guideSetCard");
    if (!card) return;
    card.classList.remove("is-leaving", "is-entering", "is-active");
    card.classList.add("is-entering");
    var requestFrame = window.requestAnimationFrame || function (callback) { return setTimeout(callback, 0); };
    requestFrame(function () {
      card.classList.add("is-active");
      card.classList.remove("is-entering");
    });
  }

  function scrollGuideToCurrentSet() {
    var anchor = [$("#guideRestTimer"), $("#guideSetTopAnchor"), $("#guideSetCard"), $("#guideFinishedSetCard"), $("#guideCompletedDetailCard"), $("#guideSelectNextCard")].find(function (candidate) {
      return candidate && candidate.offsetParent !== null;
    });
    if (!anchor) return;
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    anchor.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start"
    });
  }

  function scheduleGuideCurrentSetScroll() {
    requestAnimationFrame(function () {
      requestAnimationFrame(scrollGuideToCurrentSet);
    });
  }

  function debugGuideTimer(message, details) {
    if (typeof console === "undefined" || typeof console.debug !== "function") return;
    console.debug("[GuideTimer] " + message, details || {});
  }

  function renderGuideRestTimer() {
    var box = $("#guideRestTimer");
    if (!box) return;
    var showTimer = isRestTimerEnabled() && isGuideActive() && restTimerState.status !== "idle";
    box.classList.toggle("hidden", !showTimer);
    var debugKey = [
      isGuideActive() ? "guide" : "normal",
      restTimerState.status,
      showTimer ? "visible" : "hidden"
    ].join(":");
    if (debugKey !== guideRestTimerDebugKey) {
      guideRestTimerDebugKey = debugKey;
      debugGuideTimer("render", {
        guideActive: isGuideActive(),
        visible: showTimer,
        status: restTimerState.status,
        remainingSeconds: calculateRestTimerRemaining(restTimerState)
      });
    }
    if (!showTimer) {
      box.classList.remove("is-finished");
      box.classList.remove("is-overtime");
      return;
    }
    var remaining = calculateRestTimerRemaining(restTimerState);
    var isOvertime = remaining < 0;
    box.classList.toggle("is-finished", false);
    box.classList.toggle("is-overtime", isOvertime);
    $("#guideRestTimerLabel").textContent = isOvertime ? "休憩時間を過ぎています" : "休憩中";
    $("#guideRestTimerTime").textContent = formatRestTimerTime(remaining);
    $("#guideRestPause").textContent = restTimerState.status === "paused" ? "再開" : "一時停止";
  }

  function guideChoiceProgressText(item) {
    if (!item) return "";
    if (item.type === "cardio") {
      var cardioSummary = cardioMetricSummary(item.completedCardio || item.currentCardioInput || item.plannedCardio, "距離・時間は記録時に入力");
      return item.completedCardio ? "完了：" + cardioSummary : "予定：" + cardioSummary;
    }
    var completed = guideItemCompletedSets(item).length;
    var total = guideItemPlannedSets(item).length;
    if (item.status === "completed") {
      return total && completed > total
        ? "予定：" + total + "セット / 完了：" + completed + "セット"
        : "完了：" + completed + "セット";
    }
    if (completed > 0) return "予定：" + (total || completed + 1) + "セット / 完了：" + completed + "セット / 次：" + (completed + 1) + "セット目";
    return total ? "予定：" + total + "セット" : "予定：未設定";
  }

  function guideCompletedDetailHtml(item) {
    if (!item) return "";
    if (item.type === "cardio") {
      var cardio = item.completedCardio;
      if (!cardio) return '<div class="empty-state">まだ完了した記録はありません。</div>';
      var cardioMemo = cardio.memo ? '<small>メモ：' + escapeHtml(cardio.memo) + '</small>' : "";
      return '<div class="guide-completed-set-row"><strong>' + escapeHtml(cardioMetricSummary(cardio, "距離・時間は記録時に入力")) + '</strong>' + cardioMemo + '</div>';
    }
    var exercise = guideItemExercise(item);
    var sets = guideItemCompletedSets(item);
    if (!sets.length) return '<div class="empty-state">まだ完了したセットはありません。</div>';
    return sets.map(function (set, index) {
      var parts = [
        formatWeightForAiExport(exercise, set.weight) + " × " + Number(set.reps || 0) + "回",
        "RIR " + (set.rir || "未入力"),
        "休憩" + Number(set.restSeconds || 0) + "秒"
      ];
      var memo = set.memo ? '<small>メモ：' + escapeHtml(set.memo) + '</small>' : "";
      return '<div class="guide-completed-set-row"><strong>' + (index + 1) + 'セット目：' + escapeHtml(parts.join(" / ")) + '</strong>' + memo + '</div>';
    }).join("");
  }

  function renderGuideCompletedDetail(state) {
    var item = state ? guideItems(state).find(function (entry) { return entry.id === state.detailItemId; }) : null;
    if (!item) return;
    var completedCount = item.type === "cardio" ? (item.completedCardio ? 1 : 0) : guideItemCompletedSets(item).length;
    $("#guideCompletedDetailTitle").textContent = guideItemName(item);
    $("#guideCompletedDetailSummary").textContent = item.type === "cardio" ? (completedCount ? "有酸素完了" : "未完了") : completedCount + "セット完了";
    $("#guideCompletedDetailSets").innerHTML = guideCompletedDetailHtml(item);
    $("#guideDetailAddSetButton").classList.toggle("hidden", item.type !== "strength");
  }

  function renderGuideNextChoiceList(state) {
    var list = $("#guideNextChoiceList");
    if (!list || !state) return;
    var choices = guideItems(state).filter(function (item) { return item.status !== "skipped"; });
    var completedChoices = choices.filter(function (item) { return item.status === "completed"; }).sort(function (a, b) {
      return Number(a.completedOrder || 9999) - Number(b.completedOrder || 9999);
    });
    var unfinishedChoices = choices.filter(function (item) { return item.status !== "completed"; });
    if (!completedChoices.length && !unfinishedChoices.length) {
      list.innerHTML = '<div class="empty-state">選べる種目はありません。</div>';
      return;
    }
    function choiceButton(item, index) {
      var progress = guideChoiceProgressText(item);
      var marker = item.status === "completed" ? "✓" : "○";
      var prefix = item.status === "completed" ? (index + 1) + ". " : "";
      return '<button class="guide-choice-item' + (item.status === "completed" ? ' is-completed' : '') + '" type="button" data-guide-select-item="' + item.id + '" data-sort-item="' + item.id + '"><span class="guide-choice-marker">' + marker + '</span><span><strong>' + escapeHtml(prefix + guideItemName(item)) + '</strong>' + (progress ? '<small>' + escapeHtml(progress) + '</small>' : '') + '</span></button>';
    }
    var html = "";
    if (completedChoices.length) {
      html += '<div class="guide-choice-group"><p>完了済み種目</p>' + completedChoices.map(choiceButton).join("") + '</div>';
    }
    if (unfinishedChoices.length) {
      html += '<div class="guide-choice-group"><p>未完了の種目</p>' + unfinishedChoices.map(choiceButton).join("") + '</div>';
    }
    list.innerHTML = html;
  }

  function renderGuideWorkout() {
    var state = guideState();
    if (!state) return;
    renderGuideUndoActions(state);
    var items = guideItems(state);
    var item = guideCurrentItem();
    var detailItem = state.status === "completedDetail" ? guideItems(state).find(function (entry) { return entry.id === state.detailItemId; }) : null;
    var currentIndex = item ? items.indexOf(item) : -1;
    var completedItems = items.filter(function (entry) { return entry.status === "completed" || entry.status === "skipped"; }).length;
    $("#guideProgressText").textContent = (Math.max(0, currentIndex) + 1) + " / " + items.length + "種目";
    $("#guideCurrentTitle").textContent = detailItem
      ? "完了した種目"
      : (state.status === "set" ? "セット記録中"
        : state.status === "cardio" ? "有酸素を記録中"
        : state.status === "itemComplete" ? "セット完了"
        : item ? "実施中"
        : "次の種目を選択");
    $("#guideProgressBadge").textContent = completedItems + "/" + items.length;
    var showSet = !!item && state.status === "set";
    var showCardio = !!item && state.status === "cardio";
    var showFinished = !!item && state.status === "itemComplete";
    var showCompletedDetail = !!detailItem;
    $("#guideSetCard").classList.toggle("hidden", !showSet);
    $("#guideCardioCard").classList.toggle("hidden", !showCardio);
    $("#guideFinishedSetCard").classList.toggle("hidden", !showFinished);
    $("#guideSelectNextCard").classList.toggle("hidden", showSet || showFinished || showCardio || showCompletedDetail);
    $("#guideCompletedDetailCard").classList.toggle("hidden", !showCompletedDetail);
    $("#guideMenuListButton").classList.toggle("hidden", !showSet && !showCardio && !showFinished);
    if (showCompletedDetail) {
      renderGuideCompletedDetail(state);
      renderGuideRestTimer();
      renderGuideMenuList();
      return;
    }
    if (showFinished) {
      var finishedMeta = guideSetMeta(item);
      var hasNextSet = guideItemCompletedSets(item).length < guideItemPlannedSets(item).length && item.status !== "completed";
      $("#guideFinishedExerciseName").textContent = guideItemName(item);
      $("#guideFinishedSetSummary").textContent = finishedMeta.completed.length + "セット目を完了しました";
      $("#guideChooseNextExerciseButton").textContent = hasNextSet ? "次のセットを行う" : "次の種目を行う";
      $("#guideAddExtraSetButton").classList.toggle("hidden", hasNextSet);
      $("#guideEndMenuAfterSetButton").textContent = hasNextSet ? "別の種目を行う" : "メニューを終了";
      $("#guideChooseNextExerciseButton").style.order = "1";
      $("#guideAddExtraSetButton").style.order = "2";
      $("#guideEndMenuAfterSetButton").style.order = hasNextSet ? "2" : "3";
      $("#guideChooseNextExerciseButton").classList.add("finish-button");
      $("#guideChooseNextExerciseButton").classList.remove("outline-button");
      $("#guideAddExtraSetButton").classList.add("finish-button");
      $("#guideAddExtraSetButton").classList.remove("outline-button");
      $("#guideEndMenuAfterSetButton").classList.add("outline-button");
      renderGuideRestTimer();
      renderGuideMenuList();
      return;
    }
    if (showCardio) {
      populateGuideCardioInputs(item);
      renderGuideRestTimer();
      renderGuideMenuList();
      return;
    }
    if (!showSet) {
      $("#guideSelectNextTitle").textContent = state.selectNextMode === "start" ? "どの種目から始めますか？" : "別の種目を選んでください";
      $("#guideAddExerciseButton").textContent = "メニュー外の種目を行う";
      renderGuideNextChoiceList(state);
      renderGuideRestTimer();
      renderGuideMenuList();
      return;
    }
    var exercise = guideItemExercise(item);
    var planned = guideItemPlannedSets(item);
    var completed = guideItemCompletedSets(item);
    var meta = guideSetMeta(item);
    var setIndex = meta.setIndex;
    $("#guideExerciseProgress").textContent = (currentIndex + 1) + " / " + items.length + "種目";
    $("#guideItemPosition").textContent = (currentIndex + 1) + " / " + items.length + "種目";
    $("#guideCurrentExerciseName").textContent = guideItemName(item);
    $("#guideExerciseName").textContent = guideItemName(item);
    $("#guidePreviousSummary").textContent = historicalExerciseSummary(exercise);
    $("#guideCurrentSetNumber").textContent = String(setIndex + 1);
    $("#guideTotalSetCount").textContent = String(Math.max(planned.length, setIndex + 1));
    $("#guideSetProgress").textContent = (setIndex + 1) + " / " + Math.max(planned.length, setIndex + 1) + "セット";
    restoreGuideInputForCurrentItem();
    if (!guideSetSaveLocked) {
      var label = (setIndex + 1) + "セット目を完了";
      setGuideCompleteButtonLocked(false, label);
      $("#completeGuideSetButton").setAttribute("aria-label", label);
    }
    renderGuideRestTimer();
    renderGuideMenuList();
  }

  function renderGuideStartSummary() {
    if (!draft) return;
    var entries = draftGuideMenuEntries();
    $("#guideStartSummary").innerHTML = entries.length ? entries.map(function (entry) {
      var exercise = getExercise(entry.exerciseId);
      var name = exercise ? exercise.name : (entry.cardio ? entry.cardio.type : entry.cardioType || "種目");
      var summary = "";
      if (entry.type === "record") summary = "予定：" + buildGuidePlannedSets(entry.record).length + "セット";
      else if (entry.type === "cardio") summary = "予定：" + cardioMetricSummary(entry.cardio, "距離・時間は記録時に入力");
      else summary = "予定：有酸素";
      return '<div class="guide-start-item" data-sort-item="' + escapeHtml(entry.key) + '"><button class="drag-handle" type="button" data-sort-handle aria-label="' + escapeHtml(name) + 'を並べ替え">☰</button><button class="guide-start-item-main" type="button" data-guide-start-exercise="' + escapeHtml(entry.exerciseId || "") + '"><strong>' + escapeHtml(name) + '</strong><small>' + escapeHtml(summary) + '</small></button></div>';
    }).join("") : '<div class="empty-state">種目がありません</div>';
    enableSortableList($("#guideStartSummary"), {
      onChange: function (order) {
        applyDraftGuideMenuOrder(order);
        renderGuideStartSummary();
        renderSavedSets();
        renderSavedCardios();
      }
    });
    var select = $("#guideStartExerciseSelect");
    select.innerHTML = entries.map(function (entry) {
      var exercise = getExercise(entry.exerciseId);
      var name = exercise ? exercise.name : (entry.cardio ? entry.cardio.type : entry.cardioType || "種目");
      return '<option value="' + escapeHtml(entry.exerciseId || "") + '">' + escapeHtml(name) + '</option>';
    }).join("");
  }

  function addExerciseToDraftMenu(exerciseId) {
    if (!draft) return false;
    var exercise = getExercise(exerciseId);
    if (!exercise) return false;
    updateRecentExercise(exerciseId);
    if (exercise.category === "CARDIO") {
      draft.pendingCardioTypes = draft.pendingCardioTypes || [];
      var alreadyRecorded = draft.cardios.some(function (cardio) { return cardio.type === exercise.name; });
      var alreadyPending = draft.pendingCardioTypes.indexOf(exercise.name) >= 0;
      if (!alreadyRecorded && !alreadyPending) draft.pendingCardioTypes.push(exercise.name);
    } else {
      ensureDraftRecord(exercise.id);
    }
    applyDraftGuideMenuOrder(draftGuideMenuEntries().map(function (entry) { return entry.key; }));
    renderSavedSets();
    renderSavedCardios();
    renderGuideStartSummary();
    saveDraftNow();
    return true;
  }

  function openGuideStartExercisePicker() {
    if (!draft) return;
    exercisePickerMode = "guideStartAdd";
    pendingExerciseId = null;
    activeExerciseBodyPart = "chest";
    $("#exerciseModalTitle").textContent = "別の種目を追加";
    $("#confirmExerciseSelection").textContent = "完了";
    $("#confirmExerciseSelection").classList.add("hidden");
    $("#confirmExerciseSelection").disabled = true;
    $("#exerciseSearch").value = "";
    renderExerciseBodyPartTabs();
    renderExerciseList();
    openModal("exerciseModal");
  }

  function addExerciseFromGuideStartPicker(exerciseId) {
    var added = addExerciseToDraftMenu(exerciseId);
    pendingExerciseId = null;
    exercisePickerMode = "workout";
    closeModal("exerciseModal");
    if (added) {
      showToast("種目を追加しました");
      startGuideModeWithExercise(exerciseId);
    }
  }

  function openGuideHelp() {
    if (!isGuideModeEnabled()) {
      showToast("ガイドモードは設定でOFFです");
      updateTodayMenuSummary();
      return;
    }
    if (!uiSettings.guideHelpSeen) {
      uiSettings.guideHelpSeen = true;
      saveUiSettings(uiSettings);
      updateTodayMenuSummary();
    }
    openModal("guideModeHelpModal");
  }

  function openGuideStart() {
    if (!draft) return;
    if (!shouldShowGuideModeActions() && !isGuideActive()) {
      showToast("ガイドモードはこのメニューでは使えません");
      updateTodayMenuSummary();
      return;
    }
    if (isGuideActive()) {
      renderGuideWorkout();
      showScreen("guideWorkout");
      return;
    }
    var hasGuideItems = draft.records.some(function (record) { return getExercise(record.exerciseId); }) || draft.cardios.length || (draft.pendingCardioTypes || []).length;
    if (!hasGuideItems) {
      showToast("ガイドモードで始める種目がありません");
      return;
    }
    renderGuideStartSummary();
    $$('input[name="guideStartMode"]').forEach(function (input) { input.checked = input.value === "first"; });
    $("#guideStartExerciseSelect").classList.add("hidden");
    openModal("guideStartModal");
  }

  function startGuideModeFromModal() {
    if (!draft) return;
    var mode = ($('input[name="guideStartMode"]:checked') || {}).value || "first";
    var startExerciseId = mode === "choose" ? $("#guideStartExerciseSelect").value : null;
    startGuideModeWithExercise(startExerciseId);
  }

  function startGuideModeWithExercise(startExerciseId) {
    if (!draft) return;
    if (!isGuideModeEnabled()) {
      closeModal("guideStartModal");
      closeModal("guideModeHelpModal");
      showToast("ガイドモードは設定でOFFです");
      updateTodayMenuSummary();
      return;
    }
    unlockWorkoutAudio();
    var state = buildGuideStateFromDraft(startExerciseId);
    if (!state) { showToast("ガイドモードで開始できる種目がありません"); return; }
    draft.guideState = state;
    guideSetSaveLocked = false;
    completedGuideSetTokens = {};
    resetWorkoutEditorState();
    resetCardioForm();
    closeModal("guideStartModal");
    closeModal("guideModeHelpModal");
    showScreen("guideWorkout");
    renderGuideWorkout();
    saveDraftNow();
  }

  function activateGuideItem(itemId, options) {
    options = options || {};
    var state = guideState();
    if (!state) return;
    var item = guideItems(state).find(function (entry) { return entry.id === itemId; });
    if (!item || item.status === "skipped") return;
    if (options.keepRestTimer !== true) stopRestTimer();
    clearGuideExtraSetMode(state);
    guideSetSaveLocked = false;
    captureGuideInputToState();
    state.lastAction = null;
    guideItems(state).forEach(function (entry) { if (entry.status === "active") entry.status = "pending"; });
    item.status = "active";
    state.currentItemId = item.id;
    state.currentSetIndex = item.type === "cardio" ? 0 : guideItemCompletedSets(item).length;
    state.status = item.type === "cardio" ? "cardio" : "set";
    state.currentInput = null;
    state.updatedAt = nowIso();
    if (item.type === "cardio") populateGuideCardioInputs(item);
    else restoreGuideInputForCurrentItem();
    renderGuideWorkout();
    closeModal("guideMenuModal");
    saveDraftNow();
    scheduleGuideCurrentSetScroll();
  }

  function findNextGuideItem(preferDeferred) {
    var state = guideState();
    if (!state) return null;
    var items = guideItems(state);
    return items.find(function (item) { return preferDeferred ? item.status === "deferred" : item.status === "pending"; }) || items.find(function (item) { return item.status === "deferred"; }) || null;
  }

  function moveGuideToSelectNext(mode) {
    var state = guideState();
    if (!state) return;
    state.status = "selectNext";
    state.currentItemId = null;
    state.currentInput = null;
    state.detailItemId = null;
    state.selectNextMode = mode || state.selectNextMode || "alternate";
    state.selectedNextItemId = state.selectedNextItemId && guideItems(state).some(function (item) { return item.id === state.selectedNextItemId && item.status !== "skipped"; }) ? state.selectedNextItemId : null;
    state.updatedAt = nowIso();
    renderGuideWorkout();
    saveDraftNow();
  }

  function guideItemNeedsLeaveConfirm(item) {
    if (!item || item.type !== "strength") return false;
    if (item.status === "completed" || item.status === "skipped") return false;
    var completed = guideItemCompletedSets(item).length;
    var planned = guideItemPlannedSets(item).length;
    return completed >= 1 && completed < planned;
  }

  function setGuideLeaveItemMessage(item) {
    var completed = guideItemCompletedSets(item).length;
    var planned = guideItemPlannedSets(item).length;
    $("#guideLeaveItemMessage").textContent =
      guideItemName(item) + " は " + completed + " / " + planned + "セット完了しています。残りはどうしますか？";
  }

  function proceedGuideToNextExercise() {
    stopRestTimer();
    clearGuideExtraSetMode();
    moveGuideToSelectNext("alternate");
  }

  function showGuideNextExercisePicker() {
    var item = guideCurrentItem();
    if (guideItemNeedsLeaveConfirm(item)) {
      captureGuideInputToState();
      setGuideLeaveItemMessage(item);
      openModal("guideLeaveItemModal");
      return;
    }
    proceedGuideToNextExercise();
  }

  function confirmGuideLeaveAsFinished() {
    var item = guideCurrentItem();
    var state = guideState();
    if (item && state) markGuideItemCompleted(item, state);
    closeModal("guideLeaveItemModal");
    proceedGuideToNextExercise();
  }

  function confirmGuideLeaveAsDeferred() {
    var item = guideCurrentItem();
    var state = guideState();
    if (item) {
      item.status = "deferred";
      item.isAddingExtraSets = false;
      if (state && Array.isArray(state.menuItems)) {
        var index = state.menuItems.indexOf(item);
        if (index >= 0) {
          state.menuItems.splice(index, 1);
          state.menuItems.push(item);
        }
      }
    }
    closeModal("guideLeaveItemModal");
    proceedGuideToNextExercise();
  }

  function finishGuideRestAndContinue() {
    var state = guideState();
    var item = guideCurrentItem();
    if (state && item && state.status === "itemComplete" && item.status !== "completed" && item.status !== "skipped") {
      activateGuideItem(item.id, { keepRestTimer: true });
    }
  }

  function guideCompleteHasNextSet() {
    var state = guideState();
    var item = guideCurrentItem();
    if (!state || !item || state.status !== "itemComplete" || item.status === "completed" || item.status === "skipped") return false;
    return guideItemCompletedSets(item).length < guideItemPlannedSets(item).length;
  }

  function clearGuideExtraSetMode(state) {
    var targetState = state || guideState();
    if (!targetState) return;
    guideItems(targetState).forEach(function (item) {
      if (item && item.type === "strength") item.isAddingExtraSets = false;
    });
  }

  function handleGuideCompletePrimaryAction() {
    if (guideCompleteHasNextSet()) finishGuideRestAndContinue();
    else showGuideNextExercisePicker();
  }

  function handleGuideAddExtraSetAction() {
    var item = guideCurrentItem();
    if (!item || item.type !== "strength") return;
    item.isAddingExtraSets = true;
    addExtraGuideSetToCurrentItem();
  }

  function showGuideCompletedDetail(itemId) {
    var state = guideState();
    var item = state ? guideItems(state).find(function (entry) { return entry.id === itemId; }) : null;
    if (!state || !item || item.status !== "completed") return;
    state.status = "completedDetail";
    state.detailItemId = item.id;
    state.currentItemId = null;
    state.currentInput = null;
    state.updatedAt = nowIso();
    renderGuideWorkout();
    saveDraftNow();
    scheduleGuideCurrentSetScroll();
  }

  function returnGuideToNextChoice() {
    var state = guideState();
    if (!state) return;
    state.status = "selectNext";
    state.detailItemId = null;
    state.currentItemId = null;
    state.currentInput = null;
    state.updatedAt = nowIso();
    renderGuideWorkout();
    saveDraftNow();
    scheduleGuideCurrentSetScroll();
  }

  function addSetFromGuideCompletedDetail() {
    var state = guideState();
    var item = state ? guideItems(state).find(function (entry) { return entry.id === state.detailItemId; }) : null;
    if (!state || !item || item.type !== "strength") return;
    guideSetSaveLocked = false;
    item.isAddingExtraSets = true;
    item.status = "active";
    state.status = "set";
    state.currentItemId = item.id;
    state.detailItemId = null;
    state.currentSetIndex = guideItemCompletedSets(item).length;
    state.currentInput = null;
    state.updatedAt = nowIso();
    renderGuideWorkout();
    animateGuideSetStage();
    saveDraftNow();
    scheduleGuideCurrentSetScroll();
  }

  function handleGuideCompleteSecondaryAction() {
    if (guideCompleteHasNextSet()) showGuideNextExercisePicker();
    else {
      clearGuideExtraSetMode();
      openGuideExit();
    }
  }

  function rememberGuideSkipAction(item) {
    var state = guideState();
    if (!state || !item) return;
    state.lastAction = {
      type: "skipItem",
      itemId: item.id,
      previousStatus: item.status || "pending",
      previousGuideStatus: state.status || "set",
      previousCurrentItemId: state.currentItemId || item.id,
      previousCurrentSetIndex: Number(state.currentSetIndex || 0),
      previousCurrentInput: state.currentInput ? cloneData(state.currentInput) : null
    };
  }

  function undoLastGuideAction() {
    var state = guideState();
    if (!canUndoGuideLastAction(state)) {
      showToast("戻せる操作がありません");
      renderGuideUndoActions(state);
      return;
    }
    var action = state.lastAction;
    var item = guideItems(state).find(function (entry) { return entry.id === action.itemId; });
    if (!item) {
      state.lastAction = null;
      renderGuideUndoActions(state);
      showToast("戻す対象が見つかりません");
      return;
    }
    item.status = action.previousStatus || "pending";
    state.status = action.previousGuideStatus || "set";
    state.currentItemId = action.previousCurrentItemId || item.id;
    state.currentSetIndex = Number(action.previousCurrentSetIndex || 0);
    state.currentInput = action.previousCurrentInput ? cloneData(action.previousCurrentInput) : null;
    state.lastAction = null;
    state.updatedAt = nowIso();
    closeModal("guideMenuModal");
    if (exercisePickerMode === "guideAdd" || exercisePickerMode === "guideReplace") {
      exercisePickerMode = "workout";
      pendingExerciseId = null;
      closeModal("exerciseModal");
    }
    renderGuideWorkout();
    saveDraftNow();
    showToast("直前の操作を戻しました");
    scheduleGuideCurrentSetScroll();
  }

  function addExtraGuideSetToCurrentItem() {
    var state = guideState();
    var item = guideCurrentItem();
    if (!state || !item) return;
    guideSetSaveLocked = false;
    item.isAddingExtraSets = true;
    item.status = "active";
    state.status = "set";
    state.currentItemId = item.id;
    state.currentSetIndex = guideItemCompletedSets(item).length;
    state.currentInput = null;
    state.updatedAt = nowIso();
    renderGuideWorkout();
    animateGuideSetStage();
    saveDraftNow();
    scheduleGuideCurrentSetScroll();
  }

  function finishCurrentGuideItemAndSelectNext() {
    var item = guideCurrentItem();
    var state = guideState();
    if (item && state) markGuideItemCompleted(item, state);
    guideSetSaveLocked = false;
    moveGuideToSelectNext();
  }

  function completeGuideSet(skipWarning) {
    if (guideSetSaveLocked) return;
    var item = guideCurrentItem();
    var exercise = guideItemExercise(item);
    if (!item || !exercise) return;
    var state = guideState();
    var meta = guideSetMeta(item);
    var plannedSet = currentGuidePlannedSet(item);
    var submittedSetToken = guideSubmittedSetToken(item, plannedSet, meta.setIndex);
    if (completedGuideSetTokens[submittedSetToken]) return;
    var rawValues = guideInputValues();
    var issue = setValueIssue(Number(rawValues.weight || 0) / 1000, Number(rawValues.reps), Number(rawValues.restSeconds));
    if (issue.invalid) { showToast(issue.invalid); return; }
    if (issue.warning && skipWarning !== true) {
      askConfirm(issue.warning, "このまま保存", function () { completeGuideSet(true); }, "入力に戻る");
      return;
    }
    guideSetSaveLocked = true;
    setGuideCompleteButtonLocked(true, "保存中…");
    var completed = guideItemCompletedSets(item);
    var newSet = {
      tempId: makeId("guidecompletedset"),
      setNumber: completed.length + 1,
      weight: rawValues.weight,
      reps: rawValues.reps,
      rir: rawValues.rir,
      restSeconds: rawValues.restSeconds,
      memo: rawValues.memo
    };
    try {
      var best = evaluatePersonalBest(exercise, newSet, null);
      handleGuideStrengthSetCompleted(item, state, newSet, plannedSet, meta.setIndex, best);
    } catch (error) {
      delete completedGuideSetTokens[submittedSetToken];
      guideSetSaveLocked = false;
      console.error("Guide set save failed", error);
      showToast("セットの保存に失敗しました");
      renderGuideWorkout();
    }
  }

  function completeGuideCardio(skipWarning) {
    var item = guideCurrentItem();
    var state = guideState();
    if (!draft || !state || !item || item.type !== "cardio") return;
    var cardio = guideCardioFormValue();
    var issue = cardioValueIssue(cardio);
    if (issue.invalid) { showToast(issue.invalid); return; }
    if (cardio.durationMinutes < 1) { showToast("運動時間を入力してください"); $("#guideCardioDuration").focus(); return; }
    if (issue.warning && skipWarning !== true) {
      askConfirm(issue.warning, "このまま保存", function () { completeGuideCardio(true); }, "入力に戻る");
      return;
    }
    var result = calculateCardio(cardio);
    var completedCardio = {
      tempId: (item.plannedCardio && item.plannedCardio.tempId) || (item.completedCardio && item.completedCardio.tempId) || makeId("draftcardio"),
      type: item.cardioType,
      durationMinutes: cardio.durationMinutes,
      distanceKm: cardio.distanceKm,
      inclinePercent: cardio.inclinePercent,
      memo: cardio.memo,
      speedKmh: result.speedKmh,
      calories: result.calories
    };
    var existingIndex = draft.cardios.findIndex(function (entry) { return entry.tempId === completedCardio.tempId; });
    if (existingIndex >= 0) draft.cardios[existingIndex] = completedCardio;
    else draft.cardios.push(completedCardio);
    draft.pendingCardioTypes = (draft.pendingCardioTypes || []).filter(function (type) { return type !== item.cardioType; });
    item.completedCardio = completedCardio;
    item.currentCardioInput = null;
    markGuideItemCompleted(item, state);
    state.lastAction = null;
    state.selectedNextItemId = null;
    state.updatedAt = nowIso();
    renderSavedCardios();
    updateDraftCalories();
    moveGuideToSelectNext();
    showToast(item.cardioType + "を記録しました");
  }

  function deferCurrentGuideItem() {
    var item = guideCurrentItem();
    if (!item) return;
    var state = guideState();
    captureGuideInputToState();
    if (state) state.lastAction = null;
    if (guideItemNeedsLeaveConfirm(item)) {
      setGuideLeaveItemMessage(item);
      openModal("guideLeaveItemModal");
      return;
    }
    item.status = "deferred";
    item.isAddingExtraSets = false;
    moveGuideToSelectNext();
  }

  function skipCurrentGuideItem() {
    var item = guideCurrentItem();
    if (!item) return;
    captureGuideInputToState();
    rememberGuideSkipAction(item);
    if (guideItemCompletedSets(item).length) markGuideItemCompleted(item, guideState());
    else item.status = "skipped";
    moveGuideToSelectNext();
  }

  function startNextGuideItem(preferDeferred) {
    var next = findNextGuideItem(preferDeferred);
    if (!next) {
      openGuideExit();
      return;
    }
    activateGuideItem(next.id);
  }

  function startSelectedGuideItem() {
    var state = guideState();
    if (!state) return;
    var item = guideItems(state).find(function (entry) { return entry.id === state.selectedNextItemId && entry.status !== "skipped"; });
    if (!item) {
      showToast("種目を選んでください");
      renderGuideNextChoiceList(state);
      return;
    }
    activateGuideItem(item.id);
  }

  function handleGuideStrengthSetCompleted(item, state, newSet, plannedSet, setIndex, best) {
    var completed = guideItemCompletedSets(item);
    completed.push(newSet);
    state.lastAction = null;
    completedGuideSetTokens[guideSubmittedSetToken(item, plannedSet, setIndex)] = true;
    var planned = guideItemPlannedSets(item);
    if (planned[completed.length - 1]) planned[completed.length - 1].status = "completed";
    var isFinalSet = completed.length >= planned.length;
    state.currentSetIndex = completed.length;
    state.currentInput = null;
    state.status = "itemComplete";
    state.currentItemId = item.id;
    state.selectedNextItemId = null;
    state.updatedAt = nowIso();
    showPersonalBestBanner(best, newSet.tempId + ":" + (best ? best.metric + ":" + best.value : ""));
    showGuideSetSavedNotice(newSet, completed.length + 1, isFinalSet);
    debugGuideTimer("set completed", {
      exercise: guideItemName(item),
      setNumber: completed.length,
      isFinalSet: isFinalSet,
      restSeconds: newSet.restSeconds,
      restTimerEnabled: isRestTimerEnabled(),
      autoStartRestTimer: uiSettings.autoStartRestTimer,
      guideActive: isGuideActive(),
      statusBefore: restTimerState.status
    });
    startRestTimer(newSet.restSeconds);
    if (isFinalSet) {
      markGuideItemCompleted(item, state);
      renderGuideWorkout();
      saveDraftNow();
      scheduleGuideCurrentSetScroll();
      releaseGuideSetSaveLockLater();
      return;
    }
    renderGuideWorkout();
    animateGuideSetStage();
    saveDraftNow();
    scheduleGuideCurrentSetScroll();
    releaseGuideSetSaveLockLater();
  }

  function renderGuideMenuList() {
    var state = guideState();
    var list = $("#guideMenuList");
    if (!state || !list) return;
    renderGuideUndoActions(state);
    list.innerHTML = guideItems(state).map(function (item) {
      var completed = guideItemCompletedSets(item).length;
      var total = guideItemPlannedSets(item).length;
      var action = item.status === "skipped" ? "" : '<button type="button" data-guide-start-item="' + item.id + '">' + (item.status === "completed" ? "セット追加" : "開始") + '</button>';
      var smallText = guideChoiceProgressText(item);
      var statusLabel = item.status === "pending" ? "" : '<span class="guide-menu-status">' + guideStatusLabel(item.status) + '</span>';
      return '<div class="guide-menu-row is-' + escapeHtml(item.status || "pending") + '" data-sort-item="' + item.id + '"><button class="drag-handle" type="button" data-sort-handle aria-label="' + escapeHtml(guideItemName(item)) + 'を並べ替え">☰</button><div><strong>' + escapeHtml(guideItemName(item)) + '</strong><small>' + escapeHtml(smallText) + '</small>' + statusLabel + '</div>' + action + '</div>';
    }).join("");
    enableSortableList(list, {
      onChange: function (order) {
        state.menuItems.sort(function (a, b) {
          var indexA = order.indexOf(a.id);
          var indexB = order.indexOf(b.id);
          if (indexA < 0) indexA = state.menuItems.indexOf(a);
          if (indexB < 0) indexB = state.menuItems.indexOf(b);
          return indexA - indexB;
        });
        state.updatedAt = nowIso();
        saveDraftNow();
        renderGuideMenuList();
      }
    });
  }

  function openGuideMenu() {
    renderGuideMenuList();
    openModal("guideMenuModal");
  }

  function openGuideExit() {
    var state = guideState();
    if (!state) return;
    stopRestTimer();
    captureGuideInputToState();
    clearGuideExtraSetMode(state);
    var lines = guideItems(state).map(function (item) {
      var detail = item.type === "cardio" ? (item.completedCardio ? "完了" : "有酸素") : guideItemCompletedSets(item).length + "セット";
      return guideStatusLabel(item.status) + "：" + guideItemName(item) + "　" + detail;
    });
    $("#guideExitSummary").innerHTML = lines.length ? lines.map(function (line) { return "<span>" + escapeHtml(line) + "</span>"; }).join("") : "<span>完了したセットはありません</span>";
    openModal("guideExitModal");
  }

  function guideCompletedRecords() {
    var state = guideState();
    if (!state) return [];
    return guideItems(state).filter(function (item) {
      return item.type === "strength" && guideItemCompletedSets(item).length;
    }).map(function (item, index) {
      return {
        tempId: makeId("draftrecord"),
        exerciseId: item.exerciseId,
        orderIndex: index,
        sets: guideItemCompletedSets(item).map(function (set, setIndex) {
          return {
            tempId: set.tempId || makeId("draftset"),
            setNumber: setIndex + 1,
            weight: Number(set.weight || 0),
            reps: Number(set.reps || 0),
            rir: set.rir || "",
            restSeconds: Number(set.restSeconds || 90),
            memo: set.memo || ""
          };
        })
      };
    });
  }

  function prepareGuideDraftForSave() {
    if (!isGuideActive()) return true;
    captureGuideInputToState();
    clearGuideExtraSetMode(draft.guideState);
    var records = guideCompletedRecords();
    if (!records.length && !(draft.cardios || []).length) {
      showToast("完了したセットがありません");
      return false;
    }
    draft.records = records;
    draft.guideState = null;
    resetWorkoutEditorState();
    return true;
  }

  function convertGuideDraftToNormalInput(captureCurrentInput) {
    if (!isGuideActive()) return false;
    if (captureCurrentInput !== false) captureGuideInputToState();
    clearGuideExtraSetMode(draft.guideState);
    guideItems(draft.guideState).forEach(function (item) {
      if (item.type !== "strength") return;
      var completed = guideItemCompletedSets(item);
      if (!completed.length) return;
      var record = ensureDraftRecord(item.exerciseId);
      record.sets = completed.map(function (set, setIndex) {
        return {
          tempId: set.tempId || makeId("draftset"),
          setNumber: setIndex + 1,
          weight: Number(set.weight || 0),
          reps: Number(set.reps || 0),
          rir: set.rir || "",
          restSeconds: Number(set.restSeconds || 90),
          memo: set.memo || ""
        };
      });
    });
    draft.guideState = null;
    resetWorkoutEditorState();
    stopRestTimer();
    return true;
  }

  function saveGuideProgress() {
    if (!prepareGuideDraftForSave()) return;
    closeModal("guideExitModal");
    requestWorkoutSave({ warningConfirmed: false });
  }

  function saveGuideAndDisableMode() {
    if (isGuideActive() && !prepareGuideDraftForSave()) return;
    closeModal("guideModeOffModal");
    closeModal("guideExitModal");
    applyGuideModeEnabled(false);
    if (draft) requestWorkoutSave({ warningConfirmed: false });
    else {
      renderHome();
      showScreen("home");
    }
  }

  function discardGuideAndDisableMode() {
    stopRestTimer();
    closeModal("guideModeOffModal");
    closeModal("guideExitModal");
    clearSavedDraft();
    draft = null;
    resetWorkoutEditorState();
    resetCardioForm();
    applyGuideModeEnabled(false);
    renderHome();
    showScreen("home");
    showToast("ガイド下書きを破棄しました");
  }

  function cancelGuideModeDisable() {
    closeModal("guideModeOffModal");
    renderAppearanceSettings();
  }

  function suspendGuideToHome() {
    if (isGuideActive()) captureGuideInputToState();
    saveDraftNow();
    stopRestTimer();
    closeModal("guideExitModal");
    draft = null;
    renderHome();
    showScreen("home");
    showToast("ガイドモードを一時保存しました");
  }

  function returnGuideToWorkoutMenu() {
    if (!isGuideActive()) {
      closeModal("guideExitModal");
      return;
    }
    if (!convertGuideDraftToNormalInput(true)) return;
    stopRestTimer();
    closeModal("guideExitModal");
    renderWorkout();
    showScreen("workout");
    showToast("今日のメニューに戻りました");
  }

  function cancelGuideExitDialog() {
    closeModal("guideExitModal");
    renderGuideWorkout();
  }

  function openGuideExercisePicker(mode) {
    if (!isGuideActive()) return;
    if (!isGuideModeEnabled()) {
      showToast("ガイドモードは設定でOFFです");
      return;
    }
    stopRestTimer();
    exercisePickerMode = mode;
    pendingExerciseId = null;
    activeExerciseBodyPart = "chest";
    $("#exerciseModalTitle").textContent = mode === "guideAdd" ? "メニュー外の種目を行う" : "別の種目に変更";
    $("#confirmExerciseSelection").textContent = "完了";
    $("#confirmExerciseSelection").classList.toggle("hidden", mode === "guideAdd");
    $("#confirmExerciseSelection").disabled = true;
    $("#exerciseSearch").value = "";
    renderExerciseBodyPartTabs();
    renderExerciseList();
    renderGuideUndoActions(guideState());
    openModal("exerciseModal");
  }

  function addExerciseToGuide(exerciseId, activate) {
    var state = guideState();
    var item = createGuideItemFromExercise(exerciseId, [guideDefaultSetForExercise(exerciseId, 0)]);
    if (!state || !item) return;
    if (item.type === "strength") item.isMenuExternal = true;
    state.menuItems.push(item);
    if (activate) activateGuideItem(item.id);
    else {
      renderGuideWorkout();
      saveDraftNow();
    }
  }

  function replaceGuideExercise(exerciseId) {
    var state = guideState();
    var current = guideCurrentItem();
    if (!state || !current) return;
    var completed = guideItemCompletedSets(current);
    if (completed.length) {
      markGuideItemCompleted(current, state);
      addExerciseToGuide(exerciseId, true);
      return;
    }
    var replacement = createGuideItemFromExercise(exerciseId);
    if (!replacement) return;
    current.type = replacement.type;
    current.exerciseId = replacement.exerciseId;
    current.name = replacement.name;
    current.category = replacement.category;
    current.cardioType = replacement.cardioType || null;
    current.status = "active";
    current.currentSetIndex = 0;
    current.plannedSets = replacement.plannedSets;
    current.plannedCardio = replacement.plannedCardio || null;
    current.completedCardio = null;
    current.completedSets = [];
    state.currentInput = null;
    state.status = current.type === "cardio" ? "cardio" : "set";
    renderGuideWorkout();
    saveDraftNow();
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

  function renumberDraftRecords() {
    if (!draft) return;
    draft.records.forEach(function (record, index) { record.orderIndex = index; });
  }

  function moveDraftRecord(index, direction) {
    if (!draft) return;
    var fromIndex = Number(index);
    var toIndex = fromIndex + Number(direction);
    moveArrayItem(draft.records, fromIndex, toIndex);
    renumberDraftRecords();
    renderSavedSets();
    saveDraftNow();
  }

  function moveDraftCardio(index, direction) {
    if (!draft) return;
    moveArrayItem(draft.cardios, Number(index), Number(index) + Number(direction));
    renderSavedCardios();
    saveDraftNow();
  }

  function movePendingCardio(index, direction) {
    if (!draft) return;
    draft.pendingCardioTypes = draft.pendingCardioTypes || [];
    moveArrayItem(draft.pendingCardioTypes, Number(index), Number(index) + Number(direction));
    renderSavedCardios();
    saveDraftNow();
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

  function getLastHistoricalCardio(type) {
    var normalizedType = type === "傾斜ウォーク" ? "ウォーキング" : type;
    return data.cardios.slice().filter(function (cardio) {
      return (cardio.type === "傾斜ウォーク" ? "ウォーキング" : cardio.type) === normalizedType;
    }).sort(function (a, b) {
      var sessionA = getSession(a.sessionId) || {};
      var sessionB = getSession(b.sessionId) || {};
      var dateOrder = String(sessionB.date || "").localeCompare(String(sessionA.date || ""));
      if (dateOrder) return dateOrder;
      return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""));
    })[0] || null;
  }

  function historicalCardioSummary(type) {
    var cardio = getLastHistoricalCardio(type);
    if (!cardio) return "前回の記録はありません";
    var summary = cardioMetricSummary(cardio, "");
    return summary ? "前回：" + summary : "前回の記録はありません";
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
    $("#selectedExerciseMeta").textContent = CATEGORY_LABELS[exercise.category] + (exercise.category === "BODYWEIGHT" ? "・重量入力なし" : "");
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
    $("#saveSetButton").textContent = editingRef ? "変更を保存" : nextNumber + "セット目を保存";
    $("#cancelSetEditButton").classList.toggle("hidden", !editingRef);
    $("#setSaveHint").textContent = editingRef ? "保存後、種目詳細に戻ります" : "保存後、次のセットを確認します";
    $("#weightBlock").classList.toggle("hidden", exercise.category === "BODYWEIGHT");
    $("#weightStepLabel").textContent = "10kg / 1kg / 0.5kg";
    $("#weightInput").step = 0.5;
    $("#weightInput").value = exercise.category === "BODYWEIGHT" ? 0 : (inputSet ? (Number(inputSet.weight) / 1000).toFixed(1) : "0.0");
    $("#repsInput").value = inputSet ? inputSet.reps : 10;
    selectedRest = inputSet ? Number(inputSet.restSeconds || 90) : 90;
    selectedRir = editingRef ? String(editingRef.set.rir == null ? "" : editingRef.set.rir) : (inputSet && inputSet.rir !== undefined && inputSet.rir !== null && inputSet.rir !== "" ? String(inputSet.rir) : null);
    $("#setMemo").value = editingRef ? (editingRef.set.memo || "") : (inputSet && inputSet.memo ? inputSet.memo : "");
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
    updateRecentExercise(exerciseId);
    resetWorkoutEditorState({ selectedExerciseId: exerciseId, isAddingSet: exercise.category !== "CARDIO" });
    if (exercise.category !== "CARDIO") ensureDraftRecord(exerciseId);
    expandedDraftExerciseId = exercise.category === "CARDIO" ? expandedDraftExerciseId : exerciseId;
    expandedDraftCardioKey = exercise.category === "CARDIO" ? (draft && (draft.pendingCardioTypes || []).indexOf(exercise.name) >= 0 ? "pending:" + exercise.name : expandedDraftCardioKey) : expandedDraftCardioKey;
    if (exercise.category === "CARDIO") {
      var previousCardio = getLastHistoricalCardio(exercise.name);
      $("#cardioType").value = exercise.name;
      $("#cardioDuration").value = previousCardio ? formatNumberForInput(Number(previousCardio.durationMinutes || 0), 1) : "";
      $("#cardioDistance").value = previousCardio ? formatNumberForInput(Number(previousCardio.distanceKm || 0), 0.1) : "";
      $("#cardioIncline").value = previousCardio ? formatNumberForInput(Number(previousCardio.inclinePercent || 0), 0.5) : "";
      $("#cardioMemo").value = previousCardio ? (previousCardio.memo || "") : "";
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

  function addExerciseToMenuAndReturn(exerciseId) {
    var exercise = getExercise(exerciseId);
    if (!exercise || !draft) return;
    addExerciseToDraftMenu(exerciseId);
    resetWorkoutEditorState();
    expandedDraftExerciseId = exercise.category === "CARDIO" ? null : exercise.id;
    expandedDraftCardioKey = exercise.category === "CARDIO" ? "pending:" + exercise.name : null;
    pendingExerciseId = null;
    exercisePickerMode = "workout";
    closeModal("exerciseModal");
    renderSelectedExercise();
    renderSavedSets();
    renderSavedCardios();
    updateDraftCalories();
    saveDraftNow();
    showToast(exercise.name + "を今日のメニューに追加しました");
    setTimeout(function () { $("#savedSetsSection").scrollIntoView({ behavior: "smooth", block: "start" }); }, 50);
  }

  function updateRecentExercise(exerciseId) {
    if (!exerciseId || !getExercise(exerciseId)) return;
    runDataTransaction(function () {
      data.recentExerciseIds = [exerciseId].concat((data.recentExerciseIds || []).filter(function (id) { return id !== exerciseId; })).slice(0, 10);
    });
  }

  function renderExerciseBodyPartTabs() {
    $("#exerciseBodyPartTabs").innerHTML = BODY_PARTS.map(function (part) {
      var active = part.id === activeExerciseBodyPart;
      return '<button class="exercise-body-tab' + (active ? " is-active" : "") + '" type="button" role="tab" aria-selected="' + active + '" data-body-part="' + part.id + '">' + part.label + '</button>';
    }).join("");
  }

  function exerciseCatalogOrderMap() {
    var order = {};
    data.exercises.forEach(function (exercise, index) { order[exercise.id] = index; });
    return order;
  }

  function sortedExerciseChoices(exercises) {
    var catalogOrder = exerciseCatalogOrderMap();
    var recentRank = {};
    (data.recentExerciseIds || []).forEach(function (id, index) { recentRank[id] = index; });
    return exercises.slice().sort(function (a, b) {
      if (!!a.isFavorite !== !!b.isFavorite) return a.isFavorite ? -1 : 1;
      var recentA = Object.prototype.hasOwnProperty.call(recentRank, a.id) ? recentRank[a.id] : Infinity;
      var recentB = Object.prototype.hasOwnProperty.call(recentRank, b.id) ? recentRank[b.id] : Infinity;
      if (recentA !== recentB) return recentA - recentB;
      return (catalogOrder[a.id] || 0) - (catalogOrder[b.id] || 0);
    });
  }

  function exerciseMatchesActivePart(exercise) {
    if (exercise.bodyPart !== activeExerciseBodyPart) return false;
    return activeExerciseBodyPart === "cardio" ? exercise.category === "CARDIO" : exercise.category !== "CARDIO";
  }

  function getExerciseSearchTerm() {
    var input = $("#exerciseSearch");
    return input ? normalizeSearchText(input.value) : "";
  }

  function renderExerciseList() {
    var searchTerm = getExerciseSearchTerm();
    var exercises = data.exercises.filter(function (exercise) {
      if (searchTerm) return normalizeSearchText(exercise.name).indexOf(searchTerm) >= 0;
      return exerciseMatchesActivePart(exercise);
    });
    exercises = sortedExerciseChoices(exercises);
    if (!exercises.length) {
      $("#exerciseList").innerHTML = '<div class="empty-state">' + (searchTerm ? "該当する種目がありません" : "この部位の種目はまだありません") + '</div>';
      return;
    }
    $("#exerciseList").innerHTML = exercises.map(function (exercise) {
      var selected = exercisePickerMode === "routine" ? routinePendingExerciseIds.indexOf(exercise.id) >= 0 : exercise.id === pendingExerciseId;
      var stepControl = '<span class="exercise-step-placeholder" aria-hidden="true"></span>';
      return '<div class="exercise-choice-row' + (selected ? " is-selected" : "") + '"><button class="exercise-choice-main" type="button" data-exercise-id="' + exercise.id + '"><span class="exercise-choice-circle" aria-hidden="true"><i></i></span><span class="exercise-choice-name"><strong>' + escapeHtml(exercise.name) + '</strong><small>' + CATEGORY_LABELS[exercise.category] + '</small></span></button>' + stepControl + '<button class="favorite-button ' + (exercise.isFavorite ? "is-favorite" : "") + '" type="button" data-favorite-id="' + exercise.id + '" aria-label="' + escapeHtml(exercise.name) + 'をお気に入りにする">★</button></div>';
    }).join("");
  }

  function openExercisePicker() {
    exercisePickerMode = "workout";
    var selected = getExercise(selectedExerciseId);
    pendingExerciseId = selectedExerciseId;
    activeExerciseBodyPart = selected && selected.bodyPart ? selected.bodyPart : "chest";
    $("#exerciseModalTitle").textContent = "種目を選択";
    $("#confirmExerciseSelection").textContent = "完了";
    $("#confirmExerciseSelection").classList.remove("hidden");
    $("#confirmExerciseSelection").disabled = !pendingExerciseId;
    $("#exerciseSearch").value = "";
    renderExerciseBodyPartTabs();
    renderExerciseList();
    openModal("exerciseModal");
  }

  function openExercisePickerForMenuAdd() {
    exercisePickerMode = "workoutAdd";
    pendingExerciseId = null;
    activeExerciseBodyPart = "chest";
    $("#exerciseModalTitle").textContent = "種目を追加";
    $("#confirmExerciseSelection").textContent = "今日のメニューに追加";
    $("#confirmExerciseSelection").classList.remove("hidden");
    $("#confirmExerciseSelection").disabled = true;
    $("#exerciseSearch").value = "";
    renderExerciseBodyPartTabs();
    renderExerciseList();
    openModal("exerciseModal");
  }

  function cancelExerciseSelection() {
    pendingExerciseId = null;
    routinePendingExerciseIds = [];
    if (exercisePickerMode === "guideAdd" || exercisePickerMode === "guideReplace" || exercisePickerMode === "guideStartAdd") {
      exercisePickerMode = "workout";
      closeModal("exerciseModal");
      return;
    }
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
    if (exercisePickerMode === "guideStartAdd") {
      if (!pendingExerciseId) return;
      var startExerciseId = pendingExerciseId;
      pendingExerciseId = null;
      addExerciseFromGuideStartPicker(startExerciseId);
      return;
    }
    if (exercisePickerMode === "workoutAdd") {
      if (!pendingExerciseId) return;
      addExerciseToMenuAndReturn(pendingExerciseId);
      return;
    }
    if (exercisePickerMode === "guideAdd" || exercisePickerMode === "guideReplace") {
      if (!pendingExerciseId) return;
      var guideExerciseId = pendingExerciseId;
      var guideMode = exercisePickerMode;
      pendingExerciseId = null;
      exercisePickerMode = "workout";
      closeModal("exerciseModal");
      if (guideMode === "guideAdd") addExerciseToGuide(guideExerciseId, true);
      else replaceGuideExercise(guideExerciseId);
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

  function findNextExistingSetTempId(record, completedSetNumber) {
    if (!record || !record.sets) return null;
    var nextSet = record.sets.find(function (set) { return Number(set.setNumber) === Number(completedSetNumber) + 1; });
    return nextSet ? nextSet.tempId : null;
  }

  function configureNextSetButton(selector, label, hidden) {
    var button = $(selector);
    if (!button) return;
    button.textContent = label;
    button.classList.toggle("hidden", !!hidden);
  }

  function arrangeNextSetActionButtons(wasUpdate) {
    var actions = $("#nextSetActions");
    var addButton = $("#nextSetYesButton");
    var editButton = $("#nextSetPickExerciseButton");
    var backButton = $("#nextSetNoButton");
    if (!actions || !addButton || !editButton || !backButton) return;
    if (wasUpdate) {
      actions.appendChild(editButton);
      actions.appendChild(addButton);
      actions.appendChild(backButton);
      return;
    }
    actions.appendChild(addButton);
    actions.appendChild(editButton);
    actions.appendChild(backButton);
  }

  function showNextSetConfirmation(exerciseId, completedSetNumber, wasUpdate) {
    if (nextSetActionState || !draft) return;
    var exercise = getExercise(exerciseId);
    var record = draft.records.find(function (item) { return item.exerciseId === exerciseId; });
    if (!exercise || !record) return;
    var nextExistingSetTempId = wasUpdate ? findNextExistingSetTempId(record, completedSetNumber) : null;
    nextSetExerciseId = exerciseId;
    nextSetActionState = {
      type: wasUpdate ? "edit" : "new",
      exerciseId: exerciseId,
      completedSetNumber: completedSetNumber,
      nextExistingSetTempId: nextExistingSetTempId
    };
    var actions = $("#nextSetActions");
    if (actions) actions.classList.toggle("is-edit-actions", !!wasUpdate);
    $("#nextSetYesButton").classList.toggle("finish-button", !wasUpdate);
    $("#nextSetYesButton").classList.toggle("outline-button", !!wasUpdate);
    $("#nextSetPickExerciseButton").classList.toggle("finish-button", false);
    $("#nextSetPickExerciseButton").classList.toggle("outline-button", true);
    $("#nextSetNoButton").classList.toggle("finish-button", false);
    $("#nextSetNoButton").classList.toggle("outline-button", true);
    arrangeNextSetActionButtons(wasUpdate);
    $("#nextSetConfirmTitle").textContent = wasUpdate
      ? exercise.name + "の" + completedSetNumber + "セット目を更新しました"
      : exercise.name + " " + completedSetNumber + "セット目を保存しました";
    $("#nextSetConfirmMessage").textContent = "次はどうしますか？";
    if (wasUpdate) {
      configureNextSetButton("#nextSetPickExerciseButton", "次のセットを編集", !nextExistingSetTempId);
      configureNextSetButton("#nextSetYesButton", "この種目に新しいセットを追加", false);
      configureNextSetButton("#nextSetNoButton", "今日のメニューに戻る", false);
    } else {
      configureNextSetButton("#nextSetYesButton", "同じ種目の次セットを入力", false);
      configureNextSetButton("#nextSetPickExerciseButton", "次の種目を選ぶ", false);
      configureNextSetButton("#nextSetNoButton", "今日のメニューに戻る", false);
    }
    openModal("nextSetConfirmModal");
  }

  function animateSetEditorCardEntry() {
    var card = $("#setEditorCard");
    if (!card || card.classList.contains("hidden")) return;
    card.classList.remove("is-entering");
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) return;
    requestAnimationFrame(function () {
      card.classList.add("is-entering");
      setTimeout(function () { card.classList.remove("is-entering"); }, 220);
    });
  }

  function startNextSetInputForExercise(exerciseId) {
    if (!draft || !getExercise(exerciseId)) return;
    resetWorkoutEditorState({ selectedExerciseId: exerciseId, isAddingSet: true });
    renderSelectedExercise();
    $("#setMemo").value = "";
    renderSetChoices();
    renderSavedSets();
    updateDraftCalories();
    saveDraftNow();
    animateSetEditorCardEntry();
    setTimeout(function () { $("#setEditorCard").scrollIntoView({ behavior: "smooth", block: "start" }); }, 50);
  }

  function clearNextSetActionState() {
    nextSetExerciseId = null;
    nextSetActionState = null;
  }

  function startConfirmedNextSet() {
    var state = nextSetActionState;
    var exerciseId = state ? state.exerciseId : nextSetExerciseId;
    clearNextSetActionState();
    closeModal("nextSetConfirmModal");
    startNextSetInputForExercise(exerciseId);
  }

  function chooseNextExerciseAfterSet() {
    var state = nextSetActionState;
    clearNextSetActionState();
    closeModal("nextSetConfirmModal");
    if (!state) return;
    if (state.type === "edit") {
      if (state.nextExistingSetTempId) startEditSet(state.nextExistingSetTempId);
      return;
    }
    resetWorkoutEditorState();
    renderSelectedExercise();
    renderSavedSets();
    updateDraftCalories();
    saveDraftNow();
    setTimeout(openExercisePicker, 50);
  }

  function closeNextSetInput() {
    clearNextSetActionState();
    closeModal("nextSetConfirmModal");
    resetWorkoutEditorState();
    renderSelectedExercise();
    renderSavedSets();
    updateDraftCalories();
    saveDraftNow();
    setTimeout(function () { $("#savedSetsSection").scrollIntoView({ behavior: "smooth", block: "start" }); }, 50);
  }

  function rememberRecentlySavedSet(tempId) {
    if (!tempId) return;
    navigator.vibrate?.(15);
    recentlySavedSetTempId = tempId;
    if (recentlySavedSetTimer) clearTimeout(recentlySavedSetTimer);
    recentlySavedSetTimer = setTimeout(function () {
      recentlySavedSetTempId = null;
      if (draft) renderSavedSets();
    }, 2200);
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
    if (issue.warning && skipWarning !== true) {
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
      var updateBest = evaluatePersonalBest(exercise, setValues, editingSetTempId);
      var updateBestKey = editingSetTempId + ":" + (updateBest ? updateBest.metric + ":" + updateBest.value : "");
      editingRef.set.weight = setValues.weight;
      editingRef.set.reps = setValues.reps;
      editingRef.set.rir = setValues.rir;
      editingRef.set.restSeconds = setValues.restSeconds;
      editingRef.set.memo = setValues.memo;
      var editedExerciseId = editingRef.record.exerciseId;
      var updatedSetNumber = editingRef.set.setNumber;
      rememberRecentlySavedSet(editingSetTempId);
      resetWorkoutEditorState();
      expandedDraftExerciseId = editedExerciseId;
      clearNextSetActionState();
      renderSelectedExercise();
      renderSavedSets();
      updateDraftCalories();
      saveDraftNow();
      showPersonalBestBanner(updateBest, updateBestKey);
      showNextSetConfirmation(exercise.id, updatedSetNumber, true);
      return;
    }
    editingSetTempId = null;
    var record = ensureDraftRecord(exercise.id);
    var newBest = evaluatePersonalBest(exercise, setValues, null);
    var newSet = {
      tempId: makeId("draftset"), setNumber: record.sets.length + 1, weight: setValues.weight, reps: setValues.reps,
      rir: setValues.rir, restSeconds: setValues.restSeconds, memo: setValues.memo
    };
    record.sets.push(newSet);
    rememberRecentlySavedSet(newSet.tempId);
    var savedSetNumber = record.sets.length;
    resetWorkoutEditorState();
    renderSelectedExercise();
    renderSavedSets();
    updateDraftCalories();
    saveDraftNow();
    showPersonalBestBanner(newBest, newSet.tempId + ":" + (newBest ? newBest.metric + ":" + newBest.value : ""));
    showNextSetConfirmation(exercise.id, savedSetNumber, false);
  }

  function startEditSet(tempId) {
    var editingRef = findDraftSet(tempId);
    if (!editingRef) return;
    expandedDraftExerciseId = editingRef.record.exerciseId;
    resetWorkoutEditorState({ selectedExerciseId: editingRef.record.exerciseId, editingSetTempId: tempId });
    renderSelectedExercise();
    var exercise = getExercise(editingRef.record.exerciseId);
    $("#weightInput").value = exercise && exercise.category === "BODYWEIGHT" ? 0 : (Number(editingRef.set.weight) / 1000).toFixed(1);
    $("#repsInput").value = editingRef.set.reps;
    selectedRir = String(editingRef.set.rir == null ? "" : editingRef.set.rir);
    selectedRest = Number(editingRef.set.restSeconds || 90);
    $("#setMemo").value = editingRef.set.memo || "";
    $("#currentSetLabel").textContent = (exercise ? exercise.name + " " : "") + "セット" + editingRef.set.setNumber;
    $("#setEditorSuffix").textContent = "を編集中";
    $("#saveSetButton").textContent = "変更を保存";
    $("#setSaveHint").textContent = "保存後、種目詳細に戻ります";
    $("#cancelSetEditButton").classList.remove("hidden");
    renderSetChoices();
    renderSavedSets();
    saveDraftNow();
    setTimeout(function () { $("#setEditorCard").scrollIntoView({ behavior: "smooth", block: "start" }); }, 50);
  }

  function cancelSetEdit() {
    if (!editingSetTempId) return;
    resetWorkoutEditorState();
    renderSelectedExercise();
    renderSavedSets();
    showToast("編集をキャンセルしました");
  }

  function draftMenuOrderKeys() {
    return draft ? draftGuideMenuEntries().map(function (entry) { return entry.key; }) : [];
  }

  function renderDraftSortControls() {
    var section = $("#savedSetsSection");
    if (section) section.classList.toggle("is-sorting", !!draftSortMode);
    var actionBar = $("#draftSortActionBar");
    var startButton = $("#startDraftSortButton");
    var saveButton = $("#saveDraftSortButton");
    var cancelButton = $("#cancelDraftSortButton");
    if (actionBar) actionBar.classList.toggle("hidden", !draftSortMode);
    if (startButton) startButton.classList.toggle("hidden", !!draftSortMode);
    if (saveButton) saveButton.classList.toggle("hidden", !draftSortMode);
    if (cancelButton) cancelButton.classList.toggle("hidden", !draftSortMode);
  }

  function startDraftSortMode() {
    if (!draft) return;
    draftSortOriginalOrder = draftMenuOrderKeys();
    draftSortMode = true;
    renderDraftSortControls();
    showToast("並べ替えできます");
  }

  function saveDraftSortMode() {
    if (!draft) return;
    draftSortMode = false;
    draftSortOriginalOrder = null;
    renderDraftSortControls();
    saveDraftNow();
    showToast("順番を保存しました");
  }

  function cancelDraftSortMode() {
    if (!draft || !draftSortOriginalOrder) {
      draftSortMode = false;
      renderDraftSortControls();
      return;
    }
    applyDraftGuideMenuOrder(draftSortOriginalOrder);
    draftSortMode = false;
    draftSortOriginalOrder = null;
    renderSavedSets();
    renderSavedCardios();
    saveDraftNow();
    showToast("並べ替えをキャンセルしました");
  }

  function draftRecordStatusSummary(record) {
    var setCount = record && record.sets ? record.sets.length : 0;
    var state = guideState();
    var guideItem = state ? guideItems(state).find(function (item) { return item.exerciseId === record.exerciseId && item.type === "strength"; }) : null;
    if (guideItem) {
      var plannedCount = guideItemPlannedSets(guideItem).length;
      var completedCount = guideItemCompletedSets(guideItem).length;
      if (completedCount > plannedCount && plannedCount > 0) return "予定：" + plannedCount + "セット / 完了：" + completedCount + "セット";
      if (completedCount > 0 && completedCount < plannedCount) return "予定：" + plannedCount + "セット / 完了：" + completedCount + "セット / 次：" + (completedCount + 1) + "セット目";
      if (completedCount > 0) return "完了：" + completedCount + "セット";
      return plannedCount ? "予定：" + plannedCount + "セット" : "";
    }
    if (isGuideEligibleDraft(draft)) return setCount ? "予定：" + setCount + "セット" : "";
    return setCount ? "完了：" + setCount + "セット" : "";
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
    var addExerciseButton = $("#chooseAnotherExercise");
    if (addExerciseButton) addExerciseButton.classList.toggle("hidden", exerciseCount === 0);
    $("#setCountBadge").textContent = labels.length ? labels.join("・") : "0件";
    var guideActions = $("#guideModeActions");
    if (guideActions) {
      var hasGuideMenu = draft.records.length || draft.cardios.length || (draft.pendingCardioTypes || []).length;
      guideActions.classList.toggle("hidden", !hasGuideMenu || !shouldShowGuideModeActions());
    }
    var guideHelp = $("#guideModeHelpButton");
    if (guideHelp) guideHelp.classList.toggle("is-seen", !!uiSettings.guideHelpSeen);
    renderDraftSortControls();
  }

  function renderSavedSets() {
    if (!draft) return;
    renumberDraftRecords();
    $("#savedSetsList").innerHTML = draft.records.map(function (record, recordIndex) {
      var exercise = getExercise(record.exerciseId);
      var previousSummary = historicalExerciseSummary(exercise);
      var exerciseName = escapeHtml(exercise ? exercise.name : "不明な種目");
      var isExpanded = expandedDraftExerciseId === record.exerciseId;
      var setRows = record.sets.map(function (set) {
        var weightText = exercise && exercise.category === "BODYWEIGHT" ? "自重" : (Number(set.weight) / 1000).toFixed(1) + "kg";
        var editingClass = set.tempId === editingSetTempId ? " is-editing" : "";
        var recentClass = set.tempId === recentlySavedSetTempId ? " is-recently-saved" : "";
        return '<div class="saved-item saved-item--editable' + editingClass + recentClass + '" data-edit-set="' + set.tempId + '"><button class="saved-item-main" type="button" aria-label="セット' + set.setNumber + 'を編集"><span class="set-index">' + set.setNumber + '</span><span class="saved-item-text"><strong>' + weightText + ' × ' + set.reps + '回</strong><small>' + RIR_LABELS[set.rir || ""] + '・休憩' + set.restSeconds + '秒' + (set.memo ? '・' + escapeHtml(set.memo) : '') + '</small></span><span class="edit-cue">編集</span></button><button class="delete-mini" type="button" data-delete-set="' + set.tempId + '" aria-label="セットを削除">×</button></div>';
      }).join("");
      var content = isExpanded && record.sets.length ? '<div class="saved-current-label">今回の記録</div>' + setRows : '';
      var actionLabel = record.sets.length ? "＋ セットを追加" : "セットを入力";
      var reorder = '<div class="saved-group-reorder"><button type="button" data-move-record="' + recordIndex + '" data-move-direction="-1" aria-label="' + exerciseName + 'を上へ移動"' + (recordIndex === 0 ? " disabled" : "") + '>↑</button><button type="button" data-move-record="' + recordIndex + '" data-move-direction="1" aria-label="' + exerciseName + 'を下へ移動"' + (recordIndex === draft.records.length - 1 ? " disabled" : "") + '>↓</button></div>';
      var summaryText = draftRecordStatusSummary(record);
      var headAction = isExpanded ? "閉じる" : "詳細";
      var actions = isExpanded ? '<div class="saved-group-actions"><span>' + record.sets.length + 'セット</span>' + reorder + '<button class="saved-group-remove" type="button" data-delete-record="' + record.exerciseId + '" aria-label="' + exerciseName + 'を今日のメニューから外す">削除</button></div>' : "";
      var addButton = isExpanded ? '<button class="saved-set-add-button" type="button" data-add-set-exercise="' + record.exerciseId + '">' + actionLabel + '</button>' : "";
      return '<div class="saved-group saved-group--compact' + (isExpanded ? ' is-expanded' : '') + '" data-sort-item="record:' + record.exerciseId + '"><div class="saved-group-head"><button class="drag-handle" type="button" data-sort-handle aria-label="' + exerciseName + 'を並べ替え">☰</button><button class="saved-group-add" type="button" data-toggle-draft-exercise="' + record.exerciseId + '"><span class="saved-group-title"><strong>' + exerciseName + '</strong>' + (summaryText ? '<small>' + escapeHtml(summaryText) + '</small>' : '') + '</span><em>' + headAction + '</em></button>' + actions + '</div>' + (isExpanded && !record.sets.length ? '<p class="saved-group-note">' + escapeHtml(previousSummary) + '</p>' : '') + content + addButton + '</div>';
    }).join("");
    enableSortableList($("#savedSetsList"), {
      onChange: function (order) {
        if (!draftSortMode) return;
        var ids = order.filter(function (key) { return key.indexOf("record:") === 0; }).map(function (key) { return key.slice(7); });
        draft.records.sort(function (a, b) {
          var indexA = ids.indexOf(a.exerciseId);
          var indexB = ids.indexOf(b.exerciseId);
          if (indexA < 0) indexA = draft.records.indexOf(a);
          if (indexB < 0) indexB = draft.records.indexOf(b);
          return indexA - indexB;
        });
        renumberDraftRecords();
        applyDraftGuideMenuOrder(order.concat(draftGuideMenuEntries().filter(function (entry) { return entry.type !== "record"; }).map(function (entry) { return entry.key; })));
        renderSavedSets();
      }
    });
    updateTodayMenuSummary();
  }

  function deleteDraftRecord(exerciseId) {
    if (!draft || !exerciseId) return;
    if (selectedExerciseId === exerciseId) {
      resetWorkoutEditorState();
    }
    draft.records = draft.records.filter(function (record) { return record.exerciseId !== exerciseId; });
    renderSelectedExercise();
    renderSavedSets();
    updateDraftCalories();
    saveDraftNow();
  }

  function deleteDraftSet(tempId) {
    if (editingSetTempId === tempId) {
      resetWorkoutEditorState();
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
    var preview = $("#cardioPreview");
    if (!preview) return;
    if (!cardio.durationMinutes) {
      preview.innerHTML = '<span>時間 <strong>--</strong></span><span>距離 <strong>--</strong></span><span>速度 <strong>--</strong></span><span>傾斜 <strong>--</strong></span><span>概算消費カロリー <strong>--</strong></span>';
      return;
    }
    var result = calculateCardio(cardio);
    preview.innerHTML = [
      '<span>時間 <strong>' + formatNumberForInput(Number(cardio.durationMinutes || 0), 1) + '分</strong></span>',
      '<span>距離 <strong>' + (Number(cardio.distanceKm || 0) > 0 ? formatNumberForInput(Number(cardio.distanceKm || 0), 0.1) + 'km' : '--') + '</strong></span>',
      '<span>速度 <strong>' + (result.speedKmh ? result.speedKmh.toFixed(1) + " km/h" : "距離未入力") + '</strong></span>',
      '<span>傾斜 <strong>' + (Number(cardio.inclinePercent || 0) > 0 ? formatNumberForInput(Number(cardio.inclinePercent || 0), 0.5) + '%' : '--') + '</strong></span>',
      '<span>概算消費カロリー <strong>' + Math.round(result.calories) + ' kcal</strong></span>'
    ].join("");
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
    if (issue.warning && skipWarning !== true) {
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
    var savedHtml = draft.cardios.map(function (cardio, cardioIndex) {
      var result = calculateCardio(cardio);
      var editingClass = cardio.tempId === editingCardioTempId ? " is-editing" : "";
      var exerciseId = cardioExerciseId(cardio.type);
      var cardioName = escapeHtml(cardio.type);
      var isExpanded = expandedDraftCardioKey === cardio.tempId;
      var detailsText = cardioMetricSummary(cardio, "距離・時間は記録時に入力");
      var reorder = '<div class="saved-group-reorder"><button type="button" data-move-cardio="' + cardioIndex + '" data-move-direction="-1" aria-label="' + cardioName + 'を上へ移動"' + (cardioIndex === 0 ? " disabled" : "") + '>↑</button><button type="button" data-move-cardio="' + cardioIndex + '" data-move-direction="1" aria-label="' + cardioName + 'を下へ移動"' + (cardioIndex === draft.cardios.length - 1 ? " disabled" : "") + '>↓</button></div>';
      var actions = isExpanded ? '<div class="saved-group-actions"><span>有酸素</span>' + reorder + '</div>' : "";
      var detailRow = isExpanded ? '<div class="saved-item saved-item--editable' + editingClass + '" data-edit-cardio="' + cardio.tempId + '"><button class="saved-item-main" type="button" aria-label="' + cardioName + 'を編集"><span class="set-index">' + (cardio.type === "ランニング" || cardio.type === "ジョギング" ? "走" : "有") + '</span><span class="saved-item-text"><strong>' + escapeHtml(detailsText) + '</strong><small>' + (cardio.memo ? "メモ：" + escapeHtml(cardio.memo) : "タップして編集できます") + '</small></span><span class="edit-cue">編集</span></button><button class="delete-mini" type="button" data-delete-cardio="' + cardio.tempId + '" aria-label="有酸素記録を削除">×</button></div><button class="saved-set-add-button" type="button" data-add-same-exercise="' + exerciseId + '">記録を追加</button>' : "";
      return '<div class="saved-group saved-group--cardio saved-group--compact' + (isExpanded ? ' is-expanded' : '') + '" data-sort-item="cardio:' + cardio.tempId + '"><div class="saved-group-head"><button class="drag-handle" type="button" data-sort-handle aria-label="' + cardioName + 'を並べ替え">☰</button><button class="saved-group-add" type="button" data-toggle-draft-cardio="' + cardio.tempId + '"><span class="saved-group-title"><strong>' + cardioName + '</strong><small>' + escapeHtml("完了：" + cardioMetricSummary(cardio, "距離・時間は記録時に入力")) + '</small></span><em>' + (isExpanded ? "閉じる" : "詳細") + '</em></button>' + actions + '</div>' + detailRow + '</div>';
    }).join("");
    var pendingTypes = draft.pendingCardioTypes || [];
    var pendingHtml = pendingTypes.map(function (type, pendingIndex) {
      var exerciseId = cardioExerciseId(type);
      var typeName = escapeHtml(type);
      var pendingKey = "pending:" + type;
      var isExpanded = expandedDraftCardioKey === pendingKey;
      var pendingReorder = '<div class="saved-group-reorder"><button type="button" data-move-pending-cardio="' + pendingIndex + '" data-move-direction="-1" aria-label="' + typeName + 'を上へ移動"' + (pendingIndex === 0 ? " disabled" : "") + '>↑</button><button type="button" data-move-pending-cardio="' + pendingIndex + '" data-move-direction="1" aria-label="' + typeName + 'を下へ移動"' + (pendingIndex === pendingTypes.length - 1 ? " disabled" : "") + '>↓</button></div>';
      var actions = isExpanded ? '<div class="saved-group-actions"><span>有酸素</span>' + pendingReorder + '<button class="saved-group-remove" type="button" data-delete-pending-cardio="' + typeName + '" aria-label="' + typeName + 'を今日のメニューから外す">削除</button></div>' : "";
      var detail = isExpanded ? '<p class="saved-group-note">' + escapeHtml(historicalCardioSummary(type)) + '</p><button class="saved-set-add-button" type="button" data-add-same-exercise="' + exerciseId + '">内容を入力</button>' : "";
      return '<div class="saved-group saved-group--cardio saved-group--compact' + (isExpanded ? ' is-expanded' : '') + '" data-sort-item="pending-cardio:' + typeName + '"><div class="saved-group-head"><button class="drag-handle" type="button" data-sort-handle aria-label="' + typeName + 'を並べ替え">☰</button><button class="saved-group-add" type="button" data-toggle-draft-cardio="' + pendingKey + '"><span class="saved-group-title"><strong>' + typeName + '</strong><small>予定：距離・時間は記録時に入力</small></span><em>' + (isExpanded ? "閉じる" : "詳細") + '</em></button>' + actions + '</div>' + detail + '</div>';
    }).join("");
    $("#savedCardioList").innerHTML = savedHtml + pendingHtml;
    enableSortableList($("#savedCardioList"), {
      onChange: function (order) {
        if (!draftSortMode) return;
        applyDraftGuideMenuOrder(draftGuideMenuEntries().filter(function (entry) { return order.indexOf(entry.key) < 0; }).map(function (entry) { return entry.key; }).concat(order));
        renderSavedCardios();
      }
    });
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

  function deletePendingCardioType(type) {
    if (!draft || !type) return;
    draft.pendingCardioTypes = (draft.pendingCardioTypes || []).filter(function (item) { return item !== type; });
    var exercise = getExercise(selectedExerciseId);
    if (exercise && exercise.category === "CARDIO" && exercise.name === type && !editingCardioTempId) {
      resetWorkoutEditorState();
      resetCardioForm();
      renderSelectedExercise();
    }
    renderSavedCardios();
    updateDraftCalories();
    saveDraftNow();
  }

  function updateDraftCalories() {
    var calories = Math.round(draftCalories());
    var volumeKg = calculateDraftStrengthVolume(draft ? draft.records : []);
    var bottomCalories = $("#sessionCalories");
    if (bottomCalories) bottomCalories.textContent = calories;
    var topCalories = $("#sessionCaloriesTop");
    if (topCalories) topCalories.textContent = calories.toLocaleString("ja-JP");
    var topVolume = $("#sessionVolumeTop");
    if (topVolume) topVolume.textContent = formatDraftVolume(volumeKg);
  }

  function formatRestTimerTime(seconds) {
    var value = Math.ceil(Number(seconds || 0));
    var sign = value < 0 ? "-" : "";
    var total = Math.abs(value);
    var minutes = Math.floor(total / 60);
    var remainder = total % 60;
    return sign + String(minutes).padStart(2, "0") + ":" + String(remainder).padStart(2, "0");
  }

  function calculateRestTimerRemaining(state, now) {
    if (!state || state.status === "idle") return 0;
    if (state.status === "paused") return Math.ceil(Number(state.remainingSeconds || 0));
    return Math.ceil((Number(state.endAt || 0) - (now || Date.now())) / 1000);
  }

  function clearRestTimerInterval() {
    if (restTimerState.intervalId) {
      clearInterval(restTimerState.intervalId);
      restTimerState.intervalId = null;
    }
  }

  function renderRestTimer() {
    var panel = $("#restTimerPanel");
    if (!panel) return;
    var isActive = isRestTimerEnabled() && restTimerState.status !== "idle";
    var guideScreenActive = isGuideActive() && $("#guideWorkoutScreen") && $("#guideWorkoutScreen").classList.contains("screen--active");
    panel.classList.toggle("hidden", !isActive || guideScreenActive);
    if (guideScreenActive) renderGuideRestTimer();
    if (!isActive) {
      panel.classList.remove("is-overtime");
      return;
    }
    var remaining = calculateRestTimerRemaining(restTimerState);
    var isOvertime = remaining < 0;
    panel.classList.toggle("is-overtime", isOvertime);
    $("#restTimerLabel").textContent = isOvertime ? "休憩時間を過ぎています" : "休憩中";
    $("#restTimerTime").textContent = formatRestTimerTime(remaining);
    $("#restTimerPauseButton").textContent = restTimerState.status === "paused" ? "再開" : "一時停止";
  }

  function unlockWorkoutAudio() {
    try {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) {
        guideAudioState.unlocked = false;
        return false;
      }
      if (!guideAudioState.context) guideAudioState.context = new AudioContextClass();
      var context = guideAudioState.context;
      if (context.state === "suspended" && context.resume) context.resume();
      var oscillator = context.createOscillator();
      var gain = context.createGain();
      gain.gain.value = 0.00001;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.02);
      guideAudioState.unlocked = true;
      return true;
    } catch (error) {
      console.warn("Audio unlock was not available", error);
      guideAudioState.unlocked = false;
      return false;
    }
  }

  function playRestTimerEndSound() {
    if (!isRestTimerEnabled() || !uiSettings.restTimerSound) return false;
    try {
      var context = guideAudioState.context;
      if (!context && !unlockWorkoutAudio()) return false;
      context = guideAudioState.context;
      if (!context) return false;
      if (context.state === "suspended" && context.resume) context.resume();
      var now = context.currentTime;
      [0, 0.16].forEach(function (offset) {
        var oscillator = context.createOscillator();
        var gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.07, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.13);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now + offset);
        oscillator.stop(now + offset + 0.14);
      });
      return true;
    } catch (error) {
      console.warn("Rest timer sound skipped", error);
      return false;
    }
  }

  function playRestTimerSound() {
    return playRestTimerEndSound();
  }

  function tryRestTimerVibration() {
    if (!isRestTimerEnabled() || !uiSettings.restTimerVibration) return false;
    try {
      if (navigator.vibrate && typeof navigator.vibrate === "function") {
        return !!navigator.vibrate([150, 80, 150]);
      }
    } catch (error) {
      console.warn("Vibration was not available", error);
    }
    return false;
  }

  function finishRestTimer() {
    if (!isRestTimerEnabled()) {
      stopRestTimer();
      return;
    }
    if (restTimerState.finishedNotified) {
      renderRestTimer();
      return;
    }
    restTimerState.finishedNotified = true;
    renderRestTimer();
    tryRestTimerVibration();
    playRestTimerEndSound();
  }

  function tickRestTimer() {
    if (!isRestTimerEnabled()) {
      stopRestTimer();
      return;
    }
    if (restTimerState.status !== "running") return;
    restTimerState.remainingSeconds = calculateRestTimerRemaining(restTimerState);
    renderRestTimer();
    if (restTimerState.remainingSeconds <= 0 && !restTimerState.finishedNotified) finishRestTimer();
  }

  function startRestTimer(seconds) {
    var totalSeconds = Math.max(0, Math.round(Number(seconds || 0)));
    if (isGuideActive()) {
      debugGuideTimer("startRestTimer called", {
        seconds: totalSeconds,
        restTimerEnabled: isRestTimerEnabled(),
        autoStartRestTimer: uiSettings.autoStartRestTimer,
        guideActive: true,
        status: restTimerState.status
      });
    }
    if (!isRestTimerEnabled() || !uiSettings.autoStartRestTimer || totalSeconds < 1) {
      if (isGuideActive()) renderGuideRestTimer();
      return;
    }
    clearRestTimerInterval();
    restTimerState = {
      status: "running",
      totalSeconds: totalSeconds,
      remainingSeconds: totalSeconds,
      endAt: Date.now() + totalSeconds * 1000,
      intervalId: null,
      finishedNotified: false
    };
    restTimerState.intervalId = setInterval(tickRestTimer, 1000);
    renderRestTimer();
    if (isGuideActive()) renderGuideRestTimer();
  }

  function stopRestTimer() {
    clearRestTimerInterval();
    restTimerState = { status: "idle", totalSeconds: 0, remainingSeconds: 0, endAt: 0, intervalId: null, finishedNotified: false };
    renderRestTimer();
    if (isGuideActive()) renderGuideRestTimer();
  }

  function pauseRestTimer() {
    if (!isRestTimerEnabled()) return;
    if (restTimerState.status === "running") {
      restTimerState.remainingSeconds = calculateRestTimerRemaining(restTimerState);
      restTimerState.status = "paused";
      clearRestTimerInterval();
      renderRestTimer();
      return;
    }
    if (restTimerState.status === "paused") {
      restTimerState.status = "running";
      restTimerState.endAt = Date.now() + Number(restTimerState.remainingSeconds || 0) * 1000;
      clearRestTimerInterval();
      restTimerState.intervalId = setInterval(tickRestTimer, 1000);
      tickRestTimer();
    }
  }

  function addRestTimerSeconds(seconds) {
    if (!isRestTimerEnabled()) return;
    if (restTimerState.status === "idle") return;
    var next = calculateRestTimerRemaining(restTimerState) + Math.max(0, Number(seconds || 0));
    restTimerState.remainingSeconds = next;
    restTimerState.totalSeconds = Math.max(restTimerState.totalSeconds, next);
    if (next > 0) restTimerState.finishedNotified = false;
    if (restTimerState.status === "running") restTimerState.endAt = Date.now() + next * 1000;
    renderRestTimer();
  }

  function updateBestValues(best, set) {
    var weightKg = Number(set.weight || 0) / 1000;
    var reps = Number(set.reps || 0);
    if (weightKg > best.maxWeight) best.maxWeight = weightKg;
    if (reps > best.maxReps) best.maxReps = reps;
    var oneRm = estimatedOneRm(weightKg, reps);
    if (oneRm > best.oneRm) best.oneRm = oneRm;
  }

  function collectPreviousExerciseBest(exerciseId, excludeSetTempId) {
    var best = { maxWeight: 0, maxReps: 0, oneRm: 0 };
    var records = dataIndexes ? (dataIndexes.recordsByExerciseId[exerciseId] || []) : data.records.filter(function (record) { return record.exerciseId === exerciseId; });
    records.forEach(function (record) {
      getRecordSets(record.id).forEach(function (set) {
        if (excludeSetTempId && set.id === excludeSetTempId) return;
        updateBestValues(best, set);
      });
    });
    if (draft && !isGuideActive()) {
      draft.records.forEach(function (record) {
        if (record.exerciseId !== exerciseId) return;
        record.sets.forEach(function (set) {
          if (excludeSetTempId && set.tempId === excludeSetTempId) return;
          updateBestValues(best, set);
        });
      });
    }
    if (isGuideActive()) {
      guideItems(draft.guideState).forEach(function (item) {
        if (item.exerciseId !== exerciseId) return;
        guideItemCompletedSets(item).forEach(function (set) {
          if (excludeSetTempId && set.tempId === excludeSetTempId) return;
          updateBestValues(best, set);
        });
      });
    }
    return best;
  }

  function evaluatePersonalBest(exercise, setValues, excludeSetTempId) {
    if (!exercise || !setValues) return null;
    var weightKg = Number(setValues.weight || 0) / 1000;
    var reps = Number(setValues.reps || 0);
    var previous = collectPreviousExerciseBest(exercise.id, excludeSetTempId);
    if (exercise.category === "BODYWEIGHT") {
      if (previous.maxReps > 0 && reps > previous.maxReps) return { exercise: exercise, metric: "最高回数", value: reps, previous: previous.maxReps, unit: "回", decimals: 0 };
      return null;
    }
    if (previous.maxWeight > 0 && weightKg > previous.maxWeight) return { exercise: exercise, metric: "最大重量", value: weightKg, previous: previous.maxWeight, unit: "kg", decimals: 1 };
    var currentOneRm = estimatedOneRm(weightKg, reps);
    if (previous.oneRm > 0 && currentOneRm > previous.oneRm) return { exercise: exercise, metric: "推定1RM", value: currentOneRm, previous: previous.oneRm, unit: "kg", decimals: 1 };
    return null;
  }

  function formatBestValue(value, decimals, unit) {
    return Number(value || 0).toFixed(decimals) + unit;
  }

  function showPersonalBestBanner(result, notificationKey) {
    if (!result || !notificationKey || personalBestShownKeys[notificationKey]) return;
    personalBestShownKeys[notificationKey] = true;
    var banner = $("#personalBestBanner");
    if (!banner) return;
    $("#personalBestMessage").textContent = result.exercise.name + "\n" + result.metric + " " + formatBestValue(result.value, result.decimals, result.unit) + "\n前回ベスト " + formatBestValue(result.previous, result.decimals, result.unit);
    banner.classList.remove("hidden");
    clearTimeout(personalBestTimer);
    personalBestTimer = setTimeout(function () { banner.classList.add("hidden"); }, 5200);
  }

  function sortExerciseListForTest(exercises, recentExerciseIds) {
    var recentRank = {};
    (recentExerciseIds || []).forEach(function (id, index) { recentRank[id] = index; });
    return (exercises || []).slice().sort(function (a, b) {
      if (!!a.isFavorite !== !!b.isFavorite) return a.isFavorite ? -1 : 1;
      var recentA = Object.prototype.hasOwnProperty.call(recentRank, a.id) ? recentRank[a.id] : Infinity;
      var recentB = Object.prototype.hasOwnProperty.call(recentRank, b.id) ? recentRank[b.id] : Infinity;
      if (recentA !== recentB) return recentA - recentB;
      return Number(a.catalogOrder || 0) - Number(b.catalogOrder || 0);
    });
  }

  function filterExerciseListForTest(exercises, activeBodyPart, searchTerm) {
    var term = normalizeSearchText(searchTerm);
    return (exercises || []).filter(function (exercise) {
      if (term) return normalizeSearchText(exercise.name).indexOf(term) >= 0;
      return exercise.bodyPart === activeBodyPart;
    });
  }

  function evaluatePersonalBestFromSets(exercise, setValues, previousSets, excludeSetTempId) {
    var best = { maxWeight: 0, maxReps: 0, oneRm: 0 };
    (previousSets || []).forEach(function (set) {
      if (excludeSetTempId && (set.tempId === excludeSetTempId || set.id === excludeSetTempId)) return;
      updateBestValues(best, set);
    });
    var weightKg = Number(setValues.weight || 0) / 1000;
    var reps = Number(setValues.reps || 0);
    if (exercise && exercise.category === "BODYWEIGHT") return best.maxReps > 0 && reps > best.maxReps ? "maxReps" : null;
    if (best.maxWeight > 0 && weightKg > best.maxWeight) return "maxWeight";
    if (best.oneRm > 0 && estimatedOneRm(weightKg, reps) > best.oneRm) return "oneRm";
    return null;
  }

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
    if (isGuideActive() && !prepareGuideDraftForSave()) return;
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

  function workoutSavedToastText(oldSession, records, cardios, calories, volumeKg) {
    var setCount = (records || []).reduce(function (sum, record) { return sum + record.sets.length; }, 0);
    var cardioCount = (cardios || []).length;
    var parts = [];
    if (setCount) parts.push(setCount + "セット");
    if (cardioCount) parts.push("有酸素" + cardioCount + "件");
    if (Number(volumeKg || 0) > 0) parts.push(formatDraftVolume(volumeKg) + "kg");
    if (Number(calories || 0) > 0) parts.push(Math.round(calories).toLocaleString("ja-JP") + "kcal");
    var prefix = oldSession ? "トレーニングを更新しました" : "トレーニングを保存しました";
    return prefix + "。おつかれさまでした" + (parts.length ? "（" + parts.join("・") + "）" : "");
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
    stopRestTimer();
    pendingSaveConflict = null;
    clearSavedDraft();
    var savedSessionDate = draft.date;
    draft = null;
    routineEditingId = null;
    resetWorkoutEditorState();
    calendarCursor = dateFromString(savedSessionDate);
    calendarCursor.setDate(1);
    renderHome();
    showScreen("home");
    showToast(workoutSavedToastText(oldSession, validRecords, preparedCardios, totalCalories, calculateDraftStrengthVolume(validRecords)));
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
        lines.push('<div class="summary-line"><strong>' + escapeHtml(cardio.type) + '</strong><span>' + escapeHtml(cardioMetricSummary(cardio, "距離・時間は記録時に入力")) + '</span></div>');
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

  function bindHomeMenuEvents() {
    on("#homeSettingsButton", "click", function () { openModal("settingsMenuModal"); });
    on("#homeRoutineMenuButton", "click", function () { openModal("routineMenuModal"); });
    on("#homeRecordMenuButton", "click", function () { openModal("recordMenuModal"); });
    on("#homeRoutineCreateButton", "click", function () { closeModal("routineMenuModal"); openRoutineCreator(false); });
    on("#homeGymStartButton", "click", function () { closeModal("recordMenuModal"); startTodayLocation("gym"); });
    on("#homeHomeStartButton", "click", function () { closeModal("recordMenuModal"); startTodayLocation("home"); });
    on("#settingsProfileButton", "click", function () { closeModal("settingsMenuModal"); openProfile(); });
    on("#settingsAppearanceButton", "click", function () { closeModal("settingsMenuModal"); renderAppearanceSettings(); openModal("appearanceSettingsModal"); });
    bindKeyboardActivation($("#monthlyCaloriesCard"), openDisplayedMonthCaloriesProgress);
    bindKeyboardActivation($("#monthlyVolumeCard"), openDisplayedMonthVolumeProgress);
  }

  function bindAppearanceEvents() {
    on("#appearanceSettingsModal", "click", function (event) {
      var appearanceButton = event.target.closest("[data-appearance-option]");
      if (appearanceButton) {
        setAppearanceSetting(appearanceButton.dataset.appearanceOption);
        return;
      }
      var themeButton = event.target.closest("[data-color-theme-option]");
      if (themeButton) {
        setColorTheme(themeButton.dataset.colorThemeOption);
        return;
      }
      var timerInput = event.target.closest("[data-timer-setting]");
      if (timerInput) setTimerSetting(timerInput.dataset.timerSetting, timerInput.checked);
    });
  }

  function bindSettingsDataEvents() {
    on("#settingsRoutineButton", "click", function () { closeModal("routineMenuModal"); openRoutineList(todayString(), "manage"); });
    on("#backupDataButton", "click", function () { var button = this; runButtonLocked(button, function () { downloadBackupData("gymlog-backup"); }); });
    on("#restoreDataButton", "click", function () { $("#restoreDataInput").value = ""; $("#restoreDataInput").click(); });
    on("#restoreSnapshotButton", "click", restorePreRestoreSnapshot);
    on("#aiExportButton", "click", openAiExportModal);
    on("#aiExportRange", "change", function () {
      if (this.value === "custom") ensureAiExportCustomDates();
      updateAiExportPreview();
    });
    ["#aiExportStartDate", "#aiExportEndDate", "#aiExportTarget", "#aiExportExercise"].forEach(function (selector) {
      on(selector, "change", updateAiExportPreview);
    });
    on("#aiExportStartDate", "input", updateAiExportPreview);
    on("#aiExportEndDate", "input", updateAiExportPreview);
    on("#copyAiExportButton", "click", copyAiExportText);
    on("#restoreDataInput", "change", function () { readBackupFile(this.files && this.files[0]); });
    on("#exportCorruptDataButton", "click", downloadCorruptData);
    on("#recoveryRestoreButton", "click", function () { $("#restoreDataInput").value = ""; $("#restoreDataInput").click(); });
    on("#startFreshDataButton", "click", function () { var button = this; runButtonLocked(button, startWithFreshData); });
    on("#discardSavedDraft", "click", discardSavedDraft);
    on("#resumeSavedDraft", "click", resumeSavedDraft);
    on("#nextSetYesButton", "click", function () { var button = this; runButtonLocked(button, startConfirmedNextSet); });
    on("#nextSetPickExerciseButton", "click", function () { var button = this; runButtonLocked(button, chooseNextExerciseAfterSet); });
    on("#nextSetNoButton", "click", function () { var button = this; runButtonLocked(button, closeNextSetInput); });
  }

  function bindProgressEvents() {
    on("#openProgressButton", "click", function () { openProgressPage(); });
    on("#backFromProgressButton", "click", function () { renderHome(); showScreen("home"); });
    $$('[data-progress-tab]').forEach(function (button) {
      button.addEventListener("click", function () {
        progressState.tab = button.dataset.progressTab;
        progressState.metric = defaultProgressMetric(progressState.tab);
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
    on("#applyProgressCustomRange", "click", function () {
      var start = $("#progressCustomStart").value;
      var end = $("#progressCustomEnd").value;
      if (!start || !end || start > end) {
        showToast("正しい期間を指定してください");
        return;
      }
      progressState.customStart = start;
      progressState.customEnd = end;
      progressState.range = "custom";
      renderProgressPage();
    });
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
  }

  function bindRoutineEvents() {
    on("#openRoutineListButton", "click", function () { openRoutineList(draft ? draft.date : todayString(), "use"); });
    on("#saveRoutineButton", "click", openRoutineSaveModal);
    on("#startDraftSortButton", "click", startDraftSortMode);
    on("#saveDraftSortButton", "click", saveDraftSortMode);
    on("#cancelDraftSortButton", "click", cancelDraftSortMode);
    on("#confirmRoutineSave", "click", function () { var button = this; runButtonLocked(button, saveRoutineFromDraft); });
    on("#routineAddExerciseButton", "click", openRoutineExercisePicker);
    on("#routineNameInput", "input", function () { if (routineEditorState) routineEditorState.name = this.value; });
    on("#routineLocationType", "change", function () { if (routineEditorState) routineEditorState.locationType = this.value === "home" ? "home" : "gym"; });
  }

  function bindCalendarAndCopyEvents() {
    on("#emptyAddExerciseButton", "click", openExercisePickerForMenuAdd);
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

  }

  function bindProfileEvents() {
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

  }

  function bindWorkoutNavigationEvents() {
    on("#backHomeButton", "click", function () { stopRestTimer(); if (draft) saveDraftNow(); draft = null; routineEditingId = null; renderHome(); showScreen("home"); });
    on("#finishTopButton", "click", function () { var button = this; runButtonLocked(button, saveWorkout); });
    on("#finishWorkoutButton", "click", function () { var button = this; runButtonLocked(button, saveWorkout); });
    on("#sessionDate", "change", function () { if (draft) { draft.date = this.value; scheduleDraftSave(); } });
    on("#sessionMemo", "input", function () { if (draft) { draft.memo = this.value; scheduleDraftSave(); } });
  }

  function bindExercisePickerControlEvents() {
    on("#exercisePickerButton", "click", openExercisePicker);
    on("#chooseAnotherExercise", "click", openExercisePickerForMenuAdd);
    on("#cancelExerciseSelection", "click", cancelExerciseSelection);
    on("#confirmExerciseSelection", "click", confirmExerciseSelection);
  }

  function bindExerciseListEvents() {
    on("#exerciseBodyPartTabs", "click", function (event) {
      var tab = event.target.closest("[data-body-part]");
      if (!tab) return;
      activeExerciseBodyPart = tab.dataset.bodyPart;
      renderExerciseBodyPartTabs();
      renderExerciseList();
    });
    on("#exerciseSearch", "input", function () {
      clearTimeout(exerciseSearchTimer);
      exerciseSearchTimer = setTimeout(renderExerciseList, 120);
    });
    on("#exerciseList", "click", function (event) {
      var stepSelect = event.target.closest("[data-step-exercise]");
      if (stepSelect) {
        event.stopPropagation();
        return;
      }
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
        if (exercisePickerMode === "guideAdd") {
          var guideAddExerciseId = option.dataset.exerciseId;
          pendingExerciseId = null;
          exercisePickerMode = "workout";
          closeModal("exerciseModal");
          addExerciseToGuide(guideAddExerciseId, true);
          return;
        }
        if (exercisePickerMode === "guideStartAdd") {
          addExerciseFromGuideStartPicker(option.dataset.exerciseId);
          return;
        }
        pendingExerciseId = option.dataset.exerciseId;
        $("#confirmExerciseSelection").disabled = false;
        renderExerciseList();
      }
    });
    on("#exerciseList", "change", function (event) {
      var stepSelect = event.target.closest("[data-step-exercise]");
      if (!stepSelect) return;
      event.stopPropagation();
      var exercise = getExercise(stepSelect.dataset.stepExercise);
      if (!exercise) return;
      var step = normalizeExerciseWeightStep(stepSelect.value, exercise.category);
      if (runDataTransaction(function () { exercise.defaultWeightStep = step; exercise.updatedAt = nowIso(); })) {
        if (selectedExerciseId === exercise.id) renderSelectedExercise();
        renderExerciseList();
        showToast("重量の刻みを更新しました");
      }
    });
  }

  function bindAddExerciseEvents() {
    var newExerciseStepManuallyChanged = false;
    function syncNewExerciseWeightStep() {
      var category = $("#newExerciseCategory").value;
      $("#newExerciseStepField").classList.add("hidden");
      if (!newExerciseStepManuallyChanged) $("#newExerciseWeightStep").value = String(defaultWeightStepForCategory(category) || 1);
    }

    on("#openAddExercise", "click", function () {
      if (exercisePickerMode !== "routine") closeModal("exerciseModal");
      newExerciseStepManuallyChanged = false;
      $("#newExerciseName").value = "";
      $("#newExerciseBodyPart").value = activeExerciseBodyPart === "cardio" ? "other" : activeExerciseBodyPart;
      syncNewExerciseWeightStep();
      openModal("addExerciseModal");
    });
    on("#newExerciseCategory", "change", syncNewExerciseWeightStep);
    on("#newExerciseWeightStep", "change", function () { newExerciseStepManuallyChanged = true; });
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
        if (exercisePickerMode === "guideAdd" || exercisePickerMode === "guideReplace") {
          if (exercisePickerMode === "guideAdd") addExerciseToGuide(existingExercise.id, true);
          else replaceGuideExercise(existingExercise.id);
          exercisePickerMode = "workout";
          closeModal("exerciseModal");
          return;
        }
        if (exercisePickerMode === "guideStartAdd") {
          addExerciseFromGuideStartPicker(existingExercise.id);
          return;
        }
        if (exercisePickerMode === "workoutAdd") {
          addExerciseToMenuAndReturn(existingExercise.id);
          showToast("同じ名前の種目を今日のメニューに追加しました");
          return;
        }
        chooseExercise(existingExercise.id);
        showToast("同じ名前の種目を選択しました");
        return;
      }
      var stamp = nowIso();
      var exercise = { id: makeId("ex"), name: name, category: category, bodyPart: bodyPart, defaultWeightStep: defaultWeightStepForCategory(category), isFavorite: false, createdAt: stamp, updatedAt: stamp };
      if (!runDataTransaction(function () { data.exercises.push(exercise); })) return;
      closeModal("addExerciseModal");
      if (exercisePickerMode === "routine") {
        routinePendingExerciseIds.push(exercise.id);
        renderExerciseList();
      } else if (exercisePickerMode === "guideAdd" || exercisePickerMode === "guideReplace") {
        if (exercisePickerMode === "guideAdd") addExerciseToGuide(exercise.id, true);
        else replaceGuideExercise(exercise.id);
        exercisePickerMode = "workout";
        closeModal("exerciseModal");
      } else if (exercisePickerMode === "guideStartAdd") {
        addExerciseFromGuideStartPicker(exercise.id);
      } else if (exercisePickerMode === "workoutAdd") {
        addExerciseToMenuAndReturn(exercise.id);
      } else chooseExercise(exercise.id);
      showToast("新しい種目を追加しました");
    });

  }

  function bindStrengthSetInputEvents() {
    on("#weightMinus", "click", function () { changeWeightByStep(-1, 1); });
    on("#weightPlus", "click", function () { changeWeightByStep(1, 1); });
    on("#weightMinusLarge", "click", function () { changeWeightByStep(-1, 10); });
    on("#weightPlusLarge", "click", function () { changeWeightByStep(1, 10); });
    on("#weightMinusSmall", "click", function () { changeWeightByStep(-1, 0.5); });
    on("#weightPlusSmall", "click", function () { changeWeightByStep(1, 0.5); });
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

  }
  function bindWorkoutEditorEvents() {
    bindWorkoutNavigationEvents();
    bindExercisePickerControlEvents();
    bindExerciseListEvents();
    bindAddExerciseEvents();
    bindStrengthSetInputEvents();
  }

  function bindCardioEvents() {
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
      var moveCardioButton = event.target.closest("[data-move-cardio]");
      if (moveCardioButton) {
        event.stopPropagation();
        moveDraftCardio(moveCardioButton.dataset.moveCardio, moveCardioButton.dataset.moveDirection);
        return;
      }
      var movePendingCardioButton = event.target.closest("[data-move-pending-cardio]");
      if (movePendingCardioButton) {
        event.stopPropagation();
        movePendingCardio(movePendingCardioButton.dataset.movePendingCardio, movePendingCardioButton.dataset.moveDirection);
        return;
      }
      var deletePendingButton = event.target.closest("[data-delete-pending-cardio]");
      if (deletePendingButton) {
        event.stopPropagation();
        var pendingType = deletePendingButton.dataset.deletePendingCardio;
        askConfirm(pendingType + "を今日のメニューから外しますか？", "削除する", function () { deletePendingCardioType(pendingType); });
        return;
      }
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

  }

  function bindRestTimerEvents() {
    on("#restTimerPauseButton", "click", pauseRestTimer);
    on("#restTimerAddButton", "click", function () { addRestTimerSeconds(30); });
    on("#restTimerSkipButton", "click", stopRestTimer);
    on("#personalBestClose", "click", function () { $("#personalBestBanner").classList.add("hidden"); });
    document.addEventListener("visibilitychange", function () {
      if (restTimerState.status === "running") tickRestTimer();
    });
    if (window.addEventListener) window.addEventListener("beforeunload", stopRestTimer);
  }

  function changeGuideWeight(direction, amount) {
    var item = guideCurrentItem();
    var exercise = guideItemExercise(item);
    if (!exercise || exercise.category === "BODYWEIGHT") return;
    var step = Number(amount || 1);
    var input = $("#guideWeightInput");
    input.value = Math.max(0, getNumericInputValue(input) + direction * step).toFixed(1);
    captureGuideInputToState();
    scheduleDraftSave();
  }

  function changeGuideReps(direction) {
    var input = $("#guideRepsInput");
    var current = Math.round(getNumericInputValue(input));
    if (current < 1) current = 10;
    input.value = Math.max(1, current + direction);
    captureGuideInputToState();
    scheduleDraftSave();
  }

  function changeGuideCardioInput(targetId, direction, stepOverride) {
    var input = $("#" + targetId);
    if (!input) return;
    var step = Number(stepOverride || parseFloat(input.step) || 1);
    if (!Number.isFinite(step) || step <= 0) step = 1;
    var next = Math.max(0, getNumericInputValue(input) + Number(direction || 0) * step);
    var maximum = parseFloat(input.max);
    if (Number.isFinite(maximum)) next = Math.min(maximum, next);
    input.value = formatNumberForInput(next, step);
    updateGuideCardioPreview();
    captureGuideCardioInputToState();
    scheduleDraftSave();
  }

  function bindGuideModeEvents() {
    on("#startGuideModeButton", "click", function () { unlockWorkoutAudio(); openGuideStart(); });
    on("#guideModeHelpButton", "click", openGuideHelp);
    on("#startGuideFromHelpButton", "click", function () { unlockWorkoutAudio(); closeModal("guideModeHelpModal"); openGuideStart(); });
    $$('input[name="guideStartMode"]').forEach(function (input) {
      input.addEventListener("change", function () {
        $("#guideStartExerciseSelect").classList.toggle("hidden", this.value !== "choose" || !this.checked);
      });
    });
    on("#confirmGuideStart", "click", startGuideModeFromModal);
    on("#guideStartAddExerciseButton", "click", openGuideStartExercisePicker);
    on("#editGuideMenuButton", "click", function () { closeModal("guideStartModal"); });
    on("#guideBackHomeButton", "click", openGuideExit);
    on("#guideExitButton", "click", openGuideExit);
    on("#guideMenuListButton", "click", openGuideMenu);
    on("#guideUndoLastActionButton", "click", undoLastGuideAction);
    on("#guideMenuUndoLastActionButton", "click", undoLastGuideAction);
    on("#guideExercisePickerUndoButton", "click", undoLastGuideAction);
    on("#guideChooseNextExerciseButton", "click", handleGuideCompletePrimaryAction);
    on("#guideAddExtraSetButton", "click", handleGuideAddExtraSetAction);
    on("#guideEndMenuAfterSetButton", "click", handleGuideCompleteSecondaryAction);
    on("#guideLeaveFinishButton", "click", confirmGuideLeaveAsFinished);
    on("#guideLeaveDeferButton", "click", confirmGuideLeaveAsDeferred);
    on("#guideLeaveCancelButton", "click", function () { closeModal("guideLeaveItemModal"); });
    on("#guideStartSummary", "click", function (event) {
      var button = event.target.closest("[data-guide-start-exercise]");
      if (!button) return;
      startGuideModeWithExercise(button.dataset.guideStartExercise);
    });
    on("#guideNextChoiceList", "click", function (event) {
      var button = event.target.closest("[data-guide-select-item]");
      if (!button) return;
      var state = guideState();
      var item = state ? guideItems(state).find(function (entry) { return entry.id === button.dataset.guideSelectItem; }) : null;
      if (item && item.status === "completed") showGuideCompletedDetail(item.id);
      else activateGuideItem(button.dataset.guideSelectItem);
    });
    on("#guideDetailAddSetButton", "click", addSetFromGuideCompletedDetail);
    on("#guideDetailBackButton", "click", returnGuideToNextChoice);
    on("#guideAddExerciseButton", "click", function () { openGuideExercisePicker("guideAdd"); });
    on("#guideMenuAddExercise", "click", function () { openGuideExercisePicker("guideAdd"); });
    on("#replaceGuideItemButton", "click", function () { openGuideExercisePicker("guideReplace"); });
    on("#completeGuideSetButton", "click", completeGuideSet);
    on("#completeGuideCardioButton", "click", completeGuideCardio);
    on("#deferGuideItemButton", "click", deferCurrentGuideItem);
    on("#skipGuideItemButton", "click", skipCurrentGuideItem);
    on("#replaceGuideCardioButton", "click", function () { openGuideExercisePicker("guideReplace"); });
    on("#skipGuideCardioButton", "click", skipCurrentGuideItem);
    on("#continueGuideButton", "click", returnGuideToWorkoutMenu);
    on("#cancelGuideExit", "click", cancelGuideExitDialog);
    on("#saveGuideProgress", "click", function () { var button = this; runButtonLocked(button, saveGuideProgress); });
    on("#saveGuideAndDisableButton", "click", function () { var button = this; runButtonLocked(button, saveGuideAndDisableMode); });
    on("#discardGuideAndDisableButton", "click", function () { var button = this; runButtonLocked(button, discardGuideAndDisableMode); });
    on("#cancelGuideDisableButton", "click", cancelGuideModeDisable);
    on("#guideWeightMinus", "click", function () { changeGuideWeight(-1, 1); });
    on("#guideWeightPlus", "click", function () { changeGuideWeight(1, 1); });
    on("#guideWeightMinusLarge", "click", function () { changeGuideWeight(-1, 10); });
    on("#guideWeightPlusLarge", "click", function () { changeGuideWeight(1, 10); });
    on("#guideWeightMinusSmall", "click", function () { changeGuideWeight(-1, 0.5); });
    on("#guideWeightPlusSmall", "click", function () { changeGuideWeight(1, 0.5); });
    on("#guideRepsMinus", "click", function () { changeGuideReps(-1); });
    on("#guideRepsPlus", "click", function () { changeGuideReps(1); });
    on("#guideWeightInput", "input", function () { captureGuideInputToState(); scheduleDraftSave(); });
    on("#guideWeightInput", "blur", function () { this.value = Math.max(0, getNumericInputValue(this)).toFixed(1); captureGuideInputToState(); scheduleDraftSave(); });
    on("#guideRepsInput", "input", function () { captureGuideInputToState(); scheduleDraftSave(); });
    on("#guideSetMemo", "input", function () { captureGuideInputToState(); scheduleDraftSave(); });
    ["#guideCardioDuration", "#guideCardioDistance", "#guideCardioIncline", "#guideCardioMemo"].forEach(function (selector) {
      on(selector, "input", function () { updateGuideCardioPreview(); captureGuideCardioInputToState(); scheduleDraftSave(); });
    });
    $$('[data-guide-number-target]').forEach(function (button) {
      button.addEventListener("click", function () {
        changeGuideCardioInput(button.dataset.guideNumberTarget, Number(button.dataset.guideNumberDirection));
      });
    });
    $$('[data-guide-large-target]').forEach(function (button) {
      button.addEventListener("click", function () {
        changeGuideCardioInput(button.dataset.guideLargeTarget, Number(button.dataset.guideLargeDirection), Number(button.dataset.guideLargeStep));
      });
    });
    on("#guideRirChoices", "click", function (event) {
      var button = event.target.closest("[data-guide-rir]");
      if (!button) return;
      selectedRir = button.dataset.guideRir;
      renderGuideChoices();
      captureGuideInputToState();
      scheduleDraftSave();
    });
    on("#guideRestChoices", "click", function (event) {
      var button = event.target.closest("[data-guide-rest]");
      if (!button) return;
      selectedRest = Number(button.dataset.guideRest);
      renderGuideChoices();
      captureGuideInputToState();
      scheduleDraftSave();
    });
    on("#guideRestPause", "click", pauseRestTimer);
    on("#guideRestEnd", "click", stopRestTimer);
    on("#guideMenuList", "click", function (event) {
      var button = event.target.closest("[data-guide-start-item]");
      if (!button) return;
      activateGuideItem(button.dataset.guideStartItem);
    });
  }

  function handleDraftMenuDelegatedClick(event) {
    var moveRecordButton = event.target.closest("[data-move-record]");
    if (moveRecordButton) {
      event.stopPropagation();
      moveDraftRecord(moveRecordButton.dataset.moveRecord, moveRecordButton.dataset.moveDirection);
      return true;
    }
    var deleteSetButton = event.target.closest("[data-delete-set]");
    if (deleteSetButton) {
      event.stopPropagation();
      var setTempId = deleteSetButton.dataset.deleteSet;
      askConfirm("このセットを削除しますか？", "削除する", function () { deleteDraftSet(setTempId); });
      return true;
    }
    var deleteRecordButton = event.target.closest("[data-delete-record]");
    if (deleteRecordButton) {
      event.stopPropagation();
      var exerciseIdToDelete = deleteRecordButton.dataset.deleteRecord;
      var exerciseToDelete = getExercise(exerciseIdToDelete);
      askConfirm((exerciseToDelete ? exerciseToDelete.name : "この種目") + "を今日のメニューから外しますか？", "削除する", function () { deleteDraftRecord(exerciseIdToDelete); });
      return true;
    }
    var addSetButton = event.target.closest("[data-add-set-exercise]");
    if (addSetButton) {
      event.stopPropagation();
      chooseExercise(addSetButton.dataset.addSetExercise);
      return true;
    }
    var addSameExercise = event.target.closest("[data-add-same-exercise]");
    if (addSameExercise) {
      event.stopPropagation();
      chooseExercise(addSameExercise.dataset.addSameExercise);
      return true;
    }
    var toggleExercise = event.target.closest("[data-toggle-draft-exercise]");
    if (toggleExercise) {
      event.stopPropagation();
      expandedDraftExerciseId = expandedDraftExerciseId === toggleExercise.dataset.toggleDraftExercise ? null : toggleExercise.dataset.toggleDraftExercise;
      expandedDraftCardioKey = null;
      renderSavedSets();
      renderSavedCardios();
      return true;
    }
    var toggleCardio = event.target.closest("[data-toggle-draft-cardio]");
    if (toggleCardio) {
      event.stopPropagation();
      expandedDraftCardioKey = expandedDraftCardioKey === toggleCardio.dataset.toggleDraftCardio ? null : toggleCardio.dataset.toggleDraftCardio;
      expandedDraftExerciseId = null;
      renderSavedSets();
      renderSavedCardios();
      return true;
    }
    return false;
  }

  function handleRoutineDelegatedClick(event) {
    var routineDetailButton = event.target.closest("[data-routine-detail]");
    if (routineDetailButton) { renderRoutineDetail(routineDetailButton.dataset.routineDetail); return true; }
    var routineDetailBack = event.target.closest("[data-routine-detail-back]");
    if (routineDetailBack) { renderRoutineList(); return true; }
    var useRoutineButton = event.target.closest("[data-use-routine]");
    if (useRoutineButton) { useRoutineToday(useRoutineButton.dataset.useRoutine); return true; }
    var createRoutineButton = event.target.closest("[data-create-routine]");
    if (createRoutineButton) { closeModal("routineListModal"); openRoutineCreator(false); return true; }
    var cancelRoutineButton = event.target.closest("[data-cancel-routine-editor]");
    if (cancelRoutineButton) { cancelRoutineEditor(); return true; }
    var removeRoutineExercise = event.target.closest("[data-remove-routine-exercise]");
    if (removeRoutineExercise && routineEditorState) {
      routineEditorState.exerciseIds.splice(Number(removeRoutineExercise.dataset.removeRoutineExercise), 1);
      renderRoutineEditor();
      return true;
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
      return true;
    }
    var scheduleRoutineButton = event.target.closest("[data-schedule-routine]");
    if (scheduleRoutineButton) {
      var routineDateInput = $('[data-routine-date="' + scheduleRoutineButton.dataset.scheduleRoutine + '"]');
      scheduleRoutine(scheduleRoutineButton.dataset.scheduleRoutine, routineDateInput ? routineDateInput.value : "");
      return true;
    }
    var editRoutineButton = event.target.closest("[data-edit-routine]");
    if (editRoutineButton) { editRoutine(editRoutineButton.dataset.editRoutine); return true; }
    var deleteRoutineButton = event.target.closest("[data-delete-routine]");
    if (deleteRoutineButton) {
      var routineId = deleteRoutineButton.dataset.deleteRoutine;
      askConfirm("このルーティーンを削除しますか？ 過去のトレーニング記録は削除されません。", "削除する", function () { deleteRoutine(routineId); });
      return true;
    }
    var startScheduleButton = event.target.closest("[data-start-schedule]");
    if (startScheduleButton) { startScheduledRoutine(startScheduleButton.dataset.startSchedule); return true; }
    var deleteScheduleButton = event.target.closest("[data-delete-schedule]");
    if (deleteScheduleButton) {
      var scheduleId = deleteScheduleButton.dataset.deleteSchedule;
      askConfirm("この予定を削除しますか？", "削除する", function () { deleteSchedule(scheduleId); });
      return true;
    }
    return false;
  }

  function handleSetEditDelegatedClick(event) {
    var editSetRow = event.target.closest("[data-edit-set]");
    if (editSetRow) {
      event.stopPropagation();
      startEditSet(editSetRow.dataset.editSet);
      return true;
    }
    return false;
  }

  function handleModalCloseDelegatedClick(event) {
    var close = event.target.closest("[data-close-modal]");
    if (close) {
      if (close.dataset.closeModal === "exerciseModal" && (exercisePickerMode === "routine" || exercisePickerMode === "workoutAdd" || exercisePickerMode === "guideAdd" || exercisePickerMode === "guideReplace" || exercisePickerMode === "guideStartAdd")) cancelExerciseSelection();
      else {
        if (close.dataset.closeModal === "copyConflictModal") cancelPendingConflict();
        else if (close.dataset.closeModal === "copyDestinationModal") { copySourceSessionId = null; closeModal("copyDestinationModal"); }
        else if (close.dataset.closeModal === "confirmModal") cancelConfirmModal();
        else closeModal(close.dataset.closeModal);
      }
    }
    if (close) return true;
    return false;
  }

  function handleDaySummaryDelegatedClick(event) {
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
    if (dayStart || dayRoutine || edit || copy || remove) return true;
    return false;
  }
  function bindGlobalClickEvents() {
    document.addEventListener("click", function (event) {
      if (handleDraftMenuDelegatedClick(event)) return;
      if (handleRoutineDelegatedClick(event)) return;
      if (handleSetEditDelegatedClick(event)) return;
      if (handleModalCloseDelegatedClick(event)) return;
      handleDaySummaryDelegatedClick(event);
    });
  }

  function hasKeyboardSafeFocusedElement() {
    var active = document.activeElement;
    return !!(active && active.matches && active.matches("input, textarea, select") && active.closest("#workoutScreen, #guideWorkoutScreen"));
  }

  function scrollInputCardIntoComfortView(target) {
    if (!target || !target.closest || !target.closest("#workoutScreen, #guideWorkoutScreen")) return;
    var card = target.closest("#setEditorCard, #cardioEditorCard, #guideSetCard, #guideCardioCard, .guide-input-block, .guide-details, .session-memo, .memo-field");
    var node = card || target;
    var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center"
    });
  }

  function bindKeyboardSafeFocusEvents() {
    document.addEventListener("focusin", function (event) {
      var target = event.target;
      if (!target || !target.matches || !target.matches("input, textarea, select")) return;
      if (!target.closest("#workoutScreen, #guideWorkoutScreen")) return;
      document.body.classList.add("is-keyboard-focus");
      [180, 460].forEach(function (delay) {
        setTimeout(function () {
          if (document.activeElement === target) scrollInputCardIntoComfortView(target);
        }, delay);
      });
    });
    document.addEventListener("focusout", function () {
      setTimeout(function () {
        if (!hasKeyboardSafeFocusedElement()) document.body.classList.remove("is-keyboard-focus");
      }, 90);
    });
  }

  function bindConfirmAndKeyboardEvents() {
    on("#confirmCancel", "click", cancelConfirmModal);
    on("#confirmAccept", "click", function () { acceptConfirmModal(this); });
    bindKeyboardSafeFocusEvents();
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var open = $$(".modal.is-open");
      if (!open.length) return;
      if (open[open.length - 1].id === "exerciseModal" && (exercisePickerMode === "routine" || exercisePickerMode === "guideAdd" || exercisePickerMode === "guideReplace" || exercisePickerMode === "guideStartAdd")) cancelExerciseSelection();
      else if (open[open.length - 1].id === "nextSetConfirmModal") closeNextSetInput();
      else if (open[open.length - 1].id === "copyConflictModal") cancelPendingConflict();
      else if (open[open.length - 1].id === "copyDestinationModal") { copySourceSessionId = null; closeModal("copyDestinationModal"); }
      else if (open[open.length - 1].id === "confirmModal") cancelConfirmModal();
      else if (open[open.length - 1].id === "dataRecoveryModal" || open[open.length - 1].id === "draftResumeModal") return;
      else closeModal(open[open.length - 1].id);
    });
  }
  function bindEvents() {
    if (window.addEventListener) window.addEventListener("resize", fitMonthlySummaryMetrics);
    bindHomeMenuEvents();
    bindAppearanceEvents();
    bindSettingsDataEvents();
    bindProgressEvents();
    bindRoutineEvents();
    bindCalendarAndCopyEvents();
    bindProfileEvents();
    bindWorkoutEditorEvents();
    bindCardioEvents();
    bindRestTimerEvents();
    bindGuideModeEvents();
    bindGlobalClickEvents();
    bindConfirmAndKeyboardEvents();
  }

  function changeWeightByStep(direction, step) {
    var exercise = getExercise(selectedExerciseId);
    if (!exercise || exercise.category === "BODYWEIGHT") return;
    step = Number(step || 1);
    var input = $("#weightInput");
    var current = getNumericInputValue(input);
    var value = Math.max(0, current + direction * step);
    input.value = (Math.round(value * 10) / 10).toFixed(1);
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
  function createTestApi() {
    var api = {
      normalizeSearchText: normalizeSearchText,
      sortExerciseList: sortExerciseListForTest,
      filterExerciseList: filterExerciseListForTest,
      moveArrayItem: moveArrayItem,
      estimatedOneRm: estimatedOneRm,
      calculateRestTimerRemaining: calculateRestTimerRemaining,
      evaluatePersonalBestFromSets: evaluatePersonalBestFromSets
    };
    if (!window.__GYMLOG_TEST_MODE) return api;
    return Object.assign(api, {
      normalizeUiSettings: normalizeUiSettings,
      applyUiSettings: applyUiSettings,
      getUiSettings: function () { return uiSettings; },
      isRestTimerEnabled: isRestTimerEnabled,
      isGuideModeEnabled: isGuideModeEnabled,
      shouldShowGuideModeActions: shouldShowGuideModeActions,
      startRestTimer: startRestTimer,
      stopRestTimer: stopRestTimer,
      getRestTimerState: function () { return restTimerState; },
      skipCurrentGuideItem: skipCurrentGuideItem,
      undoLastGuideAction: undoLastGuideAction,
      migrateDataToCurrentVersion: migrateDataToCurrentVersion,
      validateCurrentData: validateCurrentData,
      validateBackupData: validateBackupData,
      normalizeBackupData: normalizeBackupData,
      getMonthlySummary: getMonthlySummary,
      calculateStrengthCaloriesForRecords: calculateStrengthCaloriesForRecords,
      calculateDraftStrengthVolume: calculateDraftStrengthVolume,
      calculateCardio: calculateCardio,
      getAiExportDateRange: getAiExportDateRange,
      buildAiExportText: buildAiExportText,
      savePreRestoreSnapshot: savePreRestoreSnapshot,
      applyPendingRestore: applyPendingRestore,
      blankData: blankData,
      hasMeaningfulDraftContent: hasMeaningfulDraftContent,
      saveDraftNow: saveDraftNow,
      resumeSavedDraft: resumeSavedDraft,
      captureEditorState: captureEditorState,
      runDataTransaction: runDataTransaction,
      renderDaySummary: renderDaySummary,
      saveWorkout: saveWorkout,
      requestWorkoutSave: requestWorkoutSave,
      commitWorkoutSave: commitWorkoutSave,
      saveCurrentSet: saveCurrentSet,
      showNextSetConfirmation: showNextSetConfirmation,
      startConfirmedNextSet: startConfirmedNextSet,
      chooseNextExerciseAfterSet: chooseNextExerciseAfterSet,
      closeNextSetInput: closeNextSetInput,
      getNextSetActionState: function () { return nextSetActionState; },
      getExerciseWeightStep: getExerciseWeightStep,
      resolveCopyConflict: resolveCopyConflict,
      handleConflictModalAction: handleConflictModalAction,
      handleConflictModalCancel: handleConflictModalCancel,
      draftFromRoutine: draftFromRoutine,
      chooseExercise: chooseExercise,
      deleteDraftRecord: deleteDraftRecord,
      deletePendingCardioType: deletePendingCardioType,
      rebuildDataIndexes: rebuildDataIndexes,
      setData: function (value) { data = value; rebuildDataIndexes(); },
      getData: function () { return data; },
      setDraft: function (value) { draft = value; },
      getDraft: function () { return draft; },
      setPendingRestore: function (value) { pendingRestoreData = value; },
      setPendingSavedDraft: function (value) { pendingSavedDraft = value; },
      setEditor: function (value) {
        value = value || {};
        selectedExerciseId = value.selectedExerciseId || null;
        editingSetTempId = value.editingSetTempId || null;
        isAddingSet = !!value.isAddingSet;
        editingCardioTempId = value.editingCardioTempId || null;
        selectedRir = value.selectedRir == null ? null : value.selectedRir;
        selectedRest = value.selectedRest || 90;
      },
      getEditor: function () {
        return {
          selectedExerciseId: selectedExerciseId,
          editingSetTempId: editingSetTempId,
          isAddingSet: isAddingSet,
          editingCardioTempId: editingCardioTempId,
          selectedRir: selectedRir,
          selectedRest: selectedRest
        };
      },
      getPendingConflict: function () { return pendingSaveConflict || pendingCopyConflict; },
      getPendingCopyConflict: function () { return pendingCopyConflict; },
      getPendingSaveConflict: function () { return pendingSaveConflict; },
      getRecoveryState: function () { return { required: dataRecoveryRequired, raw: corruptDataRaw, key: corruptDataKey }; }
    });
  }

  window.GymLog.__test__ = createTestApi();
  if (window.__GYMLOG_TEST_MODE) window.__test = window.GymLog.__test__;

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

  if (!window.__GYMLOG_SKIP_INIT) initializeApp();
})();
