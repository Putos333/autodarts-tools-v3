/**
 * ELO-Consent-UI (components/Settings/PrecisionMap.vue): Der Nutzer muss
 * ausdrücklich zustimmen oder ablehnen. Schließen des Dialogs ohne Auswahl
 * ändert nichts (Zustand bleibt "unknown"), und ohne Zustimmung entsteht
 * keine einzige Anfrage an das ELO-Backend.
 *
 * Getestet wird die ECHTE Komponente gegen die WXT-Globals-Nachbildung; der
 * einzige Netzwerkpfad ist `browser.runtime.sendMessage` (FETCH_JSON), er
 * wird durch einen Spy ersetzt. Nur die IndexedDB-Zugriffe der
 * Heatmap-Speicherung werden ersetzt (in happy-dom nicht verfügbar).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { defineComponent, h, Suspense } from "vue";

import { installWxtGlobals, type MockStorageHandle } from "../support/wxt-globals-mock";

// Muss VOR jedem Import von @/utils/storage / der Komponente laufen.
const handle: MockStorageHandle = installWxtGlobals();

vi.mock("@/utils/heatmap-storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../utils/heatmap-storage")>();
  return {
    ...actual,
    getThrows: async () => [],
    countThrows: async () => 0,
    clearHeatmap: async () => {},
  };
});

const CONSENT_KEY = "adt-elo-consent";

interface Sent { type: string; payload: { url: string; method: string } }
let sendMessage: ReturnType<typeof vi.fn>;
let wrapper: VueWrapper | null = null;

function calledUrls(): string[] {
  return sendMessage.mock.calls.map(c => (c[0] as Sent).payload.url);
}

async function settle(): Promise<void> {
  await flushPromises();
  await flushPromises();
}

async function mountPanel(): Promise<VueWrapper> {
  const { default: PrecisionMap } = await import("../../components/Settings/PrecisionMap.vue");
  const Host = defineComponent({
    setup() {
      return () => h(Suspense, null, { default: () => h(PrecisionMap) });
    },
  });
  wrapper = mount(Host, { attachTo: document.body });
  await settle();
  return wrapper;
}

function byId(id: string) {
  return wrapper!.find(`[data-testid="${id}"]`);
}

beforeEach(async () => {
  handle.reset();
  sendMessage = vi.fn(async (msg: Sent) => {
    if (msg.payload.url.includes("/api/elo/leaderboard")) return { ok: true, status: 200, data: [] };
    if (msg.payload.url.includes("/api/elo/me/")) return { ok: true, status: 200, data: null };
    return { ok: false, status: 404, data: null };
  });
  (globalThis as any).browser.runtime.sendMessage = sendMessage;

  // defaultConfig ist ein geteiltes Modul-Objekt und wird von v-model mutiert.
  const { defaultConfig } = await import("../../utils/storage");
  defaultConfig.elo.enabled = true;
  defaultConfig.elo.submitEnabled = true;
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  document.body.innerHTML = "";
});

describe("ELO-Consent-UI: frische Installation und bestehende Nutzer", () => {
  it("frische Installation: 'Noch nicht entschieden', kein Dialog, keine Anfrage beim Öffnen", async () => {
    await mountPanel();
    expect(byId("elo-consent-status").text()).toBe("Noch nicht entschieden");
    expect(byId("elo-consent-dialog").exists()).toBe(false);
    expect(byId("elo-consent-required").exists()).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(handle.raw(CONSENT_KEY)).toBeUndefined();
  });

  it("bestehender Nutzer mit elo.enabled/submitEnabled=true ohne Consent-Eintrag: keine Anfrage beim Öffnen", async () => {
    const { defaultConfig } = await import("../../utils/storage");
    handle.seed("config-2-0-0", { ...defaultConfig, elo: { ...defaultConfig.elo, enabled: true, submitEnabled: true } });
    await mountPanel();
    expect((byId("elo-submit-toggle").element as HTMLInputElement).checked).toBe(true);
    expect(byId("elo-consent-status").text()).toBe("Noch nicht entschieden");
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe("ELO-Consent-UI: Dialog", () => {
  it("Nutzung der Rangliste ohne Consent öffnet den Dialog und sendet nichts", async () => {
    await mountPanel();
    await byId("elo-refresh").trigger("click");
    await settle();
    expect(byId("elo-consent-dialog").exists()).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("Auto-Senden einschalten ohne Consent öffnet den Dialog, sendet aber nichts", async () => {
    await mountPanel();
    await byId("elo-submit-toggle").setValue(false);
    await settle();
    expect(byId("elo-consent-dialog").exists()).toBe(false);
    await byId("elo-submit-toggle").setValue(true);
    await settle();
    expect(byId("elo-consent-dialog").exists()).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(handle.raw(CONSENT_KEY)).toBeUndefined();
  });

  it("10. Dialog ohne Entscheidung schließen (ESC): Consent bleibt unknown, nichts gesendet", async () => {
    await mountPanel();
    await byId("elo-refresh").trigger("click");
    await settle();
    expect(byId("elo-consent-dialog").exists()).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await settle();

    expect(byId("elo-consent-dialog").exists()).toBe(false);
    expect(byId("elo-consent-status").text()).toBe("Noch nicht entschieden");
    expect(handle.raw(CONSENT_KEY)).toBeUndefined();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("Zustimmen im Dialog speichert accepted, schließt und lädt Rangliste und eigenen Rang", async () => {
    await mountPanel();
    await byId("elo-refresh").trigger("click");
    await settle();
    await byId("elo-dialog-accept").trigger("click");
    await settle();

    expect(handle.raw(CONSENT_KEY)).toMatchObject({ state: "accepted", v: 1 });
    expect(byId("elo-consent-status").text()).toBe("Zugestimmt");
    expect(byId("elo-consent-dialog").exists()).toBe(false);
    const urls = calledUrls();
    expect(urls.some(u => u.includes("/api/elo/leaderboard"))).toBe(true);
    expect(urls.some(u => u.includes("/api/elo/me/"))).toBe(true);
  });

  it("Ablehnen im Dialog speichert declined und sendet nichts", async () => {
    await mountPanel();
    await byId("elo-refresh").trigger("click");
    await settle();
    await byId("elo-dialog-decline").trigger("click");
    await settle();

    expect(handle.raw(CONSENT_KEY)).toMatchObject({ state: "declined", v: 1 });
    expect(byId("elo-consent-status").text()).toBe("Abgelehnt");
    expect(sendMessage).not.toHaveBeenCalled();
  });
});

describe("ELO-Consent-UI: Entscheidung später ändern (Einstellungen)", () => {
  it("Ablehnen im Panel: declined, Ladder-Button deaktiviert, keine Anfrage", async () => {
    await mountPanel();
    await byId("elo-consent-decline").trigger("click");
    await settle();

    expect(handle.raw(CONSENT_KEY)).toMatchObject({ state: "declined" });
    expect(byId("elo-refresh").attributes("disabled")).toBeDefined();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("4. Widerruf: accepted -> declined, danach entsteht keine weitere Anfrage", async () => {
    handle.seed(CONSENT_KEY, { state: "accepted", at: 1, v: 1 });
    await mountPanel();
    expect(byId("elo-consent-status").text()).toBe("Zugestimmt");
    expect(calledUrls().length).toBeGreaterThan(0);

    sendMessage.mockClear();
    await byId("elo-consent-decline").trigger("click");
    await settle();
    expect(byId("elo-consent-status").text()).toBe("Abgelehnt");
    expect(handle.raw(CONSENT_KEY)).toMatchObject({ state: "declined" });

    await byId("elo-refresh").trigger("click");
    await settle();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("5. declined -> accepted im Panel: Übertragung wieder möglich", async () => {
    handle.seed(CONSENT_KEY, { state: "declined", at: 1, v: 1 });
    await mountPanel();
    expect(sendMessage).not.toHaveBeenCalled();

    await byId("elo-consent-accept").trigger("click");
    await settle();
    expect(byId("elo-consent-status").text()).toBe("Zugestimmt");
    expect(calledUrls().some(u => u.includes("/api/elo/leaderboard"))).toBe(true);
  });

  it("ungültiger gespeicherter Consent-Wert wird als 'Noch nicht entschieden' angezeigt und sendet nichts", async () => {
    handle.seed(CONSENT_KEY, { state: "accepted" }); // Version fehlt
    await mountPanel();
    expect(byId("elo-consent-status").text()).toBe("Noch nicht entschieden");
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("Speichern der Entscheidung schlägt fehl: Fehlermeldung, Zustand bleibt unknown, nichts gesendet", async () => {
    await mountPanel();
    const local = (globalThis as any).browser.storage.local;
    const originalSet = local.set;
    local.set = async (items: Record<string, unknown>) => {
      if (CONSENT_KEY in items) throw new Error("quota");
      return originalSet(items);
    };
    try {
      await byId("elo-consent-accept").trigger("click");
      await settle();
    } finally {
      local.set = originalSet;
    }
    expect(byId("elo-consent-error").exists()).toBe(true);
    expect(byId("elo-consent-status").text()).toBe("Noch nicht entschieden");
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
