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

export async function gameDataProcessor(
  gameData: IGameData,
  oldGameData: IGameData,
  fromWebSocket: boolean = false,
  triggerPresentCB: (trigger: string) => boolean
): Promise<string | null> {
  if (!gameData.match) return null;

  let trigger: string | null = null;

  const winner: boolean = gameData.match.gameWinner >= 0;
  const winnerMatch: boolean = gameData.match.winner >= 0;
  const currentPlayer = gameData.match.players?.[gameData.match.player];
  const playerName = currentPlayer?.name;
  const playerNameLower = playerName.toLowerCase();
  const playerNameWithUnderscores = playerNameLower.replace(/\s+/g, "_");

  if (winnerMatch && triggerPresentCB("matchshot_" + playerNameLower)) return "gameshot_" + playerNameLower;
  if (winnerMatch && triggerPresentCB("matchshot_" + playerNameWithUnderscores)) return "gameshot_" + playerNameWithUnderscores;
  if (winnerMatch && triggerPresentCB("matchshot")) return "matchshot";
  if (winner && triggerPresentCB("gameshot_" + playerNameLower)) return "gameshot_" + playerNameLower;
  if (winner && triggerPresentCB("gameshot_" + playerNameWithUnderscores)) return "gameshot_" + playerNameWithUnderscores;
  if (winner && triggerPresentCB("gameshot")) return "gameshot";

  switch (gameData.match!.variant) {
    case "X01":
      trigger = await processX01Data(gameData, oldGameData, fromWebSocket, triggerPresentCB);
      break;
    case "cricket":
      trigger = await processCricketData(gameData, oldGameData, fromWebSocket, triggerPresentCB);
      break;
    case "ATC": // Around The Clock
    case "RTW": // Round The World
    case "Shanghai":
    case "Bob's 27":
      trigger = await processAtcRtwShanghaiData(gameData, oldGameData, fromWebSocket, triggerPresentCB);
      break;
    default:
      console.log(
        `Autodarts Tools: WLED: unhandled game variant ${gameData?.match?.variant} using X01 processor`
      );
      break;
  }

  // fall back to X01 processor when no effect was found
  if (trigger === null && gameData.match!.variant != "X01")
    trigger = await processX01Data(gameData, oldGameData, fromWebSocket, triggerPresentCB);

  return trigger;
}

async function processX01Data(
  gameData: IGameData,
  oldGameData: IGameData,
  fromWebSocket: boolean = false,
  triggerPresentCB: (trigger: string) => boolean
): Promise<string | null> {
  if (!gameData.match) return null;

  const currentThrow = gameData.match.turns[0].throws[gameData.match.turns[0].throws.length - 1];
  if (!currentThrow) return null;

  const isLastThrow: boolean = gameData.match.turns[0].throws.length >= 3;
  let throwName: string = currentThrow.segment.name.toLowerCase();
  const winner: boolean = gameData.match.gameWinner >= 0;
  const winnerMatch: boolean = gameData.match.winner >= 0;
  const busted: boolean = gameData.match.turns[0].busted;
  const points: string = gameData.match.turns[0].points.toString();
  const combinedThrows: string = gameData.match.turns[0].throws
    .map((t) => t.segment.name.toLowerCase())
    .join("_");

  if (throwName === "25" && currentThrow.segment.bed.startsWith("Single")) throwName = "s25";

  if (winnerMatch && triggerPresentCB("matchshot+" + throwName)) return "matchshot+" + throwName;
  if (winner && triggerPresentCB("gameshot+" + throwName)) return "gameshot+" + throwName;
  if (busted && triggerPresentCB("busted")) return "busted";
  if (isLastThrow && triggerPresentCB(combinedThrows)) return combinedThrows;
  if (!busted && isLastThrow && triggerPresentCB(points)) return points;
  if (triggerPresentCB(throwName)) return throwName;

  return null;
}

async function processCricketData(
  gameData: IGameData,
  oldGameData: IGameData,
  fromWebSocket: boolean = false,
  triggerPresentCB: (trigger: string) => boolean
): Promise<string | null> {
  return null;
}

async function processAtcRtwShanghaiData(
  gameData: IGameData,
  oldGameData: IGameData,
  fromWebSocket: boolean = false,
  triggerPresentCB: (trigger: string) => boolean
): Promise<string | null> {
  const winner: boolean = gameData.match!.gameWinner >= 0
  const winnerMatch: boolean = gameData.match!.winner >= 0
  if (winnerMatch && triggerPresentCB('matchshot')) return 'matchshot';
  if (winner && triggerPresentCB('gameshot')) return 'gameshot';

  const player: number = gameData.match!.player
  const round: number | string = gameData.match!.round
  var targetField: string | number = 0
  switch (gameData.match!.variant) {
    case 'ATC':
      targetField = gameData.match!.state.targets[player][gameData.match!.state.currentTargets[player]].number
      if (targetField === 25 && ['Double', 'Triple'].some((v) => v === gameData.match!.settings.mode)) {
        targetField = 'bull'
      }
      break;
    case 'RTW':
      targetField = gameData.match!.state.targets[round - 1].number
      break;
    case 'Shanghai':
      targetField = gameData.match!.state.targets[round - 1]
      break;
    case 'Bob\'s 27':
      targetField = round
      break;
  }
  const trigger = `target${targetField}`
  console.log(`Autodarts Tools: WLED: current target ${targetField}`)
  if (triggerPresentCB(trigger)) return trigger
  return null
}
