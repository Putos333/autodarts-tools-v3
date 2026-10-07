/**
 * UI-2B — CcSidebar.vue: gruppierte Desktop-Navigation (Semantik, aktiver Zustand, Navigationswunsch).
 *
 * Das Live-Widget ist gestubbt (eigener Gegenstand).
 */

import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";

import {
  CC_SECTION_GROUPS,
  CC_SECTIONS,
  getCcSectionsByGroup,
  isCcSectionId,
} from "@/components/ControlCenter/sections";

// Das Live-Widget zieht WXT-Storage nach sich; die Sidebar prüft hier nur die Navigation.
vi.mock("@/components/ControlCenter/CcLiveMatchWidget.vue", () => ({
  default: { name: "CcLiveMatchWidget", template: "<div />" },
}));

const CcSidebar = (await import("../../components/ControlCenter/CcSidebar.vue")).default;

function mountSidebar(active = "dashboard") {
  return mount(CcSidebar, {
    props: { active: active as never, version: "1.2.3" },
    attachTo: document.body,
  });
}

describe("sections.ts — Gruppen (UI-2B)", () => {
  it("jeder Bereich gehört genau einer bekannten Gruppe an; Gruppen sind nicht leer", () => {
    const groupIds = CC_SECTION_GROUPS.map(group => group.id);
    for (const section of CC_SECTIONS) expect(groupIds).toContain(section.group);
    for (const group of CC_SECTION_GROUPS) expect(getCcSectionsByGroup(group.id).length).toBeGreaterThan(0);
    const grouped = CC_SECTION_GROUPS.flatMap(group => getCcSectionsByGroup(group.id));
    expect(grouped.map(section => section.id).sort()).toEqual(CC_SECTIONS.map(section => section.id).sort());
  });

  it("freigegebene Zuordnung und Routing-IDs bleiben unverändert", () => {
    const byGroup = Object.fromEntries(CC_SECTION_GROUPS.map(group => [
      group.label, getCcSectionsByGroup(group.id).map(section => section.id),
    ]));
    expect(byGroup).toEqual({
      Live: [ "dashboard", "board", "match", "matchcenter" ],
      Spielen: [ "training", "party" ],
      Auswertung: [ "stats", "history" ],
      System: [ "settings" ],
    });
    expect(CC_SECTIONS.map(section => section.id)).toEqual([
      "dashboard", "board", "match", "matchcenter", "training", "party", "stats", "history", "settings",
    ]);
    expect(CC_SECTIONS.every(section => isCcSectionId(section.id))).toBe(true);
  });
});

describe("CcSidebar.vue — Desktop-Navigation (UI-2B)", () => {
  it("gliedert die Navigation in benannte Gruppen mit echten Listen", () => {
    const wrapper = mountSidebar();
    const groups = wrapper.findAll(".cc-nav .cc-nav-group");
    expect(groups.map(group => group.get(".cc-nav-group-label").text())).toEqual([
      "Live", "Spielen", "Auswertung", "System",
    ]);
    for (const group of groups) {
      expect(group.attributes("role")).toBe("group");
      const labelId = group.attributes("aria-labelledby")!;
      expect(group.get(`#${labelId}`).classes()).toContain("cc-nav-group-label");
      expect(group.get("ul").attributes("role")).toBe("list");
    }
    expect(wrapper.findAll(".cc-nav li")).toHaveLength(CC_SECTIONS.length);
  });

  it("alle Bereiche bleiben als Buttons mit Test-ID, Name und sichtbarem Text erreichbar", () => {
    const wrapper = mountSidebar();
    for (const section of CC_SECTIONS) {
      const item = wrapper.get(`[data-testid="cc-nav-${section.id}"]`);
      expect(item.element.tagName).toBe("BUTTON");
      expect(item.attributes("type")).toBe("button");
      expect(item.get(".cc-nav-label").text()).toBe(section.label);
      // title bleibt: in der Icon-Rail (Label ausgeblendet) ist es der zugängliche Name.
      expect(item.attributes("title")).toBe(section.label);
      expect(item.get(".cc-nav-icon span").attributes("aria-hidden")).toBe("true");
    }
  });

  it("markiert genau den aktiven Bereich mit aria-current und is-active", () => {
    const wrapper = mountSidebar("stats");
    const current = wrapper.findAll(".cc-nav [aria-current=\"page\"]");
    expect(current).toHaveLength(1);
    expect(current[0].attributes("data-testid")).toBe("cc-nav-stats");
    expect(wrapper.findAll(".cc-nav .is-active")).toHaveLength(1);
  });

  it("emittiert navigate mit der Section-ID", async () => {
    const wrapper = mountSidebar();
    await wrapper.get("[data-testid=\"cc-nav-history\"]").trigger("click");
    expect(wrapper.emitted("navigate")).toEqual([ [ "history" ] ]);
  });

  it("die mobile Bottom-Navigation führt dieselben Bereiche in derselben Reihenfolge, Gruppierung ist Sache der Sidebar", () => {
    const wrapper = mountSidebar();
    const items = wrapper.findAll(".cc-bottom-nav-item");
    expect(items.map(item => item.attributes("data-testid"))).toEqual(
      CC_SECTIONS.map(section => `cc-bottom-nav-${section.id}`),
    );
    expect(wrapper.find(".cc-bottom-nav .cc-nav-group").exists()).toBe(false);
  });
});

describe("CcSidebar.vue — Bottom-Navigation (UI-2C)", () => {
  it("alle Einträge liegen im Scrollbereich, das Live-Widget bleibt außerhalb", () => {
    const wrapper = mountSidebar();
    const scroller = wrapper.get(".cc-bottom-nav .cc-bottom-nav-scroll");
    expect(scroller.findAll(".cc-bottom-nav-item")).toHaveLength(CC_SECTIONS.length);
    expect(wrapper.findAll(".cc-bottom-nav .cc-bottom-nav-item")).toHaveLength(CC_SECTIONS.length);
    expect(scroller.find(".cc-bottom-nav-live").exists()).toBe(false);
    expect(wrapper.get(".cc-bottom-nav").find(".cc-bottom-nav-live").exists()).toBe(true);
  });

  it("Buttons mit Namen, Typ, dekorativen Icons und aria-current am aktiven Eintrag", () => {
    const wrapper = mountSidebar("party");
    for (const section of CC_SECTIONS) {
      const item = wrapper.get(`[data-testid="cc-bottom-nav-${section.id}"]`);
      expect(item.element.tagName).toBe("BUTTON");
      expect(item.attributes("type")).toBe("button");
      expect(item.attributes("title")).toBe(section.label);
      expect(item.get(".cc-bottom-nav-label").text()).toBe(section.shortLabel ?? section.label);
      expect(item.get(".cc-bottom-nav-icon > span").attributes("aria-hidden")).toBe("true");
    }
    const current = wrapper.findAll(".cc-bottom-nav [aria-current=\"page\"]");
    expect(current).toHaveLength(1);
    expect(current[0].attributes("data-testid")).toBe("cc-bottom-nav-party");
    expect(wrapper.findAll(".cc-bottom-nav .is-active")).toHaveLength(1);
  });

  it("emittiert navigate mit der Section-ID", async () => {
    const wrapper = mountSidebar();
    await wrapper.get("[data-testid=\"cc-bottom-nav-settings\"]").trigger("click");
    expect(wrapper.emitted("navigate")).toEqual([ [ "settings" ] ]);
  });

  it("hält den aktiven Eintrag im Scrollbereich sichtbar", async () => {
    const wrapper = mountSidebar();
    const scroller = wrapper.get(".cc-bottom-nav-scroll").element as HTMLElement;
    const items = wrapper.findAll(".cc-bottom-nav-item").map(item => item.element as HTMLElement);
    // jsdom hat kein Layout: Geometrie wird bereitgestellt (Sichtbereich 300px, Einträge 100px breit).
    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 300 });
    items.forEach((item, index) => {
      Object.defineProperty(item, "offsetLeft", { configurable: true, value: index * 100 });
      Object.defineProperty(item, "offsetWidth", { configurable: true, value: 100 });
    });

    await wrapper.setProps({ active: "settings" as never });
    await nextTick();
    expect(scroller.scrollLeft).toBe(8 * 100 + 100 - 300);

    await wrapper.setProps({ active: "dashboard" as never });
    await nextTick();
    expect(scroller.scrollLeft).toBe(0);
  });

  it("bringt einen fokussierten, nur teilweise sichtbaren Eintrag vollständig in den Sichtbereich", async () => {
    const wrapper = mountSidebar();
    const scroller = wrapper.get(".cc-bottom-nav-scroll").element as HTMLElement;
    Object.defineProperty(scroller, "clientWidth", { configurable: true, value: 300 });
    wrapper.findAll(".cc-bottom-nav-item").forEach((item, index) => {
      Object.defineProperty(item.element, "offsetLeft", { configurable: true, value: index * 100 });
      Object.defineProperty(item.element, "offsetWidth", { configurable: true, value: 100 });
    });

    await wrapper.get("[data-testid=\"cc-bottom-nav-training\"]").trigger("focusin");
    expect(scroller.scrollLeft).toBe(4 * 100 + 100 - 300);
    await wrapper.get("[data-testid=\"cc-bottom-nav-board\"]").trigger("focusin");
    expect(scroller.scrollLeft).toBe(100);
  });
});
