/**
 * Phase 5A — Lifecycle-/Watcher-Cleanup-Tests: CcPerformanceStrip.vue.
 *
 * Selbes Vorgehen wie CcHeroBand.component.test.ts / CcSystemStatusFooter.
 * component.test.ts: echte Komponente via @vue/test-utils + happy-dom,
 * `useControlCenterStatus()` gemockt (nur `myUserId` wird gebraucht), der
 * komponenteneigene Lifecycle-Kreislauf (onMounted→loadResults()→disposed-
 * Guard→AutodartsToolsCanonicalMatchResults.watch(...); onBeforeUnmount→
 * unwatch()) läuft über das ECHTE `utils/canonical-match-result-storage.ts`
 * + `utils/canonical-match-result.ts` (Protected Core — hier nur GELESEN,
 * nicht verändert), angetrieben vom bestehenden
 * `tests/support/wxt-globals-mock.ts` (`installWxtGlobals()`, unverändert).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";

import { installWxtGlobals, type MockStorageHandle } from "../support/wxt-globals-mock";

import { CMR_SCHEMA_VERSION, type ICanonicalMatchResult } from "@/utils/canonical-match-result";

const statusHolder = vi.hoisted(() => ({ current: null as unknown as Record<string, unknown> }));

vi.mock("@/composables/useControlCenterStatus", () => ({
  useControlCenterStatus: () => statusHolder.current,
}));

const handle: MockStorageHandle = installWxtGlobals();

const { AutodartsToolsCanonicalMatchResults } = await import("@/utils/canonical-match-result-storage");
const CcPerformanceStrip = (await import("../../components/ControlCenter/CcPerformanceStrip.vue")).default;

function makeStatus(overrides: Record<string, unknown> = {}) {
  return {
    myUserId: ref<string | null>(null),
    ...overrides,
  };
}

function makeRecord(overrides: Partial<ICanonicalMatchResult> = {}): ICanonicalMatchResult {
  return {
    schemaVersion: CMR_SCHEMA_VERSION,
    matchId: `m-${Math.random()}`,
    revision: 1,
    quality: "COMPLETE",
    recordedAt: "2026-08-28T10:00:00.000Z",
    finished: true,
    players: [],
    ...overrides,
  };
}

function storeWith(...records: ICanonicalMatchResult[]) {
  return { version: CMR_SCHEMA_VERSION, records };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

describe("CcPerformanceStrip.vue — Lifecycle/Watcher-Cleanup (Phase 5A)", () => {
  beforeEach(() => {
    handle.reset();
    statusHolder.current = makeStatus();
    vi.restoreAllMocks();
  });

  it("1. mountet ohne Fehler und zeigt die geladenen Match-Ergebnisse aus local:canonical-match-results-v1", async () => {
    handle.seed("canonical-match-results-v1", storeWith(makeRecord()));

    const wrapper = mount(CcPerformanceStrip);
    await flushPromises();
    expect(wrapper.find('[data-testid="cc-perfstrip"]').exists()).toBe(true);
    expect(wrapper.find(".cc-empty").exists()).toBe(false);
    expect(wrapper.findAll(".cc-perfstrip-stat")).toHaveLength(1); // nur "Matches" (kein Average/180/Checkout gemeldet)
    expect(wrapper.find(".cc-perfstrip-stat .v").text()).toBe("1");
    wrapper.unmount();
  });

  it("2. registriert nach erfolgreichem Load genau EINEN Watcher, der auf Storage-Änderungen reagiert", async () => {
    const watchSpy = vi.spyOn(AutodartsToolsCanonicalMatchResults, "watch");
    handle.seed("canonical-match-results-v1", storeWith()); // leer

    const wrapper = mount(CcPerformanceStrip);
    await flushPromises();
    expect(watchSpy).toHaveBeenCalledTimes(1);
    expect(wrapper.find(".cc-empty").exists()).toBe(true);

    await AutodartsToolsCanonicalMatchResults.setValue(storeWith(makeRecord()));
    await flushPromises();
    expect(wrapper.find(".cc-empty").exists()).toBe(false);
    expect(wrapper.find(".cc-perfstrip-stat .v").text()).toBe("1");

    wrapper.unmount();
  });

  it("3. Unmount deregistriert den Watcher — eine spätere Storage-Änderung löst KEINEN weiteren getValue()-Aufruf mehr aus", async () => {
    const getValueSpy = vi.spyOn(AutodartsToolsCanonicalMatchResults, "getValue");
    handle.seed("canonical-match-results-v1", storeWith());

    const wrapper = mount(CcPerformanceStrip);
    await flushPromises();
    const callsAfterMount = getValueSpy.mock.calls.length;

    await AutodartsToolsCanonicalMatchResults.setValue(storeWith(makeRecord()));
    await flushPromises();
    expect(getValueSpy.mock.calls.length).toBe(callsAfterMount + 1);

    wrapper.unmount();

    await AutodartsToolsCanonicalMatchResults.setValue(storeWith(makeRecord(), makeRecord()));
    await flushPromises();
    expect(getValueSpy.mock.calls.length).toBe(callsAfterMount + 1); // unverändert → kein Leak
  });

  it("4. wiederholtes Mount → Unmount → Mount → Unmount akkumuliert keine Watcher", async () => {
    const getValueSpy = vi.spyOn(AutodartsToolsCanonicalMatchResults, "getValue");
    handle.seed("canonical-match-results-v1", storeWith());

    const wrapperA = mount(CcPerformanceStrip);
    await flushPromises();
    wrapperA.unmount();

    const wrapperB = mount(CcPerformanceStrip);
    await flushPromises();
    const callsAfterSecondMount = getValueSpy.mock.calls.length;

    await AutodartsToolsCanonicalMatchResults.setValue(storeWith(makeRecord()));
    await flushPromises();
    // Genau EIN zusätzlicher Aufruf (durch wrapperB) — wäre wrapperA's
    // Watcher geleakt, wären es zwei.
    expect(getValueSpy.mock.calls.length).toBe(callsAfterSecondMount + 1);
    expect(wrapperB.find(".cc-perfstrip-stat .v").text()).toBe("1");

    wrapperB.unmount();
  });

  it("5. Race: Unmount VOR Promise-Resolve verhindert die Watcher-Registrierung (disposed-Guard)", async () => {
    const deferred = createDeferred<ReturnType<typeof storeWith>>();
    const getValueSpy = vi.spyOn(AutodartsToolsCanonicalMatchResults, "getValue").mockImplementationOnce(() => deferred.promise);
    const watchSpy = vi.spyOn(AutodartsToolsCanonicalMatchResults, "watch");

    const wrapper = mount(CcPerformanceStrip);
    wrapper.unmount();

    deferred.resolve(storeWith(makeRecord()));
    await flushPromises();

    expect(getValueSpy).toHaveBeenCalledTimes(1);
    expect(watchSpy).not.toHaveBeenCalled();
  });
});
