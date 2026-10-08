/**
 * UI-2E K2-A – Retry-Aktion im Fehlerhinweis der aktiv gerenderten Ansicht CcTraining.
 *
 * Geprüft wird das Verhalten, nicht die DOM-Reihenfolge: Im Zustand `unavailable` gibt es einen echten
 * <button> (kein <a href="#">) mit der zentralen Klasse `cc-retry`; ein Klick ruft `loadProgress` genau
 * einmal auf. In `loading`, `no_data` und im Normalzustand wird keine Retry-Aktion gezeigt.
 * `identity_unknown` kennt CcTraining nicht (keine Nutzer-ID-Abhängigkeit) und ist hier nicht anwendbar.
 * CcDashboardSummary wird in der Produktion nicht gerendert und ist nicht Teil von K2-A.
 * Enter/Leertaste kommen von der nativen Button-Semantik (kein eigener Key-Handler).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";

import { installWxtGlobals, type MockStorageHandle } from "../support/wxt-globals-mock";

const statusHolder = vi.hoisted(() => ({ current: null as unknown as Record<string, unknown> }));

vi.mock("@/composables/useControlCenterStatus", () => ({
  useControlCenterStatus: () => statusHolder.current,
}));

const handle: MockStorageHandle = installWxtGlobals();

const { AutodartsToolsTrainingHistory, AutodartsToolsTrainingProgress } = await import("@/utils/storage");
const CcTraining = (await import("../../components/ControlCenter/views/CcTraining.vue")).default;

function makeStatus() {
  return {
    myUserId: ref<string | null>(null),
    liveness: ref("unknown"),
    hasBoardSignal: ref(false),
    boardStatusLabel: ref(""),
    boardTone: ref("neutral"),
    connectionLabel: ref(""),
    connectionHint: ref(""),
    lastSignalAgo: ref(""),
  };
}

const RETRY = "button.cc-retry";

beforeEach(() => {
  handle.reset();
  statusHolder.current = makeStatus();
  vi.restoreAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("CcTraining – Retry im Fehlerzustand", () => {
  const mountTraining = () => mount(CcTraining, { global: { provide: { "cc-notification": () => {} } } });

  it("Fortschritt nicht verfügbar: <button class=cc-retry>, Klick lädt den Fortschritt genau einmal neu", async () => {
    const progress = vi.spyOn(AutodartsToolsTrainingProgress, "getValue").mockRejectedValueOnce(new Error("boom"));
    const history = vi.spyOn(AutodartsToolsTrainingHistory, "getValue");
    const wrapper = mountTraining();
    await flushPromises();

    const button = wrapper.get('[data-testid="cc-retry-progress"]');
    expect(button.element.tagName).toBe("BUTTON");
    expect(button.classes()).toContain("cc-retry");
    expect(button.attributes("type")).toBe("button");
    expect(button.attributes("href")).toBeUndefined();
    expect(button.attributes("style")).toBeUndefined();

    const progressBefore = progress.mock.calls.length;
    const historyBefore = history.mock.calls.length;
    await button.trigger("click");
    await flushPromises();

    expect(progress.mock.calls.length).toBe(progressBefore + 1);
    expect(history.mock.calls.length).toBe(historyBefore);
    expect(wrapper.find('[data-testid="cc-retry-progress"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("loading: kein Retry", async () => {
    vi.spyOn(AutodartsToolsTrainingProgress, "getValue").mockReturnValue(new Promise(() => {}));
    const wrapper = mountTraining();
    await flushPromises();
    expect(wrapper.text()).toContain("Lädt");
    expect(wrapper.find(RETRY).exists()).toBe(false);
    wrapper.unmount();
  });

  it("no_data: kein Retry", async () => {
    vi.spyOn(AutodartsToolsTrainingProgress, "getValue").mockResolvedValue({});
    const wrapper = mountTraining();
    await flushPromises();
    expect(wrapper.text()).not.toContain("Fortschritt nicht verfügbar");
    expect(wrapper.find(RETRY).exists()).toBe(false);
    wrapper.unmount();
  });

  it("Normalzustand mit Fortschrittsdaten: kein Retry", async () => {
    vi.spyOn(AutodartsToolsTrainingProgress, "getValue").mockResolvedValue({ "ex-1": {} } as never);
    const wrapper = mountTraining();
    await flushPromises();
    expect(wrapper.text()).not.toContain("Fortschritt nicht verfügbar");
    expect(wrapper.find(RETRY).exists()).toBe(false);
    wrapper.unmount();
  });
});
