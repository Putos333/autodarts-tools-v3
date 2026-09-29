/**
 * Charakterisierungstest für Phase D (Variante A): `didFinishTransition()` in
 * utils/match-finish.ts ersetzt die zuvor wortgleich in match-card.ts und
 * ft-auto-result.ts duplizierte Match-Ende-Übergangserkennung. Diese Tests
 * verankern die UNVERÄNDERTE Semantik — u. a. gegen die alte Inline-Logik als
 * Referenz über alle Feld-Kombinationen.
 *
 *   node --import tsx --test "tests/*.test.ts"
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { didFinishTransition } from "../utils/match-finish";

type Snap = { finished?: boolean; winner?: number | null };

/** Die ursprüngliche Inline-Logik (match-card.ts / ft-auto-result.ts), 1:1 als Referenz. */
function legacy(prev: Snap | undefined, cur: Snap): boolean {
  const wasFinished = prev?.finished === true;
  const isFinished = cur.finished === true;
  const winnerBecameSet = (cur.winner !== undefined && cur.winner !== null && cur.winner >= 0)
    && (prev?.winner === undefined || prev?.winner === null || (prev?.winner as number) < 0);
  return (!wasFinished && isFinished) || winnerBecameSet;
}

describe("didFinishTransition()", () => {
  it("finished wird neu true (winner bleibt -1) -> true", () => {
    assert.equal(didFinishTransition({ finished: false, winner: -1 }, { finished: true, winner: -1 }), true);
  });

  it("winner wechselt von -1 auf 0 (finished unverändert false) -> true", () => {
    assert.equal(didFinishTransition({ finished: false, winner: -1 }, { finished: false, winner: 0 }), true);
  });

  it("finished und winner kommen in zwei Snapshots: beide Übergänge lösen aus (Dedupe liegt bei den Aufrufern)", () => {
    assert.equal(didFinishTransition({ finished: false, winner: -1 }, { finished: true, winner: -1 }), true);
    assert.equal(didFinishTransition({ finished: true, winner: -1 }, { finished: true, winner: 1 }), true);
  });

  it("laufendes Match (kein Übergang) -> false", () => {
    assert.equal(didFinishTransition({ finished: false, winner: -1 }, { finished: false, winner: -1 }), false);
  });

  it("bereits beendetes Match, wiederholter Snapshot -> false (kein Doppel-Trigger)", () => {
    assert.equal(didFinishTransition({ finished: true, winner: 0 }, { finished: true, winner: 0 }), false);
  });

  it("prev undefined/null (erster Snapshot, Reload) zählt als 'nicht beendet' -> löst bei beendetem cur aus", () => {
    assert.equal(didFinishTransition(undefined, { finished: true, winner: 0 }), true);
    assert.equal(didFinishTransition(null, { finished: true, winner: 0 }), true);
    assert.equal(didFinishTransition(undefined, { finished: false, winner: 1 }), true);
  });

  it("prev undefined, cur läuft noch -> false", () => {
    assert.equal(didFinishTransition(undefined, { finished: false, winner: -1 }), false);
    assert.equal(didFinishTransition(undefined, {}), false);
  });

  it("winner 0 ist ein gültiger Gewinner-Index (nicht als falsy behandeln)", () => {
    assert.equal(didFinishTransition({ winner: -1 }, { winner: 0 }), true);
  });

  it("unterscheidet sich bewusst von didMatchJustFinish: nur finished=true ohne winner löst hier aus", () => {
    assert.equal(didFinishTransition({ finished: false }, { finished: true }), true);
  });

  it("Äquivalenz zur alten Inline-Logik über alle Kombinationen (prev x cur)", () => {
    const finishedValues: Array<boolean | undefined> = [ undefined, false, true ];
    const winnerValues: Array<number | null | undefined> = [ undefined, null, -1, 0, 1 ];
    const snaps: Snap[] = [];
    for (const finished of finishedValues) for (const winner of winnerValues) snaps.push({ finished, winner });

    let compared = 0;
    for (const prev of [ undefined, ...snaps ]) {
      for (const cur of snaps) {
        assert.equal(
          didFinishTransition(prev, cur),
          legacy(prev, cur),
          `Abweichung bei prev=${JSON.stringify(prev)} cur=${JSON.stringify(cur)}`,
        );
        compared++;
      }
    }
    assert.equal(compared, 16 * 15);
  });
});
