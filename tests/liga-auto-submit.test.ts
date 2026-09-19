/**
 * Regression test für utils/liga-api.ts's ligaAutoSubmit(): die automatische
 * Liga-Ergebnisübermittlung feuerte in der Praxis NIE.
 *
 * `gameData` (der Wert von AutodartsToolsGameData) hat laut
 * utils/game-data-storage.ts nur die Form { private, gameMode, match }.
 * gameState/status/matchId/id/players/variant existieren NIRGENDS auf
 * gameData selbst, nur (teilweise, unter anderem Namen) auf gameData.match.
 * Die ursprüngliche Implementierung prüfte
 * `gameData?.gameState === 'finished' || gameData?.status === 'finished'`
 * direkt auf `gameData` (getypt als `any`, daher kein Compile-Fehler) — das
 * war für JEDEN Snapshot `false`, die Übermittlung fand also nie statt.
 * Dieselbe Bug-Klasse wie das historische R1 (training-mode.ts las früher
 * ebenfalls gameData.gameState/status statt match.finished/match.winner).
 *
 * Fix: `isMatchFinished()` (utils/match-finish.ts — extrahiert, DOM-frei,
 * hier direkt unit-testbar, weil liga-api.ts selbst utils/storage.ts
 * importiert, das WXTs `storage`-Build-Makro voraussetzt) liest die
 * korrekten Felder von IMatch (`finished`/`winner`) statt von IGameData.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { isMatchFinished } from "../utils/match-finish";

describe("isMatchFinished", () => {
  it("regression: match.finished === true -> true (der eigentliche Bug: alte Implementierung prüfte gameData.status statt match.finished)", () => {
    assert.equal(isMatchFinished({ finished: true, winner: 0 }), true);
  });

  it("match.winner >= 0 (auch ohne explizites finished: true) -> true", () => {
    assert.equal(isMatchFinished({ winner: 1 }), true);
  });

  it("laufendes Match (winner === -1, finished fehlt/false) -> false", () => {
    assert.equal(isMatchFinished({ winner: -1 }), false);
    assert.equal(isMatchFinished({ finished: false, winner: -1 }), false);
  });

  it("kein match-Objekt (null/undefined) -> false, kein Crash", () => {
    assert.equal(isMatchFinished(null), false);
    assert.equal(isMatchFinished(undefined), false);
  });

  it("match ohne winner-Feld -> false (kein stiller Fehlalarm bei unvollständigem Snapshot)", () => {
    assert.equal(isMatchFinished({}), false);
  });
});
