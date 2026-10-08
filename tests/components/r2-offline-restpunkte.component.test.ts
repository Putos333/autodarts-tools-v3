/**
 * R2 – Offline-Restpunkte (Phase 2 + 3): Token-Beschaffung, Request-Timeout (10 s) gegen Queue-Timeout (15 s),
 * Reconnect während laufendem Resync. Nur Mocks, Fake-Timer und die lokale happy-dom-Umgebung;
 * kein Netzwerk, keine echte Autodarts-Session.
 *
 * Phase 2 prüft das echte `ensureFreshAuthToken` (utils/auth-refresh.ts), Phase 3 das echte Monitor-Content-Script
 * (entrypoints/websocket-monitor.content.ts) mit der echten seriellen Queue und utils/match-resync.ts.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { installWxtGlobals } from "../support/wxt-globals-mock";

const handle = installWxtGlobals();
const g = globalThis as any;

const hex = (n: number) => `7a1c2b3d-4e5f-4a60-8b71-c2d3e4f5${String(n).padStart(4, "0")}`;
type FakeMethod = "setTimeout" | "clearTimeout" | "setInterval" | "clearInterval" | "Date";
const FAKE_TIMERS: { toFake: FakeMethod[] } = { toFake: [ "setTimeout", "clearTimeout", "setInterval", "clearInterval" ] };
/** ensureFreshAuthToken misst seine Wartezeit mit Date.now() – dafür muss auch die Uhr gefaket sein. */
const FAKE_CLOCK: { toFake: FakeMethod[] } = { toFake: [ ...FAKE_TIMERS.toFake, "Date" ] };

function seedToken(token: string, ageMs = 0) {
  handle.seed("globalstatus", { isFirstStart: false, user: { name: "" }, auth: { token, tokenAt: Date.now() - ageMs } });
}
function clearToken() {
  handle.seed("globalstatus", { isFirstStart: false, user: { name: "" } });
}
function countRefreshEvents() {
  const counter = { n: 0 };
  const listener = () => { counter.n++; };
  window.addEventListener("adt-request-token-refresh", listener);
  return { counter, stop: () => window.removeEventListener("adt-request-token-refresh", listener) };
}

beforeEach(() => {
  handle.reset();
  document.body.innerHTML = "";
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ── Phase 2: ensureFreshAuthToken ───────────────────────────────────────────

describe("R2 Phase 2 – ensureFreshAuthToken (echte Funktion, Fake-Timer)", () => {
  async function load() {
    return (await import("../../utils/auth-refresh")).ensureFreshAuthToken;
  }

  it("P2-1. Frisches Token: gleichzeitige Aufrufe liefern sofort dasselbe Token und lösen keinen Refresh aus", async () => {
    vi.useFakeTimers(FAKE_CLOCK);
    seedToken("tok-fresh", 1000);
    const ensure = await load();
    const ev = countRefreshEvents();
    try {
      const results = await Promise.all([ ensure(), ensure(), ensure() ]);
      expect(results).toEqual([ "tok-fresh", "tok-fresh", "tok-fresh" ]);
      expect(ev.counter.n).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    } finally { ev.stop(); }
  });

  it("P2-2. Veraltetes Token, 3 gleichzeitige Aufrufe: KEINE Deduplizierung – 3 Probe-Events, aber alle Aufrufe erhalten das neue Token und enden", async () => {
    vi.useFakeTimers(FAKE_CLOCK);
    seedToken("tok-stale", 20 * 60 * 1000);
    const ensure = await load();
    const ev = countRefreshEvents();
    try {
      const pending = Promise.all([ ensure(), ensure(), ensure() ]);
      await vi.advanceTimersByTimeAsync(300);
      seedToken("tok-new", 0);
      await vi.advanceTimersByTimeAsync(200);
      expect(await pending).toEqual([ "tok-new", "tok-new", "tok-new" ]);
      expect(ev.counter.n).toBe(3);
      expect(vi.getTimerCount()).toBe(0);
    } finally { ev.stop(); }
  });

  it("P2-3. Kommt nie ein neues Token: jeder Aufruf endet nach maxWaitMs mit dem alten Token (kein Hängen, keine Restpolls)", async () => {
    vi.useFakeTimers(FAKE_CLOCK);
    seedToken("tok-stale", 20 * 60 * 1000);
    const ensure = await load();
    let settledAt = -1;
    const t0 = Date.now();
    const p = ensure().then((v) => { settledAt = Date.now() - t0; return v; });
    await vi.advanceTimersByTimeAsync(2700);
    expect(await p).toBe("tok-stale");
    expect(settledAt).toBeGreaterThanOrEqual(2500);
    expect(settledAt).toBeLessThanOrEqual(2700);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("P2-4. Ohne jedes Token endet der Aufruf nach maxWaitMs mit null", async () => {
    vi.useFakeTimers(FAKE_CLOCK);
    clearToken();
    const ensure = await load();
    const p = ensure();
    await vi.advanceTimersByTimeAsync(2700);
    expect(await p).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("P2-5. Verspätetes Token nach Ablauf von maxWaitMs ändert das schon gelieferte Ergebnis nicht und hinterlässt keinen Poll-Timer", async () => {
    vi.useFakeTimers(FAKE_CLOCK);
    seedToken("tok-stale", 20 * 60 * 1000);
    const ensure = await load();
    const p = ensure();
    await vi.advanceTimersByTimeAsync(2700);
    const result = await p;
    seedToken("tok-late", 0);
    await vi.advanceTimersByTimeAsync(5000);
    expect(result).toBe("tok-stale");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("P2-6. Obergrenze: Der Token-Schritt braucht höchstens ~2,6 s und bleibt damit weit unter dem 10-s-Request-Timeout", async () => {
    const { DEFAULT_REQUEST_TIMEOUT_MS } = await import("../../utils/match-resync");
    expect(2500 + 100).toBeLessThan(DEFAULT_REQUEST_TIMEOUT_MS);
  });
});

// ── Phase 3: Timeout, Queue, Reconnect ──────────────────────────────────────

function emitStatus(status: "connected" | "disconnected") {
  window.dispatchEvent(new CustomEvent("autodarts-ws-status", {
    detail: { status, openSockets: status === "connected" ? 1 : 0, when: Date.now(), info: "api.autodarts.io" },
  }));
}
const reconnect = () => { emitStatus("disconnected"); emitStatus("connected"); };
const setUrl = (path: string) => (window as any).happyDOM.setURL(`https://play.autodarts.io/${path}`);
const snapshot = (id: string, round: number) => ({ id, round, player: 0, finished: false, turns: [], players: [] });
function incoming(id: string, round: number) {
  window.dispatchEvent(new CustomEvent("websocket-incoming", {
    detail: { url: "wss://api.autodarts.io/ws", data: JSON.stringify({ channel: "autodarts.matches", data: snapshot(id, round) }) },
  }));
}
const okRes = (body: unknown) => ({ ok: true, status: 200, statusText: "OK", json: async () => body });
const failRes = (status = 500) => ({ ok: false, status, statusText: "ERR", json: async () => ({}) });
const never = () => new Promise<never>(() => { /* antwortet nie */ });

interface Call { url: string; init?: RequestInit }
function stubFetch(route: (call: number, init?: RequestInit) => unknown | Promise<unknown>) {
  const calls: Call[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return route(calls.length, init);
  }));
  return calls;
}

async function recordRounds() {
  const item = (await import("@/utils/game-data-storage")).AutodartsToolsGameData as any;
  const rounds: number[] = [];
  const unwatch = item.watch((v: any) => { if (v?.match) rounds.push(v.match.round); });
  return { item, rounds, stop: () => unwatch() };
}

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

describe("R2 Phase 3 – Request-Timeout gegen Queue-Timeout, Reconnect während Resync", () => {
  beforeEach(() => { seedToken("tok-fresh"); });

  it("P3-1. Ein hängender Resync-Fetch hält Live-Nachrichten höchstens bis zum 10-s-Request-Timeout auf (nicht bis zum 15-s-Queue-Timeout); die Reihenfolge bleibt erhalten", async () => {
    const id = hex(11);
    setUrl(`matches/${id}`);
    vi.useFakeTimers(FAKE_TIMERS);
    const calls = stubFetch((n) => (n === 1 ? never() : okRes(snapshot(id, 6))));
    const rec = await recordRounds();
    const monitor = await startMonitor();
    try {
      emitStatus("connected");
      reconnect();
      await vi.advanceTimersByTimeAsync(1000);
      incoming(id, 5);                                   // Live-Nachricht während des hängenden Fetch
      await vi.advanceTimersByTimeAsync(8900);           // t ≈ 9,9 s
      expect(rec.rounds).toEqual([]);
      await vi.advanceTimersByTimeAsync(300);            // t ≈ 10,2 s: Timeout → Queue läuft weiter
      expect(rec.rounds).toEqual([ 5 ]);
      await vi.advanceTimersByTimeAsync(3000);           // Retry nach 2 s
      expect(calls.length).toBe(2);
      expect(rec.rounds).toEqual([ 5, 6 ]);
    } finally { monitor.invalidate(); rec.stop(); }
  });

  it("P3-2. Reconnect-Signale während eines hängenden Fetch werden koalesziert; nach Timeout, Retry und Erfolg startet ein neuer Reconnect einen neuen Resync", async () => {
    const id = hex(12);
    setUrl(`matches/${id}`);
    vi.useFakeTimers(FAKE_TIMERS);
    const calls = stubFetch((n) => (n === 1 ? never() : okRes(snapshot(id, 2 + n))));
    const rec = await recordRounds();
    const monitor = await startMonitor();
    try {
      emitStatus("connected");
      reconnect();
      await vi.advanceTimersByTimeAsync(3000);
      reconnect(); reconnect();                          // während des laufenden Versuchs
      await vi.advanceTimersByTimeAsync(3000);
      expect(calls.length).toBe(1);
      await vi.advanceTimersByTimeAsync(5000);           // Timeout bei 10 s, Retry bei 12 s
      await vi.advanceTimersByTimeAsync(1000);
      expect(calls.length).toBe(2);
      expect(rec.rounds).toEqual([ 4 ]);
      reconnect();                                       // neuer, unabhängiger Reconnect
      await vi.advanceTimersByTimeAsync(500);
      expect(calls.length).toBe(3);
      expect(rec.rounds).toEqual([ 4, 5 ]);
    } finally { monitor.invalidate(); rec.stop(); }
  });

  it("P3-3. Reconnect während der Retry-Wartezeit nach HTTP 500 wird koalesziert (insgesamt 2 Fetches), danach ist ein neuer Reconnect möglich", async () => {
    const id = hex(13);
    setUrl(`matches/${id}`);
    vi.useFakeTimers(FAKE_TIMERS);
    const calls = stubFetch((n) => (n === 1 ? failRes(500) : okRes(snapshot(id, 10 + n))));
    const rec = await recordRounds();
    const monitor = await startMonitor();
    try {
      emitStatus("connected");
      reconnect();
      await vi.advanceTimersByTimeAsync(500);
      expect(calls.length).toBe(1);
      reconnect();                                       // mitten in der Retry-Wartezeit
      await vi.advanceTimersByTimeAsync(3000);
      expect(calls.length).toBe(2);
      expect(rec.rounds).toEqual([ 12 ]);
      reconnect();
      await vi.advanceTimersByTimeAsync(500);
      expect(calls.length).toBe(3);
      expect(rec.rounds).toEqual([ 12, 13 ]);
    } finally { monitor.invalidate(); rec.stop(); }
  });

  it("P3-4. Ein sehr langsames apply (20 s, über dem 15-s-Queue-Timeout): Queue gibt nach 15 s frei, die Resync-Aufgabe läuft weiter (CHARAKTERISIERUNG der Reihenfolge)", async () => {
    const id = hex(14);
    setUrl(`matches/${id}`);
    vi.useFakeTimers(FAKE_TIMERS);
    stubFetch(() => okRes(snapshot(id, 4)));
    const rec = await recordRounds();
    // Das erste Lesen im apply (Resync-Snapshot) dauert 20 s, alle weiteren sofort.
    const original = rec.item.getValue.bind(rec.item);
    let reads = 0;
    rec.item.getValue = async () => {
      const slow = reads++ === 0;
      const value = await original();
      if (slow) await new Promise<void>((r) => setTimeout(r, 20_000));
      return value;
    };
    const monitor = await startMonitor();
    try {
      emitStatus("connected");
      reconnect();
      await vi.advanceTimersByTimeAsync(1000);
      incoming(id, 5);                                   // Live-Nachricht hinter dem langsamen apply
      await vi.advanceTimersByTimeAsync(13_000);         // t = 14 s: Queue noch blockiert
      expect(rec.rounds).toEqual([]);
      await vi.advanceTimersByTimeAsync(2000);           // t = 16 s: Queue-Timeout (15 s) hat gegriffen
      expect(rec.rounds).toEqual([ 5 ]);
      await vi.advanceTimersByTimeAsync(6000);           // t = 22 s: langsames apply endet
      // Dokumentiert den tatsächlichen Ausgang; siehe Abschlussbericht.
      expect(rec.rounds).toEqual([ 5, 4 ]);
    } finally { rec.item.getValue = original; monitor.invalidate(); rec.stop(); }
  });

  it("P3-5. invalidate() während des hängenden Fetch: Request abgebrochen, kein Retry, kein apply, keine Folge-Fetches", async () => {
    const id = hex(15);
    setUrl(`matches/${id}`);
    vi.useFakeTimers(FAKE_TIMERS);
    const calls = stubFetch(() => never());
    const rec = await recordRounds();
    const monitor = await startMonitor();
    try {
      emitStatus("connected");
      reconnect();
      await vi.advanceTimersByTimeAsync(2000);
      expect(calls.length).toBe(1);
      const signal = calls[0].init?.signal as AbortSignal;
      monitor.invalidate();
      expect(signal.aborted).toBe(true);
      await vi.advanceTimersByTimeAsync(60_000);
      expect(calls.length).toBe(1);
      expect(rec.rounds).toEqual([]);
    } finally { rec.stop(); }
  });
});
