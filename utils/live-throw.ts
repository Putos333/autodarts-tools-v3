/**
 * live-throw.ts – Pure derivation of the current turn's live throws (Wave 2,
 * Match Center Slice 1 — Live Throw Area).
 *
 * Side-effect free, operates only on the already-existing `IMatch` shape.
 * Deliberately independent from utils/checkout-path.ts (no shared helper
 * extracted) so the already-approved, already-tested Checkout Path is not
 * touched by this change — a few lines of turn-lookup are duplicated instead.
 *
 * Unlike the checkout path, this is not gated to X01 or to a specific player
 * identity check: `turns[0]` as "the current live throw" is the same
 * unconditional read every existing live consumer already uses (wled.ts,
 * caller.ts, sound-fx.ts, crowd.ts, ai-commentator.ts, precision-tracker.ts).
 */

import type { IMatch, ITurn } from "./websocket-helpers";

/** A single dart slot of the current, in-progress turn. */
export interface ICcLiveDart {
  /** Whether a real throw has been reported for this slot yet. */
  hit: boolean;
  /** `segment.name` taken verbatim from Autodarts (e.g. "T20", "D16", "Bull"). */
  label: string | null;
  /**
   * `IThrow.coords` verbatim from Autodarts (board mm, origin = center),
   * when the board reported one. `null` when there is no throw yet or no
   * coordinate was reported for it — never a guessed/derived position
   * (see utils/dartboard-geometry.ts for the segment-based fallback that
   * consumes this).
   */
  coords: { x: number; y: number } | null;
}

/** The active player's own previous completed visit (not just the last turn overall). */
export interface ICcPreviousVisit {
  score: number;
  /** Segment labels of that visit's darts, in throw order — only the real ones reported. */
  darts: string[];
}

export interface ICcLiveThrow {
  /** Whether there is a current, in-progress turn to show at all. */
  hasTurn: boolean;
  /** Always 3 slots when `hasTurn`, otherwise empty. */
  darts: ICcLiveDart[];
  /** `turns[0].points` — the running score of the current visit. */
  visitScore: number | null;
  /**
   * The same player's most recent *earlier* turn — found by `playerId`, not
   * by a fixed array offset, so it stays correct regardless of player count
   * or alternation order. `null` when there is no earlier turn yet (first
   * visit of the leg).
   */
  previousVisit: ICcPreviousVisit | null;
}

const NO_LIVE_THROW: ICcLiveThrow = { hasTurn: false, darts: [], visitScore: null, previousVisit: null };

export function deriveLiveThrow(match: IMatch | undefined): ICcLiveThrow {
  if (!match || match.finished) return NO_LIVE_THROW;

  const turns = Array.isArray(match.turns) ? match.turns : [];
  const current: ITurn | undefined = turns[0];
  if (!current) return NO_LIVE_THROW;

  const throws = Array.isArray(current.throws) ? current.throws : [];
  const darts: ICcLiveDart[] = [0, 1, 2].map((i) => {
    const t = throws[i];
    return {
      hit: Boolean(t),
      label: t ? (t.segment?.name ?? null) : null,
      coords: t?.coords ? { x: t.coords.x, y: t.coords.y } : null,
    };
  });

  const visitScore = typeof current.points === "number" ? current.points : null;

  const previousTurn = turns.slice(1).find(t => t.playerId === current.playerId);
  const previousVisit: ICcPreviousVisit | null = previousTurn
    ? {
        score: typeof previousTurn.points === "number" ? previousTurn.points : 0,
        darts: (Array.isArray(previousTurn.throws) ? previousTurn.throws : [])
          .map(t => t.segment?.name)
          .filter((label): label is string => Boolean(label)),
      }
    : null;

  return { hasTurn: true, darts, visitScore, previousVisit };
}
