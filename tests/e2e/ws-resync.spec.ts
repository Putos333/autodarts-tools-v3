import type { BrowserContext, Worker } from "@playwright/test";

import { expect, test } from "./fixtures/extension";
import { openFakeAutodarts } from "./helpers/ws";

/**
 * Runtime Hardening R2 – automatische Resynchronisation nach einem Reconnect, im echten Chromium
 * mit der gebauten Extension (entrypoints/websocket-monitor.content.ts + utils/match-resync.ts).
 *
 * Kein echter Autodarts-Server: die Ersatzseite, die WebSocket-Gegenstelle und `api.autodarts.io`
 * werden vollständig per Playwright-Routing kontrolliert. Die Seiten-URL wird per `history.pushState`
 * auf `/matches/<uuid>` gesetzt (ohne Navigation), damit der Resync ein Ziel hat.
 *
 * Anfragezähler werden als DELTA nach dem Setup gemessen, damit eventuelle Hintergrundanfragen anderer
 * Content-Scripts die Aussagen nicht verfälschen.
 */

const MATCH_ID = "7a1c2b3d-4e5f-4a60-8b71-c2d3e4f5e2e1";
const STATE_URL = `https://api.autodarts.io/gs/v0/matches/${MATCH_ID}/state`;
const TOKEN = "e2e-token";

interface StateRequest { auth: string | undefined }

const CORS = {
  "access-control-allow-origin": "https://play.autodarts.io",
  "access-control-allow-headers": "authorization,content-type",
  "access-control-allow-methods": "GET,OPTIONS",
};

/** Stubt api.autodarts.io; `respond(n)` bestimmt Antwort Nr. n (1-basiert, nur für den State-Endpunkt). */
async function stubApi(context: BrowserContext, respond: (n: number) => { status: number; body?: unknown }) {
  const requests: StateRequest[] = [];
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
    await route.fulfill({ status: answer.status, headers: CORS, contentType: "application/json", body: JSON.stringify(answer.body ?? {}) });
  });
  return requests;
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

/** Öffnet die Ersatzseite, setzt die Match-URL, verbindet einmal und liefert den Zähler-Ausgangswert. */
async function connectOnMatchPage(context: BrowserContext, serviceWorker: Worker, requests: StateRequest[]) {
  await seedToken(serviceWorker);
  const board = await openFakeAutodarts(context);
  await board.page.evaluate(id => history.pushState({}, "", `/matches/${id}`), MATCH_ID);
  await board.open();
  await board.page.waitForTimeout(700);
  return { board, baseline: requests.length };
}

test.describe("ws-resync", () => {
  test("reconnect: genau ein Resync mit Bearer-Token; der Snapshot landet in game-data", async ({ context, serviceWorker }) => {
    const requests = await stubApi(context, () => ({ status: 200, body: snapshot(7) }));
    const { board, baseline } = await connectOnMatchPage(context, serviceWorker, requests);

    board.closeFromServer();
    await expect.poll(() => board.statusEvents()).toContain("disconnected");
    await board.open();

    await expect.poll(() => requests.length, { timeout: 8_000 }).toBe(baseline + 1);
    expect(requests.at(-1)?.auth).toBe(`Bearer ${TOKEN}`);
    await expect.poll(() => storedRound(serviceWorker), { timeout: 8_000 }).toBe(7);

    await board.page.waitForTimeout(800);
    expect(requests.length).toBe(baseline + 1);
  });

  test("erster Verbindungsaufbau ohne vorheriges disconnected löst keinen Resync aus", async ({ context, serviceWorker }) => {
    const requests = await stubApi(context, () => ({ status: 200, body: snapshot(3) }));
    const { baseline } = await connectOnMatchPage(context, serviceWorker, requests);
    await new Promise(resolve => setTimeout(resolve, 800));
    expect(requests.length).toBe(baseline);
    expect(await storedRound(serviceWorker)).toBeUndefined();
  });

  test("erster Versuch scheitert (HTTP 500) → genau ein Retry, danach wird der Snapshot übernommen", async ({ context, serviceWorker }) => {
    let armedAt = Number.POSITIVE_INFINITY;
    const requests = await stubApi(context, n => (n === armedAt ? { status: 500 } : { status: 200, body: snapshot(9) }));
    const { board, baseline } = await connectOnMatchPage(context, serviceWorker, requests);
    armedAt = baseline + 1; // die erste Anfrage NACH dem Reconnect schlägt fehl

    board.closeFromServer();
    await expect.poll(() => board.statusEvents()).toContain("disconnected");
    await board.open();

    await expect.poll(() => requests.length, { timeout: 12_000 }).toBe(baseline + 2);
    await expect.poll(() => storedRound(serviceWorker), { timeout: 8_000 }).toBe(9);
    await board.page.waitForTimeout(1_000);
    expect(requests.length).toBe(baseline + 2);
  });

  test("beide Versuche scheitern → genau zwei Anfragen, keine Schleife", async ({ context, serviceWorker }) => {
    let armed = false;
    const requests = await stubApi(context, () => (armed ? { status: 503 } : { status: 200, body: snapshot(1) }));
    const { board, baseline } = await connectOnMatchPage(context, serviceWorker, requests);
    armed = true;

    board.closeFromServer();
    await expect.poll(() => board.statusEvents()).toContain("disconnected");
    await board.open();

    await expect.poll(() => requests.length, { timeout: 12_000 }).toBe(baseline + 2);
    await board.page.waitForTimeout(4_000);
    expect(requests.length).toBe(baseline + 2);
    expect(await storedRound(serviceWorker)).toBeUndefined();
  });
});
