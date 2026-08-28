/**
 * BUG 2 — Verlauf / Match-Details öffnen nicht (Human Live Test 2026-08-28).
 *
 * Reales Symptom: Nach Match-Ende wurde im Control Center unter VERLAUF
 * korrekt 1 Match (Status "Minimal", Beendet, Sieger arnonym2302, X01, Local)
 * angezeigt. Klick auf die Match-Karte bzw. den Pfeil öffnete KEINE Details.
 *
 * Hypothese (zu reproduzieren): `selectedMatch` speichert eine Objekt-REFERENZ
 * aus `filteredAndSorted`. Die Display-Objekte werden aber bei JEDER
 * Neuberechnung neu erzeugt (`mapCmrsToDisplay`). Sobald sich der CMR-Store
 * zwischen Klick und Render erneut ändert (der Watch-Callback in CcHistory
 * ruft `loadResults()` → `rawResults` neu zugewiesen → neue Objekt-Identitäten),
 * greift `match === selectedMatch` nicht mehr und die Details öffnen sich nie
 * sichtbar / schließen sofort.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";

import { installWxtGlobals, type MockStorageHandle } from "../support/wxt-globals-mock";

import type { ICanonicalMatchResult } from "@/utils/canonical-match-result";

const handle: MockStorageHandle = installWxtGlobals();

vi.mock("@/composables/useControlCenterStatus", () => ({
  useControlCenterStatus: () => ({
    myUserId: ref("user-arnonym"),
  }),
}));

const { AutodartsToolsCanonicalMatchResults } = await import("@/utils/canonical-match-result-storage");
const CcHistory = (await import("../../components/ControlCenter/views/CcHistory.vue")).default;

function minimalFinishedRecord(overrides: Partial<ICanonicalMatchResult> = {}): ICanonicalMatchResult {
  return {
    schemaVersion: 1,
    matchId: "11111111-2222-3333-4444-555555555555",
    revision: 1,
    quality: "MINIMAL",
    recordedAt: "2026-08-28T19:00:00.000Z",
    createdAt: "2026-08-28T18:30:00.000Z",
    variant: "X01",
    gameMode: "X01",
    type: "Local",
    finished: true,
    winnerIndex: 0,
    players: [
      { index: 0, name: "arnonym2302", userId: "user-arnonym", legs: 1 },
      { index: 1, name: "Bot", isBot: true, legs: 0 },
    ],
    ...overrides,
  };
}

function seedStore(records: ICanonicalMatchResult[]): void {
  handle.seed("canonical-match-results-v1", { version: 1, records });
}

describe("CcHistory.vue — Match-Detail öffnen/schließen (BUG 2)", () => {
  beforeEach(() => {
    handle.reset();
  });

  it("1. Klick auf die Match-Zeile öffnet die Details (baseline)", async () => {
    seedStore([ minimalFinishedRecord() ]);
    const wrapper = mount(CcHistory);
    await flushPromises();

    expect(wrapper.find('[data-testid="cc-hist-11111111-2222-3333-4444-555555555555"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cc-history-detail"]').exists()).toBe(false);

    await wrapper.find('[data-testid^="cc-hist-toggle-"]').trigger("click");
    await flushPromises();

    expect(wrapper.find('[data-testid="cc-history-detail"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("Technische Details");

    wrapper.unmount();
  });

  it("2. erneuter Klick schließt die Details (toggle)", async () => {
    seedStore([ minimalFinishedRecord() ]);
    const wrapper = mount(CcHistory);
    await flushPromises();

    const toggle = wrapper.find('[data-testid^="cc-hist-toggle-"]');
    await toggle.trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="cc-history-detail"]').exists()).toBe(true);

    await toggle.trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="cc-history-detail"]').exists()).toBe(false);

    wrapper.unmount();
  });

  it("3. Detail bleibt geöffnet, wenn der CMR-Store zwischen Klick und Render erneut geschrieben wird (realer Verlauf: Hintergrund-Revision)", async () => {
    seedStore([ minimalFinishedRecord() ]);
    const wrapper = mount(CcHistory);
    await flushPromises();

    const toggle = wrapper.find('[data-testid^="cc-hist-toggle-"]');
    await toggle.trigger("click");
    await flushPromises();
    expect(wrapper.find('[data-testid="cc-history-detail"]').exists()).toBe(true);

    // Simuliert eine erneute Persistierung des CMR (Revision-Hochzählung durch
    // den Content-Script-Kreislauf) — der Watch-Callback lädt neu, die
    // Display-Objekte bekommen neue Identitäten.
    await AutodartsToolsCanonicalMatchResults.setValue({
      version: 1,
      records: [ minimalFinishedRecord({ revision: 2 }) ],
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="cc-history-detail"]').exists()).toBe(true);

    wrapper.unmount();
  });
});
