/**
 * Tests für die reine Statistics-Domain-Schicht (utils/statistics.ts).
 *
 *   node --import tsx --test "tests/*.test.ts"
 *
 * utils/statistics.ts ist import-/seiteneffektfrei (nur `import type`),
 * daher hier kein Browser-, WXT- oder Bundler-Kontext nötig.
 *
 * Getestet werden FACHLICHE Ergebnisse (Win Rate, Ø Average, Trend-Reihenfolge
 * usw.), nicht Implementierungsdetails.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import type { ICanonicalMatchResult, ICmrPlayer } from "../utils/canonical-match-result";
import {
  DEFAULT_STATISTICS_FILTERS,
  computeAverageStats,
  computeAverageTrend,
  computeLegSetStats,
  computeMatchSummary,
  computeQualityBreakdown,
  computeRecentForm,
  computeScoringStats,
  computeStatisticsOverview,
  extractStatisticsGameModes,
  filterStatisticsRecords,
  sortStatisticsRecords,
} from "../utils/statistics";

function player(overrides: Partial<ICmrPlayer> = {}): ICmrPlayer {
  return { index: 0, ...overrides };
}

function record(overrides: Partial<ICanonicalMatchResult> = {}): ICanonicalMatchResult {
  return {
    schemaVersion: 1,
    matchId: "match-1",
    revision: 1,
    quality: "COMPLETE",
    recordedAt: "2026-08-15T10:00:00.000Z",
    finished: true,
    winnerIndex: 0,
    players: [
      player({ index: 0, average: 60, total180: 2, dartsThrown: 90, legs: 3, checkoutPoints: 100 }),
      player({ index: 1, average: 50, total180: 1, dartsThrown: 95, legs: 1 }),
    ],
    ...overrides,
  };
}

describe("computeMatchSummary", () => {
  it("1. keine Matches: alles 0, winRate null (keine Division durch 0)", () => {
    const s = computeMatchSummary([]);
    assert.deepEqual(s, {
      totalMatches: 0, completedMatches: 0, decidedMatches: 0, wins: 0, losses: 0, winRate: null,
    });
  });

  it("2. ein gewonnenes Match", () => {
    const s = computeMatchSummary([ record({ winnerIndex: 0 }) ]);
    assert.equal(s.wins, 1);
    assert.equal(s.losses, 0);
    assert.equal(s.winRate, 1);
  });

  it("3. ein verlorenes Match", () => {
    const s = computeMatchSummary([ record({ winnerIndex: 1 }) ]);
    assert.equal(s.wins, 0);
    assert.equal(s.losses, 1);
    assert.equal(s.winRate, 0);
  });

  it("4. mehrere Matches: korrekte Win Rate", () => {
    const s = computeMatchSummary([
      record({ matchId: "a", winnerIndex: 0 }),
      record({ matchId: "b", winnerIndex: 0 }),
      record({ matchId: "c", winnerIndex: 1 }),
      record({ matchId: "d", winnerIndex: 1 }),
    ]);
    assert.equal(s.wins, 2);
    assert.equal(s.losses, 2);
    assert.equal(s.winRate, 0.5);
    assert.equal(s.decidedMatches, 4);
  });

  it("5. unentschiedenes Match (kein winnerIndex) zählt weder als Sieg noch Niederlage", () => {
    const s = computeMatchSummary([ record({ winnerIndex: undefined, quality: "MINIMAL" }) ]);
    assert.equal(s.wins, 0);
    assert.equal(s.losses, 0);
    assert.equal(s.decidedMatches, 0);
    assert.equal(s.winRate, null);
    assert.equal(s.totalMatches, 1);
  });

  it("6. finished=false zählt nicht als completed, auch wenn winnerIndex zufällig gesetzt wäre", () => {
    const s = computeMatchSummary([ record({ finished: false, winnerIndex: 0 }) ]);
    assert.equal(s.completedMatches, 0);
    assert.equal(s.decidedMatches, 0);
  });

  it("7. myPlayerIndex ist parametrisierbar (nicht hart auf 0 kodiert)", () => {
    const s = computeMatchSummary([ record({ winnerIndex: 1 }) ], 1);
    assert.equal(s.wins, 1);
    assert.equal(s.losses, 0);
  });
});

describe("computeAverageStats", () => {
  it("1. keine Matches: alles null", () => {
    const a = computeAverageStats([]);
    assert.deepEqual(a, { average: null, bestAverage: null, sampleSize: 0 });
  });

  it("2. ein Match", () => {
    const a = computeAverageStats([ record() ]);
    assert.equal(a.average, 60);
    assert.equal(a.bestAverage, 60);
    assert.equal(a.sampleSize, 1);
  });

  it("3. mehrere Matches: korrekte Aggregation und Bestwert", () => {
    const a = computeAverageStats([
      record({ matchId: "a", players: [ player({ index: 0, average: 40 }), player({ index: 1 }) ] }),
      record({ matchId: "b", players: [ player({ index: 0, average: 80 }), player({ index: 1 }) ] }),
      record({ matchId: "c", players: [ player({ index: 0, average: 60 }), player({ index: 1 }) ] }),
    ]);
    assert.equal(a.average, 60); // (40+80+60)/3
    assert.equal(a.bestAverage, 80);
    assert.equal(a.sampleSize, 3);
  });

  it("4. fehlendes average-Feld wird übersprungen, nicht als 0 gewertet", () => {
    const a = computeAverageStats([
      record({ matchId: "a", players: [ player({ index: 0, average: 100 }), player({ index: 1 }) ] }),
      record({ matchId: "b", players: [ player({ index: 0 }), player({ index: 1 }) ] }), // kein average
    ]);
    assert.equal(a.average, 100); // nicht (100+0)/2 = 50
    assert.equal(a.sampleSize, 1);
  });
});

describe("computeScoringStats", () => {
  it("1. keine Matches: 0/null-Werte, kein Fehler", () => {
    const s = computeScoringStats([]);
    assert.equal(s.total180, 0);
    assert.equal(s.avg180PerMatch, null);
    assert.equal(s.avgFirst9, null);
    assert.equal(s.highestCheckout, null);
  });

  it("2. total180 wird summiert, avg180PerMatch nur über Matches mit dem Feld gemittelt", () => {
    const s = computeScoringStats([
      record({ matchId: "a", players: [ player({ index: 0, total180: 3 }), player({ index: 1 }) ] }),
      record({ matchId: "b", players: [ player({ index: 0, total180: 1 }), player({ index: 1 }) ] }),
    ]);
    assert.equal(s.total180, 4);
    assert.equal(s.avg180PerMatch, 2);
  });

  it("3. highestCheckout ist das Maximum, nicht die Summe", () => {
    const s = computeScoringStats([
      record({ matchId: "a", players: [ player({ index: 0, checkoutPoints: 40 }), player({ index: 1 }) ] }),
      record({ matchId: "b", players: [ player({ index: 0, checkoutPoints: 121 }), player({ index: 1 }) ] }),
      record({ matchId: "c", players: [ player({ index: 0, checkoutPoints: 90 }), player({ index: 1 }) ] }),
    ]);
    assert.equal(s.highestCheckout, 121);
  });

  it("4. avgFirst9 nur über Matches, die das Feld führen (nicht jede Variante hat es)", () => {
    const s = computeScoringStats([
      record({ matchId: "a", players: [ player({ index: 0, first9Average: 90 }), player({ index: 1 }) ] }),
      record({ matchId: "b", players: [ player({ index: 0 }), player({ index: 1 }) ] }), // kein first9Average
    ]);
    assert.equal(s.avgFirst9, 90);
  });
});

describe("computeLegSetStats", () => {
  it("1. legsWon/legsLost korrekt gegen alle Gegner summiert", () => {
    const s = computeLegSetStats([ record() ]); // me: legs=3, opponent: legs=1
    assert.equal(s.legsWon, 3);
    assert.equal(s.legsLost, 1);
  });

  it("2. setsWon/setsLost sind null, wenn keine Variante Sets führt", () => {
    const s = computeLegSetStats([ record() ]); // players haben kein sets-Feld
    assert.equal(s.setsWon, null);
    assert.equal(s.setsLost, null);
  });

  it("3. setsWon/setsLost werden gezählt, sobald mindestens ein Match Sets führt", () => {
    const s = computeLegSetStats([
      record({
        players: [
          player({ index: 0, legs: 3, sets: 2 }),
          player({ index: 1, legs: 1, sets: 0 }),
        ],
      }),
    ]);
    assert.equal(s.setsWon, 2);
    assert.equal(s.setsLost, 0);
  });
});

describe("computeAverageTrend", () => {
  it("1. sortiert chronologisch aufsteigend (älteste zuerst)", () => {
    const trend = computeAverageTrend([
      record({ matchId: "neu", recordedAt: "2026-08-17T10:00:00.000Z", players: [ player({ index: 0, average: 70 }), player({ index: 1 }) ] }),
      record({ matchId: "alt", recordedAt: "2026-08-10T10:00:00.000Z", players: [ player({ index: 0, average: 50 }), player({ index: 1 }) ] }),
    ]);
    assert.deepEqual(trend.map(p => p.matchId), [ "alt", "neu" ]);
  });

  it("2. Matches ohne average werden ausgelassen", () => {
    const trend = computeAverageTrend([
      record({ matchId: "a", players: [ player({ index: 0 }), player({ index: 1 }) ] }),
    ]);
    assert.equal(trend.length, 0);
  });

  it("3. leere Liste ergibt leeren Trend", () => {
    assert.deepEqual(computeAverageTrend([]), []);
  });
});

describe("computeRecentForm", () => {
  it("1. neueste zuerst, begrenzt auf `count`", () => {
    const records = [ 1, 2, 3 ].map(n => record({
      matchId: `m${n}`,
      recordedAt: `2026-08-1${n}T10:00:00.000Z`,
    }));
    const form = computeRecentForm(records, 2);
    assert.equal(form.length, 2);
    assert.equal(form[0].matchId, "m3");
    assert.equal(form[1].matchId, "m2");
  });

  it("2. unentschiedenes Match hat won=null, nicht false", () => {
    const form = computeRecentForm([ record({ winnerIndex: undefined, quality: "MINIMAL" }) ]);
    assert.equal(form[0].won, null);
  });
});

describe("computeQualityBreakdown", () => {
  it("1. zählt alle drei Stufen korrekt, auch bei 0 in einer Kategorie", () => {
    const b = computeQualityBreakdown([
      record({ matchId: "a", quality: "COMPLETE" }),
      record({ matchId: "b", quality: "COMPLETE" }),
      record({ matchId: "c", quality: "PARTIAL" }),
    ]);
    assert.deepEqual(b, { complete: 2, partial: 1, minimal: 0 });
  });
});

describe("filterStatisticsRecords / sortStatisticsRecords / extractStatisticsGameModes", () => {
  const records = [
    record({ matchId: "a", gameMode: "X01", recordedAt: "2026-08-01T10:00:00.000Z" }),
    record({ matchId: "b", gameMode: "Cricket", recordedAt: "2026-08-10T10:00:00.000Z" }),
    record({ matchId: "c", gameMode: "X01", recordedAt: "2026-08-15T10:00:00.000Z" }),
  ];

  it("1. gameMode-Filter reduziert korrekt", () => {
    const filtered = filterStatisticsRecords(records, { period: "all", gameMode: "X01" });
    assert.deepEqual(filtered.map(r => r.matchId), [ "a", "c" ]);
  });

  it("2. period=all lässt alles durch", () => {
    const filtered = filterStatisticsRecords(records, DEFAULT_STATISTICS_FILTERS);
    assert.equal(filtered.length, 3);
  });

  it("3. sortStatisticsRecords sortiert neueste zuerst", () => {
    const sorted = sortStatisticsRecords(records);
    assert.deepEqual(sorted.map(r => r.matchId), [ "c", "b", "a" ]);
  });

  it("4. extractStatisticsGameModes liefert eindeutige, sortierte Modi", () => {
    assert.deepEqual(extractStatisticsGameModes(records), [ "Cricket", "X01" ]);
  });

  it("5. malformed/fehlendes recordedAt bei 30days-Filter wirft nicht, schließt aber aus", () => {
    const broken = [ record({ matchId: "x", recordedAt: "not-a-date" }) ];
    const filtered = filterStatisticsRecords(broken, { period: "30days", gameMode: "all" });
    assert.deepEqual(filtered, []);
  });
});

describe("computeStatisticsOverview (Integration mehrerer Funktionen)", () => {
  it("1. leere Liste: keine Exceptions, alles defensiv null/0", () => {
    const overview = computeStatisticsOverview([]);
    assert.equal(overview.summary.totalMatches, 0);
    assert.equal(overview.averages.average, null);
    assert.equal(overview.scoring.total180, 0);
    assert.equal(overview.trend.length, 0);
    assert.equal(overview.recentForm.length, 0);
  });

  it("2. gameModes stammen aus dem UNGEFILTERTEN Bestand (Filter-Optionen bleiben vollständig)", () => {
    const records = [
      record({ matchId: "a", gameMode: "X01" }),
      record({ matchId: "b", gameMode: "Cricket" }),
    ];
    const overview = computeStatisticsOverview(records, { period: "all", gameMode: "X01" });
    assert.deepEqual(overview.gameModes, [ "Cricket", "X01" ]);
    assert.equal(overview.summary.totalMatches, 1); // aber die KPIs SIND gefiltert
  });

  it("3. defensive Behandlung von grob unvollständigen Records (kein players-Crash)", () => {
    const broken = { ...record(), players: [] } as ICanonicalMatchResult;
    assert.doesNotThrow(() => computeStatisticsOverview([ broken ]));
  });
});
