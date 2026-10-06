/**
 * UI-2A — CcTopBar.vue: Header-Struktur, zugängliche Namen, Fokus-Ziel.
 *
 * Echte Komponente via @vue/test-utils + happy-dom. `useControlCenterStatus()` und die Öffnen-Aktionen sind gemockt
 * (der Composable ist ein Refcount-Singleton mit Storage/WebSocket-Anbindung, hier nicht Gegenstand).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

import { getCcSection } from "@/components/ControlCenter/sections";

const statusHolder = vi.hoisted(() => ({ current: null as unknown as Record<string, unknown> }));
const openActions = vi.hoisted(() => ({ openAutodarts: vi.fn(), openClassicSettings: vi.fn() }));

vi.mock("@/composables/useControlCenterStatus", () => ({
  useControlCenterStatus: () => statusHolder.current,
}));
vi.mock("@/components/ControlCenter/open-autodarts", () => openActions);

const CcTopBar = (await import("../../components/ControlCenter/CcTopBar.vue")).default;

function makeStatus(overrides: Record<string, unknown> = {}) {
  return {
    connectionLabel: ref("Status unbekannt"),
    connectionTone: ref("idle"),
    connectionHint: ref("Kein Signal"),
    lastSignalAgo: ref(null),
    backendLabel: ref("KI-Backend nicht erreichbar"),
    backendTone: ref("bad"),
    backendUrl: ref("https://backend.invalid"),
    isRefreshing: ref(false),
    refresh: vi.fn(),
    ...overrides,
  };
}

function mountTopBar() {
  return mount(CcTopBar, {
    props: { section: getCcSection("stats"), version: "1.2.3" },
    attachTo: document.body,
  });
}

describe("CcTopBar.vue — Header (UI-2A)", () => {
  beforeEach(() => {
    statusHolder.current = makeStatus();
    openActions.openAutodarts.mockClear();
    openActions.openClassicSettings.mockClear();
    document.body.innerHTML = "";
  });

  it("zeigt den Bereichstitel als einzige h1 und als programmatisches Fokus-Ziel (tabindex=-1)", () => {
    const wrapper = mountTopBar();
    const headings = wrapper.findAll("h1");
    expect(headings).toHaveLength(1);
    expect(headings[0].text()).toBe(getCcSection("stats").label);
    expect(headings[0].attributes("tabindex")).toBe("-1");
    wrapper.unmount();
  });

  it("focusHeading() setzt den Fokus auf die Überschrift", () => {
    const wrapper = mountTopBar();
    (wrapper.vm as unknown as { focusHeading: () => void }).focusHeading();
    expect(document.activeElement).toBe(wrapper.get("h1").element);
    wrapper.unmount();
  });

  it("drei Aktionen mit sichtbarem Text als zugänglichem Namen — kein aria-label-Override (WCAG 2.5.3)", () => {
    const wrapper = mountTopBar();
    const buttons = wrapper.findAll(".cc-topbar-actions button");
    expect(buttons.map(button => button.text())).toEqual([ "Aktualisieren", "Autodarts öffnen", "Klassische Ansicht" ]);
    for (const button of buttons) {
      expect(button.attributes("aria-label")).toBeUndefined();
      expect(button.find(".cc-btn-label").exists()).toBe(true);
      // Icons sind dekorativ.
      expect(button.find("span[aria-hidden=\"true\"]").exists()).toBe(true);
    }
    wrapper.unmount();
  });

  it("Aktionen lösen die erwarteten Funktionen aus", async () => {
    const wrapper = mountTopBar();
    await wrapper.get("[data-testid=\"cc-open-autodarts\"]").trigger("click");
    await wrapper.get("[data-testid=\"cc-open-classic\"]").trigger("click");
    await wrapper.get("[data-testid=\"cc-refresh\"]").trigger("click");
    expect(openActions.openAutodarts).toHaveBeenCalledTimes(1);
    expect(openActions.openClassicSettings).toHaveBeenCalledTimes(1);
    expect((statusHolder.current.refresh as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it("während des Ladens: Label \"Lädt\" und Aktualisieren deaktiviert", () => {
    statusHolder.current = makeStatus({ isRefreshing: ref(true) });
    const wrapper = mountTopBar();
    const refresh = wrapper.get("[data-testid=\"cc-refresh\"]");
    expect(refresh.text()).toBe("Lädt");
    expect(refresh.attributes("disabled")).toBeDefined();
    wrapper.unmount();
  });

  it("beide Status-Pills bleiben im Header", () => {
    const wrapper = mountTopBar();
    const pills = wrapper.findAll(".cc-topbar-status .cc-pill");
    expect(pills.map(pill => pill.text())).toEqual([ "Status unbekannt", "KI-Backend nicht erreichbar" ]);
    wrapper.unmount();
  });
});
