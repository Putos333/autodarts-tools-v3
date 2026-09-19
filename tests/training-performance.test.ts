/**
 * Tests für utils/training-performance.ts (Elite Training Center):
 * persönliche Bestleistungen, Aggregat-Performance, Fortschritts-Trend und
 * die selbst-relative, deterministische Trainingsempfehlung.
 *
 *   node --import tsx --test "tests/*.test.ts"
 */

import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  computePersonalBests,
  computeProgressTrend,
  computeTrainingPerformance,
  computeTrainingRecommendation,
  isSessionPersonalBest,
} from "../utils/training-performance";
import type { TrainingSession } from "../utils/training-history";

function session(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    date: "2026-08-01T10:00:00.000Z",
    average: 45,
    count140Plus: 1,
    count180s: 0,
    checkoutMisses: 1,
    checkoutRate: 50,
    goalsReached: 1,
    totalGoals: 3,
    ...overrides,
  };
}

describe("computePersonalBests", () => {
  it("1. keine Sessions -> alles null, sampleSize 0", () => {
    const bests = computePersonalBests([]);
    assert.equal(bests.bestAverage, null);
    assert.equal(bests.best180sInSession, null);
    assert.equal(bests.bestCheckoutRate, null);
    assert.equal(bests.sampleSize, 0);
  });

  it("2. eine Session -> sie selbst ist das Bestergebnis in allen Metriken", () => {
    const s = session({ average: 52, count180s: 2, checkoutRate: 60, date: "d1" });
    const bests = computePersonalBests([ s ]);
    assert.deepEqual(bests.bestAverage, { value: 52, date: "d1" });
    assert.deepEqual(bests.best180sInSession, { value: 2, date: "d1" });
    assert.deepEqual(bests.bestCheckoutRate, { value: 60, date: "d1" });
    assert.equal(bests.sampleSize, 1);
  });

  it("3. wählt tatsächlich den Maximalwert über mehrere Sessions, nicht die neueste", () => {
    const older = session({ date: "d-old", average: 70, count180s: 3, checkoutRate: 80 });
    const newer = session({ date: "d-new", average: 40, count180s: 0, checkoutRate: 20 });
    const bests = computePersonalBests([ newer, older ]);
    assert.equal(bests.bestAverage!.value, 70);
    assert.equal(bests.bestAverage!.date, "d-old");
  });

  it("4. jede Metrik wird unabhängig maximiert (unterschiedliche Sessions je Bestwert)", () => {
    const a = session({ date: "a", average: 80, count180s: 0, checkoutRate: 10 });
    const b = session({ date: "b", average: 20, count180s: 5, checkoutRate: 10 });
    const c = session({ date: "c", average: 20, count180s: 0, checkoutRate: 90 });
    const bests = computePersonalBests([ a, b, c ]);
    assert.equal(bests.bestAverage!.date, "a");
    assert.equal(bests.best180sInSession!.date, "b");
    assert.equal(bests.bestCheckoutRate!.date, "c");
  });
});

describe("isSessionPersonalBest", () => {
  it("1. Session, die dem gespeicherten Bestwert entspricht (Wert + Datum) -> true", () => {
    const s = session({ average: 70, date: "d-old" });
    const bests = computePersonalBests([ s ]);
    assert.equal(isSessionPersonalBest(s, "average", bests), true);
  });

  it("2. Session mit gleichem Wert aber anderem Datum (kein echter Bestwert-Treffer) -> false", () => {
    const best = session({ average: 70, date: "d-old" });
    const other = session({ average: 70, date: "d-other" });
    const bests = computePersonalBests([ best, other ]);
    assert.equal(isSessionPersonalBest(other, "average", bests), false);
  });

  it("3. keine Bestwerte vorhanden (leere Historie) -> immer false, kein Rateergebnis", () => {
    const s = session();
    assert.equal(isSessionPersonalBest(s, "average", computePersonalBests([])), false);
  });
});

describe("computeTrainingPerformance", () => {
  it("1. keine Sessions -> sessionCount 0, Mittelwerte null", () => {
    const perf = computeTrainingPerformance([]);
    assert.equal(perf.sessionCount, 0);
    assert.equal(perf.meanAverage, null);
    assert.equal(perf.meanCheckoutRate, null);
  });

  it("2. berechnet den echten arithmetischen Mittelwert (kein gerundeter Platzhalter)", () => {
    const perf = computeTrainingPerformance([
      session({ average: 40, checkoutRate: 20 }),
      session({ average: 60, checkoutRate: 40 }),
    ]);
    assert.equal(perf.sessionCount, 2);
    assert.equal(perf.meanAverage, 50);
    assert.equal(perf.meanCheckoutRate, 30);
  });
});

describe("computeProgressTrend", () => {
  it("1. keine Sessions -> []", () => {
    assert.deepEqual(computeProgressTrend([]), []);
  });

  it("2. älteste zuerst (Chart-Leserichtung), obwohl die Eingabe neueste-zuerst ist", () => {
    const newest = session({ date: "3", average: 30 });
    const middle = session({ date: "2", average: 20 });
    const oldest = session({ date: "1", average: 10 });
    const trend = computeProgressTrend([ newest, middle, oldest ], 8);
    assert.deepEqual(trend.map(p => p.date), [ "1", "2", "3" ]);
  });

  it("3. respektiert das `count`-Limit (nimmt die neuesten N, dann umgekehrt)", () => {
    const sessions = [ 5, 4, 3, 2, 1 ].map(n => session({ date: String(n), average: n * 10 }));
    const trend = computeProgressTrend(sessions, 3);
    assert.deepEqual(trend.map(p => p.date), [ "3", "4", "5" ]);
  });

  it("4. markiert genau den echten Allzeit-Bestwert als isBest, sonst nichts", () => {
    const trend = computeProgressTrend([
      session({ date: "3", average: 30 }),
      session({ date: "2", average: 90 }),
      session({ date: "1", average: 10 }),
    ], 8);
    assert.deepEqual(trend.filter(p => p.isBest).map(p => p.date), [ "2" ]);
  });
});

describe("computeTrainingRecommendation", () => {
  it("1. weniger als 5 Sessions -> insufficient-data, keine Kategorie", () => {
    const rec = computeTrainingRecommendation([ session(), session(), session(), session() ]);
    assert.equal(rec.sufficient, false);
    assert.equal(rec.reason, "insufficient-data");
    assert.equal(rec.suggestedCategory, null);
  });

  it("2. eigene jüngste Checkout-Quote schlechter als eigener Gesamtschnitt -> Empfehlung 'checkout'", () => {
    const recent = [ 10, 10, 10, 10, 10 ].map((rate, i) => session({ date: `r${i}`, checkoutRate: rate, average: 50 }));
    const older = [ 90, 90, 90 ].map((rate, i) => session({ date: `o${i}`, checkoutRate: rate, average: 50 }));
    const rec = computeTrainingRecommendation([ ...recent, ...older ]);
    assert.equal(rec.sufficient, true);
    assert.equal(rec.reason, "checkout");
    assert.equal(rec.suggestedCategory, "checkout");
    assert.ok(rec.recentValue! < rec.overallValue!);
  });

  it("3. Checkout unauffällig, aber eigener jüngster Average schlechter als eigener Gesamtschnitt -> 'scoring'", () => {
    const recent = [ 20, 20, 20, 20, 20 ].map((avg, i) => session({ date: `r${i}`, average: avg, checkoutRate: 50 }));
    const older = [ 80, 80, 80 ].map((avg, i) => session({ date: `o${i}`, average: avg, checkoutRate: 50 }));
    const rec = computeTrainingRecommendation([ ...recent, ...older ]);
    assert.equal(rec.reason, "scoring");
    assert.equal(rec.suggestedCategory, "accuracy");
  });

  it("4. weder Checkout noch Average jüngst schlechter als der eigene Schnitt -> 'on-par', keine erzwungene Empfehlung", () => {
    const sessions = [ 1, 2, 3, 4, 5, 6 ].map(n => session({ date: String(n), average: 50, checkoutRate: 50 }));
    const rec = computeTrainingRecommendation(sessions);
    assert.equal(rec.sufficient, true);
    assert.equal(rec.reason, "on-par");
    assert.equal(rec.suggestedCategory, null);
  });

  it("5. vergleicht ausschließlich gegen die eigene Historie, niemals gegen einen absoluten Schwellenwert", () => {
    // Durchgängig extrem schwache Werte (10) — nichts ist "jüngst schlechter als der eigene Schnitt".
    const sessions = [ 1, 2, 3, 4, 5, 6 ].map(n => session({ date: String(n), average: 10, checkoutRate: 10 }));
    const rec = computeTrainingRecommendation(sessions);
    assert.equal(rec.reason, "on-par");
  });
});

async function source(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("Elite Training Center — Regression", () => {
  it("utils/training-performance.ts bleibt pure: keine @/-Importe, kein Vue/WXT/Browser", async () => {
    const text = await source("utils/training-performance.ts");
    assert.doesNotMatch(text, /from ["']@\//);
    assert.doesNotMatch(text, /from ["']vue["']|from ["']wxt|browser\./);
  });

  it("utils/training-performance.ts implementiert kein Medaillen-/Achievement-System", async () => {
    const text = await source("utils/training-performance.ts");
    assert.doesNotMatch(text, /\bmedal\b|\bbadge\b|\bxp\b|\blevel\b|\brank\b/i);
  });
});
