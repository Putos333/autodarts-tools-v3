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

/**
 * Code-review follow-up (Priorität-1-Bugfix): der frühere Trailing-Debounce
 * ("clearTimeout(debounceTimer) + reschedule") verwarf jedes bis auf das
 * letzte game-data-Update, das innerhalb von 200ms eintraf — dokumentierter
 * Bug in FACTORY_STATUS.md ("WLED-Debounce verwirft Transitionen bei
 * <200ms-Abstand"). Fix: `createGameDataDebounceQueue()` (utils/wled.ts,
 * eigenständig getestet in tests/wled-game-data-queue.test.ts) verarbeitet
 * jedes Update genau einmal, in Reihenfolge, nur zeitlich entzerrt.
 * `gameDataQueue.clear()` übernimmt die Cleanup-Rolle des früheren
 * `clearTimeout(debounceTimer)` — verwirft zusätzlich auch ausstehende,
 * noch nicht abgearbeitete Backlog-Einträge, nicht nur einen einzelnen Timer.
 */
test('WLED cleanup cancels queued game-data processing, queued starts and active requests', async () => {
  const text = await source('entrypoints/match.content/wled.ts');
  assertContains(text, [
    /let wledActive = false;/,
    /activeRequestControllers/,
    /requestStartTimers/,
    /gameDataQueue\.clear\(\);/,
    /clearRequestStartTimers\(\);/,
    /abortActiveRequests\(\);/,
    /setEffectByTrigger\("idle", false, true\)/,
  ], 'wled.ts');
});

/**
 * Same trailing-debounce bug as WLED (see the test above), found identically
 * in caller.ts and sound-fx.ts — both debounced the GameData watcher via
 * "clearTimeout(debounceTimer) + reschedule", silently dropping any update
 * that arrived within 200ms of the previous one, including the caller
 * announcement / sound effect that should have fired for it. Fix: both now
 * share `createGameDataDebounceQueue()` (utils/game-data-debounce-queue.ts,
 * extracted from wled.ts, independently tested in
 * tests/wled-game-data-queue.test.ts) instead of reimplementing the same
 * lossy debounce three times.
 */
test('caller cleanup cancels queued game-data processing (no lossy debounce)', async () => {
  const text = await source('entrypoints/match.content/caller.ts');
  assertContains(text, [
    /createGameDataDebounceQueue/,
    /gameDataQueue\.push\(gameData, oldGameData\);/,
    /gameDataQueue\.clear\(\);/,
  ], 'caller.ts');
  assert.doesNotMatch(text, /clearTimeout\(debounceTimer\)/, 'caller.ts: old lossy debounce must be gone');
});

test('sound-fx cleanup cancels queued game-data processing (no lossy debounce)', async () => {
  const text = await source('entrypoints/match.content/sound-fx.ts');
  assertContains(text, [
    /createGameDataDebounceQueue/,
    /gameDataQueue\.push\(gameData, oldGameData\);/,
    /gameDataQueue\.clear\(\);/,
  ], 'sound-fx.ts');
  assert.doesNotMatch(text, /clearTimeout\(debounceTimer\)/, 'sound-fx.ts: old lossy debounce must be gone');
});

/**
 * Regression für eine Rollup-"Duplicated imports"-Build-Warnung: WXT's
 * AutoImport-Plugin (wxt.config.ts) importiert sowohl `@vueuse/core` global
 * als auch alles aus `composables/` global — @vueuse/core hat selbst ein
 * `useConfirmDialog` (ein anderes, promise-basiertes Reveal/Confirm/Cancel-
 * API). Die eigene, viel simplere `composables/useConfirmDialog.ts` kollidierte
 * mit exakt diesem Namen, was in jedem Build 11× "Duplicated imports
 * useConfirmDialog" auslöste (funktional harmlos, da Rollup die lokale
 * Version bevorzugte, aber dokumentierte Baseline-Warnung). Fix: umbenannt zu
 * `useAppConfirmDialog` — eindeutiger Name, keine Kollision mehr mit dem
 * VueUse-Preset.
 */
test('confirm-dialog composable no longer collides with @vueuse/core\'s useConfirmDialog', async () => {
  const text = await source('composables/useAppConfirmDialog.ts');
  assertContains(text, [
    /export function useAppConfirmDialog\(\)/,
  ], 'useAppConfirmDialog.ts');

  await assert.rejects(source('composables/useConfirmDialog.ts'), 'the colliding composables/useConfirmDialog.ts must not come back');
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

/**
 * N1 (PR #16 Re-Review, 2026-08-27): entrypoints/content/App.vue's initMenu()
 * ist nicht re-entrant (mehrere await waitForElement()-Wartepunkte) und wird
 * von mehreren unabhängigen Quellen ausgelöst (onMounted, URL-Watcher,
 * isMobileNav-Watcher, Collapse-Button). Zwei überlappende Aufrufe konnten
 * beide bis zum DOM-Insert durchlaufen -> doppelter Sidebar-Eintrag + ein
 * geleaktes setInterval (der zweite Aufruf überschreibt navigationCheckInterval,
 * bevor der erste sein eigenes Intervall je abräumen kann).
 *
 * PRIMÄRER Nachweis für diesen Fix ist KEIN Source-Text-Match, sondern ein
 * echter Browser-Test (chrome-devtools MCP, reales DOM/MutationObserver/
 * setInterval, wortgetreue Kopie der Kontrollfluss-Logik): REPRODUCE zeigte
 * 2 doppelte #autodarts-tools-menu-item-Knoten + ein geleaktes Intervall ohne
 * Guard; TARGETED RETEST zeigte exakt 1 Knoten mit Guard; ein zusätzlicher
 * Mount->Unmount->Mount-Lauf bestätigte, dass ein beim Unmount noch
 * laufender Aufruf danach nichts mehr in die Seite schreibt. App.vue kann
 * als Vue-SFC nicht ohne volle Kompilierung in Node importiert werden — die
 * folgende Assertion ist daher nur ein SEKUNDÄRER, strukturbasierter
 * Regressionsschutz (verhindert eine versehentliche Entfernung des bereits
 * real verifizierten Guards), kein alleiniger Beweis.
 */
test('content App.vue guards initMenu() against re-entrant calls and unmount races', async () => {
  const text = await source('entrypoints/content/App.vue');
  assertContains(text, [
    /let menuInitGeneration = 0;/,
    /let disposed = false;/,
    /async function initMenu\(\) \{\s*const generation = \+\+menuInitGeneration;\s*if \(disposed\) return;/,
    /if \(disposed \|\| generation !== menuInitGeneration\) return;/,
    /onBeforeUnmount\(\(\) => \{\s*disposed = true;/,
  ], 'content/App.vue');
});

/**
 * N2 (PR #16 Re-Review, 2026-08-27): myUserId wurde in fünf Control-Center-
 * Komponenten nur einmalig beim Mount aufgelöst (getUserIdFromToken()) und
 * nie nachgezogen. Kam der Auth-Token erst nach dem Mount an (später Login,
 * frisches Profil), blieb die Identität dauerhaft null — Bilanz, Recent
 * Activity, Verlaufs-Kennzahlen und Statistiken blieben leer/falsch, obwohl
 * die Daten längst vorhanden waren. Fix: derselbe Live-Refresh via
 * AutodartsToolsGlobalStatus.watch(), der bereits in useControlCenterStatus.ts
 * (Wave-1-Checkpoint) bewiesen wurde.
 *
 * PRIMÄRER Nachweis ist ein echter Browser-Test (chrome-devtools MCP, echter
 * kompilierter Chrome-MV3-Build, echte Storage-Transitions) für die vier über
 * das UI erreichbaren Komponenten: CcRecentActivity.vue + CcPerformanceStrip.vue
 * (#dashboard), CcHistory.vue (#history), CcStats.vue (#stats) — alle vier
 * zeigen nach einem simulierten späten Login (chrome.storage.local.set auf
 * "globalstatus", KEIN Reload) sofort korrekte Werte statt des vorherigen
 * "keine Identität"-Zustands. Für CcRecentActivity.vue zusätzlich per
 * Mutationstest bestätigt: mit entferntem Fix bleibt die Anzeige exakt
 * identisch ("stuck"), mit Fix aktualisiert sie sich live.
 * CcDashboardSummary.vue wird aktuell von keiner View gerendert (bereits vor
 * diesem Fix verwaist) und konnte daher nicht per Live-Navigation getestet
 * werden — der identische, an den anderen vier Stellen bewiesene Fix wurde
 * dort aus Konsistenzgründen ebenfalls angewendet und ist TypeScript-geprüft.
 *
 * NEUE ARCHITEKTUR (N2 Centralization): Die fünf Komponenten nutzen nun
 * `useControlCenterStatus()` Composable, das den `AutodartsToolsGlobalStatus`
 * Watcher ZENTRAL hält (einmal pro Seite, nicht pro Komponente). Die
 * folgenden Tests prüfen, dass die Komponenten das Composable nutzen und
 * `myUserId` daraus beziehen — der eigentliche Watcher wird im Composable
 * getestet (implizit durch die Composable-Tests und TypeScript-Check).
 */
function assertUsesCentralizedMyUserId(text, label) {
  assertContains(text, [
    /import \{ useControlCenterStatus \} from "@\/composables\/useControlCenterStatus";/,
    /const \{ myUserId \} = useControlCenterStatus\(\);/,
  ], label);
}

test('CcRecentActivity.vue uses centralized myUserId via useControlCenterStatus', async () => {
  assertUsesCentralizedMyUserId(await source('components/ControlCenter/CcRecentActivity.vue'), 'CcRecentActivity.vue');
});

test('CcPerformanceStrip.vue uses centralized myUserId via useControlCenterStatus', async () => {
  assertUsesCentralizedMyUserId(await source('components/ControlCenter/CcPerformanceStrip.vue'), 'CcPerformanceStrip.vue');
});

test('CcDashboardSummary.vue uses centralized myUserId via useControlCenterStatus', async () => {
  assertUsesCentralizedMyUserId(await source('components/ControlCenter/CcDashboardSummary.vue'), 'CcDashboardSummary.vue');
});

test('CcHistory.vue uses centralized myUserId via useControlCenterStatus', async () => {
  assertUsesCentralizedMyUserId(await source('components/ControlCenter/views/CcHistory.vue'), 'CcHistory.vue');
});

test('CcStats.vue uses centralized myUserId via useControlCenterStatus', async () => {
  assertUsesCentralizedMyUserId(await source('components/ControlCenter/views/CcStats.vue'), 'CcStats.vue');
});

/**
 * Issue #13, P1-3: `winnerNameOf()` searched the winner by `player.index`
 * but fell back to `players[winnerIndex]` (raw array position) when no
 * player matched. `player.index` is the CMR's only reliable player identity
 * (canonical-match-result.ts always sets it, defaulting to array position
 * only at construction time, not at read time) — if a player's `index`
 * diverges from its array position, the positional fallback can display the
 * wrong winner's name. Fix: drop the fallback; show no name rather than a
 * possibly wrong one, consistent with `isWinnerMatch()`/`isWinner()` (already
 * fixed in 1805da7), which trust only `player.index`.
 */
function assertNoWinnerPositionalFallback(text, label) {
  assert.doesNotMatch(
    text,
    /\.players\[\w+\.winnerIndex\]/,
    `${label}: winnerNameOf() must not fall back to players[winnerIndex]`,
  );
  assertContains(text, [
    /\.find\([^=]*=>\s*p(?:layer)?\.index === \w+\.winnerIndex\);/,
  ], label);
}

test('CcMatchDetails.vue winnerNameOf() has no array-position fallback', async () => {
  assertNoWinnerPositionalFallback(await source('components/ControlCenter/CcMatchDetails.vue'), 'CcMatchDetails.vue');
});

/**
 * Code-review follow-up on P1-3: CcHistory.vue's ICmrPlayerDisplay already
 * carries a precomputed `isWinner` (mapCmrPlayerToDisplay, utils/match-history-view.ts:83),
 * derived with the same `player.index === winnerIndex` rule. winnerNameOf()
 * now reuses that single source of truth instead of re-deriving the winner
 * independently — one implementation of the rule, not two that could diverge.
 */
test('CcHistory.vue winnerNameOf() reuses the precomputed isWinner flag, no independent re-derivation', async () => {
  const text = await source('components/ControlCenter/views/CcHistory.vue');
  assert.doesNotMatch(
    text,
    /\.players\[\w+\.winnerIndex\]/,
    'CcHistory.vue: winnerNameOf() must not fall back to players[winnerIndex]',
  );
  assertContains(text, [
    /\.find\(\(p\) => p\.isWinner\);/,
  ], 'CcHistory.vue');
});

/**
 * Issue #13, P2-5: CcTraining.vue loaded training history/progress only in
 * onMounted, with no watcher — changes recorded from another Autodarts tab
 * stayed invisible until navigation/reload. Fix: watch both stores via
 * WxtStorageItem.watch() (AutodartsToolsTrainingHistory,
 * AutodartsToolsTrainingProgress), and tear both down on unmount — same
 * shape as CcHistory.vue/useControlCenterStatus.ts.
 */
/**
 * Issue #13, P2-6: CcSettings.vue's diagnostic counters (cmrCount,
 * trainingHistoryCount) were only loaded once in onMounted alongside config
 * — unlike config itself (already watched via AutodartsToolsConfig.watch()),
 * a match/training completed in another Autodarts tab left the counters
 * stale until navigation/reload. Fix: watch the same two stores CcHistory.vue
 * and CcTraining.vue already watch, torn down the same way as unwatchConfig.
 */
test('CcSettings.vue watches CMR results and training history for its diagnostic counters', async () => {
  const text = await source('components/ControlCenter/views/CcSettings.vue');
  assertContains(text, [
    /import \{ AutodartsToolsCanonicalMatchResults, getCanonicalMatchResults \} from "@\/utils\/canonical-match-result-storage";/,
    /let unwatchCmr: \(\(\) => void\) \| undefined;/,
    /let unwatchTrainingHistory: \(\(\) => void\) \| undefined;/,
    /unwatchCmr = AutodartsToolsCanonicalMatchResults\.watch\(\(\) => void loadDiagnostics\(\)\);/,
    /unwatchTrainingHistory = AutodartsToolsTrainingHistory\.watch\(\(\) => void loadDiagnostics\(\)\);/,
    /unwatchCmr\?\.\(\);/,
    /unwatchTrainingHistory\?\.\(\);/,
  ], 'CcSettings.vue');
});

test('CcTraining.vue watches training history and progress instead of loading once on mount', async () => {
  const text = await source('components/ControlCenter/views/CcTraining.vue');
  assertContains(text, [
    /import \{ AutodartsToolsTrainingHistory, AutodartsToolsTrainingProgress \} from "@\/utils\/storage";/,
    /let disposed = false;/,
    /let unwatchHistory: \(\(\) => void\) \| undefined;/,
    /let unwatchProgress: \(\(\) => void\) \| undefined;/,
    /unwatchHistory = AutodartsToolsTrainingHistory\.watch\(\(\) => void loadHistory\(\)\);/,
    /unwatchProgress = AutodartsToolsTrainingProgress\.watch\(\(\) => void loadProgress\(\)\);/,
    /onBeforeUnmount\(\(\) => \{\s*disposed = true;/,
    /unwatchHistory\?\.\(\);/,
    /unwatchProgress\?\.\(\);/,
  ], 'CcTraining.vue');
});

/**
 * Issue #13, #7: History/Stats/Dashboard-Zusammenfassung/Training zeigten
 * denselben leeren Zustand für "lädt noch", "Laden fehlgeschlagen" und
 * "wirklich keine Daten" — nicht unterscheidbar für den Nutzer. Fix: das
 * gemeinsame State-Modell aus utils/control-center-data-state.ts, in jeder
 * betroffenen Komponente verdrahtet über einen `loading`-Ref (nur beim ersten
 * Ladevorgang wahr) und einen `error`-Ref, der bereits geladene Daten NICHT
 * mehr löscht (kein Zurückfallen auf "keine Daten" bei einem fehlgeschlagenen
 * Hintergrund-Refresh).
 */
function assertUsesCcDataState(text, label, patterns) {
  assertContains(text, [
    /import \{ deriveCcDataState \} from "@\/utils\/control-center-data-state";/,
    ...patterns,
  ], label);
}

test('CcHistory.vue distinguishes loading/unavailable/no_data via deriveCcDataState', async () => {
  const text = await source('components/ControlCenter/views/CcHistory.vue');
  assertUsesCcDataState(text, 'CcHistory.vue', [
    /const loading = ref\(true\);/,
    /const loadError = ref\(false\);/,
    /const historyState = computed\(\(\) => deriveCcDataState\(\{/,
    /loading\.value = false;/,
  ]);
  assert.doesNotMatch(text, /rawResults\.value = \[\];/, 'CcHistory.vue: a failed background refresh must not erase already-loaded results');
});

test('CcStats.vue distinguishes loading/unavailable/no_data/identity_unknown via deriveCcDataState', async () => {
  const text = await source('components/ControlCenter/views/CcStats.vue');
  assertUsesCcDataState(text, 'CcStats.vue', [
    /const loading = ref\(true\);/,
    /const loadError = ref\(false\);/,
    /const statsState = computed\(\(\) => deriveCcDataState\(\{/,
    /identityRequired: true,/,
    /identityKnown: myUserId\.value !== null,/,
  ]);
  assert.doesNotMatch(text, /rawResults\.value = \[\];/, 'CcStats.vue: a failed background refresh must not erase already-loaded results');
});

test('CcDashboardSummary.vue distinguishes loading/unavailable/no_data/identity_unknown for Bilanz and Training independently', async () => {
  const text = await source('components/ControlCenter/CcDashboardSummary.vue');
  assertUsesCcDataState(text, 'CcDashboardSummary.vue', [
    /const bilanzState = computed\(\(\) => deriveCcDataState\(\{/,
    /identityRequired: true,/,
    /const trainingState = computed\(\(\) => deriveCcDataState\(\{/,
  ]);
});

/**
 * CcTraining.vue's history source (getTrainingHistory()) already swallows
 * storage errors and returns `[]` — a second caller (Settings/Training.vue)
 * relies on that, so it must not be changed to throw. `historyState` can
 * therefore only ever be "loading" or "no_data"/ready, never "unavailable" —
 * no dead retry UI for a state that can't occur. `progressState` (a
 * genuinely independent store with its own real error path) keeps the full
 * loading/unavailable/no_data distinction.
 */
test('CcTraining.vue distinguishes loading/no_data for history (no unreachable "unavailable") and loading/unavailable/no_data for progress', async () => {
  const text = await source('components/ControlCenter/views/CcTraining.vue');
  assertUsesCcDataState(text, 'CcTraining.vue', [
    /const historyLoading = ref\(true\);/,
    /const historyState = computed\(\(\) => deriveCcDataState\(\{\s*loading: historyLoading\.value,\s*error: false,/,
    /const progressLoading = ref\(true\);/,
    /const progressError = ref\(false\);/,
    /const progressState = computed\(\(\) => deriveCcDataState\(\{/,
    /historyLoading\.value = false;/,
    /progressLoading\.value = false;/,
  ]);
  assert.doesNotMatch(text, /historyState === 'unavailable'/, 'CcTraining.vue: history has no reachable unavailable state, must not render dead retry UI for it');
});

/**
 * Issue #13, #8: below 1080px the sidebar collapsed to an icon-only rail
 * with no further adaptation down to real phone widths (~360-430px) — a
 * planned bottom-nav ("Mobil: Navigation als fixierte Leiste unten.") was
 * left as a stub comment in style.css, never implemented. Fix: CcSidebar.vue
 * renders a second root node, `<nav class="cc-bottom-nav">`, driven by the
 * SAME `sections`/`active` props and the SAME "navigate" emit as the
 * existing `<aside class="cc-sidebar">` — no second navigation state, no
 * new data source. Pure CSS decides which one is visible per breakpoint,
 * the exact pattern already used for .cc-live-widget/.cc-live-rail in
 * CcLiveMatchWidget.vue.
 */
test('CcSidebar.vue renders a bottom-nav sharing the same sections/active/navigate as the sidebar', async () => {
  const text = await source('components/ControlCenter/CcSidebar.vue');
  assertContains(text, [
    /<nav class="cc-bottom-nav" aria-label="Control-Center-Bereiche \(mobil\)">/,
    /v-for="section in sections"/,
    /\$emit\('navigate', section\.id\)/,
    /'cc-bottom-nav-item', section\.id === active && 'is-active'/,
    /:title="section\.label"/,
    /\{\{ section\.shortLabel \?\? section\.label \}\}/,
    /v-if="section\.preview" class="cc-bottom-nav-badge"/,
  ], 'CcSidebar.vue');
});

/**
 * Code-review follow-up: an earlier version set `aria-label` to the full
 * `label` while the visible text was the shorter `shortLabel` — for
 * "Einstellungen"/"Optionen" that meant the accessible name didn't even
 * contain the visible text, violating WCAG 2.5.3 "Label in Name" (a
 * speech-input user saying "click Optionen" wouldn't match a button whose
 * accessible name is "Einstellungen"). Fix: no `aria-label` override at all
 * — the button's own visible text content (`.cc-bottom-nav-label`) already
 * becomes its accessible name, so accessible name and visible text are
 * always identical by construction. `title` (a supplementary hover tooltip)
 * keeps the full `label` — it doesn't override the accessible name once
 * the button has visible text content.
 */
test('CcSidebar.vue bottom-nav has no aria-label overriding the shortened visible text (WCAG 2.5.3)', async () => {
  const text = await source('components/ControlCenter/CcSidebar.vue');
  const bottomNavIdx = text.indexOf('class="cc-bottom-nav"');
  assert.ok(bottomNavIdx !== -1, 'CcSidebar.vue: .cc-bottom-nav not found');
  const bottomNavButton = text.slice(bottomNavIdx, text.indexOf('</nav>', bottomNavIdx));
  assert.doesNotMatch(bottomNavButton, /aria-label="section\.label"/, 'CcSidebar.vue: bottom-nav button must not set an aria-label longer than its visible (shortLabel) text');
});

/**
 * The bottom-nav is hidden by default (tablet/desktop keep the existing
 * sidebar/icon-rail unchanged) and only takes over at real phone widths —
 * a dedicated breakpoint below the existing 1080px icon-rail breakpoint, so
 * ~768px+ tablets still get the icon rail, not the bottom nav.
 */
test('style.css hides .cc-bottom-nav by default and switches to it only below the existing icon-rail breakpoint', async () => {
  const text = await source('entrypoints/controlcenter/style.css');
  const bottomNavBaseIdx = text.indexOf('.cc-bottom-nav {');
  assert.ok(bottomNavBaseIdx !== -1, 'style.css: .cc-bottom-nav base rule missing');
  assert.match(text.slice(bottomNavBaseIdx, bottomNavBaseIdx + 200), /display: none;/, 'style.css: .cc-bottom-nav must be hidden by default (tablet/desktop unaffected)');

  const railBreakpointIdx = text.indexOf('@media (max-width: 1080px)');
  const phoneBreakpointIdx = text.indexOf('@media (max-width: 640px)');
  assert.ok(railBreakpointIdx !== -1 && phoneBreakpointIdx !== -1, 'style.css: expected both the existing icon-rail breakpoint and a new phone breakpoint');
  assert.ok(phoneBreakpointIdx > railBreakpointIdx, 'style.css: the new phone breakpoint (640px) must be narrower than and layered after the existing tablet icon-rail breakpoint (1080px)');

  const phoneBlock = text.slice(phoneBreakpointIdx, phoneBreakpointIdx + 400);
  assertContains(phoneBlock, [
    /\.cc-sidebar \{ display: none; \}/,
    /\.cc-bottom-nav \{ display: flex; \}/,
  ], 'style.css (@media max-width:640px)');
});

/**
 * Code-review follow-up: hiding .cc-sidebar at phone widths silently removed
 * the live-match indicator too, since CcLiveMatchWidget was only ever
 * mounted inside it (visible at every width down to 1080px via
 * .cc-live-rail) — a real loss of existing functionality this task
 * explicitly required avoiding. Fix: mount the same component (a
 * refcounted singleton via useControlCenterStatus(), so a second instance
 * adds no new watcher/data source) inside the bottom-nav too; CSS reserves
 * extra content padding only when a live match is actually present
 * (`:has(.cc-live-rail)`), so the no-match case stays as compact as before.
 */
test('CcSidebar.vue mounts CcLiveMatchWidget inside the bottom-nav too, so it is not lost at phone widths', async () => {
  const text = await source('components/ControlCenter/CcSidebar.vue');
  const bottomNavIdx = text.indexOf('<nav class="cc-bottom-nav"');
  assert.ok(bottomNavIdx !== -1, 'CcSidebar.vue: .cc-bottom-nav not found');
  const bottomNavBlock = text.slice(bottomNavIdx, text.indexOf('</nav>', bottomNavIdx));
  assertContains(bottomNavBlock, [
    /<div class="cc-bottom-nav-live"><CcLiveMatchWidget id-suffix="-mobile" \/><\/div>/,
  ], 'CcSidebar.vue (.cc-bottom-nav)');
});

test('style.css reserves extra bottom-nav padding only while a live match is actually present', async () => {
  const text = await source('entrypoints/controlcenter/style.css');
  assertContains(text, [
    /\.cc-bottom-nav-live \{\s*flex-basis: 100%;\s*\}/,
    /\.cc-bottom-nav:has\(\.cc-live-rail\) ~ \.cc-main \.cc-content \{/,
  ], 'style.css');
});

/**
 * Code-review follow-up: mounting CcLiveMatchWidget a second time (sidebar +
 * bottom-nav) put two elements with the identical `data-testid="cc-live-widget"`
 * (and its child button testids) in the DOM at once — only one visible via
 * CSS per breakpoint, but a testid-based lookup doesn't know that and could
 * resolve to the hidden instance. Fix: an `idSuffix` prop appends to every
 * testid in CcLiveMatchWidget.vue; the bottom-nav instance passes
 * `id-suffix="-mobile"`, the sidebar instance keeps the unsuffixed default.
 */
test('CcLiveMatchWidget.vue testids are suffixable so two simultaneously-mounted instances never collide', async () => {
  const widgetText = await source('components/ControlCenter/CcLiveMatchWidget.vue');
  assertContains(widgetText, [
    /const \{ idSuffix = "" \} = defineProps<\{ idSuffix\?: string \}>\(\);/,
    /:data-testid="`cc-live-widget\$\{idSuffix\}`"/,
    /:data-testid="`cc-live-widget-open\$\{idSuffix\}`"/,
    /:data-testid="`cc-live-widget-open-lobby\$\{idSuffix\}`"/,
    /:data-testid="`cc-live-widget-open-section\$\{idSuffix\}`"/,
  ], 'CcLiveMatchWidget.vue');
  assert.doesNotMatch(widgetText, /data-testid="cc-live-widget"/, 'CcLiveMatchWidget.vue: testid must be suffixable, not a static literal');

  const sidebarText = await source('components/ControlCenter/CcSidebar.vue');
  assertContains(sidebarText, [
    /<CcLiveMatchWidget id-suffix="-mobile" \/>/,
  ], 'CcSidebar.vue');
});
