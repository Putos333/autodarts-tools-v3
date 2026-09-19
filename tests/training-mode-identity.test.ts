/**
 * Verhaltensbasierte Regressionstests für Finding H3 (PR #16 Review,
 * 2026-08-27): in `trainingMode()`s Watch-Callback hing die komplette
 * Match-Ende-Behandlung — inklusive `clearActiveTrainingExercise()` — hinter
 * `if (myIndex < 0) return;`. War die eigene Identität im Match nicht
 * auflösbar, lief NICHTS davon, und die aktive Übung blieb dauerhaft als
 * "aktiv" markiert (`local:training-active-exercise`), obwohl das Match
 * längst beendet war.
 *
 * Diese Tests laden das ECHTE Produktionsmodul über denselben
 * `wxt/storage`-kompatiblen Mock wie tests/ai-commentator-identity.test.ts
 * (siehe tests/support/wxt-globals-mock.ts) und treiben es über echte
 * `AutodartsToolsGameData.setValue()`-Aufrufe.
 *
 *   node --import tsx --test "tests/*.test.ts"
 */

import { strict as assert } from "node:assert";
import { before, beforeEach, describe, it } from "node:test";

import { fakeJwt, installWxtGlobals, type MockStorageHandle } from "./support/wxt-globals-mock";

const ACTIVE_EXERCISE_KEY = "training-active-exercise";
const TRAINING_HISTORY_KEY = "training-history";

function baseMatch(overrides: Record<string, unknown> = {}) {
  return {
    finished: false,
    winner: -1,
    player: 0,
    turns: [ { throws: [ { segment: { name: "S1" } } ] } ],
    players: [
      { name: "Me", userId: "user-me" },
      { name: "Opponent", userId: "user-opp" },
    ],
    stats: [
      { matchStats: { average: 55.5, plus140: 2, total180: 1, checkoutPercent: 40, checkoutsHit: 2, checkouts: 3 } },
      { matchStats: { average: 40, plus140: 0, total180: 0, checkoutPercent: 0, checkoutsHit: 0, checkouts: 0 } },
    ],
    ...overrides,
  };
}

describe("training-mode.ts — Identity-unresolved Early Return blockiert Match-Ende-Cleanup (H3)", () => {
  let handle: MockStorageHandle;

  before(() => {
    handle = installWxtGlobals();
  });

  beforeEach(() => {
    handle.reset();
    // Legacy-Migration überspringen (liest sonst `localStorage`, in Node nicht vorhanden).
    handle.seed("training-history-migrated-v1", true);
  });

  async function loadFreshModule(configOverrides: Record<string, unknown> = {}) {
    const gameDataStorage = await import("@/utils/game-data-storage");
    (globalThis as any).AutodartsToolsGameData = gameDataStorage.AutodartsToolsGameData;

    const storageMod = await import("@/utils/storage");
    await storageMod.AutodartsToolsConfig.setValue({
      ...storageMod.defaultConfig,
      training: {
        ...storageMod.defaultConfig.training,
        enabled: true,
        showLiveProgress: false, // vermeidet document.createElement (kein DOM in Node)
        showSummaryAfterMatch: false,
        trackHistory: true,
        ...configOverrides,
      },
    });

    const mod = await import(`@/entrypoints/match.content/training-mode?t=${Date.now()}-${Math.random()}`);
    return { mod, gameDataStorage };
  }

  async function feed(gameDataStorage: any, overrides: Record<string, unknown> = {}): Promise<void> {
    await gameDataStorage.AutodartsToolsGameData.setValue({ match: baseMatch(overrides) } as any);
  }

  it("Identity NICHT auflösbar: clearActiveTrainingExercise() läuft trotzdem, sobald das Match endet", async () => {
    // Bewusst KEIN globalstatus-Eintrag -> Identity nicht auflösbar.
    handle.seed(ACTIVE_EXERCISE_KEY, "some-exercise-id");
    const { mod, gameDataStorage } = await loadFreshModule();

    await mod.trainingMode();

    // Match läuft noch — die aktive Übung darf noch nicht angerührt werden.
    await feed(gameDataStorage, { finished: false, winner: -1 });
    assert.equal(handle.raw(ACTIVE_EXERCISE_KEY), "some-exercise-id", "Laufendes Match darf die aktive Übung nicht anfassen");
    assert.equal(handle.removeCallCount(ACTIVE_EXERCISE_KEY), 0);

    // Match endet — Identity bleibt unauflösbar.
    await feed(gameDataStorage, { finished: true, winner: 1 });
    assert.equal(
      handle.raw(ACTIVE_EXERCISE_KEY),
      undefined,
      "Bug H3: clearActiveTrainingExercise() muss auch ohne aufgelöste Identität laufen, sonst bleibt die Übung für immer 'aktiv'",
    );
    assert.equal(handle.removeCallCount(ACTIVE_EXERCISE_KEY), 1);

    // Identitätsabhängige Arbeit (History) darf dagegen NICHT fabriziert werden.
    assert.equal(
      handle.raw(TRAINING_HISTORY_KEY),
      undefined,
      "Ohne aufgelöste Identität dürfen keine (zwangsläufig auf 0 stehenden) Fake-Stats in den Verlauf geschrieben werden",
    );

    mod.trainingModeOnRemove();
  });

  it("Identity auflösbar: normaler Pfad unverändert — echte Stats werden gespeichert, Cleanup läuft weiterhin, keine Duplikate", async () => {
    handle.seed("globalstatus", { isFirstStart: false, user: { name: "Me" }, auth: { token: fakeJwt("user-me") } });
    handle.seed(ACTIVE_EXERCISE_KEY, "some-exercise-id");
    const { mod, gameDataStorage } = await loadFreshModule();

    await mod.trainingMode();

    await feed(gameDataStorage, { finished: false, winner: -1 });
    await feed(gameDataStorage, { finished: true, winner: 0 });

    const history = handle.raw(TRAINING_HISTORY_KEY) as Array<{ average: number }> | undefined;
    assert.equal(history?.length, 1, "Bei aufgelöster Identität muss die Session genau einmal gespeichert werden");
    assert.equal(history?.[0]?.average, 55.5, "Gespeicherte Stats müssen die echten Werte des eigenen Spielers sein, nicht 0");
    assert.equal(
      handle.raw(ACTIVE_EXERCISE_KEY),
      undefined,
      "Cleanup darf beim aufgelösten Pfad nicht regressieren — muss weiterhin laufen",
    );

    // Match bleibt beendet (z.B. ein weiterer, redundanter Snapshot) — kein zweiter Verlaufseintrag.
    await feed(gameDataStorage, { finished: true, winner: 0 });
    const historyAfter = handle.raw(TRAINING_HISTORY_KEY) as Array<unknown> | undefined;
    assert.equal(historyAfter?.length, 1, "Ein wiederholter 'finished'-Schnappschuss darf keinen doppelten Verlaufseintrag erzeugen");

    mod.trainingModeOnRemove();
  });

  it("Fehlende Match-Daten beim Matchende werfen keine neue Exception (weder mit noch ohne aufgelöste Identität)", async () => {
    const { mod, gameDataStorage } = await loadFreshModule();
    await mod.trainingMode();

    await assert.doesNotReject(
      feed(gameDataStorage, { finished: true, winner: 0, players: undefined, stats: undefined }),
      "Ein beendetes Match ohne players/stats darf nicht crashen",
    );

    mod.trainingModeOnRemove();
  });
});
