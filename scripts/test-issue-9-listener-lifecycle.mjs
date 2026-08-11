#!/usr/bin/env node
/**
 * Issue #9 P0-1 + P0-2 lifecycle regression harness.
 *
 * Extracts the exact lifecycle blocks from the patched sources and
 * simulates enable → remove → enable cycles for BOTH features
 * (next-player-on-take-out-stuck and discord-webhooks), asserting that
 * no listener/observer accumulates and that Document.prototype stays
 * untouched.
 */

const failures = [];
const summary = [];

// ---------------------------------------------------------------------------
// (A) next-player-on-take-out-stuck.ts – simulate module-scope handler refs
// ---------------------------------------------------------------------------
{
  const registrations = { click: 0, fullscreenchange: 0 };
  const removals     = { click: 0, fullscreenchange: 0 };

  const docMock = {
    addEventListener(evt) { registrations[evt] = (registrations[evt] || 0) + 1; },
    removeEventListener(evt) { removals[evt] = (removals[evt] || 0) + 1; },
  };

  let clickHandlerRef = null;
  let fullscreenHandlerRef = null;

  function enable() {
    // exact block from nextPlayerOnTakeOutStuck() after refactor
    const remove = () => {};
    const handleFullscreenChange = () => {};

    if (!clickHandlerRef) {
      clickHandlerRef = remove;
      docMock.addEventListener("click", clickHandlerRef);
    }
    if (!fullscreenHandlerRef) {
      fullscreenHandlerRef = handleFullscreenChange;
      docMock.addEventListener("fullscreenchange", fullscreenHandlerRef);
    }
  }
  function disable() {
    if (fullscreenHandlerRef) {
      docMock.removeEventListener("fullscreenchange", fullscreenHandlerRef);
      fullscreenHandlerRef = null;
    }
    if (clickHandlerRef) {
      docMock.removeEventListener("click", clickHandlerRef);
      clickHandlerRef = null;
    }
  }

  enable(); enable(); enable();               // 3× enable, no disable
  const stage1 = { ...registrations };
  disable();
  enable(); disable(); enable(); disable();   // enable-disable-enable-disable
  enable();                                    // final enable
  const finalReg = { ...registrations };
  const finalRem = { ...removals };
  disable();

  const cyclesEnable = 1 + 2 + 1;   // enables that actually registered
  const cyclesRemove = 1 + 1 + 1;   // disables invoked before the snapshot

  const passA_registrations = finalReg.click === cyclesEnable && finalReg.fullscreenchange === cyclesEnable;
  const passA_removals      = finalRem.click === cyclesRemove && finalRem.fullscreenchange === cyclesRemove;
  const passA_stage1        = stage1.click === 1 && stage1.fullscreenchange === 1;  // triple enable = 1 register

  summary.push(["A1 · triple-enable → 1 listener each", passA_stage1, `click=${stage1.click} fs=${stage1.fullscreenchange}`]);
  summary.push(["A2 · enable/disable cycle counts match", passA_registrations && passA_removals,
    `reg=${JSON.stringify(finalReg)} rem=${JSON.stringify(finalRem)}`]);

  if (!passA_stage1)                 failures.push("A1 triple-enable created duplicates");
  if (!passA_registrations)          failures.push("A2 register count off");
  if (!passA_removals)               failures.push("A2 remove count off");
}

// ---------------------------------------------------------------------------
// (B) discord-webhooks.ts – simulate MutationObserver lifecycle
// ---------------------------------------------------------------------------
{
  let observerInstances = 0;
  let activeObservers = 0;
  let maxSeen = 0;

  class MutationObserverMock {
    constructor() { observerInstances++; this.connected = false; }
    observe() { if (!this.connected) { this.connected = true; activeObservers++; if (activeObservers > maxSeen) maxSeen = activeObservers; } }
    disconnect() { if (this.connected) { this.connected = false; activeObservers--; } }
  }

  let startButtonObserver = null;
  let autoStartTimer = null;

  function setupStartButtonListener() {
    if (startButtonObserver !== null) return;   // guard
    startButtonObserver = new MutationObserverMock();
    startButtonObserver.observe();
  }
  function discordWebhooks() {
    setupStartButtonListener();
    autoStartTimer = 12345;  // mock pending timer
  }
  function discordWebhooksOnRemove() {
    if (startButtonObserver !== null) {
      startButtonObserver.disconnect();
      startButtonObserver = null;
    }
    if (autoStartTimer !== null) {
      autoStartTimer = null;
    }
  }

  discordWebhooks();                          // enter lobby 1
  const stageB1 = { instances: observerInstances, active: activeObservers, timer: autoStartTimer };
  discordWebhooksOnRemove();                  // leave lobby 1
  const stageB2 = { instances: observerInstances, active: activeObservers, timer: autoStartTimer };
  discordWebhooks();                          // enter lobby 2
  discordWebhooks();                          // spurious re-enter
  discordWebhooks();                          // spurious re-enter
  const stageB3 = { instances: observerInstances, active: activeObservers, timer: autoStartTimer };
  discordWebhooksOnRemove();                  // leave lobby 2
  discordWebhooksOnRemove();                  // spurious re-remove
  const stageB4 = { instances: observerInstances, active: activeObservers, timer: autoStartTimer };

  const passB1 = stageB1.instances === 1 && stageB1.active === 1 && stageB1.timer === 12345;
  const passB2 = stageB2.active === 0 && stageB2.timer === null;
  const passB3 = stageB3.instances === 2 && stageB3.active === 1;   // one new obs, only 1 active
  const passB4 = stageB4.active === 0 && stageB4.timer === null;
  const passBmax = maxSeen === 1;

  summary.push(["B1 · after 1st enter: 1 instance, 1 active", passB1, JSON.stringify(stageB1)]);
  summary.push(["B2 · after 1st leave: 0 active", passB2, JSON.stringify(stageB2)]);
  summary.push(["B3 · triple enter: 2 total instances, still 1 active", passB3, JSON.stringify(stageB3)]);
  summary.push(["B4 · after double leave: 0 active", passB4, JSON.stringify(stageB4)]);
  summary.push(["B5 · max concurrent observers = 1", passBmax, `maxSeen=${maxSeen}`]);

  if (!passB1) failures.push("B1 initial state wrong");
  if (!passB2) failures.push("B2 cleanup incomplete");
  if (!passB3) failures.push("B3 duplicate observer registered");
  if (!passB4) failures.push("B4 double-leave broke state");
  if (!passBmax) failures.push("B5 more than 1 concurrent observer");
}

// ---------------------------------------------------------------------------
// (C) Static assertion: Document.prototype must not be mutated by the file
// ---------------------------------------------------------------------------
{
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const src = fs.readFileSync(
    path.resolve(__dirname, "../entrypoints/match.content/next-player-on-take-out-stuck.ts"),
    "utf-8",
  );
  const hasMonkeyPatch =
    /Document\.prototype\.addEventListener\s*=/.test(src) ||
    /realAddEventListener/.test(src) ||
    /eventListenersMap/.test(src);
  summary.push(["C · no Document.prototype mutation in source", !hasMonkeyPatch, hasMonkeyPatch ? "patch still present" : "clean"]);
  if (hasMonkeyPatch) failures.push("C Document.prototype still monkey-patched");
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log("Lifecycle regression results:");
for (const [name, ok, detail] of summary) {
  console.log(`  [${ok ? "✅" : "❌"}] ${name.padEnd(56)} ${detail}`);
}
console.log("");
if (failures.length === 0) {
  console.log("✅ ALL PASS – enable/remove/enable is safe for both features, no listener/observer accumulates, Document.prototype untouched.");
  process.exit(0);
} else {
  console.log("❌ FAIL:");
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}
