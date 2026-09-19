/**
 * Phase 5A — Lifecycle-/Watcher-Cleanup-Tests: CcDashboardSummary.vue.
 *
 * Selbes Vorgehen wie die übrigen Phase-5A-Component-Tests: echte Komponente
 * via @vue/test-utils + happy-dom, `useControlCenterStatus()` gemockt (nur
 * `myUserId` wird gebraucht). Diese Komponente ist der einzige der vier
 * Phase-5A-Kandidaten mit ZWEI unabhängigen Storage-Watchern hinter einem
 * gemeinsamen `Promise.all([...])` im selben `onMounted`:
 *
 *   onMounted(async) → await Promise.all([loadResults(), loadTrainingHistory()])
 *     → disposed-Guard → AutodartsToolsCanonicalMatchResults.watch(...)
 *                       → AutodartsToolsTrainingHistory.watch(...)
 *   onBeforeUnmount → disposed = true → beide unwatch()
 *
 * Beide Storage-Items werden über das ECHTE `utils/canonical-match-result-
 * storage.ts` (+ Protected-Core `utils/canonical-match-result.ts`, hier nur
 * gelesen) bzw. `utils/storage.ts` angetrieben — kein Mock der Storage-
 * Schicht selbst, nur der bestehende, unveränderte Contract-Mock
 * `tests/support/wxt-globals-mock.ts` (`installWxtGlobals()`).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";

import { installWxtGlobals, type MockStorageHandle } from "../support/wxt-globals-mock";

import { CMR_SCHEMA_VERSION, type ICanonicalMatchResult } from "@/utils/canonical-match-result";
import type { TrainingSession } from "@/utils/training-history";

const statusHolder = vi.hoisted(() => ({ current: null as unknown as Record<string, unknown> }));

vi.mock("@/composables/useControlCenterStatus", () => ({
  useControlCenterStatus: () => statusHolder.current,
}));

const handle: MockStorageHandle = installWxtGlobals();

const { AutodartsToolsCanonicalMatchResults } = await import("@/utils/canonical-match-result-storage");
const { AutodartsToolsTrainingHistory } = await import("@/utils/storage");
const CcDashboardSummary = (await import("../../components/ControlCenter/CcDashboardSummary.vue")).default;

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

function cmrStoreWith(...records: ICanonicalMatchResult[]) {
  return { version: CMR_SCHEMA_VERSION, records };
}

function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    date: "2026-08-28T10:00:00.000Z",
    average: 45.2,
    count140Plus: 0,
    count180s: 0,
    checkoutMisses: 0,
    checkoutRate: 0,
    goalsReached: 2,
    totalGoals: 3,
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

describe("CcDashboardSummary.vue — Lifecycle/Watcher-Cleanup (Phase 5A)", () => {
  beforeEach(() => {
    handle.reset();
    statusHolder.current = makeStatus();
    vi.restoreAllMocks();
  });

  it("1. mountet ohne Fehler und zeigt Leerzustände, wenn weder Matches noch Training gespeichert sind", async () => {
    const wrapper = mount(CcDashboardSummary);
    await flushPromises();
    expect(wrapper.find('[data-testid="cc-card-dashboard-summary"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Noch keine gespeicherten Matches.");
    expect(wrapper.text()).toContain("Noch keine Trainings-Session gespeichert.");
    wrapper.unmount();
  });

  it("2. registriert nach erfolgreichem Load je EINEN Watcher pro Storage-Item, die beide auf Änderungen reagieren", async () => {
    const cmrWatchSpy = vi.spyOn(AutodartsToolsCanonicalMatchResults, "watch");
    const trainingWatchSpy = vi.spyOn(AutodartsToolsTrainingHistory, "watch");

    const wrapper = mount(CcDashboardSummary);
    await flushPromises();
    expect(cmrWatchSpy).toHaveBeenCalledTimes(1);
    expect(trainingWatchSpy).toHaveBeenCalledTimes(1);

    await AutodartsToolsCanonicalMatchResults.setValue(cmrStoreWith(makeRecord()));
    await AutodartsToolsTrainingHistory.setValue([ makeSession() ]);
    await flushPromises();

    expect(wrapper.text()).not.toContain("Noch keine gespeicherten Matches.");
    expect(wrapper.text()).not.toContain("Noch keine Trainings-Session gespeichert.");
    expect(wrapper.text()).toContain("Freies Training");

    wrapper.unmount();
  });

  it("3. Unmount deregistriert BEIDE Watcher — spätere Storage-Änderungen lösen KEINE weiteren getValue()-Aufrufe mehr aus", async () => {
    const cmrGetValueSpy = vi.spyOn(AutodartsToolsCanonicalMatchResults, "getValue");
    const trainingGetValueSpy = vi.spyOn(AutodartsToolsTrainingHistory, "getValue");

    const wrapper = mount(CcDashboardSummary);
    await flushPromises();
    const cmrCallsAfterMount = cmrGetValueSpy.mock.calls.length;
    const trainingCallsAfterMount = trainingGetValueSpy.mock.calls.length;

    await AutodartsToolsCanonicalMatchResults.setValue(cmrStoreWith(makeRecord()));
    await AutodartsToolsTrainingHistory.setValue([ makeSession() ]);
    await flushPromises();
    expect(cmrGetValueSpy.mock.calls.length).toBe(cmrCallsAfterMount + 1);
    expect(trainingGetValueSpy.mock.calls.length).toBe(trainingCallsAfterMount + 1);

    wrapper.unmount();

    await AutodartsToolsCanonicalMatchResults.setValue(cmrStoreWith(makeRecord(), makeRecord()));
    await AutodartsToolsTrainingHistory.setValue([ makeSession(), makeSession() ]);
    await flushPromises();
    // Unverändert bei BEIDEN Storage-Items → kein Leak in keinem der beiden Watcher.
    expect(cmrGetValueSpy.mock.calls.length).toBe(cmrCallsAfterMount + 1);
    expect(trainingGetValueSpy.mock.calls.length).toBe(trainingCallsAfterMount + 1);
  });

  it("4. wiederholtes Mount → Unmount → Mount → Unmount akkumuliert keine Watcher (für beide Storage-Items)", async () => {
    const cmrGetValueSpy = vi.spyOn(AutodartsToolsCanonicalMatchResults, "getValue");
    const trainingGetValueSpy = vi.spyOn(AutodartsToolsTrainingHistory, "getValue");

    const wrapperA = mount(CcDashboardSummary);
    await flushPromises();
    wrapperA.unmount();

    const wrapperB = mount(CcDashboardSummary);
    await flushPromises();
    const cmrCallsAfterSecondMount = cmrGetValueSpy.mock.calls.length;
    const trainingCallsAfterSecondMount = trainingGetValueSpy.mock.calls.length;

    await AutodartsToolsCanonicalMatchResults.setValue(cmrStoreWith(makeRecord()));
    await AutodartsToolsTrainingHistory.setValue([ makeSession() ]);
    await flushPromises();
    // Je genau EIN zusätzlicher Aufruf (durch wrapperB) — wäre wrapperA's
    // Watcher geleakt, wären es jeweils zwei.
    expect(cmrGetValueSpy.mock.calls.length).toBe(cmrCallsAfterSecondMount + 1);
    expect(trainingGetValueSpy.mock.calls.length).toBe(trainingCallsAfterSecondMount + 1);

    wrapperB.unmount();
  });

  it("5. Race: Unmount VOR Promise.all-Resolve verhindert die Registrierung BEIDER Watcher (disposed-Guard)", async () => {
    const cmrDeferred = createDeferred<ReturnType<typeof cmrStoreWith>>();
    const trainingDeferred = createDeferred<TrainingSession[]>();
    const cmrGetValueSpy = vi.spyOn(AutodartsToolsCanonicalMatchResults, "getValue").mockImplementationOnce(() => cmrDeferred.promise);
    const trainingGetValueSpy = vi.spyOn(AutodartsToolsTrainingHistory, "getValue").mockImplementationOnce(() => trainingDeferred.promise);
    const cmrWatchSpy = vi.spyOn(AutodartsToolsCanonicalMatchResults, "watch");
    const trainingWatchSpy = vi.spyOn(AutodartsToolsTrainingHistory, "watch");

    const wrapper = mount(CcDashboardSummary);
    // Unmount, WÄHREND `Promise.all([loadResults(), loadTrainingHistory()])`
    // noch auf BEIDE Loads wartet.
    wrapper.unmount();

    cmrDeferred.resolve(cmrStoreWith(makeRecord()));
    trainingDeferred.resolve([ makeSession() ]);
    await flushPromises();

    expect(cmrGetValueSpy).toHaveBeenCalledTimes(1); // Loads liefen noch durch (kein Crash)
    expect(trainingGetValueSpy).toHaveBeenCalledTimes(1);
    expect(cmrWatchSpy).not.toHaveBeenCalled(); // aber NIE registriert
    expect(trainingWatchSpy).not.toHaveBeenCalled();
  });
});
