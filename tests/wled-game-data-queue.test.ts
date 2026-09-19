/**
 * Regression test für den Trailing-Debounce-Bug, ursprünglich in WLED gefunden
 * (dokumentiert in FACTORY_STATUS.md: "WLED-Debounce verwirft Transitionen bei
 * <200ms-Abstand") und danach identisch in `caller.ts` und `sound-fx.ts`
 * gefunden — alle drei debounceten den GameData-Watcher per
 * "clearTimeout + reschedule". Trafen mehrere game-data-Updates innerhalb von
 * 200ms ein, wurden alle bis auf das letzte verworfen — inklusive der Caller-
 * Ansagen/Soundeffekte/WLED-Effekte, die für die verworfenen Zwischenzustände
 * hätten feuern müssen.
 *
 * Nachher: `createGameDataDebounceQueue()` (utils/game-data-debounce-queue.ts,
 * von wled.ts/caller.ts/sound-fx.ts gemeinsam genutzt) verarbeitet jedes
 * (gameData, oldGameData)-Paar genau einmal, in Reihenfolge, nur zeitlich
 * entzerrt — kein Datenverlust mehr.
 *
 * utils/game-data-debounce-queue.ts importiert kein WXT/Browser-API, daher
 * läuft dieser Test ohne Extension-Kontext über den Node-eigenen Test-Runner
 * (siehe event-dedupe.test.ts).
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { createGameDataDebounceQueue } from "../utils/game-data-debounce-queue";

/** Manuell steuerbarer Fake-Scheduler statt echter Timer. */
function createFakeScheduler() {
  let nextHandle = 1;
  const pending = new Map<number, () => void>();

  return {
    scheduler: (cb: () => void, _ms: number) => {
      const handle = nextHandle++;
      pending.set(handle, cb);
      return handle;
    },
    canceler: (handle: unknown) => {
      pending.delete(handle as number);
    },
    /** Führt genau einen ausstehenden Timer aus (falls vorhanden) und meldet, ob einer lief. */
    flushOne(): boolean {
      const [handle] = pending.keys();
      if (handle === undefined) return false;
      const cb = pending.get(handle)!;
      pending.delete(handle);
      cb();
      return true;
    },
    get scheduledCount() {
      return pending.size;
    },
  };
}

describe("createGameDataDebounceQueue", () => {
  it("verarbeitet jedes gepushte Paar genau einmal, auch bei Bursts innerhalb der Delay-Fenster", () => {
    const processed: { gameData: any; oldGameData: any }[] = [];
    const fake = createFakeScheduler();
    const queue = createGameDataDebounceQueue(
      (gameData, oldGameData) => processed.push({ gameData, oldGameData }),
      200,
      fake.scheduler,
      fake.canceler,
    );

    // Drei Updates treffen ein, bevor der erste Timer je feuern konnte
    // (entspricht mehreren game-data-Schreibvorgängen <200ms auseinander).
    queue.push({ id: "state-1" } as any, { id: "state-0" } as any);
    queue.push({ id: "state-2" } as any, { id: "state-1" } as any);
    queue.push({ id: "state-3" } as any, { id: "state-2" } as any);

    assert.equal(queue.pending, 3, "alle drei Updates müssen in der Queue verbleiben, keins darf beim Push verworfen werden");
    assert.equal(fake.scheduledCount, 1, "es darf immer nur ein Timer gleichzeitig laufen (Flooding-Schutz bleibt erhalten)");

    // Timer feuern nacheinander ab — jeder verarbeitet genau ein Element und
    // plant bei Bedarf den nächsten.
    assert.equal(fake.flushOne(), true);
    assert.equal(fake.flushOne(), true);
    assert.equal(fake.flushOne(), true);
    assert.equal(fake.flushOne(), false, "kein weiterer Timer erwartet");

    assert.deepEqual(
      processed.map(p => p.gameData.id),
      ["state-1", "state-2", "state-3"],
      "alle drei Zustände müssen in Reihenfolge verarbeitet worden sein — keine Transition verworfen",
    );
    assert.equal(queue.pending, 0);
  });

  it("clear() verwirft ausstehende Einträge und stoppt den laufenden Timer", () => {
    const processed: unknown[] = [];
    const fake = createFakeScheduler();
    const queue = createGameDataDebounceQueue(
      (gameData) => processed.push(gameData),
      200,
      fake.scheduler,
      fake.canceler,
    );

    queue.push({ id: "a" } as any, { id: "old" } as any);
    queue.push({ id: "b" } as any, { id: "a" } as any);
    assert.equal(fake.scheduledCount, 1);

    queue.clear();

    assert.equal(queue.pending, 0);
    assert.equal(fake.scheduledCount, 0, "der ausstehende Timer muss abgebrochen worden sein");
    assert.equal(fake.flushOne(), false);
    assert.deepEqual(processed, [], "nach clear() darf nichts mehr verarbeitet werden");
  });

  it("verwirft bei anhaltendem Burst über der Kapazität die ältesten Einträge, statt unbegrenzt zu wachsen", () => {
    const processed: unknown[] = [];
    const fake = createFakeScheduler();
    const queue = createGameDataDebounceQueue(
      (gameData) => processed.push((gameData as any).id),
      200,
      fake.scheduler,
      fake.canceler,
      3, // maxQueueSize
    );

    // 6 Updates treffen ein, bevor auch nur ein Timer feuern konnte —
    // mehr als das Doppelte der Kapazität.
    for (let i = 1; i <= 6; i++) {
      queue.push({ id: `state-${i}` } as any, { id: `state-${i - 1}` } as any);
    }

    assert.equal(queue.pending, 3, "Queue darf maxQueueSize nicht überschreiten, auch bei anhaltendem Burst");

    while (fake.flushOne());

    assert.deepEqual(
      processed,
      ["state-4", "state-5", "state-6"],
      "die ältesten, veralteten Zustände werden verworfen — die Effekte holen den aktuellen Matchstand ein, statt unbegrenzt hinterherzuhängen",
    );
  });

  it("verarbeitet ein einzelnes Update unverändert (kein Regressionsrisiko im Normalfall)", () => {
    const processed: unknown[] = [];
    const fake = createFakeScheduler();
    const queue = createGameDataDebounceQueue(
      (gameData) => processed.push(gameData),
      200,
      fake.scheduler,
      fake.canceler,
    );

    queue.push({ id: "only" } as any, { id: "old" } as any);
    assert.equal(fake.flushOne(), true);

    assert.deepEqual(processed, [{ id: "only" }]);
  });
});
