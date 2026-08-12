/**
 * Tests für die exakte Duplikat-Unterdrückung (P1 Schritt 1).
 *
 * Läuft ohne zusätzliche Abhängigkeit über den Node-eigenen Test-Runner und den
 * bereits vorhandenen tsx-Loader (devDependency):
 *
 *   node --import tsx --test "tests/*.test.ts"
 *
 * utils/event-dedupe.ts ist bewusst import- und seiteneffektfrei, damit hier
 * kein Browser-, WXT- oder Bundler-Kontext nötig ist.
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { createDedupeState, resetDedupeState, shouldProcessSnapshot } from "../utils/event-dedupe";

const MATCH_ID = "3f8b1c2a-4d5e-4f60-9a1b-2c3d4e5f6071";
const OTHER_MATCH_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

/** Minimaler Snapshot in der Form, wie ihn `autodarts.matches` liefert. */
function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: MATCH_ID,
    leg: 1,
    set: 1,
    round: 1,
    player: 0,
    finished: false,
    turns: [ { id: "turn-1", round: 1, turn: 1, throws: [] } ],
    gameScores: [ 501, 501 ],
    ...overrides,
  };
}

function safeClone(value: unknown): unknown {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

/** Das gemeinsame `local:game-data`, das sich beide Bundles teilen. */
function createStore(): { match: unknown } {
  return { match: undefined };
}

/**
 * Eine Content-Script-Instanz mit eigenem Modul-Zustand auf dem gemeinsamen
 * Store – bildet exakt den Ablauf in processWebSocketMessage nach:
 * getValue() → shouldProcessSnapshot() → ggf. setValue().
 */
function createInstance(store: { match: unknown }) {
  const state = createDedupeState();
  return {
    state,
    /** @returns true = verarbeitet und geschrieben, false = unterdrückt */
    deliver(payload: unknown, idOverride?: unknown): boolean {
      const id = arguments.length > 1 ? idOverride : (payload as any)?.id;
      if (!shouldProcessSnapshot(state, id, payload, store.match)) return false;
      store.match = safeClone(payload);
      return true;
    },
  };
}

describe("shouldProcessSnapshot – Grundverhalten", () => {
  it("1. lässt ein identisches Event beim zweiten Mal nicht durch", () => {
    const store = createStore();
    const ws = createInstance(store);

    assert.equal(ws.deliver(snapshot()), true, "erster Snapshot muss durchgehen");
    assert.equal(ws.deliver(snapshot()), false, "byte-identischer Folge-Snapshot muss unterdrückt werden");
    assert.equal(ws.state.suppressed, 1);
  });

  it("1b. unterdrückt auch mehrfach wiederholte identische Events", () => {
    const store = createStore();
    const ws = createInstance(store);

    assert.equal(ws.deliver(snapshot()), true);
    for (let i = 0; i < 5; i++) {
      assert.equal(ws.deliver(snapshot()), false);
    }
    assert.equal(ws.state.suppressed, 5);
  });

  it("2. lässt unterschiedliche Events beide durch", () => {
    const store = createStore();
    const ws = createInstance(store);

    assert.equal(ws.deliver(snapshot()), true);
    assert.equal(ws.deliver(snapshot({ player: 1 })), true);
    assert.equal(ws.state.suppressed, 0);
  });

  it("2b. erkennt auch minimale Änderungen tief im Payload", () => {
    const store = createStore();
    const ws = createInstance(store);

    assert.equal(ws.deliver(snapshot()), true);
    assert.equal(ws.deliver(snapshot({ turns: [ { id: "turn-1", round: 1, turn: 1, throws: [ { id: "t1" } ] } ] })), true);
    assert.equal(ws.state.suppressed, 0);
  });

  it("2c. dedupliziert nicht über verschiedene Match-IDs hinweg", () => {
    const store = createStore();
    const ws = createInstance(store);

    assert.equal(ws.deliver(snapshot()), true);
    assert.equal(ws.deliver({ ...snapshot(), id: OTHER_MATCH_ID }), true);
    assert.equal(ws.state.suppressed, 0);
  });

  it("3. fehlende ID → fail open, Event passiert immer", () => {
    const store = createStore();
    const ws = createInstance(store);
    const payload = { ...snapshot(), id: undefined };

    assert.equal(ws.deliver(payload, undefined), true);
    assert.equal(ws.deliver(payload, undefined), true, "auch die Wiederholung darf nicht verworfen werden");
    assert.equal(ws.deliver(payload, null), true);
    assert.equal(ws.deliver(payload, ""), true, "leerer String ist keine stabile Identität");
    assert.equal(ws.deliver(payload, 42), true, "Nicht-String ist keine stabile Identität");
    assert.equal(ws.state.suppressed, 0);
  });

  it("3b. ein Event ohne ID verwirft den gemerkten Zustand (kein Fehl-Drop danach)", () => {
    const store = createStore();
    const ws = createInstance(store);
    const a = snapshot();

    assert.equal(ws.deliver(a), true);
    assert.equal(ws.deliver({ anything: true }, undefined), true);
    assert.equal(ws.deliver(a), true, "nach einem ID-losen Write ist derselbe Payload wieder eine echte Änderung");
    assert.equal(ws.state.suppressed, 0);
  });

  it("3c. nicht serialisierbarer Payload → fail open", () => {
    const store = createStore();
    const ws = createInstance(store);
    const cyclic: Record<string, unknown> = { id: MATCH_ID };
    cyclic.self = cyclic;

    assert.equal(ws.deliver(cyclic), true);
    assert.equal(ws.deliver(cyclic), true);
    assert.equal(ws.state.suppressed, 0);
  });

  it("3d. undefined-Payload → fail open", () => {
    const store = createStore();
    const ws = createInstance(store);

    assert.equal(ws.deliver(undefined, MATCH_ID), true);
    assert.equal(ws.deliver(undefined, MATCH_ID), true);
    assert.equal(ws.state.suppressed, 0);
  });

  it("4. Reload/neue Session: erster Snapshot passiert trotz identischem Vorgänger", () => {
    const store = createStore();
    const before = createInstance(store);

    assert.equal(before.deliver(snapshot()), true);
    assert.equal(before.deliver(snapshot()), false);

    // Reload = frischer Modul-Zustand auf unverändertem Store
    const after = createInstance(store);
    assert.equal(after.deliver(snapshot()), true, "nach Reload darf kein alter Zustand greifen");

    // Expliziter Reset verhält sich identisch
    resetDedupeState(before.state);
    assert.equal(before.deliver(snapshot()), true);
  });

  it("5. schnell aufeinanderfolgende legitime Events werden nicht dedupliziert", () => {
    const store = createStore();
    const ws = createInstance(store);
    const sequence = [
      snapshot({ turns: [ { id: "turn-1", round: 1, turn: 1, throws: [] } ] }),
      snapshot({ turns: [ { id: "turn-1", round: 1, turn: 1, throws: [ { id: "t1" } ] } ] }),
      snapshot({ turns: [ { id: "turn-1", round: 1, turn: 1, throws: [ { id: "t1" }, { id: "t2" } ] } ] }),
      snapshot({ turns: [ { id: "turn-1", round: 1, turn: 1, throws: [ { id: "t1" }, { id: "t2" }, { id: "t3" } ] } ] }),
      snapshot({ player: 1, turns: [ { id: "turn-2", round: 1, turn: 2, throws: [] } ] }),
    ];

    for (const [ i, payload ] of sequence.entries()) {
      assert.equal(ws.deliver(payload), true, `Sequenz-Element ${i} darf nicht unterdrückt werden`);
    }
    assert.equal(ws.state.suppressed, 0);
  });

  it("5b. Zustandsrückkehr A → B → A wird NICHT unterdrückt", () => {
    const store = createStore();
    const ws = createInstance(store);
    const a = snapshot();
    const b = snapshot({ player: 1 });

    assert.equal(ws.deliver(a), true);
    assert.equal(ws.deliver(b), true);
    assert.equal(ws.deliver(a), true, "nur der direkte Vorgänger zählt, kein Set aller gesehenen Payloads");
    assert.equal(ws.state.suppressed, 0);
  });

  it("5c. Schlüsselreihenfolge wird nicht als Duplikat behandelt (kein Fehl-Drop)", () => {
    const store = createStore();
    const ws = createInstance(store);

    assert.equal(ws.deliver({ id: MATCH_ID, leg: 1, player: 0 }), true);
    assert.equal(ws.deliver({ player: 0, leg: 1, id: MATCH_ID }), true);
    assert.equal(ws.state.suppressed, 0);
  });

  it("mutiert den übergebenen Payload nicht", () => {
    const store = createStore();
    const ws = createInstance(store);
    const payload = snapshot();
    const before = JSON.stringify(payload);

    ws.deliver(payload);
    ws.deliver(payload);

    assert.equal(JSON.stringify(payload), before);
  });
});

describe("Regression: REST-Bootstrap und Socket-Pfad als getrennte Instanzen", () => {
  it("A. REST-Snapshot → identischer Socket-Snapshot", () => {
    const store = createStore();
    const rest = createInstance(store);
    const ws = createInstance(store);
    const s = snapshot();

    assert.equal(rest.deliver(s), true, "REST schreibt den Bootstrap-Zustand");
    // Erste Zustellung der Socket-Instanz: deren Zustand ist leer → fail open.
    // Das kostet genau einen wirkungslosen Write und hat Vorrang vor
    // maximaler Unterdrückung (siehe Regel 4 in utils/event-dedupe.ts).
    assert.equal(ws.deliver(s), true);
    // Ab jetzt greift die Unterdrückung auf beiden Achsen.
    assert.equal(ws.deliver(s), false);
    assert.equal(ws.deliver(s), false);
    assert.deepEqual(store.match, JSON.parse(JSON.stringify(s)), "der Zustand bleibt unverändert korrekt");
  });

  it("B. Socket-Snapshot → identischer REST-Snapshot", () => {
    const store = createStore();
    const rest = createInstance(store);
    const ws = createInstance(store);
    const s = snapshot();

    assert.equal(ws.deliver(s), true);
    assert.equal(rest.deliver(s), true, "erste Zustellung der REST-Instanz: fail open");
    assert.equal(rest.deliver(s), false);
    assert.deepEqual(store.match, JSON.parse(JSON.stringify(s)));
  });

  it("C. älterer REST-Snapshot darf den neueren Zustand nicht dauerhaft zurücksetzen", () => {
    const store = createStore();
    const rest = createInstance(store);
    const ws = createInstance(store);
    const s0 = snapshot({ round: 4, gameScores: [ 301, 420 ] });
    const s1 = snapshot({ round: 5, gameScores: [ 141, 420 ] });

    // Socket ist bereits auf dem neueren Stand und unterdrückt Wiederholungen.
    assert.equal(ws.deliver(s1), true);
    assert.equal(ws.deliver(s1), false);
    assert.deepEqual(store.match, JSON.parse(JSON.stringify(s1)));

    // Der verzögerte REST-Bootstrap schreibt den älteren Stand (vorbestehendes
    // Verhalten, nicht Teil von P1).
    assert.equal(rest.deliver(s0), true);
    assert.deepEqual(store.match, JSON.parse(JSON.stringify(s0)));

    // Kern der Korrektur: der nächste identische Socket-Frame wird NICHT mehr
    // unterdrückt und stellt den neueren Zustand wieder her.
    assert.equal(ws.deliver(s1), true, "Achse 2 macht den Fremd-Write sichtbar");
    assert.deepEqual(store.match, JSON.parse(JSON.stringify(s1)));
  });

  it("C2. ohne Fremd-Write bleibt die Unterdrückung erhalten (keine Wirkungslosigkeit)", () => {
    const store = createStore();
    const ws = createInstance(store);
    const s1 = snapshot({ round: 5 });

    assert.equal(ws.deliver(s1), true);
    assert.equal(ws.deliver(s1), false);
    assert.equal(ws.deliver(s1), false);
    assert.equal(ws.state.suppressed, 2, "die Unterdrückung wirkt weiterhin");
  });

  it("D. neuerer Socket-Snapshot muss passieren", () => {
    const store = createStore();
    const rest = createInstance(store);
    const ws = createInstance(store);
    const s0 = snapshot({ round: 4 });
    const s1 = snapshot({ round: 5 });

    assert.equal(rest.deliver(s0), true);
    assert.equal(ws.deliver(s1), true, "neuerer Snapshot ist inhaltlich verschieden");
    assert.deepEqual(store.match, JSON.parse(JSON.stringify(s1)));
    assert.equal(ws.state.suppressed, 0);
  });

  it("E. gleiche Match-ID + geänderte Daten muss passieren – auch über Instanzen hinweg", () => {
    const store = createStore();
    const rest = createInstance(store);
    const ws = createInstance(store);

    assert.equal(rest.deliver(snapshot({ leg: 1 })), true);
    assert.equal(ws.deliver(snapshot({ leg: 1, player: 1 })), true);
    assert.equal(ws.deliver(snapshot({ leg: 2 })), true);
    assert.equal(rest.deliver(snapshot({ leg: 2, finished: true })), true);
    assert.equal(ws.state.suppressed + rest.state.suppressed, 0, "keine einzige Unterdrückung bei geänderten Daten");
  });

  it("F. Reload / neue Instanz = fail open, auch bei passendem Store-Inhalt", () => {
    const store = createStore();
    const ws = createInstance(store);
    const s = snapshot();

    assert.equal(ws.deliver(s), true);
    assert.equal(ws.deliver(s), false);

    const afterReload = createInstance(store);
    assert.equal(afterReload.deliver(s), true, "neue Instanz darf nie durch fremden Zustand blockiert werden");
    assert.equal(afterReload.state.suppressed, 0);
  });

  it("G. veralteter Store-Read während eines laufenden Writes erzeugt keinen Fehl-Drop", () => {
    // setValue() ist im Produktionscode nicht awaited und @wxt-dev/storage hat
    // keinen Cache. Ein Read kann daher einen älteren Wert liefern. Achse 1
    // verhindert, dass daraus eine falsche Unterdrückung wird.
    const store = createStore();
    const ws = createInstance(store);
    const a = snapshot({ round: 5 });
    const b = snapshot({ round: 6 });

    assert.equal(ws.deliver(a), true);
    assert.equal(ws.deliver(b), true);
    // Write von b ist noch "in flight" – der Store zeigt noch a.
    store.match = safeClone(a);
    assert.equal(ws.deliver(a), true, "Achse 1 kennt b als Vorgänger und lässt a durch");
    assert.equal(ws.state.suppressed, 0);
  });
});

describe("Lifecycle des gemeinsamen Zustands", () => {
  it("Matchwechsel: neues Match passiert immer", () => {
    const store = createStore();
    const ws = createInstance(store);

    assert.equal(ws.deliver(snapshot()), true);
    assert.equal(ws.deliver(snapshot()), false);
    assert.equal(ws.deliver({ ...snapshot(), id: OTHER_MATCH_ID }), true, "andere Match-ID");
  });

  it("Legwechsel: neues Leg passiert immer", () => {
    const store = createStore();
    const ws = createInstance(store);

    assert.equal(ws.deliver(snapshot({ leg: 1, gameScores: [ 12, 40 ] })), true);
    assert.equal(ws.deliver(snapshot({ leg: 1, gameScores: [ 12, 40 ] })), false);
    assert.equal(ws.deliver(snapshot({ leg: 2, gameScores: [ 501, 501 ] })), true);
  });

  it("Matchende: die finished-Transition passiert immer", () => {
    const store = createStore();
    const ws = createInstance(store);

    assert.equal(ws.deliver(snapshot({ finished: false })), true);
    assert.equal(ws.deliver(snapshot({ finished: false })), false);
    assert.equal(ws.deliver(snapshot({ finished: true, winner: 0 })), true, "finished-Wechsel darf nie verloren gehen");
  });

  it("SPA-Navigation: Instanz-Zustand überlebt, REST-Bootstrap bleibt wirksam", () => {
    const store = createStore();
    const ws = createInstance(store); // document_start, überlebt SPA-Navigation
    const s1 = snapshot({ round: 5 });

    assert.equal(ws.deliver(s1), true);
    assert.equal(ws.deliver(s1), false);

    // Navigation weg und zurück: match.content wird neu initialisiert und
    // bootstrappt per REST mit frischer Instanz.
    const restAfterNav = createInstance(store);
    const s2 = snapshot({ round: 7 });
    assert.equal(restAfterNav.deliver(s2), true);
    assert.deepEqual(store.match, JSON.parse(JSON.stringify(s2)));

    // Der langlebige Socket-Zustand blockiert nichts.
    assert.equal(ws.deliver(s1), true, "Fremd-Write sichtbar → alter Vorgänger blockiert nicht");
  });
});
