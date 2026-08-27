/**
 * Tests für die Live-Checkout-Route (Wave 2, Match Hero).
 *
 * Läuft ohne zusätzliche Abhängigkeit über den Node-eigenen Test-Runner und den
 * bereits vorhandenen tsx-Loader (devDependency):
 *
 *   node --import tsx --test "tests/*.test.ts"
 *
 * utils/checkout-path.ts ist bewusst import- und seiteneffektfrei (kein WXT/Browser-Kontext).
 */

import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { deriveCheckoutPath, NO_CHECKOUT_PATH } from "../utils/checkout-path";
import type { IMatch, IThrow, ITurn } from "../utils/websocket-helpers";

const CHECKOUTS_FIXTURE: Record<number, string> = {
  170: "T20 T20 Bull",
  40: "D20",
};

function throwAt(name: string): IThrow {
  return {
    id: `t-${name}`,
    throw: 1,
    createdAt: "2026-08-26T10:00:00.000Z",
    segment: { name, number: 20, bed: "Triple", multiplier: 3 },
    entry: "manual",
    marks: null,
  };
}

function turn(overrides: Partial<ITurn> = {}): ITurn {
  return {
    id: "turn-1",
    createdAt: "2026-08-26T10:00:00.000Z",
    finishedAt: "",
    round: 12,
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
      { id: "player-a", index: 0, name: "Tim S.", userId: "user-a" },
      { id: "player-b", index: 1, name: "Marc K.", userId: "user-b" },
    ],
    scores: null,
    type: "Local",
    set: 1,
    leg: 1,
    finished: false,
    winner: -1,
    turns: [],
    round: 12,
    player: 0,
    turnScore: 0,
    turnBusted: false,
    gameScores: [170, 341],
    gameFinished: false,
    gameWinner: -1,
    stats: [],
    ...overrides,
  };
  return base as unknown as IMatch;
}

describe("deriveCheckoutPath", () => {
  it("1. kein Match → unsichtbar", () => {
    const result = deriveCheckoutPath(undefined, true, CHECKOUTS_FIXTURE);
    assert.deepEqual(result, NO_CHECKOUT_PATH);
  });

  it("2. nicht X01 (z.B. Cricket) → unsichtbar, obwohl Restscore zufällig in der Tabelle stünde", () => {
    const m = match({ turns: [ turn() ] });
    const result = deriveCheckoutPath(m, false, CHECKOUTS_FIXTURE);
    assert.equal(result.visible, false);
  });

  it("3. Match beendet → unsichtbar", () => {
    const m = match({ finished: true, turns: [ turn() ] });
    const result = deriveCheckoutPath(m, true, CHECKOUTS_FIXTURE);
    assert.equal(result.visible, false);
  });

  it("4. Restscore ist kein gültiger Checkout (nicht in der Tabelle) → unsichtbar", () => {
    const m = match({ gameScores: [169, 341], turns: [ turn() ] });
    const result = deriveCheckoutPath(m, true, CHECKOUTS_FIXTURE);
    assert.equal(result.visible, false);
  });

  it("5. kein laufender Zug (turns leer) → unsichtbar", () => {
    const m = match({ turns: [] });
    const result = deriveCheckoutPath(m, true, CHECKOUTS_FIXTURE);
    assert.equal(result.visible, false);
  });

  it("6. turns[0] gehört laut playerId nicht zum aktiven Spieler → unsichtbar (fail-closed)", () => {
    const m = match({ turns: [ turn({ playerId: "player-b" }) ] });
    const result = deriveCheckoutPath(m, true, CHECKOUTS_FIXTURE);
    assert.equal(result.visible, false);
  });

  it("7. aktiver Spieler ohne id → unsichtbar", () => {
    const m = match({
      players: [ { index: 0, name: "Tim S." } as any, { id: "player-b", index: 1, name: "Marc K." } as any ],
      turns: [ turn() ],
    });
    const result = deriveCheckoutPath(m, true, CHECKOUTS_FIXTURE);
    assert.equal(result.visible, false);
  });

  it("8. Zug ist gebustet → unsichtbar", () => {
    const m = match({ turns: [ turn({ busted: true, throws: [ throwAt("T20") ] }) ] });
    const result = deriveCheckoutPath(m, true, CHECKOUTS_FIXTURE);
    assert.equal(result.visible, false);
  });

  it("9. gültiger Checkout, noch kein Dart geworfen → sichtbar, 3 leere Slots", () => {
    const m = match({ turns: [ turn() ] });
    const result = deriveCheckoutPath(m, true, CHECKOUTS_FIXTURE);
    assert.equal(result.visible, true);
    assert.equal(result.remaining, 170);
    assert.equal(result.suggestion, "T20 T20 Bull");
    assert.equal(result.darts.length, 3);
    assert.deepEqual(result.darts, [
      { hit: false, label: null },
      { hit: false, label: null },
      { hit: false, label: null },
    ]);
  });

  it("10. ein Dart geworfen → nur Slot 1 hit, echtes segment.name unverändert übernommen", () => {
    const m = match({ turns: [ turn({ throws: [ throwAt("T20") ] }) ] });
    const result = deriveCheckoutPath(m, true, CHECKOUTS_FIXTURE);
    assert.equal(result.visible, true);
    assert.deepEqual(result.darts[0], { hit: true, label: "T20" });
    assert.deepEqual(result.darts[1], { hit: false, label: null });
    assert.deepEqual(result.darts[2], { hit: false, label: null });
  });

  it("11. zwei Darts geworfen → Slot 1+2 hit, Slot 3 offen", () => {
    const m = match({ turns: [ turn({ throws: [ throwAt("T20"), throwAt("T20") ] }) ] });
    const result = deriveCheckoutPath(m, true, CHECKOUTS_FIXTURE);
    assert.equal(result.darts.filter(d => d.hit).length, 2);
    assert.equal(result.darts[2].hit, false);
  });

  it("12. abgeschlossener Checkout (3 Darts) → alle 3 Slots hit, Labels stammen 1:1 von den echten Würfen", () => {
    const m = match({ turns: [ turn({ throws: [ throwAt("T20"), throwAt("T20"), throwAt("Bull") ] }) ] });
    const result = deriveCheckoutPath(m, true, CHECKOUTS_FIXTURE);
    assert.deepEqual(result.darts.map(d => d.label), [ "T20", "T20", "Bull" ]);
    assert.ok(result.darts.every(d => d.hit));
  });

  it("13. Spielerwechsel (anderer aktiver Spieler, eigener gültiger Checkout) → korrekt für den neuen Spieler", () => {
    const m = match({
      player: 1,
      gameScores: [500, 40],
      turns: [ turn({ playerId: "player-b" }) ],
    });
    const result = deriveCheckoutPath(m, true, CHECKOUTS_FIXTURE);
    assert.equal(result.visible, true);
    assert.equal(result.remaining, 40);
    assert.equal(result.suggestion, "D20");
  });

  it("14. Reset zwischen Zügen ist reine Neuberechnung — derselbe Aufruf mit frischem Zug liefert wieder 3 leere Slots", () => {
    const finishedTurn = match({ turns: [ turn({ throws: [ throwAt("T20"), throwAt("T20"), throwAt("Bull") ] }) ] });
    const afterCheckoutResult = deriveCheckoutPath(finishedTurn, true, CHECKOUTS_FIXTURE);
    assert.ok(afterCheckoutResult.darts.every(d => d.hit));

    // Neues Leg/neuer Zug: frisches IMatch, keine übrig gebliebenen Darts aus dem vorigen Aufruf.
    const nextLeg = match({ leg: 2, turns: [ turn({ id: "turn-2" }) ] });
    const nextResult = deriveCheckoutPath(nextLeg, true, CHECKOUTS_FIXTURE);
    assert.ok(nextResult.darts.every(d => !d.hit));
  });
});

// ── Regression-Anker ────────────────────────────────────────────────────────
//
// Reine Quelltext-Prüfungen (wie tests/lifecycle-contracts.test.mjs), damit
// eine spätere, unbeabsichtigte Änderung an den Sicherheits-Bedingungen oder
// am bestehenden Hero-Markup hier auffällt, statt still zu regressieren.

async function source(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("Wave 2 checkout path — Regression", () => {
  it("utils/checkout-path.ts behält die fail-closed Identitäts- und Bust-Guards", async () => {
    const text = await source("utils/checkout-path.ts");
    assert.match(text, /turn\.playerId !== activePlayer\.id/, "identity guard missing");
    assert.match(text, /turn\.busted/, "busted guard missing");
    assert.match(text, /match\.finished/, "finished guard missing");
  });

  it("CcMatchHero.vue behält das bestehende Duell-Layout und den Empty-State (Wave 1 unangetastet)", async () => {
    const text = await source("components/ControlCenter/CcMatchHero.vue");
    assertContains(text, [
      /data-testid="cc-hero"/,
      /heroPair\.left\.name/,
      /heroPair\.right\.name/,
      /Kein aktives Match/,
      /data-testid="cc-hero-open-autodarts"/,
    ], "CcMatchHero.vue Wave 1 markup");
  });

  it("CcMatchHero.vue rendert die Checkout-Route weiterhin gated auf heroPair + liveThrow.hasTurn + checkoutPath.visible", async () => {
    // Seit der visuellen Konsolidierung (Wave 2) teilen sich Live-Darts und
    // Checkout-Route EINEN physischen Slot: äußeres Gate unverändert
    // (heroPair + liveThrow.hasTurn), innen entscheidet ein v-if/v-else
    // zwischen den beiden Zweigen — nie beide, nie keiner.
    const text = await source("components/ControlCenter/CcMatchHero.vue");
    assert.match(text, /v-if="heroPair && liveThrow\.hasTurn"/, "throw zone must stay gated on heroPair + liveThrow.hasTurn");
    assert.match(text, /<template v-if="checkoutPath\.visible">/, "checkout branch must be the exclusive v-if branch");
    assert.match(text, /data-testid="cc-checkout-path"/, "checkout path testid missing");
  });

  it("Checkout-Route importiert keine Werte aus geschützten P1/CMR-Dateien", async () => {
    const text = await source("utils/checkout-path.ts");
    assert.doesNotMatch(text, /from ["']\.\/(canonical-match-result|event-dedupe)["'];?\s*$/m, "value import from protected module");
    assert.match(text, /import type \{ IMatch, IPlayer, ITurn \} from "\.\/websocket-helpers"/, "expected type-only import from websocket-helpers");
  });
});

function assertContains(text: string, patterns: RegExp[], label: string): void {
  for (const pattern of patterns) {
    assert.match(text, pattern, `${label}: missing ${pattern}`);
  }
}
