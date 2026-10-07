/**
 * Runtime Hardening R1b – Unit tests für utils/serial-task-queue.ts.
 *
 * Die Queue ist framework-agnostisch (keine WXT-/Browser-Imports) und wird vom
 * WebSocket-Monitor genutzt, damit eingehende Nachrichten strikt nacheinander
 * verarbeitet werden. Sie ändert nichts an Inhalt oder Bedeutung der Nachrichten.
 *
 *   node --import tsx --test tests/serial-task-queue.test.ts
 */

import { strict as assert } from "node:assert";
import { describe, it } from "node:test";

import { createSerialTaskQueue } from "../utils/serial-task-queue";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

describe("createSerialTaskQueue", () => {
  it("1. führt Aufgaben strikt in Einreihungsreihenfolge aus, auch wenn frühere länger dauern", async () => {
    const q = createSerialTaskQueue();
    const order: string[] = [];
    const a = q.enqueue(async () => { await sleep(40); order.push("a"); });
    const b = q.enqueue(async () => { await sleep(5); order.push("b"); });
    const c = q.enqueue(async () => { order.push("c"); });
    await Promise.all([ a, b, c ]);
    assert.deepEqual(order, [ "a", "b", "c" ]);
  });

  it("2. Aufgaben laufen nie überlappend (maximal eine gleichzeitig)", async () => {
    const q = createSerialTaskQueue();
    let running = 0;
    let maxRunning = 0;
    const tasks = Array.from({ length: 12 }, (_, i) => q.enqueue(async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await sleep(i % 3);
      running--;
    }));
    await Promise.all(tasks);
    assert.equal(maxRunning, 1);
  });

  it("3. viele schnell hintereinander eingereihte Aufgaben behalten ihre Reihenfolge (200 Stück)", async () => {
    const q = createSerialTaskQueue();
    const seen: number[] = [];
    const all: Promise<void>[] = [];
    for (let i = 0; i < 200; i++) all.push(q.enqueue(async () => { if (i % 7 === 0) await sleep(1); seen.push(i); }));
    await Promise.all(all);
    assert.deepEqual(seen, Array.from({ length: 200 }, (_, i) => i));
  });

  it("4. eine abgelehnte (async) Aufgabe blockiert die Queue nicht und wird an onError gemeldet", async () => {
    const errors: unknown[] = [];
    const q = createSerialTaskQueue({ onError: (e: unknown) => errors.push(e) });
    const order: string[] = [];
    const a = q.enqueue(async () => { order.push("a"); throw new Error("boom"); });
    const b = q.enqueue(async () => { order.push("b"); });
    await Promise.all([ a, b ]);
    assert.deepEqual(order, [ "a", "b" ]);
    assert.equal(errors.length, 1);
    assert.match(String((errors[0] as Error).message), /boom/);
  });

  it("5. eine synchron werfende Aufgabe blockiert die Queue nicht", async () => {
    const errors: unknown[] = [];
    const q = createSerialTaskQueue({ onError: (e: unknown) => errors.push(e) });
    const ran: string[] = [];
    const a = q.enqueue((() => { throw new Error("sync-boom"); }) as () => Promise<void>);
    const b = q.enqueue(async () => { ran.push("b"); });
    await Promise.all([ a, b ]);
    assert.deepEqual(ran, [ "b" ]);
    assert.equal(errors.length, 1);
  });

  it("6. enqueue() lehnt selbst nie ab (auch wenn die Aufgabe ablehnt)", async () => {
    const q = createSerialTaskQueue({ onError: () => {} });
    await assert.doesNotReject(q.enqueue(async () => { throw new Error("x"); }));
  });

  it("7. eine nie endende Aufgabe wird nach timeoutMs freigegeben; die nächste läuft; onTimeout wird gerufen", async () => {
    let timeouts = 0;
    const q = createSerialTaskQueue({ timeoutMs: 30, onTimeout: () => { timeouts++; } });
    const order: string[] = [];
    const hang = q.enqueue(() => new Promise<void>(() => { /* never settles */ }));
    const next = q.enqueue(async () => { order.push("next"); });
    await Promise.all([ hang, next ]);
    assert.deepEqual(order, [ "next" ]);
    assert.equal(timeouts, 1);
  });

  it("8. Timeout-Timer werden nach normalem Abschluss wieder gelöscht (kein hängender Timer pro Aufgabe)", async () => {
    const active = new Set<number>();
    let nextId = 1;
    const q = createSerialTaskQueue({
      timeoutMs: 1000,
      scheduler: (cb: () => void, ms: number) => { const id = nextId++; active.add(id); void cb; void ms; return id; },
      canceler: (h: unknown) => { active.delete(h as number); },
    });
    await Promise.all([ q.enqueue(async () => {}), q.enqueue(async () => { await sleep(2); }) ]);
    assert.equal(active.size, 0);
  });

  it("9. dispose() verwirft noch nicht gestartete Aufgaben und ignoriert spätere enqueue()-Aufrufe", async () => {
    const q = createSerialTaskQueue();
    const ran: string[] = [];
    const a = q.enqueue(async () => { await sleep(20); ran.push("a"); });
    const b = q.enqueue(async () => { ran.push("b"); });
    await sleep(5); // a hat bereits gestartet
    q.dispose();
    const c = q.enqueue(async () => { ran.push("c"); });
    await Promise.all([ a, b, c ]);
    assert.deepEqual(ran, [ "a" ]); // a lief schon; b wurde verworfen, c nie angenommen
    assert.equal(q.pending, 0);
  });

  it("10. pending zählt wartende + laufende Aufgaben und fällt auf 0", async () => {
    const q = createSerialTaskQueue();
    const a = q.enqueue(async () => { await sleep(10); });
    const b = q.enqueue(async () => {});
    assert.equal(q.pending, 2);
    await Promise.all([ a, b ]);
    assert.equal(q.pending, 0);
  });

  it("12. ein werfendes onError/onTimeout vergiftet die Queue nicht: enqueue() lehnt weiter nie ab und nachfolgende Aufgaben laufen", async () => {
    const q = createSerialTaskQueue({
      timeoutMs: 20,
      onError: () => { throw new Error("onError kaputt"); },
      onTimeout: () => { throw new Error("onTimeout kaputt"); },
    });
    const ran: string[] = [];
    await assert.doesNotReject(q.enqueue(async () => { throw new Error("task"); }));
    await assert.doesNotReject(q.enqueue(() => new Promise<void>(() => {})));
    await q.enqueue(async () => { ran.push("danach"); });
    assert.deepEqual(ran, [ "danach" ]);
  });

  it("11. zwei Queues sind unabhängig (Neuinitialisierung beginnt leer und blockiert nicht an der alten)", async () => {
    const old = createSerialTaskQueue();
    old.enqueue(() => new Promise<void>(() => {}));
    const fresh = createSerialTaskQueue();
    const ran: string[] = [];
    await fresh.enqueue(async () => { ran.push("fresh"); });
    assert.deepEqual(ran, [ "fresh" ]);
    old.dispose();
  });
});
