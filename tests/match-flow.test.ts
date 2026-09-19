/**
 * Tests für Match Flow — letzte Visits & Momentum (Wave 2, Match Center Slice 2).
 *
 *   node --import tsx --test "tests/*.test.ts"
 *
 * utils/match-flow.ts ist bewusst import- und seiteneffektfrei (kein WXT/Browser-Kontext).
 */

import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { deriveMomentum, deriveRecentVisits, MOMENTUM_FLAT_THRESHOLD_PERCENT } from "../utils/match-flow";
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

describe("deriveRecentVisits", () => {
  it("1. kein Match → []", () => {
    assert.deepEqual(deriveRecentVisits(undefined), []);
  });

  it("2. Match beendet → [] (kein stehengebliebener Verlauf nach Matchende)", () => {
    const m = match({ finished: true, turns: [ turn(), turn({ id: "t0" }) ] });
    assert.deepEqual(deriveRecentVisits(m), []);
  });

  it("3. nur der laufende Zug existiert (kein abgeschlossener Visit) → []", () => {
    const m = match({ turns: [ turn({ id: "current" }) ] });
    assert.deepEqual(deriveRecentVisits(m), []);
  });

  it("4. überspringt turns[0] (laufender Zug), zeigt nur abgeschlossene Visits", () => {
    const m = match({
      turns: [
        turn({ id: "current", playerId: "player-a", throws: [ throwAt("T20") ] }),
        turn({ id: "prev-1", playerId: "player-b", points: 60, throws: [ throwAt("S20") ] }),
      ],
    });
    const result = deriveRecentVisits(m);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "prev-1");
  });

  it("5. korrekte Spielerzuordnung über playerId, nicht über Array-Position/Reihenfolge", () => {
    const m = match({
      turns: [
        turn({ id: "current" }),
        turn({ id: "v1", playerId: "player-b", points: 60 }),
        turn({ id: "v2", playerId: "player-a", points: 96 }),
      ],
    });
    const result = deriveRecentVisits(m);
    assert.equal(result[0].playerIndex, 1);
    assert.equal(result[0].playerName, "Marc K.");
    assert.equal(result[1].playerIndex, 0);
    assert.equal(result[1].playerName, "Tim S.");
  });

  it("6. unauflösbare playerId wird verworfen statt geraten (fail-closed)", () => {
    const m = match({
      turns: [
        turn({ id: "current" }),
        turn({ id: "ghost", playerId: "unknown-player", points: 60 }),
        turn({ id: "v1", playerId: "player-a", points: 45 }),
      ],
    });
    const result = deriveRecentVisits(m);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, "v1");
  });

  it("7. respektiert das limit-Argument", () => {
    const m = match({
      turns: [
        turn({ id: "current" }),
        turn({ id: "v1" }), turn({ id: "v2" }), turn({ id: "v3" }), turn({ id: "v4" }), turn({ id: "v5" }),
      ],
    });
    assert.equal(deriveRecentVisits(m, 2).length, 2);
    assert.equal(deriveRecentVisits(m, 10).length, 5);
  });

  it("8. defensiv gegen fehlende throws → leeres darts-Array statt Absturz", () => {
    const m = match({ turns: [ turn({ id: "current" }), { ...turn({ id: "v1" }), throws: undefined as any } ] });
    const result = deriveRecentVisits(m);
    assert.deepEqual(result[0].darts, []);
  });

  it("9. Namens-Fallback bei fehlendem Namen folgt der bestehenden Konvention (\"Spieler N\")", () => {
    const m = match({
      players: [ { id: "player-a", index: 0, name: "" } as any, { id: "player-b", index: 1, name: "Marc K." } as any ],
      turns: [ turn({ id: "current" }), turn({ id: "v1", playerId: "player-a", points: 40 }) ],
    });
    const result = deriveRecentVisits(m);
    assert.equal(result[0].playerName, "Spieler 1");
  });
});

describe("deriveMomentum", () => {
  it("1. kein visitScore → unsichtbar", () => {
    const result = deriveMomentum(undefined, 78);
    assert.equal(result.visible, false);
  });

  it("2. kein average → unsichtbar", () => {
    const result = deriveMomentum(96, undefined);
    assert.equal(result.visible, false);
  });

  it("3. average <= 0 → unsichtbar (keine Division durch 0/negative Werte)", () => {
    const result = deriveMomentum(96, 0);
    assert.equal(result.visible, false);
  });

  it(`4. deutlich über dem eigenen Average (>${MOMENTUM_FLAT_THRESHOLD_PERCENT}%) → "up"`, () => {
    const result = deriveMomentum(96, 78); // +23.1%
    assert.equal(result.visible, true);
    assert.equal(result.trend, "up");
    assert.ok(result.deltaPercent! > MOMENTUM_FLAT_THRESHOLD_PERCENT);
  });

  it(`5. deutlich unter dem eigenen Average (<-${MOMENTUM_FLAT_THRESHOLD_PERCENT}%) → "down"`, () => {
    const result = deriveMomentum(40, 78); // -48.7%
    assert.equal(result.trend, "down");
  });

  it("6. nahe am eigenen Average → \"flat\", kein künstliches up/down bei kleinen Unterschieden", () => {
    const result = deriveMomentum(80, 78); // +2.6%
    assert.equal(result.trend, "flat");
  });

  it("7. deterministische Schwelle: knapp unter dem Grenzwert flat, knapp darüber up (kein Float-Grenzfall-Test wegen Rundung)", () => {
    const average = 100;
    // Bewusst klar auf beiden Seiten der Schwelle statt exakt auf ihr — eine
    // Prüfung exakt AM Schwellwert ist bei Fließkomma-Division unzuverlässig
    // (100 * 1.10 rundet nicht immer exakt zurück auf 10.0%).
    assert.equal(deriveMomentum(average + MOMENTUM_FLAT_THRESHOLD_PERCENT + 1, average).trend, "up");
    assert.equal(deriveMomentum(average + MOMENTUM_FLAT_THRESHOLD_PERCENT - 1, average).trend, "flat");
  });

  it("8. liefert den exakten deltaPercent zur Nachvollziehbarkeit, keine gerundete Blackbox", () => {
    const result = deriveMomentum(96, 78);
    assert.ok(Math.abs(result.deltaPercent! - ((96 - 78) / 78) * 100) < 1e-9);
  });
});

async function source(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("Wave 2 Slice 2 — Regression", () => {
  it("utils/match-flow.ts bleibt unabhängig von checkout-path.ts und live-throw.ts", async () => {
    const text = await source("utils/match-flow.ts");
    assert.doesNotMatch(text, /from ["']\.\/checkout-path["']/);
    assert.doesNotMatch(text, /from ["']\.\/live-throw["']/);
  });

  it("utils/match-flow.ts importiert nur Typen aus websocket-helpers, keine Werte aus geschützten P1/CMR-Dateien", async () => {
    const text = await source("utils/match-flow.ts");
    assert.match(text, /import type \{ IMatch \} from "\.\/websocket-helpers"/);
    assert.doesNotMatch(text, /from ["']\.\/(canonical-match-result|event-dedupe)["']/);
  });

  // Seit der visuellen Konsolidierung (Wave 2) lebt die Match-Flow-Präsentation
  // fusioniert in CcMatchHero.vue statt in der jetzt ungenutzten CcMatchFlow.vue
  // (Datei bleibt unverändert auf der Platte, wird nur nicht mehr gerendert —
  // siehe CcDashboard.vue). Die folgenden Prüfungen zielen daher auf
  // CcMatchHero.vue, wo dasselbe Markup jetzt tatsächlich steht.

  it("das nutzerseitig sichtbare Momentum-Wording impliziert keine Vorhersage/Wahrscheinlichkeit", async () => {
    const componentText = await source("components/ControlCenter/CcMatchHero.vue");
    assert.doesNotMatch(componentText.toLowerCase(), /predict|forecast|wahrscheinlich|prognose|chance/);
  });

  it("CcMatchHero.vue erfindet kein Match-Format (kein legsToWin/setsToWin-Feld, kein gerendertes \"Best of N\")", async () => {
    const text = await source("components/ControlCenter/CcMatchHero.vue");
    assert.doesNotMatch(text, /legsToWin|setsToWin/);
    assert.doesNotMatch(text, /Best of \d/i);
  });

  it("CcMatchHero.vue zeigt den laufenden Zug nicht zusätzlich in den letzten Visits (kein Duplikat zur Throw-Zone)", async () => {
    const text = await source("components/ControlCenter/CcMatchHero.vue");
    assert.doesNotMatch(text, /turns\[0\]/, "must consume recentVisits computed, not raw turns[0]");
    assert.match(text, /recentVisits/);
  });

  it("\"voriger Visit\" hat nach der Konsolidierung genau EINE Heimat (Recent-Visits-Liste, nicht mehr zusätzlich in der Throw-Zone)", async () => {
    // Strukturprüfung statt Phrasensuche: die alte Label-Klasse aus der
    // Throw-Zone darf nicht mehr vorkommen — eine reine Textsuche nach dem
    // Wort würde an der eigenen erklärenden Prosa im Code-Kommentar scheitern.
    const heroText = await source("components/ControlCenter/CcMatchHero.vue");
    assert.doesNotMatch(heroText, /cc-live-visit-label/, "the old duplicate previous-visit markup in the throw zone must be gone");
    // Die Ableitung selbst bleibt unangetastet und weiterhin über das Composable
    // verfügbar — nur diese eine Komponente rendert das Feld nicht mehr inline.
    const composableText = await source("composables/useControlCenterStatus.ts");
    assert.match(composableText, /previousVisit/, "deriveLiveThrow's previousVisit must remain exposed via the composable, not deleted");
  });

  it("Checkout Path und Live Throw teilen sich EINEN physischen Slot (v-if/v-else, nie beide gleichzeitig)", async () => {
    const text = await source("components/ControlCenter/CcMatchHero.vue");
    assert.match(text, /data-testid="cc-checkout-path"/);
    assert.match(text, /data-testid="cc-live-throw"/);
    assert.match(text, /<template v-if="checkoutPath\.visible">/);
    assert.match(text, /<template v-else>/);
  });

  it("Average und Checkout % haben nach der Konsolidierung genau EINE Heimat (Chips), nicht mehr zusätzlich in einem Performance-Grid", async () => {
    const text = await source("components/ControlCenter/CcMatchHero.vue");
    assert.match(text, /cc-hero-chip/, "chips must exist as the canonical home");
    assert.match(text, /performanceTiles/, "performance grid must consume the filtered list, not the raw quickStats");
    assert.match(text, /quickStats\.value\.filter\(stat => stat\.key !== "average" && stat\.key !== "checkout"\)/, "performanceTiles must exclude average/checkout, not just visually hide them");
  });

  it("keine capture-on-leg-end oder Match-Format-Erfassung wurde ergänzt (explizit zurückgestellt)", async () => {
    const composable = await source("composables/useControlCenterStatus.ts");
    assert.doesNotMatch(composable, /lastLeg|legEndCapture|matchFormat/i);
  });
});
