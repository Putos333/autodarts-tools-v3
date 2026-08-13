/**
 * Tests für das Lean Canonical Match Result v1 (P2).
 *
 *   node --import tsx --test "tests/*.test.ts"
 *
 * utils/canonical-match-result.ts ist frei von Laufzeit-Imports, daher ist hier
 * kein Browser-, WXT- oder Bundler-Kontext nötig.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  CMR_RETENTION_LIMIT,
  CMR_SCHEMA_VERSION,
  type ICanonicalMatchResult,
  applyCmrRetention,
  buildCanonicalMatchResult,
  countKnownCmrValues,
  reconcileCanonicalMatchResult,
  sanitizeCanonicalMatchResults,
  upsertCanonicalMatchResult,
} from "../utils/canonical-match-result";
import { createDedupeState, shouldProcessSnapshot } from "../utils/event-dedupe";

const MATCH_ID = "3f8b1c2a-4d5e-4f60-9a1b-2c3d4e5f6071";
const OTHER_MATCH_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const NOW = "2026-08-12T12:00:00.000Z";

function stats(overrides: Record<string, unknown> = {}) {
  return {
    matchStats: {
      average: 92.4,
      dartsThrown: 78,
      total180: 4,
      checkoutPoints: 121,
      first9Average: 101.2,
      ...overrides,
    },
  };
}

/** Vollständiges, beendetes Match in der Form von IMatch. */
function makeMatch(overrides: Record<string, unknown> = {}): any {
  return {
    id: MATCH_ID,
    createdAt: "2026-08-12T10:00:00.000Z",
    variant: "X01",
    type: "Match",
    settings: { mode: "Best of", gameMode: "X01" },
    players: [
      { index: 0, name: "Player A", userId: "user-a", cpuPPR: null },
      { index: 1, name: "Player B", userId: "user-b", cpuPPR: null },
    ],
    scores: [ { legs: 3, sets: 0 }, { legs: 1, sets: 0 } ],
    stats: [ stats(), stats({ average: 84.1, dartsThrown: 84, total180: 1, checkoutPoints: 64, first9Average: 88.0 }) ],
    finished: true,
    winner: 0,
    // Bewusst vorhanden, aber von CMR ignoriert:
    round: 5,
    turns: [ { id: "turn-1", round: 5, throws: [] } ],
    ...overrides,
  };
}

describe("CMR – Aufbau und Vollständigkeitsgrad", () => {
  it("1. vollständiges Match → korrektes CMR (COMPLETE)", () => {
    const cmr = buildCanonicalMatchResult(makeMatch(), NOW)!;

    assert.equal(cmr.schemaVersion, CMR_SCHEMA_VERSION);
    assert.equal(cmr.matchId, MATCH_ID);
    assert.equal(cmr.revision, 1);
    assert.equal(cmr.quality, "COMPLETE");
    assert.equal(cmr.finished, true);
    assert.equal(cmr.winnerIndex, 0);
    assert.equal(cmr.variant, "X01");
    assert.equal(cmr.gameMode, "X01");
    assert.equal(cmr.type, "Match");
    assert.equal(cmr.createdAt, "2026-08-12T10:00:00.000Z");
    assert.equal(cmr.recordedAt, NOW);
    assert.equal(cmr.players.length, 2);
    assert.deepEqual(cmr.players[0], {
      index: 0,
      name: "Player A",
      userId: "user-a",
      isBot: false,
      legs: 3,
      sets: 0,
      average: 92.4,
      checkoutPoints: 121,
      total180: 4,
      dartsThrown: 78,
      first9Average: 101.2,
    });
  });

  it("2. partielles Match → PARTIAL", () => {
    const withoutStats = buildCanonicalMatchResult(makeMatch({ stats: [] }), NOW)!;
    assert.equal(withoutStats.quality, "PARTIAL", "Ergebnis steht fest, Kernstatistik fehlt");

    const withoutScores = buildCanonicalMatchResult(makeMatch({ scores: null }), NOW)!;
    assert.equal(withoutScores.quality, "PARTIAL", "Ergebnis steht fest, Spielstand fehlt");

    const partialStats = buildCanonicalMatchResult(
      makeMatch({ stats: [ stats(), { matchStats: { average: 84.1 } } ] }),
      NOW,
    )!;
    assert.equal(partialStats.quality, "PARTIAL", "einem Spieler fehlt dartsThrown");
  });

  it("3. minimales Match → MINIMAL", () => {
    const running = buildCanonicalMatchResult(makeMatch({ finished: false, winner: -1 }), NOW)!;
    assert.equal(running.quality, "MINIMAL");
    assert.equal(running.winnerIndex, undefined);

    const noWinner = buildCanonicalMatchResult(makeMatch({ winner: -1 }), NOW)!;
    assert.equal(noWinner.quality, "MINIMAL", "finished ohne gültigen Sieger bleibt MINIMAL");

    const solo = buildCanonicalMatchResult(
      makeMatch({ players: [ { index: 0, name: "Solo", cpuPPR: null } ], scores: [ { legs: 1, sets: 0 } ], stats: [ stats() ] }),
      NOW,
    )!;
    assert.equal(solo.quality, "MINIMAL", "weniger als zwei Spieler");
  });

  it("4. fehlende Werte bleiben unbekannt und werden NICHT 0", () => {
    const cmr = buildCanonicalMatchResult(
      makeMatch({
        scores: null,
        stats: [ { matchStats: {} }, { matchStats: {} } ],
        players: [ { index: 0, name: "A" }, { index: 1, name: "B" } ],
        createdAt: "",
      }),
      NOW,
    )!;

    for (const key of [ "legs", "sets", "average", "checkoutPoints", "total180", "dartsThrown", "first9Average" ] as const) {
      assert.equal(cmr.players[0][key], undefined, `${key} muss unbekannt bleiben`);
      assert.notEqual(cmr.players[0][key], 0, `${key} darf nicht zu 0 werden`);
    }
    assert.equal(cmr.players[0].userId, undefined);
    assert.equal(cmr.players[0].isBot, undefined, "ohne cpuPPR ist unbekannt, nicht false");
    assert.equal(cmr.createdAt, undefined, "leerer String ist kein Wert");
  });

  it("4b. eine echte 0 bleibt eine 0", () => {
    const cmr = buildCanonicalMatchResult(
      makeMatch({
        scores: [ { legs: 0, sets: 0 }, { legs: 3, sets: 0 } ],
        stats: [ { matchStats: { average: 0, dartsThrown: 0, total180: 0, checkoutPoints: 0 } }, stats() ],
        winner: 1,
      }),
      NOW,
    )!;

    assert.equal(cmr.players[0].legs, 0);
    assert.equal(cmr.players[0].average, 0);
    assert.equal(cmr.players[0].total180, 0);
    assert.equal(cmr.quality, "COMPLETE", "Nullwerte sind bekannte Werte");
  });

  it("erkennt Bots und ignoriert round/turns vollständig", () => {
    const cmr = buildCanonicalMatchResult(
      makeMatch({ players: [ { index: 0, name: "Me", userId: "user-a", cpuPPR: null }, { index: 1, name: "Bot", cpuPPR: 60 } ] }),
      NOW,
    )!;

    assert.equal(cmr.players[0].isBot, false);
    assert.equal(cmr.players[1].isBot, true);

    const serialized = JSON.stringify(cmr);
    assert.equal(serialized.includes("\"round\""), false, "CMR darf kein round-Feld enthalten");
    assert.equal(serialized.includes("\"turn"), false, "CMR darf nichts aus turns enthalten");
  });

  it("ohne stabile Match-ID entsteht kein CMR", () => {
    assert.equal(buildCanonicalMatchResult(makeMatch({ id: "" }), NOW), null);
    assert.equal(buildCanonicalMatchResult(makeMatch({ id: undefined }), NOW), null);
    assert.equal(buildCanonicalMatchResult(undefined, NOW), null);
    assert.equal(buildCanonicalMatchResult(null, NOW), null);
  });

  it("nutzt user.id als Fallback für userId", () => {
    const cmr = buildCanonicalMatchResult(
      makeMatch({ players: [ { index: 0, name: "A", user: { id: "fallback-a" } }, { index: 1, name: "B", userId: "user-b" } ] }),
      NOW,
    )!;
    assert.equal(cmr.players[0].userId, "fallback-a");
    assert.equal(cmr.players[1].userId, "user-b");
  });

  it("ein winnerIndex außerhalb der Spielerliste wird verworfen", () => {
    const cmr = buildCanonicalMatchResult(makeMatch({ winner: 7 }), NOW)!;
    assert.equal(cmr.winnerIndex, undefined);
    assert.equal(cmr.quality, "MINIMAL");
  });
});

describe("CMR – Revisionslogik", () => {
  it("5. identisches Ergebnis → keine künstliche Revision", () => {
    const first = buildCanonicalMatchResult(makeMatch(), NOW)!;
    const created = reconcileCanonicalMatchResult(undefined, first);
    assert.equal(created.outcome, "created");
    assert.equal(created.record.revision, 1);

    // Gleicher Match-Stand, aber später erzeugt → recordedAt weicht ab.
    const again = buildCanonicalMatchResult(makeMatch(), "2026-08-12T12:05:00.000Z")!;
    const second = reconcileCanonicalMatchResult(created.record, again);
    assert.equal(second.outcome, "unchanged");
    assert.equal(second.record.revision, 1, "recordedAt darf keine neue Revision erzeugen");
  });

  it("6. verbesserte Daten → Revision steigt", () => {
    const partial = buildCanonicalMatchResult(makeMatch({ stats: [] }), NOW)!;
    const complete = buildCanonicalMatchResult(makeMatch(), NOW)!;

    const created = reconcileCanonicalMatchResult(undefined, partial);
    const updated = reconcileCanonicalMatchResult(created.record, complete);

    assert.equal(updated.outcome, "updated");
    assert.equal(updated.record.revision, 2);
  });

  it("7. MINIMAL → PARTIAL", () => {
    const minimal = buildCanonicalMatchResult(makeMatch({ finished: false, winner: -1, stats: [], scores: null }), NOW)!;
    const partial = buildCanonicalMatchResult(makeMatch({ stats: [] }), NOW)!;

    assert.equal(minimal.quality, "MINIMAL");
    assert.equal(partial.quality, "PARTIAL");

    const step = reconcileCanonicalMatchResult({ ...minimal, revision: 1 }, partial);
    assert.equal(step.outcome, "updated");
    assert.equal(step.record.quality, "PARTIAL");
    assert.equal(step.record.revision, 2);
  });

  it("8. PARTIAL → COMPLETE", () => {
    const partial = buildCanonicalMatchResult(makeMatch({ stats: [] }), NOW)!;
    const complete = buildCanonicalMatchResult(makeMatch(), NOW)!;

    const step = reconcileCanonicalMatchResult({ ...partial, revision: 4 }, complete);
    assert.equal(step.outcome, "updated");
    assert.equal(step.record.quality, "COMPLETE");
    assert.equal(step.record.revision, 5);
  });

  it("9. schwächere Daten überschreiben COMPLETE nicht", () => {
    const complete = { ...buildCanonicalMatchResult(makeMatch(), NOW)!, revision: 3 };
    const partial = buildCanonicalMatchResult(makeMatch({ stats: [] }), NOW)!;
    const minimal = buildCanonicalMatchResult(makeMatch({ finished: false, winner: -1 }), NOW)!;

    const viaPartial = reconcileCanonicalMatchResult(complete, partial);
    assert.equal(viaPartial.outcome, "rejected-weaker");
    assert.equal(viaPartial.record.quality, "COMPLETE");
    assert.equal(viaPartial.record.revision, 3);

    const viaMinimal = reconcileCanonicalMatchResult(complete, minimal);
    assert.equal(viaMinimal.outcome, "rejected-weaker");
    assert.equal(viaMinimal.record.quality, "COMPLETE");
  });

  it("9b. gleiche Quality mit weniger Information wird abgelehnt", () => {
    const rich = { ...buildCanonicalMatchResult(makeMatch(), NOW)!, revision: 2 };
    const poor = buildCanonicalMatchResult(
      makeMatch({ stats: [ { matchStats: { average: 92.4, dartsThrown: 78 } }, { matchStats: { average: 84.1, dartsThrown: 84 } } ] }),
      NOW,
    )!;

    assert.equal(rich.quality, poor.quality, "beide COMPLETE");
    assert.ok(countKnownCmrValues(poor) < countKnownCmrValues(rich));

    const result = reconcileCanonicalMatchResult(rich, poor);
    assert.equal(result.outcome, "rejected-weaker");
    assert.equal(result.record.revision, 2);
  });

  it("9c. gleiche Quality mit mehr Information wird übernommen", () => {
    const poorBase = buildCanonicalMatchResult(
      makeMatch({ stats: [ { matchStats: { average: 92.4, dartsThrown: 78 } }, { matchStats: { average: 84.1, dartsThrown: 84 } } ] }),
      NOW,
    )!;
    const poor = { ...poorBase, revision: 1 };
    const rich = buildCanonicalMatchResult(makeMatch(), NOW)!;

    const result = reconcileCanonicalMatchResult(poor, rich);
    assert.equal(result.outcome, "updated");
    assert.equal(result.record.revision, 2);
  });
});

describe("CMR – Sammlung, Retention und Robustheit", () => {
  it("10. zwei unterschiedliche Matches bleiben getrennt", () => {
    const a = buildCanonicalMatchResult(makeMatch(), NOW)!;
    const b = buildCanonicalMatchResult(makeMatch({ id: OTHER_MATCH_ID }), NOW)!;

    let records: ICanonicalMatchResult[] = [];
    records = upsertCanonicalMatchResult(records, a).records;
    records = upsertCanonicalMatchResult(records, b).records;

    assert.equal(records.length, 2);
    assert.deepEqual(records.map(r => r.matchId), [ OTHER_MATCH_ID, MATCH_ID ], "neueste zuerst");
    assert.equal(records.every(r => r.revision === 1), true);
  });

  it("10b. ein Update ersetzt den Eintrag statt ihn zu duplizieren", () => {
    let records: ICanonicalMatchResult[] = [];
    records = upsertCanonicalMatchResult(records, buildCanonicalMatchResult(makeMatch({ stats: [] }), NOW)!).records;
    const second = upsertCanonicalMatchResult(records, buildCanonicalMatchResult(makeMatch(), NOW)!);

    assert.equal(second.outcome, "updated");
    assert.equal(second.records.length, 1);
    assert.equal(second.records[0].revision, 2);
    assert.equal(second.records[0].quality, "COMPLETE");
  });

  it("10c. unchanged und rejected-weaker lassen die Sammlung unangetastet", () => {
    const complete = buildCanonicalMatchResult(makeMatch(), NOW)!;
    const records = upsertCanonicalMatchResult([], complete).records;

    const unchanged = upsertCanonicalMatchResult(records, buildCanonicalMatchResult(makeMatch(), "2026-08-12T13:00:00.000Z")!);
    assert.equal(unchanged.outcome, "unchanged");
    assert.equal(unchanged.records, records, "identische Referenz → kein Storage-Write nötig");

    const weaker = upsertCanonicalMatchResult(records, buildCanonicalMatchResult(makeMatch({ stats: [] }), NOW)!);
    assert.equal(weaker.outcome, "rejected-weaker");
    assert.equal(weaker.records, records);
  });

  it("11. Reload/Persistenz: ein Storage-Roundtrip erhält Stand und Revision", () => {
    let records = upsertCanonicalMatchResult([], buildCanonicalMatchResult(makeMatch({ stats: [] }), NOW)!).records;
    records = upsertCanonicalMatchResult(records, buildCanonicalMatchResult(makeMatch(), NOW)!).records;
    assert.equal(records[0].revision, 2);

    // JSON-Roundtrip = storage.local
    const restored = sanitizeCanonicalMatchResults(JSON.parse(JSON.stringify(records)));
    assert.equal(restored.length, 1);
    assert.equal(restored[0].revision, 2);
    assert.equal(restored[0].quality, "COMPLETE");

    // Nach dem Reload erzeugt derselbe Stand keine neue Revision.
    const again = upsertCanonicalMatchResult(restored, buildCanonicalMatchResult(makeMatch(), "2026-08-12T14:00:00.000Z")!);
    assert.equal(again.outcome, "unchanged");
    assert.equal(again.records[0].revision, 2);
  });

  it("12. Retention-Grenze wird eingehalten", () => {
    let records: ICanonicalMatchResult[] = [];
    for (let i = 0; i < 8; i++) {
      const record = buildCanonicalMatchResult(makeMatch({ id: `match-${i}` }), NOW)!;
      records = upsertCanonicalMatchResult(records, record, 5).records;
    }

    assert.equal(records.length, 5);
    assert.deepEqual(records.map(r => r.matchId), [ "match-7", "match-6", "match-5", "match-4", "match-3" ]);
    assert.deepEqual(applyCmrRetention(records, 2).map(r => r.matchId), [ "match-7", "match-6" ]);
    assert.deepEqual(applyCmrRetention(records, 0), []);
  });

  it("13. korrupter/unbekannter Storage-Eintrag führt nicht zum Absturz", () => {
    const valid = buildCanonicalMatchResult(makeMatch(), NOW)!;
    const corrupt = [
      null,
      undefined,
      42,
      "kaputt",
      [],
      {},
      { matchId: "" },
      { matchId: "no-players", schemaVersion: CMR_SCHEMA_VERSION, revision: 1, quality: "COMPLETE" },
      { ...valid, schemaVersion: 99 },
      { ...valid, matchId: OTHER_MATCH_ID, revision: 0 },
      { ...valid, matchId: "bad-quality", quality: "SUPERB" },
      valid,
      { ...valid, revision: 5 }, // Duplikat derselben matchId
    ];

    const sanitized = sanitizeCanonicalMatchResults(corrupt);
    assert.equal(sanitized.length, 1);
    assert.equal(sanitized[0].matchId, MATCH_ID);
    assert.equal(sanitized[0].revision, 1, "das erste Vorkommen gewinnt");

    assert.deepEqual(sanitizeCanonicalMatchResults(undefined), []);
    assert.deepEqual(sanitizeCanonicalMatchResults({ nope: true }), []);
    assert.deepEqual(sanitizeCanonicalMatchResults("kaputt"), []);

    // Auf der bereinigten Liste lässt sich normal weiterarbeiten.
    const next = upsertCanonicalMatchResult(sanitized, buildCanonicalMatchResult(makeMatch({ id: OTHER_MATCH_ID }), NOW)!);
    assert.equal(next.outcome, "created");
    assert.equal(next.records.length, 2);
  });
});

describe("Safety Review – Nachträge", () => {
  it("eine legitime Korrektur wird nicht durch die Quality-Stufe blockiert", () => {
    const existing = { ...buildCanonicalMatchResult(makeMatch(), NOW)!, revision: 3 };

    // Gleiche Quality, gleiche Anzahl bekannter Werte – nur ein Wert korrigiert.
    const correctedScore = buildCanonicalMatchResult(makeMatch({ scores: [ { legs: 3, sets: 0 }, { legs: 2, sets: 0 } ] }), NOW)!;
    assert.equal(correctedScore.quality, existing.quality);
    assert.equal(countKnownCmrValues(correctedScore), countKnownCmrValues(existing));

    const scoreFix = reconcileCanonicalMatchResult(existing, correctedScore);
    assert.equal(scoreFix.outcome, "updated", "Korrektur bei gleicher Quality muss durchgehen");
    assert.equal(scoreFix.record.revision, 4);
    assert.equal(scoreFix.record.players[1].legs, 2);

    // Auch eine Sieger-Korrektur darf nicht blockiert werden.
    const winnerFix = reconcileCanonicalMatchResult(existing, buildCanonicalMatchResult(makeMatch({ winner: 1 }), NOW)!);
    assert.equal(winnerFix.outcome, "updated");
    assert.equal(winnerFix.record.winnerIndex, 1);
    assert.equal(winnerFix.record.revision, 4);
  });

  it("NaN, Infinity und null werden zu unbekannt, nicht zu 0", () => {
    const cmr = buildCanonicalMatchResult(
      makeMatch({
        stats: [
          { matchStats: { average: Number.NaN, dartsThrown: null, checkoutPoints: Number.POSITIVE_INFINITY, total180: -3 } },
          stats(),
        ],
      }),
      NOW,
    )!;

    assert.equal(cmr.players[0].average, undefined, "NaN ist kein Wert");
    assert.equal(cmr.players[0].dartsThrown, undefined, "null ist kein Wert");
    assert.equal(cmr.players[0].checkoutPoints, undefined, "Infinity ist kein Wert");
    assert.notEqual(cmr.players[0].average, 0);
    assert.notEqual(cmr.players[0].checkoutPoints, 0);
    // Negative Werte werden unverändert durchgereicht – IStats definiert dafür
    // keine Untergrenze, also wird hier nichts erfunden.
    assert.equal(cmr.players[0].total180, -3);
    assert.equal(cmr.quality, "PARTIAL", "unbekannte Kernstatistik verhindert COMPLETE");
  });

  it("Serialisierungs-Roundtrip: fehlender Key und undefined sind gleichwertig", () => {
    const sparse = buildCanonicalMatchResult(
      makeMatch({ scores: null, stats: [ { matchStats: {} }, { matchStats: {} } ] }),
      NOW,
    )!;
    const restored = JSON.parse(JSON.stringify(sparse)) as ICanonicalMatchResult;

    assert.equal(Object.prototype.hasOwnProperty.call(sparse.players[0], "average"), true, "vor dem Roundtrip als undefined vorhanden");
    assert.equal(Object.prototype.hasOwnProperty.call(restored.players[0], "average"), false, "nach dem Roundtrip nicht mehr vorhanden");
    assert.equal(restored.players[0].average, undefined, "der Lesewert bleibt identisch");

    // Entscheidend: der Unterschied darf keine künstliche Revision erzeugen.
    const result = reconcileCanonicalMatchResult({ ...restored, revision: 2 }, sparse);
    assert.equal(result.outcome, "unchanged");
    assert.equal(result.record.revision, 2);
  });

  it("Retention-Grenzen 199 / 200 / 201 mit dem echten Limit", () => {
    const fill = (count: number) => {
      let records: ICanonicalMatchResult[] = [];
      for (let i = 0; i < count; i++) {
        records = upsertCanonicalMatchResult(records, buildCanonicalMatchResult(makeMatch({ id: `match-${i}` }), NOW)!).records;
      }
      return records;
    };

    const at199 = fill(CMR_RETENTION_LIMIT - 1);
    assert.equal(at199.length, CMR_RETENTION_LIMIT - 1, "unterhalb des Limits wird nichts gelöscht");

    const at200 = fill(CMR_RETENTION_LIMIT);
    assert.equal(at200.length, CMR_RETENTION_LIMIT);
    assert.equal(at200[at200.length - 1].matchId, "match-0", "der älteste ist noch da");

    const at201 = fill(CMR_RETENTION_LIMIT + 1);
    assert.equal(at201.length, CMR_RETENTION_LIMIT);
    assert.equal(at201[0].matchId, `match-${CMR_RETENTION_LIMIT}`, "der neueste steht vorn");
    assert.equal(at201[at201.length - 1].matchId, "match-1", "genau der älteste wurde verdrängt");
  });

  it("das gerade aktualisierte CMR wird von der Retention nie verdrängt", () => {
    let records: ICanonicalMatchResult[] = [];
    for (let i = 0; i < 5; i++) {
      records = upsertCanonicalMatchResult(records, buildCanonicalMatchResult(makeMatch({ id: `match-${i}`, stats: [] }), NOW)!, 3).records;
    }
    assert.deepEqual(records.map(r => r.matchId), [ "match-4", "match-3", "match-2" ]);

    // Ältestes noch vorhandenes Match verbessern: es rutscht nach vorn statt rauszufallen.
    const improved = buildCanonicalMatchResult(makeMatch({ id: "match-2" }), NOW)!;
    const result = upsertCanonicalMatchResult(records, improved, 3);

    assert.equal(result.outcome, "updated");
    assert.equal(result.records.length, 3);
    assert.equal(result.records[0].matchId, "match-2");
    assert.equal(result.records[0].quality, "COMPLETE");
    assert.equal(result.records[0].revision, 2);
  });
});

describe("14. P1-Dedupe und CMR gemeinsam", () => {
  /** Bildet den Produktionsweg nach: Dedupe-Gate → Storage → CMR-Emit. */
  function createPipeline() {
    const store: { match: unknown } = { match: undefined };
    const dedupe = createDedupeState();
    let records: ICanonicalMatchResult[] = [];
    let emits = 0;

    return {
      get records() { return records; },
      get emits() { return emits; },
      get suppressed() { return dedupe.suppressed; },
      /** @returns false, wenn P1 den Snapshot unterdrückt hat */
      deliver(match: any, recordedAt: string = NOW): boolean {
        if (!shouldProcessSnapshot(dedupe, match?.id, match, store.match)) return false;
        store.match = JSON.parse(JSON.stringify(match));
        // Emit-Bedingung des Produktions-Watchers: nur beendete Matches.
        if (!(match?.finished === true || (typeof match?.winner === "number" && match.winner >= 0))) return true;
        const record = buildCanonicalMatchResult(match, recordedAt);
        if (!record) return true;
        emits++;
        records = upsertCanonicalMatchResult(records, record).records;
        return true;
      },
    };
  }

  it("ein unterdrückter Duplikat-Snapshot erzeugt keinen CMR-Emit", () => {
    const pipeline = createPipeline();
    const match = makeMatch();

    assert.equal(pipeline.deliver(match), true);
    assert.equal(pipeline.deliver(match), false, "P1 unterdrückt den identischen Snapshot");
    assert.equal(pipeline.deliver(match), false);

    assert.equal(pipeline.suppressed, 2);
    assert.equal(pipeline.emits, 1, "CMR wird nur einmal erzeugt");
    assert.equal(pipeline.records.length, 1);
    assert.equal(pipeline.records[0].revision, 1);
  });

  it("verbesserte Snapshots passieren P1 und erhöhen die CMR-Revision", () => {
    const pipeline = createPipeline();

    pipeline.deliver(makeMatch({ finished: false, winner: -1 }));
    assert.equal(pipeline.emits, 0, "laufendes Match erzeugt kein CMR");

    pipeline.deliver(makeMatch({ stats: [] }));
    assert.equal(pipeline.records[0].quality, "PARTIAL");
    assert.equal(pipeline.records[0].revision, 1);

    pipeline.deliver(makeMatch());
    assert.equal(pipeline.records[0].quality, "COMPLETE");
    assert.equal(pipeline.records[0].revision, 2);
  });

  it("ein Snapshot ohne Match-ID wird von P1 durchgelassen und erzeugt kein CMR", () => {
    const pipeline = createPipeline();
    const noId = makeMatch({ id: undefined });

    assert.equal(pipeline.deliver(noId), true);
    assert.equal(pipeline.deliver(noId), true, "fail open bleibt erhalten");
    assert.equal(pipeline.emits, 0);
    assert.equal(pipeline.records.length, 0);
  });

  it("nach einem Reload bleibt der Stand erhalten und wird nicht künstlich erhöht", () => {
    const first = createPipeline();
    first.deliver(makeMatch());
    const persisted = JSON.parse(JSON.stringify(first.records));

    // Neue Session: frischer Dedupe-Zustand, geladene Records.
    const dedupe = createDedupeState();
    const match = makeMatch();
    assert.equal(shouldProcessSnapshot(dedupe, match.id, match, undefined), true, "erster Snapshot nach Reload passiert");

    const restored = sanitizeCanonicalMatchResults(persisted);
    const result = upsertCanonicalMatchResult(restored, buildCanonicalMatchResult(match, "2026-08-12T15:00:00.000Z")!);
    assert.equal(result.outcome, "unchanged");
    assert.equal(result.records[0].revision, 1);
  });

  it("zwei Matches nacheinander bleiben getrennt", () => {
    const pipeline = createPipeline();

    pipeline.deliver(makeMatch());
    pipeline.deliver(makeMatch());
    pipeline.deliver(makeMatch({ id: OTHER_MATCH_ID }));
    pipeline.deliver(makeMatch({ id: OTHER_MATCH_ID }));

    assert.equal(pipeline.records.length, 2);
    assert.equal(pipeline.suppressed, 2);
    assert.deepEqual(pipeline.records.map(r => r.matchId), [ OTHER_MATCH_ID, MATCH_ID ]);
  });
});
