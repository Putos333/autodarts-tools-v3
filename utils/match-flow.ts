/**
 * match-flow.ts – Pure derivations for Match Flow (Wave 2, Match Center Slice 2):
 * recent visits and a deliberately small, honest momentum indicator.
 *
 * Side-effect free, operates only on the already-existing `IMatch` shape.
 * Independent from utils/checkout-path.ts and utils/live-throw.ts (no shared
 * helper extracted) so neither already-approved feature is touched.
 *
 * Explicitly NOT included here (deferred per the Slice 2 brief):
 *   - last-leg finish detail (needs a capture-on-leg-end snapshot that
 *     doesn't exist yet — turns[] resets each leg, so it isn't in current state)
 *   - a true match-format ("Best of N Legs") indicator for regular matches
 *     (Autodarts' live snapshot has no legsToWin/setsToWin field; that only
 *     exists in this extension's own Career-mode config, out of scope here)
 */

import type { IMatch } from "./websocket-helpers";

/** One completed visit, already resolved to a real player position. */
export interface ICcRecentVisit {
  /** `turn.id` — stable list key. */
  id: string;
  /** Position in `match.players[]` — 0 = red/left, 1 = blue/right by this codebase's existing convention. */
  playerIndex: number;
  playerName: string;
  score: number;
  /** Real segment labels only, in throw order. */
  darts: string[];
}

/**
 * The last few *completed* visits, most recent first. Deliberately skips
 * `turns[0]` (the current, still-in-progress turn) — that's already owned by
 * the Live Throw Area (Slice 1) and showing it again here would duplicate it.
 *
 * A turn whose `playerId` cannot be matched to a known player is dropped
 * rather than guessed at (fail-closed — correct player association is
 * mandatory here, same caution as the rest of this project's identity
 * resolution).
 */
export function deriveRecentVisits(match: IMatch | undefined, limit = 5): ICcRecentVisit[] {
  if (!match || match.finished) return [];

  const turns = Array.isArray(match.turns) ? match.turns : [];
  const players = Array.isArray(match.players) ? match.players : [];
  if (turns.length < 2 || players.length === 0) return [];

  const visits: ICcRecentVisit[] = [];
  for (const turn of turns.slice(1, 1 + Math.max(0, limit))) {
    const playerIndex = players.findIndex(p => p.id === turn.playerId);
    if (playerIndex < 0) continue; // unresolvable identity — never guess

    const throws = Array.isArray(turn.throws) ? turn.throws : [];
    visits.push({
      id: turn.id,
      playerIndex,
      playerName: players[playerIndex]?.name || `Spieler ${playerIndex + 1}`,
      score: typeof turn.points === "number" ? turn.points : 0,
      darts: throws.map(t => t.segment?.name).filter((label): label is string => Boolean(label)),
    });
  }
  return visits;
}

export type TCcMomentumTrend = "up" | "down" | "flat";

export interface ICcMomentum {
  visible: boolean;
  trend: TCcMomentumTrend | null;
  /** The completed visit this reads (never the in-progress one). */
  visitScore: number | null;
  /** The same player's match average it's compared against. */
  average: number | null;
  /** `(visitScore - average) / average * 100` — kept for an honest, exact label. Never a probability. */
  deltaPercent: number | null;
}

const NO_MOMENTUM: ICcMomentum = { visible: false, trend: null, visitScore: null, average: null, deltaPercent: null };

/** Below this absolute % difference from the player's own average, call it "flat" rather than up/down. */
export const MOMENTUM_FLAT_THRESHOLD_PERCENT = 10;

/**
 * The smallest deterministic momentum signal that is honestly derivable from
 * current state: how the active player's most recently *completed* visit
 * compares to their own match average.
 *
 * Explainable in one sentence ("your last visit vs. your match average"),
 * deterministic (pure function of two already-real numbers), never a trend
 * over a window (avoids the small-sample-early-in-a-leg problem — turns[]
 * resets each leg, so a multi-visit "form" reading could be built on as few
 * as one or two visits and would misrepresent its own confidence), and never
 * phrased as a forecast — it describes one visit that already happened.
 *
 * Resets implicitly: both inputs are pure derivations of the current match
 * snapshot, so a new turn, leg or match recomputes this from scratch with no
 * state of its own to clean up.
 */
export function deriveMomentum(
  visitScore: number | null | undefined,
  average: number | null | undefined,
): ICcMomentum {
  if (typeof visitScore !== "number" || typeof average !== "number" || average <= 0) {
    return NO_MOMENTUM;
  }

  const deltaPercent = ((visitScore - average) / average) * 100;
  let trend: TCcMomentumTrend = "flat";
  if (deltaPercent > MOMENTUM_FLAT_THRESHOLD_PERCENT) trend = "up";
  else if (deltaPercent < -MOMENTUM_FLAT_THRESHOLD_PERCENT) trend = "down";

  return { visible: true, trend, visitScore, average, deltaPercent };
}
