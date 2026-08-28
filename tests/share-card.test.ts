/**
 * Regression test für share-card.ts: die Share-Card wurde in der Praxis nie
 * ausgelöst.
 *
 * `winner` ist projektweit sentinel-kodiert: -1 (oder undefined/null) = noch
 * nicht entschieden, >= 0 = Gewinner-Index (siehe match-card.ts:523-524,
 * ft-auto-result.ts:108). Die ursprüngliche Implementierung prüfte
 * `wasFinished` mit `!!old?.match?.winner || old?.match?.winner === 0` — in
 * JavaScript ist `!!(-1) === true` (jede Zahl außer 0 ist truthy), also war
 * `wasFinished` während des GESAMTEN laufenden Matches (winner === -1)
 * fälschlich `true`, auch exakt im Moment des echten Übergangs zu
 * "finished". `renderCard()` feuerte dadurch nie.
 *
 * Fix: `didMatchJustFinish()` (utils/match-finish.ts — extrahiert dorthin,
 * weil share-card.ts selbst utils/storage.ts importiert, das WXTs `storage`-
 * Build-Makro voraussetzt und daher außerhalb des Extension-Kontexts nicht
 * importierbar ist, siehe utils/wled.ts/event-dedupe.ts für dasselbe Muster)
 * nutzt denselben `>= 0`-Sentinel-Vergleich wie der Rest des Codebase statt
 * einer truthy-Prüfung.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { didMatchJustFinish } from "../utils/match-finish";

describe("didMatchJustFinish", () => {
  it("regression: winner geht von -1 (laufendes Match) auf 0 (Sieger) -> true (der eigentliche Bug)", () => {
    assert.equal(didMatchJustFinish(-1, 0), true);
  });

  it("winner geht von undefined (noch nicht initialisiert) auf 1 -> true", () => {
    assert.equal(didMatchJustFinish(undefined, 1), true);
  });

  it("winner geht von null auf 0 -> true", () => {
    assert.equal(didMatchJustFinish(null, 0), true);
  });

  it("winner bleibt -1 (laufendes Match, kein Übergang) -> false", () => {
    assert.equal(didMatchJustFinish(-1, -1), false);
  });

  it("winner war bereits gesetzt (bereits beendetes Match, z.B. Re-Render/Replay-Snapshot) -> false, kein Doppel-Trigger", () => {
    assert.equal(didMatchJustFinish(0, 0), false);
    assert.equal(didMatchJustFinish(0, 1), false);
  });

  it("newWinner ist kein finished-Zustand (z.B. weiterhin -1 oder kein number) -> false", () => {
    assert.equal(didMatchJustFinish(-1, undefined), false);
    assert.equal(didMatchJustFinish(-1, null), false);
  });
});
