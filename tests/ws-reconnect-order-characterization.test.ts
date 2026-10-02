/**
 * Bauphase 2.0 – PKG-1: Charakterisierungstests WS-Reconnect / Out-of-Order / Multi-Tab.
 *
 * Diese Tests halten das BESTEHENDE Verhalten fest (Stand HEAD 9158b35). Sie
 * bewerten es nicht und ändern nichts am Produktcode. Sie sind bewusst als
 * "characterization" markiert: Wird später absichtlich ein Resync-, Reihenfolge-
 * oder Multi-Tab-Schutz eingebaut, müssen die betroffenen Tests gezielt und
 * begründet angepasst werden – ein roter Test hier ist dann ein Signal, kein Bug.
 *
 * Teil A/B: Verhalten von utils/event-dedupe.ts (Protected Core, nur importiert).
 * Teil C:   Quelltext-Verträge (wie in den bestehenden *.test.ts) für den
 *           WebSocket-Monitor und die fehlenden Mechanismen.
 *
 *   node --import tsx --test tests/ws-reconnect-order-characterization.test.ts
 */

import { strict as assert } from "node:assert";
import { readFile, readdir } from "node:fs/promises";
import { describe, it } from "node:test";

import { createDedupeState, shouldProcessSnapshot } from "../utils/event-dedupe";

const MATCH_ID = "3f8b1c2a-4d5e-4f60-9a1b-2c3d4e5f6071";

/** Voller Snapshot wie auf `autodarts.matches` (keine Deltas). */
function snap(round: number, throwsCount: number) {
  return {
    id: MATCH_ID,
    round,
    player: 0,
    finished: false,
    turns: [ { id: `turn-${round}`, round, throws: Array.from({ length: throwsCount }, (_, i) => ({ id: `t${i}` })) } ],
  };
}

describe("A. Reconnect – Verhalten von shouldProcessSnapshot (Charakterisierung)", () => {
  it("A1. Reconnect ohne Reload, voller Snapshot identisch zu Vorgänger UND Speicher → unterdrückt (kein Watcher-Refire)", () => {
    const state = createDedupeState();
    const s = snap(1, 2);
    assert.equal(shouldProcessSnapshot(state, MATCH_ID, s, undefined), true);
    // "Reconnect": Autodarts sendet denselben vollen Zustand erneut.
    assert.equal(shouldProcessSnapshot(state, MATCH_ID, structuredClone(s), structuredClone(s)), false);
    assert.equal(state.suppressed, 1);
  });

  it("A2. Reconnect ohne Reload, Zustand hat sich während der Trennung geändert → neuer voller Snapshot wird verarbeitet", () => {
    const state = createDedupeState();
    const before = snap(1, 2);
    const after = snap(2, 0);
    shouldProcessSnapshot(state, MATCH_ID, before, undefined);
    assert.equal(shouldProcessSnapshot(state, MATCH_ID, after, before), true);
  });

  it("A3. Während der Trennung hat ein anderer Pfad (z.B. REST-Bootstrap) den Speicher verändert; der Reconnect-Snapshot entspricht dem alten Vorgänger → verarbeitet (Achse 2 unterscheidet)", () => {
    const state = createDedupeState();
    const a = snap(1, 1);
    const b = snap(2, 0);
    shouldProcessSnapshot(state, MATCH_ID, a, undefined);
    // Fremd-Write setzt den Speicher auf b; der Reconnect liefert wieder a.
    assert.equal(shouldProcessSnapshot(state, MATCH_ID, a, b), true);
  });

  it("A4. Reload nach Reconnect (neue Instanz): erster Snapshot passiert immer, auch bei Gleichheit mit dem Speicher (kostet genau einen Write)", () => {
    const fresh = createDedupeState();
    const s = snap(3, 1);
    assert.equal(shouldProcessSnapshot(fresh, MATCH_ID, s, structuredClone(s)), true);
    assert.equal(shouldProcessSnapshot(fresh, MATCH_ID, structuredClone(s), structuredClone(s)), false);
  });

  it("A5. Die Dedupe-Logik selbst kennt kein Konzept von Verbindungsstatus oder Resync", async () => {
    const text = await readFile(new URL("../utils/event-dedupe.ts", import.meta.url), "utf8");
    // Nur ausführbaren Code prüfen, nicht den erklärenden Kopfkommentar.
    const code = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(code, /reconnect|resync|connected|openSockets|Date\.now|performance\.now/i);
  });
});

describe("B. Out-of-Order – kein Reihenfolgeschutz (Charakterisierung der BEKANNTEN Lücke)", () => {
  it("B1. Ein älterer Snapshot nach einem neueren wird NICHT verworfen, sondern als neuer Zustand verarbeitet", () => {
    const state = createDedupeState();
    const older = snap(1, 1);
    const newer = snap(2, 0);
    assert.equal(shouldProcessSnapshot(state, MATCH_ID, older, undefined), true);
    assert.equal(shouldProcessSnapshot(state, MATCH_ID, newer, older), true);
    // Verspäteter alter Snapshot (Speicher steht auf newer):
    assert.equal(shouldProcessSnapshot(state, MATCH_ID, older, newer), true);
  });

  it("B2. Flip-Flop: neu → alt → neu wird jedes Mal verarbeitet (der Zustand wird dreimal überschrieben)", () => {
    const state = createDedupeState();
    const older = snap(1, 1);
    const newer = snap(2, 0);
    shouldProcessSnapshot(state, MATCH_ID, newer, undefined);
    assert.equal(shouldProcessSnapshot(state, MATCH_ID, older, newer), true);
    assert.equal(shouldProcessSnapshot(state, MATCH_ID, newer, older), true);
  });

  it("B3. Veralteter Speicher-Read (nicht awaited setValue): Vorgänger gleich, Speicher noch alt → verarbeitet (fail open, ein redundanter Write)", () => {
    const state = createDedupeState();
    const older = snap(1, 1);
    const newer = snap(2, 0);
    shouldProcessSnapshot(state, MATCH_ID, newer, older);
    assert.equal(shouldProcessSnapshot(state, MATCH_ID, newer, older), true);
  });

  it("B4. Die Entscheidung hängt ausschließlich am Byte-Vergleich: Round/Turn-Felder werden nicht als Ordnung ausgewertet", () => {
    const state = createDedupeState();
    const higherRound = snap(9, 3);
    const lowerRound = snap(1, 0);
    shouldProcessSnapshot(state, MATCH_ID, higherRound, undefined);
    assert.equal(shouldProcessSnapshot(state, MATCH_ID, lowerRound, higherRound), true);
  });

  it("B5. processWebSocketMessage('autodarts.matches') ordnet nicht: kein Sequenz-/Zeitstempelvergleich vor setValue", async () => {
    const text = await readFile(new URL("../utils/websocket-helpers.ts", import.meta.url), "utf8");
    const start = text.indexOf('case "autodarts.matches"');
    assert.ok(start > 0, "Case autodarts.matches nicht gefunden");
    const end = text.indexOf("break;", start);
    const block = text.slice(start, end);
    assert.match(block, /shouldProcessSnapshot\(/);
    assert.doesNotMatch(block, /sequence|seqNo|serverTime|updatedAt|timestamp|Date\.now/i);
  });
});

describe("C. Multi-Tab / WS-Monitor – Quelltext-Verträge (Charakterisierung)", () => {
  it("C1. Dedupe-Zustand ist pro Instanz: zwei Instanzen (Tabs) unterdrücken unabhängig voneinander", () => {
    const tabA = createDedupeState();
    const tabB = createDedupeState();
    const s = snap(1, 1);
    assert.equal(shouldProcessSnapshot(tabA, MATCH_ID, s, undefined), true);
    assert.equal(shouldProcessSnapshot(tabA, MATCH_ID, structuredClone(s), structuredClone(s)), false);
    // Tab B kennt den Vorgänger nicht → derselbe Payload passiert dort einmal, obwohl der Speicher identisch ist.
    assert.equal(shouldProcessSnapshot(tabB, MATCH_ID, structuredClone(s), structuredClone(s)), true);
    assert.equal(tabA.suppressed, 1);
    assert.equal(tabB.suppressed, 0);
  });

  it("C2. Kein Multi-Tab-Mechanismus für Match-/Spielzustand: BroadcastChannel kommt nur im Buzzer-Feature vor (Tab-ID/Leader nirgends)", async () => {
    const dirs = [ "utils", "entrypoints", "composables", "components" ];
    const hits: string[] = [];
    async function walk(rel: string): Promise<void> {
      const entries = await readdir(new URL(`../${rel}`, import.meta.url), { withFileTypes: true });
      for (const e of entries) {
        const p = `${rel}/${e.name}`;
        if (e.isDirectory()) await walk(p);
        else if (/\.(ts|vue|js)$/.test(e.name)) {
          const text = await readFile(new URL(`../${p}`, import.meta.url), "utf8");
          if (/BroadcastChannel|leader.?election|ownerTabId|\btabOwner\b/i.test(text)) hits.push(p);
        }
      }
    }
    for (const d of dirs) await walk(d);
    // buzzer.ts nutzt BroadcastChannel nur für sein eigenes Buzzer-Fenster; er schützt keinen Match-/Storage-Zustand.
    assert.deepEqual(hits, [ "entrypoints/match.content/buzzer.ts" ]);
  });

  it("C3. Der WS-Monitor behandelt 'disconnected' mit Toast und 'connected' mit Ausblenden; kein Resync-Aufruf", async () => {
    const text = await readFile(new URL("../entrypoints/websocket-monitor.content.ts", import.meta.url), "utf8");
    assert.match(text, /detail\.status === 'disconnected'\)\s*\{\s*showWsDisconnectToast/);
    assert.match(text, /detail\.status === 'connected'\)\s*\{\s*hideWsDisconnectToast\(\)/);
    // Reload ist der einzige Wiederherstellungsweg.
    assert.match(text, /data-testid="adt-ws-reload"[\s\S]*?addEventListener\('click', \(\) => location\.reload\(\)\)/);
    assert.doesNotMatch(text, /resync|bootstrap|fetchMatch|resubscribe|getMatch/i);
  });

  it("C4. Status 'error' löst keinen Toast aus (nur 'disconnected')", async () => {
    const text = await readFile(new URL("../entrypoints/websocket-monitor.content.ts", import.meta.url), "utf8");
    assert.doesNotMatch(text, /status === 'error'[\s\S]{0,40}showWsDisconnectToast/);
  });

  it("C5. Der Capture-Hook beobachtet nur (open/close/error) und verwaltet keine Wiederverbindung", async () => {
    const text = await readFile(new URL("../entrypoints/websocket-capture.ts", import.meta.url), "utf8");
    assert.match(text, /addEventListener\('open'/);
    assert.match(text, /addEventListener\('close'/);
    assert.match(text, /addEventListener\('error'/);
    assert.match(text, /openSockets === 0 \? 'disconnected' : 'connected'/);
    assert.doesNotMatch(text, /new WebSocket\([^)]*\)\s*;?\s*\/\/\s*reconnect|setTimeout\([^)]*connect/i);
  });

  it("C6. 'adt-ws-status' ist ein roher, globaler storage.local-Key ohne Tab-Zuordnung (last-write-wins)", async () => {
    const text = await readFile(new URL("../entrypoints/websocket-monitor.content.ts", import.meta.url), "utf8");
    const m = text.match(/'adt-ws-status': \{([\s\S]*?)\},\s*\}\)/);
    assert.ok(m, "adt-ws-status-Write nicht gefunden");
    assert.match(m[1], /status:/);
    assert.match(m[1], /openSockets:/);
    assert.match(m[1], /when:/);
    assert.doesNotMatch(m[1], /tabId|tab:|owner/i);
  });
});
