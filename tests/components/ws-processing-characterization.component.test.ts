/**
 * Runtime Hardening Phase 1 – Charakterisierungstests für den echten
 * `processWebSocketMessage` (utils/websocket-helpers.ts, Protected Core: hier
 * nur IMPORTIERT und ausgeführt, nie verändert).
 *
 * Diese Tests halten das BESTEHENDE Verhalten fest (Stand HEAD afcd662). Sie
 * bewerten es nicht. Wird später gezielt ein Reihenfolge-, Resync- oder
 * Multi-Tab-Schutz eingebaut (R1–R3), müssen die betroffenen Erwartungen
 * begründet angepasst werden – ein roter Test ist dann ein Signal, kein Bug.
 *
 * Abdeckung (Auftrag A–G): A Reconnect/Zustand, B Duplikat, C stale/out-of-order,
 * E Zwei-Tab-Konkurrenz, F Tab schließt/kein Ownership-Transfer, G Timer.
 * Zwei "Tabs" werden als zwei Modulinstanzen (vi.resetModules) auf demselben
 * geteilten Storage nachgebildet; die URL (`window.location`) wird pro Aufruf gesetzt.
 *
 * Grenze: Die Reihenfolge, in der echte Browser-Storage-Reads abschließen, wird
 * hier simuliert (verzögerter Read). Ob echte Browser diese Umordnung tatsächlich
 * erzeugen, ist damit NICHT belegt (UNKNOWN, braucht Realverkehr).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installWxtGlobals } from "../support/wxt-globals-mock";

const handle = installWxtGlobals();

const MATCH_ID = "3f8b1c2a-4d5e-4f60-9a1b-2c3d4e5f6071";
const OTHER_MATCH_ID = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const GAME_KEY = "game-data";

/** Voller Snapshot wie auf `autodarts.matches` (keine Deltas). */
function snap(round: number, throwsCount = 0, id = MATCH_ID): any {
  return {
    id,
    round,
    player: 0,
    finished: false,
    players: [],
    turns: [ { id: `turn-${round}`, round, throws: Array.from({ length: throwsCount }, (_, i) => ({ id: `t${i}` })) } ],
  };
}

function setUrl(matchId: string) {
  (window as any).happyDOM.setURL(`https://play.autodarts.io/matches/${matchId}`);
}

async function freshInstance() {
  vi.resetModules();
  const helpers = await import("@/utils/websocket-helpers");
  const { AutodartsToolsGameData } = await import("@/utils/game-data-storage");
  return { ...helpers, gameItem: AutodartsToolsGameData as { getValue: () => Promise<unknown> } };
}

/**
 * `getValue()` des game-data-Items nach dem eigentlichen Read verzögern (n-ter Aufruf).
 * Der Wert wird sofort gelesen und erst danach zurückgegeben: simuliert einen Read, der
 * vor einem fremden Write liest, aber erst danach beim Aufrufer ankommt.
 */
function delayGameDataReads(item: { getValue: () => Promise<unknown> }, delaysMs: number[]) {
  const original = item.getValue.bind(item);
  let call = 0;
  item.getValue = async () => {
    const delay = delaysMs[call++] ?? 0;
    const value = await original();
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    return value;
  };
  return () => { item.getValue = original; };
}

describe("Runtime Hardening P1 – processWebSocketMessage (Charakterisierung)", () => {
  beforeEach(() => {
    handle.reset();
    vi.spyOn(console, "log").mockImplementation(() => {});
    setUrl(MATCH_ID);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("A. Reconnect / Zustandswiederherstellung", () => {
    it("A1. Nach 'Reconnect' liefert Autodarts wieder den vollen Zustand: identischer Snapshot erzeugt KEINEN weiteren Write, geänderter wird gespeichert", async () => {
      const { processWebSocketMessage } = await freshInstance();
      await processWebSocketMessage("autodarts.matches", snap(1, 2));
      expect(handle.setCallCount(GAME_KEY)).toBe(1);

      // "Reconnect" = Autodarts sendet denselben vollen Zustand erneut (gleiche Modulinstanz).
      await processWebSocketMessage("autodarts.matches", structuredClone(snap(1, 2)));
      expect(handle.setCallCount(GAME_KEY)).toBe(1);

      // Während der Trennung hat sich der Zustand geändert → neuer Snapshot wird gespeichert.
      await processWebSocketMessage("autodarts.matches", snap(2, 0));
      expect(handle.setCallCount(GAME_KEY)).toBe(2);
      expect((handle.raw(GAME_KEY) as any).match.round).toBe(2);
    });

    it("A2. Ohne neuen Snapshot nach einem Reconnect bleibt der alte Zustand stehen (es gibt keinen eigenständigen Resync)", async () => {
      const { processWebSocketMessage } = await freshInstance();
      await processWebSocketMessage("autodarts.matches", snap(4, 1));
      const writesBefore = handle.setCallCount(GAME_KEY);
      // Zwischen Trennung und erstem neuem Snapshot passiert in diesem Pfad nichts:
      // kein Fetch, kein Write, der gespeicherte Zustand ist der letzte empfangene.
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      await new Promise((r) => setTimeout(r, 20));
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(handle.setCallCount(GAME_KEY)).toBe(writesBefore);
      expect((handle.raw(GAME_KEY) as any).match.round).toBe(4);
      vi.unstubAllGlobals();
    });
  });

  describe("B. Duplikat", () => {
    it("B1. Byte-identischer Match-Snapshot direkt hintereinander (gleiche Instanz) → genau ein Write", async () => {
      const { processWebSocketMessage, getSuppressedMatchSnapshotCount } = await freshInstance();
      await processWebSocketMessage("autodarts.matches", snap(1, 1));
      await processWebSocketMessage("autodarts.matches", structuredClone(snap(1, 1)));
      await processWebSocketMessage("autodarts.matches", structuredClone(snap(1, 1)));
      expect(handle.setCallCount(GAME_KEY)).toBe(1);
      expect(getSuppressedMatchSnapshotCount()).toBe(2);
    });

    it("B2. Andere Kanäle werden NICHT dedupliziert: identische Turnier-Nachricht zweimal → zwei Writes", async () => {
      const { processWebSocketMessage } = await freshInstance();
      const payload = { id: "t-1", name: "Cup" } as any;
      await processWebSocketMessage("autodarts.tournaments", payload);
      await processWebSocketMessage("autodarts.tournaments", structuredClone(payload));
      expect(handle.setCallCount("tournament-data")).toBe(2);
    });

    it("B3. Zwei gleichzeitig eintreffende identische Snapshots (beide Reads vor dem ersten Write) → beide werden geschrieben", async () => {
      const { processWebSocketMessage, gameItem } = await freshInstance();
      const restore = delayGameDataReads(gameItem, [ 15, 15 ]);
      try {
        await Promise.all([
          processWebSocketMessage("autodarts.matches", snap(1, 1)),
          processWebSocketMessage("autodarts.matches", structuredClone(snap(1, 1))),
        ]);
      } finally {
        restore();
      }
      // Beide Reads liefern den Zustand VOR dem ersten Write (stored=undefined). Der zweite Aufruf
      // sieht state=Vorgänger (Achse 1 wahr), aber stored!=Snapshot (Achse 2 falsch) → verarbeitet.
      expect(handle.setCallCount(GAME_KEY)).toBe(2);
    });
  });

  describe("C. Stale / Out-of-Order", () => {
    it("C1. Ein älterer Snapshot nach einem neueren überschreibt den neueren Zustand (kein Reihenfolgeschutz)", async () => {
      const { processWebSocketMessage } = await freshInstance();
      await processWebSocketMessage("autodarts.matches", snap(2, 0));
      await processWebSocketMessage("autodarts.matches", snap(1, 1));
      expect((handle.raw(GAME_KEY) as any).match.round).toBe(1);
      expect(handle.setCallCount(GAME_KEY)).toBe(2);
    });

    it("C2. Reihenfolge der Verarbeitung hängt an der Abschlussreihenfolge des Storage-Reads: schneller Read des neueren Snapshots → der ältere (langsamer gelesen) landet zuletzt", async () => {
      const { processWebSocketMessage, gameItem } = await freshInstance();
      const restore = delayGameDataReads(gameItem, [ 40, 0 ]); // 1. Aufruf (älter) langsam, 2. Aufruf (neuer) sofort
      try {
        const older = processWebSocketMessage("autodarts.matches", snap(1, 1));
        const newer = processWebSocketMessage("autodarts.matches", snap(2, 0));
        await Promise.all([ older, newer ]);
      } finally {
        restore();
      }
      // Der zuerst gesendete (ältere) Snapshot schreibt zuletzt und gewinnt.
      expect((handle.raw(GAME_KEY) as any).match.round).toBe(1);
    });

    it("C3. Read-Modify-Write: Eine zwischenzeitliche Änderung anderer game-data-Felder geht verloren (…gameData wird aus dem früheren Read übernommen)", async () => {
      const { processWebSocketMessage, gameItem } = await freshInstance();
      handle.seed(GAME_KEY, { private: false, gameMode: "X01", match: undefined });
      const restore = delayGameDataReads(gameItem, [ 40 ]);
      try {
        const pending = processWebSocketMessage("autodarts.matches", snap(1, 0));
        // Während der Read noch läuft, ändert jemand anderes ein Geschwisterfeld.
        await new Promise((r) => setTimeout(r, 5));
        handle.seed(GAME_KEY, { private: true, gameMode: "X01", match: undefined });
        await pending;
      } finally {
        restore();
      }
      expect((handle.raw(GAME_KEY) as any).private).toBe(false);
      expect((handle.raw(GAME_KEY) as any).match.round).toBe(1);
    });
  });

  describe("E. Zwei-Tab-Konkurrenz (zwei Modulinstanzen, geteilter Storage)", () => {
    it("E1. Beide Tabs auf derselben Match-Seite verarbeiten denselben Snapshot unabhängig: zwei Writes (jeder Tab hat eigenen Dedupe-Zustand)", async () => {
      const tabA = await freshInstance();
      const tabB = await freshInstance();
      expect(tabA.processWebSocketMessage).not.toBe(tabB.processWebSocketMessage);
      await tabA.processWebSocketMessage("autodarts.matches", snap(1, 1));
      await tabB.processWebSocketMessage("autodarts.matches", structuredClone(snap(1, 1)));
      expect(handle.setCallCount(GAME_KEY)).toBe(2);
      expect(tabA.getSuppressedMatchSnapshotCount()).toBe(0);
      expect(tabB.getSuppressedMatchSnapshotCount()).toBe(0);
    });

    it("E2. Ein Tab auf einem anderen Match verwirft das Event; der Tab auf dem passenden Match schreibt", async () => {
      const tabA = await freshInstance();
      const tabB = await freshInstance();
      setUrl(OTHER_MATCH_ID);
      await tabA.processWebSocketMessage("autodarts.matches", snap(1, 1));
      expect(handle.setCallCount(GAME_KEY)).toBe(0);
      setUrl(MATCH_ID);
      await tabB.processWebSocketMessage("autodarts.matches", snap(1, 1));
      expect(handle.setCallCount(GAME_KEY)).toBe(1);
    });

    it("E3. Tab A sieht den neueren, Tab B den älteren Snapshot zuletzt → der geteilte Zustand ist der des zuletzt schreibenden Tabs (last-write-wins)", async () => {
      const tabA = await freshInstance();
      const tabB = await freshInstance();
      await tabA.processWebSocketMessage("autodarts.matches", snap(2, 0));
      await tabB.processWebSocketMessage("autodarts.matches", snap(1, 1));
      expect((handle.raw(GAME_KEY) as any).match.round).toBe(1);
    });
  });

  describe("F. Tab schließt – kein Ownership-Transfer", () => {
    it("F1. Es gibt kein Ownership-/Leader-Konzept: der verbleibende Tab verarbeitet seinen ersten Snapshot unabhängig (fail open, auch bei Gleichheit mit dem Speicher)", async () => {
      const closing = await freshInstance();
      await closing.processWebSocketMessage("autodarts.matches", snap(3, 1));
      // Tab "closing" wird nicht mehr aufgerufen (geschlossen). Verbleibender Tab:
      const surviving = await freshInstance();
      await surviving.processWebSocketMessage("autodarts.matches", structuredClone(snap(3, 1)));
      expect(handle.setCallCount(GAME_KEY)).toBe(2);
    });
  });

  describe("G. Timer", () => {
    it("G1. Jede 'autodarts.boards'-Nachricht registriert einen eigenen 500-ms-Timer, der nicht abgebrochen wird", async () => {
      const { processWebSocketMessage } = await freshInstance();
      const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
      await processWebSocketMessage("autodarts.boards", { id: "b-1", status: "Throw" } as any);
      await processWebSocketMessage("autodarts.boards", { id: "b-1", status: "Throw" } as any);
      const fiveHundred = timeoutSpy.mock.calls.filter((c) => c[1] === 500);
      expect(fiveHundred.length).toBe(2);
    });
  });
});
