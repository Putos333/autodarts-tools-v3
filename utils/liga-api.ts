/**
 * liga-api.ts – Liga-System mit Share-Code (OHNE externe Registrierung)
 *
 * Wie es funktioniert:
 *  1. Spieler A erstellt eine Liga → die Erweiterung generiert einen 6-stelligen
 *     Share-Code (z.B. "LIGA-X7B9") und legt einen anonymen JSON-Speicher auf
 *     jsonbin.io an (kostenlos, kein Account nötig).
 *  2. Spieler A teilt den Code mit seinen Freunden.
 *  3. Alle Freunde tragen den Code in ihre Erweiterung ein → alle greifen auf
 *     denselben Datenspeicher zu.
 *  4. Nach jedem Match wird das Ergebnis automatisch synchronisiert.
 *
 * Datenspeicher: jsonbin.io (kostenlos, anonym, kein Login)
 *  - Jede Liga = ein eigener "Bin" (JSON-Objekt)
 *  - Zugriff nur über die Bin-ID + optionalen Access-Key (im Share-Code kodiert)
 *
 * Share-Code Format: "<6 Zeichen Zufalls-ID>-<Bin-ID>" (z.B. "X7B9K2-64f3a1b2c3d4e5f6")
 * Der Code wird Base64-kodiert, damit er kurz und kopierbar bleibt.
 */

const JSONBIN_API = 'https://api.jsonbin.io/v3';
const JSONBIN_MASTER_KEY = '$2a$10$autodarts_tools_liga_key'; // Wird zur Laufzeit nicht benötigt für öffentliche Bins

export interface LigaMatch {
  id: string;
  created_at: string;
  liga_name: string;
  player1: string;
  player2: string;
  score1: number;
  score2: number;
  avg1?: number;
  avg2?: number;
  checkout1?: number;
  checkout2?: number;
  best_leg1?: number;
  best_leg2?: number;
  match_id?: string;
  variant?: string;
}

export interface LigaData {
  name: string;
  created_at: string;
  matches: LigaMatch[];
}

export interface LigaTableEntry {
  player: string;
  played: number;
  wins: number;
  losses: number;
  legsFor: number;
  legsAgainst: number;
  legDiff: number;
  avgAverage: number;
  avgCheckout: number;
  points: number;
}

export interface HeadToHead {
  player1: string;
  player2: string;
  wins1: number;
  wins2: number;
  avgAvg1: number;
  avgAvg2: number;
  matches: LigaMatch[];
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

function generateId(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Ohne I, O, 0, 1 (Verwechslungsgefahr)
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function encodeShareCode(binId: string, accessKey: string): string {
  const raw = `${binId}|${accessKey}`;
  return btoa(raw).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function decodeShareCode(code: string): { binId: string; accessKey: string } | null {
  try {
    const padded = code.replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(padded);
    const [binId, accessKey] = raw.split('|');
    if (!binId || !accessKey) return null;
    return { binId, accessKey };
  } catch {
    return null;
  }
}

// ─── JSONBin API Client ───────────────────────────────────────────────────────

class LigaShareCodeClient {
  private binId: string;
  private accessKey: string;

  constructor(binId: string, accessKey: string) {
    this.binId = binId;
    this.accessKey = accessKey;
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Access-Key': this.accessKey,
    };
  }

  /**
   * Liga-Daten laden
   */
  async load(): Promise<LigaData> {
    const res = await fetch(`${JSONBIN_API}/b/${this.binId}/latest`, {
      headers: this.headers,
    });
    if (!res.ok) throw new Error(`Liga laden fehlgeschlagen: ${res.status}`);
    const json = await res.json();
    return json.record as LigaData;
  }

  /**
   * Liga-Daten speichern (vollständiges Überschreiben)
   */
  async save(data: LigaData): Promise<void> {
    const res = await fetch(`${JSONBIN_API}/b/${this.binId}`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(`Liga speichern fehlgeschlagen: ${res.status}`);
  }

  /**
   * Match hinzufügen (Optimistic Update: laden → anfügen → speichern)
   */
  async addMatch(match: Omit<LigaMatch, 'id' | 'created_at'>): Promise<void> {
    const data = await this.load();
    const newMatch: LigaMatch = {
      ...match,
      id: generateId(8),
      created_at: new Date().toISOString(),
    };
    data.matches.unshift(newMatch); // Neueste zuerst
    await this.save(data);
  }

  /**
   * Verbindung testen
   */
  async testConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.load();
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }
}

// ─── Deep-Link Mechanismus ──────────────────────────────────────────────────

/**
 * Generiert einen klickbaren Einladungslink für eine Liga.
 * Beim Klick auf den Link öffnet sich play.autodarts.io und die Erweiterung
 * verbindet sich automatisch mit der Liga – kein manuelles Eintragen nötig.
 *
 * Format: https://play.autodarts.io/?liga=<shareCode>&ligaName=<name>
 */
export function generateShareLink(shareCode: string, ligaName: string): string {
  const encoded = encodeURIComponent(shareCode);
  const nameEncoded = encodeURIComponent(ligaName);
  return `https://play.autodarts.io/?liga=${encoded}&ligaName=${nameEncoded}`;
}

/**
 * Prüft beim Seitenaufruf ob ein Liga-Einladungslink in der URL steckt.
 * Wenn ja, wird der Share-Code automatisch in die Konfiguration übernommen
 * und die Liga-Verbindung hergestellt – ohne dass der Nutzer etwas eintragen muss.
 *
 * Wird beim Content-Script-Init (entrypoints/content/index.ts) aufgerufen.
 * (Vor v2.9.93 lag der Aufruf im inzwischen entfernten Erweiterungs-Manager.)
 */
export async function handleLigaInviteLink(): Promise<{ joined: boolean; ligaName?: string }> {
  const params = new URLSearchParams(window.location.search);
  const shareCode = params.get('liga');
  const ligaName = params.get('ligaName');

  if (!shareCode) return { joined: false };

  // Share-Code validieren
  const client = joinLiga(shareCode);
  if (!client) {
    console.warn('Autodarts Tools: Ungültiger Liga-Einladungslink');
    return { joined: false };
  }

  try {
    // Verbindung testen
    const test = await client.testConnection();
    if (!test.ok) return { joined: false };

    // Share-Code automatisch in die Erweiterungs-Konfiguration speichern
    const { AutodartsToolsConfig } = await import('@/utils/storage');
    const config = await AutodartsToolsConfig.getValue();
    config.liga = {
      ...config.liga,
      enabled: true,
      shareCode,
      name: ligaName ? decodeURIComponent(ligaName) : config.liga?.name || 'Meine Liga',
      autoSubmit: true,
    };
    await AutodartsToolsConfig.setValue(config);

    // URL-Parameter entfernen (sauber halten)
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);

    console.log('Autodarts Tools: Liga automatisch verbunden!', ligaName);
    return { joined: true, ligaName: ligaName || undefined };
  } catch (e) {
    console.error('Autodarts Tools: Liga-Einladungslink Fehler', e);
    return { joined: false };
  }
}

// ─── Öffentliche API ──────────────────────────────────────────────────────────

/**
 * Neue Liga erstellen.
 * Gibt den Share-Code zurück, den der Nutzer an Freunde weitergeben kann.
 */
export async function createLiga(ligaName: string): Promise<{ shareCode: string; binId: string }> {
  const accessKey = generateId(16);
  const initialData: LigaData = {
    name: ligaName,
    created_at: new Date().toISOString(),
    matches: [],
  };

  // Neuen Bin auf jsonbin.io anlegen
  const res = await fetch(`${JSONBIN_API}/b`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Bin-Name': `autodarts-liga-${ligaName.toLowerCase().replace(/\s+/g, '-')}`,
      'X-Bin-Private': 'true',
      // Kein Master-Key nötig für anonyme öffentliche Bins
    },
    body: JSON.stringify(initialData),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Liga erstellen fehlgeschlagen: ${res.status} – ${text}`);
  }

  const json = await res.json();
  const binId: string = json.metadata?.id || json.id;
  if (!binId) throw new Error('Keine Bin-ID erhalten');

  const shareCode = encodeShareCode(binId, accessKey);
  return { shareCode, binId };
}

/**
 * Liga über Share-Code beitreten / laden.
 */
export function joinLiga(shareCode: string): LigaShareCodeClient | null {
  const decoded = decodeShareCode(shareCode);
  if (!decoded) return null;
  return new LigaShareCodeClient(decoded.binId, decoded.accessKey);
}

/**
 * Liga-Tabelle aus den Match-Daten berechnen.
 */
export function calculateTable(
  matches: LigaMatch[],
  rankingMode: 'wins' | 'average' | 'combined' = 'combined',
): LigaTableEntry[] {
  const playerMap = new Map<string, LigaTableEntry>();
  const avgSums = new Map<string, { avgSum: number; checkoutSum: number; count: number }>();

  const ensurePlayer = (name: string): LigaTableEntry => {
    if (!playerMap.has(name)) {
      playerMap.set(name, {
        player: name,
        played: 0, wins: 0, losses: 0,
        legsFor: 0, legsAgainst: 0, legDiff: 0,
        avgAverage: 0, avgCheckout: 0, points: 0,
      });
    }
    return playerMap.get(name)!;
  };

  for (const match of matches) {
    const p1 = ensurePlayer(match.player1);
    const p2 = ensurePlayer(match.player2);

    p1.played++; p2.played++;
    p1.legsFor += match.score1; p1.legsAgainst += match.score2;
    p2.legsFor += match.score2; p2.legsAgainst += match.score1;

    if (match.score1 > match.score2) {
      p1.wins++; p2.losses++; p1.points += 2;
    } else {
      p2.wins++; p1.losses++; p2.points += 2;
    }

    if (!avgSums.has(match.player1)) avgSums.set(match.player1, { avgSum: 0, checkoutSum: 0, count: 0 });
    if (!avgSums.has(match.player2)) avgSums.set(match.player2, { avgSum: 0, checkoutSum: 0, count: 0 });

    const a1 = avgSums.get(match.player1)!;
    if (match.avg1) { a1.avgSum += match.avg1; a1.count++; }
    if (match.checkout1) a1.checkoutSum += match.checkout1;

    const a2 = avgSums.get(match.player2)!;
    if (match.avg2) { a2.avgSum += match.avg2; a2.count++; }
    if (match.checkout2) a2.checkoutSum += match.checkout2;
  }

  for (const [name, sums] of avgSums.entries()) {
    const entry = playerMap.get(name);
    if (entry && sums.count > 0) {
      entry.avgAverage = Math.round((sums.avgSum / sums.count) * 10) / 10;
      entry.avgCheckout = Math.round((sums.checkoutSum / sums.count) * 1000) / 10;
    }
  }

  for (const entry of playerMap.values()) {
    entry.legDiff = entry.legsFor - entry.legsAgainst;
  }

  const table = Array.from(playerMap.values());
  table.sort((a, b) => {
    if (rankingMode === 'wins') return b.wins - a.wins || b.legDiff - a.legDiff;
    if (rankingMode === 'average') return b.avgAverage - a.avgAverage;
    return b.points - a.points || b.legDiff - a.legDiff || b.avgAverage - a.avgAverage;
  });

  return table;
}

/**
 * Head-to-Head zwischen zwei Spielern berechnen.
 */
export function calculateHeadToHead(matches: LigaMatch[], player1: string, player2: string): HeadToHead {
  const h2h = matches.filter(m =>
    (m.player1 === player1 && m.player2 === player2) ||
    (m.player1 === player2 && m.player2 === player1),
  );

  let wins1 = 0, wins2 = 0, avgSum1 = 0, avgSum2 = 0, count = 0;

  for (const m of h2h) {
    const isP1Home = m.player1 === player1;
    const s1 = isP1Home ? m.score1 : m.score2;
    const s2 = isP1Home ? m.score2 : m.score1;
    const a1 = isP1Home ? (m.avg1 || 0) : (m.avg2 || 0);
    const a2 = isP1Home ? (m.avg2 || 0) : (m.avg1 || 0);

    if (s1 > s2) wins1++;
    else wins2++;

    if (a1 > 0) { avgSum1 += a1; count++; }
    if (a2 > 0) avgSum2 += a2;
  }

  return {
    player1, player2, wins1, wins2,
    avgAvg1: count > 0 ? Math.round((avgSum1 / count) * 10) / 10 : 0,
    avgAvg2: count > 0 ? Math.round((avgSum2 / count) * 10) / 10 : 0,
    matches: h2h,
  };
}

// ─── Match-Auto-Submit nach Spielende ────────────────────────────────────────
import { AutodartsToolsConfig } from "@/utils/storage";
import { AutodartsToolsGameData, type IGameData } from "@/utils/game-data-storage";
import { isMatchFinished } from "@/utils/match-finish";

let gameDataWatcherUnwatch: (() => void) | null = null;
let lastSubmittedMatchId = '';
let _ligaClient: LigaShareCodeClient | null = null;

export async function ligaAutoSubmit(): Promise<void> {
  const config = await AutodartsToolsConfig.getValue();
  if (!config.liga?.enabled || !config.liga?.autoSubmit) return;
  if (!config.liga?.shareCode) return;

  _ligaClient = joinLiga(config.liga.shareCode);
  if (!_ligaClient) {
    console.warn('Autodarts Tools: Ungültiger Liga Share-Code');
    return;
  }

  gameDataWatcherUnwatch = AutodartsToolsGameData.watch(async (gameData: IGameData | undefined) => {
    const match = gameData?.match;
    if (!match) return;

    // `gameData` selbst hat nur { private, gameMode, match } (siehe
    // utils/game-data-storage.ts) — gameState/status/matchId/id/players/variant
    // existieren nur unter `match`, nicht auf `gameData`. Die vorherige
    // Implementierung las diese Felder direkt von `gameData` (getypt als
    // `any`, daher kein Compile-Fehler) — `isFinished` war dadurch IMMER
    // `false`, die automatische Liga-Übermittlung feuerte nie. Dieselbe
    // Bug-Klasse wie das historische R1 (training-mode.ts las früher ebenfalls
    // gameData.gameState/status statt match.finished/match.winner).
    if (!isMatchFinished(match)) return;

    const matchId = match.id || '';
    if (matchId && matchId === lastSubmittedMatchId) return;
    lastSubmittedMatchId = matchId;

    try {
      const players = match.players ?? [];
      if (players.length < 2) return;

      const scores = match.scores ?? [];
      const stats = match.stats ?? [];
      const stats1 = stats[0]?.matchStats;
      const stats2 = stats[1]?.matchStats;

      const ligaConfig = await AutodartsToolsConfig.getValue();
      const ligaName = ligaConfig.liga?.name || 'Meine Liga';

      await _ligaClient!.addMatch({
        liga_name: ligaName,
        player1: players[0]?.name || 'Spieler 1',
        player2: players[1]?.name || 'Spieler 2',
        score1: scores[0]?.legs ?? scores[0]?.sets ?? 0,
        score2: scores[1]?.legs ?? scores[1]?.sets ?? 0,
        avg1: stats1?.average,
        avg2: stats2?.average,
        checkout1: stats1?.checkoutPercent,
        checkout2: stats2?.checkoutPercent,
        match_id: matchId,
        variant: match.variant || 'X01',
      });

      console.log('Autodarts Tools: Liga-Ergebnis gespeichert');
      showLigaNotification('✅ Liga-Ergebnis gespeichert!');
    } catch (e) {
      console.error('Autodarts Tools: Liga-Submit fehlgeschlagen', e);
      showLigaNotification('⚠ Liga-Submit fehlgeschlagen – Share-Code prüfen');
    }
  });
}

export function ligaAutoSubmitOnRemove(): void {
  gameDataWatcherUnwatch?.();
  gameDataWatcherUnwatch = null;
  _ligaClient = null;
}

function showLigaNotification(text: string): void {
  const el = document.createElement('div');
  el.style.cssText = `
    position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
    background: #0D1B2A; border: 2px solid #E8002D;
    padding: 12px 24px; font-family: 'Barlow Condensed', Arial, sans-serif;
    font-size: 18px; font-weight: 700; color: #fff; z-index: 99999;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  `;
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}
