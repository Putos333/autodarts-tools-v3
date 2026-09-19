/**
 * precision-tracker.ts – Sammelt Dart-Koordinaten während des Matches.
 *
 * Läuft still im Hintergrund (v2.9.74). Persistiert Würfe des eigenen
 * Spielers in IndexedDB (heatmap-storage). Basis für PrecisionMap-Anzeige
 * und den KI-Coach.
 */

import { AutodartsToolsConfig } from "@/utils/storage";
import { AutodartsToolsGameData, type IGameData } from "@/utils/game-data-storage";
import { getUserIdFromToken } from "@/utils/helpers";
import { saveThrow, type IHeatmapThrow } from "@/utils/heatmap-storage";

let unwatch: (() => void) | null = null;
let ownUserId: string | null = null;
const seen = new Set<string>();

export async function precisionTracker(): Promise<void> {
  const cfg = await AutodartsToolsConfig.getValue();
  if (!cfg.precisionMap?.enabled) return;

  seen.clear();
  ownUserId = await getUserIdFromToken();

  unwatch = AutodartsToolsGameData.watch((gd: IGameData) => processGameData(gd).catch(() => {}));
  console.log("Autodarts Tools: PrecisionTracker aktiv");
}

export function precisionTrackerOnRemove(): void {
  unwatch?.();
  unwatch = null;
  seen.clear();
}

async function processGameData(gd: IGameData): Promise<void> {
  if (!gd?.match?.turns?.length) return;
  const match = gd.match;
  const currentTurn = match.turns[0];
  if (!currentTurn?.throws?.length) return;

  const players = match.players ?? [];
  const currentPlayer = players[match.player];
  if (!currentPlayer) return;
  if (ownUserId && currentPlayer.userId !== ownUserId) return;

  // Alle Würfe der aktuellen Runde
  const currentScore = (match.gameScores ?? [])[match.player] ?? 0;

  for (const th of currentTurn.throws) {
    if (!th || !th.id || seen.has(th.id)) continue;
    seen.add(th.id);
    if (!th.coords || typeof th.coords.x !== "number") continue;

    const seg = th.segment;
    const segmentLabel = formatSegment(seg?.name, seg?.number, seg?.multiplier);
    const points = (seg?.number ?? 0) * (seg?.multiplier ?? 0);

    // Ziel ableiten wenn Checkout-Nähe (< 170 → Doppel ist letztes Ziel)
    const target = deriveTarget(currentScore, currentTurn.throws.length);

    const entry: IHeatmapThrow = {
      id: th.id,
      ts: Date.now(),
      matchId: match.id ?? "unknown",
      playerId: currentPlayer.userId ?? "self",
      x: th.coords.x,
      y: th.coords.y,
      segment: segmentLabel,
      multiplier: seg?.multiplier ?? 0,
      points,
      targetSegment: target,
    };
    await saveThrow(entry);
  }
}

function formatSegment(name: string | undefined, num: number | undefined, mult: number | undefined): string {
  if (name === "Bull" || name === "Bullseye") return "50";
  if (name === "25" || name === "Outer Bull") return "25";
  if (!num) return "MISS";
  if (mult === 3) return `T${num}`;
  if (mult === 2) return `D${num}`;
  if (mult === 1) return `S${num}`;
  return `${num}`;
}

/**
 * Sehr einfache Zielerkennung: Wenn Rest-Score ein bekanntes Doppel-Finish
 * unter 41 ist, war das Ziel die entsprechende Doppel-Fläche.
 */
function deriveTarget(remaining: number, throwIndex: number): string | undefined {
  const directDoubles: Record<number, string> = {
    40: "D20", 38: "D19", 36: "D18", 34: "D17", 32: "D16",
    30: "D15", 28: "D14", 26: "D13", 24: "D12", 22: "D11",
    20: "D10", 18: "D9", 16: "D8", 14: "D7", 12: "D6",
    10: "D5", 8: "D4", 6: "D3", 4: "D2", 2: "D1",
    50: "DB",
  };
  if (throwIndex === 0 && directDoubles[remaining]) return directDoubles[remaining];
  return undefined;
}
