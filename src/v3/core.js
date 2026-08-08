(() => {
  'use strict';

  if (globalThis.AutodartsToolsV3) return;

  const VERSION = '3.0.0-alpha.4';
  const modules = new Map();
  const events = new EventTarget();
  const state = { startedAt: Date.now(), route: location.pathname, errors: [] };

  const log = {
    debug: (...args) => { if (localStorage.getItem('adt:v3:debug') === '1') console.debug('[ADT v3]', ...args); },
    info: (...args) => console.info('[ADT v3]', ...args),
    warn: (...args) => console.warn('[ADT v3]', ...args),
    error: (...args) => console.error('[ADT v3]', ...args),
  };

  function emit(type, detail) {
    events.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function on(type, listener, options) {
    events.addEventListener(type, listener, options);
    return () => events.removeEventListener(type, listener, options);
  }

  function registerModule(module) {
    if (!module?.id || typeof module.start !== 'function') throw new TypeError('Invalid v3 module');
    if (modules.has(module.id)) return modules.get(module.id);
    const record = { module, status: 'registered', error: null };
    modules.set(module.id, record);
    return record;
  }

  async function startModule(id) {
    const record = modules.get(id);
    if (!record || record.status === 'running') return record;
    try {
      await record.module.start();
      record.status = 'running';
      emit('module:started', { id });
    } catch (error) {
      record.status = 'error';
      record.error = error;
      state.errors.push({ id, message: String(error?.message || error), at: Date.now() });
      log.error(`Module ${id} failed`, error);
    }
    return record;
  }

  async function stopModule(id) {
    const record = modules.get(id);
    if (!record || record.status !== 'running') return record;
    try { await record.module.stop?.(); } finally { record.status = 'stopped'; }
    return record;
  }

  const api = Object.freeze({
    version: VERSION,
    state,
    log,
    emit,
    on,
    registerModule,
    startModule,
    stopModule,
    snapshot() {
      return {
        version: VERSION,
        state: { ...state, errors: [...state.errors] },
        modules: [...modules.entries()].map(([id, r]) => ({ id, status: r.status, error: r.error ? String(r.error) : null })),
      };
    },
  });

  Object.defineProperty(globalThis, 'AutodartsToolsV3', { value: api, configurable: false, writable: false });

  let lastRoute = location.href;
  const notifyRoute = () => {
    if (location.href === lastRoute) return;
    const previous = lastRoute;
    lastRoute = location.href;
    state.route = location.pathname;
    emit('route:change', { previous, current: lastRoute });
  };
  addEventListener('popstate', notifyRoute);
  const pushState = history.pushState.bind(history);
  history.pushState = (...args) => { const result = pushState(...args); queueMicrotask(notifyRoute); return result; };
  const replaceState = history.replaceState.bind(history);
  history.replaceState = (...args) => { const result = replaceState(...args); queueMicrotask(notifyRoute); return result; };
})();