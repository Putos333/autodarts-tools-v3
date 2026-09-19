/**
 * Tests für die Trainings-Verlauf-Merge-Logik (Legacy-localStorage → local:training-history).
 *
 * Läuft ohne zusätzliche Abhängigkeit über den Node-eigenen Test-Runner und den
 * bereits vorhandenen tsx-Loader (devDependency):
 *
 *   node --import tsx --test "tests/*.test.ts"
 *
 * utils/training-history.ts ist bewusst import- und seiteneffektfrei (kein WXT/Browser-Kontext).
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { mergeTrainingHistories } from "../utils/training-history";
import type { TrainingSession } from "../utils/training-history";

function session(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    date: "2026-08-15T10:00:00.000Z",
    average: 45.2,
    count140Plus: 1,
    count180s: 0,
    checkoutMisses: 2,
    checkoutRate: 33,
    goalsReached: 1,
    totalGoals: 3,
    ...overrides,
  };
}

describe("mergeTrainingHistories", () => {
  it("1. leere Legacy-Liste lässt die aktuelle Liste unverändert", () => {
    const current = [ session({ date: "2026-08-16T10:00:00.000Z" }) ];
    const result = mergeTrainingHistories(current, []);
    assert.deepEqual(result, current);
  });

  it("2. leere aktuelle Liste übernimmt die Legacy-Einträge", () => {
    const legacy = [ session({ date: "2026-08-14T10:00:00.000Z" }) ];
    const result = mergeTrainingHistories([], legacy);
    assert.deepEqual(result, legacy);
  });

  it("3. Legacy- und aktuelle Einträge werden kombiniert und nach Datum absteigend sortiert", () => {
    const older = session({ date: "2026-08-14T10:00:00.000Z" });
    const newer = session({ date: "2026-08-16T10:00:00.000Z" });
    const result = mergeTrainingHistories([ newer ], [ older ]);
    assert.deepEqual(result, [ newer, older ]);
  });

  it("4. identisches Datum in Legacy und aktuell erzeugt keinen Duplikat-Eintrag (aktueller Eintrag gewinnt)", () => {
    const shared = "2026-08-15T10:00:00.000Z";
    const legacyEntry = session({ date: shared, average: 10 });
    const currentEntry = session({ date: shared, average: 99 });
    const result = mergeTrainingHistories([ currentEntry ], [ legacyEntry ]);
    assert.equal(result.length, 1);
    assert.equal(result[0].average, 99);
  });

  it("5. Ergebnis wird auf maxEntries begrenzt (neueste zuerst)", () => {
    const legacy = Array.from({ length: 5 }, (_, i) =>
      session({ date: `2026-08-0${i + 1}T10:00:00.000Z` }));
    const result = mergeTrainingHistories([], legacy, 3);
    assert.equal(result.length, 3);
    assert.equal(result[0].date, "2026-08-05T10:00:00.000Z");
    assert.equal(result[2].date, "2026-08-03T10:00:00.000Z");
  });

  it("6. Einträge ohne gültiges date-Feld werden defensiv verworfen (kein Absturz)", () => {
    const malformed = [ { average: 1 } as unknown as TrainingSession, null as unknown as TrainingSession ];
    const valid = session({ date: "2026-08-15T10:00:00.000Z" });
    const result = mergeTrainingHistories([ valid ], malformed);
    assert.deepEqual(result, [ valid ]);
  });

  it("7. mutiert weder die current- noch die legacy-Eingabe", () => {
    const current = [ session({ date: "2026-08-16T10:00:00.000Z" }) ];
    const legacy = [ session({ date: "2026-08-14T10:00:00.000Z" }) ];
    const currentSnapshot = JSON.parse(JSON.stringify(current));
    const legacySnapshot = JSON.parse(JSON.stringify(legacy));
    mergeTrainingHistories(current, legacy);
    assert.deepEqual(current, currentSnapshot);
    assert.deepEqual(legacy, legacySnapshot);
  });

  it("8. exerciseId/exerciseTitle überleben den Merge unverändert (rückwärtskompatible Erweiterung)", () => {
    const withExercise = session({ date: "2026-08-16T10:00:00.000Z", exerciseId: "warmup-1", exerciseTitle: "Aufwärmen" });
    const legacyWithoutExercise = session({ date: "2026-08-14T10:00:00.000Z" }); // altes Format, kein exerciseId
    const result = mergeTrainingHistories([ withExercise ], [ legacyWithoutExercise ]);
    assert.equal(result[0].exerciseId, "warmup-1");
    assert.equal(result[0].exerciseTitle, "Aufwärmen");
    assert.equal(result[1].exerciseId, undefined); // alte Session bleibt "unbekannt", nicht erfunden
  });
});
