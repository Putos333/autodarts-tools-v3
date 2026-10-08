/**
 * Runtime Hardening R2 – Unit tests für utils/match-resync.ts (reiner Zustandsautomat).
 *
 * Alle Abhängigkeiten sind deterministische Fakes: manuelle Queue, manuelle Timer, scriptbarer fetch.
 * Der Verhalten-im-Monitor-Vertrag steht in tests/components/ws-resync-contract.component.test.ts.
 *
 *   node --import tsx --test tests/match-resync.test.ts
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import {
  createMatchResync,
  DEFAULT_REQUEST_TIMEOUT_MS,
  DEFAULT_RETRY_DELAY_MS,
  MAX_RESYNC_ATTEMPTS,
  resolveResyncTarget,
  type MatchResyncDeps,
  type ResyncResponse,
} from "../utils/match-resync";

const UUID_A = "7a1c2b3d-4e5f-4a60-8b71-c2d3e4f50001";
const UUID_B = "7a1c2b3d-4e5f-4a60-8b71-c2d3e4f50002";
const MATCH_URL = `https://play.autodarts.io/matches/${UUID_A}`;

const ok = (body: unknown): ResyncResponse => ({ ok: true, status: 200, json: async () => body });
const http = (status: number): ResyncResponse => ({ ok: false, status, json: async () => ({}) });

interface Harness {
  deps: MatchResyncDeps;
  url: { current: string };
  fetched: Array<{ url: string; auth?: string }>;
  signals: Array<AbortSignal | undefined>;
  applied: unknown[];
  retries: unknown[];
  errors: unknown[];
  tokens: { calls: number };
  /** Führt die älteste eingereihte Aufgabe aus (wie die serielle Queue). */
  runNext(): Promise<void>;
  queued(): number;
  timers: Array<{ cb: () => void; ms: number; cleared: boolean }>;
  fireTimer(i?: number): void;
  /** Request-Timeout-Timer (R2-Stabilisierung): getrennt von den Retry-Timern. */
  requestTimers: Array<{ cb: () => void; ms: number; cleared: boolean }>;
  fireRequestTimer(i?: number): void;
  responses: Array<(url: string, signal?: AbortSignal) => ResyncResponse | Promise<ResyncResponse>>;
}

function harness(opts: { token?: string | null; retryDelayMs?: number } = {}): Harness {
  const url = { current: MATCH_URL };
  const fetched: Harness["fetched"] = [];
  const signals: Harness["signals"] = [];
  const applied: unknown[] = [];
  const retries: unknown[] = [];
  const errors: unknown[] = [];
  const tokens = { calls: 0 };
  const queue: Array<() => Promise<void>> = [];
  const timers: Harness["timers"] = [];
  const requestTimers: Harness["requestTimers"] = [];
  const responses: Harness["responses"] = [];

  const deps: MatchResyncDeps = {
    getUrl: () => url.current,
    getToken: async () => { tokens.calls++; return opts.token === undefined ? "tok" : opts.token; },
    fetch: async (u, init) => {
      fetched.push({ url: u, auth: (init.headers as Record<string, string>).Authorization });
      signals.push(init.signal);
      const next = responses.shift();
      if (!next) throw new Error("kein Response geskriptet");
      return next(u, init.signal);
    },
    apply: async (s) => { applied.push(s); },
    schedule: (task) => { queue.push(task); },
    onRetry: (e) => retries.push(e),
    onError: (e) => errors.push(e),
    retryDelayMs: opts.retryDelayMs,
    setTimer: (cb, ms) => { const t = { cb, ms, cleared: false }; timers.push(t); return t; },
    clearTimer: (h) => { (h as { cleared: boolean }).cleared = true; },
    setRequestTimer: (cb, ms) => { const t = { cb, ms, cleared: false }; requestTimers.push(t); return t; },
    clearRequestTimer: (h) => { (h as { cleared: boolean }).cleared = true; },
  };

  return {
    deps, url, fetched, signals, applied, retries, errors, tokens, timers, responses, requestTimers,
    async runNext() { const t = queue.shift(); if (t) await t(); },
    queued: () => queue.length,
    fireTimer(i = timers.length - 1) { const t = timers[i]; if (!t.cleared) t.cb(); },
    fireRequestTimer(i = requestTimers.length - 1) { const t = requestTimers[i]; if (!t.cleared) t.cb(); },
  };
}

describe("resolveResyncTarget", () => {
  it("1. erkennt /matches/<uuid> und /boards/<uuid>", () => {
    assert.deepEqual(resolveResyncTarget(MATCH_URL), { kind: "match", id: UUID_A });
    assert.deepEqual(resolveResyncTarget(`https://play.autodarts.io/boards/${UUID_B}`), { kind: "board", id: UUID_B });
  });
  it("2. Lobby-Übersicht, leere URL und History-Seiten ergeben null", () => {
    assert.equal(resolveResyncTarget("https://play.autodarts.io/lobbies"), null);
    assert.equal(resolveResyncTarget(""), null);
    assert.equal(resolveResyncTarget(`https://play.autodarts.io/history/matches/${UUID_A}`), null);
  });
  it("3. Konstanten: höchstens 2 Versuche", () => {
    assert.equal(MAX_RESYNC_ATTEMPTS, 2);
    assert.ok(DEFAULT_RETRY_DELAY_MS > 0 && DEFAULT_RETRY_DELAY_MS <= 10_000);
  });
});

describe("createMatchResync – Auslöser und Koaleszenz", () => {
  it("4. Der erste Verbindungsaufbau und weitere 'connected' ohne vorheriges 'disconnected' planen nichts", () => {
    const h = harness();
    const r = createMatchResync(h.deps);
    r.notifyStatus("connected");
    r.notifyStatus("connected");
    r.notifyStatus("error");
    assert.equal(h.queued(), 0);
    assert.equal(r.phase, "idle");
  });

  it("5. disconnected → connected plant genau eine Aufgabe; sie holt den Snapshot mit Bearer-Token und übergibt ihn an apply", async () => {
    const h = harness({ token: "tok-1" });
    const snap = { id: UUID_A, round: 3 };
    h.responses.push(() => ok(snap));
    const r = createMatchResync(h.deps);
    r.notifyStatus("connected");
    r.notifyStatus("disconnected");
    r.notifyStatus("connected");
    assert.equal(h.queued(), 1);
    assert.equal(r.phase, "queued");
    await h.runNext();
    assert.deepEqual(h.fetched, [ { url: `https://api.autodarts.io/gs/v0/matches/${UUID_A}/state`, auth: "Bearer tok-1" } ]);
    assert.deepEqual(h.applied, [ snap ]);
    assert.equal(r.phase, "idle");
    assert.equal(r.attempts, 0);
  });

  it("6. Weitere Signale in jeder aktiven Phase (queued, running, retry-wait) werden koalesziert", async () => {
    const h = harness();
    let release!: () => void;
    const gate = new Promise<void>((res) => { release = res; });
    h.responses.push(async () => { await gate; return http(500); });
    h.responses.push(() => ok({ id: UUID_A }));
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    // queued
    r.notifyStatus("disconnected"); r.notifyStatus("connected"); r.notifyStatus("connected");
    assert.equal(h.queued(), 1);
    // running
    const running = h.runNext();
    await Promise.resolve();
    assert.equal(r.phase, "running");
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    assert.equal(h.queued(), 0);
    release();
    await running;
    // retry-wait
    assert.equal(r.phase, "retry-wait");
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    assert.equal(h.queued(), 0);
    assert.equal(h.timers.length, 1);
    // Retry läuft und beendet den Vorgang
    h.fireTimer();
    assert.equal(h.queued(), 1);
    await h.runNext();
    assert.equal(h.fetched.length, 2);
    assert.equal(r.phase, "idle");
  });

  it("7. Nach Abschluss ist ein neuer Reconnect wieder ein neuer Vorgang", async () => {
    const h = harness();
    h.responses.push(() => ok({ id: UUID_A, round: 1 }), () => ok({ id: UUID_A, round: 2 }));
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    await h.runNext();
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    await h.runNext();
    assert.equal(h.applied.length, 2);
  });
});

describe("createMatchResync – Ziele und Auth", () => {
  it("8. Board-URL: erst /bs/v0/boards/<id>, dann der Snapshot des aufgelösten Matches", async () => {
    const h = harness();
    h.url.current = `https://play.autodarts.io/boards/${UUID_B}`;
    h.responses.push(() => ok({ matchId: UUID_A }), () => ok({ id: UUID_A }));
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    // Navigation: die Seiten-URL bleibt /boards/<id>, apply ist erlaubt (Board-ID unverändert)
    await h.runNext();
    assert.deepEqual(h.fetched.map((f) => f.url), [
      `https://api.autodarts.io/bs/v0/boards/${UUID_B}`,
      `https://api.autodarts.io/gs/v0/matches/${UUID_A}/state`,
    ]);
    assert.equal(h.applied.length, 1);
    assert.equal(h.tokens.calls, 1); // ein Token pro Versuch
  });

  it("9. Board ohne aktives Match → kein Snapshot-Abruf, kein Retry, sauberes Ende", async () => {
    const h = harness();
    h.url.current = `https://play.autodarts.io/boards/${UUID_B}`;
    h.responses.push(() => ok({ matchId: null }));
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    await h.runNext();
    assert.equal(h.fetched.length, 1);
    assert.equal(h.applied.length, 0);
    assert.equal(h.timers.length, 0);
    assert.equal(r.phase, "idle");
  });

  it("10. Seiten ohne Match/Board-ID und History-Seiten → weder Token noch Fetch", async () => {
    for (const u of [ "https://play.autodarts.io/lobbies", `https://play.autodarts.io/history/matches/${UUID_A}` ]) {
      const h = harness();
      h.url.current = u;
      const r = createMatchResync(h.deps);
      r.notifyStatus("disconnected"); r.notifyStatus("connected");
      await h.runNext();
      assert.equal(h.tokens.calls, 0);
      assert.equal(h.fetched.length, 0);
      assert.equal(r.phase, "idle");
    }
  });

  it("11. Ohne Token wird die Anfrage ohne Authorization-Header gesendet", async () => {
    const h = harness({ token: null });
    h.responses.push(() => ok({ id: UUID_A }));
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    await h.runNext();
    assert.equal(h.fetched[0].auth, undefined);
  });
});

describe("createMatchResync – Retry (genau ein weiterer Versuch)", () => {
  it("12. Erster Versuch scheitert → onRetry, ein Timer mit retryDelayMs, KEIN sofortiger zweiter Versuch; nach dem Timer läuft Versuch 2 als Queue-Aufgabe", async () => {
    const h = harness({ retryDelayMs: 1234 });
    h.responses.push(() => http(500), () => ok({ id: UUID_A, round: 5 }));
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    await h.runNext();
    assert.equal(h.fetched.length, 1);
    assert.equal(h.retries.length, 1);
    assert.equal(r.phase, "retry-wait");
    assert.equal(h.queued(), 0); // blockiert die Queue nicht
    assert.equal(h.timers.length, 1);
    assert.equal(h.timers[0].ms, 1234);
    h.fireTimer();
    assert.equal(h.queued(), 1);
    await h.runNext();
    assert.equal(h.fetched.length, 2);
    assert.deepEqual(h.applied, [ { id: UUID_A, round: 5 } ]);
    assert.equal(h.errors.length, 0);
    assert.equal(r.phase, "idle");
  });

  it("13. Auch Netzwerkfehler (fetch wirft), Token-Fehler und apply-Fehler zählen als Fehlversuch", async () => {
    const throwing: Array<Partial<MatchResyncDeps> & { name: string }> = [
      { name: "fetch wirft", fetch: async () => { throw new Error("offline"); } },
      { name: "Token wirft", getToken: async () => { throw new Error("no token"); } },
      { name: "apply wirft", apply: async () => { throw new Error("apply"); } },
    ];
    for (const patch of throwing) {
      const h = harness();
      h.responses.push(() => ok({ id: UUID_A }));
      const deps = { ...h.deps, ...patch };
      const r = createMatchResync(deps);
      r.notifyStatus("disconnected"); r.notifyStatus("connected");
      await h.runNext();
      assert.equal(h.retries.length, 1, patch.name);
      assert.equal(r.phase, "retry-wait", patch.name);
    }
  });

  it("14. Auch der zweite Versuch scheitert → onError genau einmal, Vorgang beendet, kein weiterer Timer/Versuch (keine Schleife)", async () => {
    const h = harness();
    h.responses.push(() => http(503), () => http(503));
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    await h.runNext();
    h.fireTimer();
    await h.runNext();
    assert.equal(h.fetched.length, 2);
    assert.equal(h.errors.length, 1);
    assert.equal(h.retries.length, 1);
    assert.equal(h.timers.length, 1);
    assert.equal(h.queued(), 0);
    assert.equal(r.phase, "idle");
    assert.equal(h.applied.length, 0);
  });

  it("15. Nach dem endgültigen Fehlschlag startet ein NEUER Reconnect einen neuen Vorgang mit frischem Versuchszähler", async () => {
    const h = harness();
    h.responses.push(() => http(500), () => http(500), () => ok({ id: UUID_A }));
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    await h.runNext(); h.fireTimer(); await h.runNext();
    assert.equal(h.errors.length, 1);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    assert.equal(r.attempts, 0);
    await h.runNext();
    assert.equal(h.applied.length, 1);
    assert.equal(r.attempts, 0);
  });

  it("16. Werfende Callbacks (onRetry/onError) stören den Ablauf nicht", async () => {
    const h = harness();
    h.responses.push(() => http(500), () => http(500));
    const r = createMatchResync({ ...h.deps, onRetry: () => { throw new Error("x"); }, onError: () => { throw new Error("y"); } });
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    await h.runNext();
    h.fireTimer();
    await assert.doesNotReject(h.runNext());
    assert.equal(r.phase, "idle");
  });
});

describe("createMatchResync – Invalidierung und Verwerfen", () => {
  it("17. dispose() vor dem Start: die geplante Aufgabe tut nichts (kein Token, kein Fetch)", async () => {
    const h = harness();
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    r.dispose();
    await h.runNext();
    assert.equal(h.tokens.calls, 0);
    assert.equal(h.fetched.length, 0);
  });

  it("18. dispose() während der Anfrage: das Ergebnis wird verworfen (kein apply), kein Retry, kein Timer", async () => {
    const h = harness();
    let release!: () => void;
    const gate = new Promise<void>((res) => { release = res; });
    h.responses.push(async () => { await gate; return ok({ id: UUID_A }); });
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    const running = h.runNext();
    await Promise.resolve(); await Promise.resolve();
    r.dispose();
    release();
    await running;
    assert.equal(h.applied.length, 0);
    assert.equal(h.timers.length, 0);
    assert.equal(h.errors.length, 0);
  });

  it("19. dispose() während der Retry-Wartezeit löscht den Timer; auch ein verspäteter Timer startet nichts", async () => {
    const h = harness();
    h.responses.push(() => http(500));
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    await h.runNext();
    assert.equal(r.phase, "retry-wait");
    r.dispose();
    assert.equal(h.timers[0].cleared, true);
    h.timers[0].cb(); // selbst ein trotzdem ausgelöster Timer darf nichts mehr einreihen
    assert.equal(h.queued(), 0);
  });

  it("20. Nach dispose() werden weitere Signale ignoriert", () => {
    const h = harness();
    const r = createMatchResync(h.deps);
    r.dispose();
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    assert.equal(h.queued(), 0);
  });

  it("21. Navigiert die Seite während der Anfrage zu einem anderen Match, wird das Ergebnis verworfen", async () => {
    const h = harness();
    h.responses.push(() => { h.url.current = `https://play.autodarts.io/matches/${UUID_B}`; return ok({ id: UUID_A }); });
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    await h.runNext();
    assert.equal(h.applied.length, 0);
    assert.equal(h.errors.length, 0);
    assert.equal(r.phase, "idle");
  });
});

// R2-Stabilisierung (Risiko 1): ein Fetch, der nie antwortet, darf den Resync nicht dauerhaft blockieren.
const never = (): Promise<ResyncResponse> => new Promise<ResyncResponse>(() => { /* antwortet nie */ });
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

describe("createMatchResync – Request-Timeout (nie antwortender Fetch)", () => {
  it("22. Regression: ein hängender Fetch läuft in einen Timeout, setzt den Zustand zurück und ein weiterer Reconnect startet neu", async () => {
    const h = harness();
    h.responses.push(never, never, () => ok({ id: UUID_A }));
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");

    const first = h.runNext();
    await flush();
    assert.equal(r.phase, "running");
    assert.equal(h.requestTimers.length, 1, "pro Versuch ein Request-Timeout-Timer");
    assert.equal(h.requestTimers[0].ms, DEFAULT_REQUEST_TIMEOUT_MS);

    h.fireRequestTimer();                       // Timeout des ersten Versuchs
    await first;                                // darf nicht mehr hängen
    assert.equal(r.phase, "retry-wait");
    assert.equal(h.retries.length, 1);
    assert.equal(h.signals[0]?.aborted, true, "hängender Request wird per AbortSignal abgebrochen");

    h.fireTimer();                              // Retry
    const second = h.runNext();
    await flush();
    h.fireRequestTimer();                       // Timeout des zweiten Versuchs
    await second;
    assert.equal(r.phase, "idle");
    assert.equal(r.attempts, 0);
    assert.equal(h.errors.length, 1);
    assert.equal(h.fetched.length, 2, "genau zwei Versuche, keine Schleife");

    r.notifyStatus("disconnected"); r.notifyStatus("connected");   // der zweite Reconnect ist NICHT blockiert
    assert.equal(h.queued(), 1);
    await h.runNext();
    assert.equal(h.applied.length, 1);
  });

  it("23. Ein Timeout im ersten Versuch zählt als Fehlschlag: Retry, danach erfolgreicher Snapshot", async () => {
    const h = harness();
    h.responses.push(never, () => ok({ id: UUID_A, ok: 1 }));
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    const first = h.runNext(); await flush();
    h.fireRequestTimer(); await first;
    h.fireTimer(); await h.runNext();
    assert.deepEqual(h.applied, [{ id: UUID_A, ok: 1 }]);
    assert.equal(h.errors.length, 0);
    assert.equal(r.phase, "idle");
  });

  it("24. Eine rechtzeitige Antwort löscht den Request-Timer und bricht nichts ab", async () => {
    const h = harness();
    h.responses.push(() => ok({ id: UUID_A }));
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    await h.runNext();
    assert.equal(h.requestTimers.length, 1);
    assert.equal(h.requestTimers[0].cleared, true);
    assert.equal(h.signals[0]?.aborted, false);
    assert.equal(h.applied.length, 1);
  });

  it("25. Board-Pfad: der Timeout gilt für den Versuch insgesamt (Board-Lookup hängt)", async () => {
    const h = harness();
    h.url.current = `https://play.autodarts.io/boards/${UUID_B}`;
    h.responses.push(never);
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    const first = h.runNext(); await flush();
    h.fireRequestTimer(); await first;
    assert.equal(r.phase, "retry-wait");
    assert.equal(h.signals[0]?.aborted, true);
  });

  it("26. dispose() während des hängenden Requests: Timer weg, kein Retry, kein apply, kein onError", async () => {
    const h = harness();
    h.responses.push(never);
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    const first = h.runNext(); await flush();
    r.dispose();
    assert.equal(h.signals[0]?.aborted, true);
    await first;
    assert.equal(h.requestTimers[0].cleared, true);
    assert.equal(h.timers.length, 0);
    assert.equal(h.retries.length, 0);
    assert.equal(h.errors.length, 0);
    assert.equal(h.applied.length, 0);
    assert.equal(r.phase, "idle");
  });

  it("27. Verspätete Antwort nach dem Timeout wird nicht angewendet; Retry läuft wirklich, ein zweiter Reconnect startet", async () => {
    const h = harness();
    let late!: (r: ResyncResponse) => void;
    // Der erste Fetch ignoriert das Abort-Signal und liefert erst nach dem Timeout.
    h.responses.push(
      () => new Promise<ResyncResponse>((res) => { late = res; }),
      () => ok({ id: UUID_A, round: "frisch-1" }),
      () => ok({ id: UUID_A, round: "frisch-2" }),
    );
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    const first = h.runNext(); await flush();
    h.fireRequestTimer(); await first;
    assert.equal(r.phase, "retry-wait");
    assert.equal(h.retries.length, 1);

    late(ok({ id: UUID_A, round: "veraltet" }));
    await flush();
    assert.deepEqual(h.applied, [], "die verspätete Antwort wird nicht angewendet");

    h.fireTimer();
    await h.runNext();
    assert.equal(h.fetched.length, 2, "der Retry hat tatsächlich einen zweiten Fetch ausgeführt");
    assert.deepEqual(h.applied, [{ id: UUID_A, round: "frisch-1" }], "nur der Retry-Snapshot, nie der verspätete");
    assert.equal(h.errors.length, 0);
    assert.equal(r.phase, "idle");

    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    assert.equal(h.queued(), 1, "zweiter Reconnect startet");
    await h.runNext();
    assert.deepEqual(h.applied, [{ id: UUID_A, round: "frisch-1" }, { id: UUID_A, round: "frisch-2" }]);
  });

  it("28. Abort-Rejection: ein auf Abort ablehnender Fetch erzeugt keine unbehandelte Ablehnung; Retry und zweiter Reconnect laufen", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => { unhandled.push(e); };
    process.on("unhandledRejection", onUnhandled);
    try {
      const h = harness();
      const abortable = (_u: string, signal?: AbortSignal) => new Promise<ResyncResponse>((_, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
      h.responses.push(abortable, () => ok({ id: UUID_A, round: "retry" }), () => ok({ id: UUID_A, round: "zweiter-reconnect" }));
      const r = createMatchResync(h.deps);
      r.notifyStatus("disconnected"); r.notifyStatus("connected");
      const first = h.runNext(); await flush();
      h.fireRequestTimer(); await first;
      await new Promise((res) => setImmediate(res));
      assert.equal(h.signals[0]?.aborted, true);
      assert.equal(r.phase, "retry-wait");
      assert.equal(h.retries.length, 1);
      assert.equal(h.errors.length, 0);

      h.fireTimer(); await h.runNext();
      assert.equal(h.fetched.length, 2, "Retry wurde ausgeführt");
      assert.deepEqual(h.applied, [{ id: UUID_A, round: "retry" }]);

      r.notifyStatus("disconnected"); r.notifyStatus("connected");
      assert.equal(h.queued(), 1);
      await h.runNext();
      assert.equal(h.applied.length, 2);
      await new Promise((res) => setImmediate(res));
      assert.deepEqual(unhandled, [], "keine unbehandelte Promise-Ablehnung");
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("29. dispose() bei auf Abort ablehnendem Fetch: kein Retry, kein onError, keine unbehandelte Ablehnung", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (e: unknown) => { unhandled.push(e); };
    process.on("unhandledRejection", onUnhandled);
    try {
      const h = harness();
      h.responses.push((_u, signal) => new Promise<ResyncResponse>((_, reject) => {
        signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      }));
      const r = createMatchResync(h.deps);
      r.notifyStatus("disconnected"); r.notifyStatus("connected");
      const first = h.runNext(); await flush();
      r.dispose(); await first;
      await new Promise((res) => setImmediate(res));
      assert.equal(h.signals[0]?.aborted, true);
      assert.equal(h.requestTimers[0].cleared, true);
      assert.equal(h.timers.length, 0);
      assert.equal(h.retries.length + h.errors.length + h.applied.length, 0);
      assert.deepEqual(unhandled, []);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  it("30. Fehlerpfade geben den Request frei (HTTP-Fehler → abort), erfolgreiche Requests nicht", async () => {
    const h = harness();
    h.responses.push(() => http(500), () => ok({ id: UUID_A }));
    const r = createMatchResync(h.deps);
    r.notifyStatus("disconnected"); r.notifyStatus("connected");
    await h.runNext();
    assert.equal(h.signals[0]?.aborted, true, "fehlgeschlagener Versuch: Signal abgebrochen");
    assert.equal(h.requestTimers[0].cleared, true);
    h.fireTimer(); await h.runNext();
    assert.equal(h.signals[1]?.aborted, false, "erfolgreicher Versuch: Signal unberührt");
    assert.equal(h.applied.length, 1);
  });
});
