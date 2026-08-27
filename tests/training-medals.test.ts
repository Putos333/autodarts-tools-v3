/**
 * Tests für utils/training-medals.ts — automatische Medaillen-Vergabe
 * (Bronze/Silber/Gold) nach einer abgeschlossenen Trainings-Session.
 *
 *   node --import tsx --test "tests/*.test.ts"
 */

import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  determineAutoMedal,
  goalMet,
  isAutoCheckableGoal,
  isMedalImprovement,
  type LiveTrainingStats,
} from "../utils/training-medals";
import type { ExerciseGoal, TrainingExercise } from "../utils/training-exercises";

function live(overrides: Partial<LiveTrainingStats> = {}): LiveTrainingStats {
  return { average: 0, count140Plus: 0, count180s: 0, checkoutRate: 0, checkoutMisses: 0, ...overrides };
}

function exercise(goals: TrainingExercise["goals"]): TrainingExercise {
  return {
    id: "ex-1",
    title: "Test-Übung",
    category: "accuracy",
    description: "",
    instructions: [],
    goals,
    durationMin: 5,
  };
}

describe("isAutoCheckableGoal", () => {
  it("1. minAverage allein ist automatisch prüfbar", () => {
    assert.equal(isAutoCheckableGoal({ minAverage: 60 }), true);
  });

  it("2. customCondition allein ist NICHT automatisch prüfbar", () => {
    assert.equal(isAutoCheckableGoal({ customCondition: "3 Triples in 5 Minuten" }), false);
  });

  it("3. customCondition zusammen mit einem Zahlenfeld macht das Tier trotzdem nicht prüfbar (mehrdeutig, kein Auto-Check)", () => {
    assert.equal(isAutoCheckableGoal({ customCondition: "irgendwas", minAverage: 60 }), false);
  });

  it("4. minCheckouts allein ist NICHT automatisch prüfbar (aktuell nicht live getrackt)", () => {
    assert.equal(isAutoCheckableGoal({ minCheckouts: 3 }), false);
  });

  it("5. leeres Goal-Objekt ist nicht automatisch prüfbar", () => {
    assert.equal(isAutoCheckableGoal({}), false);
  });

  it("6. jedes der übrigen quantifizierbaren Felder allein macht das Tier prüfbar", () => {
    const fields: ExerciseGoal[] = [
      { min140Plus: 10 }, { min180s: 2 }, { minCheckoutRate: 50 }, { maxMissRate: 3 },
    ];
    for (const g of fields) assert.equal(isAutoCheckableGoal(g), true, JSON.stringify(g));
  });
});

describe("goalMet", () => {
  it("1. minAverage erfüllt bei >=", () => {
    assert.equal(goalMet({ minAverage: 60 }, live({ average: 60 })), true);
    assert.equal(goalMet({ minAverage: 60 }, live({ average: 59.9 })), false);
  });

  it("2. min140Plus/min180s erfüllt bei >=", () => {
    assert.equal(goalMet({ min140Plus: 10 }, live({ count140Plus: 10 })), true);
    assert.equal(goalMet({ min180s: 2 }, live({ count180s: 1 })), false);
  });

  it("3. minCheckoutRate erfüllt bei >=", () => {
    assert.equal(goalMet({ minCheckoutRate: 50 }, live({ checkoutRate: 50 })), true);
    assert.equal(goalMet({ minCheckoutRate: 50 }, live({ checkoutRate: 49 })), false);
  });

  it("4. maxMissRate erfüllt bei <= (weniger Fehlversuche als das Maximum)", () => {
    assert.equal(goalMet({ maxMissRate: 3 }, live({ checkoutMisses: 3 })), true);
    assert.equal(goalMet({ maxMissRate: 3 }, live({ checkoutMisses: 4 })), false);
  });

  it("5. mehrere Zahlenfelder im selben Tier müssen ALLE erfüllt sein (UND-Verknüpfung)", () => {
    const goal: ExerciseGoal = { minAverage: 60, min180s: 2 };
    assert.equal(goalMet(goal, live({ average: 70, count180s: 2 })), true);
    assert.equal(goalMet(goal, live({ average: 70, count180s: 1 })), false, "180s fehlt trotz gutem Average");
  });

  it("6. leeres Goal ohne quantifizierbare Felder ist NIE erfüllt (kein stiller Auto-Pass)", () => {
    assert.equal(goalMet({}, live({ average: 999 })), false);
  });
});

describe("determineAutoMedal", () => {
  it("1. erreicht Gold, wenn Gold-Ziel erfüllt ist (höchstes Tier gewinnt)", () => {
    const ex = exercise({
      bronze: { minAverage: 60 },
      silver: { minAverage: 80 },
      gold: { minAverage: 100 },
    });
    assert.equal(determineAutoMedal(ex, live({ average: 105 })), "gold");
  });

  it("2. erreicht nur Silber, wenn Gold nicht, aber Silber erfüllt ist", () => {
    const ex = exercise({
      bronze: { minAverage: 60 },
      silver: { minAverage: 80 },
      gold: { minAverage: 100 },
    });
    assert.equal(determineAutoMedal(ex, live({ average: 85 })), "silver");
  });

  it("3. kein Tier erreicht -> null (kein erfundener Trostpreis)", () => {
    const ex = exercise({
      bronze: { minAverage: 60 },
      silver: { minAverage: 80 },
      gold: { minAverage: 100 },
    });
    assert.equal(determineAutoMedal(ex, live({ average: 40 })), null);
  });

  it("4. Gold ist customCondition (nicht prüfbar) -> fällt zurück auf das höchste automatisch prüfbare, erreichte Tier", () => {
    const ex = exercise({
      bronze: { minAverage: 60 },
      silver: { minAverage: 80 },
      gold: { customCondition: "Vom Trainer bestätigt" },
    });
    assert.equal(determineAutoMedal(ex, live({ average: 200 })), "silver", "Gold darf trotz hohem Average nicht automatisch vergeben werden");
  });

  it("5. alle Tiers sind customCondition -> immer null, egal wie gut die Live-Werte sind", () => {
    const ex = exercise({
      bronze: { customCondition: "a" },
      silver: { customCondition: "b" },
      gold: { customCondition: "c" },
    });
    assert.equal(determineAutoMedal(ex, live({ average: 999, count180s: 999 })), null);
  });

  it("6. fehlendes Tier (z.B. kein bronze definiert) wird übersprungen, kein Absturz", () => {
    const ex = exercise({
      silver: { minAverage: 80 },
      gold: { minAverage: 100 },
    } as TrainingExercise["goals"]);
    assert.equal(determineAutoMedal(ex, live({ average: 85 })), "silver");
  });
});

describe("isMedalImprovement", () => {
  it("1. null-Kandidat ist nie eine Verbesserung", () => {
    assert.equal(isMedalImprovement(null, null), false);
    assert.equal(isMedalImprovement(null, "gold"), false);
  });

  it("2. jede Medaille verbessert einen bisher fehlenden Stand (current = null)", () => {
    assert.equal(isMedalImprovement("bronze", null), true);
  });

  it("3. höheres Tier verbessert ein niedrigeres", () => {
    assert.equal(isMedalImprovement("gold", "silver"), true);
    assert.equal(isMedalImprovement("silver", "bronze"), true);
  });

  it("4. niedrigeres oder gleiches Tier verbessert NIE (nie abwertend, keine Regression)", () => {
    assert.equal(isMedalImprovement("bronze", "gold"), false);
    assert.equal(isMedalImprovement("silver", "silver"), false);
  });
});

async function source(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

describe("training-medals — Regression", () => {
  it("utils/training-medals.ts bleibt pure: keine @/-Importe, kein Vue/WXT/Browser (nur type-only Import aus training-exercises)", async () => {
    const text = await source("utils/training-medals.ts");
    // Block-Kommentare (die browser.storage.local zur Erklärung erwähnen dürfen)
    // vor der Prüfung entfernen — geprüft wird nur der tatsächliche Code.
    const codeOnly = text.replace(/\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(codeOnly, /from ["']@\//);
    assert.doesNotMatch(codeOnly, /from ["']vue["']|from ["']wxt|browser\./);
    assert.match(text, /^import type \{/m);
  });

  it("entrypoints/match.content/training-mode.ts vergibt Medaillen unabhängig von config.training?.trackHistory (eigene Einstellung, kein gekoppeltes Feature)", async () => {
    const text = await source("entrypoints/match.content/training-mode.ts");
    assert.match(text, /await maybeAwardMedal\(activeExercise\);/);
  });
});
