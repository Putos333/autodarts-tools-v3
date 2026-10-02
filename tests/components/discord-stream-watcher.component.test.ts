/**
 * PKG-5 / T8 – Verhaltenstest für den Game-Data-Watcher in discord-stream.ts.
 *
 * Der Watcher vergleicht gameScores.length zwischen altem und neuem Match. Ein
 * Match ohne gameScores (z.B. aus einer `activated`-Nachricht, siehe
 * utils/websocket-helpers.ts) darf dort keine TypeError auslösen.
 *
 * Läuft im Vitest-Runner (Alias "@", happy-dom); Storage-Module und fetch sind
 * gemockt. Produktionscode wird nicht verändert.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type WatchCb = (gd: any, old: any) => void;

const h = vi.hoisted(() => ({
  watchers: [] as Array<{ cb: (gd: any, old: any) => void; unwatch: ReturnType<typeof vi.fn> }>,
  gameData: { value: null as any },
}));

vi.mock("@/utils/storage", () => ({
  AutodartsToolsConfig: {
    getValue: async () => ({
      discord: {
        url: "https://discord.example/api/webhooks/1/token",
        autoStartAfterTimer: { enabled: true, stream: false, minutes: 5, matchId: "m", messageId: "https://old" },
      },
    }),
    setValue: async () => {},
  },
}));
vi.mock("@/utils/game-data-storage", () => ({
  AutodartsToolsGameData: {
    watch: (cb: WatchCb) => {
      const unwatch = vi.fn();
      h.watchers.push({ cb, unwatch });
      return unwatch;
    },
    getValue: async () => h.gameData.value,
  },
}));

const players = [ { name: "A" }, { name: "B" } ];
const match = (extra: Record<string, unknown> = {}) => ({ variant: "X01", player: 0, players, ...extra });
const flush = async () => { await new Promise((r) => setTimeout(r, 0)); };

async function loadModule() {
  vi.resetModules();
  return await import("@/entrypoints/match.content/discord-stream");
}

describe("discord-stream Watcher (Verhalten, T8)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    h.watchers.length = 0;
    h.gameData.value = { match: match({ gameScores: [ 501, 501 ] }) };
    fetchMock = vi.fn(async () => ({ json: async () => ({ id: "msg-1" }) }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  async function start() {
    const mod = await loadModule();
    await mod.discordStream();
    expect(h.watchers).toHaveLength(1);
    return { mod, cb: h.watchers[0].cb };
  }

  it("T8-1: match vorhanden, gameScores fehlt im neuen Match → keine TypeError", async () => {
    const { mod, cb } = await start();
    const old = { match: match({ gameScores: [ 501, 501 ] }) };
    expect(() => cb({ match: match() }, old)).not.toThrow();
    await flush();
    mod.discordStreamOnRemove();
  });

  it("T8-2: match vorhanden, gameScores fehlt im alten Match → keine TypeError", async () => {
    const { mod, cb } = await start();
    expect(() => cb({ match: match({ gameScores: [ 501, 501 ] }) }, { match: match() })).not.toThrow();
    await flush();
    mod.discordStreamOnRemove();
  });

  it("T8-3: gameScores fehlt in beiden Matches → keine TypeError und kein Webhook (nichts hat sich geändert)", async () => {
    const { mod, cb } = await start();
    expect(() => cb({ match: match() }, { match: match() })).not.toThrow();
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    mod.discordStreamOnRemove();
  });

  it("T8-4: match undefined (Default-Fallback) in beiden → keine TypeError, kein Webhook", async () => {
    const { mod, cb } = await start();
    expect(() => cb({ match: undefined }, { match: undefined })).not.toThrow();
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    mod.discordStreamOnRemove();
  });

  it("T8-5: Normalverhalten – geänderte gameScores-Länge löst genau einen Webhook aus", async () => {
    const { mod, cb } = await start();
    cb({ match: match({ gameScores: [ 501, 501, 501 ] }) }, { match: match({ gameScores: [ 501, 501 ] }) });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    mod.discordStreamOnRemove();
  });

  it("T8-6: Normalverhalten – unveränderte gameScores-Länge, gleicher Spieler und Wurfzahl lösen keinen Webhook aus", async () => {
    const { mod, cb } = await start();
    cb({ match: match({ gameScores: [ 501, 480 ] }) }, { match: match({ gameScores: [ 501, 501 ] }) });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    mod.discordStreamOnRemove();
  });

  it("T8-7: Normalverhalten – Spielerwechsel löst einen Webhook aus; Bull-off nicht", async () => {
    const { mod, cb } = await start();
    cb({ match: match({ player: 1, gameScores: [ 501, 501 ] }) }, { match: match({ player: 0, gameScores: [ 501, 501 ] }) });
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();
    cb({ match: match({ variant: "Bull-off", player: 1, gameScores: [ 501, 501 ] }) }, { match: match({ player: 0, gameScores: [ 501, 501 ] }) });
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    mod.discordStreamOnRemove();
  });
});
