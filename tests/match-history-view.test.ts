/**
 * Tests für utils/match-history-view.ts — bislang ungetestet (siehe Audit).
 *
 *   node --import tsx --test "tests/*.test.ts"
 *
 * match-history-view.ts ist wie utils/statistics.ts import-/seiteneffektfrei,
 * daher hier kein Browser-, WXT- oder Bundler-Kontext nötig.
 *
 * Scope (Phase 2, Player Identity Fix): NUR die identitätsabhängige Funktion
 * computeHistoryKPIs (wins, avgAverage) wird geprüft — computeHistoryKPIs
 * matchte bisher hart gegen `index === 0` statt gegen die echte `userId`.
 * Die COMPLETE-only-Filterung von avgAverage selbst ist unverändert (Phase 3,
 * nicht Teil dieses Fixes) und wird hier bewusst nicht neu bewertet.
 *
 * mapCmrToDisplay/filterHistory/sortHistory/etc. sind nicht identitätsabhängig
 * und bleiben außerhalb dieses gezielten Testumfangs.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import type { ICmrMatchDisplay, ICmrPlayerDisplay } from "../utils/match-history-view";
import { computeHistoryKPIs } from "../utils/match-history-view";

const MY_USER_ID = "user-me";

function playerDisplay(overrides: Partial<ICmrPlayerDisplay> = {}): ICmrPlayerDisplay {
  return { index: 0, name: "Spieler", isWinner: false, ...overrides };
}

function mePlayerDisplay(overrides: Partial<ICmrPlayerDisplay> = {}): ICmrPlayerDisplay {
  return playerDisplay({ userId: MY_USER_ID, ...overrides });
}

function match(overrides: Partial<ICmrMatchDisplay> = {}): ICmrMatchDisplay {
  return {
    matchId: "match-1",
    recordedAt: "2026-08-15T10:00:00.000Z",
    quality: "COMPLETE",
    finished: true,
    winnerIndex: 0,
    revision: 1,
    players: [
      mePlayerDisplay({ index: 0, average: 60, isWinner: true }),
      playerDisplay({ index: 1, average: 50, userId: "opponent" }),
    ],
    ...overrides,
  };
}

describe("computeHistoryKPIs — Player Identity (userId statt Index-0-Annahme)", () => {
  it("CASE A: User = players[0], User gewinnt → Win korrekt", () => {
    const k = computeHistoryKPIs([ match({ winnerIndex: 0 }) ], MY_USER_ID);
    assert.equal(k.wins, 1);
  });

  it("CASE B: User = players[1], User gewinnt → Win korrekt", () => {
    const k = computeHistoryKPIs([
      match({
        winnerIndex: 1,
        players: [ playerDisplay({ index: 0, userId: "opponent" }), mePlayerDisplay({ index: 1 }) ],
      }),
    ], MY_USER_ID);
    assert.equal(k.wins, 1);
  });

  it("CASE C/D: User verliert (an Index 0 oder 1) → kein Win gezählt", () => {
    const userAtIndex0Loses = computeHistoryKPIs([
      match({ winnerIndex: 1 }), // me bleibt an index 0 (Default-Fixture), Gegner an index 1 gewinnt
    ], MY_USER_ID);
    assert.equal(userAtIndex0Loses.wins, 0);

    const userAtIndex1Loses = computeHistoryKPIs([
      match({
        winnerIndex: 0,
        players: [ playerDisplay({ index: 0, userId: "opponent" }), mePlayerDisplay({ index: 1 }) ],
      }),
    ], MY_USER_ID);
    assert.equal(userAtIndex1Loses.wins, 0);
  });

  it("CASE E: User-ID fehlt in players[] → keine falsche Zuordnung zu Index 0", () => {
    const k = computeHistoryKPIs([
      match({
        winnerIndex: 0,
        players: [ playerDisplay({ index: 0, userId: "stranger-a" }), playerDisplay({ index: 1, userId: "stranger-b" }) ],
      }),
    ], MY_USER_ID);
    assert.equal(k.wins, 0, "Match ohne aufgelöste Identität darf keinen Sieg zählen, auch wenn winnerIndex===0");
  });

  it("CASE F: kein/ungültiger Auth-Token (myUserId undefined/null/leer) → 0 Wins, kein Crash", () => {
    const matches = [ match({ winnerIndex: 0 }) ];
    for (const noId of [ undefined, null, "" ] as const) {
      const k = computeHistoryKPIs(matches, noId);
      assert.equal(k.wins, 0);
    }
  });

  it("CASE G: nicht-identitätsabhängige Zähler (total/complete/finished) bleiben unverändert", () => {
    const matches = [
      match({ matchId: "a", quality: "COMPLETE", finished: true }),
      match({ matchId: "b", quality: "PARTIAL", finished: false, winnerIndex: undefined }),
    ];
    const withId = computeHistoryKPIs(matches, MY_USER_ID);
    const withoutId = computeHistoryKPIs(matches, undefined);
    assert.equal(withId.total, 2);
    assert.equal(withId.complete, 1);
    assert.equal(withId.partial, 1);
    assert.equal(withId.finished, 1);
    assert.equal(withId.unfinished, 1);
    // Identitätsunabhängige Felder dürfen sich nicht unterscheiden, egal ob myUserId gesetzt ist.
    assert.equal(withId.total, withoutId.total);
    assert.equal(withId.complete, withoutId.complete);
    assert.equal(withId.finished, withoutId.finished);
  });

  it("avgAverage berücksichtigt nur den aufgelösten 'ich'-Spieler, nicht Index 0 pauschal", () => {
    const k = computeHistoryKPIs([
      match({
        winnerIndex: 1,
        players: [ playerDisplay({ index: 0, userId: "opponent", average: 999 }), mePlayerDisplay({ index: 1, average: 55 }) ],
      }),
    ], MY_USER_ID);
    assert.equal(k.avgAverage, 55, "muss den average des echten 'ich'-Spielers (Index 1) nehmen, nicht den von Index 0");
  });
});
