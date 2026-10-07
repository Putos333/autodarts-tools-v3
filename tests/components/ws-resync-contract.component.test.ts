/**
 * Runtime Hardening R2 – Vertragstests für die automatische Resynchronisation nach einem
 * WebSocket-Reconnect (TESTS FIRST).
 *
 * Diese Tests beschreiben das ZIEL-Verhalten von R2 und sind vor der Implementierung ROT.
 * Sie nutzen ausschließlich die bestehende Produktionsoberfläche: das echte Monitor-Content-Script
 * (entrypoints/websocket-monitor.content.ts), die vorhandenen `autodarts-ws-status`-Events des
 * Capture-Hooks, einen gestubbten `fetch` und das echte `ensureFreshAuthToken`
 * (utils/auth-refresh.ts). Es wird kein neues Modul vorausgesetzt.
 *
 * Vertrag (siehe R2-Plan):
 *  - Auslöser: Status "connected" NACH einem "disconnected" (nicht beim ersten Verbindungsaufbau).
 *  - Aktion: genau ein REST-Snapshot (`/gs/v0/matches/<id>/state`; auf /boards/<id> zuerst
 *    `/bs/v0/boards/<id>` → `matchId`), eingespeist über `processWebSocketMessage("autodarts.matches", …)`.
 *  - Auth: `ensureFreshAuthToken()` vor der Anfrage, Bearer-Header.
 *  - Retry: bei Fehlschlag genau EIN weiterer Versuch (max. 2 Versuche gesamt), keine Schleife.
 *  - Reihenfolge: der Resync läuft als Aufgabe in der seriellen R1-Queue; Live-Nachrichten bleiben geordnet.
 *  - Aufräumen: nach Invalidierung keine weitere Verarbeitung, kein Retry.
 *  - Multi-Tab: unverändert unkoordiniert (jede Instanz resynct selbst) – R3 ändert das bewusst später.
 *
 * Harness: dieselben WXT-Globals-Stubs wie in tests/components/ws-monitor-capture-characterization…
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { installWxtGlobals } from "../support/wxt-globals-mock";

const handle = installWxtGlobals();
const g = globalThis as any;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const hex = (n: number) => `7a1c2b3d-4e5f-4a60-8b71-c2d3e4f5${String(n).padStart(4, "0")}`;
const API = "https://api.autodarts.io";

// ── Harness ────────────────────────────────────────────────────────────────

beforeAll(() => {
  g.defineContentScript = (cfg: unknown) => cfg;
  g.injectScript = async () => {};
});

async function startMonitor() {
  const mod: any = (await import("../../entrypoints/websocket-monitor.content")).default;
  const removers: Array<() => void> = [];
  let invalidate: () => void = () => {};
  const ctx = {
    addEventListener(target: EventTarget, type: string, fn: EventListener) {
      target.addEventListener(type, fn);
      removers.push(() => target.removeEventListener(type, fn));
    },
    onInvalidated(cb: () => void) {
      const prev = invalidate;
      invalidate = () => { prev(); cb(); };
      return () => {};
    },
  };
  await mod.main(ctx);
  return { invalidate: () => { invalidate(); removers.forEach((r) => r()); } };
}

function emitStatus(status: "connected" | "disconnected") {
  window.dispatchEvent(new CustomEvent("autodarts-ws-status", {
    detail: { status, openSockets: status === "connected" ? 1 : 0, when: Date.now(), info: "api.autodarts.io" },
  }));
}
/** Ein vollständiger Verbindungsverlust mit Wiederaufbau. */
const reconnect = () => { emitStatus("disconnected"); emitStatus("connected"); };

function snapshot(id: string, round: number, boardId?: string) {
  return { id, round, player: 0, finished: false, turns: [], players: boardId ? [ { boardId } ] : [] };
}
function incoming(id: string, round: number, boardId?: string) {
  window.dispatchEvent(new CustomEvent("websocket-incoming", {
    detail: { url: "wss://api.autodarts.io/ws", data: JSON.stringify({ channel: "autodarts.matches", data: snapshot(id, round, boardId) }) },
  }));
}
const setUrl = (path: string) => (window as any).happyDOM.setURL(`https://play.autodarts.io/${path}`);

const okRes = (body: unknown) => ({ ok: true, status: 200, statusText: "OK", json: async () => body });
const failRes = (status = 500) => ({ ok: false, status, statusText: "ERR", json: async () => ({}) });

interface Call { url: string; init?: RequestInit }
function stubFetch(route: (url: string, call: number, init?: RequestInit) => unknown | Promise<unknown>) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return route(String(url), calls.length, init);
  }));
  return calls;
}
const stateCalls = (calls: Call[]) => calls.filter((c) => c.url.includes("/gs/v0/matches/") && c.url.endsWith("/state"));
const bearer = (c: Call) => new Headers(c.init?.headers as HeadersInit | undefined).get("authorization");

function seedToken(token: string, ageMs = 0) {
  handle.seed("globalstatus", { isFirstStart: false, user: { name: "" }, auth: { token, tokenAt: Date.now() - ageMs } });
}

async function gameItem() {
  return (await import("@/utils/game-data-storage")).AutodartsToolsGameData as any;
}
async function recordRounds() {
  const item = await gameItem();
  const rounds: number[] = [];
  const unwatch = item.watch((v: any) => { if (v?.match) rounds.push(v.match.round); });
  return { rounds, stop: () => unwatch() };
}
function delayReads(item: any, delaysMs: number[]) {
  const original = item.getValue.bind(item);
  let call = 0;
  item.getValue = async () => {
    const delay = delaysMs[call++] ?? 0;
    const value = await original();
    if (delay > 0) await sleep(delay);
    return value;
  };
  return () => { item.getValue = original; };
}
function deferred<T = unknown>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

beforeEach(() => {
  handle.reset();
  document.body.innerHTML = "";
  seedToken("tok-fresh");
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── Verträge ───────────────────────────────────────────────────────────────

describe("R2 – Resync nach Reconnect (Zielverhalten, vor Implementierung ROT)", () => {
  it("R2-1. disconnect → reconnect → genau EIN REST-Resync; der Snapshot wird gespeichert", async () => {
    const id = hex(1);
    setUrl(`matches/${id}`);
    const calls = stubFetch(() => okRes(snapshot(id, 4)));
    const rec = await recordRounds();
    const monitor = await startMonitor();
    try {
      emitStatus("connected"); // erster Verbindungsaufbau der Seite
      reconnect();
      await vi.waitFor(() => expect(stateCalls(calls)).toHaveLength(1), { timeout: 1500 });
      expect(stateCalls(calls)[0].url).toBe(`${API}/gs/v0/matches/${id}/state`);
      await vi.waitFor(() => expect(rec.rounds).toEqual([ 4 ]), { timeout: 1500 });
      await sleep(100);
      expect(stateCalls(calls)).toHaveLength(1);
    } finally {
      monitor.invalidate();
      rec.stop();
    }
  });

  it("R2-1b. Der erste Verbindungsaufbau (ohne vorheriges disconnected) löst KEINEN Resync aus", async () => {
    const id = hex(2);
    setUrl(`matches/${id}`);
    const calls = stubFetch(() => okRes(snapshot(id, 1)));
    const monitor = await startMonitor();
    try {
      emitStatus("connected");
      emitStatus("connected");
      await sleep(150);
      expect(calls).toHaveLength(0);
    } finally {
      monitor.invalidate();
    }
  });

  it("R2-1c. Auf einer Seite ohne Match-/Board-ID (z. B. Lobby-Übersicht) wird nicht resynct", async () => {
    setUrl("lobbies");
    const calls = stubFetch(() => okRes({}));
    const monitor = await startMonitor();
    try {
      emitStatus("connected");
      reconnect();
      await sleep(150);
      expect(calls).toHaveLength(0);
    } finally {
      monitor.invalidate();
    }
  });

  it("R2-1d. Auf /boards/<id> wird zuerst die aktive Match-ID aufgelöst, dann deren Snapshot geholt", async () => {
    const boardId = hex(3);
    const matchId = hex(4);
    setUrl(`boards/${boardId}`);
    const calls = stubFetch((url) => (url.includes("/bs/v0/boards/") ? okRes({ matchId }) : okRes(snapshot(matchId, 9, boardId))));
    const rec = await recordRounds();
    const monitor = await startMonitor();
    try {
      emitStatus("connected");
      reconnect();
      await vi.waitFor(() => expect(calls.map((c) => c.url)).toEqual([
        `${API}/bs/v0/boards/${boardId}`,
        `${API}/gs/v0/matches/${matchId}/state`,
      ]), { timeout: 1500 });
      await vi.waitFor(() => expect(rec.rounds).toEqual([ 9 ]), { timeout: 1500 });
    } finally {
      monitor.invalidate();
      rec.stop();
    }
  });

  it("R2-1e. Hat das Board kein aktives Match (matchId fehlt), wird kein Snapshot angefragt", async () => {
    const boardId = hex(5);
    setUrl(`boards/${boardId}`);
    const calls = stubFetch(() => okRes({ matchId: null }));
    const monitor = await startMonitor();
    try {
      emitStatus("connected");
      reconnect();
      await vi.waitFor(() => expect(calls).toHaveLength(1), { timeout: 1500 });
      await sleep(100);
      expect(stateCalls(calls)).toHaveLength(0);
    } finally {
      monitor.invalidate();
    }
  });

  it("R2-2. Mehrere Reconnect-Signale während desselben Übergangs → ein koalesziertes Resync (mehrfaches 'connected', schnelle Zyklen, Signale während der laufenden Anfrage)", async () => {
    const id = hex(6);
    setUrl(`matches/${id}`);
    const gate = deferred();
    const calls = stubFetch(async () => { await gate.promise; return okRes(snapshot(id, 2)); });
    const monitor = await startMonitor();
    try {
      emitStatus("connected");
      emitStatus("disconnected");
      emitStatus("connected");
      emitStatus("connected"); // zweites Signal desselben Übergangs
      await vi.waitFor(() => expect(stateCalls(calls)).toHaveLength(1), { timeout: 1500 });
      // weitere schnelle Zyklen, während die erste Anfrage noch läuft
      reconnect();
      reconnect();
      await sleep(100);
      expect(stateCalls(calls)).toHaveLength(1);
      gate.resolve(undefined);
      await sleep(150);
      expect(stateCalls(calls)).toHaveLength(1);
    } finally {
      monitor.invalidate();
    }
  });

  it("R2-3. ensureFreshAuthToken läuft VOR der Anfrage: bei veraltetem Token wird ein Refresh angefordert, die Anfrage nutzt das frische Token als Bearer", async () => {
    const id = hex(7);
    setUrl(`matches/${id}`);
    seedToken("tok-stale", 20 * 60 * 1000);
    const order: string[] = [];
    window.addEventListener("adt-request-token-refresh", () => {
      order.push("refresh-requested");
      seedToken("tok-new", 0);
    }, { once: true });
    const calls = stubFetch(() => { order.push("fetch"); return okRes(snapshot(id, 3)); });
    const monitor = await startMonitor();
    try {
      emitStatus("connected");
      reconnect();
      await vi.waitFor(() => expect(stateCalls(calls)).toHaveLength(1), { timeout: 2500 });
      expect(order).toEqual([ "refresh-requested", "fetch" ]);
      expect(bearer(stateCalls(calls)[0])).toBe("Bearer tok-new");
    } finally {
      monitor.invalidate();
    }
  });

  describe("Retry: genau ein weiterer Versuch, maximal 2 Versuche", () => {
    const failures: Array<[ string, () => unknown ]> = [
      [ "Netzwerkfehler (fetch lehnt ab)", () => { throw new Error("network down"); } ],
      [ "HTTP 500", () => failRes(500) ],
    ];

    it.each(failures)("R2-4. Erster Versuch scheitert (%s) → genau ein kontrollierter Retry, danach wird der Snapshot übernommen", async (_label, failure) => {
      const id = hex(8);
      setUrl(`matches/${id}`);
      vi.useFakeTimers({ toFake: [ "setTimeout", "clearTimeout", "setInterval", "clearInterval" ] });
      const calls = stubFetch((_url, n) => (n === 1 ? failure() : okRes(snapshot(id, 6))));
      const rec = await recordRounds();
      const monitor = await startMonitor();
      try {
        emitStatus("connected");
        reconnect();
        await vi.advanceTimersByTimeAsync(10_000);
        expect(stateCalls(calls)).toHaveLength(2);
        expect(rec.rounds).toEqual([ 6 ]);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(stateCalls(calls)).toHaveLength(2);
      } finally {
        monitor.invalidate();
        rec.stop();
      }
    });

    it("R2-5. Auch der zweite Versuch scheitert → sauberer Stopp ohne Schleife, Fehler wird gemeldet, Zustand bleibt unverändert, die Queue bleibt nutzbar", async () => {
      const id = hex(9);
      setUrl(`matches/${id}`);
      vi.useFakeTimers({ toFake: [ "setTimeout", "clearTimeout", "setInterval", "clearInterval" ] });
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const calls = stubFetch(() => failRes(503));
      const rec = await recordRounds();
      const monitor = await startMonitor();
      try {
        emitStatus("connected");
        reconnect();
        await vi.advanceTimersByTimeAsync(120_000);
        expect(stateCalls(calls)).toHaveLength(2);
        expect(errorSpy).toHaveBeenCalled();
        expect(rec.rounds).toEqual([]);
        // Die Queue ist danach weiter nutzbar: eine Live-Nachricht wird verarbeitet.
        incoming(id, 11);
        await vi.advanceTimersByTimeAsync(200);
        expect(rec.rounds).toEqual([ 11 ]);
        expect(stateCalls(calls)).toHaveLength(2);
      } finally {
        monitor.invalidate();
        rec.stop();
      }
    });
  });

  it("R2-6. Serielle Queue: [Live 1 (langsamer Read), Resync, Live 3] werden strikt in dieser Reihenfolge geschrieben → 1, 2, 3", async () => {
    const id = hex(10);
    setUrl(`matches/${id}`);
    const item = await gameItem();
    const restore = delayReads(item, [ 60 ]); // der erste Read (Live 1) ist langsam
    const calls = stubFetch(() => okRes(snapshot(id, 2)));
    const rec = await recordRounds();
    const monitor = await startMonitor();
    try {
      emitStatus("connected");
      incoming(id, 1);
      reconnect();
      incoming(id, 3);
      await vi.waitFor(() => expect(rec.rounds).toEqual([ 1, 2, 3 ]), { timeout: 2500 });
      expect(stateCalls(calls)).toHaveLength(1);
    } finally {
      monitor.invalidate();
      rec.stop();
      restore();
    }
  });

  it("R2-7. Live-Nachricht trifft ein, während der Resync noch läuft → sie wartet in der Queue und wird DANACH verarbeitet (Schreibreihenfolge Snapshot 4, Live 5)", async () => {
    const id = hex(11);
    setUrl(`matches/${id}`);
    const gate = deferred();
    stubFetch(async () => { await gate.promise; return okRes(snapshot(id, 4)); });
    const rec = await recordRounds();
    const monitor = await startMonitor();
    try {
      emitStatus("connected");
      reconnect();
      await sleep(50);
      incoming(id, 5);
      await sleep(80);
      expect(rec.rounds).toEqual([]); // Live 5 darf den noch ausstehenden Resync nicht überholen
      gate.resolve(undefined);
      await vi.waitFor(() => expect(rec.rounds).toEqual([ 4, 5 ]), { timeout: 2500 });
    } finally {
      monitor.invalidate();
      rec.stop();
    }
  });

  it("R2-7b. Während der Wartezeit bis zum Retry werden Live-Nachrichten sofort verarbeitet (der Retry blockiert die Queue nicht)", async () => {
    const id = hex(12);
    setUrl(`matches/${id}`);
    vi.useFakeTimers({ toFake: [ "setTimeout", "clearTimeout", "setInterval", "clearInterval" ] });
    const calls = stubFetch((_url, n) => (n === 1 ? failRes(500) : okRes(snapshot(id, 8))));
    const rec = await recordRounds();
    const monitor = await startMonitor();
    try {
      emitStatus("connected");
      reconnect();
      await vi.advanceTimersByTimeAsync(50); // erster Versuch ist gescheitert, Retry-Wartezeit läuft
      expect(stateCalls(calls)).toHaveLength(1);
      incoming(id, 7);
      await vi.advanceTimersByTimeAsync(50);
      expect(rec.rounds).toEqual([ 7 ]);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(stateCalls(calls)).toHaveLength(2);
      expect(rec.rounds).toEqual([ 7, 8 ]);
    } finally {
      monitor.invalidate();
      rec.stop();
    }
  });

  it("R2-8. Dedupe: Resync-Snapshot, danach dieselbe Nachricht per WebSocket (byte-identisch) → keine zusätzliche Verarbeitung; eine geänderte Nachricht wird verarbeitet", async () => {
    const id = hex(13);
    setUrl(`matches/${id}`);
    stubFetch(() => okRes(snapshot(id, 3)));
    const rec = await recordRounds();
    const monitor = await startMonitor();
    try {
      emitStatus("connected");
      reconnect();
      await vi.waitFor(() => expect(rec.rounds).toEqual([ 3 ]), { timeout: 1500 });
      expect(handle.setCallCount("game-data")).toBe(1);

      incoming(id, 3); // identisch zum Resync-Snapshot und zum gespeicherten Zustand
      await sleep(100);
      expect(handle.setCallCount("game-data")).toBe(1);
      expect(rec.rounds).toEqual([ 3 ]);

      incoming(id, 4); // echte Änderung
      await vi.waitFor(() => expect(rec.rounds).toEqual([ 3, 4 ]), { timeout: 1500 });
    } finally {
      monitor.invalidate();
      rec.stop();
    }
  });

  describe("R2-9. Aufräumen / Invalidierung", () => {
    it("R2-9a. Invalidierung während der Resync-Anfrage läuft: das später eintreffende Ergebnis wird verworfen, es gibt keinen Retry", async () => {
      const id = hex(14);
      setUrl(`matches/${id}`);
      vi.useFakeTimers({ toFake: [ "setTimeout", "clearTimeout", "setInterval", "clearInterval" ] });
      const gate = deferred();
      const calls = stubFetch(async () => { await gate.promise; return okRes(snapshot(id, 5)); });
      const rec = await recordRounds();
      const monitor = await startMonitor();
      try {
        emitStatus("connected");
        reconnect();
        await vi.advanceTimersByTimeAsync(100);
        expect(stateCalls(calls)).toHaveLength(1); // Anfrage ist unterwegs
        monitor.invalidate();
        gate.resolve(undefined);
        await vi.advanceTimersByTimeAsync(60_000);
        expect(rec.rounds).toEqual([]);
        expect(stateCalls(calls)).toHaveLength(1);
      } finally {
        rec.stop();
      }
    });

    it("R2-9b. Invalidierung während der Retry-Wartezeit bricht den Retry ab", async () => {
      const id = hex(15);
      setUrl(`matches/${id}`);
      vi.useFakeTimers({ toFake: [ "setTimeout", "clearTimeout", "setInterval", "clearInterval" ] });
      const calls = stubFetch(() => failRes(500));
      const rec = await recordRounds();
      const monitor = await startMonitor();
      try {
        emitStatus("connected");
        reconnect();
        await vi.advanceTimersByTimeAsync(50);
        expect(stateCalls(calls)).toHaveLength(1);
        monitor.invalidate();
        await vi.advanceTimersByTimeAsync(120_000);
        expect(stateCalls(calls)).toHaveLength(1);
        expect(rec.rounds).toEqual([]);
      } finally {
        rec.stop();
      }
    });

    it("R2-9c. Nach Invalidierung löst ein weiteres Reconnect-Signal keinen Resync mehr aus", async () => {
      const id = hex(16);
      setUrl(`matches/${id}`);
      const calls = stubFetch(() => okRes(snapshot(id, 1)));
      const monitor = await startMonitor();
      emitStatus("connected");
      reconnect();
      await vi.waitFor(() => expect(stateCalls(calls)).toHaveLength(1), { timeout: 1500 });
      monitor.invalidate();
      reconnect();
      await sleep(150);
      expect(stateCalls(calls)).toHaveLength(1);
    });
  });

  it("R2-10. Multi-Tab bleibt unkoordiniert (nur Charakterisierung, KEIN R3): zwei Monitor-Instanzen resyncen unabhängig → zwei Anfragen", async () => {
    const id = hex(17);
    setUrl(`matches/${id}`);
    const calls = stubFetch(() => okRes(snapshot(id, 2)));
    const first = await startMonitor();
    const second = await startMonitor();
    try {
      emitStatus("connected");
      reconnect();
      await vi.waitFor(() => expect(stateCalls(calls)).toHaveLength(2), { timeout: 2000 });
      await sleep(100);
      expect(stateCalls(calls)).toHaveLength(2);
    } finally {
      first.invalidate();
      second.invalidate();
    }
  });
});
