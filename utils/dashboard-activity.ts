/**
 * dashboard-activity.ts – Pure view-model helpers for the Elite Home Dashboard's
 * "no active match" activity zone (last match summary, recent opponents).
 *
 * Side-effect free, operates only on already-existing CMR display data
 * (utils/match-history-view.ts) — no new storage, no new derivation of match
 * results themselves. Same identity-resolution caution as the rest of this
 * project: a player is only counted as "me" when `userId` actually matches,
 * never via a fixed index/position fallback.
 */

import { mapCmrsToDisplay, sortHistory, type ICmrMatchDisplay, type ICmrPlayerDisplay } from "./match-history-view";
import type { ICanonicalMatchResult } from "./canonical-match-result";

export type TLastMatchResult = "win" | "loss" | "undecided";

export interface ILastMatchSummary {
  opponentName: string;
  result: TLastMatchResult;
  variant?: string;
  myLegs?: number;
  opponentLegs?: number;
  myAverage?: number;
  recordedAt: string;
}

function resolveMe(match: ICmrMatchDisplay, myUserId: string | null | undefined): ICmrPlayerDisplay | undefined {
  if (!myUserId) return undefined;
  return match.players.find(p => p.userId === myUserId);
}

/**
 * The most recently recorded match, summarized for a compact "last match"
 * display. Returns `null` when there is no history yet — never a placeholder
 * match. `result` is "undecided" whenever identity or a winner can't be
 * resolved (never guessed).
 */
export function getLastMatchSummary(
  records: ICanonicalMatchResult[],
  myUserId: string | null | undefined,
): ILastMatchSummary | null {
  if (records.length === 0) return null;

  const sorted = sortHistory(mapCmrsToDisplay(records), "newest");
  const match = sorted[0];
  if (!match) return null;

  const me = resolveMe(match, myUserId);
  const opponent = match.players.find(p => p !== me) ?? match.players.find((_, i) => i !== me?.index);

  let result: TLastMatchResult = "undecided";
  if (me && match.finished && match.winnerIndex !== undefined) {
    result = match.winnerIndex === me.index ? "win" : "loss";
  }

  return {
    opponentName: opponent?.name ?? "Unbekannt",
    result,
    variant: match.variant,
    myLegs: me?.legs,
    opponentLegs: opponent?.legs,
    myAverage: me?.average,
    recordedAt: match.recordedAt,
  };
}

export interface IRecentOpponent {
  name: string;
  matchId: string;
  /** IPlayer.userId — fehlt z.B. bei Bots. Grundlage für Friends-Abgleich per ID, nie per Name. */
  userId?: string;
  /** CMR.recordedAt des Matches, in dem dieser Gegner zuletzt vorkam. */
  recordedAt: string;
  /** Ergebnis aus meiner Sicht in diesem Match. "undecided", wenn Sieger/Identität nicht auflösbar war. */
  result: TLastMatchResult;
  /** Mein Average in diesem Match, sofern von Autodarts geliefert. */
  myAverage?: number;
}

/**
 * Unique opponents from the most recent matches, newest first. An opponent is
 * anyone in the match who isn't resolved as "me" — if identity can't be
 * resolved for a given match at all, that match is skipped rather than
 * guessing who the opponent was. `result`/`myAverage` describe MY side of
 * that specific match (same resolution rules as `getLastMatchSummary`).
 */
export function getRecentOpponents(
  records: ICanonicalMatchResult[],
  myUserId: string | null | undefined,
  limit = 3,
): IRecentOpponent[] {
  if (records.length === 0 || !myUserId) return [];

  const sorted = sortHistory(mapCmrsToDisplay(records), "newest");
  const seen = new Set<string>();
  const opponents: IRecentOpponent[] = [];

  for (const match of sorted) {
    if (opponents.length >= limit) break;
    const me = resolveMe(match, myUserId);
    if (!me) continue; // identity unresolved in this match — skip, don't guess

    let result: TLastMatchResult = "undecided";
    if (match.finished && match.winnerIndex !== undefined) {
      result = match.winnerIndex === me.index ? "win" : "loss";
    }

    for (const player of match.players) {
      if (player === me) continue;
      const key = player.userId ?? player.name;
      if (seen.has(key)) continue;
      seen.add(key);
      opponents.push({
        name: player.name,
        matchId: match.matchId,
        userId: player.userId,
        recordedAt: match.recordedAt,
        result,
        myAverage: me.average,
      });
      if (opponents.length >= limit) break;
    }
  }

  return opponents;
}

/**
 * Wann zuletzt gemeinsam mit einem bestimmten Freund gespielt wurde — per
 * `userId` abgeglichen, nie per Name. Reine Convenience über
 * `getRecentOpponents()` (kein zweiter Ableitungsweg); `null`, wenn kein
 * gemeinsames Match mit auflösbarer Identität in `records` vorkommt.
 */
export function getLastPlayedWith(
  records: ICanonicalMatchResult[],
  myUserId: string | null | undefined,
  friendUserId: string | null | undefined,
): string | null {
  if (!friendUserId || records.length === 0) return null;
  const opponents = getRecentOpponents(records, myUserId, records.length);
  return opponents.find(o => o.userId === friendUserId)?.recordedAt ?? null;
}
