(() => {
  'use strict';

  const core = globalThis.AutodartsToolsV3;
  if (!core || globalThis.AutodartsToolsV3Sound) return;

  const STORAGE_KEY = 'adt:v3:sound';
  const DEFAULTS = Object.freeze({
    enabled: false,
    mode: 'shadow',
    volume: 0.8,
    policy: 'interrupt-low-priority',
    mappings: {},
  });

  const state = {
    received: 0,
    matched: 0,
    played: 0,
    skipped: 0,
    errors: 0,
    lastEvent: null,
    lastSound: null,
  };

  const cache = new Map();
  let active = null;
  let config = load();

  function sanitize(value) {
    const v = value && typeof value === 'object' ? value : {};
    return {
      enabled: Boolean(v.enabled),
      mode: v.mode === 'live' ? 'live' : 'shadow',
      volume: Math.max(0, Math.min(1, Number(v.volume ?? DEFAULTS.volume))),
      policy: ['interrupt-low-priority', 'queue', 'drop'].includes(v.policy) ? v.policy : DEFAULTS.policy,
      mappings: v.mappings && typeof v.mappings === 'object' ? { ...v.mappings } : {},
    };
  }

  function load() {
    try { return sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')); }
    catch { return { ...DEFAULTS, mappings: {} }; }
  }

  function save(next) {
    config = sanitize(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return snapshot();
  }

  function getAudio(url) {
    if (!cache.has(url)) {
      const audio = new Audio(url);
      audio.preload = 'auto';
      cache.set(url, audio);
    }
    return cache.get(url);
  }

  function resolve(detail) {
    const event = String(detail?.event || detail?.type || detail?.trigger || '');
    const mapped = config.mappings[event];
    if (!mapped) return null;
    if (typeof mapped === 'string') return { url: mapped, priority: 0, name: event };
    return { url: mapped.url, priority: Number(mapped.priority) || 0, name: mapped.name || event };
  }

  async function play(effect, eventName) {
    if (!effect?.url) return { ok: false, reason: 'missing-url' };
    state.lastEvent = eventName;
    state.lastSound = effect.name;

    if (config.mode !== 'live') {
      state.skipped++;
      core.log.debug('Sound shadow match', { eventName, effect });
      return { ok: true, shadow: true };
    }

    if (active && !active.audio.paused) {
      if (config.policy === 'drop') { state.skipped++; return { ok: true, skipped: 'busy' }; }
      if (config.policy === 'interrupt-low-priority' && effect.priority < active.priority) {
        state.skipped++;
        return { ok: true, skipped: 'lower-priority' };
      }
      active.audio.pause();
      active.audio.currentTime = 0;
    }

    const audio = getAudio(effect.url);
    audio.volume = config.volume;
    audio.currentTime = 0;
    active = { audio, priority: effect.priority };
    try {
      await audio.play();
      state.played++;
      return { ok: true };
    } catch (error) {
      state.errors++;
      core.log.warn('Sound playback failed', error);
      return { ok: false, error: String(error?.message || error) };
    }
  }

  function onSound(event) {
    const detail = event?.detail || {};
    state.received++;
    if (!config.enabled) { state.skipped++; return; }
    const effect = resolve(detail);
    if (!effect) { state.skipped++; return; }
    state.matched++;
    void play(effect, String(detail.event || detail.type || detail.trigger || 'unknown'));
  }

  function snapshot() {
    return { config: { ...config, mappings: { ...config.mappings } }, state: { ...state }, cacheSize: cache.size };
  }

  const api = Object.freeze({
    snapshot,
    configure(patch = {}) { return save({ ...config, ...patch }); },
    enable(value = true) { return save({ ...config, enabled: Boolean(value) }); },
    setMode(mode) { return save({ ...config, mode }); },
    setVolume(volume) { return save({ ...config, volume }); },
    map(eventName, effect) { return save({ ...config, mappings: { ...config.mappings, [eventName]: effect } }); },
    async test(url) { return play({ url, priority: 999, name: 'test' }, 'test'); },
    preload(urls = []) { for (const url of urls) if (url) getAudio(String(url)); return cache.size; },
  });

  Object.defineProperty(globalThis, 'AutodartsToolsV3Sound', { value: api, configurable: false, writable: false });

  core.registerModule({
    id: 'feature.sound-v3',
    start() { window.addEventListener('adt:v3:sound', onSound, { passive: true }); },
    stop() {
      window.removeEventListener('adt:v3:sound', onSound);
      if (active?.audio) { active.audio.pause(); active.audio.currentTime = 0; }
      active = null;
    },
    snapshot,
  });
  void core.startModule('feature.sound-v3');
})();