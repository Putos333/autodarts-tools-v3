/**
 * serial-task-queue.ts – strikt sequenzielle Ausführung asynchroner Aufgaben (Runtime Hardening R1b).
 *
 * Zweck: Eingehende WebSocket-Nachrichten werden im Monitor nacheinander an den
 * Nachrichten-Verarbeiter übergeben, in der Reihenfolge ihres Eintreffens.
 * Ohne Queue läuft jede Nachricht als eigener, nicht awaited Aufruf; die
 * Abschlussreihenfolge der Storage-Reads bestimmt dann, welcher Snapshot
 * zuletzt schreibt (siehe tests/components/ws-processing-characterization…).
 *
 * Eigenschaften:
 *   - maximal eine Aufgabe läuft gleichzeitig, Reihenfolge = Einreihungsreihenfolge.
 *   - Eine abgelehnte oder synchron werfende Aufgabe blockiert die Queue nicht;
 *     der Fehler geht an `onError` (Standard: console.error).
 *   - Optionales `timeoutMs`: eine nie endende Aufgabe gibt die Queue nach Ablauf
 *     frei (`onTimeout`). Die Aufgabe selbst wird nicht abgebrochen; für sie
 *     entfällt ab dann die Reihenfolgegarantie. Der Timer wird nach jedem
 *     Abschluss gelöscht.
 *   - `dispose()` verwirft noch nicht gestartete Aufgaben und nimmt keine neuen
 *     an; eine bereits laufende Aufgabe endet normal.
 *   - `enqueue()` lehnt nie ab; das Promise ist erfüllt, sobald die Aufgabe
 *     beendet, abgelaufen oder verworfen ist.
 *
 * Das Modul ist import- und seiteneffektfrei (keine WXT-/Browser-Abhängigkeit),
 * damit es ohne Browserkontext testbar bleibt (tests/serial-task-queue.test.ts).
 * Es ändert weder Inhalt noch Bedeutung der verarbeiteten Nachrichten.
 */

export interface SerialTaskQueueOptions {
  /** Wird für jede fehlgeschlagene Aufgabe gerufen. Standard: console.error. */
  onError?: (error: unknown) => void;
  /** Maximale Laufzeit einer Aufgabe in ms; 0/undefiniert = kein Timeout. */
  timeoutMs?: number;
  /** Wird gerufen, wenn eine Aufgabe das Timeout überschreitet. */
  onTimeout?: () => void;
  /** Timer-Funktionen (nur für Tests austauschbar). */
  scheduler?: (cb: () => void, ms: number) => unknown;
  canceler?: (handle: unknown) => void;
}

export interface SerialTaskQueue {
  /** Reiht eine Aufgabe ein. Das Promise lehnt nie ab. */
  enqueue(task: () => unknown): Promise<void>;
  /** Verwirft noch nicht gestartete Aufgaben und nimmt keine neuen mehr an. */
  dispose(): void;
  /** Anzahl wartender plus laufender Aufgaben. */
  readonly pending: number;
}

export function createSerialTaskQueue(options: SerialTaskQueueOptions = {}): SerialTaskQueue {
  const {
    onError = (error: unknown) => console.error(error),
    timeoutMs = 0,
    onTimeout,
    scheduler = (cb: () => void, ms: number) => setTimeout(cb, ms),
    canceler = (handle: unknown) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  } = options;

  let tail: Promise<void> = Promise.resolve();
  let pending = 0;
  let disposed = false;

  // Die Callbacks dürfen die Queue nie vergiften: ein werfendes onError/onTimeout
  // würde sonst die Promise-Kette ablehnen und alle folgenden Aufgaben blockieren.
  const reportError = (error: unknown) => { try { onError(error); } catch { /* ignorieren */ } };
  const reportTimeout = () => { try { onTimeout?.(); } catch { /* ignorieren */ } };

  async function run(task: () => unknown): Promise<void> {
    if (disposed) {
      pending--;
      return;
    }

    let handle: unknown;
    let hasTimer = false;
    let timedOut = false;
    try {
      // Promise.resolve().then fängt auch synchrone Würfe der Aufgabe ab.
      const result = Promise.resolve().then(task);
      if (timeoutMs > 0) {
        const timeout = new Promise<void>((resolve) => {
          handle = scheduler(() => { timedOut = true; resolve(); }, timeoutMs);
          hasTimer = true;
        });
        await Promise.race([ result, timeout ]);
        if (timedOut) {
          // Die Aufgabe läuft weiter; ein späterer Fehler soll nicht unbehandelt bleiben.
          result.catch((error) => reportError(error));
          reportTimeout();
        }
      } else {
        await result;
      }
    } catch (error) {
      reportError(error);
    } finally {
      if (hasTimer) canceler(handle);
      pending--;
    }
  }

  return {
    enqueue(task) {
      if (disposed) return Promise.resolve();
      pending++;
      const done = tail.then(() => run(task));
      tail = done;
      return done;
    },
    dispose() {
      disposed = true;
    },
    get pending() {
      return pending;
    },
  };
}
