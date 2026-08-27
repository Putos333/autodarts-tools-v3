/**
 * training-performance.ts – Pure derivations over real training history
 * (Elite Training Center): personal bests, aggregate performance, a
 * retrospective progress trend, and a deterministic, self-relative
 * training recommendation.
 *
 * Side-effect free, operates only on the already-existing `TrainingSession[]`
 * (utils/training-history.ts) — no new storage, no invented fields. Same
 * "never guess, degrade gracefully" discipline as the rest of this project:
 * every result that can't be honestly computed comes back `null`/`sufficient:
 * false` rather than a fabricated number.
 *
 * Deliberately not a rewards/achievement layer — these are plain aggregates
 * (max/mean) over data the player already generated; nothing is unlocked
 * or awarded here.
 */

import type { ExerciseCategory } from "./training-exercises";
import type { TrainingSession } from "./training-history";

// ─── Personal Bests ──────────────────────────────────────────────────────────

export interface ITrainingBestEntry {
  value: number;
  date: string;
}

export interface ITrainingPersonalBests {
  bestAverage: ITrainingBestEntry | null;
  best180sInSession: ITrainingBestEntry | null;
  bestCheckoutRate: ITrainingBestEntry | null;
  sampleSize: number;
}

const NO_BESTS: ITrainingPersonalBests = {
  bestAverage: null,
  best180sInSession: null,
  bestCheckoutRate: null,
  sampleSize: 0,
};

/** Plain max() over real, already-stored sessions — no new storage, nothing awarded. */
export function computePersonalBests(sessions: TrainingSession[]): ITrainingPersonalBests {
  if (sessions.length === 0) return NO_BESTS;

  let bestAverage: ITrainingBestEntry | null = null;
  let best180s: ITrainingBestEntry | null = null;
  let bestCheckout: ITrainingBestEntry | null = null;

  for (const s of sessions) {
    if (typeof s.average === "number" && (bestAverage === null || s.average > bestAverage.value)) {
      bestAverage = { value: s.average, date: s.date };
    }
    if (typeof s.count180s === "number" && (best180s === null || s.count180s > best180s.value)) {
      best180s = { value: s.count180s, date: s.date };
    }
    if (typeof s.checkoutRate === "number" && (bestCheckout === null || s.checkoutRate > bestCheckout.value)) {
      bestCheckout = { value: s.checkoutRate, date: s.date };
    }
  }

  return { bestAverage, best180sInSession: best180s, bestCheckoutRate: bestCheckout, sampleSize: sessions.length };
}

/** Whether a specific session equals the all-sessions best for a given metric — for a "new personal best" callout that is only ever true when mathematically true. */
export function isSessionPersonalBest(
  session: TrainingSession,
  metric: "average" | "count180s" | "checkoutRate",
  bests: ITrainingPersonalBests,
): boolean {
  const best = metric === "average" ? bests.bestAverage : metric === "count180s" ? bests.best180sInSession : bests.bestCheckoutRate;
  if (!best) return false;
  return session[metric] === best.value && session.date === best.date;
}

// ─── Aggregate performance ───────────────────────────────────────────────────

export interface ITrainingPerformance {
  sessionCount: number;
  /** Mean of `average` across all sessions with the field. null = no data. */
  meanAverage: number | null;
  /** Mean of `checkoutRate` across all sessions with the field. null = no data. */
  meanCheckoutRate: number | null;
}

export function computeTrainingPerformance(sessions: TrainingSession[]): ITrainingPerformance {
  const averages = sessions.map(s => s.average).filter((v): v is number => typeof v === "number");
  const checkoutRates = sessions.map(s => s.checkoutRate).filter((v): v is number => typeof v === "number");
  return {
    sessionCount: sessions.length,
    meanAverage: averages.length > 0 ? averages.reduce((a, b) => a + b, 0) / averages.length : null,
    meanCheckoutRate: checkoutRates.length > 0 ? checkoutRates.reduce((a, b) => a + b, 0) / checkoutRates.length : null,
  };
}

// ─── Progress trend (retrospective only) ─────────────────────────────────────

export interface ITrainingProgressPoint {
  date: string;
  average: number;
  isBest: boolean;
}

/**
 * The last `count` sessions with a known `average`, oldest first (chart
 * reading order), each flagged if it equals the all-time best average.
 * Purely descriptive of what already happened — never a projection.
 */
export function computeProgressTrend(sessions: TrainingSession[], count = 8): ITrainingProgressPoint[] {
  const withAverage = sessions.filter(s => typeof s.average === "number");
  if (withAverage.length === 0) return [];

  const bestValue = Math.max(...withAverage.map(s => s.average));
  // sessions[] is newest-first; take the most recent `count`, then reverse to oldest-first for charting.
  return withAverage.slice(0, count).reverse().map(s => ({
    date: s.date,
    average: s.average,
    isBest: s.average === bestValue,
  }));
}

// ─── Recommendation (deterministic, self-relative, retrospective) ───────────

export type TTrainingRecommendationReason = "checkout" | "scoring" | "on-par" | "insufficient-data";

export interface ITrainingRecommendation {
  sufficient: boolean;
  reason: TTrainingRecommendationReason;
  suggestedCategory: ExerciseCategory | null;
  /** Mean over the most recent sessions considered. */
  recentValue: number | null;
  /** Mean over the player's own full history. */
  overallValue: number | null;
}

const MIN_SESSIONS_FOR_RECOMMENDATION = 5;

/**
 * Compares the player's own recent sessions against their own full history —
 * never an external "good average" benchmark, never another player, never a
 * forecast. Below `MIN_SESSIONS_FOR_RECOMMENDATION` real sessions, returns
 * `sufficient: false` rather than guessing from too little data.
 *
 * Checks checkout rate first (recent mean < overall mean → suggest a
 * "checkout" exercise), then scoring average (recent mean < overall mean →
 * suggest an "accuracy" exercise). If neither recent figure trails the
 * player's own overall figure, the honest result is "on-par" — not a forced
 * suggestion.
 */
export function computeTrainingRecommendation(sessions: TrainingSession[]): ITrainingRecommendation {
  const insufficient: ITrainingRecommendation = {
    sufficient: false, reason: "insufficient-data", suggestedCategory: null, recentValue: null, overallValue: null,
  };
  if (sessions.length < MIN_SESSIONS_FOR_RECOMMENDATION) return insufficient;

  const recentCount = Math.min(5, sessions.length);
  const recent = sessions.slice(0, recentCount); // newest-first, so this is "the most recent N"

  const checkoutRates = sessions.map(s => s.checkoutRate).filter((v): v is number => typeof v === "number");
  const recentCheckoutRates = recent.map(s => s.checkoutRate).filter((v): v is number => typeof v === "number");
  if (checkoutRates.length >= MIN_SESSIONS_FOR_RECOMMENDATION && recentCheckoutRates.length > 0) {
    const overall = mean(checkoutRates);
    const recentMean = mean(recentCheckoutRates);
    if (recentMean < overall) {
      return { sufficient: true, reason: "checkout", suggestedCategory: "checkout", recentValue: recentMean, overallValue: overall };
    }
  }

  const averages = sessions.map(s => s.average).filter((v): v is number => typeof v === "number");
  const recentAverages = recent.map(s => s.average).filter((v): v is number => typeof v === "number");
  if (averages.length >= MIN_SESSIONS_FOR_RECOMMENDATION && recentAverages.length > 0) {
    const overall = mean(averages);
    const recentMean = mean(recentAverages);
    if (recentMean < overall) {
      return { sufficient: true, reason: "scoring", suggestedCategory: "accuracy", recentValue: recentMean, overallValue: overall };
    }
  }

  return { sufficient: true, reason: "on-par", suggestedCategory: null, recentValue: null, overallValue: null };
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}
