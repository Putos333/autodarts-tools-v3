/**
 * friends-api.ts – Freundeslisten & Quick-Play API für tools-for-autodarts
 *
 * Stellt alle Funktionen bereit, um:
 *  1. Die Freundesliste des eingeloggten Nutzers abzurufen
 *  2. Den Online-Status von Freunden zu prüfen
 *  3. Eine neue Lobby mit Standardeinstellungen zu erstellen
 *  4. Einen Freund automatisch in die Lobby einzuladen
 *  5. Die Head-to-Head Statistiken zweier Spieler abzurufen
 *
 * Alle Requests laufen über fetchWithAuth() und nutzen das bereits
 * vorhandene Bearer-Token aus dem Auth-Cookie-System der Erweiterung.
 */

import { fetchWithAuth, getAuthToken } from "@/utils/helpers";
import { ensureFreshAuthToken } from "@/utils/auth-refresh";

// ─── Typen ────────────────────────────────────────────────────────────────────

export interface IFriend {
  id: string;
  name: string;
  avatarUrl?: string;
  online: boolean;
  inMatch: boolean;
  stats?: IFriendStats;
}

export interface IFriendStats {
  average: number;
  checkoutQuote: number;
  wins: number;
  losses: number;
}

export interface IH2HStats {
  friendId: string;
  friendName: string;
  myWins: number;
  friendWins: number;
  myAverage: number;
  friendAverage: number;
  totalMatches: number;
  lastMatchDate: string;
  matches: IH2HMatch[];
}

export interface IH2HMatch {
  matchId: string;
  date: string;
  myScore: number;
  friendScore: number;
  myAverage: number;
  friendAverage: number;
  winner: string;
}

export interface ILobbySettings {
  variant: 'X01' | 'Cricket';
  x01Settings?: {
    startScore: 501 | 301 | 701;
    inMode: 'straight' | 'double' | 'master';
    outMode: 'double' | 'master' | 'straight';
    sets: number;
    legs: number;
  };
}

export interface IQuickPlayResult {
  success: boolean;
  lobbyId?: string;
  lobbyUrl?: string;
  error?: string;
}

// ─── Standard-Lobby-Einstellungen ─────────────────────────────────────────────
//
// Exportiert (Friends & Party V4), damit der Challenge-Screen die tatsächlich
// von quickPlay() verwendeten Werte anzeigen kann, statt sie als zweite,
// potenziell abweichende Konstante zu duplizieren. quickPlay()/quickPlayGroup()
// akzeptieren zwar bereits einen `settings`-Parameter, die Control-Center-UI
// ruft sie aber (Stand jetzt) ohne eigene Auswahl auf — die Anzeige ist daher
// bewusst nur ein Read-out dieser Konstante, kein Eingabe-Control.

export const DEFAULT_LOBBY_SETTINGS: ILobbySettings = {
  variant: 'X01',
  x01Settings: {
    startScore: 501,
    inMode: 'straight',
    outMode: 'double',
    sets: 1,
    legs: 3,
  },
};

// ─── API Basis-URL ────────────────────────────────────────────────────────────

const API_BASE = 'https://api.autodarts.io';

// ─── Hilfsfunktion: Eigene User-ID ermitteln ──────────────────────────────────

export async function getMyUserId(): Promise<string | null> {
  try {
    const response = await fetchWithAuth(`${API_BASE}/us/v0/users/me`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.id ?? null;
  } catch (e) {
    console.error('Autodarts Tools: Fehler beim Abrufen der User-ID', e);
    return null;
  }
}

// ─── Freundesliste abrufen ────────────────────────────────────────────────────

/**
 * Ruft die vollständige Freundesliste des eingeloggten Nutzers ab.
 *
 * v2.9.94 Endpoint-Fix: Der Endpoint `/us/v0/users/me/followers` existiert bei
 * Autodarts NICHT — er liefert schlicht HTTP 404 (per curl verifiziert).
 * Der echte Endpoint lautet `/as/v0/friends` (`as` = Account Service).
 * Field-Mapping laut Autodarts-Bundle `assets/index-*.js`:
 *   - ID:          `userId` bevorzugt, fallback `id`
 *   - Name:        `username` bevorzugt, fallback `displayName` oder `name`
 *   - Avatar:      `avatar`  bevorzugt, fallback `avatarUrl`
 *   - Online-Flag: nicht per REST ermittelbar (siehe getOnlineFriendIds()
 *                  unten) — bleibt `false`, sofern `u.online` nicht direkt
 *                  im Eintrag mitgeliefert wird.
 */
export async function getFriends(): Promise<IFriend[]> {
  try {
    // v2.9.90 Login-Race-Fix: frisches Token besorgen bevor wir die
    // Freundesliste fetchen (der 401-Retry-Wrapper allein hilft nicht,
    // wenn das gecachte Token > 15 Min alt ist).
    await ensureFreshAuthToken(2500).catch(() => null);

    // RUNTIME-FIX (Realtest): `/as/v0/friends` OHNE Trailing-Slash antwortet mit
    // HTTP 301 auf `/as/v0/friends/`. `fetch()` folgt dem Redirect automatisch,
    // entfernt dabei aber den `Authorization`-Header (Standard-Verhalten der
    // Fetch-Spec bei Redirects) — die umgeleitete Anfrage kommt dadurch ohne
    // Token an und liefert 401, selbst mit einem frischen, gültigen Token. Per
    // curl gegen die echte API verifiziert: nur die Trailing-Slash-Form
    // antwortet direkt (ohne Redirect).
    // TEMP-DIAG (Realtest 2): sichtbar machen, welche URL wirklich raus geht
    // und was zurückkommt — ohne je den Token-Inhalt zu loggen.
    console.log(`[ADT-DIAG] FRIENDS_REQUEST_URL: ${API_BASE}/as/v0/friends/`);
    const response = await fetchWithAuth(`${API_BASE}/as/v0/friends/`);
    console.log(`[ADT-DIAG] FRIENDS_REQUEST_STATUS: ${response.status}  RESPONSE_STATUS: ${response.ok ? "OK" : "ERROR"}`);
    if (!response.ok) {
      console.error('[Friends] Freundesliste konnte nicht abgerufen werden — HTTP', response.status);
      return [];
    }
    const data = await response.json();
    // Autodarts liefert entweder ein rohes Array oder { items: [...] }.
    const users: any[] = Array.isArray(data) ? data : (data.items ?? data.friends ?? []);

    // Parallel Online-Status abrufen (optional — falls fehlschlägt, alle offline).
    const onlineIds = await getOnlineFriendIds();

    return users.map((u: any): IFriend => {
      const id = u.userId ?? u.id ?? '';
      return {
        id,
        name: u.username ?? u.displayName ?? u.name ?? 'Unbekannt',
        avatarUrl: u.avatar ?? u.avatarUrl ?? undefined,
        online: onlineIds.has(id) || u.online === true,
        inMatch: u.inMatch ?? u.playing ?? false,
        stats: u.stats ? {
          average: u.stats.average ?? 0,
          checkoutQuote: u.stats.checkoutQuote ?? 0,
          wins: u.stats.wins ?? 0,
          losses: u.stats.losses ?? 0,
        } : undefined,
      };
    });
  } catch (e) {
    console.error('[Friends] Fehler beim Abrufen der Freundesliste', e);
    return [];
  }
}

/**
 * RUNTIME-FIX (Realtest 3): `/as/v0/friends/online-status` ist KEIN Bulk-
 * Presence-Endpoint für die Freundesliste. Per Reverse-Engineering des
 * echten Autodarts-Bundles (`assets/index-*.js` von play.autodarts.com)
 * verifiziert:
 *
 *   async setVisibility(t){ await this.axios.put("/friends/online-status",{status:t}) }
 *   async getVisibility(){ const{data:t}=await this.axios.get("/friends/online-status"); return t }
 *
 * Das ist die eigene Sichtbarkeits-Einstellung des eingeloggten Nutzers
 * (Online/Offline/Incognito) — GET liefert nicht "welche meiner Freunde sind
 * online", sondern nur den eigenen Status. Selbst Autodarts' eigene Web-App
 * hat KEINEN REST-Abruf für den Live-Status der Freundesliste: im Bundle
 * abonniert jede Freund-Zeile den Status einzeln über einen WebSocket-Kanal
 * (`un.getInstance().subscribe("autodarts.friends", `${userId}.status`, cb)`),
 * gespeist von Events des Typs `online-status`/`activity`. Es gibt keinen
 * Snapshot-Endpoint, auch nicht bei Autodarts selbst.
 *
 * Diese Erweiterung sieht den `autodarts.friends`-Kanal nie: er wird nur
 * gesendet, wenn Autodarts' EIGENES Friends-Panel aktiv im selben Tab läuft
 * und sich pro Freund einzeln einträgt — nicht beim bloßen Öffnen von
 * play.autodarts.com. Ihn selbst zu abonnieren würde bedeuten, Autodarts'
 * internes Pub/Sub-Protokoll nachzubauen: eine zweite, parallele Friends-/
 * Socket-Engine, die hier ausdrücklich nicht gebaut werden soll.
 *
 * Deshalb bewusst kein Netzwerk-Call mehr hierher: ein leeres Set ist der
 * einzige ehrliche Wert, den es für diese Datenquelle geben kann.
 */
async function getOnlineFriendIds(): Promise<Set<string>> {
  return new Set();
}

// ─── Head-to-Head Statistiken ─────────────────────────────────────────────────

/**
 * Ruft die Head-to-Head Statistiken gegen einen bestimmten Freund ab.
 * Durchsucht die letzten 50 Matches nach gemeinsamen Spielen.
 */
export async function getH2HStats(friendId: string, friendName: string): Promise<IH2HStats> {
  const empty: IH2HStats = {
    friendId,
    friendName,
    myWins: 0,
    friendWins: 0,
    myAverage: 0,
    friendAverage: 0,
    totalMatches: 0,
    lastMatchDate: '',
    matches: [],
  };

  try {
    const myId = await getMyUserId();
    if (!myId) return empty;

    // Letzte 50 Matches des eingeloggten Nutzers abrufen
    const response = await fetchWithAuth(
      `${API_BASE}/gs/v0/matches?playerId=${myId}&limit=50&offset=0`,
    );
    if (!response.ok) return empty;

    const data = await response.json();
    const allMatches: any[] = data.items ?? data ?? [];

    // Nur Matches filtern, bei denen der Freund mitgespielt hat
    const h2hMatches = allMatches.filter((m: any) => {
      const playerIds: string[] = (m.players ?? []).map((p: any) => p.userId ?? p.id ?? '');
      return playerIds.includes(friendId) && playerIds.includes(myId);
    });

    if (h2hMatches.length === 0) return empty;

    let myWins = 0;
    let friendWins = 0;
    let myAvgSum = 0;
    let friendAvgSum = 0;

    const matches: IH2HMatch[] = h2hMatches.map((m: any): IH2HMatch => {
      const myPlayer = (m.players ?? []).find((p: any) => (p.userId ?? p.id) === myId);
      const friendPlayer = (m.players ?? []).find((p: any) => (p.userId ?? p.id) === friendId);

      const myAvg = myPlayer?.stats?.average ?? 0;
      const friendAvg = friendPlayer?.stats?.average ?? 0;
      const myScore = myPlayer?.score ?? 0;
      const friendScore = friendPlayer?.score ?? 0;
      const winner = m.winner === myId ? 'me' : 'friend';

      if (winner === 'me') myWins++;
      else friendWins++;

      myAvgSum += myAvg;
      friendAvgSum += friendAvg;

      return {
        matchId: m.id ?? '',
        date: m.createdAt ?? m.date ?? '',
        myScore,
        friendScore,
        myAverage: myAvg,
        friendAverage: friendAvg,
        winner,
      };
    });

    return {
      friendId,
      friendName,
      myWins,
      friendWins,
      myAverage: h2hMatches.length > 0 ? Math.round((myAvgSum / h2hMatches.length) * 10) / 10 : 0,
      friendAverage: h2hMatches.length > 0 ? Math.round((friendAvgSum / h2hMatches.length) * 10) / 10 : 0,
      totalMatches: h2hMatches.length,
      lastMatchDate: matches[0]?.date ?? '',
      matches,
    };
  } catch (e) {
    console.error('Autodarts Tools: Fehler beim Abrufen der H2H-Statistiken', e);
    return empty;
  }
}

// ─── Quick-Play: Lobby erstellen & Freund einladen ────────────────────────────

/**
 * Erstellt eine neue Lobby mit den angegebenen Einstellungen und
 * schickt automatisch eine Einladung an den Freund.
 *
 * Ablauf:
 *  1. Neue Lobby via POST /gs/v0/lobbies erstellen
 *  2. Freund via POST /gs/v0/lobbies/{id}/invitations einladen
 *  3. URL zur Lobby zurückgeben → Browser navigiert automatisch dorthin
 */
export async function quickPlay(
  friendId: string,
  settings: ILobbySettings = DEFAULT_LOBBY_SETTINGS,
): Promise<IQuickPlayResult> {
  try {
    // ── Schritt 1: Lobby erstellen ──────────────────────────────────────────
    const lobbyPayload = buildLobbyPayload(settings);

    const createResponse = await fetchWithAuth(`${API_BASE}/gs/v0/lobbies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lobbyPayload),
    });

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      console.error('Autodarts Tools: Lobby konnte nicht erstellt werden', createResponse.status, errText);
      return {
        success: false,
        error: `Lobby-Erstellung fehlgeschlagen (${createResponse.status})`,
      };
    }

    const lobby = await createResponse.json();
    const lobbyId: string = lobby.id ?? lobby.lobbyId;

    if (!lobbyId) {
      return { success: false, error: 'Keine Lobby-ID in der Antwort' };
    }

    console.log('Autodarts Tools: Lobby erstellt:', lobbyId);

    // ── Schritt 2: Freund einladen ──────────────────────────────────────────
    const inviteResponse = await fetchWithAuth(
      `${API_BASE}/gs/v0/lobbies/${lobbyId}/invitations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: friendId }),
      },
    );

    if (!inviteResponse.ok) {
      console.warn('Autodarts Tools: Einladung konnte nicht gesendet werden', inviteResponse.status);
      // Kein harter Fehler – Lobby ist trotzdem nutzbar
    } else {
      console.log('Autodarts Tools: Einladung erfolgreich gesendet an', friendId);
    }

    // ── Schritt 3: Lobby-URL zurückgeben ────────────────────────────────────
    const lobbyUrl = `https://play.autodarts.io/lobbies/${lobbyId}`;
    return { success: true, lobbyId, lobbyUrl };

  } catch (e) {
    console.error('Autodarts Tools: Fehler beim Quick-Play', e);
    return { success: false, error: String(e) };
  }
}

// ─── Hilfsfunktion: Lobby-Payload aufbauen ────────────────────────────────────

function buildLobbyPayload(settings: ILobbySettings): object {
  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  if (settings.variant === 'X01') {
    const x01 = settings.x01Settings ?? DEFAULT_LOBBY_SETTINGS.x01Settings!;
    return {
      variant: 'X01',
      bullOffMode: 'Off',
      isPrivate: true,
      legs: x01.legs,
      settings: {
        baseScore: x01.startScore,
        bullMode: '25/50',
        inMode: capitalize(x01.inMode),
        outMode: capitalize(x01.outMode),
        maxRounds: 50,
      },
    };
  }
  // Cricket-Fallback
  return {
    variant: 'Cricket',
    bullOffMode: 'Off',
    isPrivate: true,
    legs: 3,
    settings: {},
  };
}

// ─── Karriere-Lobby erstellen (ohne Freund-Einladung) ────────────────────────

export interface ICareerLobbySettings {
  startScore: 501 | 301 | 701;
  inMode: 'straight' | 'double' | 'master';
  outMode: 'double' | 'master' | 'straight';
  sets: number;
  legs: number;
}

/**
 * Erstellt eine neue Lobby mit den Karriere-Match-Einstellungen.
 * Kein Freund wird eingeladen – der Spieler spielt lokal gegen die KI.
 * Gibt die Lobby-URL zurück, zu der direkt navigiert wird.
 */
export async function createCareerLobby(
  settings: ICareerLobbySettings,
): Promise<IQuickPlayResult> {
  try {
    // v2.9.90 Login-Race-Fix: VOR jeder Lobby-Erstellung Token-Freshness
    // sicherstellen. Verhindert 401 wenn der Tab lange offen war und das
    // zuletzt gecachte Token (~15 Min Lifetime) längst abgelaufen ist.
    await ensureFreshAuthToken(2500).catch(() => null);

    // Token-Prüfung mit Retry: auth-cookie.ts braucht einige Sekunden nach Seitennavigation
    // um das Token aus dem ersten API-Call der Seite einzufangen.
    // Wir warten bis zu 5 Sekunden auf ein gültiges Token.
    let token = await getAuthToken();
    if (!token) {
      console.log('[Career] Kein Token vorhanden, warte auf auth-cookie.ts...');
      for (let i = 0; i < 10; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        token = await getAuthToken();
        if (token) {
          console.log('[Career] Token nach', (i + 1) * 500, 'ms verfügbar');
          break;
        }
      }
    }
    if (!token) {
      return { success: false, error: 'Nicht eingeloggt. Bitte autodarts.io neu laden und erneut versuchen.' };
    }

    // Feldnamen exakt wie die Autodarts-API erwartet (aus Netzwerkanalyse ermittelt)
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    const payload = {
      variant: 'X01',
      bullOffMode: 'Off',
      isPrivate: true,
      legs: settings.legs,
      sets: settings.sets > 1 ? settings.sets : undefined,
      settings: {
        baseScore: settings.startScore,
        bullMode: '25/50',
        inMode: capitalize(settings.inMode),
        outMode: capitalize(settings.outMode),
        maxRounds: 50,
      },
    };

    // v2.9.51: Hart-Timeout gegen "Lobby lädt hört nicht auf"-Hänger
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s max

    const createResponse = await fetchWithAuth(`${API_BASE}/gs/v0/lobbies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).catch((err) => {
      if (err?.name === 'AbortError') {
        throw new Error('Lobby-Erstellung Timeout (15s) — bitte erneut versuchen');
      }
      throw err;
    });
    clearTimeout(timeoutId);

    if (!createResponse.ok) {
      const errText = await createResponse.text();
      console.error('[Career] Lobby konnte nicht erstellt werden', createResponse.status, errText);
      return { success: false, error: `Lobby-Erstellung fehlgeschlagen (${createResponse.status})` };
    }

    const lobby = await createResponse.json();
    const lobbyId: string = lobby.id ?? lobby.lobbyId;

    if (!lobbyId) {
      return { success: false, error: 'Keine Lobby-ID in der Antwort' };
    }

    const lobbyUrl = `https://play.autodarts.io/lobbies/${lobbyId}`;
    console.log('[Career] Lobby erstellt:', lobbyId, lobbyUrl);
    return { success: true, lobbyId, lobbyUrl };

  } catch (e) {
    console.error('[Career] Fehler beim Erstellen der Karriere-Lobby:', e);
    return { success: false, error: String(e) };
  }
}


// ─── Stammgruppe: mehrere Freunde in eine Lobby einladen (v2.9.91) ───────────

export interface IGroupInviteResult extends IQuickPlayResult {
  invited: string[];   // Freund-IDs, die erfolgreich eingeladen wurden
  failed: string[];    // Freund-IDs, bei denen die Einladung fehlschlug
}

/**
 * Erstellt eine Lobby und lädt alle übergebenen Freund-IDs ein.
 *
 * Auch wenn einzelne Einladungen fehlschlagen, wird der Lobby-Link zurück-
 * gegeben — der User kann dann selbst manuell nachjustieren. Kein hartes
 * Abbrechen, weil ein Freund evtl. offline sein könnte.
 */
export async function quickPlayGroup(
  friendIds: string[],
  settings: ILobbySettings = DEFAULT_LOBBY_SETTINGS,
): Promise<IGroupInviteResult> {
  if (!Array.isArray(friendIds) || friendIds.length === 0) {
    return { success: false, error: 'Keine Freund-IDs übergeben', invited: [], failed: [] };
  }

  try {
    // v2.9.90: frisches Token sicherstellen (Login-Race-Fix).
    await ensureFreshAuthToken(2500).catch(() => null);

    // ── 1) Lobby erstellen ────────────────────────────────────────────────
    const lobbyPayload = buildLobbyPayload(settings);
    const createResponse = await fetchWithAuth(`${API_BASE}/gs/v0/lobbies`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lobbyPayload),
    });
    if (!createResponse.ok) {
      const errText = await createResponse.text();
      return {
        success: false,
        error: `Lobby-Erstellung fehlgeschlagen (${createResponse.status}): ${errText.slice(0, 200)}`,
        invited: [], failed: friendIds,
      };
    }
    const lobby = await createResponse.json();
    const lobbyId: string = lobby.id ?? lobby.lobbyId;
    if (!lobbyId) {
      return { success: false, error: 'Keine Lobby-ID in der Antwort', invited: [], failed: friendIds };
    }

    // ── 2) Freunde nacheinander einladen ──────────────────────────────────
    const invited: string[] = [];
    const failed: string[] = [];
    for (const friendId of friendIds) {
      try {
        const inviteResponse = await fetchWithAuth(
          `${API_BASE}/gs/v0/lobbies/${lobbyId}/invitations`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: friendId }),
          },
        );
        if (inviteResponse.ok) invited.push(friendId);
        else failed.push(friendId);
      } catch (_) {
        failed.push(friendId);
      }
    }

    const lobbyUrl = `https://play.autodarts.io/lobbies/${lobbyId}`;
    console.log(`[Group] Lobby erstellt: ${invited.length}/${friendIds.length} eingeladen`);
    return { success: true, lobbyId, lobbyUrl, invited, failed };
  } catch (e) {
    console.error('[Group] Fehler beim Erstellen der Stammgruppen-Lobby', e);
    return { success: false, error: String(e), invited: [], failed: friendIds };
  }
}

// ─── Diagnostischer Abruf (v2.9.98 Control-Center-Runtime-Fix) ────────────────
//
// RUNTIME-BEFUND: `getFriends()` liefert Einträge, deren Namensfelder bei
// manchen Konten nicht unter `username`/`displayName`/`name` liegen. Das Mapping
// oben fällt dann auf den Literaltext 'Unbekannt' zurück und `online` auf
// `false` — beides ist von einem echten Wert nicht mehr zu unterscheiden.
// Ebenso verschluckt es, dass es für den Online-Status der Freundesliste
// überhaupt keinen abrufbaren Endpunkt gibt (siehe getOnlineFriendIds()
// oben) — dort erscheinen alle Freunde fälschlich als "offline".
//
// Diese Funktion ist rein ADDITIV. `getFriends()` und alle bestehenden Aufrufer
// (u.a. components/Settings/Friends.vue) bleiben unverändert. Sie nutzt exakt
// dieselben Endpoints und erfindet keinen neuen — sie gibt lediglich zurück, was
// wirklich ankam, inklusive "nicht auflösbar" als eigenen Zustand.

/** Ein Freund, bei dem Unbekanntes ausdrücklich `null` ist statt Ersatzwert. */
export interface IFriendResolved {
  id: string;
  /** `null` = in der Antwort war kein Name enthalten. */
  name: string | null;
  avatarUrl?: string;
  /** `null` = Online-Status konnte nicht ermittelt werden. */
  online: boolean | null;
  /** `null` = nicht gemeldet. */
  inMatch: boolean | null;
  stats?: IFriendStats;
}

export interface IFriendsDiagnostic {
  /** Hat der Freundeslisten-Endpoint mit 2xx geantwortet? */
  ok: boolean;
  httpStatus: number | null;
  friends: IFriendResolved[];
  /**
   * Immer `false` (RUNTIME-FIX Realtest 3): Autodarts bietet keinen
   * abrufbaren Endpunkt für den Live-Status der Freundesliste — siehe
   * getOnlineFriendIds() oben. Feld bleibt erhalten, damit die UI weiterhin
   * explizit zwischen "unbekannt" und "bestätigt online/offline" trennt.
   */
  onlineStatusAvailable: boolean;
  /** Feldnamen des ersten Eintrags — macht sichtbar, was Autodarts liefert. */
  sampleKeys: string[];
  error?: string;
}

const UUID_ONLY = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Ein String taugt als Anzeigename, wenn er nicht leer und keine UUID ist. */
function usableName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || UUID_ONLY.test(trimmed)) return null;
  return trimmed;
}

/**
 * Sucht den Anzeigenamen datengetrieben statt auf Verdacht:
 *   1. die bekannten Direktfelder,
 *   2. dieselben Felder eine Ebene tiefer (Autodarts verschachtelt Nutzer an
 *      anderen Stellen als `user: { name }`, siehe IPlayer in websocket-helpers),
 *   3. als letzte Stufe jedes Feld, dessen Name auf einen Anzeigenamen deutet.
 * Findet sich nichts, ist das Ergebnis `null` — kein Platzhaltertext.
 */
function resolveName(entry: any): string | null {
  if (!entry || typeof entry !== 'object') return null;

  const direct = usableName(entry.username) ?? usableName(entry.displayName) ?? usableName(entry.name);
  if (direct) return direct;

  for (const value of Object.values(entry)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const nested = value as any;
    const found = usableName(nested.username) ?? usableName(nested.displayName) ?? usableName(nested.name);
    if (found) return found;
  }

  for (const [ key, value ] of Object.entries(entry)) {
    if (!/name|nick/i.test(key)) continue;
    const found = usableName(value);
    if (found) return found;
  }

  return null;
}

/** Nimmt die ID aus denselben Feldern wie `getFriends()`, plus Verschachtelung. */
function resolveId(entry: any): string {
  if (!entry || typeof entry !== 'object') return '';
  const direct = entry.userId ?? entry.id ?? entry.friendId;
  if (typeof direct === 'string' && direct.length > 0) return direct;
  for (const value of Object.values(entry)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const nested = (value as any).userId ?? (value as any).id;
    if (typeof nested === 'string' && nested.length > 0) return nested;
  }
  return '';
}

/**
 * Wie `getFriends()`, aber ohne Ersatzwerte und mit Auskunft darüber, was
 * tatsächlich ankam. Gleiche Endpoints, gleiche Auth.
 */
export async function getFriendsDiagnostic(): Promise<IFriendsDiagnostic> {
  const empty: IFriendsDiagnostic = {
    ok: false,
    httpStatus: null,
    friends: [],
    onlineStatusAvailable: false,
    sampleKeys: [],
  };

  try {
    await ensureFreshAuthToken(2500).catch(() => null);

    // RUNTIME-FIX: siehe getFriends() oben — Trailing-Slash zwingend, sonst
    // 301-Redirect ohne Authorization-Header → falsches 401/"no-auth".
    // TEMP-DIAG (Realtest 2): dies ist der Pfad, den Friends & Party V4
    // tatsächlich nutzt (useControlCenterFriends.load() ruft diese Funktion).
    console.log(`[ADT-DIAG] FRIENDS_REQUEST_URL: ${API_BASE}/as/v0/friends/`);
    const response = await fetchWithAuth(`${API_BASE}/as/v0/friends/`);
    console.log(`[ADT-DIAG] FRIENDS_REQUEST_STATUS: ${response.status}  RESPONSE_STATUS: ${response.ok ? "OK" : "ERROR"}`);
    if (!response.ok) {
      return { ...empty, httpStatus: response.status, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    const users: any[] = Array.isArray(data) ? data : (data?.items ?? data?.friends ?? []);

    // RUNTIME-FIX (Realtest 3): `/as/v0/friends/online-status` ist die eigene
    // Sichtbarkeits-Einstellung des Nutzers (getVisibility()/setVisibility()
    // im echten Autodarts-Bundle), kein Bulk-Presence-Endpoint für Freunde —
    // siehe ausführliche Begründung bei getOnlineFriendIds() oben. Der echte
    // Live-Status läuft ausschließlich über den WebSocket-Kanal
    // "autodarts.friends" (Topic `${userId}.status`), den auch Autodarts'
    // eigene App nur pro Freund-Zeile abonniert, nie als Liste abruft — und
    // den diese Erweiterung ohne eine zweite, parallele Socket-Engine nicht
    // sehen kann. onlineStatusAvailable bleibt daher ehrlich `false`.
    const onlineIds = new Set<string>();
    const onlineStatusAvailable = false;

    const friends: IFriendResolved[] = users.map((entry: any): IFriendResolved => {
      const id = resolveId(entry);
      const ownOnline = typeof entry?.online === 'boolean' ? entry.online : null;
      const online = onlineStatusAvailable
        ? (onlineIds.has(id) || ownOnline === true)
        : ownOnline;

      const inMatch = typeof entry?.inMatch === 'boolean'
        ? entry.inMatch
        : (typeof entry?.playing === 'boolean' ? entry.playing : null);

      return {
        id,
        name: resolveName(entry),
        avatarUrl: entry?.avatar ?? entry?.avatarUrl ?? undefined,
        online,
        inMatch,
        stats: entry?.stats
          ? {
              average: entry.stats.average ?? 0,
              checkoutQuote: entry.stats.checkoutQuote ?? 0,
              wins: entry.stats.wins ?? 0,
              losses: entry.stats.losses ?? 0,
            }
          : undefined,
      };
    });

    return {
      ok: true,
      httpStatus: response.status,
      friends,
      onlineStatusAvailable,
      sampleKeys: users[0] && typeof users[0] === 'object' ? Object.keys(users[0]) : [],
    };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : String(e) };
  }
}
