/**
 * Tests für die Live Throw Area (Wave 2, Match Center Slice 1).
 *
 * Läuft ohne zusätzliche Abhängigkeit über den Node-eigenen Test-Runner und den
 * bereits vorhandenen tsx-Loader (devDependency):
 *
 *   node --import tsx --test "tests/*.test.ts"
 *
 * utils/live-throw.ts ist bewusst import- und seiteneffektfrei (kein WXT/Browser-Kontext).
 */

import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { deriveLiveThrow } from "../utils/live-throw";
import type { IMatch, IThrow, ITurn } from "../utils/websocket-helpers";

function throwAt(name: string): IThrow {
  return {
    id: `t-${name}-${Math.random()}`,
    throw: 1,
    createdAt: "2026-08-26T10:00:00.000Z",
    segment: { name, number: 20, bed: "Triple", multiplier: 3 },
    entry: "manual",
    marks: null,
  };
}

function turn(overrides: Partial<ITurn> = {}): ITurn {
  return {
    id: "turn-x",
    createdAt: "2026-08-26T10:00:00.000Z",
    finishedAt: "",
    round: 5,
    turn: 1,
    playerId: "player-a",
    score: 0,
    points: 0,
    marks: null,
    busted: false,
    throws: [],
    ...overrides,
  };
}

function match(overrides: Partial<IMatch> = {}): IMatch {
  const base = {
    id: "match-1",
    createdAt: "2026-08-26T09:00:00.000Z",
    host: {},
    variant: "X01",
    settings: {},
    players: [
      { id: "player-a", index: 0, name: "Tim S." },
      { id: "player-b", index: 1, name: "Marc K." },
    ],
    scores: null,
    type: "Local",
    set: 1,
    leg: 1,
    finished: false,
    winner: -1,
    turns: [],
    round: 5,
    player: 0,
    turnScore: 0,
    turnBusted: false,
    gameScores: [301, 301],
    gameFinished: false,
    gameWinner: -1,
    stats: [],
    ...overrides,
  };
  return base as unknown as IMatch;
}

describe("deriveLiveThrow", () => {
  it("1. kein Match → hasTurn=false", () => {
    const result = deriveLiveThrow(undefined);
    assert.equal(result.hasTurn, false);
    assert.deepEqual(result.darts, []);
    assert.equal(result.visitScore, null);
    assert.equal(result.previousVisit, null);
  });

  it("2. Match beendet → hasTurn=false, obwohl turns[0] existiert", () => {
    const m = match({ finished: true, turns: [ turn({ throws: [ throwAt("T20") ] }) ] });
    const result = deriveLiveThrow(m);
    assert.equal(result.hasTurn, false);
  });

  it("3. keine Turns → hasTurn=false", () => {
    const m = match({ turns: [] });
    const result = deriveLiveThrow(m);
    assert.equal(result.hasTurn, false);
  });

  it("4. laufender Zug, noch kein Dart geworfen → 3 leere Slots, visitScore=0, keine vorige Runde", () => {
    const m = match({ turns: [ turn({ points: 0 }) ] });
    const result = deriveLiveThrow(m);
    assert.equal(result.hasTurn, true);
    assert.deepEqual(result.darts, [
      { hit: false, label: null },
      { hit: false, label: null },
      { hit: false, label: null },
    ]);
    assert.equal(result.visitScore, 0);
    assert.equal(result.previousVisit, null);
  });

  it("5. ein Dart geworfen → nur Slot 1 hit, echtes segment.name unverändert", () => {
    const m = match({ turns: [ turn({ points: 20, throws: [ throwAt("T20") ] }) ] });
    const result = deriveLiveThrow(m);
    assert.deepEqual(result.darts[0], { hit: true, label: "T20" });
    assert.equal(result.darts[1].hit, false);
    assert.equal(result.visitScore, 20);
  });

  it("6. drei Darts geworfen → alle 3 Slots hit, Labels 1:1 von den echten Würfen", () => {
    const m = match({ turns: [ turn({ points: 100, throws: [ throwAt("T20"), throwAt("S20"), throwAt("T20") ] }) ] });
    const result = deriveLiveThrow(m);
    assert.deepEqual(result.darts.map(d => d.label), [ "T20", "S20", "T20" ]);
    assert.ok(result.darts.every(d => d.hit));
  });

  it("7. voriger Visit wird über playerId gefunden, NICHT über einen festen Array-Index (überspringt den Gegner-Zug dazwischen)", () => {
    const m = match({
      turns: [
        turn({ id: "t3", playerId: "player-a", points: 45, throws: [ throwAt("S15") ] }), // aktueller Zug von Tim
        turn({ id: "t2", playerId: "player-b", points: 60, throws: [ throwAt("S20") ] }),  // Marcs letzter Zug (dazwischen)
        turn({ id: "t1", playerId: "player-a", points: 96, throws: [ throwAt("T19"), throwAt("T19"), throwAt("D6") ] }), // Tims vorheriger Zug
      ],
    });
    const result = deriveLiveThrow(m);
    assert.equal(result.visitScore, 45, "aktueller Visit ist turns[0], Tims laufender Zug");
    assert.ok(result.previousVisit, "vorige Runde muss gefunden werden");
    assert.equal(result.previousVisit!.score, 96, "vorige Runde muss Tims EIGENER letzter Zug sein (96), nicht Marcs (60)");
    assert.deepEqual(result.previousVisit!.darts, [ "T19", "T19", "D6" ]);
  });

  it("8. kein vorheriger eigener Zug vorhanden (erster Visit des Legs) → previousVisit=null", () => {
    const m = match({
      turns: [
        turn({ id: "t1", playerId: "player-a", points: 60, throws: [ throwAt("T20") ] }),
      ],
    });
    const result = deriveLiveThrow(m);
    assert.equal(result.previousVisit, null);
  });

  it("9. defensiv gegen unvollständige Turn-Daten (throws fehlt) → keine Exception, leere Slots", () => {
    const m = match({ turns: [ { ...turn(), throws: undefined as any } ] });
    const result = deriveLiveThrow(m);
    assert.equal(result.hasTurn, true);
    assert.ok(result.darts.every(d => !d.hit));
  });
});

async function source(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function assertContains(text: string, patterns: RegExp[], label: string): void {
  for (const pattern of patterns) {
    assert.match(text, pattern, `${label}: missing ${pattern}`);
  }
}

describe("Wave 2 Slice 1 — Regression", () => {
  it("utils/live-throw.ts bleibt unabhängig von utils/checkout-path.ts (kein Import, kein geteilter Helper)", async () => {
    const text = await source("utils/live-throw.ts");
    assert.doesNotMatch(text, /from ["']\.\/checkout-path["']/, "live-throw.ts must not import from checkout-path.ts");
  });

  it("utils/live-throw.ts importiert nur Typen aus websocket-helpers, keine Werte aus geschützten P1/CMR-Dateien", async () => {
    const text = await source("utils/live-throw.ts");
    assert.match(text, /import type \{ IMatch, ITurn \} from "\.\/websocket-helpers"/, "expected type-only import");
    assert.doesNotMatch(text, /from ["']\.\/(canonical-match-result|event-dedupe)["']/, "value import from protected module");
  });

  it("CcMatchHero.vue zeigt den generischen Darts-Track und die Checkout-Route nie gleichzeitig (EIN Slot, v-if/v-else)", async () => {
    // Seit der visuellen Konsolidierung teilen sich beide denselben
    // physischen Slot (.cc-throw-zone) statt zweier unabhängig geprüfter
    // v-if-Blöcke. Ein v-if/v-else-Zweig auf checkoutPath.visible garantiert
    // strukturell, dass immer genau einer der beiden rendert (nie beide,
    // nie keiner) — geprüft wird hier, dass genau dieses Muster besteht.
    const text = await source("components/ControlCenter/CcMatchHero.vue");
    assert.match(text, /<template v-if="checkoutPath\.visible">/, "checkout branch missing");
    assert.match(text, /<template v-else>[\s\S]*data-testid="cc-live-throw"/, "live-throw else-branch missing or reordered");
    assert.match(text, /v-if="heroPair && liveThrow\.hasTurn"/, "throw zone must stay gated on heroPair + hasTurn");
  });

  it("CcMatchHero.vue behält Checkout-Route und bestehendes Wave-1-Markup unangetastet", async () => {
    const text = await source("components/ControlCenter/CcMatchHero.vue");
    assertContains(text, [
      /data-testid="cc-checkout-path"/,
      /<template v-if="checkoutPath\.visible">/,
      /data-testid="cc-hero"/,
      /Kein aktives Match/,
    ], "CcMatchHero.vue existing markup");
  });

  it("useControlCenterStatus.ts surfacet plus100/plus140 real aus matchStats, nicht erfunden", async () => {
    const text = await source("composables/useControlCenterStatus.ts");
    assertContains(text, [
      /plus100\?: number/,
      /plus140\?: number/,
      /matchStats\?\.plus100/,
      /matchStats\?\.plus140/,
      /stat\("plus140", "140\+", player\?\.plus140/,
      /stat\("plus100", "100\+", player\?\.plus100/,
    ], "plus100/plus140 wiring");
  });
});
