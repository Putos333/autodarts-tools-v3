/**
 * rivalry.ts – Rivalitäten & Nemesis-System
 *
 * Verfolgt automatisch die Bilanz zwischen zwei Spielern.
 * Ab 5 gemeinsamen Matches und einer engen Bilanz (< 60% Siegquote)
 * wird der Gegner als "Rivale" markiert.
 *
 * Speicherung: browser.storage.local (lokal, kein Server nötig)
 */

export interface IRivalryRecord {
  opponentId: string;
  opponentName: string;
  wins: number;
  losses: number;
  lastPlayed: string; // ISO-Datum
  avgDiff: number;    // Durchschnittlicher Average-Unterschied
  streak: number;     // Positiv = Siegesserie, Negativ = Niederlagenserie
  isNemesis: boolean;
  trophyHolder: string | null; // Wer hat die Trophäe aktuell?
}

export interface IRivalryStore {
  records: Record<string, IRivalryRecord>; // Key: opponentId
  myPlayerId: string;
}

const STORAGE_KEY = "adt-rivalries-v1";

// ─── Laden & Speichern ────────────────────────────────────────────────────────

async function loadStore(): Promise<IRivalryStore> {
  try {
    const raw = await browser.storage.local.get(STORAGE_KEY);
    return (raw[STORAGE_KEY] as IRivalryStore) ?? { records: {} as Record<string, IRivalryRecord>, myPlayerId: "" };
  } catch {
    return { records: {}, myPlayerId: "" };
  }
}

async function saveStore(store: IRivalryStore): Promise<void> {
  await browser.storage.local.set({ [STORAGE_KEY]: store });
}

// ─── Rivalitäts-Berechnung ────────────────────────────────────────────────────

function calculateIsNemesis(record: IRivalryRecord): boolean {
  const total = record.wins + record.losses;
  if (total < 5) return false; // Mindestens 5 Matches
  const winRate = record.wins / total;
  return winRate < 0.6 && winRate > 0.4; // Enge Bilanz (40–60%)
}

// ─── Öffentliche API ──────────────────────────────────────────────────────────

/**
 * Wird nach jedem Match aufgerufen um die Bilanz zu aktualisieren.
 */
export async function recordMatchResult(params: {
  myPlayerId: string;
  opponentId: string;
  opponentName: string;
  iWon: boolean;
  myAverage: number;
  opponentAverage: number;
}): Promise<{ isNewNemesis: boolean; trophyChange: boolean; record: IRivalryRecord }> {
  const store = await loadStore();
  store.myPlayerId = params.myPlayerId;

  const existing = store.records[params.opponentId] ?? {
    opponentId: params.opponentId,
    opponentName: params.opponentName,
    wins: 0,
    losses: 0,
    lastPlayed: new Date().toISOString(),
    avgDiff: 0,
    streak: 0,
    isNemesis: false,
    trophyHolder: null,
  };

  const wasNemesis = existing.isNemesis;

  // Bilanz aktualisieren
  if (params.iWon) {
    existing.wins++;
    existing.streak = existing.streak >= 0 ? existing.streak + 1 : 1;
  } else {
    existing.losses++;
    existing.streak = existing.streak <= 0 ? existing.streak - 1 : -1;
  }

  // Average-Differenz (gleitender Durchschnitt)
  const total = existing.wins + existing.losses;
  existing.avgDiff = ((existing.avgDiff * (total - 1)) + (params.myAverage - params.opponentAverage)) / total;
  existing.lastPlayed = new Date().toISOString();
  existing.opponentName = params.opponentName;

  // Nemesis-Status berechnen
  existing.isNemesis = calculateIsNemesis(existing);
  const isNewNemesis = !wasNemesis && existing.isNemesis;

  // Trophäen-Logik (Wanderpokal)
  let trophyChange = false;
  if (existing.trophyHolder === null) {
    // Erste Begegnung: Gewinner bekommt die Trophäe
    if (params.iWon) {
      existing.trophyHolder = params.myPlayerId;
      trophyChange = true;
    }
  } else if (params.iWon && existing.trophyHolder === params.opponentId) {
    // Trophäe zurückerobert!
    existing.trophyHolder = params.myPlayerId;
    trophyChange = true;
  } else if (!params.iWon && existing.trophyHolder === params.myPlayerId) {
    // Trophäe verloren
    existing.trophyHolder = params.opponentId;
    trophyChange = true;
  }

  store.records[params.opponentId] = existing;
  await saveStore(store);

  return { isNewNemesis, trophyChange, record: existing };
}

/**
 * Gibt alle Rivalitäten zurück, sortiert nach Intensität.
 */
export async function getRivalries(): Promise<IRivalryRecord[]> {
  const store = await loadStore();
  return Object.values(store.records)
    .filter(r => r.wins + r.losses >= 2)
    .sort((a, b) => {
      // Nemesen zuerst, dann nach Gesamtanzahl Matches
      if (a.isNemesis && !b.isNemesis) return -1;
      if (!a.isNemesis && b.isNemesis) return 1;
      return (b.wins + b.losses) - (a.wins + a.losses);
    });
}

/**
 * Gibt die Rivalität mit einem bestimmten Gegner zurück.
 */
export async function getRivalry(opponentId: string): Promise<IRivalryRecord | null> {
  const store = await loadStore();
  return store.records[opponentId] ?? null;
}

/**
 * Gibt einen motivierenden Pre-Match Kommentar basierend auf der Rivalität zurück.
 */
export function getRivalryComment(record: IRivalryRecord, myName: string): string {
  const total = record.wins + record.losses;
  const winRate = record.wins / total;

  if (record.streak <= -3) {
    return `${myName} hat die letzten ${Math.abs(record.streak)} Matches gegen ${record.opponentName} verloren – heute muss eine Antwort her!`;
  }
  if (record.streak >= 3) {
    return `${myName} ist in Topform gegen ${record.opponentName} – ${record.streak} Siege in Folge! Kann er die Serie fortsetzen?`;
  }
  if (record.isNemesis) {
    return `Ein echtes Duell der Erzrivalen! ${myName} gegen ${record.opponentName} – die Bilanz steht ${record.wins}:${record.losses}. Enger geht's kaum!`;
  }
  if (winRate < 0.4) {
    return `${record.opponentName} führt die Bilanz mit ${record.losses}:${record.wins} an. Kann ${myName} das Blatt heute wenden?`;
  }
  if (winRate > 0.7) {
    return `${myName} dominiert die Bilanz gegen ${record.opponentName} mit ${record.wins}:${record.losses}. Aber Vorsicht – Selbstüberschätzung ist der größte Feind!`;
  }
  return `${myName} trifft auf ${record.opponentName}. Bilanz: ${record.wins}:${record.losses}. Möge der Bessere gewinnen!`;
}

/**
 * Löscht alle Rivalitäten (Reset).
 */
export async function clearAllRivalries(): Promise<void> {
  await browser.storage.local.remove(STORAGE_KEY);
}
