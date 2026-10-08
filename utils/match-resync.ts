/**
 * match-resync.ts – Zustandsautomat für die automatische Resynchronisation nach einem
 * WebSocket-Reconnect (Runtime Hardening R2).
 *
 * Problem: Nach einem Verbindungsverlust gehen Match-Updates verloren; der gespeicherte Zustand
 * bleibt veraltet, bis die nächste Live-Nachricht eintrifft. Der Capture-Hook meldet Verbindungs-
 * wechsel bereits über `autodarts-ws-status` (connected / disconnected).
 *
 * Verhalten:
 *   - Auslöser ist "connected" NACH einem "disconnected" – nicht der erste Verbindungsaufbau.
 *   - Es wird genau EIN Resync-Vorgang geplant. Weitere Signale, solange ein Vorgang geplant, laufend
 *     oder in der Retry-Wartezeit ist, werden koalesziert (kein zweiter Vorgang).
 *   - Ein Versuch: Token über `getToken()` (ensureFreshAuthToken) → auf /boards/<id> zuerst
 *     `/bs/v0/boards/<id>` → `matchId` → `/gs/v0/matches/<id>/state` → `apply(snapshot)`.
 *   - Schlägt ein Versuch fehl, folgt GENAU EIN weiterer Versuch nach `retryDelayMs`
 *     (MAX_RESYNC_ATTEMPTS = 2, keine Schleife). Danach endet der Vorgang sauber; der Fehler geht an `onError`.
 *   - Versuche laufen als Aufgaben in der seriellen Queue (`schedule`); die Retry-Wartezeit ist ein
 *     Timer außerhalb der Queue und blockiert Live-Nachrichten nicht.
 *   - Jeder Versuch hat ein Zeitlimit (`requestTimeoutMs`, Standard 10 s) für Token, Board-Lookup und Snapshot-Abruf.
 *     Läuft es ab, wird der Request per AbortSignal abgebrochen, der Versuch zählt als Fehlschlag (Retry/onError wie
 *     oben) und der Zustand wird zurückgesetzt – ein nie antwortender Fetch blockiert spätere Reconnects nicht.
 *     Das Zeitlimit endet vor `apply`; die Verarbeitung selbst ist davon nicht betroffen.
 *   - `dispose()` verwirft ausstehende Arbeit: laufende Versuche schreiben nichts mehr, der Retry-Timer
 *     wird gelöscht, spätere Signale werden ignoriert.
 *   - Navigiert die Seite während eines Versuchs zu einem anderen Match/Board, wird das Ergebnis verworfen.
 *
 * Das Modul ist import- und seiteneffektfrei (keine WXT-/Browser-Abhängigkeit), alle Abhängigkeiten werden
 * injiziert, damit es ohne Browserkontext testbar ist (tests/match-resync.test.ts). Es ändert weder
 * Scoring noch Dedupe: der Snapshot geht über `apply` in denselben Verarbeitungsweg wie Live-Nachrichten.
 */

export const MAX_RESYNC_ATTEMPTS = 2;
export const DEFAULT_RETRY_DELAY_MS = 2000;
export const DEFAULT_REQUEST_TIMEOUT_MS = 10000;
export const AUTODARTS_API_BASE = "https://api.autodarts.io";

const URL_TARGET_RE = /\/(matches|boards)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

export interface ResyncTarget {
  kind: "match" | "board";
  id: string;
}

/**
 * Ermittelt aus der Seiten-URL, was resynct werden soll. Gleiche Regeln wie der bestehende
 * REST-Bootstrap (match.content): nur /matches/<uuid> und /boards/<uuid>, keine History-Seiten.
 */
export function resolveResyncTarget(url: string): ResyncTarget | null {
  if (!url || url.includes("history")) return null;
  const m = URL_TARGET_RE.exec(url);
  if (!m) return null;
  return { kind: m[1].toLowerCase() === "boards" ? "board" : "match", id: m[2] };
}

export interface ResyncResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

export interface MatchResyncDeps {
  /** Aktuelle Seiten-URL (window.location.href). */
  getUrl(): string;
  /** Liefert ein möglichst frisches Access-Token (ensureFreshAuthToken). */
  getToken(): Promise<string | null | undefined>;
  fetch(url: string, init: { headers: Record<string, string>; signal?: AbortSignal }): Promise<ResyncResponse>;
  /** Speist den Snapshot in denselben Verarbeitungsweg wie Live-Nachrichten (Kanal "autodarts.matches"). */
  apply(snapshot: unknown): Promise<unknown> | unknown;
  /** Reiht eine Aufgabe in die serielle Verarbeitungs-Queue ein. */
  schedule(task: () => Promise<void>): void;
  /** Wird gerufen, wenn der erste Versuch scheitert und ein Retry geplant wird. */
  onRetry?(error: unknown): void;
  /** Wird gerufen, wenn der letzte erlaubte Versuch scheitert. */
  onError?(error: unknown): void;
  retryDelayMs?: number;
  setTimer?(cb: () => void, ms: number): unknown;
  clearTimer?(handle: unknown): void;
  /** Zeitlimit pro Versuch (Token + Abrufe, ohne `apply`). */
  requestTimeoutMs?: number;
  /** Eigener Timer für das Zeitlimit, getrennt vom Retry-Timer (Standard: setTimeout). */
  setRequestTimer?(cb: () => void, ms: number): unknown;
  clearRequestTimer?(handle: unknown): void;
}

export type ResyncPhase = "idle" | "queued" | "running" | "retry-wait";

export interface MatchResync {
  /** Verbindungsstatus des Capture-Hooks entgegennehmen ("connected" | "disconnected"; anderes wird ignoriert). */
  notifyStatus(status: string): void;
  /** Verwirft ausstehende Arbeit und ignoriert weitere Signale. */
  dispose(): void;
  readonly phase: ResyncPhase;
  /** Anzahl bisher gestarteter Versuche des aktuellen Vorgangs (0 im Leerlauf). */
  readonly attempts: number;
}

type Outcome = "applied" | "skipped" | "discarded";

export function createMatchResync(deps: MatchResyncDeps): MatchResync {
  const retryDelayMs = deps.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const setTimer = deps.setTimer ?? ((cb: () => void, ms: number) => setTimeout(cb, ms));
  const clearTimer = deps.clearTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));

  const requestTimeoutMs = deps.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const setRequestTimer = deps.setRequestTimer ?? ((cb: () => void, ms: number) => setTimeout(cb, ms));
  const clearRequestTimer = deps.clearRequestTimer ?? ((handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>));
  /** Bricht den Request des laufenden Versuchs ab (Timeout oder dispose). */
  let abortCurrent: (() => void) | undefined;

  let armed = false;
  let phase: ResyncPhase = "idle";
  let attempts = 0;
  let disposed = false;
  let retryHandle: unknown;
  let retryPending = false;

  // Die Callbacks dürfen den Ablauf nie stören.
  const safe = (fn: ((e: unknown) => void) | undefined, error: unknown) => { try { fn?.(error); } catch { /* ignorieren */ } };

  function finish() {
    phase = "idle";
    attempts = 0;
  }

  function begin() {
    phase = "queued";
    attempts = 0;
    deps.schedule(() => attempt());
  }

  type Loaded = { outcome: "skipped" | "discarded" } | { snapshot: unknown };

  /** Token + Abrufe unter Zeitlimit. Das Limit endet hier, bevor `apply` läuft. */
  async function load(target: ResyncTarget): Promise<Loaded> {
    const controller = new AbortController();
    let timer: unknown;
    let rejectLimit!: (error: Error) => void;
    const timeout = new Promise<never>((_, reject) => {
      rejectLimit = reject;
      timer = setRequestTimer(() => {
        controller.abort();
        reject(new Error(`resync request timed out after ${requestTimeoutMs} ms`));
      }, requestTimeoutMs);
    });
    timeout.catch(() => { /* wird über race() behandelt */ });
    abortCurrent = () => { controller.abort(); rejectLimit(new Error("resync aborted")); };
    const limited = <T>(p: Promise<T>): Promise<T> => Promise.race([p, timeout]);

    try {
      const token = await limited(deps.getToken());
      if (disposed) return { outcome: "discarded" };
      const init = { headers: token ? { Authorization: `Bearer ${token}` } : {} as Record<string, string>, signal: controller.signal };

      let matchId = target.id;
      if (target.kind === "board") {
        const boardRes = await limited(deps.fetch(`${AUTODARTS_API_BASE}/bs/v0/boards/${target.id}`, init));
        if (!boardRes.ok) throw new Error(`board lookup failed: HTTP ${boardRes.status}`);
        const board = (await limited(boardRes.json())) as { matchId?: string | null } | null;
        if (disposed) return { outcome: "discarded" };
        if (!board?.matchId) return { outcome: "skipped" }; // Board ohne aktives Match
        matchId = board.matchId;
      }

      const res = await limited(deps.fetch(`${AUTODARTS_API_BASE}/gs/v0/matches/${matchId}/state`, init));
      if (!res.ok) throw new Error(`match state failed: HTTP ${res.status}`);
      return { snapshot: await limited(res.json()) };
    } catch (error) {
      // Fehlerpfade (HTTP-Fehler, Timeout, dispose, Fetch-Fehler) geben den Request frei; erfolgreiche Requests bleiben unberührt.
      controller.abort();
      throw error;
    } finally {
      clearRequestTimer(timer);
      abortCurrent = undefined;
    }
  }

  async function fetchAndApply(): Promise<Outcome> {
    const target = resolveResyncTarget(deps.getUrl());
    if (!target) return "skipped";

    const loaded = await load(target);
    if ("outcome" in loaded) return loaded.outcome;

    // Verworfen, wenn inzwischen invalidiert oder zu einem anderen Match/Board navigiert wurde.
    if (disposed) return "discarded";
    if (resolveResyncTarget(deps.getUrl())?.id !== target.id) return "discarded";

    await deps.apply(loaded.snapshot);
    return "applied";
  }

  async function attempt(): Promise<void> {
    if (disposed) return;
    phase = "running";
    attempts++;
    try {
      await fetchAndApply();
      finish();
    } catch (error) {
      if (disposed) { finish(); return; }
      if (attempts < MAX_RESYNC_ATTEMPTS) {
        phase = "retry-wait";
        safe(deps.onRetry, error);
        retryPending = true;
        retryHandle = setTimer(() => {
          retryPending = false;
          if (disposed) return;
          phase = "queued";
          deps.schedule(() => attempt());
        }, retryDelayMs);
      } else {
        finish();
        safe(deps.onError, error);
      }
    }
  }

  return {
    notifyStatus(status: string) {
      if (disposed) return;
      if (status === "disconnected") {
        armed = true;
        return;
      }
      if (status === "connected" && armed) {
        armed = false;
        if (phase !== "idle") return; // koalesziert: ein Vorgang ist bereits aktiv
        begin();
      }
    },
    dispose() {
      disposed = true;
      abortCurrent?.();
      if (retryPending) {
        clearTimer(retryHandle);
        retryPending = false;
      }
      phase = "idle";
    },
    get phase() { return phase; },
    get attempts() { return attempts; },
  };
}
