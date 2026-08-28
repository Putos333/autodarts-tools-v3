/**
 * useControlCenterStatus — gebündelter Live-Status für das Control Center.
 *
 * Bewusst KEINE zweite Datenarchitektur: dieses Composable liest ausschließlich
 * die bereits vorhandenen Quellen und aggregiert sie zu einer Anzeigesicht.
 *
 *   • `AutodartsToolsBoardData`  (local:board-data)   → Board / Autoscoring
 *   • `AutodartsToolsGameData`   (local:game-data)    → aktuelles Match, Spieler
 *   • `adt-ws-status`            (roher local-Key)    → WebSocket-Verbindung,
 *                                                       geschrieben von
 *                                                       entrypoints/websocket-monitor.content.ts
 *   • `AutodartsToolsGlobalStatus`                    → Auth-Token + tokenAt
 *   • `getBackendUrl()` + `/api/marathon/health`      → Backend-Ping, dieselbe
 *                                                       Logik wie im Popup
 *
 * ── Wichtig zur Semantik ────────────────────────────────────────────────────
 * Die Live-Daten entstehen nur, solange ein Tab auf play.autodarts.io/.com
 * offen ist. Diese Seite läuft aber unabhängig davon. Deshalb wird strikt
 * zwischen drei Zuständen getrennt:
 *
 *   "unknown" → es liegt überhaupt kein Signal vor (noch nie ein Tab gesehen)
 *   "stale"   → das letzte Signal ist älter als LIVE_WINDOW_MS
 *   "live"    → frisches Signal
 *
 * Als "frisch" zählt jedes echte Signal: das WS-Signal (`adt-ws-status`) ODER
 * eine kürzlich hier angekommene board/game/lobby-Daten-Aktualisierung. Das
 * `adt-ws-status.when` allein würde während eines laufenden Matches (Socket
 * offen, keine open/close/error-Ereignisse) fälschlich "stale" melden, obwohl
 * die Match-/Board-Daten ununterbrochen fließen (Human-Live-Test 2026-08-28).
 *
 * Ein fehlendes oder altes Signal wird NIE als "getrennt" dargestellt —
 * "getrennt" sagen wir nur, wenn der Monitor das frisch gemeldet hat.
 */

import { computed, getCurrentScope, onScopeDispose, ref } from "vue";

import { GameMode } from "@/utils/game-data-storage";

import { AutodartsToolsBoardData, defaultBoardData, type IBoard } from "@/utils/board-data-storage";
import { AutodartsToolsGameData, defaultGameData, type IGameData } from "@/utils/game-data-storage";
import { AutodartsToolsLobbyData } from "@/utils/lobby-data-storage";
import type { ILobbies } from "@/utils/websocket-helpers";
import { AutodartsToolsConfig, AutodartsToolsGlobalStatus, AutodartsToolsUrlStatus, type IGlobalStatus } from "@/utils/storage";
import { getBackendUrl } from "@/utils/backend-url";
import type { IMatch } from "@/utils/websocket-helpers";
// Nur LESEND: das Canonical Match Result (P2) bleibt unverändert, das Control
// Center ist ausschließlich Konsument der bereits gespeicherten Ergebnisse.
import {
  AutodartsToolsCanonicalMatchResults,
  getCanonicalMatchResults,
} from "@/utils/canonical-match-result-storage";
import type { ICanonicalMatchResult } from "@/utils/canonical-match-result";
// Player Identity (N2 Centralization) — zentrale myUserId für alle Views
import { getUserIdFromToken } from "@/utils/helpers";
// Checkout-Route-Tabelle: dieselbe Quelle wie CcMatchScoreboard.vue und das
// bestehende Bogey-Warning-Overlay — eine Tabelle, kein Duplikat.
import { CHECKOUTS } from "@/entrypoints/match.content/bogey-warning";
import { deriveCheckoutPath, type ICcCheckoutPath } from "@/utils/checkout-path";
import { deriveLiveThrow, type ICcLiveThrow } from "@/utils/live-throw";
import { deriveMomentum, deriveRecentVisits, type ICcMomentum, type ICcRecentVisit } from "@/utils/match-flow";

/** Der Key, den websocket-monitor.content.ts schreibt (kein WXT-Item). */
const WS_STATUS_KEY = "adt-ws-status";

/** Ab dieser Stille gilt ein Signal als nicht mehr aktuell. */
export const LIVE_WINDOW_MS = 90_000;

/** Takt, in dem die Alters-Anzeigen neu berechnet werden. */
const TICK_MS = 5_000;

export type TLiveness = "unknown" | "live" | "stale";
export type TConnectionState = "unknown" | "stale" | "connected" | "disconnected" | "error";
export type TBackendState = "idle" | "checking" | "ok" | "error";
export type TTone = "ok" | "warn" | "bad" | "idle" | "accent" | "gold";

/** Rohform des `adt-ws-status`-Eintrags. */
interface IWsStatusRaw {
  status?: string;
  openSockets?: number;
  when?: number;
  info?: string | null;
}

export interface ICcPlayer {
  seat: number;
  name: string;
  isBot: boolean;
  isActive: boolean;
  isWinner: boolean;
  legs?: number;
  sets?: number;
  average?: number;
  first9Average?: number;
  total180?: number;
  /** Anzahl Visits mit 100+ Punkten (`matchStats.plus100`). */
  plus100?: number;
  /** Anzahl Visits mit 140+ Punkten (`matchStats.plus140`). */
  plus140?: number;
  dartsThrown?: number;
  checkoutPercent?: number;
  /**
   * Höchstes Checkout. Entspricht `matchStats.checkoutPoints` — dieselbe
   * Auslegung wie im bestehenden Match-Sticker (match-card.ts).
   */
  checkoutPoints?: number;
  /** Restscore, nur bei X01 sinnvoll interpretierbar. */
  remaining?: number;
}

// ─── Modul-Zustand (eine Instanz pro Seite, per Refcount geteilt) ────────────
// Mehrere Komponenten (Top-Bar, Dashboard) nutzen denselben Status. Ohne
// Refcount würde jede Nutzung eigene Watcher und ein eigenes Intervall
// anlegen — genau die Art Leck, die Issue #9 adressiert hat.

const boardData = ref<IBoard>({ ...defaultBoardData });
const gameData = ref<IGameData>({ ...defaultGameData });
/** Lobby-/Party-Zustand aus `local:lobby-data` (Kanal `autodarts.lobbies`). */
const lobbyRaw = ref<ILobbies | undefined>(undefined);
/**
 * Letzte von einem Autodarts-Tab gemeldete URL (`local:urlstatus`).
 * Das ist die einzige Quelle, die eine ID zweifelsfrei einer Route zuordnet.
 */
const urlStatus = ref<string>("");
const wsRaw = ref<IWsStatusRaw | null>(null);
const authTokenAt = ref<number | null>(null);
const backendState = ref<TBackendState>("idle");
const backendLatencyMs = ref<number | null>(null);
const backendUrl = ref<string>("");
const isRefreshing = ref(false);
/** Zeitbasis für alle Alters-Berechnungen; wird vom Ticker fortgeschrieben. */
const now = ref(Date.now());
/**
 * Letzte Ankunft echter Live-Daten (board/game/lobby) in DIESEM Seiten-Kontext.
 * `adt-ws-status.when` wird nur bei Socket-open/close/error geschrieben — bei
 * laufendem Match fließen aber board/game-Daten weiter. Dieser Wert fängt diese
 * Live-Aktivität als zusätzliches Frische-Signal ab (siehe `lastLiveAt`).
 */
const lastLiveActivityAt = ref<number | null>(null);
/** Gespeicherte Match-Ergebnisse (P2-Store), neueste zuerst. Nur gelesen. */
const recentResults = ref<ICanonicalMatchResult[]>([]);
/** Zentrale Nutzer-Identität (Player-Identity-Fix / N2 Centralization). */
const myUserId = ref<string | null>(null);
/**
 * Für welchen Spieler die Quick-Stats gelten. `null` = automatisch
 * (Spieler am Wurf, sonst Sieger, sonst erster Spieler).
 */
const focusSeat = ref<number | null>(null);

let refCount = 0;
let lastSeenMatchId: string | null = null;
const teardown: Array<() => void> = [];

function onStorageChanged(changes: Record<string, any>, areaName: string): void {
  if (areaName !== "local") return;
  const entry = changes[WS_STATUS_KEY];
  if (entry) {
    wsRaw.value = (entry.newValue ?? null) as IWsStatusRaw | null;
    lastLiveActivityAt.value = Date.now();
  }
}

async function readWsStatus(): Promise<void> {
  try {
    const result = await browser.storage.local.get(WS_STATUS_KEY);
    const value = (result as Record<string, unknown>)[WS_STATUS_KEY];
    wsRaw.value = value && typeof value === "object" ? (value as IWsStatusRaw) : null;
  } catch {
    wsRaw.value = null;
  }
}

async function readAuth(): Promise<void> {
  try {
    const globalStatus = await AutodartsToolsGlobalStatus.getValue();
    const tokenAt = globalStatus?.auth?.tokenAt;
    authTokenAt.value = typeof tokenAt === "number" ? tokenAt : null;
  } catch {
    authTokenAt.value = null;
  }
}

async function readRecentResults(): Promise<void> {
  try {
    recentResults.value = await getCanonicalMatchResults();
  } catch {
    recentResults.value = [];
  }
}

async function loadMyUserId(): Promise<void> {
  try {
    myUserId.value = await getUserIdFromToken();
  } catch {
    myUserId.value = null;
  }
}

/** Beim Match-Wechsel die manuelle Spielerauswahl der Quick-Stats verwerfen. */
function syncFocusSeat(match: IMatch | undefined): void {
  const id = typeof match?.id === "string" ? match.id : null;
  if (id !== lastSeenMatchId) {
    lastSeenMatchId = id;
    focusSeat.value = null;
  }
}

/** Backend-Ping — identisch zur Popup-Logik (popup/App.vue::pingBackend). */
async function pingBackend(): Promise<void> {
  backendState.value = "checking";
  try {
    const config = await AutodartsToolsConfig.getValue();
    backendUrl.value = getBackendUrl(config?.aiCommentator?.backendUrl);
  } catch {
    backendUrl.value = getBackendUrl();
  }

  const url = `${backendUrl.value.replace(/\/+$/, "")}/api/marathon/health`;
  const started = performance.now();
  try {
    const response = await fetch(url, { method: "GET", cache: "no-cache" });
    if (response.ok) {
      backendState.value = "ok";
      backendLatencyMs.value = Math.round(performance.now() - started);
    } else {
      backendState.value = "error";
      backendLatencyMs.value = null;
    }
  } catch {
    backendState.value = "error";
    backendLatencyMs.value = null;
  }
}

async function refresh(): Promise<void> {
  if (isRefreshing.value) return;
  isRefreshing.value = true;
  try {
    const [ board, game, lobby, url ] = await Promise.all([
      AutodartsToolsBoardData.getValue(),
      AutodartsToolsGameData.getValue(),
      AutodartsToolsLobbyData.getValue(),
      AutodartsToolsUrlStatus.getValue(),
    ]);
    urlStatus.value = typeof url === "string" ? url : "";
    if (board) boardData.value = board;
    if (game) {
      gameData.value = game;
      syncFocusSeat(game.match);
    }
    lobbyRaw.value = lobby ?? undefined;
    await readWsStatus();
    await readAuth();
    await readRecentResults();
    await loadMyUserId();
    await pingBackend();
    now.value = Date.now();
  } finally {
    isRefreshing.value = false;
  }
}

function attach(): void {
  if (refCount++ > 0) return;

  const unwatchBoard = AutodartsToolsBoardData.watch((value: IBoard) => {
    if (value) boardData.value = value;
    now.value = Date.now();
    lastLiveActivityAt.value = Date.now();
  });
  const unwatchGame = AutodartsToolsGameData.watch((value: IGameData) => {
    if (value) {
      gameData.value = value;
      syncFocusSeat(value.match);
    }
    now.value = Date.now();
    lastLiveActivityAt.value = Date.now();
  });
  const unwatchLobby = AutodartsToolsLobbyData.watch((value: ILobbies | undefined) => {
    lobbyRaw.value = value ?? undefined;
    now.value = Date.now();
    lastLiveActivityAt.value = Date.now();
  });
  const unwatchUrl = AutodartsToolsUrlStatus.watch((value: string) => {
    urlStatus.value = typeof value === "string" ? value : "";
  });
  // Neue Match-Ergebnisse erscheinen ohne Zutun in der Verlaufsliste.
  const unwatchResults = AutodartsToolsCanonicalMatchResults.watch(() => {
    void readRecentResults();
  });
  // Auth-Token-Alter live nachführen (Runtime-Test 2026-08-27: ohne diesen
  // Watcher blieb "Autodarts Auth" nach einem frischen Login auf "Kein Token"
  // stehen, bis irgendetwas anderes refresh() erneut auslöste — board/game/
  // lobby/url werden längst so beobachtet, tokenAt war die einzige Lücke).
  const unwatchAuth = AutodartsToolsGlobalStatus.watch((value: IGlobalStatus) => {
    const tokenAt = value?.auth?.tokenAt;
    authTokenAt.value = typeof tokenAt === "number" ? tokenAt : null;
  });
  // N2 Centralization: myUserId live nachführen — wenn der Auth-Token später
  // ankommt (später Login), wird die Identität automatisch aufgelöst.
  const unwatchMyUserId = AutodartsToolsGlobalStatus.watch(() => void loadMyUserId());
  browser.storage.onChanged.addListener(onStorageChanged);
  const ticker = setInterval(() => { now.value = Date.now(); }, TICK_MS);

  teardown.push(
    () => unwatchBoard?.(),
    () => unwatchGame?.(),
    () => unwatchLobby?.(),
    () => unwatchUrl?.(),
    () => unwatchResults?.(),
    () => unwatchAuth?.(),
    () => unwatchMyUserId?.(),
    () => browser.storage.onChanged.removeListener(onStorageChanged),
    () => clearInterval(ticker),
  );

  void refresh();
}

function detach(): void {
  if (refCount > 0) refCount--;
  if (refCount > 0) return;
  while (teardown.length) {
    try {
      teardown.pop()?.();
    } catch {
      /* Cleanup darf niemals werfen. */
    }
  }
}

// ─── Anzeige-Helfer ──────────────────────────────────────────────────────────

/** "vor 12 Sek." / "vor 4 Min." / "vor 2 Std." — oder null, wenn unbekannt. */
export function formatAgo(timestamp: number | null | undefined, reference: number): string | null {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return null;
  const deltaMs = Math.max(0, reference - timestamp);
  const seconds = Math.round(deltaMs / 1000);
  if (seconds < 10) return "gerade eben";
  if (seconds < 60) return `vor ${seconds} Sek.`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `vor ${minutes} Min.`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  return `vor ${days} Tg.`;
}

/**
 * Board-Zustände. Das Vokabular ist nicht erfunden, sondern aus den bereits
 * vorhandenen Auswertungen übernommen (entrypoints/match.content/wled.ts und
 * caller.ts vergleichen genau diese Strings).
 */
const BOARD_STATUS_LABELS: Record<string, { label: string; tone: TTone }> = {
  "Throw": { label: "Bereit zum Wurf", tone: "ok" },
  "Takeout": { label: "Letzter Wurf erkannt", tone: "warn" },
  "Takeout in progress": { label: "Darts werden gezogen", tone: "warn" },
  "Starting": { label: "Board startet", tone: "warn" },
  "Stopping": { label: "Board stoppt", tone: "warn" },
  "Stopped": { label: "Board gestoppt", tone: "idle" },
  "Offline": { label: "Board offline", tone: "bad" },
};

export function useControlCenterStatus() {
  attach();
  if (getCurrentScope()) onScopeDispose(detach);

  // ── Verbindung ────────────────────────────────────────────────────────────

  const lastSignalAt = computed<number | null>(() => {
    const when = wsRaw.value?.when;
    return typeof when === "number" && Number.isFinite(when) ? when : null;
  });

  /**
   * Neuester Live-Kontakt überhaupt: entweder das explizite WS-Signal
   * (`adt-ws-status.when`) oder die zuletzt hier angekommene Live-Daten-
   * Aktualisierung (board/game/lobby). Beides sind echte Signale aus einem
   * offenen Autodarts-Tab — ohne den zweiten Zweig bliebe der globale Status
   * während eines laufenden Matches fälschlich "Keine aktuellen Daten".
   */
  const lastLiveAt = computed<number | null>(() => {
    const signalAt = lastSignalAt.value;
    const activityAt = lastLiveActivityAt.value;
    const a = typeof signalAt === "number" && Number.isFinite(signalAt) ? signalAt : 0;
    const b = typeof activityAt === "number" && Number.isFinite(activityAt) ? activityAt : 0;
    const newest = Math.max(a, b);
    return newest > 0 ? newest : null;
  });

  const liveness = computed<TLiveness>(() => {
    if (lastLiveAt.value === null) return "unknown";
    return now.value - lastLiveAt.value <= LIVE_WINDOW_MS ? "live" : "stale";
  });

  const lastSignalAgo = computed(() => formatAgo(lastLiveAt.value, now.value));

  const connection = computed<TConnectionState>(() => {
    if (liveness.value === "unknown") return "unknown";
    // Alte Daten sind kein Beweis für "getrennt" — nur für "nicht aktuell".
    if (liveness.value === "stale") return "stale";
    const status = wsRaw.value?.status;
    if (status === "connected") return "connected";
    if (status === "disconnected") return "disconnected";
    if (status === "error") return "error";
    return "unknown";
  });

  const connectionLabel = computed(() => {
    switch (connection.value) {
      case "connected": return "Verbunden";
      case "disconnected": return "Verbindung getrennt";
      case "error": return "Verbindungsfehler";
      case "stale": return "Keine aktuellen Daten";
      default: return "Status unbekannt";
    }
  });

  const connectionTone = computed<TTone>(() => {
    switch (connection.value) {
      case "connected": return "ok";
      case "disconnected":
      case "error": return "bad";
      case "stale": return "warn";
      default: return "idle";
    }
  });

  const connectionHint = computed(() => {
    switch (connection.value) {
      case "connected":
        return "Die Erweiterung empfängt Live-Daten von Autodarts.";
      case "disconnected":
        return "Der WebSocket zu Autodarts ist unterbrochen. Ein Reload des Autodarts-Tabs stellt ihn wieder her.";
      case "error":
        return "Der WebSocket hat einen Fehler gemeldet. Details siehe unten.";
      case "stale":
        return "Der letzte Kontakt liegt zurück. Sehr wahrscheinlich ist gerade kein Autodarts-Tab geöffnet – angezeigt wird der letzte bekannte Stand.";
      default:
        return "Es liegt noch kein Verbindungssignal vor. Öffne play.autodarts.io in einem Tab, damit die Erweiterung Daten empfangen kann.";
    }
  });

  const openSockets = computed<number | null>(() => {
    const value = wsRaw.value?.openSockets;
    return typeof value === "number" ? value : null;
  });

  const connectionInfo = computed<string | null>(() => {
    const info = wsRaw.value?.info;
    return typeof info === "string" && info.length > 0 ? info : null;
  });

  // ── Auth-Token ────────────────────────────────────────────────────────────

  /** Autodarts-JWT lebt ~15 Min (siehe utils/auth-refresh.ts). */
  const authFresh = computed<boolean | null>(() => {
    if (authTokenAt.value === null) return null;
    return now.value - authTokenAt.value < 15 * 60 * 1000;
  });

  const authAgo = computed(() => formatAgo(authTokenAt.value, now.value));

  // ── Board / Autoscoring ───────────────────────────────────────────────────

  const board = computed(() => boardData.value ?? defaultBoardData);

  /** true, sobald überhaupt jemals ein Board-Signal ankam. */
  const hasBoardSignal = computed(() => {
    const value = board.value;
    return Boolean(value?.connected || (value?.status ?? "") !== "" || (value?.event ?? "") !== "");
  });

  const boardStatusLabel = computed(() => {
    const status = board.value?.status ?? "";
    if (!hasBoardSignal.value) return "Unbekannt";
    if (status === "") return board.value?.connected ? "Verbunden" : "Kein Status gemeldet";
    return BOARD_STATUS_LABELS[status]?.label ?? status;
  });

  const boardTone = computed<TTone>(() => {
    if (!hasBoardSignal.value || liveness.value === "unknown") return "idle";
    // Ohne frische Daten keine grüne Ampel — der Stand kann beliebig alt sein.
    if (liveness.value === "stale") return "warn";
    if (!board.value?.connected) return "bad";
    const status = board.value?.status ?? "";
    return BOARD_STATUS_LABELS[status]?.tone ?? "ok";
  });

  const boardEvent = computed(() => {
    const event = board.value?.event ?? "";
    return event.length > 0 ? event : null;
  });

  const boardThrows = computed<number | null>(() => {
    const value = board.value?.numThrows;
    return typeof value === "number" ? value : null;
  });

  // ── Match ─────────────────────────────────────────────────────────────────

  const match = computed<IMatch | undefined>(() => gameData.value?.match);
  const hasMatch = computed(() => Boolean(match.value?.id));
  const isPrivateMatch = computed(() => Boolean(gameData.value?.private));
  const gameMode = computed(() => gameData.value?.gameMode ?? null);

  const matchVariant = computed(() => {
    const variant = match.value?.variant;
    return typeof variant === "string" && variant.length > 0 ? variant : null;
  });

  const matchFinished = computed(() => match.value?.finished === true);

  const winnerIndex = computed<number | null>(() => {
    const winner = match.value?.winner;
    return typeof winner === "number" && winner >= 0 ? winner : null;
  });

  const matchStateLabel = computed(() => {
    if (!hasMatch.value) return "Kein Match";
    if (matchFinished.value) return "Beendet";
    if (liveness.value === "live") return "Läuft";
    return "Letzter bekannter Stand";
  });

  const matchStateTone = computed<TTone>(() => {
    if (!hasMatch.value) return "idle";
    if (matchFinished.value) return "gold";
    return liveness.value === "live" ? "accent" : "warn";
  });

  /** Runde/Leg/Set nur dort, wo die Felder wirklich belegt sind. */
  const matchProgress = computed(() => {
    const value = match.value;
    if (!value) return null;
    return {
      leg: typeof value.leg === "number" ? value.leg : null,
      set: typeof value.set === "number" ? value.set : null,
      round: typeof value.round === "number" ? value.round : null,
    };
  });

  const players = computed<ICcPlayer[]>(() => {
    const value = match.value;
    if (!value || !Array.isArray(value.players)) return [];

    const scores = Array.isArray(value.scores) ? value.scores : [];
    const stats = Array.isArray(value.stats) ? value.stats : [];
    const gameScores = Array.isArray(value.gameScores) ? value.gameScores : [];
    const activeIndex = typeof value.player === "number" ? value.player : -1;

    return value.players.map((player, position) => {
      const matchStats = stats[position]?.matchStats;
      const remaining = gameScores[position];

      return {
        seat: (typeof player?.index === "number" ? player.index : position) + 1,
        name: typeof player?.name === "string" && player.name.length > 0 ? player.name : `Spieler ${position + 1}`,
        // cpuPPR ist bei Bots eine Zahl, bei Menschen null (siehe CMR-Ableitung).
        isBot: typeof player?.cpuPPR === "number",
        isActive: !matchFinished.value && activeIndex === position,
        isWinner: winnerIndex.value === position,
        legs: typeof scores[position]?.legs === "number" ? scores[position].legs : undefined,
        sets: typeof scores[position]?.sets === "number" ? scores[position].sets : undefined,
        average: typeof matchStats?.average === "number" ? matchStats.average : undefined,
        first9Average: typeof matchStats?.first9Average === "number" ? matchStats.first9Average : undefined,
        total180: typeof matchStats?.total180 === "number" ? matchStats.total180 : undefined,
        plus100: typeof matchStats?.plus100 === "number" ? matchStats.plus100 : undefined,
        plus140: typeof matchStats?.plus140 === "number" ? matchStats.plus140 : undefined,
        dartsThrown: typeof matchStats?.dartsThrown === "number" ? matchStats.dartsThrown : undefined,
        checkoutPercent: typeof matchStats?.checkoutPercent === "number" ? matchStats.checkoutPercent : undefined,
        checkoutPoints: typeof matchStats?.checkoutPoints === "number" ? matchStats.checkoutPoints : undefined,
        remaining: typeof remaining === "number" ? remaining : undefined,
      };
    });
  });

  // ── Variante ──────────────────────────────────────────────────────────────
  // Cricket und X01 haben unterschiedliche Kennzahlen. Wir erzwingen keine
  // X01-Werte auf anderen Varianten — was Autodarts nicht meldet, entfällt.

  const isX01 = computed(() => matchVariant.value === "X01");

  /** `variant` ist "Cricket"; der GameMode heißt "Cricket / Tactics". */
  const isCricket = computed(() =>
    matchVariant.value === "Cricket" || gameMode.value === GameMode.CRICKET_TACTICS,
  );

  /**
   * `IMatch.gameScores[i]` bedeutet je Variante etwas anderes: bei X01 der
   * Restscore, bei Cricket und den Punktespielen der Punktestand.
   */
  const scoreLabel = computed(() => (isX01.value ? "Rest" : "Punkte"));

  /** Restscore nur anzeigen, wo er eine definierte Bedeutung hat. */
  const showRemaining = computed(() => isX01.value && !matchFinished.value);

  /** Punktestand-Spalte für Nicht-X01-Varianten, solange Werte gemeldet sind. */
  const showPoints = computed(() =>
    !isX01.value && players.value.some(player => player.remaining !== undefined),
  );

  /** Sets-Spalten nur, wenn das Match überhaupt Sets führt. */
  const anySets = computed(() => players.value.some(player => player.sets !== undefined));

  const matchId = computed(() => {
    const id = match.value?.id;
    return typeof id === "string" && id.length > 0 ? id : null;
  });

  /**
   * Match-Einstellungen, soweit gemeldet. `baseScore` existiert nur bei X01
   * (IX01Settings) — deshalb defensiv gelesen und sonst `null`.
   */
  const matchSettings = computed(() => {
    const settings = match.value?.settings as Record<string, unknown> | undefined;
    if (!settings) return null;
    const pick = (key: string): string | null => {
      const value = settings[key];
      return typeof value === "string" && value.length > 0 ? value : null;
    };
    const pickNum = (key: string): number | null => {
      const value = settings[key];
      return typeof value === "number" && Number.isFinite(value) ? value : null;
    };
    return {
      baseScore: pickNum("baseScore"),
      maxRounds: pickNum("maxRounds"),
      inMode: pick("inMode"),
      outMode: pick("outMode"),
      bullMode: pick("bullMode"),
      gameMode: pick("gameMode"),
      mode: pick("mode"),
    };
  });

  const matchType = computed(() => {
    const type = match.value?.type;
    return typeof type === "string" && type.length > 0 ? type : null;
  });

  const matchCreatedAt = computed(() => {
    const createdAt = match.value?.createdAt;
    return typeof createdAt === "string" && createdAt.length > 0 ? createdAt : null;
  });

  /**
   * Die beiden Spieler für die Hero-Ansicht. Bei mehr als zwei Spielern werden
   * bewusst nur die ersten beiden groß dargestellt — die vollständige Liste
   * steht in der Spieler-Karte.
   */
  const heroPair = computed(() => {
    const list = players.value;
    if (list.length < 2) return null;
    return { left: list[0], right: list[1], extra: Math.max(0, list.length - 2) };
  });

  /** Live-Checkout-Route für den Match Hero (Wave 2) — siehe utils/checkout-path.ts. */
  const checkoutPath = computed<ICcCheckoutPath>(() => deriveCheckoutPath(match.value, isX01.value, CHECKOUTS));

  /** Live-Throw-Area für den Match Hero (Wave 2, Slice 1) — siehe utils/live-throw.ts. */
  const liveThrow = computed<ICcLiveThrow>(() => deriveLiveThrow(match.value));

  /** Letzte abgeschlossene Visits (Wave 2, Slice 2) — siehe utils/match-flow.ts. */
  const recentVisits = computed<ICcRecentVisit[]>(() => deriveRecentVisits(match.value));

  /**
   * Momentum (Wave 2, Slice 2): der zuletzt abgeschlossene Visit des aktiven
   * Spielers gegen dessen eigenen Match-Average — bewusst kein Trend über
   * mehrere Visits (siehe Kommentar in utils/match-flow.ts).
   */
  const momentum = computed<ICcMomentum>(() => {
    const activePlayer = players.value.find(p => p.isActive);
    return deriveMomentum(liveThrow.value.previousVisit?.score, activePlayer?.average);
  });

  /** "Legs 1 : 2" bzw. "Sets 1 : 2" — nur aus gemeldeten Werten. */
  const heroScoreLine = computed(() => {
    const pair = heroPair.value;
    if (!pair) return null;
    const useSets = anySets.value;
    const left = useSets ? pair.left.sets : pair.left.legs;
    const right = useSets ? pair.right.sets : pair.right.legs;
    if (left === undefined && right === undefined) return null;
    return {
      label: useSets ? "Sets" : "Legs",
      left: left ?? null,
      right: right ?? null,
      text: `${left ?? "–"} : ${right ?? "–"}`,
    };
  });

  /** Kurztitel für das Sidebar-Widget, z.B. "Pascal vs Alex". */
  const matchTitle = computed(() => {
    const list = players.value;
    if (list.length === 0) return null;
    if (list.length === 1) return list[0].name;
    return `${list[0].name} vs ${list[1].name}`;
  });

  // ── Quick-Stats ───────────────────────────────────────────────────────────

  /** Automatik: Spieler am Wurf → Sieger → erster Spieler. */
  const focusPlayer = computed<ICcPlayer | null>(() => {
    const list = players.value;
    if (list.length === 0) return null;
    if (focusSeat.value !== null) {
      const chosen = list.find(player => player.seat === focusSeat.value);
      if (chosen) return chosen;
    }
    return list.find(player => player.isActive)
      ?? list.find(player => player.isWinner)
      ?? list[0];
  });

  function setFocusSeat(seat: number | null): void {
    focusSeat.value = seat;
  }

  interface ICcStat {
    key: string;
    label: string;
    value: number | null;
    decimals: number;
    unit: string | undefined;
    accent: "plain" | "accent" | "gold";
  }

  function stat(
    key: string,
    label: string,
    value: number | undefined,
    decimals = 0,
    accent: ICcStat["accent"] = "plain",
    unit?: string,
  ): ICcStat {
    return { key, label, value: value ?? null, decimals, unit, accent };
  }

  /**
   * Quick-Stats. Jeder Wert kommt direkt aus `IMatch.stats[i].matchStats`;
   * `null` heißt "nicht gemeldet" und wird als "–" gezeigt.
   *
   * "High Finish" ist `checkoutPoints` — dieselbe Auslegung wie im bestehenden
   * Match-Sticker (match-card.ts: "Highest Checkout").
   *
   * Varianten-Regel: Nur bei X01 ist der volle X01-Satz garantiert sinnvoll.
   * Für Cricket & Co. wird KEIN X01-Wert erzwungen — dort erscheinen der
   * Punktestand, Darts und nur diejenigen Kennzahlen, die Autodarts für diese
   * Variante tatsächlich mitliefert. Eine eigene Cricket-Auswertung gibt es im
   * Bestand nicht (utils/wled.ts::processCricketData ist eine Leerfunktion),
   * also erfinden wir hier auch keine.
   */
  const quickStats = computed<ICcStat[]>(() => {
    const player = focusPlayer.value;

    if (isX01.value) {
      return [
        stat("average", "Average", player?.average, 2, "accent"),
        stat("first9", "First 9", player?.first9Average, 2),
        stat("checkout", "Checkout", player?.checkoutPercent, 1, "plain", "%"),
        stat("total180", "180er", player?.total180, 0, "gold"),
        stat("plus140", "140+", player?.plus140, 0),
        stat("plus100", "100+", player?.plus100, 0),
        stat("highFinish", "High Finish", player?.checkoutPoints, 0, "gold"),
        stat("darts", "Darts", player?.dartsThrown, 0),
      ];
    }

    // Nicht-X01: Punkte + Darts immer, alles Weitere nur wenn gemeldet.
    const base: ICcStat[] = [
      stat("points", scoreLabel.value, player?.remaining, 0, "accent"),
      stat("darts", "Darts", player?.dartsThrown, 0),
      stat("legs", "Legs", player?.legs, 0, "gold"),
    ];
    const optional: ICcStat[] = [
      stat("average", "Average", player?.average, 2),
      stat("first9", "First 9", player?.first9Average, 2),
      stat("checkout", "Checkout", player?.checkoutPercent, 1, "plain", "%"),
      stat("total180", "180er", player?.total180, 0, "gold"),
      stat("plus140", "140+", player?.plus140, 0),
      stat("plus100", "100+", player?.plus100, 0),
      stat("highFinish", "High Finish", player?.checkoutPoints, 0, "gold"),
    ].filter(entry => entry.value !== null);

    return [ ...base, ...optional ];
  });

  // ── Match-Verlauf (gespeicherte Ergebnisse, nur lesend) ───────────────────

  const results = computed(() => recentResults.value);

  const hasResults = computed(() => recentResults.value.length > 0);

  // ── Lobby / Party ─────────────────────────────────────────────────────────
  // Quelle ist `local:lobby-data`, gefüllt vom Kanal `autodarts.lobbies`
  // (utils/websocket-helpers.ts). Kein API-Call, kein Token nötig.

  const lobby = computed(() => lobbyRaw.value);

  const hasLobby = computed(() => Boolean(lobbyRaw.value?.id));

  const lobbyId = computed(() => {
    const id = lobbyRaw.value?.id;
    return typeof id === "string" && id.length > 0 ? id : null;
  });

  const lobbyPlayers = computed(() => {
    const list = lobbyRaw.value?.players;
    if (!Array.isArray(list)) return [];
    return list.map((player: any, position: number) => ({
      seat: position + 1,
      name: typeof player?.name === "string" && player.name.length > 0
        ? player.name
        : `Spieler ${position + 1}`,
      isBot: typeof player?.cpuPPR === "number",
      userId: typeof player?.userId === "string" ? player.userId : null,
      isHost: typeof player?.hostId === "string"
        && typeof lobbyRaw.value?.host?.id === "string"
        && player.hostId === lobbyRaw.value.host.id,
    }));
  });

  const lobbyHostName = computed(() => {
    const name = lobbyRaw.value?.host?.name;
    return typeof name === "string" && name.length > 0 ? name : null;
  });

  const lobbyVariant = computed(() => {
    const variant = lobbyRaw.value?.variant;
    return typeof variant === "string" && variant.length > 0 ? variant : null;
  });

  const lobbyMaxPlayers = computed(() => {
    const max = lobbyRaw.value?.maxPlayers;
    return typeof max === "number" && Number.isFinite(max) ? max : null;
  });

  const lobbyIsPrivate = computed(() => lobbyRaw.value?.isPrivate === true);

  const lobbyCreatedAt = computed(() => {
    const createdAt = lobbyRaw.value?.createdAt;
    return typeof createdAt === "string" && createdAt.length > 0 ? createdAt : null;
  });

  // ── Navigierbare IDs ──────────────────────────────────────────────────────
  //
  // RUNTIME-FIX: `game-data.match.id` ist NICHT immer eine Match-ID, die sich
  // unter /matches/<id> öffnen lässt.
  //
  // utils/websocket-helpers.ts nimmt einen `autodarts.matches`-Payload auf drei
  // Wegen an (Zeile 238):
  //   1. `data.id` entspricht dem `/matches/<id>` der aktuellen URL  → Match-ID
  //   2. ein Spieler passt auf das `/boards/<id>` der URL            → Match-ID
  //   3. `data.activated !== undefined` — URL-UNABHÄNGIG              → kann die
  //      Aktivierungs-/Lobby-Phase sein; existiert noch kein Match, landet der
  //      Rohpayload als `match` im Storage (Zeile 252-262).
  // Zusätzlich wird `game-data` nie geleert, ein alter Stand bleibt also stehen.
  //
  // Deshalb gilt hier: navigiert wird nur mit einer ID, deren Route belegt ist.
  // Belegt ist sie durch `local:urlstatus` — dieselbe Quelle und dasselbe
  // Muster, das `entrypoints/match.content/index.ts` zur Match-Erkennung nutzt.

  const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

  function routeId(kind: "matches" | "lobbies" | "boards"): string | null {
    const found = urlStatus.value.match(new RegExp(`/${kind}/(${UUID})`, "i"));
    return found?.[1] ?? null;
  }

  /** ID aus einer `/matches/<uuid>`-URL — zweifelsfrei eine Match-ID. */
  const matchRouteId = computed(() => routeId("matches"));

  /** ID aus einer `/lobbies/<uuid>`-URL — zweifelsfrei eine Lobby-ID. */
  const lobbyRouteId = computed(() => routeId("lobbies"));

  /**
   * Ursprung, den der Nutzer tatsächlich verwendet. Autodarts läuft unter
   * play.autodarts.io UND play.autodarts.com (siehe `matches` in den
   * Content-Scripts); wir öffnen auf derselben Domain statt über einen Redirect.
   */
  const autodartsOrigin = computed(() => {
    const found = urlStatus.value.match(/^https?:\/\/play\.autodarts\.(io|com)/i);
    return found ? found[0] : "https://play.autodarts.io";
  });

  /**
   * Die einzige ID, mit der `/matches/<id>` gefahrlos geöffnet werden darf.
   * `null` heißt: wir haben keine belegte Match-Route — dann wird auch kein
   * Match-Button angeboten.
   */
  const openableMatchId = computed<string | null>(() => {
    // 1. Belegte Match-Route gewinnt immer.
    if (matchRouteId.value) return matchRouteId.value;

    // 2. Ohne belegte Route nur dann `match.id`, wenn sie nachweislich keine
    //    Lobby-ID ist und der Payload nicht aus der Aktivierungsphase stammt.
    const id = matchId.value;
    if (!id) return null;
    if (id === lobbyId.value || id === lobbyRouteId.value) return null;
    if (match.value?.activated !== undefined) return null;
    if (!new RegExp(`^${UUID}$`, "i").test(id)) return null;
    return id;
  });

  /** Lobby-ID zum Öffnen: gemeldete Lobby oder belegte Lobby-Route. */
  const openableLobbyId = computed<string | null>(() => lobbyId.value ?? lobbyRouteId.value);

  /**
   * Warum kein Match-Link angeboten wird, in Klartext — damit die UI nicht
   * schweigend einen Button verschluckt.
   */
  const matchNavHint = computed<string | null>(() => {
    if (openableMatchId.value) return null;
    if (!matchId.value) return null;
    if (matchId.value === lobbyId.value || matchId.value === lobbyRouteId.value) {
      return "Die vorliegende Kennung gehört zu einer Lobby, nicht zu einem Match — deshalb wird stattdessen die Lobby angeboten.";
    }
    if (match.value?.activated !== undefined) {
      return "Die Match-Daten stammen aus der Aktivierungsphase; eine gesicherte Match-Adresse liegt noch nicht vor.";
    }
    return "Für diesen Stand liegt keine belegte Match-Adresse vor. Öffne das Match im Autodarts-Tab, damit die Adresse bekannt wird.";
  });

  /** Kurzfassung der Lobby-Regeln, nur aus gemeldeten Feldern. */
  const lobbyRules = computed(() => {
    const settings = lobbyRaw.value?.settings as Record<string, unknown> | undefined;
    if (!settings) return null;
    const parts: string[] = [];
    if (typeof settings.baseScore === "number") parts.push(String(settings.baseScore));
    if (typeof settings.inMode === "string" && settings.inMode) parts.push(`In ${settings.inMode}`);
    if (typeof settings.outMode === "string" && settings.outMode) parts.push(`Out ${settings.outMode}`);
    if (typeof settings.bullMode === "string" && settings.bullMode) parts.push(`Bull ${settings.bullMode}`);
    return parts.length > 0 ? parts.join(" · ") : null;
  });

  // ── Backend ───────────────────────────────────────────────────────────────

  // RUNTIME-FIX (Realtest 2): "Backend" allein liest sich wie "Autodarts" oder
  // "Friends & Party" — es ist aber ausschließlich der optionale KI-Kommentator-
  // Backend-Ping (pingBackend() oben, /api/marathon/health), unabhängig von
  // Autodarts-Login und Freundesliste. Zwei reale Tests haben das verwechselt.
  // Label eindeutig gemacht, Semantik/Zustände unverändert.
  const backendLabel = computed(() => {
    switch (backendState.value) {
      case "ok": return `KI-Backend erreichbar${backendLatencyMs.value !== null ? ` · ${backendLatencyMs.value} ms` : ""}`;
      case "error": return "KI-Backend nicht erreichbar";
      case "checking": return "KI-Backend wird geprüft …";
      default: return "KI-Backend nicht geprüft";
    }
  });

  const backendTone = computed<TTone>(() => {
    switch (backendState.value) {
      case "ok": return "ok";
      case "error": return "bad";
      case "checking": return "warn";
      default: return "idle";
    }
  });

  return {
    // Rohquellen (für Detailanzeigen)
    boardData: board,
    gameData,
    now,

    // Verbindung
    liveness,
    connection,
    connectionLabel,
    connectionTone,
    connectionHint,
    connectionInfo,
    lastSignalAt,
    lastSignalAgo,
    openSockets,

    // Auth
    authFresh,
    authAgo,

    // Player Identity (N2 Centralization)
    myUserId,

    // Board
    hasBoardSignal,
    boardStatusLabel,
    boardTone,
    boardEvent,
    boardThrows,

    // Match
    match,
    hasMatch,
    isPrivateMatch,
    gameMode,
    matchVariant,
    matchFinished,
    matchStateLabel,
    matchStateTone,
    matchProgress,
    winnerIndex,
    players,
    showRemaining,
    showPoints,
    scoreLabel,
    isX01,
    isCricket,
    anySets,
    matchId,
    matchSettings,
    matchType,
    matchCreatedAt,
    heroPair,
    heroScoreLine,
    matchTitle,
    checkoutPath,
    liveThrow,
    recentVisits,
    momentum,

    // Quick-Stats
    focusPlayer,
    setFocusSeat,
    quickStats,

    // Gespeicherte Ergebnisse (nur lesend)
    results,
    hasResults,

    // Lobby / Party
    lobby,
    hasLobby,
    lobbyId,
    lobbyPlayers,
    lobbyHostName,
    lobbyVariant,
    lobbyMaxPlayers,
    lobbyIsPrivate,
    lobbyCreatedAt,
    lobbyRules,

    // Navigation (belegte Routen)
    urlStatus,
    autodartsOrigin,
    matchRouteId,
    lobbyRouteId,
    openableMatchId,
    openableLobbyId,
    matchNavHint,

    // Backend
    backendState,
    backendLabel,
    backendTone,
    backendUrl,
    backendLatencyMs,

    // Aktionen
    isRefreshing,
    refresh,
  };
}
