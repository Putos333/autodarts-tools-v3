/**
 * UI-2A — CcShell.vue: Skip-Link, Landmarks, Fokus-Management beim Bereichswechsel.
 *
 * Die Sidebar ist gestubbt (eigener Gegenstand), die Top-Bar ist echt, damit der Fokus tatsächlich auf die
 * Überschrift wandert. `useControlCenterStatus()` ist gemockt.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { ref } from "vue";

import { getCcSection } from "@/components/ControlCenter/sections";

const statusHolder = vi.hoisted(() => ({ current: null as unknown as Record<string, unknown> }));

vi.mock("@/composables/useControlCenterStatus", () => ({
  useControlCenterStatus: () => statusHolder.current,
}));
vi.mock("@/components/ControlCenter/open-autodarts", () => ({
  openAutodarts: vi.fn(),
  openClassicSettings: vi.fn(),
}));

const CcShell = (await import("../../components/ControlCenter/CcShell.vue")).default;

function makeStatus() {
  return {
    connectionLabel: ref("Status unbekannt"),
    connectionTone: ref("idle"),
    connectionHint: ref(""),
    lastSignalAgo: ref(null),
    backendLabel: ref("Backend"),
    backendTone: ref("idle"),
    backendUrl: ref(""),
    isRefreshing: ref(false),
    refresh: vi.fn(),
  };
}

function mountShell() {
  return mount(CcShell, {
    props: { active: "dashboard", section: getCcSection("dashboard"), version: "1.2.3" },
    slots: { default: "<p data-testid=\"view\">Ansicht</p>" },
    global: { stubs: { CcSidebar: true } },
    attachTo: document.body,
  });
}

const afterReady = () => new Promise<void>(resolve => setTimeout(resolve, 5));

describe("CcShell.vue — App-Shell (UI-2A)", () => {
  beforeEach(() => {
    statusHolder.current = makeStatus();
    document.body.innerHTML = "";
    window.location.hash = "#dashboard";
  });

  it("Skip-Link ist das erste Kind der Shell und zeigt auf den Inhalt", () => {
    const wrapper = mountShell();
    const root = wrapper.get(".cc-root").element;
    const skip = wrapper.get("[data-testid=\"cc-skip-link\"]");
    expect(root.firstElementChild).toBe(skip.element);
    expect(skip.element.tagName).toBe("A");
    expect(skip.attributes("href")).toBe("#cc-content");
    wrapper.unmount();
  });

  it("<main> ist Landmark, Fokus-Ziel und trägt die Ansicht", () => {
    const wrapper = mountShell();
    const main = wrapper.get("main");
    expect(main.attributes("id")).toBe("cc-content");
    expect(main.attributes("tabindex")).toBe("-1");
    expect(main.find("[data-testid=\"view\"]").exists()).toBe(true);
    wrapper.unmount();
  });

  it("Skip-Link fokussiert <main> und lässt den Hash-Router unangetastet", async () => {
    const wrapper = mountShell();
    await wrapper.get("[data-testid=\"cc-skip-link\"]").trigger("click");
    expect(document.activeElement).toBe(wrapper.get("main").element);
    expect(window.location.hash).toBe("#dashboard");
    wrapper.unmount();
  });

  it("Bereichswechsel nach dem Erstladen setzt den Fokus auf die Überschrift", async () => {
    const wrapper = mountShell();
    await afterReady();
    await wrapper.setProps({ active: "stats", section: getCcSection("stats") });
    await wrapper.vm.$nextTick();
    const heading = wrapper.get("h1");
    expect(heading.text()).toBe(getCcSection("stats").label);
    expect(document.activeElement).toBe(heading.element);
    wrapper.unmount();
  });

  it("Wechsel direkt beim Erstladen (Hash-Deep-Link) verschiebt den Fokus nicht", async () => {
    const wrapper = mountShell();
    await wrapper.setProps({ active: "stats", section: getCcSection("stats") });
    await wrapper.vm.$nextTick();
    expect(document.activeElement).not.toBe(wrapper.get("h1").element);
    await afterReady();
    expect(document.activeElement).not.toBe(wrapper.get("h1").element);
    wrapper.unmount();
  });

  it("gibt den Navigationswunsch der Sidebar weiter", async () => {
    const wrapper = mountShell();
    wrapper.findComponent({ name: "CcSidebar" }).vm.$emit("navigate", "history");
    expect(wrapper.emitted("navigate")).toEqual([ [ "history" ] ]);
    wrapper.unmount();
  });
});
