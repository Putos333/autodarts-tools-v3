/**
 * canonical-match-result.ts – zentraler Emit-Punkt für das CMR (P2)
 *
 * Erkennt das Match-Ende exakt so wie die bereits vorhandenen Stellen
 * (match-card.ts:518-522, ft-auto-result.ts:168-173) und schreibt daraus ein
 * kanonisches Ergebnis.
 *
 * Bewusst KEINE Consumer-Migration: match-card, share-card, ft-auto-result und
 * career-controller bleiben unverändert. Dieses Modul legt nur die Grundlage.
 *
 * Kosten während des Spiels: ein Boolean-Check pro Game-Data-Änderung. Erst bei
 * einem beendeten Match wird gelesen, und geschrieben wird nur, wenn sich der
 * Stand wirklich verbessert (siehe persistCanonicalMatchResult).
 */

import type { IMatch } from "@/utils/websocket-helpers";

import { buildCanonicalMatchResult } from "@/utils/canonical-match-result";
import { persistCanonicalMatchResult } from "@/utils/canonical-match-result-storage";
import { AutodartsToolsGameData } from "@/utils/game-data-storage";

let gameDataWatcherUnwatch: (() => void) | null = null;

/**
 * Emits werden hintereinander abgearbeitet. Ohne diese Kette könnten zwei
 * schnell aufeinanderfolgende Snapshots beide lesen, bevor einer geschrieben
 * hat – dann würde die "schwächere Daten gewinnen nicht"-Regel gegen einen
 * veralteten Stand prüfen.
 */
let pendingEmits: Promise<void> = Promise.resolve();

/** true, sobald das Match ein verwertbares Ergebnis trägt. */
function hasResult(match: IMatch | undefined): boolean {
  if (!match) return false;
  if (match.finished === true) return true;
  return typeof match.winner === "number" && match.winner >= 0;
}

async function emit(match: IMatch): Promise<void> {
  const record = buildCanonicalMatchResult(match, new Date().toISOString());
  if (!record) return; // keine stabile Match-ID → kein CMR

  const outcome = await persistCanonicalMatchResult(record);
  if (outcome === "created" || outcome === "updated") {
    console.log("Autodarts Tools: CMR", outcome, record.matchId, record.quality, `rev ${record.revision}`);
  }
}

export function initCanonicalMatchResult(): void {
  if (gameDataWatcherUnwatch) return;

  gameDataWatcherUnwatch = AutodartsToolsGameData.watch((value) => {
    const match = value?.match;
    // Während des laufenden Matches passiert hier nichts weiter als dieser Check.
    if (!hasResult(match)) return;
    pendingEmits = pendingEmits
      .then(() => emit(match as IMatch))
      .catch(error => console.error("Autodarts Tools: CMR-Emit fehlgeschlagen", error));
  });
}

export function cleanupCanonicalMatchResult(): void {
  gameDataWatcherUnwatch?.();
  gameDataWatcherUnwatch = null;
  pendingEmits = Promise.resolve();
}
