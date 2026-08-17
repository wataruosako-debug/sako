"use strict";

const { test, expect } = require("@playwright/test");

/*
 * 指示書⑦ カロリー計算の種目別化テスト。
 * 有酸素: calcMode(weightBearing/power/mets)ごとの式と入力の扱い
 * 筋トレ: 種目属性(movementType/romMeters/bodyweightRatio/assistMode)による新式
 * 据え置き: 保存済みセッションは保存値を正とする
 */

test.use({ viewport: { width: 390, height: 844 } });

async function bootApp(page, weightKg) {
  await page.addInitScript(() => {
    window.__GYMLOG_TEST_MODE = true;
    if (!localStorage.getItem("gymlog-ui-settings-v1")) {
      localStorage.setItem("gymlog-ui-settings-v1", JSON.stringify({ restTimerEnabled: true, guideModeEnabled: true, guideHelpSeen: true }));
    }
  });
  await page.goto("/");
  await page.waitForFunction(() => !!(window.GymLog && window.GymLog.__test__ && window.GymLog.__test__.getData && window.GymLog.__test__.getData()));
  await page.waitForTimeout(600);
  await page.evaluate((weight) => {
    document.querySelectorAll(".modal.is-open").forEach((m) => { m.classList.remove("is-open"); m.setAttribute("aria-hidden", "true"); });
    document.body.classList.remove("modal-open");
    const api = window.GymLog.__test__;
    const data = api.getData();
    data.profile = { weightKg: weight, heightCm: 170, age: 30, gender: "male" };
    api.setData(data);
  }, weightKg || 70);
}

async function setProfileWeight(page, weightKg) {
  await page.evaluate((weight) => {
    const api = window.GymLog.__test__;
    const data = api.getData();
    data.profile = { weightKg: weight, heightCm: 170, age: 30, gender: "male" };
    api.setData(data);
  }, weightKg);
}

// ===== 有酸素 =====

test("有酸素1: バイク 90W/18.32分 → 121kcal(±2)", async ({ page }) => {
  await bootApp(page);
  const calories = await page.evaluate(() => window.GymLog.__test__.calculateCardio({ type: "バイク", durationMinutes: 18.32, avgWatts: 90 }).calories);
  expect(Math.abs(calories - 121)).toBeLessThanOrEqual(2);
});

test("有酸素2: バイクでW未入力ならcalories 0、時間と距離は保存される", async ({ page }) => {
  await bootApp(page);
  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    // W未入力のバイク記録を含む下書きを直接保存する
    api.setDraft({
      id: null, originalSessionId: null, date: new Date().toISOString().slice(0, 10), locationType: "gym", memo: "",
      records: [], pendingCardioTypes: [], menuSource: "manual", createdAt: new Date().toISOString(),
      cardios: [{ tempId: "c-bike", type: "バイク", durationMinutes: 30, distanceKm: 12, inclinePercent: 0, avgWatts: 0, memo: "" }]
    });
    api.saveWorkout(true);
    const data = api.getData();
    const cardio = data.cardios[data.cardios.length - 1];
    return { calories: cardio.calories, durationMinutes: cardio.durationMinutes, distanceKm: cardio.distanceKm, speedKmh: cardio.speedKmh };
  });
  expect(result.calories).toBe(0);
  expect(result.durationMinutes).toBe(30);
  expect(result.distanceKm).toBe(12);
  expect(result.speedKmh).toBeCloseTo(24, 1);
});

test("有酸素3: バイクは体重50kgと100kgで結果が変わらない", async ({ page }) => {
  await bootApp(page, 50);
  const light = await page.evaluate(() => window.GymLog.__test__.calculateCardio({ type: "バイク", durationMinutes: 20, avgWatts: 120 }).calories);
  await setProfileWeight(page, 100);
  const heavy = await page.evaluate(() => window.GymLog.__test__.calculateCardio({ type: "バイク", durationMinutes: 20, avgWatts: 120 }).calories);
  expect(light).toBeCloseTo(heavy, 6);
  expect(light).toBeGreaterThan(0);
});

test("有酸素4: ウォーキングは現行ACSM式のまま(回帰)", async ({ page }) => {
  await bootApp(page, 70);
  const flat = await page.evaluate(() => window.GymLog.__test__.calculateCardio({ type: "ウォーキング", durationMinutes: 60, distanceKm: 6, inclinePercent: 0 }));
  // 速度6km/h(100m/分): VO2 = 0.1*100+3.5 = 13.5 → METs 13.5/3.5 → kcal = 13.5*70/200*60 = 283.5
  expect(flat.calories).toBeCloseTo(283.5, 1);
  expect(flat.speedKmh).toBeCloseTo(6, 3);
  const incline = await page.evaluate(() => window.GymLog.__test__.calculateCardio({ type: "ウォーキング", durationMinutes: 60, distanceKm: 6, inclinePercent: 5 }));
  // VO2 = 0.1*100 + 1.8*100*0.05 + 3.5 = 22.5 → kcal = 22.5*70/200*60 = 472.5
  expect(incline.calories).toBeCloseTo(472.5, 1);
});

test("有酸素5: 階段は距離を入力してもMETs固定で計算される", async ({ page }) => {
  await bootApp(page, 70);
  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    return {
      withDistance: api.calculateCardio({ type: "階段", durationMinutes: 60, distanceKm: 5 }),
      withoutDistance: api.calculateCardio({ type: "階段", durationMinutes: 60, distanceKm: 0 })
    };
  });
  // 8.8METs固定: 8.8*3.5*70/200*60 = 646.8
  expect(result.withDistance.calories).toBeCloseTo(646.8, 1);
  expect(result.withDistance.calories).toBeCloseTo(result.withoutDistance.calories, 6);
  expect(result.withDistance.speedKmh).toBeCloseTo(5, 3); // 速度は表示用に算出される
});

test("有酸素6: クロストレーナーも距離によらずMETs固定", async ({ page }) => {
  await bootApp(page, 70);
  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    return {
      withDistance: api.calculateCardio({ type: "クロストレーナー", durationMinutes: 30, distanceKm: 20 }),
      withoutDistance: api.calculateCardio({ type: "クロストレーナー", durationMinutes: 30, distanceKm: 0 })
    };
  });
  // 5.5METs固定: 5.5*3.5*70/200*30 = 202.125
  expect(result.withDistance.calories).toBeCloseTo(202.125, 1);
  expect(result.withDistance.calories).toBeCloseTo(result.withoutDistance.calories, 6);
});

// ===== 筋トレ =====

test("筋トレ7: デッドリフト100kg×10×4がアームカール15kg×12×3の3倍以上", async ({ page }) => {
  await bootApp(page, 70);
  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const data = api.getData();
    const deadlift = data.exercises.find((e) => e.name === "デッドリフト");
    const curl = data.exercises.find((e) => e.name === "アームカール");
    const dlSets = [1, 2, 3, 4].map((n) => ({ setNumber: n, weight: 100000, reps: 10, rir: "2-3", restSeconds: 180, memo: "" }));
    const curlSets = [1, 2, 3].map((n) => ({ setNumber: n, weight: 15000, reps: 12, rir: "2-3", restSeconds: 60, memo: "" }));
    return {
      deadlift: api.calculateStrengthCalories(dlSets, deadlift),
      curl: api.calculateStrengthCalories(curlSets, curl)
    };
  });
  expect(result.deadlift).toBeGreaterThanOrEqual(result.curl * 3);
});

test("筋トレ8: 同一種目で重量を2倍にするとカロリーが増える(旧式の回帰防止)", async ({ page }) => {
  await bootApp(page, 70);
  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const bench = api.getData().exercises.find((e) => e.name === "ベンチプレス");
    const light = api.calculateStrengthCalories([{ setNumber: 1, weight: 60000, reps: 10, rir: "2-3", restSeconds: 90 }], bench);
    const heavy = api.calculateStrengthCalories([{ setNumber: 1, weight: 120000, reps: 10, rir: "2-3", restSeconds: 90 }], bench);
    return { light, heavy };
  });
  expect(result.heavy).toBeGreaterThan(result.light);
});

test("筋トレ9: 最終セットの休憩はカロリーに加算されない", async ({ page }) => {
  await bootApp(page, 70);
  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const bench = api.getData().exercises.find((e) => e.name === "ベンチプレス");
    const longRest = api.calculateStrengthCalories([{ setNumber: 1, weight: 60000, reps: 10, rir: "2-3", restSeconds: 300 }], bench);
    const noRest = api.calculateStrengthCalories([{ setNumber: 1, weight: 60000, reps: 10, rir: "2-3", restSeconds: 0 }], bench);
    return { longRest, noRest };
  });
  expect(result.longRest).toBeCloseTo(result.noRest, 6);
});

test("筋トレ10: STATIC種目(プランク)は仕事項が0(重量を変えても不変)", async ({ page }) => {
  await bootApp(page, 70);
  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const plank = api.getData().exercises.find((e) => e.name === "プランク");
    const noWeight = api.calculateStrengthCalories([{ setNumber: 1, weight: 0, reps: 3, rir: "", restSeconds: 60 }], plank);
    const withWeight = api.calculateStrengthCalories([{ setNumber: 1, weight: 100000, reps: 3, rir: "", restSeconds: 60 }], plank);
    return { noWeight, withWeight, attrs: api.exerciseCalcAttrs(plank) };
  });
  expect(result.attrs.movementType).toBe("STATIC");
  expect(result.noWeight).toBeCloseTo(result.withWeight, 6);
  expect(result.noWeight).toBeGreaterThan(0);
});

test("筋トレ11: 自重種目(懸垂)は体重が仕事項に反映される", async ({ page }) => {
  await bootApp(page, 60);
  const light = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const chinup = api.getData().exercises.find((e) => e.name === "懸垂");
    return api.calculateStrengthCalories([{ setNumber: 1, weight: 0, reps: 8, rir: "2-3", restSeconds: 0 }], chinup);
  });
  await setProfileWeight(page, 100);
  const heavy = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const chinup = api.getData().exercises.find((e) => e.name === "懸垂");
    return api.calculateStrengthCalories([{ setNumber: 1, weight: 0, reps: 8, rir: "2-3", restSeconds: 0 }], chinup);
  });
  expect(heavy).toBeGreaterThan(light);
});

test("筋トレ12: 属性を持たない独自種目でも自動導出で計算が成立する", async ({ page }) => {
  await bootApp(page, 70);
  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    // 既存ユーザーの独自種目を模した、計算属性なしの素の種目オブジェクト
    const legacyCustom = { id: "ex-legacy", name: "謎の胸マシン", category: "MACHINE", bodyPart: "chest" };
    const calories = api.calculateStrengthCalories([{ setNumber: 1, weight: 40000, reps: 10, rir: "2-3", restSeconds: 90 }], legacyCustom);
    return { calories, attrs: api.deriveExerciseCalcAttrs(legacyCustom) };
  });
  expect(Number.isFinite(result.calories)).toBe(true);
  expect(result.calories).toBeGreaterThan(0);
  expect(result.attrs.movementType).toBe("COMPOUND_MID");
  expect(result.attrs.romMeters).toBeCloseTo(0.40, 5);
});

test("筋トレ13: アシストチンニングは補助重量を増やすと減り、体重以上でも負値にならない", async ({ page }) => {
  await bootApp(page, 70);
  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const assisted = api.getData().exercises.find((e) => e.name === "アシストチンニング");
    const set = (assistKg) => [{ setNumber: 1, weight: assistKg * 1000, reps: 8, rir: "2-3", restSeconds: 0 }];
    return {
      attrs: api.exerciseCalcAttrs(assisted),
      assist20: api.calculateStrengthCalories(set(20), assisted),
      assist40: api.calculateStrengthCalories(set(40), assisted),
      assist100: api.calculateStrengthCalories(set(100), assisted)
    };
  });
  expect(result.attrs.assistMode).toBe(true);
  expect(result.assist40).toBeLessThan(result.assist20);
  expect(result.assist100).toBeGreaterThan(0); // 実働+休憩項は残る(負値にならない)
  expect(result.assist100).toBeLessThanOrEqual(result.assist40);
});

test("筋トレ14: 自動導出でナローベンチプレス相当がプレス例外によりISOLATION化されない", async ({ page }) => {
  await bootApp(page);
  const attrs = await page.evaluate(() => window.GymLog.__test__.deriveExerciseCalcAttrs({ name: "ナローベンチプレス", category: "BARBELL", bodyPart: "arm" }));
  expect(attrs.movementType).not.toBe("ISOLATION");
  expect(attrs.movementType).toBe("COMPOUND_MID");
});

// ===== 据え置き =====

test("据え置き15: session.totalCaloriesを持つ既存セッションは月次集計で保存値のまま", async ({ page }) => {
  await bootApp(page, 70);
  const result = await page.evaluate(() => {
    const api = window.GymLog.__test__;
    const data = api.getData();
    const bench = data.exercises.find((e) => e.name === "ベンチプレス");
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 8) + "05";
    const stamp = now.toISOString();
    // 保存値500kcal。中身のセットから再計算すると別の値になる構成
    data.sessions.push({ id: "s-fixed", date: dateStr, locationType: "gym", totalCalories: 500, memo: "", createdAt: stamp, updatedAt: stamp });
    data.records.push({ id: "r-fixed", sessionId: "s-fixed", exerciseId: bench.id, orderIndex: 0 });
    data.sets.push({ id: "set-fixed", recordId: "r-fixed", setNumber: 1, weight: 60000, reps: 10, rir: "2-3", restSeconds: 90, memo: "" });
    api.setData(data);
    const summary = api.getMonthlySummary(now.getFullYear(), now.getMonth());
    const session = api.getData().sessions.find((s) => s.id === "s-fixed");
    return { monthly: summary.totalCalories, sessionValue: api.sessionTotalCaloriesValue(session) };
  });
  expect(result.sessionValue).toBe(500);
  expect(result.monthly).toBe(500);
});
