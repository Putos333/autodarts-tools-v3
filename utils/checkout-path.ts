/**
 * checkout-path.ts – Pure derivation of the live checkout route (Wave 2, Match Hero).
 *
 * Side-effect free, operates only on the already-existing `IMatch` shape and an
 * injected checkout table (the real one lives in
 * entrypoints/match.content/bogey-warning.ts and is passed in by the caller —
 * kept out of this file so it stays free of `@/` / WXT / browser imports and
 * unit-testable the same way as match-history-view.ts / training-history.ts.
 */

import type { IMatch, IPlayer, ITurn } from "./websocket-helpers";

/** A single dart slot in the checkout route. */
export interface ICcCheckoutDart {
  /** Whether a real throw has been reported for this slot yet. */
  hit: boolean;
  /**
   * `segment.name` taken verbatim from Autodarts (e.g. "T20", "D16", "Bull") —
   * the same short form StreamingMode.vue already renders directly. No
   * relabeling, no invented segment data.
   */
  label: string | null;
}

/** Live checkout route for the active player's current turn. */
export interface ICcCheckoutPath {
  visible: boolean;
  /** Active player's remaining score that `suggestion` applies to. */
  remaining: number | null;
  /** Suggested route from the injected checkout table, e.g. "T20 T20 Bull". */
  suggestion: string | null;
  /** Always 3 slots when `visible`, otherwise empty. */
  darts: ICcCheckoutDart[];
}

export const NO_CHECKOUT_PATH: ICcCheckoutPath = { visible: false, remaining: null, suggestion: null, darts: [] };

/**
 * Reads only data Autodarts already reports on `IMatch` — no new data source,
 * no invented throw/segment data. Only ever reflects real, already-reported
 * throws of the current, in-progress turn (`turns[0]`); anything beyond that
 * stays an empty slot.
 *
 * Visibility requires all of:
 *   1. X01 (`checkouts` has no meaning for other variants)
 *   2. the match is still running (not finished)
 *   3. the active player's remaining score is a valid checkout (in `checkouts`)
 *   4. there is an in-progress turn that is demonstrably the active player's
 *      own turn (`turn.playerId === activePlayer.id` — fail closed, same
 *      caution as the rest of this project's identity resolution: the
 *      player index alone is not trusted) and that turn has not busted
 *
 * Reset between turns/matches is implicit: the result is a pure derivation of
 * `match`, there is no mutable state of its own to clean up.
 */
export function deriveCheckoutPath(
  match: IMatch | undefined,
  isX01: boolean,
  checkouts: Record<number, string>,
): ICcCheckoutPath {
  if (!isX01 || !match || match.finished) return NO_CHECKOUT_PATH;

  const activeIndex = match.player;
  if (typeof activeIndex !== "number" || activeIndex < 0) return NO_CHECKOUT_PATH;

  const activePlayer: IPlayer | undefined = match.players?.[activeIndex];
  if (!activePlayer?.id) return NO_CHECKOUT_PATH;

  const remaining = match.gameScores?.[activeIndex];
  if (typeof remaining !== "number") return NO_CHECKOUT_PATH;

  const suggestion = checkouts[remaining];
  if (!suggestion) return NO_CHECKOUT_PATH;

  const turn: ITurn | undefined = match.turns?.[0];
  if (!turn || turn.playerId !== activePlayer.id || turn.busted) return NO_CHECKOUT_PATH;

  const throws = Array.isArray(turn.throws) ? turn.throws : [];
  const darts: ICcCheckoutDart[] = [0, 1, 2].map((i) => {
    const t = throws[i];
    return { hit: Boolean(t), label: t ? (t.segment?.name ?? null) : null };
  });

  return { visible: true, remaining, suggestion, darts };
}
