/**
 * Runtime Hardening Phase 1 – Charakterisierungstests für den WebSocket-Capture-Hook
 * (entrypoints/websocket-capture.ts) und das Monitor-Content-Script
 * (entrypoints/websocket-monitor.content.ts). Beides ist KEIN Protected Core; die
 * Dateien werden hier nur importiert und ausgeführt, nicht verändert.
 *
 * Diese Tests halten das BESTEHENDE Verhalten fest (Stand HEAD afcd662). Sie
 * bewerten es nicht. Wird später ein Resync oder Duplikatschutz eingebaut (R1/R2),
 * sind betroffene Erwartungen gezielt und begründet anzupassen.
 *
 * Abdeckung (Auftrag A–G): A Reconnect/Resync-Verhalten, B Duplikat-Dispatch,
 * D schnelle Reconnect-Sequenzen, G Listener-/Timer-Aufräumen.
 *
 * R1 (Capture-Idempotenz + serielle Queue): Die Tests B2, R1a-* und R1b-* beschreiben das
 * Verhalten NACH R1. Vor R1 galt: Dispatch pro Lesezugriff (B2 = zwei Events), keine
 * Install-Sperre, nicht serialisierte Verarbeitung (Out-of-Order bei langsamem ersten Read).
 *
 * Harness-Hinweise (nur Testumgebung, kein Produktcode):
 *  - WXT-Globals (`defineUnlistedScript`, `defineContentScript`, `injectScript`) werden
 *    vor dem Import als Pass-Through gestubbt.
 *  - Echte Browser definieren `MessageEvent.data` als Accessor auf dem Prototyp (das
 *    nutzt der Capture-Hook); happy-dom nicht. Ein minimaler MessageEvent-Ersatz bildet
 *    das Browser-Verhalten nach.
 *  - Der Capture-Hook patcht globale Prototypen/Konstruktoren; er wird deshalb genau
 *    einmal pro Datei installiert (beforeAll).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { installWxtGlobals } from "../support/wxt-globals-mock";

const handle = installWxtGlobals();

/** Browser-nahes MessageEvent: `data` ist ein Prototyp-Accessor. */
class BrowserLikeMessageEvent extends Event {
  private readonly _data: unknown;
  constructor(type: string, init: { data?: unknown } = {}) {
    super(type);
    this._data = init.data;
  }
  get data() { return this._data; }
}

class FakeWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  url: string;
  constructor(url: string | URL) { super(); this.url = String(url); }
  send(_data: unknown) { /* no-op */ }
}

type StatusDetail = { status: string; openSockets: number; info: string | null };

const g = globalThis as any;
const statusEvents: StatusDetail[] = [];
const incomingEvents: unknown[] = [];
let WS: typeof FakeWebSocket;

function open(sock: EventTarget) { sock.dispatchEvent(new Event("open")); }
function close(sock: EventTarget, code = 1006) {
  const ev: any = new Event("close");
  ev.code = code;
  sock.dispatchEvent(ev);
}
function message(sock: EventTarget, payload: string, reads = 1) {
  const ev = new BrowserLikeMessageEvent("message", { data: payload });
  sock.addEventListener("message", (e: any) => { for (let i = 0; i < reads; i++) void e.data; }, { once: true });
  sock.dispatchEvent(ev);
}

beforeAll(async () => {
  g.defineUnlistedScript = (fn: () => void) => fn;
  g.defineContentScript = (cfg: unknown) => cfg;
  g.injectScript = async () => {};
  g.MessageEvent = BrowserLikeMessageEvent;
  (window as any).MessageEvent = BrowserLikeMessageEvent;
  g.WebSocket = FakeWebSocket;
  (window as any).WebSocket = FakeWebSocket;

  window.addEventListener("autodarts-ws-status", (e: Event) => statusEvents.push((e as CustomEvent).detail));
  window.addEventListener("websocket-incoming", (e: Event) => incomingEvents.push((e as CustomEvent).detail));

  const install = (await import("../../entrypoints/websocket-capture")).default as unknown as () => void;
  install();
  WS = (window as any).WebSocket;
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  statusEvents.length = 0;
  incomingEvents.length = 0;
  vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("Runtime Hardening P1 – WebSocket-Capture-Hook (Charakterisierung)", () => {
  describe("B. Duplikat-Dispatch", () => {
    it("B1. Eine Nachricht, `event.data` einmal gelesen → genau ein 'websocket-incoming'", () => {
      const sock = new WS("wss://api.autodarts.io/ws");
      message(sock, '{"channel":"autodarts.matches","data":{"id":"x"}}', 1);
      expect(incomingEvents).toHaveLength(1);
    });

    it("B2. (R1a) Dieselbe Nachricht, `event.data` zweimal gelesen (z. B. von zwei Handlern) → trotzdem genau EIN 'websocket-incoming' (Dispatch pro MessageEvent, nicht pro Lesezugriff)", () => {
      const sock = new WS("wss://api.autodarts.io/ws");
      message(sock, '{"channel":"autodarts.matches","data":{"id":"x"}}', 2);
      expect(incomingEvents).toHaveLength(1);
    });

    it("B3. (R1a) Zwei verschiedene Nachrichten (je mehrfach gelesen) → zwei Events, in Reihenfolge; die Inhalte bleiben unverändert", () => {
      const sock = new WS("wss://api.autodarts.io/ws");
      message(sock, '{"n":1}', 3);
      message(sock, '{"n":2}', 3);
      expect(incomingEvents.map((e: any) => e.data)).toEqual([ '{"n":1}', '{"n":2}' ]);
    });

    it("B4. (R1a) `event.data` liefert weiterhin den unveränderten Originalwert zurück (Getter-Vertrag bleibt)", () => {
      const sock = new WS("wss://api.autodarts.io/ws");
      const seen: unknown[] = [];
      sock.addEventListener("message", (e: any) => { seen.push(e.data, e.data); }, { once: true });
      sock.dispatchEvent(new BrowserLikeMessageEvent("message", { data: '{"k":"v"}' }));
      expect(seen).toEqual([ '{"k":"v"}', '{"k":"v"}' ]);
    });
  });

  describe("R1a. Idempotente Installation", () => {
    it("R1a-1. Erneutes Ausführen des Capture-Skripts (doppelte Injektion) wrappt nicht ein zweites Mal: derselbe WebSocket-Konstruktor, ein Status-Event pro open, ein Incoming-Event pro Nachricht", async () => {
      const wrappedBefore = (window as any).WebSocket;
      const install = (await import("../../entrypoints/websocket-capture")).default as unknown as () => void;
      install();
      install();
      expect((window as any).WebSocket).toBe(wrappedBefore);
      const sock = new (window as any).WebSocket("wss://api.autodarts.io/ws");
      statusEvents.length = 0;
      incomingEvents.length = 0;
      open(sock);
      message(sock, '{"a":1}', 1);
      expect(statusEvents.filter((e) => e.status === "connected")).toHaveLength(1);
      expect(incomingEvents).toHaveLength(1);
      close(sock);
    });

    it("R1a-2. Das Skript sendet bei doppelter Injektion auch ausgehende Nachrichten nur einmal (send wird nicht doppelt gewrappt)", async () => {
      const install = (await import("../../entrypoints/websocket-capture")).default as unknown as () => void;
      install();
      const outgoing: unknown[] = [];
      const handler = (e: Event) => outgoing.push((e as CustomEvent).detail);
      window.addEventListener("websocket-outgoing", handler);
      try {
        const sock = new (window as any).WebSocket("wss://api.autodarts.io/ws");
        sock.send('{"ping":1}');
        expect(outgoing).toHaveLength(1);
      } finally {
        window.removeEventListener("websocket-outgoing", handler);
      }
    });
  });

  describe("D. Schnelle Reconnect-Sequenzen", () => {
    it("D1. 25 schnelle open/close-Zyklen auf getrennten Sockets: 50 Statusmeldungen, abwechselnd connected/disconnected, Zähler driftet nicht (am Ende 0 offene Sockets)", () => {
      for (let i = 0; i < 25; i++) {
        const s = new WS("wss://api.autodarts.io/ws");
        open(s);
        close(s);
      }
      expect(statusEvents).toHaveLength(50);
      expect(statusEvents.map((e) => e.status)).toEqual(Array.from({ length: 25 }, () => [ "connected", "disconnected" ]).flat());
      expect(statusEvents.at(-1)).toMatchObject({ status: "disconnected", openSockets: 0 });
    });

    it("D2. Überlappender Reconnect (neuer Socket öffnet, bevor der alte schließt): beim Schließen des alten bleibt der Status 'connected' (kein Disconnect-Flackern)", () => {
      const oldSock = new WS("wss://api.autodarts.io/ws");
      open(oldSock);
      const newSock = new WS("wss://api.autodarts.io/ws");
      open(newSock);
      statusEvents.length = 0;
      close(oldSock);
      expect(statusEvents).toHaveLength(1);
      expect(statusEvents[0]).toMatchObject({ status: "connected", openSockets: 1 });
    });

    it("D3. Ein Socket, der nie geöffnet wurde (Verbindungsfehler) und schließt, meldet trotzdem 'disconnected' (Zähler bleibt 0)", () => {
      const failed = new WS("wss://api.autodarts.io/ws");
      close(failed, 1006);
      expect(statusEvents).toHaveLength(1);
      expect(statusEvents[0]).toMatchObject({ status: "disconnected", openSockets: 0 });
    });

    it("D4. Der Capture-Hook startet selbst keine Wiederverbindung: nach close entsteht kein neuer Socket und kein Timer", () => {
      const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
      const intervalSpy = vi.spyOn(globalThis, "setInterval");
      const sock = new WS("wss://api.autodarts.io/ws");
      let created = 0;
      const Wrapped = (window as any).WebSocket;
      const probe = new Proxy(Wrapped, { construct(t, args) { created++; return Reflect.construct(t, args); } });
      (window as any).WebSocket = probe;
      try {
        open(sock);
        close(sock);
      } finally {
        (window as any).WebSocket = Wrapped;
      }
      expect(created).toBe(0);
      expect(timeoutSpy).not.toHaveBeenCalled();
      expect(intervalSpy).not.toHaveBeenCalled();
    });
  });
});

describe("Runtime Hardening P1 – Monitor-Content-Script (Charakterisierung)", () => {
  async function startMonitor() {
    const mod: any = (await import("../../entrypoints/websocket-monitor.content")).default;
    const removers: Array<() => void> = [];
    let invalidate: () => void = () => {};
    const ctx = {
      // WXT-Vertrag: ctx.addEventListener entfernt den Listener bei Invalidierung automatisch.
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

  const status = (detail: object) => window.dispatchEvent(new CustomEvent("autodarts-ws-status", { detail }));
  const toasts = () => document.querySelectorAll('[data-testid="adt-ws-disconnect-toast"]');

  beforeEach(() => {
    handle.reset();
    document.body.innerHTML = "";
  });

  it("A1. Disconnect zeigt genau einen Toast, Reconnect blendet ihn aus; 'adt-ws-status' im Storage spiegelt den letzten Status; es erfolgt KEIN Fetch/Resync", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const monitor = await startMonitor();
    try {
      status({ status: "disconnected", openSockets: 0, when: 1, info: "api.autodarts.io · code=1006" });
      expect(toasts()).toHaveLength(1);
      status({ status: "connected", openSockets: 1, when: 2, info: "api.autodarts.io" });
      expect(toasts()).toHaveLength(0);
      await Promise.resolve();
      expect((handle.raw("adt-ws-status") as any)?.status).toBe("connected");
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      monitor.invalidate();
      vi.unstubAllGlobals();
    }
  });

  it("A2. Ein 'error'-Status zeigt keinen Toast", async () => {
    const monitor = await startMonitor();
    try {
      status({ status: "error", openSockets: 0, when: 1, info: "api.autodarts.io" });
      expect(toasts()).toHaveLength(0);
    } finally {
      monitor.invalidate();
    }
  });

  it("D5. Wiederholte 'disconnected'-Meldungen erzeugen nie mehr als einen Toast; ein späteres 'connected' entfernt ihn vollständig", async () => {
    const monitor = await startMonitor();
    try {
      for (let i = 0; i < 6; i++) status({ status: "disconnected", openSockets: 0, when: i, info: "x" });
      expect(toasts()).toHaveLength(1);
      status({ status: "connected", openSockets: 1, when: 99, info: "x" });
      expect(toasts()).toHaveLength(0);
    } finally {
      monitor.invalidate();
    }
  });

  it("G1. Nach Invalidierung des Content-Scripts reagieren keine der drei Window-Listener mehr (kein Toast, kein Storage-Write, keine Verarbeitung)", async () => {
    const monitor = await startMonitor();
    monitor.invalidate();
    const logSpy = vi.spyOn(console, "log");
    logSpy.mockClear();
    status({ status: "disconnected", openSockets: 0, when: 1, info: "x" });
    window.dispatchEvent(new CustomEvent("websocket-incoming", { detail: { url: "wss://x", data: '{"channel":"autodarts.tournaments","data":{"id":"t"}}' } }));
    expect(toasts()).toHaveLength(0);
    expect(handle.setCallCount("adt-ws-status")).toBe(0);
    expect(logSpy.mock.calls.some((c) => String(c[0]).includes("[Content Script] Parsed JSON data"))).toBe(false);
  });

  it("G2. Das Monitor-Script startet im Normalbetrieb keine Timer (Status-Events + eingehende Nachricht)", async () => {
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const intervalSpy = vi.spyOn(globalThis, "setInterval");
    const monitor = await startMonitor();
    try {
      timeoutSpy.mockClear();
      intervalSpy.mockClear();
      status({ status: "disconnected", openSockets: 0, when: 1, info: "x" });
      status({ status: "connected", openSockets: 1, when: 2, info: "x" });
      expect(intervalSpy).not.toHaveBeenCalled();
      expect(timeoutSpy).not.toHaveBeenCalled();
    } finally {
      monitor.invalidate();
    }
  });

  it("G3. Mehrfaches Starten des Monitors (z. B. nach Erweiterungs-Neustart ohne Invalidierung) verdoppelt die Statusverarbeitung: zwei Instanzen → zwei Storage-Writes pro Status-Event", async () => {
    const first = await startMonitor();
    const second = await startMonitor();
    try {
      status({ status: "connected", openSockets: 1, when: 1, info: "x" });
      await Promise.resolve();
      expect(handle.setCallCount("adt-ws-status")).toBe(2);
    } finally {
      first.invalidate();
      second.invalidate();
    }
  });

  describe("R1b. Serielle Verarbeitung eingehender Nachrichten", () => {
    const hex = (n: number) => `3f8b1c2a-4d5e-4f60-9a1b-2c3d4e5f6${String(n).padStart(3, "0")}`;
    const snapshot = (id: string, round: number) => ({ id, round, player: 0, finished: false, players: [], turns: [] });
    const incomingMatch = (id: string, round: number) =>
      window.dispatchEvent(new CustomEvent("websocket-incoming", {
        detail: { url: "wss://api.autodarts.io/ws", data: JSON.stringify({ channel: "autodarts.matches", data: snapshot(id, round) }) },
      }));
    const setMatchUrl = (id: string) => (window as any).happyDOM.setURL(`https://play.autodarts.io/matches/${id}`);
    const tick = async (n = 5) => { for (let i = 0; i < n; i++) await Promise.resolve(); };
    const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    async function gameItem() {
      return (await import("@/utils/game-data-storage")).AutodartsToolsGameData as any;
    }
    /** `getValue()` des game-data-Items pro Aufruf verzögern; liest sofort, gibt verzögert zurück. */
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
    async function recordWrites(item: any) {
      const rounds: number[] = [];
      const unwatch = item.watch((v: any) => { if (v?.match) rounds.push(v.match.round); });
      return { rounds, stop: () => unwatch() };
    }

    it("R1b-1. Zwei schnell eintreffende Nachrichten, die erste mit langsamem Read: Verarbeitung/Schreibreihenfolge bleibt 1 → 2 (vor R1 landete die ältere zuletzt)", async () => {
      const id = hex(1);
      setMatchUrl(id);
      const item = await gameItem();
      const restore = delayReads(item, [ 40, 0 ]);
      const rec = await recordWrites(item);
      const monitor = await startMonitor();
      try {
        incomingMatch(id, 1);
        incomingMatch(id, 2);
        await sleep(120);
        expect(rec.rounds).toEqual([ 1, 2 ]);
        expect((handle.raw("game-data") as any).match.round).toBe(2);
      } finally {
        monitor.invalidate();
        rec.stop();
        restore();
      }
    });

    it("R1b-2. Zehn schnell eintreffende Nachrichten mit wechselnd langsamen Reads: Reihenfolge 1…10 bleibt erhalten, kein Update geht verloren", async () => {
      const id = hex(2);
      setMatchUrl(id);
      const item = await gameItem();
      const restore = delayReads(item, [ 30, 0, 20, 0, 10, 0, 25, 0, 5, 0 ]);
      const rec = await recordWrites(item);
      const monitor = await startMonitor();
      try {
        for (let r = 1; r <= 10; r++) incomingMatch(id, r);
        await sleep(300);
        expect(rec.rounds).toEqual([ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10 ]);
      } finally {
        monitor.invalidate();
        rec.stop();
        restore();
      }
    });

    it("R1b-3. Ein Duplikat (byte-identischer Snapshot) wird weiterhin vom bestehenden Dedupe unterdrückt – die Queue ändert die Dedupe-Semantik nicht", async () => {
      const id = hex(3);
      setMatchUrl(id);
      const item = await gameItem();
      const rec = await recordWrites(item);
      const monitor = await startMonitor();
      try {
        incomingMatch(id, 1);
        incomingMatch(id, 1);
        incomingMatch(id, 2);
        await sleep(60);
        expect(rec.rounds).toEqual([ 1, 2 ]);
      } finally {
        monitor.invalidate();
        rec.stop();
      }
    });

    it("R1b-4. Eine fehlschlagende Verarbeitung (abgelehntes Promise) blockiert die Queue nicht: die nächste Nachricht wird verarbeitet, der Fehler wird gemeldet", async () => {
      const id = hex(4);
      setMatchUrl(id);
      const item = await gameItem();
      const rec = await recordWrites(item);
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const monitor = await startMonitor();
      try {
        // channel autodarts.matches mit data=null → processWebSocketMessage wirft (data.body)
        window.dispatchEvent(new CustomEvent("websocket-incoming", {
          detail: { url: "wss://api.autodarts.io/ws", data: JSON.stringify({ channel: "autodarts.matches", data: null }) },
        }));
        incomingMatch(id, 7);
        await sleep(60);
        expect(rec.rounds).toEqual([ 7 ]);
        expect(errorSpy).toHaveBeenCalled();
      } finally {
        monitor.invalidate();
        rec.stop();
      }
    });

    it("R1b-5. Nach Invalidierung werden noch nicht gestartete Nachrichten verworfen (die bereits laufende endet normal)", async () => {
      const id = hex(5);
      setMatchUrl(id);
      const item = await gameItem();
      const restore = delayReads(item, [ 40, 0 ]);
      const rec = await recordWrites(item);
      const monitor = await startMonitor();
      try {
        incomingMatch(id, 1);
        incomingMatch(id, 2);
        await tick();
        monitor.invalidate();
        await sleep(120);
        expect(rec.rounds).toEqual([ 1 ]);
      } finally {
        rec.stop();
        restore();
      }
    });

    it("R1b-6. Neuinitialisierung nach Invalidierung: der neue Monitor hat eine frische, funktionierende Queue und verarbeitet wieder", async () => {
      const id = hex(6);
      setMatchUrl(id);
      const item = await gameItem();
      const rec = await recordWrites(item);
      const first = await startMonitor();
      first.invalidate();
      const second = await startMonitor();
      try {
        incomingMatch(id, 3);
        await sleep(60);
        expect(rec.rounds).toEqual([ 3 ]);
      } finally {
        second.invalidate();
        rec.stop();
      }
    });
  });
});
