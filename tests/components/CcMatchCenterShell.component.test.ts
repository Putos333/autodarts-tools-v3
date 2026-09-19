/**
 * Phase 2C — Component Test: CcMatchCenterShell.vue.
 *
 * Reine Struktur-/Komposition-Prüfung der 3/6/3-Grid-Shell: mountet die
 * ECHTE Komponente (nicht nachgebaut) via @vue/test-utils + happy-dom.
 * `useControlCenterStatus()` wird gemockt (dieselbe Isolation wie
 * CcMatchHero.component.test.ts) — alle vier Kindkomponenten sind die
 * ECHTEN, ungemockten Produktionskomponenten. Storage-getriebene Kinder
 * (CcRecentActivity, CcSystemStatusFooter) laufen über den bestehenden
 * `installWxtGlobals()`-Harness (wie CcSystemStatusFooter.component.test.ts),
 * nicht über eine zweite, eigene Storage-Nachbildung.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { ref } from "vue";

import { installWxtGlobals } from "../support/wxt-globals-mock";

import type { ICcPlayer } from "../../composables/useControlCenterStatus";
import type { ICcCheckoutPath } from "../../utils/checkout-path";
import type { ICcLiveThrow } from "../../utils/live-throw";
import type { ICcMomentum, ICcRecentVisit } from "../../utils/match-flow";

const statusHolder = vi.hoisted(() => ({ current: null as unknown as Record<string, unknown> }));

vi.mock("@/composables/useControlCenterStatus", () => ({
  useControlCenterStatus: () => statusHolder.current,
}));

const handle = installWxtGlobals();

const { AutodartsToolsConfig, defaultConfig } = await import("@/utils/storage");
const CcMatchCenterShell = (await import("../../components/ControlCenter/CcMatchCenterShell.vue")).default;

function makePlayer(overrides: Partial<ICcPlayer> = {}): ICcPlayer {
  return {
    seat: 0,
    name: "Spieler A",
    isBot: false,
    isActive: false,
    isWinner: false,
    legs: 1,
    sets: 0,
    average: 55.2,
    checkoutPercent: 40,
    remaining: 301,
    ...overrides,
  };
}

function makeLiveThrow(overrides: Partial<ICcLiveThrow> = {}): ICcLiveThrow {
  return { hasTurn: false, darts: [], visitScore: null, previousVisit: null, ...overrides };
}

function makeCheckoutPath(overrides: Partial<ICcCheckoutPath> = {}): ICcCheckoutPath {
  return { visible: false, remaining: null, suggestion: null, darts: [], ...overrides };
}

/** Superset aller Felder, die die vier Kindkomponenten der Shell zusammen aus dem Singleton lesen. */
function makeStatus(overrides: Record<string, unknown> = {}) {
  const playerA = makePlayer({ seat: 0, name: "Spieler A", isActive: true });
  const playerB = makePlayer({ seat: 1, name: "Spieler B", isActive: false, remaining: 180 });

  return {
    // CcMatchHero
    liveness: ref("live"),
    boardLiveness: ref("live"),
    hasMatch: ref(true),
    isPrivateMatch: ref(false),
    matchVariant: ref(null),
    matchFinished: ref(false),
    matchStateLabel: ref("Läuft"),
    matchStateTone: ref("ok"),
    matchProgress: ref({ set: 1, leg: 1, round: 3 }),
    matchSettings: ref({ baseScore: 301, gameMode: "X01" }),
    gameMode: ref("X01"),
    players: ref([ playerA, playerB ]),
    heroPair: ref({ left: playerA, right: playerB, extra: 0 }),
    heroScoreLine: ref({ label: "Legs", left: 1, right: 0, text: "1 : 0" }),
    anySets: ref(false),
    showRemaining: ref(true),
    showPoints: ref(false),
    scoreLabel: ref("Rest"),
    autodartsOrigin: ref("https://play.autodarts.io"),
    checkoutPath: ref(makeCheckoutPath()),
    liveThrow: ref(makeLiveThrow()),
    recentVisits: ref([] as ICcRecentVisit[]),
    momentum: ref({ visible: false, trend: null, visitScore: null, average: null, deltaPercent: null } as ICcMomentum),
    focusPlayer: ref(playerA),
    quickStats: ref([]),
    // CcSystemStatusFooter
    hasBoardSignal: ref(true),
    boardData: ref({ connected: true }),
    // CcRecentActivity
    myUserId: ref("test-user"),
    ...overrides,
  };
}

function mountShell(overrides: Record<string, unknown> = {}) {
  statusHolder.current = makeStatus(overrides);
  return { wrapper: mount(CcMatchCenterShell), status: statusHolder.current };
}

describe("CcMatchCenterShell.vue", () => {
  it("mountet ohne Fehler und rendert alle drei Grid-Regionen", async () => {
    expect(() => mountShell()).not.toThrow();
    const { wrapper } = mountShell();
    await flushPromises();
    expect(wrapper.find('[data-testid="cc-matchcenter-shell"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cc-matchcenter-left"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cc-matchcenter-center"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cc-matchcenter-right"]').exists()).toBe(true);
  });

  it("nutzt das bestehende cc-grid/cc-col-System in der 3/6/3-Aufteilung", () => {
    const { wrapper } = mountShell();
    expect(wrapper.find('[data-testid="cc-matchcenter-shell"]').classes()).toContain("cc-grid");
    expect(wrapper.find('[data-testid="cc-matchcenter-left"]').classes()).toContain("cc-col-3");
    expect(wrapper.find('[data-testid="cc-matchcenter-center"]').classes()).toContain("cc-col-6");
    expect(wrapper.find('[data-testid="cc-matchcenter-right"]').classes()).toContain("cc-col-3");
  });

  it("LEFT enthält die echte CcQuickPlay-Komponente (kein Nachbau)", () => {
    const { wrapper } = mountShell();
    const left = wrapper.find('[data-testid="cc-matchcenter-left"]');
    expect(left.find('[data-testid="cc-quickplay"]').exists()).toBe(true);
  });

  it("CENTER enthält die echte CcMatchHero-Komponente (kein Nachbau)", () => {
    const { wrapper } = mountShell();
    const center = wrapper.find('[data-testid="cc-matchcenter-center"]');
    expect(center.find('[data-testid="cc-hero"]').exists()).toBe(true);
  });

  it("RIGHT enthält die echten CcRecentActivity- und CcSystemStatusFooter-Komponenten (kein Nachbau)", async () => {
    const { wrapper } = mountShell();
    await flushPromises();
    const right = wrapper.find('[data-testid="cc-matchcenter-right"]');
    expect(right.find('[data-testid="cc-recent-activity"]').exists()).toBe(true);
    expect(right.find('[data-testid="cc-system-strip"]').exists()).toBe(true);
  });

  it("leerer Zustand (kein Match) verursacht keinen Crash", async () => {
    expect(() => mountShell({
      hasMatch: ref(false),
      players: ref([]),
      heroPair: ref(null),
      liveThrow: ref(makeLiveThrow()),
      checkoutPath: ref(makeCheckoutPath()),
    })).not.toThrow();
    await flushPromises();
  });

  it("Unmount der Shell räumt Kind-Lifecycle korrekt auf (CcSystemStatusFooter's Storage-Watcher wird deregistriert)", async () => {
    // Die Shell selbst besitzt keinen eigenen Lifecycle-Hook (siehe
    // Performance-Gate unten) — diese Prüfung stellt sicher, dass ihre reine
    // Kompositions-Struktur den echten onBeforeUnmount-Vertrag der
    // Kindkomponente nicht bricht. Gleicher Beweis wie
    // CcSystemStatusFooter.component.test.ts Test 3 (dort isoliert), hier
    // über die tatsächliche Shell-Komposition.
    handle.reset();
    const getValueSpy = vi.spyOn(AutodartsToolsConfig, "getValue");

    const { wrapper } = mountShell();
    await flushPromises();
    const callsAfterMount = getValueSpy.mock.calls.length;
    expect(callsAfterMount).toBeGreaterThan(0);

    wrapper.unmount();

    await AutodartsToolsConfig.setValue({ ...defaultConfig, wledFx: { ...defaultConfig.wledFx, enabled: true } });
    await flushPromises();

    // Nach dem Unmount darf der von CcSystemStatusFooter registrierte
    // Watcher keinen weiteren getValue()-Aufruf mehr auslösen.
    expect(getValueSpy.mock.calls.length).toBe(callsAfterMount);

    getValueSpy.mockRestore();
  });

  it("Performance-Gate: die Shell-Datei selbst führt keinen Timer/Observer/Lifecycle-Hook ein", () => {
    // Reiner Kompositions-Wrapper — jede Datenbeschaffung und jedes Cleanup
    // gehört bereits den vier Kindkomponenten (unveränderte, andernorts
    // geprüfte Lifecycle-Verträge), nicht dieser Shell-Datei. Quelltext-Scan
    // statt Laufzeit-Spy, weil es um Abwesenheit im COMPONENT-OWN-Skript
    // geht, nicht um beobachtbares Laufzeitverhalten der Kinder.
    const testDir = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(join(testDir, "../../components/ControlCenter/CcMatchCenterShell.vue"), "utf-8");
    const forbidden = [ "setInterval", "setTimeout", "requestAnimationFrame", "MutationObserver", "onMounted", "onUnmounted", "onBeforeUnmount", "watch(", "watchEffect(" ];
    for (const pattern of forbidden) {
      expect(source.includes(pattern), `unerwartetes Muster in CcMatchCenterShell.vue: ${pattern}`).toBe(false);
    }
  });
});
