(function () {
  "use strict";

  var STORAGE_KEY = "gymlog-data-v1";
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
    return { version: 1, profile: null, exercises: seedExercises(), sessions: [], records: [], sets: [], cardios: [], recentExerciseIds: [], routines: [], scheduledRoutines: [] };
  }

  function loadData() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return blankData();
      var parsed = JSON.parse(saved);
      var base = blankData();
      Object.keys(base).forEach(function (key) {
        if (typeof parsed[key] !== "undefined") base[key] = parsed[key];
      });
      base.exercises = migrateExercises(base.exercises);
      return base;
    } catch (error) {
      return blankData();
    }
  }

  var data = loadData();
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
  var progressState = { tab: "strength", exerciseId: null, cardioType: "ウォーキング", metric: "maxWeight" };
  var toastTimer = null;
  var confirmCallback = null;
  var copySourceSessionId = null;
  var routineEditingId = null;
  var routineEditorState = null;
  var routinePendingExerciseIds = [];
  var routineTargetDate = null;
  var routineListMode = "use";

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      showToast("保存できませんでした。ブラウザの保存設定を確認してください");
      return false;
    }
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

  function askConfirm(message, actionLabel, callback) {
    $("#confirmMessage").textContent = message;
    $("#confirmAccept").textContent = actionLabel || "削除する";
    confirmCallback = callback;
    openModal("confirmModal");
  }

  function getExercise(id) { return data.exercises.find(function (exercise) { return exercise.id === id; }); }
  function getSessionRecords(sessionId) {
    return data.records.filter(function (record) { return record.sessionId === sessionId; }).sort(function (a, b) { return a.orderIndex - b.orderIndex; });
  }
  function getRecordSets(recordId) {
    return data.sets.filter(function (set) { return set.recordId === recordId; }).sort(function (a, b) { return a.setNumber - b.setNumber; });
  }
  function getSessionCardios(sessionId) { return data.cardios.filter(function (cardio) { return cardio.sessionId === sessionId; }); }
  function profileWeight() { return data.profile && Number(data.profile.weightKg) > 0 ? Number(data.profile.weightKg) : 60; }

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
    var allSets = [];
    draft.records.forEach(function (record) { allSets = allSets.concat(record.sets); });
    var cardioCalories = draft.cardios.reduce(function (sum, cardio) { return sum + calculateCardio(cardio).calories; }, 0);
    return calculateStrengthCalories(allSets) + cardioCalories;
  }

  function getMonthlySummary(year, month) {
    var prefix = year + "-" + String(month + 1).padStart(2, "0");
    var monthSessions = data.sessions.filter(function (session) { return session.date.indexOf(prefix) === 0; });
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
      strengthCalories += calculateStrengthCalories(sets);
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
      totalVisits: monthSessions.length,
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
    $("#monthlyVisits").textContent = summary.totalVisits;
    $("#monthlyGymVisits").textContent = summary.gymVisits;
    $("#monthlyHomeVisits").textContent = summary.homeVisits;
    $("#monthlyCalories").textContent = Math.round(summary.totalCalories).toLocaleString("ja-JP");
    $("#monthlyStrengthCalories").textContent = Math.round(summary.strengthCalories).toLocaleString("ja-JP");
    $("#monthlyCardioCalories").textContent = Math.round(summary.cardioCalories).toLocaleString("ja-JP");
    $("#monthlyTotalVolume").textContent = formatVolume(summary.totalStrengthVolumeKg);
    $("#monthlyUpperVolume").textContent = formatVolume(summary.upperBodyVolumeKg);
    $("#monthlyLowerVolume").textContent = formatVolume(summary.lowerBodyVolumeKg);
    $("#monthlyCardioDistance").textContent = summary.cardioDistanceKm.toFixed(1);
    $("#monthlySummaryLabel").textContent = monthLabel + " 運動";
    $("#monthlyCaloriesLabel").textContent = monthLabel + " カロリー";
    $("#monthlyVolumeLabel").textContent = monthLabel + " ボリューム";
  }

  function renderHome() {
    renderMonthlySummary();
    renderCalendar();
  }

  function getSessionsForDate(dateValue) {
    return data.sessions.filter(function (session) { return session.date === dateValue; }).sort(function (a, b) {
      return String(b.createdAt || b.updatedAt || "").localeCompare(String(a.createdAt || a.updatedAt || ""));
    });
  }

  function exerciseSetSummary(exercise, sets) {
    return sets.map(function (set) {
      var weight = exercise && exercise.category === "BODYWEIGHT" ? "自重" : (Number(set.weight || 0) / 1000).toFixed(1) + "kg";
      return weight + " × " + Number(set.reps || 0) + "回";
    }).join(" / ");
  }

  function cardioExerciseId(type) {
    var normalizedType = type === "傾斜ウォーク" ? "ウォーキング" : type;
    var exercise = data.exercises.find(function (item) { return item.category === "CARDIO" && item.name === normalizedType; });
    return exercise ? exercise.id : "";
  }

  function renderHomeTodayMenu() {
    var list = $("#homeTodayMenuList");
    if (!list) return;
    var sessions = getSessionsForDate(todayString());
    if (!sessions.length) {
      list.innerHTML = '<div class="home-menu-empty"><p>今日のメニューはまだありません</p><div class="home-menu-empty-actions"><button type="button" data-home-empty-add>種目を追加</button><button type="button" data-copy-latest-menu>過去メニューからコピー</button></div><small>前回のメニューをコピーすると、すぐ記録を始められます。</small></div>';
      return;
    }
    list.innerHTML = sessions.map(function (session) {
      var rows = [];
      getSessionRecords(session.id).forEach(function (record) {
        var exercise = getExercise(record.exerciseId);
        var sets = getRecordSets(record.id);
        if (!exercise || !sets.length) return;
        rows.push('<button class="home-menu-exercise" type="button" data-home-session="' + session.id + '" data-home-exercise="' + exercise.id + '"><span><strong>' + escapeHtml(exercise.name) + '</strong><small>' + escapeHtml(exerciseSetSummary(exercise, sets)) + '</small></span><span class="home-menu-add-cue">セットを追加</span></button>');
      });
      getSessionCardios(session.id).forEach(function (cardio) {
        var exerciseId = cardioExerciseId(cardio.type);
        var detail = Number(cardio.durationMinutes || 0) + "分" + (Number(cardio.distanceKm || 0) > 0 ? " / " + formatNumberForInput(Number(cardio.distanceKm), 0.1) + "km" : "") + (Number(cardio.inclinePercent || 0) > 0 ? " / 傾斜" + formatNumberForInput(Number(cardio.inclinePercent), 0.5) + "%" : "");
        rows.push('<button class="home-menu-exercise" type="button" data-home-session="' + session.id + '" data-home-exercise="' + exerciseId + '"><span><strong>' + escapeHtml(cardio.type) + '</strong><small>' + escapeHtml(detail) + '</small></span><span class="home-menu-add-cue">記録を追加</span></button>');
      });
      return '<article class="home-menu-session"><div class="home-menu-session-head"><b>' + (session.locationType === "home" ? "自宅トレーニング" : "ジムトレーニング") + '</b><span>' + Math.round(Number(session.totalCalories || 0)) + 'kcal</span></div>' + rows.join("") + '</article>';
    }).join("");
  }

  function startAddingExerciseToToday() {
    var sessions = getSessionsForDate(todayString());
    if (sessions.length) loadDraft(sessions[0].id);
    else {
      var recentSession = data.sessions.slice().sort(function (a, b) { return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")); })[0];
      newDraft(recentSession ? recentSession.locationType : "gym", todayString());
    }
    openExercisePicker();
  }

  function addExerciseToSavedSession(sessionId, exerciseId) {
    if (!sessionId || !exerciseId || !getExercise(exerciseId)) return;
    loadDraft(sessionId);
    chooseExercise(exerciseId);
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
    var routine = data.routines.find(function (item) { return item.id === routineId; });
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

  function addExerciseToRoutine(exerciseId) {
    if (!routineEditorState || !getExercise(exerciseId)) return;
    if (routineEditorState.exerciseIds.indexOf(exerciseId) >= 0) {
      showToast("この種目は追加済みです");
      return;
    }
    routineEditorState.exerciseIds.push(exerciseId);
    renderRoutineEditor();
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
    if (existingIndex >= 0) data.routines[existingIndex] = routine;
    else data.routines.push(routine);
    var wasEditing = !!existing;
    routineEditingId = null;
    routineEditorState = null;
    persist();
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
    draft = { id: null, date: dateValue, locationType: routine.locationType, memo: "", records: [], cardios: [], pendingCardioTypes: [], createdAt: nowIso(), sourceScheduleId: scheduleId || null };
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
  }

  function useRoutineToday(routineId) {
    var routine = data.routines.find(function (item) { return item.id === routineId; });
    if (!routine) return;
    routineEditingId = null;
    draftFromRoutine(routine, routineTargetDate || todayString(), null);
    showToast("ルーティーンを追加しました。保存するまで記録には反映されません");
  }

  function editRoutine(routineId) {
    openRoutineEditor(routineId);
  }

  function scheduleRoutine(routineId, dateValue) {
    var routine = data.routines.find(function (item) { return item.id === routineId; });
    if (!routine || !dateValue) { showToast("追加先の日付を選んでください"); return; }
    var existing = data.scheduledRoutines.find(function (schedule) { return schedule.routineId === routineId && schedule.date === dateValue; });
    if (!existing) {
      var stamp = nowIso();
      data.scheduledRoutines.push({ id: makeId("schedule"), routineId: routineId, date: dateValue, createdAt: stamp, updatedAt: stamp });
      persist();
    }
    renderCalendar();
    renderRoutineList();
    showToast("ルーティーンを予定に追加しました。実施して保存するまで記録には反映されません");
  }

  function startScheduledRoutine(scheduleId) {
    var schedule = data.scheduledRoutines.find(function (item) { return item.id === scheduleId; });
    if (!schedule) return;
    var routine = data.routines.find(function (item) { return item.id === schedule.routineId; });
    if (!routine) return;
    routineEditingId = null;
    draftFromRoutine(routine, schedule.date, schedule.id);
  }

  function deleteSchedule(scheduleId) {
    data.scheduledRoutines = data.scheduledRoutines.filter(function (item) { return item.id !== scheduleId; });
    persist();
    closeModal("dayModal");
    renderHome();
    showToast("予定を削除しました");
  }

  function deleteRoutine(routineId) {
    data.routines = data.routines.filter(function (routine) { return routine.id !== routineId; });
    persist();
    renderRoutineList();
    renderHome();
    showToast("ルーティーンを削除しました");
  }

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
      var daySessions = data.sessions.filter(function (session) { return session.date === dateValue; });
      var hasSchedule = data.scheduledRoutines.some(function (schedule) {
        return schedule.date === dateValue && data.routines.some(function (routine) { return routine.id === schedule.routineId; });
      });
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

  function getStrengthProgress(exerciseId, metric) {
    var daily = {};
    data.sessions.forEach(function (session) {
      getSessionRecords(session.id).forEach(function (record) {
        if (record.exerciseId !== exerciseId) return;
        var sets = getRecordSets(record.id);
        if (!sets.length) return;
        if (!daily[session.date]) daily[session.date] = [];
        daily[session.date] = daily[session.date].concat(sets);
      });
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
    data.sessions.forEach(function (session) {
      getSessionCardios(session.id).forEach(function (cardio) {
        var normalizedType = cardio.type === "傾斜ウォーク" ? "ウォーキング" : cardio.type;
        if (normalizedType !== cardioType) return;
        if (!daily[session.date]) daily[session.date] = { distance: 0, duration: 0, calories: 0 };
        daily[session.date].distance += Number(cardio.distanceKm || 0);
        daily[session.date].duration += Number(cardio.durationMinutes || 0);
        var storedCalories = Number(cardio.calories);
        daily[session.date].calories += Number.isFinite(storedCalories) ? storedCalories : calculateCardio(cardio).calories;
      });
    });
    return Object.keys(daily).sort().map(function (date) {
      var totals = daily[date];
      var speed = totals.duration > 0 ? totals.distance / (totals.duration / 60) : 0;
      var values = { distance: totals.distance, duration: totals.duration, speed: speed, calories: totals.calories };
      return { date: date, value: values[metric] || 0 };
    });
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
  }

  function newDraft(locationType, date) {
    routineEditingId = null;
    draft = { id: null, date: date || todayString(), locationType: locationType, memo: "", records: [], cardios: [], createdAt: nowIso() };
    selectedExerciseId = null;
    selectedRir = null;
    selectedRest = 90;
    editingSetTempId = null;
    isAddingSet = false;
    resetCardioForm();
    renderWorkout();
    showScreen("workout");
  }

  function loadDraft(sessionId) {
    var session = data.sessions.find(function (item) { return item.id === sessionId; });
    if (!session) return;
    routineEditingId = null;
    draft = {
      id: session.id,
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
  }

  function openCopyDestination(sessionId) {
    var source = data.sessions.find(function (session) { return session.id === sessionId; });
    if (!source) return;
    copySourceSessionId = sessionId;
    $("#copySourceLabel").textContent = formatDateJa(source.date) + "のメニューをコピーします。";
    $("#copyTargetDate").value = todayString();
    $("#copyTodayLabel").textContent = formatDateJa(todayString());
    closeModal("dayModal");
    openModal("copyDestinationModal");
  }

  function copySessionToDate(sessionId, targetDate) {
    var source = data.sessions.find(function (item) { return item.id === sessionId; });
    if (!source || !targetDate) return;
    routineEditingId = null;
    draft = { id: null, date: targetDate, locationType: source.locationType, memo: "", records: [], cardios: [], createdAt: nowIso() };
    var sourceRecords = getSessionRecords(sessionId);
    sourceRecords.forEach(function (record, index) {
      var previousSets = getRecordSets(record.id);
      if (!previousSets.length) return;
      draft.records.push({
          tempId: makeId("draftrecord"), exerciseId: record.exerciseId, orderIndex: index,
          sets: previousSets.map(function (previous, setIndex) {
            return { tempId: makeId("draftset"), setNumber: setIndex + 1, weight: previous.weight, reps: previous.reps, rir: previous.rir || "", restSeconds: previous.restSeconds, memo: previous.memo || "" };
          })
      });
    });
    draft.cardios = getSessionCardios(sessionId).map(function (sourceCardio) {
      var copiedCardio = {
        tempId: makeId("draftcardio"),
        type: sourceCardio.type,
        durationMinutes: Number(sourceCardio.durationMinutes || 0),
        distanceKm: Number(sourceCardio.distanceKm || 0),
        inclinePercent: Number(sourceCardio.inclinePercent || 0),
        memo: sourceCardio.memo || ""
      };
      var result = calculateCardio(copiedCardio);
      copiedCardio.speedKmh = result.speedKmh;
      copiedCardio.calories = result.calories;
      return copiedCardio;
    });
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
    showToast("メニューをコピーしました。保存するまで記録には反映されません");
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

  function currentDraftRecord() {
    if (!draft || !selectedExerciseId) return null;
    return draft.records.find(function (record) { return record.exerciseId === selectedExerciseId; });
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
    var records = data.records.filter(function (record) { return record.exerciseId === exerciseId; }).sort(function (a, b) {
      var sessionA = data.sessions.find(function (session) { return session.id === a.sessionId; }) || {};
      var sessionB = data.sessions.find(function (session) { return session.id === b.sessionId; }) || {};
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
    $("#setSaveHint").textContent = editingRef ? "このセットを上書きします" : "保存後、次のセットへ進みます";
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

  function saveCurrentSet() {
    var exercise = getExercise(selectedExerciseId);
    if (!exercise) return;
    if (!editingSetTempId && !isAddingSet) return;
    var reps = Math.round(numberValue("#repsInput"));
    if (reps < 1) { showToast("回数を入力してください"); $("#repsInput").focus(); return; }
    var weightKg = exercise.category === "BODYWEIGHT" ? 0 : Math.max(0, numberValue("#weightInput"));
    var setValues = {
      weight: Math.round(weightKg * 1000),
      reps: reps,
      rir: selectedRir == null ? "" : selectedRir,
      restSeconds: selectedRest,
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
      editingSetTempId = null;
      isAddingSet = false;
      selectedExerciseId = null;
      renderSelectedExercise();
      renderSavedSets();
      updateDraftCalories();
      showToast("セットを更新しました");
      return;
    }
    editingSetTempId = null;
    var record = ensureDraftRecord(exercise.id);
    record.sets.push({
      tempId: makeId("draftset"), setNumber: record.sets.length + 1, weight: setValues.weight, reps: setValues.reps,
      rir: setValues.rir, restSeconds: setValues.restSeconds, memo: setValues.memo
    });
    renderSelectedExercise();
    renderSavedSets();
    updateDraftCalories();
    showToast("セット" + record.sets.length + "を保存しました");
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
  }

  function saveCardio() {
    var cardio = cardioFormValue();
    if (cardio.durationMinutes < 1) { showToast("運動時間を入力してください"); $("#cardioDuration").focus(); return; }
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
  }

  function updateDraftCalories() { $("#sessionCalories").textContent = Math.round(draftCalories()); }

  function saveWorkout() {
    if (!draft) return;
    var setCount = draft.records.reduce(function (sum, record) { return sum + record.sets.length; }, 0);
    if (!setCount && !draft.cardios.length) { showToast("セットまたは有酸素運動を1件以上記録してください"); return; }
    draft.date = $("#sessionDate").value || todayString();
    draft.memo = $("#sessionMemo").value.trim();
    var stamp = nowIso();
    var sessionId = draft.id || makeId("session");
    var oldSession = data.sessions.find(function (session) { return session.id === sessionId; });
    if (oldSession) {
      var oldRecordIds = data.records.filter(function (record) { return record.sessionId === sessionId; }).map(function (record) { return record.id; });
      data.sets = data.sets.filter(function (set) { return oldRecordIds.indexOf(set.recordId) < 0; });
      data.records = data.records.filter(function (record) { return record.sessionId !== sessionId; });
      data.cardios = data.cardios.filter(function (cardio) { return cardio.sessionId !== sessionId; });
      data.sessions = data.sessions.filter(function (session) { return session.id !== sessionId; });
    }
    var allSetsForCalories = [];
    var validRecords = draft.records.filter(function (record) { return record.sets.length > 0; });
    validRecords.forEach(function (record, recordIndex) {
      var recordId = makeId("record");
      data.records.push({ id: recordId, sessionId: sessionId, exerciseId: record.exerciseId, orderIndex: recordIndex, createdAt: stamp, updatedAt: stamp });
      record.sets.forEach(function (set, setIndex) {
        var storedSet = { id: makeId("set"), recordId: recordId, setNumber: setIndex + 1, weight: Math.round(Number(set.weight || 0)), reps: Number(set.reps), rir: set.rir || "", restSeconds: Number(set.restSeconds || 90), memo: set.memo || "", createdAt: stamp, updatedAt: stamp };
        data.sets.push(storedSet);
        allSetsForCalories.push(storedSet);
      });
    });
    var cardioTotal = 0;
    draft.cardios.forEach(function (cardio) {
      var result = calculateCardio(cardio);
      cardioTotal += result.calories;
      data.cardios.push({ id: makeId("cardio"), sessionId: sessionId, type: cardio.type, distanceKm: Number(cardio.distanceKm || 0), durationMinutes: Number(cardio.durationMinutes), speedKmh: result.speedKmh, inclinePercent: Number(cardio.inclinePercent || 0), calories: result.calories, memo: cardio.memo || "", createdAt: stamp, updatedAt: stamp });
    });
    var totalCalories = calculateStrengthCalories(allSetsForCalories) + cardioTotal;
    data.sessions.push({ id: sessionId, date: draft.date, locationType: draft.locationType, totalCalories: totalCalories, memo: draft.memo, createdAt: oldSession ? oldSession.createdAt : stamp, updatedAt: stamp });
    if (draft.sourceScheduleId) data.scheduledRoutines = data.scheduledRoutines.filter(function (schedule) { return schedule.id !== draft.sourceScheduleId; });
    var usedExerciseIds = validRecords.map(function (record) { return record.exerciseId; });
    data.recentExerciseIds = usedExerciseIds.concat(data.recentExerciseIds.filter(function (id) { return usedExerciseIds.indexOf(id) < 0; })).slice(0, 12);
    if (!persist()) return;
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
      var dayTotal = sessions.reduce(function (sum, session) { return sum + Number(session.totalCalories || 0); }, 0);
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
      var sessionEditButton = sessions.length > 1 ? '<button class="summary-session-edit" type="button" data-edit-session="' + session.id + '">編集</button>' : '';
      html += '<section class="summary-session"><div class="summary-session-head"><strong>' + (session.locationType === "gym" ? "ジムトレーニング" : "自宅トレーニング") + '</strong><div class="summary-session-head-actions"><span>' + Math.round(session.totalCalories || 0) + ' kcal</span>' + sessionEditButton + '</div></div><div class="summary-lines">' + (lines.length ? lines.join("") : '<div class="summary-line"><span>記録内容なし</span></div>') + '</div></section>';
    });
    if (schedules.length) html += '<p class="day-section-label day-section-label--planned">予定メニュー</p>';
    schedules.forEach(function (schedule) {
      var routine = data.routines.find(function (item) { return item.id === schedule.routineId; });
      if (!routine) return;
      html += '<article class="planned-routine"><div><strong>' + escapeHtml(routine.name) + '</strong><small>' + (routine.locationType === "home" ? "自宅" : "ジム") + '・' + routineItemCount(routine) + '種目</small></div><button type="button" data-start-schedule="' + schedule.id + '">この予定で記録を始める</button><button type="button" data-delete-schedule="' + schedule.id + '">予定を削除</button></article>';
    });
    $("#daySummaryContent").innerHTML = html;
    if (sessions.length) {
      var latest = sessions[0];
      var editAction = sessions.length === 1 ? '<button class="outline-button" type="button" data-edit-session="' + latest.id + '">編集</button>' : '';
      $("#daySummaryActions").innerHTML = '<button class="finish-button" type="button" data-copy-session="' + latest.id + '">この内容で開始</button><div class="secondary-actions' + (sessions.length > 1 ? ' secondary-actions--single' : '') + '">' + editAction + '<button class="outline-button danger-text" type="button" data-delete-session="' + latest.id + '">削除</button></div><button class="outline-button" type="button" data-close-modal="dayModal">閉じる</button>';
    } else {
      $("#daySummaryActions").innerHTML = '<button class="finish-button" type="button" data-day-start="gym" data-day-date="' + dateValue + '">ジムトレーニングを記録</button><button class="outline-button" type="button" data-day-start="home" data-day-date="' + dateValue + '">自宅トレーニングを記録</button><button class="outline-button outline-button--blue" type="button" data-day-routine-date="' + dateValue + '">ルーティーンから登録</button><button class="outline-button" type="button" data-close-modal="dayModal">閉じる</button>';
    }
    openModal("dayModal");
  }

  function deleteSession(sessionId) {
    var recordIds = data.records.filter(function (record) { return record.sessionId === sessionId; }).map(function (record) { return record.id; });
    data.sets = data.sets.filter(function (set) { return recordIds.indexOf(set.recordId) < 0; });
    data.records = data.records.filter(function (record) { return record.sessionId !== sessionId; });
    data.cardios = data.cardios.filter(function (cardio) { return cardio.sessionId !== sessionId; });
    data.sessions = data.sessions.filter(function (session) { return session.id !== sessionId; });
    persist();
    closeModal("dayModal");
    renderHome();
    showToast("記録を削除しました");
  }

  function bindEvents() {
    $("#homeSettingsButton").addEventListener("click", function () { openModal("settingsMenuModal"); });
    $("#homeRoutineCreateButton").addEventListener("click", function () { openRoutineCreator(false); });
    $("#homeGymStartButton").addEventListener("click", function () { newDraft("gym", todayString()); });
    $("#homeHomeStartButton").addEventListener("click", function () { newDraft("home", todayString()); });
    $("#settingsProfileButton").addEventListener("click", function () { closeModal("settingsMenuModal"); openProfile(); });
    $("#settingsRoutineButton").addEventListener("click", function () { closeModal("settingsMenuModal"); openRoutineList(todayString(), "manage"); });
    $("#openProgressButton").addEventListener("click", openProgressPage);
    $("#backFromProgressButton").addEventListener("click", function () { renderHome(); showScreen("home"); });
    $$('[data-progress-tab]').forEach(function (button) {
      button.addEventListener("click", function () {
        progressState.tab = button.dataset.progressTab;
        progressState.metric = progressState.tab === "strength" ? "maxWeight" : "distance";
        renderProgressPage();
      });
    });
    $("#progressExerciseSelect").addEventListener("change", function () {
      if (progressState.tab === "strength") progressState.exerciseId = this.value;
      else progressState.cardioType = this.value;
      renderProgressPage();
    });
    $("#progressMetricSelect").addEventListener("change", function () { progressState.metric = this.value; renderProgressPage(); });
    $("#progressChart").addEventListener("pointerover", function (event) {
      var point = event.target.closest("[data-chart-point]");
      if (point) showProgressChartTooltip(point);
    });
    $("#progressChart").addEventListener("pointerout", function (event) {
      var point = event.target.closest("[data-chart-point]");
      if (point) hideProgressChartTooltip();
    });
    $("#progressChart").addEventListener("click", function (event) {
      var point = event.target.closest("[data-chart-point]");
      if (point) { event.stopPropagation(); showProgressChartTooltip(point); }
      else hideProgressChartTooltip();
    });
    $("#progressChart").addEventListener("focusin", function (event) {
      var point = event.target.closest("[data-chart-point]");
      if (point) showProgressChartTooltip(point);
    });
    $("#progressChart").addEventListener("focusout", hideProgressChartTooltip);
    $("#openRoutineListButton").addEventListener("click", function () { openRoutineList(draft ? draft.date : todayString(), "use"); });
    $("#saveRoutineButton").addEventListener("click", openRoutineSaveModal);
    $("#confirmRoutineSave").addEventListener("click", saveRoutineFromDraft);
    $("#routineAddExerciseButton").addEventListener("click", openRoutineExercisePicker);
    $("#routineNameInput").addEventListener("input", function () { if (routineEditorState) routineEditorState.name = this.value; });
    $("#routineLocationType").addEventListener("change", function () { if (routineEditorState) routineEditorState.locationType = this.value === "home" ? "home" : "gym"; });
    $("#emptyAddExerciseButton").addEventListener("click", openExercisePicker);
    $("#emptyCopyPastButton").addEventListener("click", copyLatestPastMenu);
    $("#prevMonth").addEventListener("click", function () { calendarCursor.setMonth(calendarCursor.getMonth() - 1); renderHome(); });
    $("#nextMonth").addEventListener("click", function () { calendarCursor.setMonth(calendarCursor.getMonth() + 1); renderHome(); });
    $("#todayMonth").addEventListener("click", function () { calendarCursor = new Date(); calendarCursor.setDate(1); renderHome(); });
    $("#calendarGrid").addEventListener("click", function (event) { var button = event.target.closest("[data-calendar-date]"); if (button) renderDaySummary(button.dataset.calendarDate); });
    $("#copyToTodayButton").addEventListener("click", function () {
      if (copySourceSessionId) copySessionToDate(copySourceSessionId, todayString());
    });
    $("#copyToSelectedDateButton").addEventListener("click", function () {
      var targetDate = $("#copyTargetDate").value;
      if (!targetDate) { showToast("コピー先の日付を選んでください"); $("#copyTargetDate").focus(); return; }
      if (copySourceSessionId) copySessionToDate(copySourceSessionId, targetDate);
    });

    $("#profileForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var stamp = nowIso();
      var old = data.profile || {};
      data.profile = { id: old.id || makeId("profile"), weightKg: numberValue("#profileWeight"), heightCm: numberValue("#profileHeight"), age: Math.round(numberValue("#profileAge")), gender: $("#profileGender").value, createdAt: old.createdAt || stamp, updatedAt: stamp };
      persist(); closeModal("profileModal"); renderHome(); if (draft) updateDraftCalories(); showToast("プロフィールを保存しました");
    });
    $("#resetDataButton").addEventListener("click", function () {
      askConfirm("プロフィールとすべてのトレーニング記録を削除します。この操作は元に戻せません。", "すべて削除", function () {
        data = blankData(); persist(); closeModal("profileModal"); renderHome(); showToast("すべてのデータを削除しました");
      });
    });

    $("#backHomeButton").addEventListener("click", function () { draft = null; routineEditingId = null; renderHome(); showScreen("home"); });
    $("#finishTopButton").addEventListener("click", saveWorkout);
    $("#finishWorkoutButton").addEventListener("click", saveWorkout);
    $("#sessionDate").addEventListener("change", function () { if (draft) draft.date = this.value; });
    $("#sessionMemo").addEventListener("input", function () { if (draft) draft.memo = this.value; });
    $("#exercisePickerButton").addEventListener("click", openExercisePicker);
    $("#chooseAnotherExercise").addEventListener("click", openExercisePicker);
    $("#cancelExerciseSelection").addEventListener("click", cancelExerciseSelection);
    $("#confirmExerciseSelection").addEventListener("click", confirmExerciseSelection);
    $("#exerciseBodyPartTabs").addEventListener("click", function (event) {
      var tab = event.target.closest("[data-body-part]");
      if (!tab) return;
      activeExerciseBodyPart = tab.dataset.bodyPart;
      renderExerciseBodyPartTabs();
      renderExerciseList();
    });
    $("#exerciseList").addEventListener("click", function (event) {
      var favorite = event.target.closest("[data-favorite-id]");
      if (favorite) {
        event.stopPropagation();
        var exercise = getExercise(favorite.dataset.favoriteId);
        if (exercise) { exercise.isFavorite = !exercise.isFavorite; exercise.updatedAt = nowIso(); persist(); renderExerciseList(); }
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
    $("#openAddExercise").addEventListener("click", function () {
      if (exercisePickerMode !== "routine") closeModal("exerciseModal");
      $("#newExerciseName").value = "";
      $("#newExerciseBodyPart").value = activeExerciseBodyPart === "cardio" ? "other" : activeExerciseBodyPart;
      openModal("addExerciseModal");
    });
    $("#addExerciseForm").addEventListener("submit", function (event) {
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
      data.exercises.push(exercise); persist(); closeModal("addExerciseModal");
      if (exercisePickerMode === "routine") {
        routinePendingExerciseIds.push(exercise.id);
        renderExerciseList();
      } else chooseExercise(exercise.id);
      showToast("新しい種目を追加しました");
    });

    $("#weightMinus").addEventListener("click", function () { changeWeight(-1); });
    $("#weightPlus").addEventListener("click", function () { changeWeight(1); });
    $("#weightMinusLarge").addEventListener("click", function () { changeWeightLarge(-1); });
    $("#weightPlusLarge").addEventListener("click", function () { changeWeightLarge(1); });
    $("#repsMinus").addEventListener("click", function () { changeReps(-1); });
    $("#repsPlus").addEventListener("click", function () { changeReps(1); });
    $("#repsMinusLarge").addEventListener("click", function () { changeRepsLarge(-1); });
    $("#repsPlusLarge").addEventListener("click", function () { changeRepsLarge(1); });
    $("#weightInput").addEventListener("focus", function () {
      if (getNumericInputValue(this) === 0) this.value = "";
    });
    $("#weightInput").addEventListener("blur", formatWeightInput);
    $("#repsQuick").addEventListener("click", function (event) { var button = event.target.closest("[data-reps]"); if (!button) return; $("#repsInput").value = button.dataset.reps; renderSetChoices(); });
    $("#repsInput").addEventListener("input", renderSetChoices);
    $("#rirChoices").addEventListener("click", function (event) { var button = event.target.closest("[data-rir]"); if (!button) return; selectedRir = button.dataset.rir; renderSetChoices(); });
    $("#restChoices").addEventListener("click", function (event) { var button = event.target.closest("[data-rest]"); if (!button) return; selectedRest = Number(button.dataset.rest); renderSetChoices(); });
    $("#saveSetButton").addEventListener("click", saveCurrentSet);
    $("#cancelSetEditButton").addEventListener("click", cancelSetEdit);

    ["#cardioType", "#cardioDuration", "#cardioDistance", "#cardioIncline", "#cardioMemo"].forEach(function (selector) { $(selector).addEventListener("input", handleCardioInputChange); });
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
    $("#saveCardioButton").addEventListener("click", saveCardio);
    $("#savedCardioList").addEventListener("click", function (event) {
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
      var homeEmptyAdd = event.target.closest("[data-home-empty-add]");
      if (homeEmptyAdd) { startAddingExerciseToToday(); return; }
      var copyLatest = event.target.closest("[data-copy-latest-menu]");
      if (copyLatest) { copyLatestPastMenu(); return; }
      var homeExercise = event.target.closest("[data-home-session][data-home-exercise]");
      if (homeExercise) {
        addExerciseToSavedSession(homeExercise.dataset.homeSession, homeExercise.dataset.homeExercise);
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
        else closeModal(close.dataset.closeModal);
      }
      var dayStart = event.target.closest("[data-day-start]");
      if (dayStart) { closeModal("dayModal"); newDraft(dayStart.dataset.dayStart, dayStart.dataset.dayDate); }
      var dayRoutine = event.target.closest("[data-day-routine-date]");
      if (dayRoutine) { closeModal("dayModal"); openRoutineList(dayRoutine.dataset.dayRoutineDate, "use"); }
      var edit = event.target.closest("[data-edit-session]"); if (edit) loadDraft(edit.dataset.editSession);
      var copy = event.target.closest("[data-copy-session]"); if (copy) openCopyDestination(copy.dataset.copySession);
      var remove = event.target.closest("[data-delete-session]");
      if (remove) askConfirm("この日の記録を削除しますか？", "削除する", function () { deleteSession(remove.dataset.deleteSession); });
    });
    $("#confirmCancel").addEventListener("click", function () { confirmCallback = null; closeModal("confirmModal"); });
    $("#confirmAccept").addEventListener("click", function () { var callback = confirmCallback; confirmCallback = null; closeModal("confirmModal"); if (callback) callback(); });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      var open = $$(".modal.is-open");
      if (!open.length) return;
      if (open[open.length - 1].id === "exerciseModal" && exercisePickerMode === "routine") cancelExerciseSelection();
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
  }

  function changeWeightLarge(direction) {
    var exercise = getExercise(selectedExerciseId);
    if (!exercise || exercise.category === "BODYWEIGHT") return;
    var input = $("#weightInput");
    input.value = Math.max(0, getNumericInputValue(input) + direction * 10).toFixed(1);
  }

  function changeReps(direction) {
    var input = $("#repsInput");
    var current = Math.round(getNumericInputValue(input));
    if (current < 1) current = 10;
    input.value = Math.max(1, current + direction);
    renderSetChoices();
  }

  function changeRepsLarge(direction) {
    var input = $("#repsInput");
    var current = Math.round(getNumericInputValue(input));
    if (current < 1) current = 10;
    input.value = Math.max(1, current + direction * 10);
    renderSetChoices();
  }

  function formatWeightInput() {
    var input = $("#weightInput");
    var value = Math.max(0, getNumericInputValue(input));
    input.value = value.toFixed(1);
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

  bindEvents();
  if (exerciseMigrationChanged) persist();
  renderHome();
  if (!data.profile || !data.profile.weightKg) setTimeout(openProfile, 350);
})();
