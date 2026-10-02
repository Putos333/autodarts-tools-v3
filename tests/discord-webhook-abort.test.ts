/**
 * PKG-6 / T6 – AbortSignal-Unterstützung in utils/discord-webhook.ts.
 *
 * Nach einem HTTP 429 wartet postDiscordWebhook() und sendet GENAU EINEN zweiten
 * Request. Ohne Abbruchpfad kann dieser zweite Request auch nach dem Teardown
 * der Lobby-Funktion noch ausgelöst werden. Mit einem (optionalen) `signal` muss
 * ein Abort den Sleep beenden und jeden weiteren fetch verhindern.
 *
 * utils/discord-webhook.ts ist import-frei und läuft daher im node:test-Runner:
 *   node --import tsx --test tests/discord-webhook-abort.test.ts
 *
 * Realistische kurze Timer: der Wrapper klemmt Wartezeiten auf mindestens 200 ms.
 */

import { strict as assert } from "node:assert";
import { afterEach, beforeEach, describe, it } from "node:test";

import { postDiscordWebhook } from "../utils/discord-webhook";

const URL_ = "https://discord.example/api/webhooks/1/token";
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type Call = { url: string; init: RequestInit };

const realFetch = globalThis.fetch;
const realWarn = console.warn;
let calls: Call[];
let warnings: string[];

function res429(): Response {
  return new Response(JSON.stringify({ retry_after: 0.2 }), { status: 429, headers: { "Content-Type": "application/json" } });
}
function res200(): Response {
  return new Response(JSON.stringify({ id: "msg-1" }), { status: 200 });
}

function stubFetch(impl: (n: number, init: RequestInit) => Promise<Response>) {
  (globalThis as any).fetch = async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return impl(calls.length, init);
  };
}

beforeEach(() => {
  calls = [];
  warnings = [];
  console.warn = (...a: unknown[]) => { warnings.push(a.map(String).join(" ")); };
});

afterEach(() => {
  (globalThis as any).fetch = realFetch;
  console.warn = realWarn;
});

describe("postDiscordWebhook – Abort (T6)", () => {
  it("W1: Abort während des 429-Retry-Sleeps → kein zweiter Request, Rückgabe null, Sleep endet sofort", async () => {
    stubFetch(async (n) => (n === 1 ? res429() : res200()));
    const ac = new AbortController();
    const t0 = Date.now();
    const p = postDiscordWebhook(URL_, { method: "POST", body: "{}", returnResponse: true, signal: ac.signal } as any);
    await wait(50);
    ac.abort();
    const result = await p;
    const elapsed = Date.now() - t0;
    await wait(350); // länger als der ursprüngliche Retry-Zeitpunkt (200 ms)
    assert.equal(calls.length, 1, "es darf kein zweiter fetch stattfinden");
    assert.equal(result, null);
    assert.ok(elapsed < 190, `Sleep muss beim Abort enden (dauerte ${elapsed} ms)`);
  });

  it("W2: bereits abgebrochenes Signal → es wird gar kein Request gesendet", async () => {
    stubFetch(async () => res200());
    const ac = new AbortController();
    ac.abort();
    const result = await postDiscordWebhook(URL_, { method: "POST", body: "{}", returnResponse: true, signal: ac.signal } as any);
    assert.equal(calls.length, 0);
    assert.equal(result, null);
  });

  it("W3: Abort während des ersten fetch → null, und es wird kein Fehler als 'Fetch fehlgeschlagen' geloggt", async () => {
    stubFetch((_n, init) => new Promise<Response>((resolve, reject) => {
      const t = setTimeout(() => resolve(res200()), 300);
      init.signal?.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      });
    }));
    const ac = new AbortController();
    const p = postDiscordWebhook(URL_, { method: "POST", body: "{}", returnResponse: true, signal: ac.signal } as any);
    await wait(50);
    ac.abort();
    const result = await p;
    assert.equal(result, null);
    assert.equal(warnings.filter((w) => w.includes("Fetch fehlgeschlagen")).length, 0);
  });

  it("W4: das Signal wird an beide fetch-Aufrufe (Erstversuch und Retry) durchgereicht", async () => {
    stubFetch(async (n) => (n === 1 ? res429() : res200()));
    const ac = new AbortController();
    const result = await postDiscordWebhook(URL_, { method: "POST", body: "{}", returnResponse: true, signal: ac.signal } as any);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].init.signal, ac.signal);
    assert.equal(calls[1].init.signal, ac.signal);
    assert.equal((result as Response).status, 200);
  });
});

describe("postDiscordWebhook – Abort-Randfall", () => {
  it("W6: Signal wird abgebrochen, bevor der Sleep beginnt (während/unmittelbar nach dem 429-fetch) → Sleep startet nicht, kein zweiter Request", async () => {
    const ac = new AbortController();
    stubFetch(async (n) => {
      if (n === 1) { ac.abort(); return res429(); } // Abort, bevor der Wrapper den Sleep erreicht
      return res200();
    });
    const t0 = Date.now();
    const result = await postDiscordWebhook(URL_, { method: "POST", body: "{}", returnResponse: true, signal: ac.signal } as any);
    const elapsed = Date.now() - t0;
    assert.equal(result, null);
    assert.equal(calls.length, 1);
    assert.ok(elapsed < 150, `bereits abgebrochen: darf nicht auf den Retry-Timer warten (dauerte ${elapsed} ms)`);
  });
});

describe("postDiscordWebhook – Rückwärtskompatibilität ohne Signal", () => {
  it("W5a: 429 → genau ein Retry → Response des Retries", async () => {
    stubFetch(async (n) => (n === 1 ? res429() : res200()));
    const result = await postDiscordWebhook(URL_, { method: "POST", body: "{}", returnResponse: true });
    assert.equal(calls.length, 2);
    assert.equal((result as Response).status, 200);
  });

  it("W5b: Erfolg beim ersten Versuch → kein Retry; ohne returnResponse null", async () => {
    stubFetch(async () => res200());
    assert.equal(await postDiscordWebhook(URL_, { method: "POST", body: "{}" }), null);
    assert.equal(calls.length, 1);
  });

  it("W5c: zweimal 429 → genau zwei Requests (kein Endlos-Retry), Warnung 'Nachricht verloren'", async () => {
    stubFetch(async () => res429());
    const result = await postDiscordWebhook(URL_, { method: "POST", body: "{}", returnResponse: true });
    assert.equal(calls.length, 2);
    assert.equal((result as Response).status, 429);
    assert.ok(warnings.some((w) => w.includes("Nachricht verloren")));
  });

  it("W5d: Netzwerkfehler ohne Signal → null und 'Fetch fehlgeschlagen' wird weiterhin geloggt", async () => {
    stubFetch(async () => { throw new TypeError("network"); });
    const result = await postDiscordWebhook(URL_, { method: "POST", body: "{}", returnResponse: true });
    assert.equal(result, null);
    assert.ok(warnings.some((w) => w.includes("Fetch fehlgeschlagen")));
  });
});
