/**
 * Tests für die Elite-Home-Dashboard-Aktivität (letztes Match, letzte Gegner).
 *
 *   node --import tsx --test "tests/*.test.ts"
 *
 * utils/dashboard-activity.ts ist bewusst import- und seiteneffektfrei.
 */

import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { getLastMatchSummary, getLastPlayedWith, getRecentOpponents } from "../utils/dashboard-activity";
import type { ICanonicalMatchResult, ICmrPlayer } from "../utils/canonical-match-result";

function player(overrides: Partial<ICmrPlayer> = {}): ICmrPlayer {
  return {
    index: 0,
    name: "Tim S.",
    userId: "user-a",
    ...overrides,
  };
}

function record(overrides: Partial<ICanonicalMatchResult> = {}): ICanonicalMatchResult {
  const base = {
    matchId: "m-1",
    recordedAt: "2026-08-26T10:00:00.000Z",
    createdAt: "2026-08-26T09:50:00.000Z",
    variant: "X01",
    gameMode: "X01",
    type: "Local",
    quality: "COMPLETE",
    finished: true,
    winnerIndex: 0,
    revision: 1,
    players: [
      player({ index: 0, name: "Tim S.", userId: "user-a", legs: 3, average: 74.2 }),
      player({ index: 1, name: "Marc K.", userId: "user-b", legs: 1 }),
    ],
    ...overrides,
  };
  return base as unknown as ICanonicalMatchResult;
}

describe("getLastMatchSummary", () => {
  it("1. keine Records → null", () => {
    assert.equal(getLastMatchSummary([], "user-a"), null);
  });

  it("2. Sieg wird korrekt erkannt (winnerIndex === meine Position, per userId aufgelöst)", () => {
    const result = getLastMatchSummary([ record() ], "user-a");
    assert.equal(result!.result, "win");
    assert.equal(result!.opponentName, "Marc K.");
    assert.equal(result!.myLegs, 3);
    assert.equal(result!.opponentLegs, 1);
    assert.equal(result!.myAverage, 74.2);
  });

  it("3. Niederlage wird korrekt erkannt", () => {
    const result = getLastMatchSummary([ record({ winnerIndex: 1 }) ], "user-a");
    assert.equal(result!.result, "loss");
  });

  it("4. unbekannte Identität (meine userId taucht im Match nicht auf) → \"undecided\", kein Rateergebnis", () => {
    const result = getLastMatchSummary([ record() ], "unknown-user");
    assert.equal(result!.result, "undecided");
  });

  it("5. unbeendetes Match → \"undecided\", auch wenn winnerIndex zufällig gesetzt wäre", () => {
    const result = getLastMatchSummary([ record({ finished: false }) ], "user-a");
    assert.equal(result!.result, "undecided");
  });

  it("6. wählt tatsächlich das NEUESTE Match (nicht das erste im Array)", () => {
    const older = record({ matchId: "old", recordedAt: "2026-08-20T10:00:00.000Z" });
    const newer = record({ matchId: "new", recordedAt: "2026-08-26T10:00:00.000Z", winnerIndex: 1 });
    const result = getLastMatchSummary([ older, newer ], "user-a");
    assert.equal(result!.result, "loss"); // aus "newer" (winnerIndex 1), nicht "older" (winnerIndex 0 -> win)
  });

  it("7. Ich bin nicht Position 0 → immer noch korrekt per userId, kein Index-0-Fallback", () => {
    const result = getLastMatchSummary([
      record({
        winnerIndex: 1,
        players: [
          player({ index: 0, name: "Marc K.", userId: "user-b", legs: 1 }),
          player({ index: 1, name: "Tim S.", userId: "user-a", legs: 3, average: 80 }),
        ],
      }),
    ], "user-a");
    assert.equal(result!.result, "win");
    assert.equal(result!.opponentName, "Marc K.");
  });
});

describe("getRecentOpponents", () => {
  it("1. keine Records → []", () => {
    assert.deepEqual(getRecentOpponents([], "user-a"), []);
  });

  it("2. keine myUserId → [] (keine Vermutung, wer der Gegner war)", () => {
    assert.deepEqual(getRecentOpponents([ record() ], null), []);
  });

  it("3. liefert eindeutige Gegnernamen, neueste zuerst", () => {
    const r1 = record({ matchId: "m1", recordedAt: "2026-08-26T12:00:00.000Z" });
    const r2 = record({
      matchId: "m2", recordedAt: "2026-08-25T12:00:00.000Z",
      players: [ player({ index: 0, userId: "user-a" }), player({ index: 1, name: "Lisa R.", userId: "user-c" }) ],
    });
    const result = getRecentOpponents([ r2, r1 ], "user-a", 5);
    assert.deepEqual(result.map(o => o.name), [ "Marc K.", "Lisa R." ]);
  });

  it("4. dedupliziert denselben Gegner über mehrere Matches", () => {
    const r1 = record({ matchId: "m1", recordedAt: "2026-08-26T12:00:00.000Z" });
    const r2 = record({ matchId: "m2", recordedAt: "2026-08-25T12:00:00.000Z" });
    const result = getRecentOpponents([ r1, r2 ], "user-a", 5);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "Marc K.");
  });

  it("5. respektiert das limit", () => {
    const records = [ "m1", "m2", "m3" ].map((id, i) => record({
      matchId: id,
      recordedAt: `2026-08-2${6 - i}T12:00:00.000Z`,
      players: [ player({ index: 0, userId: "user-a" }), player({ index: 1, name: `Gegner ${i}`, userId: `user-x${i}` }) ],
    }));
    assert.equal(getRecentOpponents(records, "user-a", 2).length, 2);
  });

  it("6. Match mit unauflösbarer Identität wird übersprungen statt geraten", () => {
    const bad = record({ matchId: "bad", players: [ player({ index: 0, userId: "someone-else" }), player({ index: 1, name: "Ghost", userId: "user-y" }) ] });
    const good = record({ matchId: "good", recordedAt: "2026-08-20T10:00:00.000Z" });
    const result = getRecentOpponents([ bad, good ], "user-a", 5);
    assert.deepEqual(result.map(o => o.name), [ "Marc K." ]);
  });

  it("7. liefert userId, Datum, Ergebnis (aus meiner Sicht) und meinen Average je Match — für Friends-V4-Abgleich per ID", () => {
    const result = getRecentOpponents([ record() ], "user-a", 5);
    assert.equal(result[0].userId, "user-b");
    assert.equal(result[0].recordedAt, "2026-08-26T10:00:00.000Z");
    assert.equal(result[0].result, "win");
    assert.equal(result[0].myAverage, 74.2);
  });

  it("8. Ergebnis ist \"loss\", wenn der Gegner gewonnen hat", () => {
    const result = getRecentOpponents([ record({ winnerIndex: 1 }) ], "user-a", 5);
    assert.equal(result[0].result, "loss");
  });

  it("9. Ergebnis ist \"undecided\" bei unbeendetem Match, kein Rateergebnis", () => {
    const result = getRecentOpponents([ record({ finished: false }) ], "user-a", 5);
    assert.equal(result[0].result, "undecided");
  });
});

describe("getLastPlayedWith", () => {
  it("1. keine Records → null", () => {
    assert.equal(getLastPlayedWith([], "user-a", "user-b"), null);
  });

  it("2. keine friendUserId → null (kein Namensabgleich als Ersatz)", () => {
    assert.equal(getLastPlayedWith([ record() ], "user-a", null), null);
  });

  it("3. findet das Datum des letzten gemeinsamen Matches per userId", () => {
    const result = getLastPlayedWith([ record() ], "user-a", "user-b");
    assert.equal(result, "2026-08-26T10:00:00.000Z");
  });

  it("4. kein gemeinsames Match mit dieser userId → null", () => {
    const result = getLastPlayedWith([ record() ], "user-a", "user-nobody");
    assert.equal(result, null);
  });

  it("5. Namensgleichheit allein reicht nicht — nur userId zählt", () => {
    // Gleicher Name "Marc K.", aber andere userId als im Record hinterlegt.
    const result = getLastPlayedWith([ record() ], "user-a", "marc-k-impostor");
    assert.equal(result, null);
  });
});

async function source(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("Elite Home Dashboard — Regression", () => {
  it("utils/dashboard-activity.ts importiert keine Werte aus geschützten P1/CMR-Dateien", async () => {
    const text = await source("utils/dashboard-activity.ts");
    assert.doesNotMatch(text, /from ["']\.\/(event-dedupe|websocket-helpers)["']/);
    assert.match(text, /import type \{ ICanonicalMatchResult \} from "\.\/canonical-match-result"/);
  });

  it("sections.ts enthält sound/lighting nicht mehr als eigene Nav-Einträge", async () => {
    const text = await source("components/ControlCenter/sections.ts");
    assert.doesNotMatch(text, /id: "sound"/);
    assert.doesNotMatch(text, /id: "lighting"/);
  });

  it("CcSettings.vue bindet CcSound und CcLighting ein (Funktionalität erhalten, nur verschoben)", async () => {
    const text = await source("components/ControlCenter/views/CcSettings.vue");
    assert.match(text, /<CcSound \/>/);
    assert.match(text, /<CcLighting \/>/);
  });

  it("ControlCenter.vue registriert keine eigenen sound/lighting-Routen mehr", async () => {
    const text = await source("entrypoints/controlcenter/ControlCenter.vue");
    assert.doesNotMatch(text, /sound: defineAsyncComponent/);
    assert.doesNotMatch(text, /lighting: defineAsyncComponent/);
  });

  it("Quick-Play-Kacheln behaupten keine Modus-Vorauswahl, die nicht verdrahtet ist", async () => {
    const text = await source("components/ControlCenter/CcQuickPlay.vue");
    // Jeder 301/501/Cricket/ATC-Klick muss dieselbe ehrliche openAutodarts()-Aktion
    // auslösen wie "Match starten" — keine erfundene Variant-Preselection.
    const matches = text.match(/@click="openAutodarts\(autodartsOrigin\)"/g) ?? [];
    assert.ok(matches.length >= 4, "expected at least 4 tiles (301/501/Cricket/ATC) to open Autodarts honestly");
  });

  it("keine Historie-Checkout%/100+/140+ wurden in der Performance-Strip ergänzt (nicht in CMR gespeichert)", async () => {
    const text = await source("components/ControlCenter/CcPerformanceStrip.vue");
    assert.doesNotMatch(text, /checkoutPercent|plus100|plus140/);
  });

  it("Elite-Home-Dashboard-Komponenten enthalten keine offensichtlichen Mock-/Platzhalterwerte", async () => {
    const files = [
      "components/ControlCenter/CcHeroBand.vue",
      "components/ControlCenter/CcQuickPlay.vue",
      "components/ControlCenter/CcLiveMatchTeaser.vue",
      "components/ControlCenter/CcRecentActivity.vue",
      "components/ControlCenter/CcPerformanceStrip.vue",
      "components/ControlCenter/CcHomeFriends.vue",
      "components/ControlCenter/CcHomeTraining.vue",
      "components/ControlCenter/CcSystemStatusFooter.vue",
    ];
    for (const file of files) {
      const text = await source(file);
      // Die Mockup-Illustrationsnamen aus den Review-Artefakten dürfen nicht
      // als hartkodierte Werte in Produktionscode auftauchen.
      assert.doesNotMatch(text, /Tim S\.|Marc K\.|Lisa R\.|Jonas B\./, `${file} must not hardcode mockup sample data`);
    }
  });
});
