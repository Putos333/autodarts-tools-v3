/**
 * Regression test für den Shuffle-Hang-Bug: `handleShuffle()` in
 * `entrypoints/lobby.content/shuffle-players.ts` löste doppelte Spieler-/
 * Bot-Namen (z.B. mehrere Bots mit identischem Anzeigenamen) nicht korrekt
 * auf. `getIndexByPlayerName()` lieferte immer den Index des ERSTEN Treffers,
 * während `playerButtons` (nur nach Name, nicht nach Vorkommen keyed) beim
 * zweiten gleichnamigen Spieler den Klick-Handler des LETZTEN gleichnamigen
 * DOM-Rows überschrieb. Klick-Ziel (letztes Vorkommen) und gemessener Index
 * (erstes Vorkommen) liefen so für jeden zweiten/weiteren gleichnamigen
 * Spieler dauerhaft auseinander — `while (playerIndex !== i)` konnte nie
 * terminieren, der Shuffle-Button blieb für immer auf "Shuffling..." hängen.
 *
 * Fix: `findNthOccurrenceIndex()` — extrahiert, DOM-frei, hier direkt
 * unit-testbar — löst "das n-te Vorkommen dieses Namens" statt "irgendein
 * Vorkommen" auf. `getIndexByPlayerName()` und das `playerButtons`-Keying in
 * `handleShuffle()` nutzen jetzt dieselbe Vorkommen-Zählung konsistent.
 * Zusätzlich ein Hard-Cap (MAX_STEP_CLICKS/MAX_TOTAL_PASSES) als Sicherheitsnetz
 * gegen jeden verbleibenden DOM-Timing-Sonderfall.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { findNthOccurrenceIndex } from "../entrypoints/lobby.content/shuffle-players";

describe("findNthOccurrenceIndex", () => {
  it("findet das 0-te (erste) Vorkommen wie ein simpler indexOf bei eindeutigen Namen", () => {
    const names = [ "Alice", "Bob", "Charlie" ];
    assert.equal(findNthOccurrenceIndex(names, "Bob", 0), 1);
    assert.equal(findNthOccurrenceIndex(names, "Alice", 0), 0);
  });

  it("unterscheidet mehrere gleichnamige Einträge über den occurrence-Parameter (der eigentliche Bugfix)", () => {
    const names = [ "Bot", "Alice", "Bot", "Bob", "Bot" ];
    assert.equal(findNthOccurrenceIndex(names, "Bot", 0), 0, "1. Bot muss Index 0 liefern");
    assert.equal(findNthOccurrenceIndex(names, "Bot", 1), 2, "2. Bot muss Index 2 liefern, nicht wieder 0");
    assert.equal(findNthOccurrenceIndex(names, "Bot", 2), 4, "3. Bot muss Index 4 liefern");
  });

  it("liefert undefined für ein nicht existierendes Vorkommen (z.B. 3. 'Bot' bei nur 2 Vorkommen)", () => {
    const names = [ "Bot", "Alice", "Bot" ];
    assert.equal(findNthOccurrenceIndex(names, "Bot", 2), undefined);
  });

  it("liefert undefined für einen komplett unbekannten Namen", () => {
    const names = [ "Alice", "Bob" ];
    assert.equal(findNthOccurrenceIndex(names, "Charlie", 0), undefined);
  });

  it("behandelt null/undefined-Einträge (nicht extrahierbarer Zeilenname) wie jeden anderen Nicht-Treffer", () => {
    const names = [ null, "Bot", undefined, "Bot" ];
    assert.equal(findNthOccurrenceIndex(names, "Bot", 0), 1);
    assert.equal(findNthOccurrenceIndex(names, "Bot", 1), 3);
  });

  it("regression: die ursprüngliche 'immer erstes Vorkommen'-Logik hätte drei gleichnamige Bots nie sauber sortieren können", () => {
    // Reproduktion der Ausgangslage: 3 Bots mit identischem Namen "Bot".
    // Alte Implementierung (kein occurrence-Parameter) hätte für ALLE drei
    // Zielpositionen denselben Index geliefert -> mind. zwei Zielpositionen
    // wären nie erreichbar gewesen.
    const names = [ "Bot", "Bot", "Bot" ];
    const oldBehaviorAlwaysFirst = () => findNthOccurrenceIndex(names, "Bot", 0);
    assert.equal(oldBehaviorAlwaysFirst(), 0);
    assert.equal(oldBehaviorAlwaysFirst(), 0, "alte Logik liefert für jede Zielposition denselben Index -> Endlosschleife für Positionen 1 und 2");

    // Neue Logik: jede Zielposition bekommt ihr eigenes, tatsächlich erreichbares Vorkommen.
    assert.equal(findNthOccurrenceIndex(names, "Bot", 0), 0);
    assert.equal(findNthOccurrenceIndex(names, "Bot", 1), 1);
    assert.equal(findNthOccurrenceIndex(names, "Bot", 2), 2);
  });
});
