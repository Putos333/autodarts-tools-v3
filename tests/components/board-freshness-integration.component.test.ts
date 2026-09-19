/**
 * Codex-Finding P2 #1 — Board-Frische mit ECHTER useControlCenterStatus().
 *
 * Symptom: Ein reines Lobby-Update (kein neues Board-Signal) setzte `liveness`
 * auf "live". Footer ("Board verbunden · Autoscoring aktiv") und Board-Karte
 * ("Autoscoring Aktiv · Board meldet Würfe") zeigten dadurch für ein altes
 * Board einen aktuellen Zustand.
 *
 * Bewusst OHNE Mock der Composable: CcSystemStatusFooter.component.test.ts und
 * CcHeroBand.component.test.ts mocken sie mit festem `liveness`-Ref und können
 * diesen Fehler prinzipiell nicht sehen.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";

import { installWxtGlobals } from "../support/wxt-globals-mock";

const handle = installWxtGlobals();

const squash = (text: string) => text.replace(/\s+/g, " ");

describe("Board-Frische: Lobby-Update darf ein altes Board nicht als aktuell darstellen", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Footer, Board-Karte und HeroBand zeigen 'unbekannt', sobald das Board veraltet ist — Lobby-Update und WS-Event ändern daran nichts", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
    handle.reset();
    handle.seed("adt-ws-status", { status: "connected", openSockets: 1, when: Date.now() - 24 * 60 * 60 * 1000, info: null });

    const { AutodartsToolsBoardData } = await import("@/utils/board-data-storage");
    const { AutodartsToolsLobbyData } = await import("@/utils/lobby-data-storage");
    const Footer = (await import("../../components/ControlCenter/CcSystemStatusFooter.vue")).default;
    const BoardCard = (await import("../../components/ControlCenter/CcBoardCard.vue")).default;
    const HeroBand = (await import("../../components/ControlCenter/CcHeroBand.vue")).default;

    const footer = mount(Footer);
    const card = mount(BoardCard);
    const hero = mount(HeroBand);
    /** Wert der Kachel mit dem gegebenen Label (z. B. "Board"). */
    const lamp = () => card.find('[data-testid="cc-board-lamp"]');
    const tile = (label: string) =>
      card.findAll(".cc-tile").find((t) => t.find(".cc-tile-label").text() === label)?.find(".cc-tile-value").text();
    try {
      await flushPromises();

      // Echtes Board-Signal → aktuell.
      // `status: ""` = Standardfall aus websocket-helpers (fehlender Status) → Fallback-Label "Verbunden".
      await AutodartsToolsBoardData.setValue({ connected: true, status: "", numThrows: 3 } as any);
      await flushPromises();
      expect(squash(footer.text())).toContain("Board verbunden");
      expect(squash(footer.text())).toContain("Autoscoring aktiv");
      expect(squash(card.text())).toContain("Board meldet Würfe");
      expect(tile("Board")).toBe("Verbunden");
      expect(lamp().text()).toBe("Verbunden");
      expect(squash(hero.find('[data-testid="cc-herobar-board"]').text())).toContain("verbunden");

      // 10 Minuten ohne Board-Event; das Lobby-Update schreibt `now` fort.
      const realNow = Date.now();
      vi.spyOn(Date, "now").mockReturnValue(realNow + 10 * 60 * 1000);
      await AutodartsToolsLobbyData.setValue({} as any);
      await flushPromises();
      expect(squash(footer.text())).toContain("Board unbekannt");
      expect(squash(footer.text())).toContain("Autoscoring unbekannt");
      expect(squash(footer.text())).not.toContain("Autoscoring aktiv");
      expect(squash(card.text())).toContain("keine aktuellen Daten");
      expect(squash(card.text())).not.toContain("Board meldet Würfe");
      expect(tile("Board")).toBe("Unbekannt");
      expect(lamp().text()).toBe("Unbekannt");
      expect(lamp().attributes("title")).toBe("Unbekannt");
      expect(squash(hero.find('[data-testid="cc-herobar-board"]').text())).toContain("unbekannt");
      expect(squash(hero.find('[data-testid="cc-herobar-board"]').text())).not.toContain("verbunden");

      // WS-Status-Event (disconnect) mit frischem `when` ist kein Board-Signal.
      await (globalThis as any).browser.storage.local.set({
        "adt-ws-status": { status: "disconnected", openSockets: 0, when: Date.now(), info: null },
      });
      await flushPromises();
      expect(squash(footer.text())).toContain("Board unbekannt");
      expect(squash(footer.text())).not.toContain("Autoscoring aktiv");
      expect(squash(card.text())).not.toContain("Board meldet Würfe");
      expect(tile("Board")).toBe("Unbekannt");
      expect(lamp().text()).toBe("Unbekannt");
      expect(lamp().attributes("title")).toBe("Unbekannt");
      expect(squash(hero.find('[data-testid="cc-herobar-board"]').text())).not.toContain("verbunden");

      // Echtes Board-Signal → wieder aktuell.
      await AutodartsToolsBoardData.setValue({ connected: true, status: "Throw", numThrows: 4 } as any);
      await flushPromises();
      expect(squash(footer.text())).toContain("Board verbunden");
      expect(squash(footer.text())).toContain("Autoscoring aktiv");
      expect(squash(card.text())).toContain("Board meldet Würfe");
      expect(tile("Board")).toBe("Verbunden");
      expect(lamp().text()).toBe("Bereit zum Wurf");
      expect(squash(hero.find('[data-testid="cc-herobar-board"]').text())).toContain("verbunden");
    } finally {
      footer.unmount();
      card.unmount();
      hero.unmount();
      globalThis.fetch = originalFetch;
    }
  });
});
