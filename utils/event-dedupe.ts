/**
 * event-dedupe.ts – Exakte Duplikat-Unterdrückung für Socket-Snapshots (P1 Schritt 1)
 *
 * Autodarts liefert auf `autodarts.matches` vollständige Snapshots, keine Deltas.
 * Ein byte-identischer Folge-Snapshot löst über AutodartsToolsGameData.watch
 * trotzdem sämtliche registrierten Watcher aus, obwohl sich nichts geändert hat.
 *
 * Unterdrückt wird nur, was auf ZWEI unabhängigen Achsen exakt identisch ist:
 *
 *   Achse 1 – identisch zum unmittelbar vorherigen Payload dieser Instanz.
 *   Achse 2 – identisch zum tatsächlich gespeicherten Zustand.
 *
 * Beide sind nötig, weil jede allein eine Lücke hat:
 *
 *   • Nur Achse 1: Content-Scripts laufen als getrennte Bundles mit je eigener
 *     Modul-Instanz (Socket-Pfad vs. REST-Bootstrap), schreiben aber in dasselbe
 *     Storage-Item. Ein Fremd-Write bleibt für Achse 1 unsichtbar, und ein danach
 *     eintreffender identischer Snapshot würde fälschlich unterdrückt – der
 *     ältere Fremd-Wert bliebe stehen.
 *   • Nur Achse 2: `getValue()` hat keinen Cache (@wxt-dev/storage) und die
 *     `setValue()`-Aufrufe sind nicht awaited. Ein veralteter Read während eines
 *     laufenden Writes könnte eine legitime Zustandsrückkehr A → B → A als
 *     „unverändert" einstufen.
 *
 * Die Konjunktion ist strikt konservativer als jede Achse allein: unterdrückt
 * wird ausschließlich ein beweisbar wirkungsloser Write.
 *
 * Weitere Regeln – im Zweifel wird NICHT unterdrückt:
 *
 *   1. Verglichen wird nie gegen ein Set aller je gesehenen Payloads, sondern
 *      immer nur gegen den direkten Vorgänger. Eine legitime Zustandsrückkehr
 *      A → B → A (z.B. Edit-Modus/Undo) bleibt dadurch erhalten.
 *   2. Ohne stabile Identität (nicht-leerer String) wird nicht dedupliziert und
 *      der gemerkte Zustand verworfen → fail open.
 *   3. Nicht serialisierbare Payloads (Zyklen o.ä.) → fail open.
 *   4. Der Zustand lebt im Modul-Scope des Aufrufers. Nach Reload / neuer Instanz
 *      ist er leer, der erste Payload passiert also immer – auch dann, wenn er
 *      zufällig dem gespeicherten Zustand entspricht. Das kostet genau einen
 *      wirkungslosen Write pro Instanz und hat Vorrang vor maximaler Unterdrückung.
 *
 * Es gibt bewusst KEINE Zeitfenster-, Schwellwert-, Recency- oder sonstige
 * Heuristik: verglichen wird ausschließlich byteweise.
 *
 * Die Vergleichstechnik (JSON.stringify-Gleichheit) entspricht dem bereits
 * produktiv genutzten hasConfigChanged() aus utils/storage.ts.
 *
 * Dieses Modul ist absichtlich import- und seiteneffektfrei, damit es ohne
 * Browser-/WXT-Kontext testbar bleibt (tests/event-dedupe.test.ts).
 */

export interface IDedupeState {
  /** Identität des zuletzt durchgelassenen Payloads (null = kein Zustand). */
  id: string | null;
  /** Serialisierung des zuletzt durchgelassenen Payloads (null = kein Zustand). */
  json: string | null;
  /** Anzahl bisher unterdrückter exakter Duplikate (reine Diagnose). */
  suppressed: number;
}

/** Frischer Zustand – entspricht dem Zustand nach einem Reload. */
export function createDedupeState(): IDedupeState {
  return { id: null, json: null, suppressed: 0 };
}

/**
 * Verwirft den gemerkten Payload. Der nächste Snapshot passiert danach
 * garantiert. Der Diagnose-Zähler bleibt erhalten.
 */
export function resetDedupeState(state: IDedupeState): void {
  state.id = null;
  state.json = null;
}

/**
 * JSON.stringify ohne Wurf. Liefert undefined, wenn keine belastbare
 * Serialisierung möglich ist (Zyklus, undefined-Wert).
 */
function safeStringify(value: unknown): string | undefined {
  try {
    const json = JSON.stringify(value);
    return typeof json === "string" ? json : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Entscheidet, ob ein eingehender Snapshot verarbeitet werden soll, und
 * aktualisiert dabei `state`.
 *
 * @param state    Modul-Zustand des Aufrufers (siehe createDedupeState)
 * @param id       Stabile Identität des Snapshots, z.B. IMatch.id
 * @param incoming Der rohe, unveränderte Snapshot
 * @param stored   Der aktuell gespeicherte Zustand, gegen den geschrieben würde
 * @returns        true = verarbeiten (Default), false = beweisbar wirkungslos
 */
export function shouldProcessSnapshot(
  state: IDedupeState,
  id: unknown,
  incoming: unknown,
  stored: unknown,
): boolean {
  // Regel 2: keine stabile Identität → fail open. Der gemerkte Zustand wird
  // verworfen, weil ein durchgelassener Payload ohne ID den gespeicherten
  // Zustand verändert haben kann; ein danach erneut eintreffender älterer
  // Payload wäre dann eine echte Änderung und darf nicht unterdrückt werden.
  if (typeof id !== "string" || id.length === 0) {
    resetDedupeState(state);
    return true;
  }

  // Regel 3 / Regel 1: nicht serialisierbar → fail open.
  const incomingJson = safeStringify(incoming);
  if (incomingJson === undefined) {
    resetDedupeState(state);
    return true;
  }

  // Achse 1 – identisch zum direkten Vorgänger dieser Instanz.
  // Nach Reload / neuer Instanz ist state leer, die Achse also immer falsch.
  const sameAsPrevious = state.id === id && state.json === incomingJson;

  // Achse 2 – identisch zum tatsächlich gespeicherten Zustand. Ein nicht
  // serialisierbarer oder fehlender gespeicherter Wert gilt als "verschieden".
  const storedJson = safeStringify(stored);
  const sameAsStored = storedJson !== undefined && storedJson === incomingJson;

  if (sameAsPrevious && sameAsStored) {
    state.suppressed++;
    return false;
  }

  state.id = id;
  state.json = incomingJson;
  return true;
}
