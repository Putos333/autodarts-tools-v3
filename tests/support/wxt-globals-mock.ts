/**
 * Verhaltensbasierter Test-Harness für match.content/*.ts-Module.
 *
 * Diese Module referenzieren `browser` und `storage` als von WXT (unplugin-
 * auto-import + `wxt/storage`) bereitgestellte globale Bezeichner — real nur
 * innerhalb des Vite/WXT-Build-Kontexts vorhanden. Für echte
 * Verhaltenstests (kein Source-Text-Match) außerhalb dieses Build-Kontexts
 * müssen `globalThis.storage`/`globalThis.browser` VOR dem Import der
 * Zielmodule mit einer vertragskonformen Nachbildung belegt werden — exakt
 * dieselbe `storage.defineItem()`/`browser.storage.local`-Semantik wie die
 * echte `wxt/storage`-Runtime (get/set/remove + `onChanged`-Listener),
 * sodass die echten Produktionsmodule (`@/utils/*.ts`) unverändert geladen
 * und ausgeführt werden — nicht ihre Geschäftslogik neu nachgebaut wird.
 *
 * Muss vor jedem `await import("@/entrypoints/match.content/...")`
 * aufgerufen werden (Modul-Top-Level-Auswertung liest `storage`/`browser`
 * bereits beim Laden).
 */

type Listener = (changes: Record<string, { oldValue: unknown; newValue: unknown }>, area: string) => unknown;

export interface MockStorageHandle {
  /** Rohwert direkt im Store setzen (Testvorbereitung), ohne über setValue()/set() zu gehen. */
  seed(key: string, value: unknown): void;
  /** Rohwert direkt lesen (Testassertion). */
  raw(key: string): unknown;
  /** Wie oft `browser.storage.local.get()` für genau diesen Key aufgerufen wurde. */
  getCallCount(key: string): number;
  /** Wie oft `browser.storage.local.remove()` für genau diesen Key aufgerufen wurde. */
  removeCallCount(key: string): number;
  /** Wie oft `browser.storage.local.set()` für genau diesen Key aufgerufen wurde. */
  setCallCount(key: string): number;
  reset(): void;
}

export function installWxtGlobals(): MockStorageHandle {
  const store = new Map<string, unknown>();
  const listeners = new Set<Listener>();
  const getCounts = new Map<string, number>();
  const removeCounts = new Map<string, number>();
  const setCounts = new Map<string, number>();

  function bump(map: Map<string, number>, key: string): void {
    map.set(key, (map.get(key) ?? 0) + 1);
  }

  /**
   * Ruft alle Listener auf und wartet auf deren Rückgabewerte, falls Promises
   * — sonst würde `await setValue(...)` im Test zurückkehren, bevor der
   * produktive (async) Watch-Callback fertig gelaufen ist, und Assertions
   * direkt danach wären eine Race-Condition im Test-Harness selbst.
   */
  async function fireChange(changes: Record<string, { oldValue: unknown; newValue: unknown }>): Promise<void> {
    if (Object.keys(changes).length === 0) return;
    for (const fn of listeners) {
      const result = fn(changes, "local") as unknown;
      if (result && typeof (result as Promise<unknown>).then === "function") {
        await (result as Promise<unknown>);
      }
    }
  }

  async function get(keys?: string | string[] | Record<string, unknown> | null): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};
    if (keys == null) {
      for (const [ k, v ] of store) result[k] = v;
    } else if (typeof keys === "string") {
      bump(getCounts, keys);
      if (store.has(keys)) result[keys] = store.get(keys);
    } else if (Array.isArray(keys)) {
      for (const k of keys) {
        bump(getCounts, k);
        if (store.has(k)) result[k] = store.get(k);
      }
    } else {
      for (const k of Object.keys(keys)) {
        bump(getCounts, k);
        result[k] = store.has(k) ? store.get(k) : (keys as Record<string, unknown>)[k];
      }
    }
    return result;
  }

  async function set(items: Record<string, unknown>): Promise<void> {
    const changes: Record<string, { oldValue: unknown; newValue: unknown }> = {};
    for (const k of Object.keys(items)) {
      bump(setCounts, k);
      const oldValue = store.get(k);
      store.set(k, items[k]);
      changes[k] = { oldValue, newValue: items[k] };
    }
    await fireChange(changes);
  }

  async function remove(keys: string | string[]): Promise<void> {
    const list = Array.isArray(keys) ? keys : [ keys ];
    const changes: Record<string, { oldValue: unknown; newValue: unknown }> = {};
    for (const k of list) {
      bump(removeCounts, k);
      if (store.has(k)) {
        changes[k] = { oldValue: store.get(k), newValue: undefined };
        store.delete(k);
      }
    }
    await fireChange(changes);
  }

  const onChanged = {
    addListener(fn: Listener) { listeners.add(fn); },
    removeListener(fn: Listener) { listeners.delete(fn); },
  };

  // `utils/helpers.ts` instanziiert beim Laden `new Audio()` (Modul-Top-Level-
  // Seiteneffekt, DOM-API) — Produktionscode bewusst unverändert, hier nur
  // ein minimaler No-Op-Stub, damit der Import unter Node nicht crasht.
  if (typeof (globalThis as any).Audio === "undefined") {
    (globalThis as any).Audio = class {
      preload = "";
      play() { return Promise.resolve(); }
      pause() {}
      addEventListener() {}
      removeEventListener() {}
    };
  }

  (globalThis as any).browser = {
    storage: {
      local: { get, set, remove, onChanged },
      onChanged,
    },
    runtime: { id: "test-harness" },
  };

  // Vertragskonforme Nachbildung von `wxt/storage`'s `storage.defineItem()` —
  // dieselbe Semantik wie die echte Runtime: `local:xyz` -> Treiber "local",
  // realer Storage-Key "xyz" (Präfix wird abgeschnitten), watch() filtert
  // `browser.storage.local.onChanged` auf genau diesen Key.
  (globalThis as any).storage = {
    defineItem(fullKey: string, opts?: { defaultValue?: unknown }) {
      const key = fullKey.includes(":") ? fullKey.slice(fullKey.indexOf(":") + 1) : fullKey;
      return {
        async getValue() {
          const result = await get(key);
          return key in result ? result[key] : opts?.defaultValue;
        },
        async setValue(value: unknown) {
          if (value === undefined) await remove(key);
          else await set({ [key]: value });
        },
        watch(cb: (newValue: unknown, oldValue: unknown) => unknown) {
          // WICHTIG: `cb`s Rückgabewert muss durchgereicht werden — sonst
          // wartet `fireChange()` (s.o.) nie auf einen asynchronen
          // Watch-Callback, und `await setValue(...)` im Test kehrt zurück,
          // bevor der produktive Callback fertig gelaufen ist.
          const listener: Listener = (changes) => {
            const change = changes[key];
            if (!change) return undefined;
            return cb(change.newValue, change.oldValue);
          };
          onChanged.addListener(listener);
          return () => onChanged.removeListener(listener);
        },
      };
    },
  };

  return {
    seed(key, value) { store.set(key, value); },
    raw(key) { return store.get(key); },
    getCallCount(key) { return getCounts.get(key) ?? 0; },
    removeCallCount(key) { return removeCounts.get(key) ?? 0; },
    setCallCount(key) { return setCounts.get(key) ?? 0; },
    reset() {
      store.clear();
      listeners.clear();
      getCounts.clear();
      removeCounts.clear();
      setCounts.clear();
    },
  };
}

/** Baut einen syntaktisch gültigen (unsignierten) JWT-String mit gegebenem `sub`-Claim — exakt, was `getUserIdFromToken()` per `atob()` dekodiert. */
export function fakeJwt(sub: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64");
  const payload = Buffer.from(JSON.stringify({ sub })).toString("base64");
  return `${header}.${payload}.signature`;
}
