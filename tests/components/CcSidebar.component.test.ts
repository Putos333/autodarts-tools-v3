/**
 * UI-2B — CcSidebar.vue: gruppierte Desktop-Navigation (Semantik, aktiver Zustand, Navigationswunsch).
 *
 * Das Live-Widget ist gestubbt (eigener Gegenstand).
 */

import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";

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

  it("die mobile Bottom-Navigation bleibt unverändert (gleiche Bereiche, eigene Test-IDs)", () => {
    const wrapper = mountSidebar();
    expect(wrapper.findAll(".cc-bottom-nav-item")).toHaveLength(CC_SECTIONS.length);
    expect(wrapper.find("[data-testid=\"cc-bottom-nav-stats\"]").exists()).toBe(true);
  });
});
