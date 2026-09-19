/**
 * Tests für utils/control-center-data-state.ts (Issue #13, #7).
 *
 *   node --import tsx --test "tests/*.test.ts"
 *
 * Reine Klassifikationsfunktion, kein Browser-/WXT-Kontext nötig.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { deriveCcDataState, type ICcDataStateInput } from "../utils/control-center-data-state";

function input(overrides: Partial<ICcDataStateInput> = {}): ICcDataStateInput {
  return { loading: false, error: false, hasData: false, ...overrides };
}

describe("deriveCcDataState", () => {
  it("1. loading gewinnt gegen alles andere — der erste Ladevorgang läuft noch", () => {
    assert.equal(
      deriveCcDataState(input({ loading: true, error: true, hasData: true, identityRequired: true })),
      "loading",
    );
  });

  it("2. kein Data + Fehler -> unavailable", () => {
    assert.equal(deriveCcDataState(input({ error: true, hasData: false })), "unavailable");
  });

  it("3. kein Data, kein Fehler -> no_data (wirklich leer)", () => {
    assert.equal(deriveCcDataState(input({ hasData: false })), "no_data");
  });

  it("4. Daten vorhanden, ein SPÄTERER Refresh ist fehlgeschlagen -> weiterhin normal rendern (hasData gewinnt gegen error, keine bereits geladenen guten Daten verstecken)", () => {
    assert.equal(deriveCcDataState(input({ hasData: true, error: true })), null);
  });

  it("5. Daten vorhanden, Identität nicht gefordert -> normal rendern", () => {
    assert.equal(deriveCcDataState(input({ hasData: true })), null);
  });

  it("6. Daten vorhanden, Identität gefordert aber unbekannt -> identity_unknown", () => {
    assert.equal(
      deriveCcDataState(input({ hasData: true, identityRequired: true, identityKnown: false })),
      "identity_unknown",
    );
  });

  it("7. Daten vorhanden, Identität gefordert und bekannt -> normal rendern", () => {
    assert.equal(
      deriveCcDataState(input({ hasData: true, identityRequired: true, identityKnown: true })),
      null,
    );
  });

  it("8. keine Daten -> no_data, auch wenn Identität zusätzlich unbekannt ist (nichts zuzuordnen, kein doppelter Sonderzustand)", () => {
    assert.equal(
      deriveCcDataState(input({ hasData: false, identityRequired: true, identityKnown: false })),
      "no_data",
    );
  });
});
