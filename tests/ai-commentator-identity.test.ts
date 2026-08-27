/**
 * Verhaltensbasierte Regressionstests für Finding H1 (PR #16 Review,
 * 2026-08-27): in `processGameData()`'s Leg-Ende-Zweig wurden
 * `lastLegCount`/`lastSetCount` erst NACH dem Identity-Check fortgeschrieben.
 * War die eigene Identität nicht auflösbar, blieb `legChanged` dauerhaft
 * `true` — jeder weitere Spielstand-Schnappschuss lief erneut in denselben
 * Zweig und `return`ete dort, ohne je wieder Kommentare (Match-Start,
 * Checkout, Bust, 180, Gameshot, Matchshot) auszulösen.
 *
 * Diese Tests laden das ECHTE Produktionsmodul (keine Nachbildung der
 * Kontrollfluss-Logik) über einen Storage-Mock, der `wxt/storage`s
 * `defineItem()`/`browser.storage.local`-Vertrag nachbildet (siehe
 * tests/support/wxt-globals-mock.ts), und treiben es über echte
 * `AutodartsToolsGameData.setValue()`-Aufrufe — exakt der Pfad, über den ein
 * echtes Match-Update in Produktion ankommt.
 *
 * WICHTIG zur Harness-Architektur: `globalThis.storage`/`browser` werden nur
 * EINMAL für die ganze Datei installiert (nicht pro Test). Grund: Node
 * cacht `utils/helpers.ts`s eigenen (nicht parametrisierbaren) dynamischen
 * `import("./storage")` global pro Prozess — ein zweites `installWxtGlobals()`
 * würde `globalThis.storage` ersetzen, aber die bereits gecachte
 * `AutodartsToolsGlobalStatus`-Instanz bliebe an das ALTE (verworfene) Mock
 * gebunden. Zwischen Tests wird stattdessen nur der Dateninhalt über
 * `handle.reset()` geleert — dieselben Closures bleiben gültig.
 *
 * Beobachtbarer Beweis: Wie oft wird `getUserIdFromToken()` (⇒ ein
 * `browser.storage.local.get("globalstatus")`-Aufruf) ausgelöst? Das Modul
 * cacht eine erfolgreich aufgelöste Identität (`ownUserId`) und fragt sie
 * bei folgenden Leg-Wechseln nicht erneut ab — bei NICHT auflösbarer
 * Identität wird vor dem Fix bei JEDEM weiteren Schnappschuss mit demselben
 * (nie fortgeschriebenen) Leg-Stand erneut angefragt, nach dem Fix nur noch
 * bei tatsächlichen Leg-Wechseln.
 *
 *   node --import tsx --test "tests/*.test.ts"
 */

import { strict as assert } from "node:assert";
import { before, beforeEach, describe, it } from "node:test";

import { fakeJwt, installWxtGlobals, type MockStorageHandle } from "./support/wxt-globals-mock";

const GLOBALSTATUS_KEY = "globalstatus";

function baseMatch(overrides: Record<string, unknown> = {}) {
  return {
    finished: false,
    winner: -1,
    gameWinner: -1,
    player: 0,
    round: 5, // bewusst != 1, damit der Match-Start-Zweig (TTS) nie zündet
    leg: 0,
    set: 0,
    players: [
      { name: "Me", userId: "user-me" },
      { name: "Opponent", userId: "user-opp" },
    ],
    gameScores: [ 100, 100 ],
    // throws.length === 1 (weder 0 noch >=3) hält jeden TTS-auslösenden
    // Zweig (Match-Start, Checkout-Suggestion, 180) inaktiv — die Funktion
    // fällt in jedem Aufruf harmlos bis `if (!isLastThrow) return;` durch.
    turns: [ { throws: [ { segment: { name: "S1" } } ], busted: false, points: 1 } ],
    ...overrides,
  };
}

/** Testfixtures bilden nur die von processGameData() gelesenen IMatch-Felder ab — vollständige Typkonformität ist hier nicht das Ziel. */
async function feedMatch(gameDataStorage: any, overrides: Record<string, unknown> = {}): Promise<void> {
  await gameDataStorage.AutodartsToolsGameData.setValue({ match: baseMatch(overrides) } as any);
}

describe("ai-commentator.ts — Identity-unresolved Early Return (H1)", () => {
  let handle: MockStorageHandle;

  before(() => {
    handle = installWxtGlobals();
  });

  beforeEach(() => {
    handle.reset();
  });

  async function loadFreshModule() {
    // Modul-Cache für game-data-storage/storage NICHT umgehen (siehe
    // Datei-Kommentar oben) — nur ai-commentator.ts selbst braucht eine
    // frische Instanz für seinen eigenen Modul-Top-Level-Zustand
    // (lastLegCount, ownUserId, …).
    const gameDataStorage = await import("@/utils/game-data-storage");
    (globalThis as any).AutodartsToolsGameData = gameDataStorage.AutodartsToolsGameData;

    const storageMod = await import("@/utils/storage");
    await storageMod.AutodartsToolsConfig.setValue({
      ...storageMod.defaultConfig,
      aiCommentator: { ...storageMod.defaultConfig.aiCommentator, enabled: true, legStatsEnabled: true },
    });

    const mod = await import(`@/entrypoints/match.content/ai-commentator?t=${Date.now()}-${Math.random()}`);
    return { mod, gameDataStorage };
  }

  it("Identity NICHT auflösbar: Leg-Zähler schreiten trotzdem fort — kein wiederholtes Identity-Polling bei unverändertem Leg", async () => {
    // Bewusst KEIN globalstatus-Eintrag -> getAuthToken() liefert "" -> getUserIdFromToken() liefert null.
    const { mod, gameDataStorage } = await loadFreshModule();

    await mod.aiCommentator();

    // A: Initialer Snapshot (leg=0,set=0) — reine Baseline, kein Leg-Wechsel.
    await feedMatch(gameDataStorage, { leg: 0, set: 0 });
    assert.equal(handle.getCallCount(GLOBALSTATUS_KEY), 0, "Baseline darf noch keine Identity-Abfrage auslösen");

    // B: Erster echter Leg-Wechsel (0 -> 1), Identity nicht auflösbar.
    await feedMatch(gameDataStorage, { leg: 1, set: 0 });
    assert.equal(handle.getCallCount(GLOBALSTATUS_KEY), 1, "Erster Leg-Wechsel muss genau eine Identity-Abfrage auslösen");

    // C: GLEICHER Leg-Stand erneut (nächster Wurf im selben Leg, kein Leg-Wechsel).
    //    Regressions-Nachweis: Falls die Zähler nicht fortgeschrieben wurden
    //    (Bug), berechnet der Code legChanged erneut als true und fragt die
    //    Identität ein zweites Mal ab — hier MUSS der Zähler bei 1 bleiben.
    await feedMatch(gameDataStorage, { leg: 1, set: 0 });
    assert.equal(
      handle.getCallCount(GLOBALSTATUS_KEY),
      1,
      "Unveränderter Leg-Stand darf KEINE erneute Identity-Abfrage auslösen — sonst ist der Zweig dauerhaft 'stuck' (H1)",
    );

    // D: Echter zweiter Leg-Wechsel (1 -> 2) — muss weiterhin korrekt erkannt werden.
    await feedMatch(gameDataStorage, { leg: 2, set: 0 });
    assert.equal(
      handle.getCallCount(GLOBALSTATUS_KEY),
      2,
      "Ein echter weiterer Leg-Wechsel muss weiterhin erkannt und einmalig abgefragt werden — kein Deadlock durch den Fix",
    );

    mod.aiCommentatorOnRemove();
  });

  it("Identity auflösbar: normaler Pfad unverändert — Identity wird einmalig aufgelöst und über mehrere Leg-Wechsel gecacht (keine Regression)", async () => {
    handle.seed(GLOBALSTATUS_KEY, { isFirstStart: false, user: { name: "Me" }, auth: { token: fakeJwt("user-me") } });
    const { mod, gameDataStorage } = await loadFreshModule();

    await mod.aiCommentator();

    await feedMatch(gameDataStorage, { leg: 0, set: 0 });
    await feedMatch(gameDataStorage, { leg: 1, set: 0 });
    await feedMatch(gameDataStorage, { leg: 2, set: 0 });
    await feedMatch(gameDataStorage, { leg: 3, set: 0 });

    assert.equal(
      handle.getCallCount(GLOBALSTATUS_KEY),
      1,
      "Bei erfolgreicher Auflösung wird die Identität exakt einmal gecacht — spätere Leg-Wechsel dürfen sie nicht erneut abfragen",
    );

    mod.aiCommentatorOnRemove();
  });

  it("Fehlende/unvollständige Match-Daten während eines Leg-Wechsels werfen keine neue Exception", async () => {
    const { mod, gameDataStorage } = await loadFreshModule();

    await mod.aiCommentator();

    await feedMatch(gameDataStorage, { leg: 0, set: 0 });
    // Leg-Wechsel, aber `players` fehlt komplett (z.B. unvollständiger Snapshot).
    await assert.doesNotReject(
      feedMatch(gameDataStorage, { leg: 1, set: 0, players: undefined }),
      "Ein Leg-Wechsel mit fehlendem players-Array darf nicht crashen",
    );

    mod.aiCommentatorOnRemove();
  });
});
