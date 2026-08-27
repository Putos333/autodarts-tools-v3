import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

function assertContains(text, patterns, label) {
  for (const pattern of patterns) {
    assert.match(text, pattern, `${label}: missing ${pattern}`);
  }
}

test('match lifecycle guards stale lazy initializers and serializes cleanup', async () => {
  const text = await source('entrypoints/match.content/index.ts');
  assertContains(text, [
    /let matchGeneration = 0;/,
    /let cleanupBarrier: Promise<void> = Promise\.resolve\(\);/,
    /generation === matchGeneration/,
    /await cleanupBarrier;/,
    /await removeFn\(\);/,
    /cleanupBarrier = cleanupBarrier/,
  ], 'index.ts');
});

test('crowd lifecycle owns storage listener and delayed reactions', async () => {
  const text = await source('entrypoints/match.content/crowd.ts');
  assertContains(text, [
    /venueStorageChangeHandler/,
    /browser\.storage\.onChanged\.removeListener\(venueStorageChangeHandler\)/,
    /const crowdTimeouts = new Set/,
    /function scheduleCrowdTask/,
    /function clearCrowdTimeouts/,
    /if \(!isActive\) return;/,
  ], 'crowd.ts');
});

test('WLED cleanup cancels debounce, queued starts and active requests', async () => {
  const text = await source('entrypoints/match.content/wled.ts');
  assertContains(text, [
    /let wledActive = false;/,
    /activeRequestControllers/,
    /requestStartTimers/,
    /clearTimeout\(debounceTimer\)/,
    /clearRequestStartTimers\(\);/,
    /abortActiveRequests\(\);/,
    /setEffectByTrigger\("idle", false, true\)/,
  ], 'wled.ts');
});

test('training summary timeout is lifecycle-owned', async () => {
  const text = await source('entrypoints/match.content/training-mode.ts');
  assertContains(text, [
    /let summaryTimeout:/,
    /clearTimeout\(summaryTimeout\)/,
    /summaryTimeout = setTimeout/,
  ], 'training-mode.ts');
});

test('buzzer removes global window handlers', async () => {
  const text = await source('entrypoints/match.content/buzzer.ts');
  assertContains(text, [
    /delete \(window as any\)\._adBuzzerPress/,
    /delete \(window as any\)\._adBuzzerReset/,
    /delete \(window as any\)\._adBuzzerClose/,
  ], 'buzzer.ts');
});

test('soundboard removes global handlers and flash timers', async () => {
  const text = await source('entrypoints/match.content/soundboard.ts');
  assertContains(text, [
    /const flashTimeouts = new Set/,
    /delete \(window as any\)\._adSoundboard/,
    /delete \(window as any\)\._adSoundboardVolume/,
    /flashTimeouts\.clear\(\)/,
  ], 'soundboard.ts');
});

/**
 * Runtime-Test 2026-08-27 (dritter Checkpoint) — StreamingMode.vue, Zoom.vue
 * und Animations.vue registrieren ihre AutodartsToolsGameData/BoardImages-
 * Watcher innerhalb eines async onMounted, NACH mindestens einem await.
 * Anders als der `disposed`-Guard-Fix in Control Center (wo nur eine
 * verspätete Registrierung fehlte) hatten diese drei Dateien den Rückgabewert
 * von .watch() nie überhaupt erfasst — ein unbedingter Leak bei jedem Mount,
 * unabhängig von jeder Race-Timing. StreamingMode.vue hatte zusätzlich gar
 * kein onBeforeUnmount/onUnmounted. Diese drei Content-Script-Komponenten
 * werden bei jedem Match-Wechsel über clearMatch() -> shadowUis.X.remove()
 * -> onRemove(app) -> app.unmount() neu erzeugt (siehe match.content/
 * index.ts) - das Plumbing ruft den Vue-Unmount-Lifecycle also zuverlässig
 * auf; es gab in den Komponenten selbst nur nichts, das darauf reagierte.
 */

test('StreamingMode.vue owns and tears down both storage watchers plus the draggable-listener cleanup', async () => {
  const text = await source('entrypoints/match.content/StreamingMode.vue');
  assertContains(text, [
    /let disposed = false;/,
    /let unwatchGameData: \(\(\) => void\) \| undefined;/,
    /let unwatchBoardImages: \(\(\) => void\) \| undefined;/,
    /let stopDraggable: \(\(\) => void\) \| undefined;/,
    // Registrierung erst nach dem disposed-Check, nicht vorher.
    /if \(disposed\) return;\s*\s*unwatchGameData = AutodartsToolsGameData\.watch/,
    /unwatchBoardImages = AutodartsToolsBoardImages\.watch/,
    // initDraggable()'s Cleanup-Rückgabewert wird jetzt tatsächlich gehalten,
    // nicht mehr verworfen — an beiden Aufrufstellen (Mount + Ref-Watch).
    /stopDraggable\?\.\(\);\s*stopDraggable = initDraggable\(\);/,
    // onBeforeUnmount räumt alle drei Ressourcen ab UND setzt den Guard zuerst.
    /onBeforeUnmount\(\(\) => \{\s*disposed = true;\s*unwatchGameData\?\.\(\);\s*unwatchBoardImages\?\.\(\);\s*stopDraggable\?\.\(\);/,
  ], 'StreamingMode.vue');
  // Vorher gab es hier gar kein onBeforeUnmount/onUnmounted — Kontrollprobe,
  // dass der Hook jetzt existiert (nicht nur die Variablen).
  assert.match(text, /onBeforeUnmount\(/, 'StreamingMode.vue: onBeforeUnmount fehlt weiterhin');
});

test('Zoom.vue owns and tears down both storage watchers plus the center-zoom resize listener', async () => {
  const text = await source('entrypoints/match.content/Zoom.vue');
  assertContains(text, [
    /let disposed = false;/,
    /let unwatchBoardImages: \(\(\) => void\) \| undefined;/,
    /let unwatchGameData: \(\(\) => void\) \| undefined;/,
    /let removeCenterZoomResize: \(\(\) => void\) \| undefined;/,
    /unwatchBoardImages = AutodartsToolsBoardImages\.watch/,
    /unwatchGameData = AutodartsToolsGameData\.watch/,
    // Der zuvor anonyme, nie entfernbare resize-Listener in initCenterZoom()
    // ist jetzt benannt und über eine Remove-Funktion abräumbar.
    /const onCenterZoomResize = \(\) => \{/,
    /removeCenterZoomResize = \(\) => window\.removeEventListener\("resize", onCenterZoomResize\);/,
    // Die bereits bestehende onUnmounted (checkNavigationWidth + resizeObserver)
    // wurde erweitert, nicht dupliziert — disposed zuerst, dann alle Cleanups.
    /onUnmounted\(\(\) => \{\s*disposed = true;/,
    /unwatchBoardImages\?\.\(\);\s*unwatchGameData\?\.\(\);\s*removeCenterZoomResize\?\.\(\);/,
  ], 'Zoom.vue');
});

test('Animations.vue owns and tears down its game-data watcher (existing interval/resize/blob-URL cleanup untouched)', async () => {
  const text = await source('entrypoints/match.content/Animations.vue');
  assertContains(text, [
    /let disposed = false;/,
    /let unwatchGameData: \(\(\) => void\) \| undefined;/,
    /if \(disposed\) return;\s*unwatchGameData = AutodartsToolsGameData\.watch/,
    /onUnmounted\(\(\) => \{\s*disposed = true;\s*if \(updateInterval\) clearInterval\(updateInterval\);\s*window\.removeEventListener\("resize", updateBoardPosition\);\s*unwatchGameData\?\.\(\);/,
    // Bereits vorher korrekt und unverändert — Kontrollprobe gegen Regression.
    /for \(const url of Object\.values\(animationCache\.value\)\) \{\s*URL\.revokeObjectURL\(url\);/,
  ], 'Animations.vue');
});

/**
 * Gotcha.vue registriert `onUnmounted()` selbst dynamisch von INNERHALB des
 * async onMounted — ungewöhnlich, aber empirisch verifiziert (isolierte
 * Vue-3.5.30-Lifecycle-Probe gegen echtes Browser-Rendering, siehe
 * Checkpoint-Bericht 2026-08-27): Vue behält den `currentInstance`-Kontext,
 * solange VOR der dynamischen Hook-Registrierung kein `await` ausgeführt
 * wurde. Hier gibt es keinen — `AutodartsToolsGameData.watch()` ist
 * synchron. REPRODUCE lieferte daher KEINEN Leak; bewusst NICHT verändert.
 * Dieser Test pinnt exakt die Bedingung, die das sicher macht: kein `await`
 * zwischen dem öffnenden `onMounted(async () => {` und der
 * `onUnmounted(`-Registrierung. Ein künftig eingefügter await an dieser
 * Stelle würde denselben Leak reproduzieren wie in den drei Dateien oben.
 */
test('Gotcha.vue registers onUnmounted synchronously (no await before it) — verified safe, deliberately unchanged', async () => {
  const text = await source('entrypoints/match.content/Gotcha.vue');
  assert.match(
    text,
    /onMounted\(async \(\) => \{(?:(?!await)[\s\S])*?const unwatch = AutodartsToolsGameData\.watch/,
    'Gotcha.vue: an await now appears before the watch()/onUnmounted() registration — this reintroduces the leak pattern verified fixed elsewhere in this checkpoint (see lifecycle probe in the checkpoint report)',
  );
  assertContains(text, [
    /onUnmounted\(\(\) => \{\s*if \(typeof unwatch === 'function'\) \{\s*unwatch\(\);/,
  ], 'Gotcha.vue');
});
