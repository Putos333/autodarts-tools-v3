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
