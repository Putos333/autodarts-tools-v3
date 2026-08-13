/**
 * canonical-match-result.ts – Lean Canonical Match Result v1 (P2)
 *
 * Ein Match → EINE kanonische Ergebnisdarstellung.
 *
 * Heute wird dieselbe Match-Wahrheit an vier Stellen unabhängig voneinander
 * interpretiert (match-card.ts, share-card.ts, ft-auto-result.ts,
 * career-controller.ts) – mit vier unterschiedlichen Sieger-Regeln und
 * überall `?? 0` für fehlende Werte. Dieses Modul definiert die gemeinsame
 * Grundlage. Es migriert bewusst KEINEN dieser Consumer.
 *
 * Verbindliche Grenzen von v1:
 *
 *   • Kein Feld wird aus `IMatch.round` oder `IMatch.turns` abgeleitet – deren
 *     Semantik ist weiterhin unverifiziert.
 *   • Fehlend ist NIEMALS 0. Unbekannte Werte bleiben `undefined` und sind
 *     dadurch semantisch von einer echten 0 unterscheidbar.
 *   • Aufgenommen wird nur, was in `IMatch` / `IStats` deklariert ist. Nicht
 *     deklarierte Felder wie `matchStats.highFinish` oder
 *     `matchStats.bestLegAverage` (nur in share-card.ts über `any` benutzt)
 *     bleiben draußen, bis sie belegt sind.
 *
 * Das Modul ist absichtlich frei von Laufzeit-Imports (nur `import type`,
 * das beim Kompilieren verschwindet) und seiteneffektfrei, damit es ohne
 * Browser-/WXT-Kontext testbar bleibt.
 */

import type { IMatch } from "./websocket-helpers";

/** Schema-Version des persistierten Datensatzes. */
export const CMR_SCHEMA_VERSION = 1;

/**
 * Retention für v1.
 *
 * Die Discovery hat für einen schlanken Datensatz 547 B gemessen und 200
 * Einträge empfohlen (≈ 107 KB). Ein CMR-v1-Record ist kleiner, weil weder
 * Avatar-URLs noch Achievements aufgenommen werden. Damit liegt die
 * Obergrenze im niedrigen dreistelligen KB-Bereich und in derselben
 * Größenordnung wie bestehende Caps im Repository (`adt-match-card-seen` 60,
 * Match-Card-Galerie 30 PNG-DataURLs, dart-coins 500).
 *
 * Der verfügbare storage.local-Headroom ist weiterhin UNVERIFIED (Base64-Sounds
 * in `local:config-2-0-0`, PNG-Galerie), deshalb bleibt es bei einer harten,
 * kleinen Grenze. Die Konstante kann später ohne Datenmigration erhöht werden:
 * sie beeinflusst ausschließlich, wie viele Records behalten werden, nicht
 * deren Form.
 */
export const CMR_RETENTION_LIMIT = 200;

/** Vollständigkeitsgrad eines CMR. */
export type TCmrQuality = "MINIMAL" | "PARTIAL" | "COMPLETE";

const QUALITY_RANK: Record<TCmrQuality, number> = {
  MINIMAL: 0,
  PARTIAL: 1,
  COMPLETE: 2,
};

/**
 * Ein Spieler im kanonischen Ergebnis. Jedes optionale Feld bedeutet
 * „unbekannt" – nicht „null" und nicht „0".
 */
export interface ICmrPlayer {
  /** Position im Match (IPlayer.index, sonst Array-Position). */
  index: number;
  /** IPlayer.name */
  name?: string;
  /** IPlayer.userId, ersatzweise IPlayer.user.id. Fehlt z.B. bei Bots. */
  userId?: string;
  /** Aus IPlayer.cpuPPR abgeleitet: number = Bot, null = Mensch, fehlend = unbekannt. */
  isBot?: boolean;
  /** IMatch.scores[i].legs */
  legs?: number;
  /** IMatch.scores[i].sets */
  sets?: number;
  /** IMatch.stats[i].matchStats.average */
  average?: number;
  /** IMatch.stats[i].matchStats.checkoutPoints */
  checkoutPoints?: number;
  /** IMatch.stats[i].matchStats.total180 */
  total180?: number;
  /** IMatch.stats[i].matchStats.dartsThrown */
  dartsThrown?: number;
  /** IMatch.stats[i].matchStats.first9Average */
  first9Average?: number;
}

/** Das kanonische Match-Ergebnis. */
export interface ICanonicalMatchResult {
  schemaVersion: number;
  /** IMatch.id – ohne stabile ID entsteht kein CMR. */
  matchId: string;
  /** Beginnt bei 1 und steigt nur bei einer echten inhaltlichen Änderung. */
  revision: number;
  quality: TCmrQuality;
  /** IMatch.createdAt, nur wenn nicht-leerer String. */
  createdAt?: string;
  /** Zeitpunkt der CMR-Erzeugung, vom Aufrufer gesetzt. */
  recordedAt: string;
  /** IMatch.variant */
  variant?: string;
  /** IMatch.settings.gameMode */
  gameMode?: string;
  /** IMatch.type */
  type?: string;
  /** IMatch.finished === true */
  finished: boolean;
  /** IMatch.winner, nur wenn >= 0 und auf einen vorhandenen Spieler zeigt. */
  winnerIndex?: number;
  players: ICmrPlayer[];
}

/** Ergebnis einer Zusammenführung von altem und neuem Stand. */
export type TCmrOutcome = "created" | "updated" | "unchanged" | "rejected-weaker";

export interface ICmrReconcileResult {
  outcome: TCmrOutcome;
  /** Der Stand, der gelten soll – bei `unchanged`/`rejected-weaker` der bisherige. */
  record: ICanonicalMatchResult;
}

// ─── Wert-Normalisierung ──────────────────────────────────────────────────────
// Diese beiden Helfer sind der Kern der Regel "fehlend ist nicht 0": alles, was
// kein belastbarer Wert ist, wird zu undefined statt zu einem Ersatzwert.

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

// ─── Aufbau ───────────────────────────────────────────────────────────────────

function buildPlayers(match: any): ICmrPlayer[] {
  const players = Array.isArray(match?.players) ? match.players : [];
  const scores = Array.isArray(match?.scores) ? match.scores : [];
  const stats = Array.isArray(match?.stats) ? match.stats : [];

  return players.map((player: any, position: number): ICmrPlayer => {
    const matchStats = stats[position]?.matchStats;
    const cpuPPR = player?.cpuPPR;

    return {
      index: num(player?.index) ?? position,
      name: str(player?.name),
      userId: str(player?.userId) ?? str(player?.user?.id),
      isBot: typeof cpuPPR === "number" ? true : (cpuPPR === null ? false : undefined),
      legs: num(scores[position]?.legs),
      sets: num(scores[position]?.sets),
      average: num(matchStats?.average),
      checkoutPoints: num(matchStats?.checkoutPoints),
      total180: num(matchStats?.total180),
      dartsThrown: num(matchStats?.dartsThrown),
      first9Average: num(matchStats?.first9Average),
    };
  });
}

/**
 * Erzeugt ein CMR aus einem Match-Snapshot.
 *
 * @param match      Der Snapshot aus `local:game-data`
 * @param recordedAt Zeitstempel des Aufrufers (injiziert, damit die Funktion
 *                   deterministisch und testbar bleibt)
 * @returns          Das CMR oder null, wenn keine stabile Match-Identität existiert
 */
export function buildCanonicalMatchResult(match: IMatch | undefined | null, recordedAt: string): ICanonicalMatchResult | null {
  const matchId = str((match as any)?.id);
  if (!matchId) return null;

  const players = buildPlayers(match);
  const winner = num((match as any)?.winner);
  const winnerIndex = winner !== undefined && winner >= 0 && winner < players.length ? winner : undefined;

  const record: ICanonicalMatchResult = {
    schemaVersion: CMR_SCHEMA_VERSION,
    matchId,
    revision: 1,
    quality: "MINIMAL",
    createdAt: str((match as any)?.createdAt),
    recordedAt,
    variant: str((match as any)?.variant),
    gameMode: str((match as any)?.settings?.gameMode),
    type: str((match as any)?.type),
    finished: (match as any)?.finished === true,
    winnerIndex,
    players,
  };

  record.quality = computeCmrQuality(record);
  return record;
}

// ─── Vollständigkeitsgrad ─────────────────────────────────────────────────────

/**
 * Regeln:
 *
 *   COMPLETE – Ergebnis steht fest UND jeder Spieler hat einen Spielstand
 *              (legs oder sets) UND die Kernstatistik (average + dartsThrown).
 *   PARTIAL  – Ergebnis steht fest, aber Spielstand oder Kernstatistik fehlen.
 *   MINIMAL  – das Ergebnis steht noch nicht fest.
 *
 * "Ergebnis steht fest" heißt: finished === true, ein gültiger winnerIndex und
 * mindestens zwei Spieler.
 */
export function computeCmrQuality(record: ICanonicalMatchResult): TCmrQuality {
  const hasResult = record.finished && record.winnerIndex !== undefined && record.players.length >= 2;
  if (!hasResult) return "MINIMAL";

  const hasScores = record.players.every(p => p.legs !== undefined || p.sets !== undefined);
  const hasCoreStats = record.players.every(p => p.average !== undefined && p.dartsThrown !== undefined);

  return hasScores && hasCoreStats ? "COMPLETE" : "PARTIAL";
}

/** Anzahl tatsächlich bekannter optionaler Werte – das Maß für "mehr Information". */
export function countKnownCmrValues(record: ICanonicalMatchResult): number {
  const topLevel = [ record.createdAt, record.variant, record.gameMode, record.type, record.winnerIndex ];
  let known = topLevel.filter(value => value !== undefined).length;

  for (const player of record.players) {
    const values = [
      player.name,
      player.userId,
      player.isBot,
      player.legs,
      player.sets,
      player.average,
      player.checkoutPoints,
      player.total180,
      player.dartsThrown,
      player.first9Average,
    ];
    known += values.filter(value => value !== undefined).length;
  }

  return known;
}

// ─── Revision ─────────────────────────────────────────────────────────────────

/**
 * Vergleicht den fachlichen Inhalt zweier CMR. `revision` und `recordedAt`
 * sind bewusst ausgenommen: sie sind Metadaten und dürfen keine künstliche
 * neue Revision erzeugen.
 */
function isSameContent(a: ICanonicalMatchResult, b: ICanonicalMatchResult): boolean {
  const strip = (record: ICanonicalMatchResult) => JSON.stringify({ ...record, revision: 0, recordedAt: "" });
  return strip(a) === strip(b);
}

/**
 * Führt einen neuen Stand mit dem bisherigen zusammen.
 *
 *   • kein bisheriger Stand              → created, revision 1
 *   • inhaltlich identisch               → unchanged, Revision bleibt
 *   • schlechtere Quality                → rejected-weaker, bisheriger Stand bleibt
 *   • gleiche Quality, weniger Information → rejected-weaker
 *   • sonst                              → updated, revision + 1
 */
export function reconcileCanonicalMatchResult(
  existing: ICanonicalMatchResult | undefined,
  next: ICanonicalMatchResult,
): ICmrReconcileResult {
  if (!existing || existing.matchId !== next.matchId) {
    return { outcome: "created", record: { ...next, revision: 1 } };
  }

  if (isSameContent(existing, next)) {
    return { outcome: "unchanged", record: existing };
  }

  const existingRank = QUALITY_RANK[existing.quality] ?? 0;
  const nextRank = QUALITY_RANK[next.quality] ?? 0;

  if (nextRank < existingRank) {
    return { outcome: "rejected-weaker", record: existing };
  }

  if (nextRank === existingRank && countKnownCmrValues(next) < countKnownCmrValues(existing)) {
    return { outcome: "rejected-weaker", record: existing };
  }

  return { outcome: "updated", record: { ...next, revision: existing.revision + 1 } };
}

// ─── Sammlung & Retention ─────────────────────────────────────────────────────

/**
 * Filtert alles heraus, was kein brauchbares CMR ist. Ein beschädigter oder
 * fremdformatiger Storage-Eintrag darf niemals zum Absturz führen – er wird
 * schlicht ignoriert.
 */
export function sanitizeCanonicalMatchResults(value: unknown): ICanonicalMatchResult[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const out: ICanonicalMatchResult[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;

    const record = entry as Partial<ICanonicalMatchResult>;
    const matchId = str(record.matchId);
    if (!matchId || seen.has(matchId)) continue;
    if (record.schemaVersion !== CMR_SCHEMA_VERSION) continue;
    if (!Array.isArray(record.players)) continue;

    const revision = num(record.revision);
    if (revision === undefined || revision < 1) continue;
    if (QUALITY_RANK[record.quality as TCmrQuality] === undefined) continue;

    seen.add(matchId);
    out.push(record as ICanonicalMatchResult);
  }

  return out;
}

/** Behält die neuesten `limit` Einträge. Die Liste ist neueste-zuerst sortiert. */
export function applyCmrRetention(
  records: ICanonicalMatchResult[],
  limit: number = CMR_RETENTION_LIMIT,
): ICanonicalMatchResult[] {
  if (limit <= 0) return [];
  return records.length > limit ? records.slice(0, limit) : records;
}

export interface ICmrUpsertResult {
  outcome: TCmrOutcome;
  record: ICanonicalMatchResult;
  records: ICanonicalMatchResult[];
}

/**
 * Fügt einen Stand in die Sammlung ein bzw. aktualisiert ihn. Bei `unchanged`
 * und `rejected-weaker` bleibt die Sammlung unverändert – der Aufrufer soll
 * dann gar nicht erst schreiben.
 */
export function upsertCanonicalMatchResult(
  records: ICanonicalMatchResult[],
  next: ICanonicalMatchResult,
  limit: number = CMR_RETENTION_LIMIT,
): ICmrUpsertResult {
  const existingIndex = records.findIndex(record => record.matchId === next.matchId);
  const existing = existingIndex >= 0 ? records[existingIndex] : undefined;
  const reconciled = reconcileCanonicalMatchResult(existing, next);

  if (reconciled.outcome === "unchanged" || reconciled.outcome === "rejected-weaker") {
    return { outcome: reconciled.outcome, record: reconciled.record, records };
  }

  const remaining = existingIndex >= 0
    ? [ ...records.slice(0, existingIndex), ...records.slice(existingIndex + 1) ]
    : records;

  return {
    outcome: reconciled.outcome,
    record: reconciled.record,
    records: applyCmrRetention([ reconciled.record, ...remaining ], limit),
  };
}
