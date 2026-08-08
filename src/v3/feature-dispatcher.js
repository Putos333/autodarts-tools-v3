(() => {
  'use strict';
  const core = globalThis.AutodartsToolsV3;
  const match = globalThis.AutodartsToolsV3Match;
  if (!core || !match) return;

  const unsubs = [];
  const counters = { caller: 0, sound: 0, wled: 0 };
  const last = new Map();

  function dispatch(target, trigger, detail) {
    const key = `${target}:${trigger}:${detail?.matchId ?? ''}:${detail?.player?.index ?? ''}:${detail?.round ?? ''}:${detail?.throwCount ?? ''}:${detail?.index ?? ''}`;
    const now = performance.now();
    if (now - (last.get(key) ?? -Infinity) < 40) return;
    last.set(key, now);
    counters[target]++;
    window.dispatchEvent(new CustomEvent(`adt:v3:${target}`, { detail: { trigger, ...detail } }));
  }

  function fanout(trigger, detail, targets = ['caller', 'sound', 'wled']) {
    for (const target of targets) dispatch(target, trigger, detail);
  }

  core.registerModule({
    id: 'match.feature-dispatcher',
    start() {
      unsubs.push(core.on(match.events.DART, d => fanout('dart', d)));
      unsubs.push(core.on(match.events.VISIT_COMPLETE, d => fanout('visit', d)));
      unsubs.push(core.on(match.events.BUST, d => fanout('bust', d)));
      unsubs.push(core.on(match.events.CHECKOUT, d => fanout('gameshot', d)));
      unsubs.push(core.on(match.events.MATCH_SHOT, d => fanout('matchshot', d)));
      unsubs.push(core.on(match.events.VISIT_START, d => fanout('takeout', d, ['caller', 'sound', 'wled'])));
    },
    stop() { while (unsubs.length) unsubs.pop()(); last.clear(); },
    snapshot() { return { ...counters }; },
  });
  core.startModule('match.feature-dispatcher');
})();
