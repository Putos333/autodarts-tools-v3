import { type IGameData } from "@/utils/game-data-storage";

/**
 * Queues game-data change callbacks and drains them one at a time, spaced by
 * `delayMs`. Unlike a trailing debounce (clear+reschedule), no pending item is
 * silently dropped just because another update arrived during the delay
 * window — each queued (gameData, oldGameData) pair still reaches `process`
 * exactly once, in order. `maxQueueSize` bounds this: under a sustained burst
 * faster than one item per `delayMs` (e.g. a websocket reconnect resync), the
 * oldest queued item is dropped once the cap is exceeded so effects catch up
 * to the current match state instead of lagging further behind forever.
 * Framework-agnostic (no WXT/browser imports) so it stays unit-testable.
 *
 * Shared across every match-content feature that debounces the game-data
 * watcher (WLED, Caller, Sound FX) — they all previously reimplemented the
 * same trailing-debounce that silently dropped transitions arriving <200ms
 * apart (see FACTORY_STATUS.md item #9 and its follow-ups for caller.ts /
 * sound-fx.ts).
 */
export function createGameDataDebounceQueue(
  process: (gameData: IGameData, oldGameData: IGameData) => void,
  delayMs: number,
  scheduler: (cb: () => void, ms: number) => unknown = (cb, ms) => setTimeout(cb, ms),
  canceler: (handle: unknown) => void = (handle) => clearTimeout(handle as any),
  maxQueueSize: number = 5,
) {
  const queue: { gameData: IGameData; oldGameData: IGameData }[] = [];
  let timer: unknown = null;

  function schedule() {
    if (timer !== null) return;
    timer = scheduler(tick, delayMs);
  }

  function tick() {
    timer = null;
    const next = queue.shift();
    if (!next) return;
    process(next.gameData, next.oldGameData);
    if (queue.length > 0) schedule();
  }

  return {
    push(gameData: IGameData, oldGameData: IGameData) {
      queue.push({ gameData, oldGameData });
      while (queue.length > maxQueueSize) queue.shift();
      schedule();
    },
    clear() {
      queue.length = 0;
      if (timer !== null) {
        canceler(timer);
        timer = null;
      }
    },
    get pending() {
      return queue.length;
    },
  };
}
