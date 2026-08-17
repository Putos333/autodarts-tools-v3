/**
 * statistics.ts – Pure Statistics Domain Layer.
 *
 * Nimmt ausschließlich `ICanonicalMatchResult[]` entgegen (aus
 * `local:canonical-match-results-v1`) und berechnet deterministisch
 * Kennzahlen. Kein Vue, kein Browser/DOM, kein Control-Center-Import, keine
 * Netzwerk-/Storage-Zugriffe — analog zu `utils/match-history-view.ts` und
 * `utils/canonical-match-result.ts` unter dem reinen Node-Testrunner
 * testbar.
 *
 * ── Datengrundlage (siehe STATISTICS_DATA_CONTRACT.md) ─────────────────────
 * Nur Felder, die CMR v1 tatsächlich garantiert, werden verwendet:
 *   matches/finished/winnerIndex/quality, players[].{average, total180,
 *   checkoutPoints, dartsThrown, first9Average, legs, sets}.
 *
 * Bewusst NICHT berechnet (Datenvertrag trägt es nicht, siehe Contract):
 *   Checkout-%/-Versuche/-Treffer, 100+/140+/170+, Matchdauer,
 *   Best-Leg/Dart-genaue Werte, echtes H2H.
 *
 * ── Spieler-Identität (bekannte Einschränkung, siehe ROADMAP_DEPENDENCIES.md) ─
 * Wer "ich" bin, ist ohne Laufzeit-Auth-Abruf (`getMyUserId()`, ein
 * Netzwerk-Call) nicht aus CMR allein ableitbar. Alle Funktionen hier nehmen
 * daher optional `myPlayerIndex` entgegen (Default: 0 — Positions-Index, wie
 * bereits in `match-history-view.ts::computeHistoryKPIs` etabliert und dort
 * bewusst als "Spieler 1" statt "Du" beschriftet). Diese Datei erfindet
 * keine neue, "korrigierte" Identitätslogik — sie übernimmt exakt dieselbe,
 * bereits produktive Konvention, parametrisiert statt hart codiert.
 */

import type { ICanonicalMatchResult, ICmrPlayer, TCmrQuality } from "./canonical-match-result";

// ─── Filter ─────────────────────────────────────────────────────────────────

export type TStatisticsPeriod = "all" | "last10" | "last20" | "30days";

export interface IStatisticsFilters {
  period: TStatisticsPeriod;
  /** "all" oder ein konkreter `gameMode`-Wert. */
  gameMode: "all" | string;
}

export const DEFAULT_STATISTICS_FILTERS: IStatisticsFilters = {
  period: "all",
  gameMode: "all",
};

/** Extrahiert die tatsächlich vorkommenden Spielmodi (für ein Filter-Dropdown). */
export function extractStatisticsGameModes(records: ICanonicalMatchResult[]): string[] {
  const modes = new Set<string>();
  for (const record of records) {
    if (record.gameMode) modes.add(record.gameMode);
  }
  return Array.from(modes).sort();
}

/**
 * Wendet Zeitraum- und Spielmodus-Filter an. Sortiert NICHT — reine
 * Mengen-Reduktion, damit `last10`/`last20` auf dem Aufrufer-seitig bereits
 * sortierten Bestand arbeiten (siehe `sortStatisticsRecords`).
 */
export function filterStatisticsRecords(
  records: ICanonicalMatchResult[],
  filters: IStatisticsFilters,
): ICanonicalMatchResult[] {
  let result = records;

  if (filters.gameMode !== "all") {
    result = result.filter(r => r.gameMode === filters.gameMode);
  }

  if (filters.period === "30days") {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    result = result.filter((r) => {
      const t = Date.parse(r.recordedAt);
      return Number.isFinite(t) && t >= cutoff;
    });
  } else if (filters.period === "last10" || filters.period === "last20") {
    const count = filters.period === "last10" ? 10 : 20;
    result = sortStatisticsRecords(result).slice(0, count);
  }

  return result;
}

/** Sortiert Records neueste zuerst (nach `recordedAt`). */
export function sortStatisticsRecords(records: ICanonicalMatchResult[]): ICanonicalMatchResult[] {
  return [ ...records ].sort((a, b) => {
    const ta = Date.parse(a.recordedAt);
    const tb = Date.parse(b.recordedAt);
    const na = Number.isFinite(ta) ? ta : 0;
    const nb = Number.isFinite(tb) ? tb : 0;
    return nb - na;
  });
}

// ─── Hilfsfunktionen ────────────────────────────────────────────────────────

function myPlayer(record: ICanonicalMatchResult, myPlayerIndex: number): ICmrPlayer | undefined {
  return record.players.find(p => p.index === myPlayerIndex);
}

/** Ein Match "zählt fürs Ergebnis", wenn es beendet ist und einen gültigen Sieger hat. */
function hasDecidedResult(record: ICanonicalMatchResult): boolean {
  return record.finished === true && record.winnerIndex !== undefined;
}

// ─── Match Summary (Anzahl, Siege/Niederlagen, Win Rate) ───────────────────

export interface IMatchSummary {
  /** Alle gespeicherten Records, unabhängig von Quality/Status. */
  totalMatches: number;
  /** finished === true. */
  completedMatches: number;
  /** finished === true UND winnerIndex vorhanden (Basis für Win/Loss). */
  decidedMatches: number;
  wins: number;
  losses: number;
  /** null, wenn `decidedMatches === 0` (nicht 0 vortäuschen). */
  winRate: number | null;
}

export function computeMatchSummary(
  records: ICanonicalMatchResult[],
  myPlayerIndex = 0,
): IMatchSummary {
  let completedMatches = 0;
  let decidedMatches = 0;
  let wins = 0;
  let losses = 0;

  for (const record of records) {
    if (record.finished) completedMatches++;
    if (!hasDecidedResult(record)) continue;

    decidedMatches++;
    if (record.winnerIndex === myPlayerIndex) wins++;
    else losses++;
  }

  return {
    totalMatches: records.length,
    completedMatches,
    decidedMatches,
    wins,
    losses,
    winRate: decidedMatches > 0 ? wins / decidedMatches : null,
  };
}

// ─── Average / Bester Average ───────────────────────────────────────────────

export interface IAverageStats {
  /** Ø über alle Matches mit bekanntem `average` für `myPlayerIndex`. null = keine Daten. */
  average: number | null;
  bestAverage: number | null;
  /** Anzahl Matches, die tatsächlich in `average`/`bestAverage` eingeflossen sind. */
  sampleSize: number;
}

export function computeAverageStats(
  records: ICanonicalMatchResult[],
  myPlayerIndex = 0,
): IAverageStats {
  const values: number[] = [];
  for (const record of records) {
    const p = myPlayer(record, myPlayerIndex);
    if (p?.average !== undefined) values.push(p.average);
  }

  if (values.length === 0) {
    return { average: null, bestAverage: null, sampleSize: 0 };
  }

  const sum = values.reduce((a, b) => a + b, 0);
  return {
    average: sum / values.length,
    bestAverage: Math.max(...values),
    sampleSize: values.length,
  };
}

// ─── 180er / First 9 / Highest Checkout ─────────────────────────────────────

export interface IScoringStats {
  total180: number;
  /** null, wenn keine Matches mit bekanntem total180 vorhanden sind. */
  avg180PerMatch: number | null;
  /** null, wenn kein Match ein `first9Average` führt (nicht jede Variante tut das). */
  avgFirst9: number | null;
  /** null, wenn kein Match ein `checkoutPoints` führt. Semantik: höchster Einzel-Checkout je Match. */
  highestCheckout: number | null;
}

export function computeScoringStats(
  records: ICanonicalMatchResult[],
  myPlayerIndex = 0,
): IScoringStats {
  let total180 = 0;
  let matchesWith180Field = 0;
  const first9Values: number[] = [];
  let highestCheckout: number | null = null;

  for (const record of records) {
    const p = myPlayer(record, myPlayerIndex);
    if (!p) continue;

    if (p.total180 !== undefined) {
      total180 += p.total180;
      matchesWith180Field++;
    }
    if (p.first9Average !== undefined) first9Values.push(p.first9Average);
    if (p.checkoutPoints !== undefined) {
      highestCheckout = highestCheckout === null ? p.checkoutPoints : Math.max(highestCheckout, p.checkoutPoints);
    }
  }

  return {
    total180,
    avg180PerMatch: matchesWith180Field > 0 ? total180 / matchesWith180Field : null,
    avgFirst9: first9Values.length > 0 ? first9Values.reduce((a, b) => a + b, 0) / first9Values.length : null,
    highestCheckout,
  };
}

// ─── Legs / Sets ─────────────────────────────────────────────────────────────

export interface ILegSetStats {
  legsWon: number;
  legsLost: number;
  /** null = kein Match in der Auswahl führt Sets (variantenabhängig). */
  setsWon: number | null;
  setsLost: number | null;
}

export function computeLegSetStats(
  records: ICanonicalMatchResult[],
  myPlayerIndex = 0,
): ILegSetStats {
  let legsWon = 0;
  let legsLost = 0;
  let setsWon = 0;
  let setsLost = 0;
  let anySets = false;

  for (const record of records) {
    const me = myPlayer(record, myPlayerIndex);
    if (!me) continue;
    const opponents = record.players.filter(p => p.index !== myPlayerIndex);

    if (me.legs !== undefined) {
      legsWon += me.legs;
      legsLost += opponents.reduce((sum, o) => sum + (o.legs ?? 0), 0);
    }
    if (me.sets !== undefined) {
      anySets = true;
      setsWon += me.sets;
      setsLost += opponents.reduce((sum, o) => sum + (o.sets ?? 0), 0);
    }
  }

  return { legsWon, legsLost, setsWon: anySets ? setsWon : null, setsLost: anySets ? setsLost : null };
}

// ─── Zeitverlauf (für Sparkline/Trend) ──────────────────────────────────────

export interface ITrendPoint {
  matchId: string;
  recordedAt: string;
  average: number;
}

/** Chronologisch (älteste zuerst) — passend für eine Trend-Darstellung von links nach rechts. */
export function computeAverageTrend(
  records: ICanonicalMatchResult[],
  myPlayerIndex = 0,
): ITrendPoint[] {
  const points: ITrendPoint[] = [];
  for (const record of records) {
    const p = myPlayer(record, myPlayerIndex);
    if (p?.average === undefined) continue;
    points.push({ matchId: record.matchId, recordedAt: record.recordedAt, average: p.average });
  }
  return points.sort((a, b) => {
    const ta = Date.parse(a.recordedAt);
    const tb = Date.parse(b.recordedAt);
    return (Number.isFinite(ta) ? ta : 0) - (Number.isFinite(tb) ? tb : 0);
  });
}

/** Letzte N Matches (neueste zuerst) mit Sieg/Niederlage-Kennzeichnung, für eine Formanzeige. */
export interface IRecentFormEntry {
  matchId: string;
  recordedAt: string;
  /** null = Ergebnis noch nicht entschieden/unbekannt (nicht als Niederlage werten!). */
  won: boolean | null;
  average?: number;
}

export function computeRecentForm(
  records: ICanonicalMatchResult[],
  count = 10,
  myPlayerIndex = 0,
): IRecentFormEntry[] {
  return sortStatisticsRecords(records)
    .slice(0, count)
    .map((record) => {
      const p = myPlayer(record, myPlayerIndex);
      return {
        matchId: record.matchId,
        recordedAt: record.recordedAt,
        won: hasDecidedResult(record) ? record.winnerIndex === myPlayerIndex : null,
        average: p?.average,
      };
    });
}

// ─── Quality-Aufschlüsselung (Statistiken dürfen Datenqualität nicht verstecken) ─

export interface IQualityBreakdown {
  complete: number;
  partial: number;
  minimal: number;
}

export function computeQualityBreakdown(records: ICanonicalMatchResult[]): IQualityBreakdown {
  const breakdown: IQualityBreakdown = { complete: 0, partial: 0, minimal: 0 };
  for (const record of records) {
    const key = qualityKey(record.quality);
    breakdown[key]++;
  }
  return breakdown;
}

function qualityKey(quality: TCmrQuality): keyof IQualityBreakdown {
  switch (quality) {
    case "COMPLETE": return "complete";
    case "PARTIAL": return "partial";
    case "MINIMAL": return "minimal";
  }
}

// ─── Gesamtübersicht (für die Statistics-UI in einem Aufruf) ───────────────

export interface IStatisticsOverview {
  summary: IMatchSummary;
  averages: IAverageStats;
  scoring: IScoringStats;
  legsSets: ILegSetStats;
  quality: IQualityBreakdown;
  trend: ITrendPoint[];
  recentForm: IRecentFormEntry[];
  gameModes: string[];
}

/**
 * Berechnet alle Kennzahlen in einem Aufruf. Wendet `filters` einmal an und
 * reicht das gefilterte Set an alle Einzel-Berechnungen weiter — vermeidet
 * mehrfaches Filtern/Sortieren derselben Daten (siehe Performance-Vorgabe).
 */
export function computeStatisticsOverview(
  records: ICanonicalMatchResult[],
  filters: IStatisticsFilters = DEFAULT_STATISTICS_FILTERS,
  myPlayerIndex = 0,
): IStatisticsOverview {
  const filtered = filterStatisticsRecords(records, filters);

  return {
    summary: computeMatchSummary(filtered, myPlayerIndex),
    averages: computeAverageStats(filtered, myPlayerIndex),
    scoring: computeScoringStats(filtered, myPlayerIndex),
    legsSets: computeLegSetStats(filtered, myPlayerIndex),
    quality: computeQualityBreakdown(filtered),
    trend: computeAverageTrend(filtered, myPlayerIndex),
    recentForm: computeRecentForm(filtered, 10, myPlayerIndex),
    gameModes: extractStatisticsGameModes(records), // aus dem UNGEFILTERTEN Bestand (Filter-Optionen)
  };
}
