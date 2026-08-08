(() => {
  'use strict';

  const core = globalThis.AutodartsToolsV3;
  if (!core || globalThis.AutodartsToolsV3Caller) return;

  const STORAGE_KEY = 'adt:v3:caller';
  const DEFAULTS = Object.freeze({
    enabled: false,
    mode: 'shadow',
    language: 'en-US',
    rate: 1,
    pitch: 1,
    volume: 1,
    announceDarts: false,
    announceVisits: true,
    announceBust: true,
    announceCheckout: true,
    announceGameShot: true,
    announceMatchShot: true,
  });

  const state = {
    received: 0,
    announced: 0,
    skipped: 0,
    errors: 0,
    lastEvent: null,
    lastText: null,
  };

  let config = load();
  let active = null;
  const queue = [];

  function sanitize(value) {
    const v = value && typeof value === 'object' ? value : {};
    return {
      ...DEFAULTS,
      ...v,
      enabled: Boolean(v.enabled),
      mode: v.mode === 'live' ? 'live' : 'shadow',
      rate: Math.max(0.5, Math.min(2, Number(v.rate ?? 1))),
      pitch: Math.max(0, Math.min(2, Number(v.pitch ?? 1))),
      volume: Math.max(0, Math.min(1, Number(v.volume ?? 1))),
    };
  }

  function load() {
    try { return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
    catch { return { ...DEFAULTS }; }
  }

  function save(next) {
    config = sanitize(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return snapshot();
  }

  function eventName(detail) {
    return String(detail?.event || detail?.type || detail?.trigger || '').toLowerCase();
  }

  function scoreOf(detail) {
    const values = [detail?.score, detail?.visitScore, detail?.total, detail?.value];
    return values.find(v => Number.isFinite(Number(v))) ?? null;
  }

  function phrase(detail) {
    const name = eventName(detail);
    const score = scoreOf(detail);

    if ((name.includes('match') && name.includes('shot')) || name === 'matchshot') {
      return config.announceMatchShot ? 'Game, shot and the match' : null;
    }
    if ((name.includes('game') && name.includes('shot')) || name === 'gameshot') {
      return config.announceGameShot ? 'Game shot' : null;
    }
    if (name.includes('checkout')) {
      return config.announceCheckout ? (score != null ? `Checkout ${score}` : 'Checkout') : null;
    }
    if (name.includes('bust')) {
      return config.announceBust ? 'No score' : null;
    }
    if (name.includes('visit') || name.includes('turn')) {
      return config.announceVisits && score != null ? String(score) : null;
    }
    if (name.includes('dart') || name.includes('throw')) {
      if (!config.announceDarts) return null;
      return detail?.segment ? String(detail.segment) : score != null ? String(score) : null;
    }
    return null;
  }

  function pump() {
    if (active || !queue.length) return;
    const item = queue.shift();
    const utterance = new SpeechSynthesisUtterance(item.text);
    utterance.lang = config.language;
    utterance.rate = config.rate;
    utterance.pitch = config.pitch;
    utterance.volume = config.volume;
    active = utterance;
    utterance.onend = () => { active = null; pump(); };
    utterance.onerror = event => {
      state.errors++;
      core.log.warn('Caller speech failed', event?.error || event);
      active = null;
      pump();
    };
    speechSynthesis.speak(utterance);
    state.announced++;
  }

  function announce(text, name = 'manual') {
    if (!text) return { ok: false, reason: 'empty-text' };
    state.lastEvent = name;
    state.lastText = text;

    if (config.mode !== 'live') {
      state.skipped++;
      core.log.debug('Caller shadow announcement', { name, text });
      return { ok: true, shadow: true, text };
    }

    queue.push({ text, name });
    pump();
    return { ok: true, queued: true, text };
  }

  function onCaller(event) {
    const detail = event?.detail || {};
    state.received++;
    if (!config.enabled) { state.skipped++; return; }
    const text = phrase(detail);
    if (!text) { state.skipped++; return; }
    announce(text, eventName(detail));
  }

  function snapshot() {
    return {
      config: { ...config },
      state: { ...state },
      queueLength: queue.length,
      speaking: Boolean(active),
    };
  }

  const api = Object.freeze({
    snapshot,
    configure(patch = {}) { return save({ ...config, ...patch }); },
    enable(value = true) { return save({ ...config, enabled: Boolean(value) }); },
    setMode(mode) { return save({ ...config, mode }); },
    preview(text = 'One hundred and eighty') { return announce(String(text), 'preview'); },
    stop() { queue.length = 0; speechSynthesis.cancel(); active = null; },
  });

  Object.defineProperty(globalThis, 'AutodartsToolsV3Caller', {
    value: api,
    configurable: false,
    writable: false,
  });

  core.registerModule({
    id: 'feature.caller-v3',
    start() { window.addEventListener('adt:v3:caller', onCaller, { passive: true }); },
    stop() {
      window.removeEventListener('adt:v3:caller', onCaller);
      api.stop();
    },
    snapshot,
  });

  void core.startModule('feature.caller-v3');
})();
