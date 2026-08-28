/**
 * BUG 1 — Control Center Live-Refresh / Stale State (Human Live Test 2026-08-28).
 *
 * Reales Symptom: Während eines laufenden Matches zeigte das Control Center
 * frische Match-/Board-Daten (Restscore 282→277→232→161, Darts 1→3→6→15),
 * aber der globale Status blieb "Keine aktuellen Daten – vor 3/6/9/13/21 Min."
 * bzw. "Erweiterung kein Signal"; der AKTUALISIEREN-Button änderte nichts.
 *
 * ROOT CAUSE (bewiesen):
 *   `liveness` wurde AUSSCHLIESSLICH aus `adt-ws-status.when` abgeleitet
 *   (gespeichert von entrypoints/websocket-monitor.content.ts). Dieser Wert
 *   wird nur bei WebSocket-`open`/`close`/`error`-Events geschrieben
 *   (entrypoints/websocket-capture.ts). Bei laufendem Match bleibt der Socket
 *   offen → KEINE solchen Events → `when` friert beim Socket-Open ein und wird
 *   nach LIVE_WINDOW_MS (90 s) "stale", obwohl board/game-Daten weiter
 *   ununterbrochen in storage.local fließen und die Storage-Watcher des
 *   Control Centers sie korrekt anzeigen.
 *   Der AKTUALISIEREN-Button ruft nur `refresh()`, das denselben `adt-ws-status`
 *   erneut LIEST — die Quelle selbst ist alt, also ändert sich nichts.
 *
 * FIX: `lastLiveActivityAt` fängt die echte Live-Datenankunft (board/game/lobby
 * Storage-Watcher) als zusätzliches Frische-Signal ab; `liveness`/"Letztes
 * Signal" nutzen den neuesten der beiden Zeitpunkte (`lastLiveAt`).
 *
 * Hinweis zur Test-Isolation: `useControlCenterStatus` ist ein Modul-Singleton
 * (Refcount-geteilt). `lastLiveActivityAt` wird beim attach() bewusst NICHT
 * zurückgesetzt (die Seite lebt weiter). Die Tests sind daher in dieser
 * Reihenfolge angeordnet: ohne Live-Aktivität zuerst, Live-Aktivität zuletzt.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent } from "vue";

import { installWxtGlobals, type MockStorageHandle } from "../support/wxt-globals-mock";

// Muss VOR jedem Import von @/utils/storage / composables laufen.
const handle: MockStorageHandle = installWxtGlobals();

type CCStatus = ReturnType<typeof import("../../composables/useControlCenterStatus").useControlCenterStatus>;

/** Mountet die ECHTE useControlCenterStatus() über eine Mini-Harness-Komponente. */
async function mountHarness(): Promise<{ wrapper: ReturnType<typeof mount>; exposed: CCStatus }> {
  const { useControlCenterStatus } = await import("../../composables/useControlCenterStatus");
  let exposed!: CCStatus;
  const Harness = defineComponent({
    setup() {
      exposed = useControlCenterStatus();
      return () => null;
    },
  });
  const wrapper = mount(Harness);
  await flushPromises();
  return { wrapper, exposed };
}

function staleWsStatus(minutesAgo = 13): Record<string, unknown> {
  return { status: "connected", openSockets: 1, when: Date.now() - minutesAgo * 60 * 1000, info: null };
}

describe("useControlCenterStatus — Live-Frische (BUG 1)", () => {
  beforeEach(() => {
    handle.reset();
    // pingBackend() läuft in refresh(); happy-dom-fetch würde hängen und die
    // async refresh()-Kette blockieren (isRefreshing bliebe true). Backend-Ping
    // ist hier nicht Prüfgegenstand.
    globalThis.fetch = (async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. ohne jegliches Signal → unknown / 'Status unbekannt' (Semantik unverändert)", async () => {
    const { wrapper, exposed } = await mountHarness();
    try {
      expect(exposed.liveness.value).toBe("unknown");
      expect(exposed.connectionLabel.value).toBe("Status unbekannt");
      expect(exposed.lastSignalAgo.value).toBeNull();
    } finally {
      wrapper.unmount();
    }
  });

  it("2. veraltetes ws-Signal ohne Live-Datenfluss → stale / 'Keine aktuellen Daten' (reproduziert den BUG-Zustand VOR dem Fix)", async () => {
    handle.seed("adt-ws-status", staleWsStatus(13));
    const { wrapper, exposed } = await mountHarness();
    try {
      expect(exposed.liveness.value).toBe("stale");
      expect(exposed.connectionLabel.value).toBe("Keine aktuellen Daten");
      expect(exposed.lastSignalAgo.value).toMatch(/vor \d+ Min\./);
    } finally {
      wrapper.unmount();
    }
  });

  it("3. AKTUALISIEREN ohne Live-Aktivität erfindet KEINE Live-Frische (ehrlicher Refresh)", async () => {
    handle.seed("adt-ws-status", staleWsStatus(9));
    const { wrapper, exposed } = await mountHarness();
    try {
      expect(exposed.liveness.value).toBe("stale");
      await exposed.refresh();
      expect(exposed.liveness.value).toBe("stale");
      expect(exposed.connectionLabel.value).toBe("Keine aktuellen Daten");
    } finally {
      wrapper.unmount();
    }
  });

  it("4. Live-Daten fließen (Match/Board), ws-status.when ist aber alt → Status wird 'live' (der reale Live-Test-Fall)", async () => {
    // Autodarts-Tab offen seit 21 Min., Socket nie neu verbunden → ws-status alt.
    handle.seed("adt-ws-status", staleWsStatus(21));

    const { AutodartsToolsBoardData } = await import("@/utils/board-data-storage");
    const { AutodartsToolsGameData } = await import("@/utils/game-data-storage");
    const { wrapper, exposed } = await mountHarness();
    try {
      // Ausgangslage: gleicher Inkonsistenz-Zustand wie im Live-Test.
      expect(exposed.liveness.value).toBe("stale");

      // Echte Wurf-/Match-Daten treffen ein: Darts 1 → 3 → 6 → 15, Restscore 282→277→232→161.
      await AutodartsToolsBoardData.setValue({ connected: true, status: "Throw", numThrows: 1 } as any);
      expect(exposed.liveness.value).toBe("live");
      expect(exposed.connectionLabel.value).toBe("Verbunden");
      expect(exposed.lastSignalAgo.value).toBe("gerade eben");

      await AutodartsToolsBoardData.setValue({ connected: true, status: "Throw", numThrows: 3 } as any);
      expect(exposed.liveness.value).toBe("live");

      await AutodartsToolsBoardData.setValue({ connected: true, status: "Throw", numThrows: 6 } as any);
      expect(exposed.liveness.value).toBe("live");

      await AutodartsToolsBoardData.setValue({ connected: true, status: "Throw", numThrows: 15 } as any);
      expect(exposed.liveness.value).toBe("live");

      await AutodartsToolsGameData.setValue({ match: { id: "m1" } } as any);
      expect(exposed.liveness.value).toBe("live");

      // Der AKTUALISIEREN-Button (refresh()) re-liest dieselben Quellen — mit
      // Live-Datenfluss bleibt der Status jetzt zu Recht "live".
      await exposed.refresh();
      expect(exposed.liveness.value).toBe("live");
      expect(exposed.connectionLabel.value).toBe("Verbunden");
    } finally {
      wrapper.unmount();
    }
  });
});
