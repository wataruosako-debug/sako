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

  function seedExercises() {
    var groups = [
      ["MACHINE", ["チェストプレス", "ラットプルダウン", "シーテッドロー", "レッグプレス", "レッグカール", "レッグエクステンション", "ショルダープレス", "アブドミナル"]],
      ["BARBELL", ["ベンチプレス", "スクワット", "デッドリフト"]],
      ["DUMBBELL", ["ダンベルプレス", "ダンベルカール", "サイドレイズ"]],
      ["BODYWEIGHT", ["腕立て伏せ", "スクワット自重", "プランク"]]
    ];
    var stamp = nowIso();
    var result = [];
    groups.forEach(function (group) {
      group[1].forEach(function (name) {
        result.push({ id: makeId("ex"), name: name, category: group[0], defaultWeightStep: WEIGHT_STEPS[group[0]], isFavorite: false, createdAt: stamp, updatedAt: stamp });
      });
    });
    return result;
  }

  function blankData() {
    return { version: 1, profile: null, exercises: seedExercises(), sessions: [], records: [], sets: [], cardios: [], recentExerciseIds: [] };
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
  var editingCardioTempId = null;
  var progressState = { tab: "strength", exerciseId: null, cardioType: "ウォーキング", metric: "maxWeight" };
  var toastTimer = null;
  var confirmCallback = null;

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

  function renderHome() {
    var current = new Date();
    var year = current.getFullYear();
    var month = current.getMonth();
    var prefix = year + "-" + String(month + 1).padStart(2, "0");
    var monthSessions = data.sessions.filter(function (session) { return session.date.indexOf(prefix) === 0; });
    $("#monthlyVisits").textContent = monthSessions.filter(function (session) {
      return session.locationType === "gym" || session.locationType === "home";
    }).length;
    $("#monthlyCalories").textContent = Math.round(monthSessions.reduce(function (sum, session) { return sum + Number(session.totalCalories || 0); }, 0)).toLocaleString("ja-JP");
    $("#profileNudge").classList.toggle("hidden", !!(data.profile && data.profile.weightKg));
    renderCalendar();
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
      var hasGym = daySessions.some(function (session) { return session.locationType === "gym"; });
      var hasHome = daySessions.some(function (session) { return session.locationType === "home"; });
      var classes = ["calendar-day"];
      if (outside) classes.push("calendar-day--outside");
      if (dateValue === today) classes.push("calendar-day--today");
      if (hasGym && hasHome) classes.push("calendar-day--both", "calendar-day--has-record");
      else if (hasGym) classes.push("calendar-day--gym", "calendar-day--has-record");
      else if (hasHome) classes.push("calendar-day--home", "calendar-day--has-record");
      html += '<button type="button" role="gridcell" class="' + classes.join(" ") + '" data-calendar-date="' + dateValue + '" aria-label="' + formatDateJa(dateValue) + (daySessions.length ? " 記録あり" : "") + '">' + displayDay + "</button>";
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

  function renderProgressChart(points, definition, chartLabel) {
    var container = $("#progressChart");
    if (!points.length) {
      container.innerHTML = '<div class="chart-empty"><div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 18 10 12l4 4 6-8"/><path d="M15 8h5v5"/></svg><p>まだ記録がありません</p><small>トレーニングを記録するとグラフが表示されます</small></div></div>';
      return;
    }
    var width = 340;
    var height = 270;
    var margin = { top: 28, right: 30, bottom: 50, left: 64 };
    var plotWidth = width - margin.left - margin.right;
    var plotHeight = height - margin.top - margin.bottom;
    var values = points.map(function (point) { return point.value; });
    var minValue = Math.min.apply(null, values);
    var maxValue = Math.max.apply(null, values);
    var span = maxValue - minValue;
    var padding = span > 0 ? span * 0.18 : Math.max(maxValue * 0.12, 1);
    var yMin = Math.max(0, minValue - padding);
    var yMax = maxValue + padding;
    if (yMax === yMin) yMax = yMin + 1;
    var coordinates = points.map(function (point, index) {
      var x = points.length === 1 ? margin.left + plotWidth / 2 : margin.left + index * plotWidth / (points.length - 1);
      var y = margin.top + (yMax - point.value) / (yMax - yMin) * plotHeight;
      return { x: x, y: y, point: point };
    });
    var grid = "";
    for (var tick = 0; tick <= 3; tick += 1) {
      var ratio = tick / 3;
      var y = margin.top + ratio * plotHeight;
      var tickValue = yMax - ratio * (yMax - yMin);
      var tickText = tickValue.toLocaleString("ja-JP", { minimumFractionDigits: 0, maximumFractionDigits: definition.decimals });
      grid += '<line class="chart-grid-line" x1="' + margin.left + '" y1="' + y.toFixed(1) + '" x2="' + (width - margin.right) + '" y2="' + y.toFixed(1) + '"/><text class="chart-axis-label" x="' + (margin.left - 7) + '" y="' + (y + 3).toFixed(1) + '" text-anchor="end">' + tickText + '</text>';
    }
    var linePath = coordinates.map(function (coordinate, index) { return (index ? "L" : "M") + coordinate.x.toFixed(1) + " " + coordinate.y.toFixed(1); }).join(" ");
    var areaPath = coordinates.length > 1 ? linePath + " L" + coordinates[coordinates.length - 1].x.toFixed(1) + " " + (margin.top + plotHeight) + " L" + coordinates[0].x.toFixed(1) + " " + (margin.top + plotHeight) + " Z" : "";
    var labelIndexes = [];
    if (points.length <= 4) points.forEach(function (_, index) { labelIndexes.push(index); });
    else labelIndexes = [0, Math.floor((points.length - 1) / 2), points.length - 1];
    var dateLabels = labelIndexes.map(function (index) {
      var coordinate = coordinates[index];
      return '<text class="chart-axis-label" x="' + coordinate.x.toFixed(1) + '" y="' + (height - 14) + '" text-anchor="middle">' + progressDateLabel(coordinate.point.date) + '</text>';
    }).join("");
    var circles = coordinates.map(function (coordinate, index) {
      var latestClass = index === coordinates.length - 1 ? " chart-point--latest" : "";
      var radius = index === coordinates.length - 1 ? 6 : 4;
      return '<circle class="chart-point' + latestClass + '" cx="' + coordinate.x.toFixed(1) + '" cy="' + coordinate.y.toFixed(1) + '" r="' + radius + '"><title>' + progressDateLabel(coordinate.point.date) + ' ' + formatProgressNumber(coordinate.point.value, definition) + '</title></circle>';
    }).join("");
    container.innerHTML = '<svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + escapeHtml(chartLabel) + '"><defs><linearGradient id="progressAreaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7aa5fa" stop-opacity=".42"/><stop offset="100%" stop-color="#7aa5fa" stop-opacity=".03"/></linearGradient></defs>' + grid + (areaPath ? '<path class="chart-area" d="' + areaPath + '"/>' : "") + (coordinates.length > 1 ? '<path class="chart-line" d="' + linePath + '"/>' : "") + circles + dateLabels + '</svg>';
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
    $("#cardioForm").classList.add("hidden");
    $("#toggleCardioButton").setAttribute("aria-expanded", "false");
    $("#toggleCardioButton").lastElementChild.textContent = "＋";
    $("#cardioType").value = "ウォーキング";
    $("#cardioDuration").value = "";
    $("#cardioDistance").value = "";
    $("#cardioIncline").value = "";
    $("#cardioMemo").value = "";
    $("#saveCardioButton").textContent = "有酸素記録を追加";
    updateCardioPreview();
  }

  function populateCardioForm(cardio) {
    if (!cardio) return;
    editingCardioTempId = cardio.tempId;
    var typeOption = $$('#cardioType option').some(function (option) { return option.value === cardio.type; });
    $("#cardioType").value = typeOption ? cardio.type : "ウォーキング";
    $("#cardioDuration").value = formatNumberForInput(Number(cardio.durationMinutes || 0), 1);
    $("#cardioDistance").value = formatNumberForInput(Number(cardio.distanceKm || 0), 0.1);
    $("#cardioIncline").value = formatNumberForInput(Number(cardio.inclinePercent || 0), 0.5);
    $("#cardioMemo").value = cardio.memo || "";
    $("#cardioForm").classList.remove("hidden");
    $("#toggleCardioButton").setAttribute("aria-expanded", "true");
    $("#toggleCardioButton").lastElementChild.textContent = "−";
    $("#saveCardioButton").textContent = "有酸素記録の変更を確定";
    updateCardioPreview();
  }

  function newDraft(locationType, date) {
    draft = { id: null, date: date || todayString(), locationType: locationType, memo: "", records: [], cardios: [], createdAt: nowIso() };
    selectedExerciseId = null;
    selectedRir = null;
    selectedRest = 90;
    resetCardioForm();
    renderWorkout();
    showScreen("workout");
  }

  function loadDraft(sessionId) {
    var session = data.sessions.find(function (item) { return item.id === sessionId; });
    if (!session) return;
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
    selectedExerciseId = draft.records.length ? draft.records[0].exerciseId : null;
    selectedRir = null;
    selectedRest = 90;
    resetCardioForm();
    if (draft.cardios.length) populateCardioForm(draft.cardios[0]);
    renderWorkout();
    closeModal("dayModal");
    showScreen("workout");
  }

  function copySessionToToday(sessionId) {
    var source = data.sessions.find(function (item) { return item.id === sessionId; });
    if (!source) return;
    draft = { id: null, date: todayString(), locationType: source.locationType, memo: "", records: [], cardios: [], createdAt: nowIso() };
    var sourceRecords = getSessionRecords(sessionId);
    sourceRecords.forEach(function (record, index) {
      var previousSets = getRecordSets(record.id);
      if (!previousSets.length) return;
      draft.records.push({
        tempId: makeId("draftrecord"), exerciseId: record.exerciseId, orderIndex: index,
        sets: previousSets.map(function (previous, setIndex) {
          return { tempId: makeId("draftset"), setNumber: setIndex + 1, weight: previous.weight, reps: previous.reps, rir: "", restSeconds: previous.restSeconds, memo: "" };
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
    selectedExerciseId = draft.records.length ? draft.records[0].exerciseId : null;
    selectedRir = null;
    selectedRest = 90;
    resetCardioForm();
    if (draft.cardios.length) populateCardioForm(draft.cardios[0]);
    renderWorkout();
    closeModal("dayModal");
    showScreen("workout");
    showToast("前回の内容を今日の記録にコピーしました");
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

  function getLastHistoricalSet(exerciseId) {
    var records = data.records.filter(function (record) { return record.exerciseId === exerciseId; });
    for (var i = records.length - 1; i >= 0; i -= 1) {
      var sets = getRecordSets(records[i].id);
      if (sets.length) return sets[sets.length - 1];
    }
    return null;
  }

  function renderSelectedExercise() {
    var exercise = getExercise(selectedExerciseId);
    var hasExercise = !!exercise;
    $("#setEditorCard").classList.toggle("hidden", !hasExercise);
    if (!hasExercise) {
      $("#selectedExerciseIcon").textContent = "+";
      $("#selectedExerciseName").textContent = "種目を選択";
      $("#selectedExerciseMeta").textContent = "タップして一覧を開く";
      return;
    }
    $("#selectedExerciseIcon").textContent = exercise.name.slice(0, 1);
    $("#selectedExerciseName").textContent = exercise.name;
    $("#selectedExerciseMeta").textContent = CATEGORY_LABELS[exercise.category] + (exercise.category === "BODYWEIGHT" ? "・重量入力なし" : "・" + WEIGHT_STEPS[exercise.category].toFixed(1) + "kg刻み");
    var record = ensureDraftRecord(exercise.id);
    var lastSet = record.sets.length ? record.sets[record.sets.length - 1] : getLastHistoricalSet(exercise.id);
    var nextNumber = record.sets.length + 1;
    $("#currentSetLabel").textContent = "セット" + nextNumber;
    $("#weightBlock").classList.toggle("hidden", exercise.category === "BODYWEIGHT");
    $("#weightStepLabel").textContent = WEIGHT_STEPS[exercise.category].toFixed(1) + "kg刻み";
    $("#weightInput").step = WEIGHT_STEPS[exercise.category] || 1;
    $("#weightInput").value = exercise.category === "BODYWEIGHT" ? 0 : (lastSet ? (Number(lastSet.weight) / 1000).toFixed(1) : "0.0");
    $("#repsInput").value = lastSet ? lastSet.reps : "";
    selectedRest = lastSet ? Number(lastSet.restSeconds) : 90;
    selectedRir = null;
    $("#setMemo").value = "";
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
    selectedExerciseId = exerciseId;
    ensureDraftRecord(exerciseId);
    closeModal("exerciseModal");
    renderSelectedExercise();
    renderSavedSets();
    setTimeout(function () { $("#setEditorCard").scrollIntoView({ behavior: "smooth", block: "start" }); }, 50);
  }

  function renderExerciseList(query) {
    var normalized = (query || "").trim().toLowerCase();
    var exercises = data.exercises.filter(function (exercise) { return exercise.name.toLowerCase().indexOf(normalized) >= 0; });
    var used = {};
    var groups = [];
    if (!normalized) {
      var recent = data.recentExerciseIds.map(getExercise).filter(Boolean).filter(function (exercise) { if (used[exercise.id]) return false; used[exercise.id] = true; return true; }).slice(0, 5);
      if (recent.length) groups.push({ title: "最近使った種目", items: recent });
      var favorites = exercises.filter(function (exercise) { return exercise.isFavorite && !used[exercise.id]; });
      favorites.forEach(function (exercise) { used[exercise.id] = true; });
      if (favorites.length) groups.push({ title: "お気に入り", items: favorites });
    }
    var remaining = exercises.filter(function (exercise) { return !used[exercise.id]; });
    if (remaining.length) groups.push({ title: normalized ? "検索結果" : "全種目", items: remaining });
    if (!groups.length) {
      $("#exerciseList").innerHTML = '<div class="empty-state">該当する種目がありません</div>';
      return;
    }
    $("#exerciseList").innerHTML = groups.map(function (group) {
      return '<section><p class="exercise-group-title">' + group.title + '</p>' + group.items.map(function (exercise) {
        return '<div class="exercise-option-wrap"><button class="exercise-option" type="button" data-exercise-id="' + exercise.id + '"><span class="exercise-letter">' + escapeHtml(exercise.name.slice(0, 1)) + '</span><span><strong>' + escapeHtml(exercise.name) + '</strong><small>' + CATEGORY_LABELS[exercise.category] + '</small></span><span class="favorite-button ' + (exercise.isFavorite ? "is-favorite" : "") + '" data-favorite-id="' + exercise.id + '" role="button" aria-label="お気に入り">★</span></button></div>';
      }).join("") + '</section>';
    }).join("");
  }

  function saveCurrentSet() {
    var exercise = getExercise(selectedExerciseId);
    if (!exercise) return;
    var reps = Math.round(numberValue("#repsInput"));
    if (reps < 1) { showToast("回数を入力してください"); $("#repsInput").focus(); return; }
    var weightKg = exercise.category === "BODYWEIGHT" ? 0 : Math.max(0, numberValue("#weightInput"));
    var record = ensureDraftRecord(exercise.id);
    record.sets.push({
      tempId: makeId("draftset"), setNumber: record.sets.length + 1, weight: Math.round(weightKg * 1000), reps: reps,
      rir: selectedRir == null ? "" : selectedRir, restSeconds: selectedRest, memo: $("#setMemo").value.trim()
    });
    var copiedWeight = weightKg;
    var copiedReps = reps;
    selectedRir = null;
    $("#setMemo").value = "";
    $("#currentSetLabel").textContent = "セット" + (record.sets.length + 1);
    $("#weightInput").value = copiedWeight.toFixed(1);
    $("#repsInput").value = copiedReps;
    renderSetChoices();
    renderSavedSets();
    updateDraftCalories();
    showToast("セット" + record.sets.length + "を保存しました");
  }

  function renderSavedSets() {
    if (!draft) return;
    var recordsWithSets = draft.records.filter(function (record) { return record.sets.length > 0; });
    var total = recordsWithSets.reduce(function (sum, record) { return sum + record.sets.length; }, 0);
    $("#savedSetsSection").classList.toggle("hidden", total === 0);
    $("#setCountBadge").textContent = total + "セット";
    $("#savedSetsList").innerHTML = recordsWithSets.map(function (record) {
      var exercise = getExercise(record.exerciseId);
      return '<div class="saved-group"><div class="saved-group-head"><strong>' + escapeHtml(exercise ? exercise.name : "不明な種目") + '</strong><span>' + record.sets.length + 'セット</span></div>' + record.sets.map(function (set) {
        var weightText = exercise && exercise.category === "BODYWEIGHT" ? "自重" : (Number(set.weight) / 1000).toFixed(1) + "kg";
        return '<div class="saved-item"><span class="set-index">' + set.setNumber + '</span><span class="saved-item-text"><strong>' + weightText + ' × ' + set.reps + '回</strong><small>' + RIR_LABELS[set.rir || ""] + '・休憩' + set.restSeconds + '秒' + (set.memo ? '・' + escapeHtml(set.memo) : '') + '</small></span><button class="delete-mini" type="button" data-delete-set="' + set.tempId + '" aria-label="セットを削除">×</button></div>';
      }).join("") + '</div>';
    }).join("");
  }

  function deleteDraftSet(tempId) {
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
    syncEditingCardioFromForm();
  }

  function saveCardio() {
    var cardio = cardioFormValue();
    if (cardio.durationMinutes < 1) { showToast("運動時間を入力してください"); $("#cardioDuration").focus(); return; }
    if (editingCardioTempId) {
      syncEditingCardioFromForm();
      showToast("有酸素記録を更新しました");
      return;
    }
    var result = calculateCardio(cardio);
    cardio.tempId = makeId("draftcardio");
    cardio.speedKmh = result.speedKmh;
    cardio.calories = result.calories;
    draft.cardios.push(cardio);
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
    $("#savedCardioList").innerHTML = draft.cardios.map(function (cardio) {
      var result = calculateCardio(cardio);
      return '<div class="saved-group"><div class="saved-item" style="border-top:0"><span class="set-index">' + (cardio.type === "ランニング" || cardio.type === "ジョギング" ? "走" : "有") + '</span><span class="saved-item-text"><strong>' + escapeHtml(cardio.type) + '・' + cardio.durationMinutes + '分</strong><small>' + (cardio.distanceKm ? cardio.distanceKm + 'km・' + result.speedKmh.toFixed(1) + 'km/h・' : '') + Math.round(result.calories) + 'kcal</small></span><button class="delete-mini" type="button" data-delete-cardio="' + cardio.tempId + '" aria-label="有酸素記録を削除">×</button></div></div>';
    }).join("");
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
    var usedExerciseIds = validRecords.map(function (record) { return record.exerciseId; });
    data.recentExerciseIds = usedExerciseIds.concat(data.recentExerciseIds.filter(function (id) { return usedExerciseIds.indexOf(id) < 0; })).slice(0, 12);
    if (!persist()) return;
    draft = null;
    selectedExerciseId = null;
    calendarCursor = new Date();
    calendarCursor.setDate(1);
    renderHome();
    showScreen("home");
    showToast(oldSession ? "トレーニングを更新しました" : "トレーニングを保存しました");
  }

  function renderDaySummary(dateValue) {
    var sessions = data.sessions.filter(function (session) { return session.date === dateValue; }).sort(function (a, b) { return a.createdAt.localeCompare(b.createdAt); });
    $("#dayModalTitle").textContent = formatDateJa(dateValue);
    if (!sessions.length) {
      $("#daySummaryContent").innerHTML = '<div class="empty-state">この日の記録はまだありません</div>';
      $("#daySummaryActions").innerHTML = '<button class="finish-button" type="button" data-day-start="gym" data-day-date="' + dateValue + '">ジムトレーニングを記録</button><button class="outline-button" type="button" data-day-start="home" data-day-date="' + dateValue + '">自宅トレーニングを記録</button>';
      openModal("dayModal");
      return;
    }
    var dayTotal = sessions.reduce(function (sum, session) { return sum + Number(session.totalCalories || 0); }, 0);
    var html = '<div class="day-total"><span>概算消費カロリー</span><strong>' + Math.round(dayTotal) + ' kcal</strong></div>';
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
      html += '<section class="summary-session"><div class="summary-session-head"><strong>' + (session.locationType === "gym" ? "ジムトレーニング" : "自宅トレーニング") + '</strong><span>' + Math.round(session.totalCalories || 0) + ' kcal</span></div><div class="summary-lines">' + (lines.length ? lines.join("") : '<div class="summary-line"><span>記録内容なし</span></div>') + '</div></section>';
    });
    $("#daySummaryContent").innerHTML = html;
    var latest = sessions[sessions.length - 1];
    $("#daySummaryActions").innerHTML = '<button class="finish-button" type="button" data-copy-session="' + latest.id + '">この内容で開始</button><div class="secondary-actions"><button class="outline-button" type="button" data-edit-session="' + latest.id + '">編集</button><button class="outline-button danger-text" type="button" data-delete-session="' + latest.id + '">削除</button></div><button class="outline-button" type="button" data-close-modal="dayModal">閉じる</button>';
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
    $("#settingsButton").addEventListener("click", openProfile);
    $("#profileNudge").addEventListener("click", openProfile);
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
    $$('[data-start-workout]').forEach(function (button) { button.addEventListener("click", function () { newDraft(button.dataset.startWorkout); }); });
    $("#prevMonth").addEventListener("click", function () { calendarCursor.setMonth(calendarCursor.getMonth() - 1); renderHome(); });
    $("#nextMonth").addEventListener("click", function () { calendarCursor.setMonth(calendarCursor.getMonth() + 1); renderHome(); });
    $("#todayMonth").addEventListener("click", function () { calendarCursor = new Date(); calendarCursor.setDate(1); renderHome(); });
    $("#calendarGrid").addEventListener("click", function (event) { var button = event.target.closest("[data-calendar-date]"); if (button) renderDaySummary(button.dataset.calendarDate); });

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

    $("#backHomeButton").addEventListener("click", function () { draft = null; renderHome(); showScreen("home"); });
    $("#finishTopButton").addEventListener("click", saveWorkout);
    $("#finishWorkoutButton").addEventListener("click", saveWorkout);
    $("#sessionDate").addEventListener("change", function () { if (draft) draft.date = this.value; });
    $("#sessionMemo").addEventListener("input", function () { if (draft) draft.memo = this.value; });
    $("#exercisePickerButton").addEventListener("click", function () { $("#exerciseSearch").value = ""; renderExerciseList(""); openModal("exerciseModal"); setTimeout(function () { $("#exerciseSearch").focus(); }, 100); });
    $("#chooseAnotherExercise").addEventListener("click", function () { $("#exercisePickerButton").click(); });
    $("#exerciseSearch").addEventListener("input", function () { renderExerciseList(this.value); });
    $("#exerciseList").addEventListener("click", function (event) {
      var favorite = event.target.closest("[data-favorite-id]");
      if (favorite) {
        event.stopPropagation();
        var exercise = getExercise(favorite.dataset.favoriteId);
        if (exercise) { exercise.isFavorite = !exercise.isFavorite; exercise.updatedAt = nowIso(); persist(); renderExerciseList($("#exerciseSearch").value); }
        return;
      }
      var option = event.target.closest("[data-exercise-id]");
      if (option) chooseExercise(option.dataset.exerciseId);
    });
    $("#openAddExercise").addEventListener("click", function () { closeModal("exerciseModal"); $("#newExerciseName").value = ""; openModal("addExerciseModal"); });
    $("#addExerciseForm").addEventListener("submit", function (event) {
      event.preventDefault();
      var name = $("#newExerciseName").value.trim();
      var category = $("#newExerciseCategory").value;
      var stamp = nowIso();
      var exercise = { id: makeId("ex"), name: name, category: category, defaultWeightStep: WEIGHT_STEPS[category], isFavorite: false, createdAt: stamp, updatedAt: stamp };
      data.exercises.push(exercise); persist(); closeModal("addExerciseModal"); chooseExercise(exercise.id); showToast("新しい種目を追加しました");
    });

    $("#weightMinus").addEventListener("click", function () { changeWeight(-1); });
    $("#weightPlus").addEventListener("click", function () { changeWeight(1); });
    $("#weightInput").addEventListener("focus", function () {
      if (getNumericInputValue(this) === 0) this.value = "";
    });
    $("#weightInput").addEventListener("blur", formatWeightInput);
    $("#repsQuick").addEventListener("click", function (event) { var button = event.target.closest("[data-reps]"); if (!button) return; $("#repsInput").value = button.dataset.reps; renderSetChoices(); });
    $("#repsInput").addEventListener("input", renderSetChoices);
    $("#rirChoices").addEventListener("click", function (event) { var button = event.target.closest("[data-rir]"); if (!button) return; selectedRir = button.dataset.rir; renderSetChoices(); });
    $("#restChoices").addEventListener("click", function (event) { var button = event.target.closest("[data-rest]"); if (!button) return; selectedRest = Number(button.dataset.rest); renderSetChoices(); });
    $("#saveSetButton").addEventListener("click", saveCurrentSet);
    $("#savedSetsList").addEventListener("click", function (event) { var button = event.target.closest("[data-delete-set]"); if (button) deleteDraftSet(button.dataset.deleteSet); });

    $("#toggleCardioButton").addEventListener("click", function () {
      var willOpen = $("#cardioForm").classList.contains("hidden");
      $("#cardioForm").classList.toggle("hidden", !willOpen);
      this.setAttribute("aria-expanded", String(willOpen));
      this.lastElementChild.textContent = willOpen ? "−" : "＋";
    });
    ["#cardioType", "#cardioDuration", "#cardioDistance", "#cardioIncline", "#cardioMemo"].forEach(function (selector) { $(selector).addEventListener("input", handleCardioInputChange); });
    $$('[data-number-target]').forEach(function (button) {
      button.addEventListener("click", function () {
        changeNumericInput(button.dataset.numberTarget, Number(button.dataset.numberDirection));
      });
    });
    $("#saveCardioButton").addEventListener("click", saveCardio);
    $("#savedCardioList").addEventListener("click", function (event) {
      var button = event.target.closest("[data-delete-cardio]");
      if (!button) return;
      draft.cardios = draft.cardios.filter(function (cardio) { return cardio.tempId !== button.dataset.deleteCardio; });
      if (editingCardioTempId === button.dataset.deleteCardio) resetCardioForm();
      renderSavedCardios(); updateDraftCalories();
    });

    document.addEventListener("click", function (event) {
      var close = event.target.closest("[data-close-modal]");
      if (close) closeModal(close.dataset.closeModal);
      var dayStart = event.target.closest("[data-day-start]");
      if (dayStart) { closeModal("dayModal"); newDraft(dayStart.dataset.dayStart, dayStart.dataset.dayDate); }
      var edit = event.target.closest("[data-edit-session]"); if (edit) loadDraft(edit.dataset.editSession);
      var copy = event.target.closest("[data-copy-session]"); if (copy) copySessionToToday(copy.dataset.copySession);
      var remove = event.target.closest("[data-delete-session]");
      if (remove) askConfirm("このトレーニング記録を削除します。", "削除する", function () { deleteSession(remove.dataset.deleteSession); });
    });
    $("#confirmCancel").addEventListener("click", function () { confirmCallback = null; closeModal("confirmModal"); });
    $("#confirmAccept").addEventListener("click", function () { var callback = confirmCallback; confirmCallback = null; closeModal("confirmModal"); if (callback) callback(); });
    document.addEventListener("keydown", function (event) { if (event.key === "Escape") { var open = $$(".modal.is-open"); if (open.length) closeModal(open[open.length - 1].id); } });
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

  bindEvents();
  renderHome();
  if (!data.profile || !data.profile.weightKg) setTimeout(openProfile, 350);
})();
