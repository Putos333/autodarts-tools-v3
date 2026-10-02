/**
 * Verhaltenstest für den Lifecycle von next-player-on-take-out-stuck.ts.
 *
 * Ergänzt den Quelltext-Contract in tests/lifecycle-contracts.test.mjs um echte
 * Laufzeitnachweise (Fake-Timer, gemockte Storage-Module, happy-dom):
 *   A. maximal ein aktiver Countdown-Timer
 *   B. OnRemove beendet Timer und entfernt das Countdown-Span
 *   C. ein asynchron zurückkehrendes altes Setup / Watcher-Callback erzeugt nach
 *      OnRemove weder Timer noch Handler noch Watcher
 *   D. wiederholtes Setup akkumuliert weder Timer, Watcher noch Listener
 *
 * Läuft im Vitest-Runner (Alias "@", happy-dom), weil node:test keine
 * "@/"-Imports auflösen kann. Produktionscode ist dafür nicht verändert.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

const h = vi.hoisted(() => ({
  config: { value: null as any },
  gameData: { value: null as any },
  watchers: [] as Array<{ cb: (b: any) => Promise<void>; unwatch: ReturnType<typeof vi.fn> }>,
  waitForButton: null as null | (() => Promise<HTMLElement>),
}));

vi.mock("@/utils/storage", () => ({
  AutodartsToolsConfig: { getValue: () => h.config.value() },
}));
// AutodartsToolsGameData wird in der Quelle nicht importiert, sondern kommt zur
// Build-Zeit aus den WXT-Auto-Imports; hier daher als Global bereitgestellt.
vi.mock("@/utils/board-data-storage", () => ({
  AutodartsToolsBoardData: {
    watch: (cb: (b: any) => Promise<void>) => {
      const unwatch = vi.fn();
      h.watchers.push({ cb, unwatch });
      return unwatch;
    },
  },
}));
vi.mock("@/utils", () => ({
  waitForElementWithTextContent: () => h.waitForButton!(),
}));

const flush = () => vi.advanceTimersByTimeAsync(0);

async function loadModule() {
  vi.resetModules();
  return await import("@/entrypoints/match.content/next-player-on-take-out-stuck");
}

describe("next-player-on-take-out-stuck Lifecycle (Verhalten)", () => {
  let nextBtn: HTMLButtonElement;
  let addSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    h.watchers.length = 0;
    h.config.value = async () => ({ nextPlayerOnTakeOutStuck: { enabled: true, sec: 5 } });
    h.gameData.value = async () => ({ match: { variant: "X01" } });
    vi.stubGlobal("AutodartsToolsGameData", { getValue: () => h.gameData.value() });
    document.body.innerHTML = "";
    nextBtn = document.createElement("button");
    nextBtn.textContent = "Next";
    document.body.appendChild(nextBtn);
    h.waitForButton = async () => nextBtn;
    addSpy = vi.spyOn(document, "addEventListener");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const takeout = (watcherIdx = 0) => h.watchers[watcherIdx].cb({ status: "Takeout in progress" });

  it("A: Takeout startet genau einen Timer, erneutes Takeout ersetzt ihn statt einen zweiten zu stapeln", async () => {
    const mod = await loadModule();
    await mod.nextPlayerOnTakeOutStuck();
    expect(h.watchers).toHaveLength(1);

    await takeout();
    expect(vi.getTimerCount()).toBe(1);
    expect(document.getElementById("ad-ext_next-text")).not.toBeNull();

    await takeout();
    await takeout();
    expect(vi.getTimerCount()).toBe(1);
    mod.nextPlayerOnTakeOutStuckOnRemove();
  });

  it("A: Normalverhalten bleibt — Countdown läuft ab und klickt Next genau einmal, dann bleibt kein Timer", async () => {
    const mod = await loadModule();
    const click = vi.spyOn(nextBtn, "click");
    await mod.nextPlayerOnTakeOutStuck();
    await takeout();
    await vi.advanceTimersByTimeAsync(5000);
    expect(click).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    mod.nextPlayerOnTakeOutStuckOnRemove();
  });

  it("B: OnRemove stoppt den laufenden Timer, entfernt das Span und klickt nie mehr", async () => {
    const mod = await loadModule();
    const click = vi.spyOn(nextBtn, "click");
    await mod.nextPlayerOnTakeOutStuck();
    await takeout();
    expect(vi.getTimerCount()).toBe(1);

    mod.nextPlayerOnTakeOutStuckOnRemove();
    expect(vi.getTimerCount()).toBe(0);
    expect(document.getElementById("ad-ext_next-text")).toBeNull();
    expect(h.watchers[0].unwatch).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(10_000);
    expect(click).not.toHaveBeenCalled();
  });

  it("C: OnRemove während des ersten await (Config) — das alte Setup registriert danach weder Watcher noch Handler", async () => {
    const mod = await loadModule();
    const cfg = deferred<any>();
    h.config.value = () => cfg.promise;

    const setup = mod.nextPlayerOnTakeOutStuck();
    mod.nextPlayerOnTakeOutStuckOnRemove();
    cfg.resolve({ nextPlayerOnTakeOutStuck: { enabled: true, sec: 5 } });
    await setup;

    expect(h.watchers).toHaveLength(0);
    expect(addSpy.mock.calls.filter(([t]) => t === "click" || t === "fullscreenchange")).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("C: Watcher-Callback, der nach OnRemove aus getValue zurückkehrt, startet keinen Timer", async () => {
    const mod = await loadModule();
    await mod.nextPlayerOnTakeOutStuck();
    const gd = deferred<any>();
    h.gameData.value = () => gd.promise;

    const pending = takeout();
    mod.nextPlayerOnTakeOutStuckOnRemove();
    gd.resolve({ match: { variant: "X01" } });
    await pending;
    await flush();

    expect(vi.getTimerCount()).toBe(0);
    expect(document.getElementById("ad-ext_next-text")).toBeNull();
  });

  it("C: Watcher-Callback, der nach OnRemove aus waitForElement zurückkehrt, startet keinen Timer", async () => {
    const mod = await loadModule();
    await mod.nextPlayerOnTakeOutStuck();
    const btn = deferred<HTMLElement>();
    h.waitForButton = () => btn.promise;

    const pending = takeout();
    await flush();
    mod.nextPlayerOnTakeOutStuckOnRemove();
    btn.resolve(nextBtn);
    await pending;
    await flush();

    expect(vi.getTimerCount()).toBe(0);
    expect(document.getElementById("ad-ext_next-text")).toBeNull();
  });

  it("D: wiederholtes Setup/Remove akkumuliert weder Timer noch Watcher noch Document-Listener", async () => {
    const mod = await loadModule();
    const removeSpy = vi.spyOn(document, "removeEventListener");

    for (let i = 0; i < 3; i++) {
      await mod.nextPlayerOnTakeOutStuck();
      await takeout(i);
      expect(vi.getTimerCount()).toBe(1);
      mod.nextPlayerOnTakeOutStuckOnRemove();
      expect(vi.getTimerCount()).toBe(0);
    }

    expect(h.watchers).toHaveLength(3);
    h.watchers.forEach(w => expect(w.unwatch).toHaveBeenCalledTimes(1));
    const added = (t: string) => addSpy.mock.calls.filter(([n]) => n === t).length;
    const removed = (t: string) => removeSpy.mock.calls.filter(([n]) => n === t).length;
    expect(added("click")).toBe(3);
    expect(removed("click")).toBe(3);
    expect(added("fullscreenchange")).toBe(3);
    expect(removed("fullscreenchange")).toBe(3);
  });

  it("D: erneutes Setup ohne Remove ersetzt den alten Watcher und lässt höchstens einen Timer zu", async () => {
    const mod = await loadModule();
    await mod.nextPlayerOnTakeOutStuck();
    await takeout(0);
    await mod.nextPlayerOnTakeOutStuck();
    expect(h.watchers[0].unwatch).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    await takeout(1);
    expect(vi.getTimerCount()).toBe(1);
    expect(addSpy.mock.calls.filter(([t]) => t === "click")).toHaveLength(1);
    mod.nextPlayerOnTakeOutStuckOnRemove();
  });
});
