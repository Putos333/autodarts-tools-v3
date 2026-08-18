/**
 * match-history-view.ts – Pure view-model helpers for Match History.
 *
 * These functions are side-effect free and operate only on CMR data.
 * They can be unit-tested without Vue, WXT, or browser context.
 */

import type {
  ICanonicalMatchResult,
  ICmrPlayer,
  TCmrQuality,
} from "./canonical-match-result";

/** Display shape for a player in the history list/detail. */
export interface ICmrPlayerDisplay {
  index: number;
  name: string;
  userId?: string;
  isBot?: boolean;
  legs?: number;
  sets?: number;
  average?: number;
  checkoutPoints?: number;
  total180?: number;
  dartsThrown?: number;
  first9Average?: number;
  isWinner: boolean;
}

/** Display shape for a match in the history list. */
export interface ICmrMatchDisplay {
  matchId: string;
  recordedAt: string;
  createdAt?: string;
  variant?: string;
  gameMode?: string;
  type?: string;
  quality: TCmrQuality;
  finished: boolean;
  winnerIndex?: number;
  revision: number;
  players: ICmrPlayerDisplay[];
}

/** Filter criteria for the history list. */
export interface IHistoryFilters {
  search: string;           // player name substring (case-insensitive)
  quality: "all" | TCmrQuality; // quality filter
  status: "all" | "finished" | "unfinished"; // finished filter
  gameMode: "all" | string; // game mode filter (empty = all)
}

/** Default filter state. */
export const DEFAULT_HISTORY_FILTERS: IHistoryFilters = {
  search: "",
  quality: "all",
  status: "all",
  gameMode: "all",
};

/** Sort options. */
export type THistorySort = "newest" | "oldest" | "quality" | "gameMode";

/**
 * Maps a raw CMR player to the display shape with winner flag.
 */
export function mapCmrPlayerToDisplay(
  player: ICmrPlayer,
  winnerIndex?: number,
): ICmrPlayerDisplay {
  return {
    index: player.index,
    name: player.name ?? `Spieler ${player.index + 1}`,
    userId: player.userId,
    isBot: player.isBot,
    legs: player.legs,
    sets: player.sets,
    average: player.average,
    checkoutPoints: player.checkoutPoints,
    total180: player.total180,
    dartsThrown: player.dartsThrown,
    first9Average: player.first9Average,
    isWinner: player.index === winnerIndex,
  };
}

/**
 * Maps a raw CMR to the display shape.
 */
export function mapCmrToDisplay(record: ICanonicalMatchResult): ICmrMatchDisplay {
  return {
    matchId: record.matchId,
    recordedAt: record.recordedAt,
    createdAt: record.createdAt,
    variant: record.variant,
    gameMode: record.gameMode,
    type: record.type,
    quality: record.quality,
    finished: record.finished,
    winnerIndex: record.winnerIndex,
    revision: record.revision,
    players: record.players.map((p) => mapCmrPlayerToDisplay(p, record.winnerIndex)),
  };
}

/**
 * Maps an array of CMRs to display shapes.
 */
export function mapCmrsToDisplay(records: ICanonicalMatchResult[]): ICmrMatchDisplay[] {
  return records.map(mapCmrToDisplay);
}

/**
 * Filters matches by the given criteria.
 */
export function filterHistory(
  matches: ICmrMatchDisplay[],
  filters: IHistoryFilters,
): ICmrMatchDisplay[] {
  return matches.filter((match) => {
    // Search filter (player name)
    if (filters.search.trim()) {
      const query = filters.search.trim().toLowerCase();
      const hasMatch = match.players.some(
        (p) => p.name.toLowerCase().includes(query),
      );
      if (!hasMatch) return false;
    }

    // Quality filter
    if (filters.quality !== "all" && match.quality !== filters.quality) {
      return false;
    }

    // Status filter
    if (filters.status === "finished" && !match.finished) return false;
    if (filters.status === "unfinished" && match.finished) return false;

    // Game mode filter
    if (filters.gameMode !== "all" && match.gameMode !== filters.gameMode) {
      return false;
    }

    return true;
  });
}

/**
 * Sorts matches by the given criterion.
 * Default: newest first (by recordedAt).
 */
export function sortHistory(
  matches: ICmrMatchDisplay[],
  sortBy: THistorySort = "newest",
): ICmrMatchDisplay[] {
  const sorted = [...matches];
  switch (sortBy) {
    case "newest":
      sorted.sort((a, b) => {
        const ta = new Date(a.recordedAt).getTime();
        const tb = new Date(b.recordedAt).getTime();
        return tb - ta; // descending
      });
      break;
    case "oldest":
      sorted.sort((a, b) => {
        const ta = new Date(a.recordedAt).getTime();
        const tb = new Date(b.recordedAt).getTime();
        return ta - tb; // ascending
      });
      break;
    case "quality": {
      const rank: Record<TCmrQuality, number> = { MINIMAL: 0, PARTIAL: 1, COMPLETE: 2 };
      sorted.sort((a, b) => rank[b.quality] - rank[a.quality]);
      break;
    }
    case "gameMode":
      sorted.sort((a, b) => {
        const am = a.gameMode ?? "";
        const bm = b.gameMode ?? "";
        return am.localeCompare(bm);
      });
      break;
  }
  return sorted;
}

/**
 * Extracts unique game modes from matches for filter dropdown.
 */
export function extractGameModes(matches: ICmrMatchDisplay[]): string[] {
  const modes = new Set<string>();
  for (const match of matches) {
    if (match.gameMode) modes.add(match.gameMode);
  }
  return Array.from(modes).sort();
}

/**
 * Computes KPI summary from matches.
 */
export interface IHistoryKPIs {
  total: number;
  complete: number;
  partial: number;
  minimal: number;
  finished: number;
  unfinished: number;
  wins: number; // matches where the authenticated user (resolved via userId) won
  avgAverage: number | null; // average of the authenticated user's averages (complete matches only)
}

/**
 * `myUserId` kommt aus `getUserIdFromToken()` (utils/helpers.ts, JWT `sub`-Claim,
 * kein Netzwerk-Call) und wird PRO MATCH gegen `player.userId` gematcht — nicht
 * gegen einen festen Index, da dieselbe Person in unterschiedlichen Matches an
 * unterschiedlichen Positionen sitzen kann. Fehlt `myUserId` oder taucht sie in
 * einem Match nicht auf, zählt dieses Match weder als Sieg noch als Niederlage
 * (kein Index-0-Fallback).
 */
export function computeHistoryKPIs(matches: ICmrMatchDisplay[], myUserId?: string | null): IHistoryKPIs {
  let complete = 0;
  let partial = 0;
  let minimal = 0;
  let finished = 0;
  let unfinished = 0;
  let wins = 0;
  let avgSum = 0;
  let avgCount = 0;

  for (const match of matches) {
    // Quality counts
    if (match.quality === "COMPLETE") complete++;
    else if (match.quality === "PARTIAL") partial++;
    else minimal++;

    // Status counts
    if (match.finished) finished++;
    else unfinished++;

    const me = myUserId ? match.players.find(p => p.userId === myUserId) : undefined;

    // Wins: nur werten, wenn die Identität in diesem Match aufgelöst werden konnte
    if (match.finished && me && match.winnerIndex === me.index) wins++;

    // Average of averages (only complete matches with data)
    if (match.quality === "COMPLETE" && me?.average !== undefined) {
      avgSum += me.average;
      avgCount++;
    }
  }

  return {
    total: matches.length,
    complete,
    partial,
    minimal,
    finished,
    unfinished,
    wins,
    avgAverage: avgCount > 0 ? avgSum / avgCount : null,
  };
}

/**
 * Formats a date string for display (German locale).
 */
export function formatDateDisplay(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Gets the quality pill tone for CcStatusPill.
 */
export function getQualityTone(quality: TCmrQuality): "ok" | "warn" | "bad" | "idle" | "accent" | "gold" {
  switch (quality) {
    case "COMPLETE": return "ok";
    case "PARTIAL": return "warn";
    case "MINIMAL": return "idle";
  }
}

/**
 * Gets a human-readable quality label.
 */
export function getQualityLabel(quality: TCmrQuality): string {
  switch (quality) {
    case "COMPLETE": return "Vollständig";
    case "PARTIAL": return "Teilweise";
    case "MINIMAL": return "Minimal";
  }
}

/**
 * Gets a human-readable status label.
 */
export function getStatusLabel(finished: boolean): { label: string; tone: "ok" | "bad" } {
  return finished
    ? { label: "Abgeschlossen", tone: "ok" }
    : { label: "Unvollständig", tone: "bad" };
}