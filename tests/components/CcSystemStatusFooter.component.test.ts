/**
 * Phase 5A — Lifecycle-/Watcher-Cleanup-Tests: CcSystemStatusFooter.vue.
 *
 * Selbes Vorgehen wie CcHeroBand.component.test.ts: echte Komponente via
 * @vue/test-utils + happy-dom, `useControlCenterStatus()` gemockt, aber der
 * komponenteneigene Lifecycle-Kreislauf (onMounted→loadConfig()→disposed-
 * Guard→AutodartsToolsConfig.watch(...); onBeforeUnmount→unwatch()) läuft
 * über das ECHTE `utils/storage.ts`, angetrieben vom bestehenden
 * `tests/support/wxt-globals-mock.ts` (`installWxtGlobals()`, unverändert).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";

import { installWxtGlobals, type MockStorageHandle } from "../support/wxt-globals-mock";

import type { IConfig } from "@/utils/storage";

const statusHolder = vi.hoisted(() => ({ current: null as unknown as Record<string, unknown> }));

vi.mock("@/composables/useControlCenterStatus", () => ({
  useControlCenterStatus: () => statusHolder.current,
}));

const handle: MockStorageHandle = installWxtGlobals();

const { AutodartsToolsConfig, defaultConfig } = await import("@/utils/storage");
const CcSystemStatusFooter = (await import("../../components/ControlCenter/CcSystemStatusFooter.vue")).default;

function makeStatus(overrides: Record<string, unknown> = {}) {
  return {
    hasBoardSignal: ref(true),
    boardData: ref({ connected: true }),
    liveness: ref("live"),
    ...overrides,
  };
}

function configWith(wledEnabled: boolean, callerEnabled: boolean): IConfig {
  return {
    ...defaultConfig,
    wledFx: { ...defaultConfig.wledFx, enabled: wledEnabled },
    caller: { ...defaultConfig.caller, enabled: callerEnabled },
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

describe("CcSystemStatusFooter.vue — Lifecycle/Watcher-Cleanup (Phase 5A)", () => {
  beforeEach(() => {
    handle.reset();
    statusHolder.current = makeStatus();
    vi.restoreAllMocks();
  });

  it("1. mountet ohne Fehler und zeigt den geladenen Config-Stand aus local:config-2-0-0", async () => {
    handle.seed("config-2-0-0", configWith(true, false));

    const wrapper = mount(CcSystemStatusFooter);
    await flushPromises();
    expect(wrapper.find('[data-testid="cc-system-strip"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cc-sys-wled"] b').text()).toBe("aktiviert");
    expect(wrapper.find('[data-testid="cc-sys-caller"] b').text()).toBe("deaktiviert");
    wrapper.unmount();
  });

  it("2. registriert nach erfolgreichem Load genau EINEN Watcher, der auf Storage-Änderungen reagiert", async () => {
    const watchSpy = vi.spyOn(AutodartsToolsConfig, "watch");
    handle.seed("config-2-0-0", configWith(false, false));

    const wrapper = mount(CcSystemStatusFooter);
    await flushPromises();
    expect(watchSpy).toHaveBeenCalledTimes(1);
    expect(wrapper.find('[data-testid="cc-sys-wled"] b').text()).toBe("deaktiviert");

    await AutodartsToolsConfig.setValue(configWith(true, true));
    await flushPromises();
    expect(wrapper.find('[data-testid="cc-sys-wled"] b').text()).toBe("aktiviert");
    expect(wrapper.find('[data-testid="cc-sys-caller"] b').text()).toBe("aktiviert");

    wrapper.unmount();
  });

  it("3. Unmount deregistriert den Watcher — eine spätere Storage-Änderung löst KEINEN weiteren getValue()-Aufruf mehr aus", async () => {
    const getValueSpy = vi.spyOn(AutodartsToolsConfig, "getValue");
    handle.seed("config-2-0-0", configWith(false, false));

    const wrapper = mount(CcSystemStatusFooter);
    await flushPromises();
    const callsAfterMount = getValueSpy.mock.calls.length;

    await AutodartsToolsConfig.setValue(configWith(true, false));
    await flushPromises();
    expect(getValueSpy.mock.calls.length).toBe(callsAfterMount + 1);

    wrapper.unmount();

    await AutodartsToolsConfig.setValue(configWith(true, true));
    await flushPromises();
    expect(getValueSpy.mock.calls.length).toBe(callsAfterMount + 1); // unverändert → kein Leak
  });

  it("4. wiederholtes Mount → Unmount → Mount → Unmount akkumuliert keine Watcher", async () => {
    const getValueSpy = vi.spyOn(AutodartsToolsConfig, "getValue");
    handle.seed("config-2-0-0", configWith(false, false));

    const wrapperA = mount(CcSystemStatusFooter);
    await flushPromises();
    wrapperA.unmount();

    const wrapperB = mount(CcSystemStatusFooter);
    await flushPromises();
    const callsAfterSecondMount = getValueSpy.mock.calls.length;

    await AutodartsToolsConfig.setValue(configWith(true, false));
    await flushPromises();
    // Genau EIN zusätzlicher Aufruf (durch wrapperB) — wäre wrapperA's
    // Watcher geleakt, wären es zwei.
    expect(getValueSpy.mock.calls.length).toBe(callsAfterSecondMount + 1);
    expect(wrapperB.find('[data-testid="cc-sys-wled"] b').text()).toBe("aktiviert");

    wrapperB.unmount();
  });

  it("5. Race: Unmount VOR Promise-Resolve verhindert die Watcher-Registrierung (disposed-Guard)", async () => {
    const deferred = createDeferred<IConfig>();
    const getValueSpy = vi.spyOn(AutodartsToolsConfig, "getValue").mockImplementationOnce(() => deferred.promise);
    const watchSpy = vi.spyOn(AutodartsToolsConfig, "watch");

    const wrapper = mount(CcSystemStatusFooter);
    wrapper.unmount();

    deferred.resolve(configWith(true, true));
    await flushPromises();

    expect(getValueSpy).toHaveBeenCalledTimes(1);
    expect(watchSpy).not.toHaveBeenCalled();
  });
});
