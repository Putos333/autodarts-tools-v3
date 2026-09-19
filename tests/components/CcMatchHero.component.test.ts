/**
 * Phase 4 — Component Test Foundation: CcMatchHero.vue.
 *
 * Mountet die ECHTE Vue-Komponente (nicht nachgebaut) via @vue/test-utils +
 * happy-dom. CcMatchHero.vue selbst hat keine Props — alle Daten kommen aus
 * `useControlCenterStatus()`. Diese eine Composable wird gemockt (reine
 * Daten-Schicht-Isolation, Standard-Testpraxis) — alle Kind-Komponenten
 * (CcPlayerBadge, CcStatusPill, CcEmptyState, CcLiveBoard) sind die ECHTEN,
 * ungemockten Komponenten. Fixture-Shapes folgen exakt den bestehenden
 * Produktions-Interfaces (ICcPlayer, ICcLiveThrow, ICcCheckoutPath, ...) —
 * keine eigene, abweichende Datenform.
 */

import { describe, expect, it, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { nextTick, ref, type Ref } from "vue";

import type { ICcPlayer } from "../../composables/useControlCenterStatus";
import type { ICcCheckoutDart, ICcCheckoutPath } from "../../utils/checkout-path";
import type { ICcLiveDart, ICcLiveThrow } from "../../utils/live-throw";
import type { ICcMomentum, ICcRecentVisit } from "../../utils/match-flow";

const statusHolder = vi.hoisted(() => ({ current: null as unknown as Record<string, unknown> }));

vi.mock("@/composables/useControlCenterStatus", () => ({
  useControlCenterStatus: () => statusHolder.current,
}));

const CcMatchHero = (await import("../../components/ControlCenter/CcMatchHero.vue")).default;

/* ─── Fixture-Builder — Formen exakt aus den Produktions-Interfaces ──────── */

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

function liveDart(hit: boolean, label: string | null, coords: { x: number; y: number } | null = null): ICcLiveDart {
  return { hit, label, coords };
}

function checkoutDart(hit: boolean, label: string): ICcCheckoutDart {
  return { hit, label } as ICcCheckoutDart;
}

/** Baseline: zwei reale Spieler, kein laufender Wurf, kein Checkout — der v-if="heroPair"-Zweig. */
function makeStatus(overrides: Record<string, unknown> = {}) {
  const playerA = makePlayer({ seat: 0, name: "Spieler A", isActive: true });
  const playerB = makePlayer({ seat: 1, name: "Spieler B", isActive: false, remaining: 180 });

  return {
    liveness: ref("live"),
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
    ...overrides,
  };
}

function mountHero(overrides: Record<string, unknown> = {}) {
  statusHolder.current = makeStatus(overrides);
  return { wrapper: mount(CcMatchHero), status: statusHolder.current };
}

describe("CcMatchHero.vue", () => {
  it("mountet ohne Fehler (zwei Spieler, kein laufender Wurf)", () => {
    expect(() => mountHero()).not.toThrow();
    const { wrapper } = mountHero();
    expect(wrapper.find('[data-testid="cc-hero"]').exists()).toBe(true);
  });

  it("Live-Throw-Zweig zeigt die echte CcLiveBoard-Komponente, keine Checkout-Route gleichzeitig", () => {
    const { wrapper } = mountHero({
      liveThrow: ref(makeLiveThrow({ hasTurn: true, darts: [ liveDart(true, "T20", { x: 0, y: -103 }), liveDart(false, null), liveDart(false, null) ], visitScore: 60 })),
      checkoutPath: ref(makeCheckoutPath({ visible: false })),
    });
    expect(wrapper.find('[data-testid="cc-live-throw"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cc-hero-board-visual"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cc-live-board"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cc-checkout-path"]').exists()).toBe(false);
  });

  it("Checkout-Zweig bleibt funktional: Checkout-Route sichtbar, CcLiveBoard NICHT gleichzeitig gerendert (ein physischer Slot)", () => {
    const { wrapper } = mountHero({
      liveThrow: ref(makeLiveThrow({ hasTurn: true, darts: [ liveDart(true, "T20"), liveDart(false, null), liveDart(false, null) ] })),
      checkoutPath: ref(makeCheckoutPath({
        visible: true,
        remaining: 40,
        suggestion: "D20",
        darts: [ checkoutDart(false, "D20") ],
      })),
    });
    expect(wrapper.find('[data-testid="cc-checkout-path"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="cc-checkout-path-value"]').text()).toBe("40");
    expect(wrapper.find('[data-testid="cc-live-throw"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="cc-hero-board-visual"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="cc-live-board"]').exists()).toBe(false);
  });

  it("aktiver Spieler wird korrekt dargestellt (Tag 'Am Wurf' + is-active-side ausschließlich auf der aktiven Seite)", () => {
    const { wrapper } = mountHero();
    const leftSide = wrapper.find(".cc-hero-side.is-left");
    const rightSide = wrapper.find(".cc-hero-side.is-right");
    expect(leftSide.classes()).toContain("is-active-side");
    expect(rightSide.classes()).not.toContain("is-active-side");
    expect(leftSide.text()).toContain("Am Wurf");
    expect(rightSide.text()).not.toContain("Am Wurf");
  });

  it("Spielerwechsel aktualisiert die Darstellung reaktiv (echte Vue-Reaktivität, kein Remount)", async () => {
    const { wrapper, status } = mountHero();
    expect(wrapper.find(".cc-hero-side.is-left").classes()).toContain("is-active-side");

    const playersRef = status.players as Ref<ICcPlayer[]>;
    const heroPairRef = status.heroPair as Ref<{ left: ICcPlayer; right: ICcPlayer; extra: number } | null>;
    const [ playerA, playerB ] = playersRef.value;
    const switchedA = { ...playerA, isActive: false };
    const switchedB = { ...playerB, isActive: true };
    playersRef.value = [ switchedA, switchedB ];
    heroPairRef.value = { left: switchedA, right: switchedB, extra: 0 };
    await nextTick();

    expect(wrapper.find(".cc-hero-side.is-left").classes()).not.toContain("is-active-side");
    expect(wrapper.find(".cc-hero-side.is-right").classes()).toContain("is-active-side");
  });

  it("Score-Darstellung bleibt vorhanden (Restscore beider Spieler sichtbar)", () => {
    const { wrapper } = mountHero();
    const remainings = wrapper.findAll(".cc-hero-remaining").map(el => el.text());
    expect(remainings).toContain("301");
    expect(remainings).toContain("180");
  });

  it("fehlender/leerer Spielername verursacht keinen Crash und rendert die Karte trotzdem", () => {
    expect(() => mountHero({
      players: ref([ makePlayer({ seat: 0, name: "", isActive: true }), makePlayer({ seat: 1, name: "Spieler B" }) ]),
      heroPair: ref({ left: makePlayer({ seat: 0, name: "", isActive: true }), right: makePlayer({ seat: 1, name: "Spieler B" }), extra: 0 }),
    })).not.toThrow();
  });

  it("leerer Zustand (kein Match) verursacht keinen Crash und zeigt den Empty-State", () => {
    const { wrapper } = mountHero({
      hasMatch: ref(false),
      players: ref([]),
      heroPair: ref(null),
      liveThrow: ref(makeLiveThrow()),
      checkoutPath: ref(makeCheckoutPath()),
    });
    expect(wrapper.find('[data-testid="cc-hero-open-autodarts"]').exists()).toBe(true);
    expect(wrapper.find(".cc-hero-body").exists()).toBe(false);
  });

  it("partieller Zustand (1 Spieler, Solo-Training) verursacht keinen Crash", () => {
    expect(() => mountHero({
      players: ref([ makePlayer({ seat: 0, name: "Solo", isActive: true }) ]),
      heroPair: ref(null),
    })).not.toThrow();
    const { wrapper } = mountHero({
      players: ref([ makePlayer({ seat: 0, name: "Solo", isActive: true }) ]),
      heroPair: ref(null),
    });
    expect(wrapper.text()).toContain("Solo");
    expect(wrapper.text()).toContain("Einzelspieler");
  });

  it("bestehende Struktur-Hooks für das Mobile/Responsive-CSS (Phase 3/3.5) bleiben im DOM vorhanden", () => {
    const { wrapper } = mountHero({
      liveThrow: ref(makeLiveThrow({ hasTurn: true, darts: [ liveDart(true, "T20", { x: 0, y: -103 }), liveDart(false, null), liveDart(false, null) ] })),
    });
    // Dieselben Selektoren, an denen entrypoints/controlcenter/style.css
    // (u.a. der @media(max-width:480px)-Hardening-Block) andockt.
    expect(wrapper.find(".cc-hero-body").exists()).toBe(true);
    expect(wrapper.find(".cc-hero-side.is-left").exists()).toBe(true);
    expect(wrapper.find(".cc-hero-side.is-right").exists()).toBe(true);
    expect(wrapper.find(".cc-hero-tags").exists()).toBe(true);
    expect(wrapper.find(".cc-hero-center").exists()).toBe(true);
    expect(wrapper.find(".cc-hero-board-visual").exists()).toBe(true);
  });
});
