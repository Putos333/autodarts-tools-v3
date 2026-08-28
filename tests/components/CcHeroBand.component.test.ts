/**
 * Phase 5A — Lifecycle-/Watcher-Cleanup-Tests: CcHeroBand.vue.
 *
 * Mountet die ECHTE Komponente (nicht nachgebaut) via @vue/test-utils +
 * happy-dom, genau wie CcMatchHero.component.test.ts (Phase 4).
 * `useControlCenterStatus()` wird gemockt (dieselbe Daten-Schicht-Isolation)
 * — die Komponente hält aber ZUSÄTZLICH einen EIGENEN Lifecycle-Kreislauf:
 *
 *   onMounted(async) → loadGlobalStatus() → disposed-Guard →
 *   AutodartsToolsGlobalStatus.watch(...)
 *   onBeforeUnmount → disposed = true → unwatch()
 *
 * Genau DAS ist hier der Prüfgegenstand (Phase-5-Audit-Empfehlung 5A) — über
 * das ECHTE `utils/storage.ts` (keine Nachbildung der Storage-Schicht),
 * angetrieben durch den bereits bestehenden, unveränderten Storage-Contract-
 * Mock `tests/support/wxt-globals-mock.ts` (`installWxtGlobals()`), der
 * bereits produktiv für `tests/ai-commentator-identity.test.ts` denselben
 * Zweck erfüllt.
 *
 * Beobachtungstechnik für "kein Leak": Call-Count auf
 * `AutodartsToolsGlobalStatus.getValue` (von `loadGlobalStatus()` ausgelöst)
 * vor/nach `unmount()` bei einer weiteren Storage-Änderung. Bleibt der Call-
 * Count nach dem Unmount unverändert, ist der Watcher nachweislich
 * deregistriert — ganz ohne Zugriff auf die nicht-exportierte, interne
 * Callback-Closure der Komponente.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";

import { installWxtGlobals, type MockStorageHandle } from "../support/wxt-globals-mock";

import type { IGlobalStatus } from "@/utils/storage";

const statusHolder = vi.hoisted(() => ({ current: null as unknown as Record<string, unknown> }));

vi.mock("@/composables/useControlCenterStatus", () => ({
  useControlCenterStatus: () => statusHolder.current,
}));

// Muss VOR jedem `await import("@/utils/storage")`/Komponenten-Import stehen
// — Modul-Top-Level-Auswertung liest `storage`/`browser` bereits beim Laden
// (siehe Kommentar in wxt-globals-mock.ts).
const handle: MockStorageHandle = installWxtGlobals();

const { AutodartsToolsGlobalStatus } = await import("@/utils/storage");
const CcHeroBand = (await import("../../components/ControlCenter/CcHeroBand.vue")).default;

function makeStatus(overrides: Record<string, unknown> = {}) {
  return {
    hasMatch: ref(false),
    matchFinished: ref(false),
    hasBoardSignal: ref(true),
    boardData: ref({ connected: true }),
    boardTone: ref("ok"),
    liveness: ref("live"),
    openableMatchId: ref(null),
    openableLobbyId: ref(null),
    autodartsOrigin: ref("https://play.autodarts.io"),
    ...overrides,
  };
}

function globalStatus(name: string): IGlobalStatus {
  return { isFirstStart: false, user: { name }, auth: { token: "" } };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

describe("CcHeroBand.vue — Lifecycle/Watcher-Cleanup (Phase 5A)", () => {
  beforeEach(() => {
    handle.reset();
    statusHolder.current = makeStatus();
    vi.restoreAllMocks();
  });

  it("1. mountet ohne Fehler und zeigt den geladenen Namen aus local:globalstatus", async () => {
    handle.seed("globalstatus", globalStatus("Elite Spieler"));

    const wrapper = mount(CcHeroBand);
    await flushPromises();
    expect(wrapper.find('[data-testid="cc-herobar"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cc-herobar-player"]').text()).toBe("Elite Spieler");
    wrapper.unmount();
  });

  it("2. registriert nach erfolgreichem Load genau EINEN Watcher, der auf Storage-Änderungen reagiert", async () => {
    const watchSpy = vi.spyOn(AutodartsToolsGlobalStatus, "watch");
    handle.seed("globalstatus", globalStatus("Erst-Name"));

    const wrapper = mount(CcHeroBand);
    await flushPromises();
    expect(watchSpy).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-testid="cc-herobar-player"]').text()).toBe("Erst-Name");

    await AutodartsToolsGlobalStatus.setValue(globalStatus("Neuer Name"));
    await flushPromises();
    expect(wrapper.find('[data-testid="cc-herobar-player"]').text()).toBe("Neuer Name");

    wrapper.unmount();
  });

  it("3. Unmount deregistriert den Watcher — eine spätere Storage-Änderung löst KEINEN weiteren getValue()-Aufruf mehr aus", async () => {
    const getValueSpy = vi.spyOn(AutodartsToolsGlobalStatus, "getValue");
    handle.seed("globalstatus", globalStatus("A"));

    const wrapper = mount(CcHeroBand);
    await flushPromises();
    const callsAfterMount = getValueSpy.mock.calls.length; // 1 initialer Load

    await AutodartsToolsGlobalStatus.setValue(globalStatus("B"));
    await flushPromises();
    expect(getValueSpy.mock.calls.length).toBe(callsAfterMount + 1); // Watcher hat reagiert

    wrapper.unmount();

    await AutodartsToolsGlobalStatus.setValue(globalStatus("C"));
    await flushPromises();
    expect(getValueSpy.mock.calls.length).toBe(callsAfterMount + 1); // unverändert → kein Leak
  });

  it("4. wiederholtes Mount → Unmount → Mount → Unmount akkumuliert keine Watcher", async () => {
    const getValueSpy = vi.spyOn(AutodartsToolsGlobalStatus, "getValue");
    handle.seed("globalstatus", globalStatus("A"));

    const wrapperA = mount(CcHeroBand);
    await flushPromises();
    wrapperA.unmount();

    const wrapperB = mount(CcHeroBand);
    await flushPromises();
    const callsAfterSecondMount = getValueSpy.mock.calls.length;

    await AutodartsToolsGlobalStatus.setValue(globalStatus("D"));
    await flushPromises();
    // Genau EIN zusätzlicher Aufruf (durch wrapperB) — wäre wrapperA's
    // Watcher geleakt, wären es zwei (akkumulierter Watcher).
    expect(getValueSpy.mock.calls.length).toBe(callsAfterSecondMount + 1);
    expect(wrapperB.find('[data-testid="cc-herobar-player"]').text()).toBe("D");

    wrapperB.unmount();
  });

  it("5. Race: Unmount VOR Promise-Resolve verhindert die Watcher-Registrierung (disposed-Guard)", async () => {
    const deferred = createDeferred<IGlobalStatus>();
    const getValueSpy = vi.spyOn(AutodartsToolsGlobalStatus, "getValue").mockImplementationOnce(() => deferred.promise);
    const watchSpy = vi.spyOn(AutodartsToolsGlobalStatus, "watch");

    const wrapper = mount(CcHeroBand);
    // Unmount, WÄHREND der erste getValue()-Aufruf noch offen (unresolved) ist.
    wrapper.unmount();

    deferred.resolve(globalStatus("Zu spät"));
    await flushPromises();

    expect(getValueSpy).toHaveBeenCalledTimes(1); // Load selbst lief noch durch (kein Crash, keine Exception)
    expect(watchSpy).not.toHaveBeenCalled(); // aber NIE registriert — kein geleakter Watcher
  });
});
