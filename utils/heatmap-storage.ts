/**
 * heatmap-storage.ts – IndexedDB-Speicher für Wurf-Koordinaten (v2.9.74)
 *
 * Persistiert jeden geworfenen Dart mit exakter Koordinate, Segment und Ziel.
 * Basis für Heatmap-Visualisierung und KI-Coach-Analyse.
 */

import { openDB, type IDBPDatabase } from "idb";

export interface IHeatmapThrow {
  id: string;                  // Autodarts-Wurf-ID
  ts: number;                  // Zeitstempel (ms)
  matchId: string;             // Match-ID
  playerId: string;            // Nur eigene Würfe werden gespeichert
  x: number;                   // Koordinate x (Board-Einheit, ca. -170..170 mm)
  y: number;                   // Koordinate y
  segment: string;             // z.B. "T20", "D16", "S1", "25", "50"
  multiplier: number;          // 1 (Single), 2 (Double), 3 (Triple)
  points: number;              // Wurf-Punkte (segment*multiplier)
  targetSegment?: string;      // erwartetes Ziel (optional, wenn ableitbar)
  isCheckout?: boolean;
}

const DB_NAME = "adt-heatmap";
const DB_VERSION = 1;
const STORE = "throws";

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("ts", "ts");
          store.createIndex("matchId", "matchId");
          store.createIndex("segment", "segment");
        }
      },
    });
  }
  return dbPromise;
}

export async function saveThrow(t: IHeatmapThrow): Promise<void> {
  try {
    const db = await getDb();
    await db.put(STORE, t);
  } catch (e) {
    console.warn("Heatmap: saveThrow Fehler", e);
  }
}

export async function saveThrows(list: IHeatmapThrow[]): Promise<void> {
  if (!list.length) return;
  try {
    const db = await getDb();
    const tx = db.transaction(STORE, "readwrite");
    await Promise.all(list.map(t => tx.store.put(t)));
    await tx.done;
  } catch (e) {
    console.warn("Heatmap: saveThrows Fehler", e);
  }
}

export interface IHeatmapFilter {
  matchId?: string;
  sinceTs?: number;
  limit?: number;
}

export async function getThrows(filter: IHeatmapFilter = {}): Promise<IHeatmapThrow[]> {
  try {
    const db = await getDb();
    const all = await db.getAll(STORE);
    let out = all as IHeatmapThrow[];
    if (filter.matchId) out = out.filter(t => t.matchId === filter.matchId);
    if (filter.sinceTs) out = out.filter(t => t.ts >= filter.sinceTs!);
    out.sort((a, b) => b.ts - a.ts);
    if (filter.limit) out = out.slice(0, filter.limit);
    return out;
  } catch (e) {
    console.warn("Heatmap: getThrows Fehler", e);
    return [];
  }
}

/** Zählt Treffer je Segment-Bezeichnung. */
export function aggregateBySegment(throws: IHeatmapThrow[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of throws) {
    const key = t.segment || "MISS";
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

/** Statistik: Treffer Triple-20, T19, T18 + Doppelquote nach Segment. */
export interface IHeatmapStats {
  total: number;
  t20Hits: number;
  t19Hits: number;
  t18Hits: number;
  bullHits: number;
  bullseyeHits: number;
  totalDoubles: number;
  doubleAttempts: number;
  doubleAcc: Record<string, { hits: number; attempts: number }>;
  avgOffsetMm: number;             // Ø Streuung um Mittelpunkt der T-20-Zone
  scoreZones: {
    center: number;                // Bulls + 25
    top: number;                   // t20/d20/s20 zone
    bottomLeft: number;
    bottomRight: number;
    misses: number;                // segment = "MISS" / 0
  };
}

const T20_CENTER = { x: 0, y: -104 }; // ca. Mitte der T-20-Zone (mm, y negativ = oben)

export function computeStats(throws: IHeatmapThrow[]): IHeatmapStats {
  const stats: IHeatmapStats = {
    total: throws.length,
    t20Hits: 0,
    t19Hits: 0,
    t18Hits: 0,
    bullHits: 0,
    bullseyeHits: 0,
    totalDoubles: 0,
    doubleAttempts: 0,
    doubleAcc: {},
    avgOffsetMm: 0,
    scoreZones: { center: 0, top: 0, bottomLeft: 0, bottomRight: 0, misses: 0 },
  };
  let offsetSum = 0;
  let offsetCount = 0;
  for (const t of throws) {
    const seg = t.segment.toUpperCase();
    if (seg === "T20") stats.t20Hits++;
    if (seg === "T19") stats.t19Hits++;
    if (seg === "T18") stats.t18Hits++;
    if (seg === "25" || seg === "S25") stats.bullHits++;
    if (seg === "50" || seg === "BULL" || seg === "DB") stats.bullseyeHits++;

    if (t.multiplier === 2) stats.totalDoubles++;
    if (t.targetSegment && t.targetSegment.startsWith("D")) {
      stats.doubleAttempts++;
      const key = t.targetSegment;
      if (!stats.doubleAcc[key]) stats.doubleAcc[key] = { hits: 0, attempts: 0 };
      stats.doubleAcc[key].attempts++;
      if (t.segment === t.targetSegment) stats.doubleAcc[key].hits++;
    }

    // Streuung um T-20-Center
    if (seg === "T20" || seg === "S20" || seg === "D20") {
      const dx = t.x - T20_CENTER.x;
      const dy = t.y - T20_CENTER.y;
      offsetSum += Math.sqrt(dx * dx + dy * dy);
      offsetCount++;
    }

    // Zone-Zählung (grob)
    if (seg === "MISS" || t.points === 0) {
      stats.scoreZones.misses++;
    } else if (seg === "50" || seg === "25" || seg === "BULL" || seg === "DB") {
      stats.scoreZones.center++;
    } else if (t.y < -30) {
      stats.scoreZones.top++;
    } else if (t.x < 0) {
      stats.scoreZones.bottomLeft++;
    } else {
      stats.scoreZones.bottomRight++;
    }
  }
  stats.avgOffsetMm = offsetCount ? +(offsetSum / offsetCount).toFixed(1) : 0;
  return stats;
}

/** Alle gespeicherten Würfe löschen. */
export async function clearHeatmap(): Promise<void> {
  try {
    const db = await getDb();
    await db.clear(STORE);
  } catch (e) {
    console.warn("Heatmap: clear Fehler", e);
  }
}

/** Anzahl gespeicherter Würfe. */
export async function countThrows(): Promise<number> {
  try {
    const db = await getDb();
    return await db.count(STORE);
  } catch {
    return 0;
  }
}
