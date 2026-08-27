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
