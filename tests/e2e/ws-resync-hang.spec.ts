import type { BrowserContext, Route, Worker } from "@playwright/test";

import { expect, test } from "./fixtures/extension";
import { openFakeAutodarts } from "./helpers/ws";

/**
 * Runtime Hardening R2 – nie antwortender Fetch beim Resync, im echten Chromium mit der gebauten Extension.
 *
 * Kein echter Autodarts-Server: Seite, WebSocket-Gegenstelle und `api.autodarts.io` werden vollständig per
 * Playwright-Routing kontrolliert. Eine "hängende" Anfrage wird nie beantwortet (Route bleibt offen); die
 * Extension bricht sie nach dem 10-s-Zeitlimit per AbortSignal ab. Eine spät eintreffende Antwort wird erst
 * nach dem erfolgreichen Retry an die (inzwischen abgebrochene) Anfrage geschickt.
 */

const MATCH_ID = "7a1c2b3d-4e5f-4a60-8b71-c2d3e4f5e2e2";
const STATE_URL = `https://api.autodarts.io/gs/v0/matches/${MATCH_ID}/state`;
const TOKEN = "e2e-token";

const CORS = {
  "access-control-allow-origin": "https://play.autodarts.io",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-allow-methods": "GET,OPTIONS",
};

type Answer = { status: number; body?: unknown } | "hang";

/** Stubt api.autodarts.io; `respond(n)` bestimmt Antwort Nr. n (1-basiert). `hang` lässt die Route offen. */
async function stubApi(context: BrowserContext, respond: (n: number) => Answer) {
  const requests: Array<{ auth: string | undefined }> = [];
  const hung: Route[] = [];
  await context.route("https://api.autodarts.io/**", async route => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: CORS });
      return;
    }
    if (request.url() !== STATE_URL) {
      await route.fulfill({ status: 404, headers: CORS, contentType: "application/json", body: "{}" });
      return;
    }
    requests.push({ auth: request.headers()["authorization"] });
    const answer = respond(requests.length);
    if (answer === "hang") {
      hung.push(route);
      return;
    }
    await route.fulfill({ status: answer.status, headers: CORS, contentType: "application/json", body: JSON.stringify(answer.body ?? {}) });
  });
  return { requests, hung };
}

const snapshot = (round: number) => ({ id: MATCH_ID, round, player: 0, finished: false, turns: [], players: [] });

async function seedToken(serviceWorker: Worker) {
  await serviceWorker.evaluate(async token => {
    await (globalThis as any).chrome.storage.local.set({
      globalstatus: { isFirstStart: false, user: { name: "" }, auth: { token, tokenAt: Date.now() } },
    });
  }, TOKEN);
}

async function storedRound(serviceWorker: Worker): Promise<number | undefined> {
  return serviceWorker.evaluate(async () => {
    const stored = await (globalThis as any).chrome.storage.local.get("game-data");
    return stored["game-data"]?.match?.round as number | undefined;
  });
}

async function connectOnMatchPage(context: BrowserContext, serviceWorker: Worker, requests: unknown[]) {
  await seedToken(serviceWorker);
  const board = await openFakeAutodarts(context);
  await board.page.evaluate(id => history.pushState({}, "", `/matches/${id}`), MATCH_ID);
  await board.open();
  await board.page.waitForTimeout(700);
  return { board, baseline: requests.length };
}

test.describe("ws-resync-hang", () => {
  test.setTimeout(60_000);

  test("hängender Fetch: Abbruch nach dem Zeitlimit, Retry übernimmt den Snapshot, späte Antwort wird verworfen, weiterer Reconnect startet", async ({ context, serviceWorker }) => {
    let armedAt = Number.POSITIVE_INFINITY;
    const { requests, hung } = await stubApi(context, n => {
      if (n === armedAt) return "hang";
      return { status: 200, body: snapshot(n === armedAt + 1 ? 11 : 12) };
    });
    const { board, baseline } = await connectOnMatchPage(context, serviceWorker, requests);
    armedAt = baseline + 1; // die erste Anfrage NACH dem Reconnect hängt

    board.closeFromServer();
    await expect.poll(() => board.statusEvents()).toContain("disconnected");
    await board.open();

    await expect.poll(() => requests.length, { timeout: 5_000 }).toBe(baseline + 1);
    expect(await storedRound(serviceWorker)).toBeUndefined();

    // Zeitlimit (10 s) + Retry-Wartezeit (2 s): genau ein weiterer Versuch, der den Snapshot übernimmt.
    await expect.poll(() => requests.length, { timeout: 20_000 }).toBe(baseline + 2);
    await expect.poll(() => storedRound(serviceWorker), { timeout: 8_000 }).toBe(11);
    expect(requests.at(-1)?.auth).toBe(`Bearer ${TOKEN}`);

    // Späte Antwort auf die abgebrochene erste Anfrage: darf nichts mehr verändern.
    expect(hung).toHaveLength(1);
    await hung[0].fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify(snapshot(99)) }).catch(() => { /* Anfrage bereits abgebrochen */ });
    await board.page.waitForTimeout(1_000);
    expect(await storedRound(serviceWorker)).toBe(11);
    expect(requests.length).toBe(baseline + 2);

    // Ein weiterer Reconnect nach dem Timeout startet zuverlässig einen neuen Resync.
    board.closeFromServer();
    await expect.poll(() => board.statusEvents().then(list => list.filter(s => s === "disconnected").length), { timeout: 5_000 }).toBeGreaterThanOrEqual(2);
    await board.open();
    await expect.poll(() => requests.length, { timeout: 8_000 }).toBe(baseline + 3);
    await expect.poll(() => storedRound(serviceWorker), { timeout: 8_000 }).toBe(12);
  });

  test("beide Versuche hängen: genau zwei Anfragen, kein Snapshot, kein Loop – danach startet ein neuer Reconnect erneut", async ({ context, serviceWorker }) => {
    let armed = false;
    const { requests } = await stubApi(context, () => (armed ? "hang" : { status: 200, body: snapshot(21) }));
    const { board, baseline } = await connectOnMatchPage(context, serviceWorker, requests);
    armed = true;

    board.closeFromServer();
    await expect.poll(() => board.statusEvents()).toContain("disconnected");
    await board.open();

    await expect.poll(() => requests.length, { timeout: 5_000 }).toBe(baseline + 1);
    await expect.poll(() => requests.length, { timeout: 20_000 }).toBe(baseline + 2);
    // Zweiter Zeitlimit-Ablauf → onError, danach keine weitere Anfrage.
    await board.page.waitForTimeout(13_000);
    expect(requests.length).toBe(baseline + 2);
    expect(await storedRound(serviceWorker)).toBeUndefined();

    armed = false;
    board.closeFromServer();
    await expect.poll(() => board.statusEvents().then(list => list.filter(s => s === "disconnected").length), { timeout: 5_000 }).toBeGreaterThanOrEqual(2);
    await board.open();
    await expect.poll(() => requests.length, { timeout: 8_000 }).toBe(baseline + 3);
    await expect.poll(() => storedRound(serviceWorker), { timeout: 8_000 }).toBe(21);
  });
});
