"use strict";

const { test, expect } = require("@playwright/test");

/*
 * 指示書⑨ ジムタグ機能テスト。
 * データモデル/マイグレーション、ジム単位の前回参照・重量提案、成長グラフの絞り込み、
 * 自己ベスト(全ジム判定+ジム名表示)、ガイド履歴パネルのデータ、日付変更。
 */

test.use({ viewport: { width: 390, height: 844 } });

async function bootApp(page) {
  await page.addInitScript(() => {
    window.__GYMLOG_TEST_MODE = true;
    if (!localStorage.getItem("gymlog-ui-settings-v1")) {
      localStorage.setItem("gymlog-ui-settings-v1", JSON.stringify({ restTimerEnabled: true, guideModeEnabled: true, guideHelpSeen: true }));
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
    // テスト用ヘルパーをページ内に定義
    window.__seed = {
      dateOffset(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
      },
      addSession(gymId, date, exerciseName, weights, sessionId) {
        const data = api.getData();
        const ex = data.exercises.find((e) => e.name === exerciseName);
        const id = sessionId || "s_" + Math.random().toString(36).slice(2, 9);
        const now = new Date(date + "T10:00:00.000Z").toISOString();
        data.sessions.push({ id, date, locationType: "gym", gymId, totalCalories: 100, memo: "", createdAt: now, updatedAt: now });
        const rid = "r_" + id;
        data.records.push({ id: rid, sessionId: id, exerciseId: ex.id, orderIndex: 0 });
        weights.forEach((w, i) => {
          data.records.length; // noop
          data.sets.push({ id: "set_" + rid + "_" + i, recordId: rid, setNumber: i + 1, weight: w, reps: 8, rir: "2-3", restSeconds: 90, memo: "" });
        });
        api.setData(data);
        return id;
      },
      draft(gymId, date) {
        api.setDraft({
          id: null, originalSessionId: null, date: date || this.dateOffset(0), locationType: "gym", memo: "",
          records: [], cardios: [], pendingCardioTypes: [], menuSource: "manual", gymId, createdAt: new Date().toISOString()
        });
      }
    };
  });
}

async function setupGyms(page) {
  return page.evaluate(() => {
    const api = window.GymLog.__test__;
    const gymA = api.getData().gyms[0]; // マイジム(最古)をAジムとして扱う
    const gymB = api.addGym("Bジム");
    return { aId: gymA.id, aName: gymA.name, bId: gymB.id };
  });
}

// ===== データモデル・マイグレーション =====

test("1: version2データの読込でマイジムが生成され、全セッションにgymIdが付与される", async ({ page }) => {
  await bootApp(page);
  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const now = "2026-07-01T00:00:00.000Z";
    const v2 = {
      version: 2, profile: null,
      exercises: [{ id: "ex1", name: "ラットプルダウン", category: "MACHINE", bodyPart: "back", defaultWeightStep: 1, isFavorite: false, createdAt: now, updatedAt: now }],
      sessions: [
        { id: "s1", date: "2026-07-01", locationType: "gym", createdAt: now, updatedAt: now },
        { id: "s2", date: "2026-07-02", locationType: "home", createdAt: now, updatedAt: now }
      ],
      records: [], sets: [], cardios: [], recentExerciseIds: [], routines: [], scheduledRoutines: [], pendingSuggestions: []
    };
    const migrated = api.migrateDataToCurrentVersion(v2);
    return {
      version: migrated.version,
      gymCount: migrated.gyms.length,
      gymName: migrated.gyms[0].name,
      allAssigned: migrated.sessions.every((s) => s.gymId === migrated.gyms[0].id)
    };
  });
  expect(result.version).toBe(3);
  expect(result.gymCount).toBe(1);
  expect(result.gymName).toBe("マイジム");
  expect(result.allAssigned).toBe(true);
});

test("2: gymId欠落セッションには最も古いジムのidが冪等に補完される", async ({ page }) => {
  await bootApp(page);
  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const now = "2026-07-01T00:00:00.000Z";
    const v3 = {
      version: 3, profile: null, exercises: [],
      gyms: [
        { id: "g_old", name: "古いジム", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: now },
        { id: "g_new", name: "新しいジム", createdAt: "2026-06-01T00:00:00.000Z", updatedAt: now }
      ],
      sessions: [
        { id: "s1", date: "2026-07-01", locationType: "gym", createdAt: now, updatedAt: now },
        { id: "s2", date: "2026-07-02", locationType: "gym", gymId: "g_missing", createdAt: now, updatedAt: now },
        { id: "s3", date: "2026-07-03", locationType: "gym", gymId: "g_new", createdAt: now, updatedAt: now }
      ],
      records: [], sets: [], cardios: [], recentExerciseIds: [], routines: [], scheduledRoutines: [], pendingSuggestions: []
    };
    const once = api.migrateDataToCurrentVersion(v3);
    const twice = api.migrateDataToCurrentVersion(once);
    return {
      s1: once.sessions.find((s) => s.id === "s1").gymId,
      s2: once.sessions.find((s) => s.id === "s2").gymId,
      s3: once.sessions.find((s) => s.id === "s3").gymId,
      idempotent: JSON.stringify(once.sessions) === JSON.stringify(twice.sessions)
    };
  });
  expect(result.s1).toBe("g_old");
  expect(result.s2).toBe("g_old");
  expect(result.s3).toBe("g_new");
  expect(result.idempotent).toBe(true);
});

test("3: gymsが空の状態から読み込むとマイジムが再生成される", async ({ page }) => {
  await bootApp(page);
  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const now = "2026-07-01T00:00:00.000Z";
    const v3 = {
      version: 3, profile: null, exercises: [], gyms: [],
      sessions: [{ id: "s1", date: "2026-07-01", locationType: "gym", gymId: "g_gone", createdAt: now, updatedAt: now }],
      records: [], sets: [], cardios: [], recentExerciseIds: [], routines: [], scheduledRoutines: [], pendingSuggestions: []
    };
    const migrated = api.migrateDataToCurrentVersion(v3);
    return { gymCount: migrated.gyms.length, gymName: migrated.gyms[0].name, sessionGym: migrated.sessions[0].gymId === migrated.gyms[0].id };
  });
  expect(result.gymCount).toBe(1);
  expect(result.gymName).toBe("マイジム");
  expect(result.sessionGym).toBe(true);
});

test("4: 同名のジムを追加しようとするとエラーになる", async ({ page }) => {
  await bootApp(page);
  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const before = api.getData().gyms.length;
    const added = api.addGym("マイジム");
    return { added, after: api.getData().gyms.length, before };
  });
  expect(result.added).toBeNull();
  expect(result.after).toBe(result.before);
});

test("5-6: 使用中のジムは削除できず、未使用のジムは削除できる", async ({ page }) => {
  await bootApp(page);
  const gyms = await setupGyms(page);
  const result = await page.evaluate(({ aId, bId }) => {
    const api = window.GymLog.__test__;
    window.__seed.addSession(aId, window.__seed.dateOffset(-3), "ベンチプレス", [50000]);
    const usedDelete = api.deleteGym(aId);
    const unusedDelete = api.deleteGym(bId);
    const names = api.getData().gyms.map((g) => g.name);
    return { usedDelete, unusedDelete, names, usage: api.gymUsageCount(aId) };
  }, gyms);
  expect(result.usage).toBe(1);
  expect(result.usedDelete).toBe(false);
  expect(result.unusedDelete).toBe(true);
  expect(result.names).toContain("マイジム");
  expect(result.names).not.toContain("Bジム");
});

// ===== ジム単位の参照 =====

test("7-8: 前回重量はセッションのジム単位で参照される", async ({ page }) => {
  await bootApp(page);
  const gyms = await setupGyms(page);
  const result = await page.evaluate(({ aId, bId }) => {
    const api = window.GymLog.__test__;
    const lat = api.getData().exercises.find((e) => e.name === "ラットプルダウン");
    window.__seed.addSession(aId, window.__seed.dateOffset(-3), "ラットプルダウン", [82000]);
    // Bジムのセッションを開始 → Aジムの82kgは参照されない
    window.__seed.draft(bId);
    const noHistory = api.getLastHistoricalRecord(lat.id);
    // Bジムで75kgを記録後、再びBジムで開始 → 75kgが参照される
    window.__seed.addSession(bId, window.__seed.dateOffset(-1), "ラットプルダウン", [75000]);
    window.__seed.draft(bId);
    const bRecord = api.getLastHistoricalRecord(lat.id);
    const bWeight = bRecord ? api.getData().sets.find((s) => s.recordId === bRecord.id).weight : null;
    // Aジムに戻ると82kg
    window.__seed.draft(aId);
    const aRecord = api.getLastHistoricalRecord(lat.id);
    const aWeight = aRecord ? api.getData().sets.find((s) => s.recordId === aRecord.id).weight : null;
    return { noHistory, bWeight, aWeight };
  }, gyms);
  expect(result.noHistory).toBeNull();
  expect(result.bWeight).toBe(75000);
  expect(result.aWeight).toBe(82000);
});

test("9-10: 重量提案は同一ジムの履歴が2回以上あるときだけ出る", async ({ page }) => {
  await bootApp(page);
  const gyms = await setupGyms(page);
  const result = await page.evaluate(({ aId, bId }) => {
    const api = window.GymLog.__test__;
    const bench = api.getData().exercises.find((e) => e.name === "ベンチプレス");
    // Aジム: 2回分の履歴(昇格条件を満たすようreps10)
    const data = api.getData();
    [-10, -3].forEach((offset, i) => {
      const date = window.__seed.dateOffset(offset);
      const id = "sa" + i;
      const now = new Date(date + "T10:00:00.000Z").toISOString();
      data.sessions.push({ id, date, locationType: "gym", gymId: aId, totalCalories: 100, memo: "", createdAt: now, updatedAt: now });
      data.records.push({ id: "ra" + i, sessionId: id, exerciseId: bench.id, orderIndex: 0 });
      data.sets.push({ id: "seta" + i, recordId: "ra" + i, setNumber: 1, weight: 60000, reps: 10, rir: "2-3", restSeconds: 90, memo: "" });
    });
    api.setData(data);
    // Bジム: 1回だけ
    window.__seed.addSession(bId, window.__seed.dateOffset(-2), "ベンチプレス", [55000]);
    window.__seed.draft(aId);
    const suggestionA = api.calculateWeightSuggestion(bench.id);
    window.__seed.draft(bId);
    const suggestionB = api.calculateWeightSuggestion(bench.id);
    return { suggestionA: !!suggestionA, suggestionB };
  }, gyms);
  expect(result.suggestionA).toBe(true);
  expect(result.suggestionB).toBeNull();
});

test("11: 新規セッションのgymId初期値は直近セッションのgymIdになる", async ({ page }) => {
  await bootApp(page);
  const gyms = await setupGyms(page);
  const result = await page.evaluate(({ aId, bId }) => {
    const api = window.GymLog.__test__;
    window.__seed.addSession(aId, window.__seed.dateOffset(-5), "ベンチプレス", [50000]);
    window.__seed.addSession(bId, window.__seed.dateOffset(-1), "ベンチプレス", [52500]);
    const defaultGym = api.defaultGymIdForNewSession();
    const draft = api.createDraftFromSession ? null : null;
    return { defaultGym };
  }, gyms);
  expect(result.defaultGym).toBe(gyms.bId);
});

// ===== 成長グラフ =====

test("12-13: グラフは「すべて」で全ジム、個別選択でそのジムのみが対象になる", async ({ page }) => {
  await bootApp(page);
  const gyms = await setupGyms(page);
  const result = await page.evaluate(({ aId, bId }) => {
    const api = window.GymLog.__test__;
    const lat = api.getData().exercises.find((e) => e.name === "ラットプルダウン");
    const dateA = window.__seed.dateOffset(-4);
    const dateB = window.__seed.dateOffset(-2);
    window.__seed.addSession(aId, dateA, "ラットプルダウン", [82000]);
    window.__seed.addSession(bId, dateB, "ラットプルダウン", [75000]);
    api.getUiSettings().progressGymId = "all";
    const all = api.getStrengthProgress(lat.id, "maxWeight").map((p) => p.date);
    api.getUiSettings().progressGymId = aId;
    const onlyA = api.getStrengthProgress(lat.id, "maxWeight").map((p) => p.date);
    return { all, onlyA, dateA, dateB };
  }, gyms);
  expect(result.all).toContain(result.dateA);
  expect(result.all).toContain(result.dateB);
  expect(result.onlyA).toContain(result.dateA);
  expect(result.onlyA).not.toContain(result.dateB);
});

test("14: グラフのジム選択はuiSettingsに保存され再読み込み後も維持される", async ({ page }) => {
  await bootApp(page);
  const gyms = await setupGyms(page);
  // 成長画面のセレクトから変更(実経路で保存させる)
  await page.evaluate(() => document.querySelector('[data-tab="progress"], #homeProgressButton')?.click());
  await page.evaluate((aId) => {
    const select = document.querySelector("#progressGymSelect");
    const api = window.GymLog.__test__;
    // 画面遷移に依存せずセレクトを直接描画・変更する
    window.GymLog.__test__.getUiSettings();
    if (select) {
      select.innerHTML = '<option value="all">すべて</option><option value="' + aId + '">マイジム</option>';
      select.value = aId;
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, gyms.aId);
  await page.waitForTimeout(300);
  await page.reload();
  await page.waitForFunction(() => !!(window.GymLog && window.GymLog.__test__ && window.GymLog.__test__.getData()));
  const persisted = await page.evaluate(() => window.GymLog.__test__.getUiSettings().progressGymId);
  expect(persisted).toBe(gyms.aId);
});

// ===== 自己ベスト =====

test("15: 他ジムでの記録も自己ベスト判定の対象になる(全記録対象)", async ({ page }) => {
  await bootApp(page);
  const gyms = await setupGyms(page);
  const result = await page.evaluate(({ aId, bId }) => {
    const api = window.GymLog.__test__;
    const lat = api.getData().exercises.find((e) => e.name === "ラットプルダウン");
    // Aジムで82kgの過去記録。Bジムのセッション中に85kgを挙げたらPBになるはず
    window.__seed.addSession(aId, window.__seed.dateOffset(-3), "ラットプルダウン", [82000]);
    window.__seed.draft(bId);
    const previousSets = api.getData().sets;
    return api.evaluatePersonalBestFromSets(lat, { weight: 85000, reps: 8 }, previousSets, null);
  }, gyms);
  expect(result).toBe("maxWeight");
});

test("16: 自己ベストバナーの表示にジム名が含まれる", async ({ page }) => {
  await bootApp(page);
  const gyms = await setupGyms(page);
  const message = await page.evaluate(({ bId }) => {
    const api = window.GymLog.__test__;
    const lat = api.getData().exercises.find((e) => e.name === "ラットプルダウン");
    window.__seed.draft(bId);
    api.showPersonalBestBanner({ exercise: lat, metric: "最大重量", value: 85, previous: 82, decimals: 1, unit: "kg" }, "test-key-" + Date.now());
    return document.querySelector("#personalBestMessage").textContent;
  }, gyms);
  expect(message).toContain("Bジム");
  expect(message).toContain("ラットプルダウン");
});

// ===== 履歴参照(ガイドの履歴パネル) =====

test("17-18: 履歴は過去1ヶ月分のみ・現在ジムの記録が先に並ぶ", async ({ page }) => {
  await bootApp(page);
  const gyms = await setupGyms(page);
  const result = await page.evaluate(({ aId, bId }) => {
    const api = window.GymLog.__test__;
    const lat = api.getData().exercises.find((e) => e.name === "ラットプルダウン");
    window.__seed.addSession(aId, window.__seed.dateOffset(-40), "ラットプルダウン", [70000]); // 1ヶ月より古い→除外
    window.__seed.addSession(aId, window.__seed.dateOffset(-5), "ラットプルダウン", [82000]);
    window.__seed.addSession(bId, window.__seed.dateOffset(-2), "ラットプルダウン", [75000]); // 新しいが他ジム
    window.__seed.draft(aId);
    const entries = api.getExerciseHistoryEntries(lat.id);
    return entries.map((e) => ({ gymId: e.gymId, isCurrentGym: e.isCurrentGym, weight: e.sets[0].weight }));
  }, gyms);
  expect(result.length).toBe(2); // -40日の記録は含まれない
  expect(result[0].isCurrentGym).toBe(true);
  expect(result[0].weight).toBe(82000);
  expect(result[1].isCurrentGym).toBe(false);
  expect(result[1].weight).toBe(75000);
});

test("19: 該当種目の記録が1ヶ月以内に無ければ空の結果が返る", async ({ page }) => {
  await bootApp(page);
  const gyms = await setupGyms(page);
  const result = await page.evaluate(({ aId }) => {
    const api = window.GymLog.__test__;
    const squat = api.getData().exercises.find((e) => e.name === "スクワット");
    window.__seed.addSession(aId, window.__seed.dateOffset(-45), "スクワット", [100000]);
    window.__seed.draft(aId);
    return api.getExerciseHistoryEntries(squat.id);
  }, gyms);
  expect(result.length).toBe(0);
});

// ===== 日付変更 =====

async function confirmDialog(page) {
  await expect(page.locator("#confirmModal")).toHaveClass(/is-open/);
  await page.click("#confirmAccept");
}

test("20+23: 日付変更でセッション全体が移動し、月次集計にも反映される", async ({ page }) => {
  await bootApp(page);
  const gyms = await setupGyms(page);
  await page.evaluate(({ aId }) => {
    const api = window.GymLog.__test__;
    const bench = api.getData().exercises.find((e) => e.name === "ベンチプレス");
    api.setDraft({
      id: null, originalSessionId: null, date: window.__seed.dateOffset(0), locationType: "gym", memo: "",
      records: [{ tempId: "dr1", exerciseId: bench.id, orderIndex: 0, sets: [{ tempId: "ds1", setNumber: 1, weight: 60000, reps: 10, rir: "2-3", restSeconds: 90, memo: "" }] }],
      cardios: [{ tempId: "dc1", type: "ウォーキング", durationMinutes: 30, distanceKm: 3, inclinePercent: 0, avgWatts: 0, memo: "" }],
      pendingCardioTypes: [], menuSource: "manual", gymId: aId, createdAt: new Date().toISOString()
    });
    api.requestGuideDateChange(window.__seed.dateOffset(-1));
  }, gyms);
  await confirmDialog(page);
  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const target = window.__seed.dateOffset(-1);
    const draftDate = api.getDraft().date;
    api.saveWorkout(true);
    const data = api.getData();
    const session = data.sessions.find((s) => s.date === target);
    const records = session ? data.records.filter((r) => r.sessionId === session.id) : [];
    const sets = records.length ? data.sets.filter((s) => s.recordId === records[0].id) : [];
    const cardios = session ? data.cardios.filter((c) => c.sessionId === session.id) : [];
    const d = new Date();
    d.setDate(d.getDate() - 1);
    const monthly = api.getMonthlySummary(d.getFullYear(), d.getMonth());
    return { draftDate, target, hasSession: !!session, recordCount: records.length, setCount: sets.length, cardioCount: cardios.length, monthlyCalories: monthly.totalCalories };
  });
  expect(result.draftDate).toBe(result.target);
  expect(result.hasSession).toBe(true);
  expect(result.recordCount).toBe(1);
  expect(result.setCount).toBe(1);
  expect(result.cardioCount).toBe(1);
  expect(result.monthlyCalories).toBeGreaterThan(0);
});

test("21: 既にセッションが存在する日付へは移動できない", async ({ page }) => {
  await bootApp(page);
  const gyms = await setupGyms(page);
  const result = await page.evaluate(({ aId }) => {
    const api = window.GymLog.__test__;
    const occupied = window.__seed.dateOffset(-2);
    window.__seed.addSession(aId, occupied, "ベンチプレス", [50000]);
    window.__seed.draft(aId, window.__seed.dateOffset(0));
    const accepted = api.requestGuideDateChange(occupied);
    return { accepted, draftDate: api.getDraft().date, today: window.__seed.dateOffset(0) };
  }, gyms);
  expect(result.accepted).toBe(false);
  expect(result.draftDate).toBe(result.today);
});

test("22: 未来日付へは移動できない(JS側の実行時判定)", async ({ page }) => {
  await bootApp(page);
  const gyms = await setupGyms(page);
  const result = await page.evaluate(({ aId }) => {
    const api = window.GymLog.__test__;
    window.__seed.draft(aId, window.__seed.dateOffset(0));
    const accepted = api.requestGuideDateChange(window.__seed.dateOffset(2));
    return { accepted, draftDate: api.getDraft().date, today: window.__seed.dateOffset(0) };
  }, gyms);
  expect(result.accepted).toBe(false);
  expect(result.draftDate).toBe(result.today);
});

// ===== 修正指示D-2: ジム変更時のプリフィル再構築 =====

test("D2: ジム変更で未記録の予定セットのみ変更後ジムの前回で作り直される", async ({ page }) => {
  await bootApp(page);
  const gyms = await setupGyms(page);
  const result = await page.evaluate(({ aId, bId }) => {
    const api = window.GymLog.__test__;
    const lat = api.getData().exercises.find((e) => e.name === "ラットプルダウン");
    window.__seed.addSession(aId, window.__seed.dateOffset(-3), "ラットプルダウン", [82000, 82000]);
    window.__seed.addSession(bId, window.__seed.dateOffset(-2), "ラットプルダウン", [75000, 75000]);
    // Aジムでガイド開始(82kgがプリフィル)
    api.draftFromRoutine({ id: "rt-gym", name: "テスト", locationType: "gym", exercises: [{ exerciseId: lat.id }] }, window.__seed.dateOffset(0), null);
    api.getDraft().gymId = aId;
    return { latId: lat.id };
  }, gyms);
  await page.click("#startGuideModeButton");
  await page.click("#guideStartSummary .guide-start-item-main");
  await expect(page.locator("#guideSetCard")).toBeVisible();
  const beforeChange = await page.evaluate(() => document.querySelector("#guideWeightInput").value);
  expect(beforeChange).toBe("82.0");

  // 1セット目を82kgで記録してからBジムへ変更
  await page.click("#completeGuideSetButton");
  await expect(page.locator("#guideFinishedSetCard")).toBeVisible();
  await page.evaluate((bId) => window.GymLog.__test__.applyDraftGymChange(bId), gyms.bId);
  const state = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const item = api.getDraft().guideState.menuItems[0];
    return {
      completedWeight: item.completedSets[0].weight,
      plannedWeights: item.plannedSets.map((s) => s.weight),
      completedCount: item.completedSets.length
    };
  });
  // 記録済み1セット目は82kgのまま、未記録の予定セットはBジムの75kgに変わる
  expect(state.completedWeight).toBe(82000);
  expect(state.completedCount).toBe(1);
  expect(state.plannedWeights.slice(1)).toEqual([75000]);
});

test("D2: 変更後ジムに履歴がなければ未記録セットのプリフィルは空になる", async ({ page }) => {
  await bootApp(page);
  const gyms = await setupGyms(page);
  await page.evaluate(({ aId }) => {
    const api = window.GymLog.__test__;
    const lat = api.getData().exercises.find((e) => e.name === "ラットプルダウン");
    window.__seed.addSession(aId, window.__seed.dateOffset(-3), "ラットプルダウン", [82000, 82000]);
    api.draftFromRoutine({ id: "rt-gym2", name: "テスト", locationType: "gym", exercises: [{ exerciseId: lat.id }] }, window.__seed.dateOffset(0), null);
    api.getDraft().gymId = aId;
  }, gyms);
  await page.click("#startGuideModeButton");
  await page.click("#guideStartSummary .guide-start-item-main");
  await expect(page.locator("#guideSetCard")).toBeVisible();
  await page.evaluate((bId) => window.GymLog.__test__.applyDraftGymChange(bId), gyms.bId);
  const weights = await page.evaluate(() => {
    const item = window.GymLog.__test__.getDraft().guideState.menuItems[0];
    return { planned: item.plannedSets.map((s) => s.weight), input: document.querySelector("#guideWeightInput").value };
  });
  expect(weights.planned.every((w) => w === 0)).toBe(true);
  expect(weights.input).toBe("0.0");
});
