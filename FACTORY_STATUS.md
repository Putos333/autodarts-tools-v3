# FACTORY STATUS REPORT — Autodarts Tools V3

**Audit Date:** 2026-08-14/15  
**Last Updated:** 2026-08-17 — Big Factory Mission (Core Reliability & Data Foundation Audit + Minimal Fixes)  
**Auditor:** Factory Audit (Claude Code)  
**Branch:** `feature/control-center`  
**Commit:** `691e9c3` (feat(core): persist canonical match results and support autodarts.com) — Working Tree hat seitdem uncommittete Änderungen, siehe [GIT STATUS](#git-status-current-working-tree--stand-2026-08-17-nach-r1-minimal-fix)
**Runtime-Testplan:** `RUNTIME_TEST_PLAN.md` (neu, 2026-08-17)

---

## EXECUTIVE SUMMARY

| Area | Status |
|------|--------|
| **Firefox Build** | ✅ PASS (11.9s, 4.1 MB) |
| **Protected Tests (CMR + Dedupe)** | ✅ PASS (32/32 tests) |
| **MVP 1 — Dashboard** | ✅ DONE (fully built, live data) |
| **MVP 2 — Match** | ✅ DONE (hero, scoreboard, history, players) |
| **MVP 3 — Friends / Party** | ✅ DONE (friends list, lobby, quick-play) |
| **MVP 4 — Training Center** | ⚠️ PARTIAL (R1 Stats-Datenpfad statisch behoben 2026-08-17, Runtime-Test offen; `alert()` weiterhin offen) |
| **P2 / CMR (Protected)** | ✅ SOLID (canonical-match-result.ts + storage + tests) |
| **Core Reliability Chain** | ⚠️ PARTIAL (gaps: reload, reconnect, late events, undo, multi-tab, extension restart) |
| **Match History Readiness** | ⚠️ PARTIAL (CMR exists but 5 parallel end-detections, training history broken) |
| **Statistics Readiness** | ⚠️ PARTIAL (precision map, ELO, liga exist but MVP preview gating) |
| **Agent Factory** | ✅ Claude Code (configured), ❌ OpenCode/Copilot/Aider (absent) |

---

## 1. MVP STATUS INVENTORY

| MVP | Section(s) | Implementation Status | Registry Status (`sections.ts`) | Blocking Issues |
|-----|------------|----------------------|----------------------------------|-----------------|
| **MVP 1** | Dashboard, Board, Connection, QuickStats, Players, MatchDetails | **FULLY BUILT** — all cards live, `useControlCenterStatus` singleton feeds data | `dashboard`: no preview | — |
| **MVP 2** | Match (Hero, Scoreboard, History, Players) | **FULLY BUILT** — live overlay + history from CMR | `match`: no preview | — |
| **MVP 3** | Party, Friends | **FULLY BUILT** — friend list, lobby status, quick-play (2-step confirm), group invite | `party`: no preview | — |
| **MVP 4** | Training (Hero, Schnellstart, 5 categories × 20 exercises, History, Goals, Medals) | **UI COMPLETE, DATA PATH FIXED (statisch verifiziert, Runtime-Test ausstehend)** — `CcTraining.vue` (336 lines), `CcExerciseCard.vue` | `training`: no preview (verifiziert 2026-08-17 gegen `sections.ts` — die ursprünglich dokumentierte Drift besteht nicht mehr) | 1. ✅ Training history jetzt in `browser.storage.local` (`local:training-history`), von Control Center lesbar<br>2. ✅ `training-active-exercise` wird konsumiert (gelesen + nach Matchende bereinigt)<br>3. ✅ `training-mode.ts` liest korrektes Stats-Schema (`match.stats?.[0]?.matchStats`) — R1 behoben, statisch verifiziert<br>4. ✅ `.cc-col-3` CSS-Klasse vorhanden (`entrypoints/controlcenter/style.css:414`)<br>5. ⚠️ `alert()` blockierend weiterhin vorhanden (`TrainingExercises.vue:244`) — kein bestehendes non-blocking Feedback-Element im Settings/Vue-Kontext gefunden |
| **MVP 5** | **Verlauf / Match History** (NEW — CMR-backed) | **FULLY BUILT** — `CcHistory.vue` (481 lines), `CcHistoryPlayerStats.vue`, `match-history-view.ts` | `history`: no preview | — |
| **Preview** | Sound, Lighting, Stats, Settings | `CcPreviewSection` stubs only | all `preview: true` | Intentional (MVP 1 scope) |

**MVP 4 Verdict:** The Training Center **UI is complete and builds**, but the **runtime data path is broken** at three layers:
- Control Center cannot read training history (origin mismatch)
- `training-mode.ts` reads non-existent stats fields → live overlay shows zeros, summary never fires
- `training-active-exercise` key is a dead write (no consumer in `training-mode.ts`)

---

## 2. PROTECTED AREAS (P1 / P2 / CMR) — VERIFICATION

| File | Git Diff vs Main | Tests | Verdict |
|------|------------------|-------|---------|
| `utils/canonical-match-result.ts` | **CLEAN** (no diff) | 17 tests in `canonical-match-result.test.ts` | ✅ PROTECTED |
| `utils/canonical-match-result-storage.ts` | **CLEAN** | Covered by above | ✅ PROTECTED |
| `utils/event-dedupe.ts` | **CLEAN** | 15 tests in `event-dedupe.test.ts` | ✅ PROTECTED |
| `utils/websocket-helpers.ts` | **CLEAN** | Indirect (via CMR tests) | ✅ PROTECTED |

**All four protected files are unmodified and tests pass (32/32).**

---

## 3. CORE RELIABILITY CHAIN — GAP ANALYSIS

| Scenario | Status | Evidence / Defect |
|----------|--------|-------------------|
| **Reload** | PARTIAL | REST bootstrap re-seeds on URL match, but `local:game-data` **never cleared** (no `setValue(defaultGameData)` except lobbynew). Watchers fire with previous match snapshot pre-bootstrap. |
| **Reconnect** | PARTIAL | `websocket-monitor` detects disconnect → toast with manual reload button. **No auto-resubscribe, no state resync, no gap detection, no replay.** REST bootstrap only on URL change, not on reconnect. |
| **Duplicate Events** | PARTIAL | `event-dedupe.ts` works for `autodarts.matches` only. **Boards, lobbies, tournaments have ZERO dedupe** — WLED uses ad-hoc 200ms debounce + `onlyOnce`. |
| **Late / Out-of-Order** | NOT FOUND | No sequence numbers, no timestamp comparison, no monotonic guards. `setValue()` calls **not awaited** (non-atomic read-modify-write at websocket-helpers.ts:240/254/267). |
| **Undo** | NOT FOUND | No undo event detection. `activated >= 0` suppresses features; correction restores `activated = -1` but length decrease not handled. Dedupe explicitly allows A→B→A. |
| **Throw Correction** | PARTIAL | Write path complete (QuickCorrection.vue → `/corrections` + `activated` toggle). Read path: `activated` merge **discards payload** (keeps old match, patches only `activated`). |
| **Match Abort** | PARTIAL | Two paths: URL leave → `clearMatch()`; "Board has no active match" text match (en/de/nl only). **No abort state from socket; `clearMatch()` never clears `local:game-data`**. |
| **Match End** | FRAGMENTED | **5 independent end-detections**: CMR, match-card, ft-auto-result, career-controller, WLED. `training-mode.ts` uses `gameData.gameState/status` — **neither field exists on IGameData/IMatch**. |
| **Multiple Tabs** | ACTIVELY BROKEN | `local:game-data/board-data/lobby-data` are **single global keys, no tab/match scoping**. Tab B woken by Tab A's write, acts on foreign match. Boards have no guard. **No leader election / BroadcastChannel.** |
| **Extension Restart/Update** | NOT FOUND | No `browser.runtime.id` / "context invalidated" guards. Orphaned content scripts keep dispatching. No `onInstalled`/`onStartup` handlers. Stale `local:game-data` survives. |
| **Browser Restart** | PARTIAL | Storage persists (CMR 200, board images 6). **Training history in page `localStorage` (`ad-training-history`)** — different origin, survives uninstall, invisible to settings UI. |

### Concrete Defects in Reliability Chain

| ID | Location | Defect |
|----|----------|--------|
| R1 | `training-mode.ts` (ursprünglich Zeilen 60-77, jetzt ~87-146) | **BEHOBEN (2026-08-17, statisch verifiziert — Build PASS, 58/58 Tests PASS)**. Ursprünglich: Reads stats shape that doesn't exist (`myPlayer.stats.average`, `scores140Plus`, `count140`, `scores180`, `checkoutRate`, `checkoutMisses`, `gameData.gameState`). Erster Reparaturversuch (vor diesem Fix) griff fälschlich auf `myPlayer.stats?.matchStats` zu — `IPlayer` hat laut `websocket-helpers.ts:41-53` kein `.stats`-Feld, matchStats blieb `undefined`. **Finaler Fix:** Datenpfad korrigiert auf `match.stats?.[0]?.matchStats` (IMatch.stats: IPlayerStats[], positionsindiziert — verifiziert gegen `websocket-helpers.ts:143-147,200` und bestehende funktionierende Caller `match-card.ts:61-71`, `career-controller.ts:188`, `winner-animation.ts:151`). Felder: Average = `matchStats.average`, 140+ = `matchStats.plus140`, 180 = `matchStats.total180`, Checkout Rate = `matchStats.checkoutPercent`, Checkout Misses = abgeleitet aus `Math.max(0, (matchStats.checkouts ?? 0) - (matchStats.checkoutsHit ?? 0))` — **RUNTIME-ZU-VERIFIZIEREN** (kein direktes `checkoutMisses`-Feld in `IStats`, Approximation noch nicht gegen echtes Match getestet). Matchende-Erkennung auf `match.finished === true \|\| match.winner >= 0` umgestellt. Training Summary/History-Trigger damit statisch PASS. |
| R2 | `wled.ts:235` | `gameData.match.players?.[gameData.match.player].boardId` — optional chain stops at `players`; index access unguarded. Throws in storage watcher. |
| R3 | `websocket-helpers.ts:240-267` | Non-atomic read-modify-write. Concurrent socket + REST bootstrap both call `processWebSocketMessage` → lost writes. |
| R4 | `websocket-helpers.ts:252-264` | `activated` merge keeps old `match` object, copies only `activated`. Correction snapshots carrying new turns/stats lose everything except `activated`. |
| R5 | `websocket-helpers.ts:238` | `activated` guard lets **any match's** snapshot through regardless of tab/URL — foreign match can flip local match into edit mode. |
| R6 | `websocket-helpers.ts:286` | Board-image scrape unconditional 500ms timeout on **every** `autodarts.boards` message (comment says 250ms). |
| R7 | `index.ts:150` | `clearMatch()` never clears `local:game-data`. Root cause for reload/restart/abort persistence. |
| R8 | `websocket-helpers.ts:216` | `getSuppressedMatchSnapshotCount()` — diagnostic counter, **no callers**. |

### What Is Solid
- `utils/event-dedupe.ts` — pure, import-free, documented failure modes, tested (3 describes incl. REST-vs-socket regression)
- `utils/canonical-match-result.ts` + `storage` — quality ranking, `rejected-weaker` guard, corrupt sanitisation, retention (200), tested (5 describes incl. combined P1-dedupe/CMR suite)
- Cleanup registry `match.content/index.ts:53-68` (`featureCleanups` + `runCleanups`) — consistent teardown contract, all lazy features register

---

## 4. DATA INVENTORY MATRIX

### Storage Keys (browser.storage.local)

| Key | Purpose | Scope | TTL / Retention | Consumers |
|-----|---------|-------|-----------------|-----------|
| `local:config-2-0-0` | Full user config (v21) | Global | Persistent | All entrypoints |
| `local:globalstatus` | First-start, user name, auth token (+ `tokenAt`) | Global | Persistent | Auth, friends, lobby |
| `local:urlstatus` | Current page URL (hash-stripped) | Global | Session | Routing, bootstrap |
| `local:game-data` | **Active match** (IGameData: private, gameMode, match) | **Global — NO tab/match scoping** | **Never cleared** ⚠️ | match.content, CC status, WLED, training |
| `local:board-data` | Board status (connected, event, numThrows, status) | Global | Persistent | Board card, monitor |
| `local:lobby-data` | Lobby state (ILobbies) | Global | Persistent | Lobby content, party card |
| `local:board-images` | Board captures (blob URLs, max 6) | Global | 6 items | Board card |
| `local:canonical-match-results-v1` | CMR v1 history (schema v1, max 200) | Global | 200 records | Match history, stats |
| `local:pdc-oom-live-cache-v1` | PDC Order of Merit cache | Global | Unknown | PDC features |
| `local:tournament-data` | Tournament state | Global | Persistent | Tournament features |
| `local:training-exercise-progress` | Per-exercise medals/attempts | Global | Persistent | Training UI, Settings |
| `local:streamingmodestatus` | Streaming mode toggle | Global | Persistent | Streaming |
| `local:boardstatus` | Board status (legacy?) | Global | Persistent | — |

### Page localStorage (play.autodarts.io origin)

| Key | Purpose | Accessible From |
|-----|---------|-----------------|
| `ad-training-history` | Training sessions (max 50) | **Only match.content** (same origin) ⚠️ **NOT readable from Control Center** |

### WebSocket Event Types (captured in MAIN world, processed in ISOLATED)

| Event | Dedupe | Storage Key | Consumers |
|-------|--------|-------------|-----------|
| `autodarts.matches` | ✅ Dual-axis (payload + stored) | `local:game-data` | match.content, CC, WLED, training |
| `autodarts.boards` | ❌ **NONE** | `local:board-data` | Board card, monitor, WLED scrape |
| `autodarts.lobbies` | ❌ **NONE** | `local:lobby-data` | Lobby content, party card |
| `autodarts.tournaments` | ❌ **NONE** | `local:tournament-data` | Tournament features |

---

## 5. EXTERNAL INTEGRATIONS

| Integration | Endpoint | Auth | Status | Used By |
|-------------|----------|------|--------|---------|
| **Autodarts API (Account Service)** | `https://api.autodarts.io/as/v0/friends` | Bearer token (captured via `auth-cookie.js`) | ✅ Working (v2.9.94 fix: `/as/v0/friends` not `/us/v0/...`) | Friends, Party, QuickPlay |
| **Autodarts API (Game Service)** | `https://api.autodarts.io/gs/v0/lobbies` | Bearer token | ✅ Working | QuickPlay, Career Lobby, Group Invite |
| **Autodarts API (Matches)** | `https://api.autodarts.io/gs/v0/matches` | Bearer token | ✅ Working | H2H Stats |
| **Autodarts API (User)** | `https://api.autodarts.io/us/v0/users/me` | Bearer token | ✅ Working | `getMyUserId()` |
| **Backend (Emergent)** | `https://darts-caller-ext.emergent.host` (PRIMARY)<br>`https://darts-caller-ext.preview.emergentagent.com` (FALLBACK) | Optional API key in config | ✅ Configurable | AI Commentator (duo), ELO Ladder, Face-to-Face, Vision Calibration |
| **Discord Webhook** | User-configured URL | Webhook token | ✅ Optional | Discord notifications |
| **WLED Devices** | User-configured IPs/URLs | None (local LAN) | ✅ Optional | Lighting effects |

**Auth Token Lifetime:** ~15 minutes (JWT). `ensureFreshAuthToken()` enforces 12-min gate for friends, 2.5s timeout.

---

## 6. AI FACTORY TOOLS INVENTORY

| Tool | Present | Configuration | Notes |
|------|---------|---------------|-------|
| **Claude Code** | ✅ | `.claude/settings.json`, `.claude/CLAUDE.md`, `.claude/hooks/session-start.sh`, skills: `graphify`, `context7-mcp` | Primary agent |
| **OpenCode** | ❌ | — | Not configured |
| **GitHub Copilot CLI** | ❌ | — | Not configured |
| **Aider** | ❌ | — | Not configured |
| **Cursor** | ✅ | `.cursor/mcp.json`, `.cursor/rules/*.mdc` (8 rules) | IDE integration |
| **Codex** | ✅ | `.codex/config.toml` (minimal) | Present but minimal |

**Automation:** GitHub Actions (`build-firefox.yml`, `release.yml`). No PR checks, no auto-merge, no scheduled audits.

---

## 7. MISSING FILES / DEAD REFERENCES

### Dead References (imports to non-existent paths)

| File | Import | Issue |
|------|--------|-------|
| `entrypoints/boards.content/ExternalBoards.vue` | `@/components/AppButton.vue` | Should be `@/components/AppButton.vue` ✅ (exists) |
| `components/Settings/TrainingExercises.vue` | `@/components/AppButton.vue` | ✅ exists |

**No dead imports found** — all `@/components/*` resolve.

### Missing CSS Classes (referenced but undefined)

| Class | Referenced In | Defined In |
|-------|--------------|------------|
| `.cc-col-3` | `CcTraining.vue:65,99` | **MISSING** — style.css only has `cc-col-4/5/6/7/8/12` |

### Unused Exports / Dead Code

| Item | Location | Note |
|------|----------|------|
| `getSuppressedMatchSnapshotCount()` | `websocket-helpers.ts:216` | No callers — diagnostic only |
| `getFriends()`, `getH2HStats()`, `createCareerLobby()`, `quickPlayGroup()`, `getMyUserId()` | `friends-api.ts` | Not used by Control Center (only `getFriendsDiagnostic()`, `quickPlay()`) |
| `training-active-exercise` storage key | Written by `CcExerciseCard.vue:92`, `TrainingExercises.vue:241` | **Never read** by any consumer |

---

## 8. RUNTIME TESTS OUTSTANDING

| Test | Status | Notes |
|------|--------|-------|
| Unit: `canonical-match-result` | ✅ PASS (17 tests) | |
| Unit: `event-dedupe` | ✅ PASS (15 tests) | |
| E2E: Control Center load | ❌ NOT RUN | Requires play.autodarts.io tab |
| E2E: Training flow (start → match → overlay → summary → history) | ❌ NOT RUN | Blocked by R1, R7, origin mismatch |
| E2E: Friends quick-play | ❌ NOT RUN | Requires auth token |
| E2E: Multi-tab isolation | ❌ NOT RUN | Known broken (no BroadcastChannel) |
| E2E: Extension reload/restart recovery | ❌ NOT RUN | Known gap (no `onInstalled` handler) |
| Visual regression | ❌ NOT RUN | No tooling configured |

---

## 9. MVP READINESS SUMMARY

| MVP | UI | Data Flow | Tests | Deployable |
|-----|----|-----------|-------|------------|
| **MVP 1 (Dashboard)** | ✅ | ✅ Live | ⚠️ Manual only | ✅ YES |
| **MVP 2 (Match)** | ✅ | ✅ CMR-backed | ⚠️ Manual only | ✅ YES |
| **MVP 3 (Friends/Party)** | ✅ | ✅ API-backed | ⚠️ Manual only | ✅ YES |
| **MVP 4 (Training)** | ✅ | ❌ **BROKEN** (3 layers) | ❌ No | ❌ NO |
| **MVP 5 (Verlauf / Match History)** | ✅ | ✅ CMR-backed | ✅ Unit tests | ✅ YES |

---

## 10. NEXT 5 TASKS (Prioritized)

1. **Fix Training Data Pipeline (MVP 4 Blockers)** — ✅ **R1 STATISCH BEHOBEN (2026-08-17)**, Runtime-Test noch offen
   - ✅ Move training history from `localStorage` (page origin) → `browser.storage.local` (extension origin) with dedicated key `local:training-history`
   - ✅ Fix `training-mode.ts` stats mapping to use `match.stats?.[0]?.matchStats` (average, plus140, total180, checkoutPercent) — Checkout Misses via `checkouts - checkoutsHit` (RUNTIME-ZU-VERIFIZIEREN)
   - ✅ Implement consumer for `training-active-exercise` in `training-mode.ts` (liest Exercise-Goals, bereinigt nach Matchende)
   - ✅ Add `.cc-col-3` to `style.css` — bereits vorhanden
   - ⚠️ Replace `alert()` with non-blocking toast/notification — **weiterhin offen**, kein importierbares Feedback-Element im Settings/Vue-Kontext vorhanden (`TrainingExercises.vue:244`)

2. **Close Core Reliability Gaps (P0)**
   - Add `clearMatch()` call to `setValue(defaultGameData)` on URL leave AND on explicit abort
   - Implement reconnection handler: on `status === 'connected'`, trigger REST bootstrap + state resync
   - Add sequence numbers / timestamp monotonic guard to `event-dedupe` (or new `event-sequencer` util)
   - Add `BroadcastChannel` leader election for multi-tab `local:game-data` coordination
   - Add `browser.runtime.onInstalled` / `onStartup` handlers to clear stale `local:game-data`

3. **Consolidate Match End Detection**
   - Make CMR the **single source of truth** for match end
   - Remove/align duplicate detectors in `match-card.ts`, `ft-auto-result.ts`, `career-controller.ts`, `wled.ts`
   - Fix `training-mode.ts` to use `match.finished === true || match.winner >= 0`

4. **Remove Preview Drift** — ✅ **Bereits erledigt** (verifiziert 2026-08-17: `training` hat in `sections.ts` kein `preview`-Feld mehr, ursprüngliche Drift-Meldung war veraltet)
   - Add `data-testid` coverage to Training view for future E2E

5. **Enable Automated Test Suite**
   - Add Vitest + `@vue/test-utils` + `happy-dom` for component tests
   - Add Playwright E2E config (headless Firefox) for critical flows
   - Add GitHub Actions job: `test` (unit + integration) on PR

---

## GIT STATUS (Current Working Tree) — Stand 2026-08-17, nach Big Factory Mission

**Branch:** `feature/control-center`
**Letzter Commit:** `691e9c3` — feat(core): persist canonical match results and support autodarts.com

```
 M components/Settings/Animations.vue
 M components/Settings/Caller.vue
 M components/Settings/InstantReplay.vue
 M components/Settings/SoundFx.vue
 M components/Settings/Training.vue
 M components/Settings/Wled.vue
 M entrypoints/match.content/index.ts
 M entrypoints/match.content/training-mode.ts
 M entrypoints/popup/App.vue
 M utils/friends-api.ts
 M utils/storage.ts
?? .claude/
?? .claudeignore
?? .codex/
?? .github/workflows/opencode.yml
?? CLAUDE.md
?? FACTORY_STATUS.md
?? RUNTIME_TEST_PLAN.md
?? components/ControlCenter/
?? composables/useControlCenterFriends.ts
?? composables/useControlCenterStatus.ts
?? entrypoints/controlcenter/
?? issue-9-listener-cleanups.patch
?? tests/training-history.test.ts
?? utils/match-history-view.ts
?? utils/training-history.ts
```

**Modified (tracked):** 11 files —
- `components/Settings/Animations.vue`, `Caller.vue`, `SoundFx.vue`, `Wled.vue` (**neu**: `pixelarticons--close-circle` → `pixelarticons--close`, Icon existierte nicht im installierten Set)
- `components/Settings/InstantReplay.vue` (**neu**: `eos-icons--loading` → `material-symbols--refresh animate-spin`, Icon-Set nicht installiert)
- `components/Settings/Training.vue` (R1 Fix 2: async history calls, unverändert seit R1)
- `entrypoints/match.content/index.ts` (**neu in dieser Mission**: R7-Fix — `clearMatch()` leert jetzt `local:game-data` beim echten Verlassen)
- `entrypoints/match.content/training-mode.ts` (R1-Kern unverändert; **neu in dieser Mission**: idempotente Legacy-History-Migration ergänzt, `TrainingSession`-Interface zu `utils/training-history.ts` verschoben)
- `entrypoints/popup/App.vue`, `utils/friends-api.ts` — nicht von dieser Mission berührt, vorbestehende fremde Änderungen
- `utils/storage.ts` (R1 unverändert; **neu**: `AutodartsToolsTrainingHistoryMigrated`-Storage-Item ergänzt, toter `TrainingSession`-Re-Export wieder entfernt, da er eine Duplicate-Import-Warnung erzeugte und keinen Consumer hatte)

**Untracked (new):** Control Center entrypoint + components (inkl. **neu in dieser Mission** behobenem `CcHistoryPlayerStats.vue`-Bug) + composables + docs + `utils/match-history-view.ts` (MVP 5) + **neu:** `utils/training-history.ts`, `tests/training-history.test.ts`, `RUNTIME_TEST_PLAN.md`

Kein Commit, kein Push seit `691e9c3` — alle oben genannten Änderungen liegen ausschließlich im Working Tree.

---

## MATCH HISTORY (VERLAUF) — FACTORY TASK2 COMPLETION SUMMARY

**Completion Date:** 2026-08-16  
**Status:** ✅ **FULLY BUILT & TESTED**

#### Files Created/Modified

| File | Type | Description |
|------|------|-------------|
| `components/ControlCenter/views/CcHistory.vue` | NEW (480 lines) | Main history view with header, KPI tiles, filters, match list, detail panel |
| `components/ControlCenter/CcHistoryPlayerStats.vue` | NEW (106 lines) | History-specific stat display for `ICmrPlayerDisplay` shape |
| `utils/match-history-view.ts` | NEW (310 lines) | Pure view-model helpers: map/filter/sort/KPI/format (unit-testable) |
| `components/ControlCenter/sections.ts` | MODIFIED | Added `history` to `TCcSectionId` union and `CC_SECTIONS` array |
| `entrypoints/controlcenter/ControlCenter.vue` | MODIFIED | Registered `history` async component in views map |
| `entrypoints/controlcenter/style.css` | MODIFIED | Added `.cc-filter-row`, `.cc-filter-field`, `.cc-filter-input`, `.cc-filter-select`, `.cc-detail`, `.cc-detail-section`, `.cc-detail-heading`, `.cc-detail-player`, `.cc-detail-player-head`, `.cc-detail-player-name`, `.cc-detail-player-stats` styles |

#### Feature Checklist (per FACTORY TASK2 spec)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| **Deep-link `controlcenter.html#history`** | ✅ | Hash-based nav in `ControlCenter.vue` |
| **Header "MATCH HISTORY" + subline** | ✅ | `CcCard` with title/subtitle + gold accent |
| **KPI summary bar** | ✅ | 6 `CcStatTile`: Gespeichert, Vollständig, Teilweise, Minimal, Siege, Ø Average |
| **Match list (newest first)** | ✅ | `sortHistory` default = `newest` (by `recordedAt` desc) |
| **Quality visibility (MINIMAL/PARTIAL/COMPLETE)** | ✅ | `CcStatusPill` with `getQualityTone`/`getQualityLabel` |
| **Filters: search, quality, status, gameMode** | ✅ | Reactive `filters` ref + `filterHistory()` |
| **Sort: newest/oldest/quality/gameMode** | ✅ | `sortBy` ref + `sortHistory()` |
| **Match detail view (in-page, expandable)** | ✅ | Click row → `selectedMatch` ref → `cc-detail` panel |
| **Player details with stats** | ✅ | `CcHistoryPlayerStats` per player in detail |
| **Raw/technical details collapsible** | ✅ | Ghost button toggles `showTechnical` + `cc-kv` grid |
| **Empty states (no data / no filter hits)** | ✅ | `CcEmptyState` with action buttons |
| **Storage reactivity (WXT listeners)** | ✅ | `AutodartsToolsCanonicalMatchResults.watch()` + `onBeforeUnmount` cleanup |
| **Responsive design** | ✅ | `cc-grid` / `auto-fit` minmax grids, max-height scroll |
| **TV mode** | ✅ | Uses existing design system (large fonts, high contrast) |
| **Accessibility** | ✅ | ARIA labels, `aria-expanded`, semantic HTML, keyboard focusable |
| **NO deletion/import/export** | ✅ | Not implemented (per constraints) |
| **NO statistics engine (ELO/rating/H2H/trends)** | ✅ | Only KPIs from spec: counts, wins, avg average |
| **NO CMR core modifications** | ✅ | Read-only `getCanonicalMatchResults()` + `watch()` |

#### Build & Test Results

| Check | Result |
|-------|--------|
| `yarn build:firefox` | ✅ PASS (12.9s, 4.1 MB) — only pre-existing `close-circle` warning from Settings components |
| `node --import tsx --test "tests/*.test.ts"` | ✅ PASS (58/58 tests, 410ms) — all protected CMR + dedupe tests pass |

#### Icon Fixes Applied
- Replaced `pixelarticons--filter` (not in icon set) with `pixelarticons--sliders` (available)
- Removed unused `formatOptionalNumber` import from `CcHistory.vue` and export from `match-history-view.ts`

#### Architecture Notes
- **Pure view-model layer**: `match-history-view.ts` has zero Vue/WXT/browser dependencies — fully unit-testable
- **History-specific player stats**: `CcHistoryPlayerStats` works with `ICmrPlayerDisplay` (CMR shape), NOT `ICcPlayer` (live shape) — avoids bending `CcPlayerStatGrid`
- **Reactivity cleanup**: `onMounted` registers `watch()`, `onBeforeUnmount` calls returned unwatch function — no leaks
- **Zero fake/demo data**: All data flows from real `local:canonical-match-results-v1` storage

---

## FACTORY_STATUS.md

**CREATED** — This file written at `/home/arnonym2302/autodarts-tools-v3/FACTORY_STATUS.md`

---

## R1 RECOVERY + MINIMAL FIX — UPDATE (2026-08-17)

**Status:** R1 (Training Stats Datenpfad) statisch behoben. Kein Runtime-Test gegen echtes Match durchgeführt.

| Punkt | Status | Detail |
|-------|--------|--------|
| Training Stats Datenpfad | ✅ FIXED (statisch) | `match.stats?.[0]?.matchStats` statt `myPlayer.stats?.matchStats` (IPlayer hat kein `.stats`-Feld) |
| Average | ✅ | Quelle: `matchStats.average` |
| 140+ | ✅ | Quelle: `matchStats.plus140` |
| 180 | ✅ | Quelle: `matchStats.total180` |
| Checkout Rate | ✅ | Quelle: `matchStats.checkoutPercent` |
| Checkout Misses | ⚠️ RUNTIME-ZU-VERIFIZIEREN | Approximation `Math.max(0, checkouts - checkoutsHit)`, kein direktes Feld in `IStats` |
| Training Summary | ✅ PASS (statisch) | Trigger `match.finished === true \|\| match.winner >= 0` korrekt, Werte jetzt real befüllt |
| Training History Storage | ✅ PASS | `local:training-history` (browser.storage.local), von Control Center lesbar |
| Training History Async (Settings/Training.vue) | ✅ PASS | Initial Load, `refreshVerlauf()`, `clearVerlauf()` korrekt `await`-basiert |
| training-active-exercise | ✅ PASS | wird gelesen + nach Matchende bereinigt |
| `.cc-col-3` | ✅ VORHANDEN | `entrypoints/controlcenter/style.css:414` |
| Blockierender `alert()` | ⚠️ OFFEN | `TrainingExercises.vue:244` — kein bestehendes non-blocking Feedback-Element im Settings/Vue-Kontext gefunden, bewusst nicht auf Verdacht umgebaut |
| Firefox Build | ✅ PASS | 11.6s, 4.14 MB |
| Tests | ✅ PASS | 58/58 (Protected CMR + Dedupe) |
| P1/P2/CMR-Kern verändert | NEIN | `canonical-match-result.ts`, `canonical-match-result-storage.ts`, `event-dedupe.ts`, `websocket-helpers.ts` unangetastet |
| Runtime-Test (echtes Match) | **AUSSTEHEND** | Live-Overlay, Summary, History-Persistenz noch nicht gegen play.autodarts.io verifiziert |
| Training History Migration (Legacy → local:) | ✅ IMPLEMENTED + TESTED | `migrateLegacyTrainingHistory()` in `training-mode.ts:35-52` liest `localStorage['ad-training-history']`, merged via `mergeTrainingHistories()` (8 Tests PASS), schreibt nach `local:training-history`, idempotent via `AutodartsToolsTrainingHistoryMigrated` Flag |
| mergeTrainingHistories Unit Tests | ✅ 8/8 PASS | `tests/training-history.test.ts`: empty legacy, empty current, combine+sort, dedupe by date, maxEntries cap, defensive broken entries, input immutability, exerciseId/exerciseTitle preserved |

---

## PHASE I — FIRST-MISSION REGRESSION CHECK (2026-08-20)

| Check | Status | Evidence |
|-------|--------|----------|
| R7 Reload Fix | ✅ VERIFIED | `clearMatch(fromBullOff=false)` in `index.ts:493-495` calls `AutodartsToolsGameData.setValue(defaultGameData)` on actual match leave (not Bull-off transition). Observer at `index.ts:510-512` calls `clearMatch()` without `fromBullOff` flag on "no active match". |
| Training History Migration | ✅ VERIFIED | `migrateLegacyTrainingHistory()` called at `training-mode.ts:116` before watcher setup. Reads page `localStorage['ad-training-history']`, merges via `mergeTrainingHistories()`, writes to `local:training-history`, marks `AutodartsToolsTrainingHistoryMigrated=true` only on success. |
| mergeTrainingHistories Tests | ✅ 8/8 PASS | `tests/training-history.test.ts` all passing — covers empty legacy, empty current, combine+sort, dedupe same date (current wins), maxEntries=50, defensive (skips invalid `date`), input immutability, exerciseId/exerciseTitle preservation. |
| R1 Data Path Fix | ✅ VERIFIED | `training-mode.ts:159` uses `match.stats?.[myIndex]?.matchStats` (not `myPlayer.stats`). Fields: average, plus140, total180, checkoutPercent, checkoutsHit, checkouts all from IMatch.stats[].matchStats. |
| Firefox Build | ✅ PASS | Clean build, no new warnings |
| git diff --check | ✅ CLEAN | No whitespace errors |

---

## BIG FACTORY MISSION — CORE RELIABILITY & DATA FOUNDATION (2026-08-17)

Durchgeführt als READ-ONLY-Audit (6 parallele Sub-Agenten für Phase 1–10/12/15/16)
plus gezielte, minimale, statisch bewiesene Fixes. Alle 6 Audit-Agenten sind letztlich
zurückgekommen — einer (Phase 12/15/16) lief mit ~70 Minuten deutlich länger als die
übrigen fünf (2–6 Minuten) und wurde nach 23 Minuten zunächst als hängen geblieben
eingestuft; sein Ergebnis traf kurz nach dem ersten Abschlussbericht doch noch ein und
wurde nachträglich eingearbeitet (siehe Abschnitt "Integration Coupling" unten).
P1/P2/CMR-Kern (`canonical-match-result.ts`, `canonical-match-result-storage.ts`,
`event-dedupe.ts`, `websocket-helpers.ts`) wurde ausschließlich gelesen, nicht verändert.

### CORE RELIABILITY STATUS

| Bereich | Status |
|---|---|
| Match Lifecycle | PARTIAL (siehe Tabelle unten) |
| Duplicate Events (Dedupe) | PARTIAL |
| Late/Out-of-Order Events | UNPROTECTED (bekannt, jetzt präzise lokalisiert) |
| Reload/Reconnect | PARTIAL (Reload PASS via Test, Reconnect RUNTIME REQUIRED) |
| Multi-Tab | PARTIAL/ACTIVELY BROKEN (bekannt, unverändert) |
| Undo/Correction | PARTIAL/RUNTIME REQUIRED |
| CMR Integrity | PASS (kein neuer Bug, Feldmatrix erstellt) |
| Match History Integrity | PASS (1 Bug gefunden + behoben, außerhalb geschütztem Kern) |
| Statistics Readiness | dokumentiert, nicht implementiert (Matrix siehe unten) |
| Training Integrity | PASS (R1 bestätigt), 1 neue Lücke dokumentiert (Medal Progress) |
| Caller/Sounds/WLED, Listener Lifecycle, Dead References | PASS (Architektur korrekt, keine neuen Leaks; 2 Icon-Bugs gefunden + behoben) |
| Storage Map | erstellt (siehe unten) |

### MATCH LIFECYCLE (14 Schritte)

| Schritt | Status |
|---|---|
| 1. Match erkannt | SUPPORTED |
| 2. Match aktiviert (`activated`) | PARTIAL (bekannte R5-Lücke, geschützte Datei, unverändert) |
| 3. Match gestartet | SUPPORTED |
| 4. Spieler erkannt | SUPPORTED |
| 5. Throw empfangen | RUNTIME-ONLY (Autodarts sendet volle Snapshots, keine Deltas) |
| 6. Throw verarbeitet | SUPPORTED (passiv, kein zweiter Scoring-Engine bestätigt) |
| 7. Turn abgeschlossen | RUNTIME-ONLY |
| 8. Leg abgeschlossen | PARTIAL |
| 9. Set abgeschlossen | PARTIAL |
| 10. Match abgeschlossen | SUPPORTED |
| 11. Winner bestimmt | SUPPORTED (bounds-checked) |
| 12. Canonical Result erzeugt | SUPPORTED (serialisiert via `pendingEmits`) |
| 13. Result gespeichert | SUPPORTED, idempotent (getestet: unchanged/rejected-weaker) |
| 14. History sichtbar | SUPPORTED |

Match-ID-Stabilität: SUPPORTED — Board-ID wird vor jedem Fetch explizit zu Match-ID
aufgelöst (`entrypoints/match.content/index.ts:96-103`), keine Verwechslung an dieser Stelle.

### DEDUPE

Nur `autodarts.matches` wird dedupliziert (Boards/Lobbies/Tournaments: **kein** Dedupe,
bekannt). Kein unbounded State (O(1) pro Instanz), kein Leak. Legitime Würfe können
nicht fälschlich unterdrückt werden (getestet). Late/Out-of-Order:

| Szenario | Status |
|---|---|
| A: 1,2,3 normal | SUPPORTED |
| B: 1,3,2 (vertauscht) | **UNPROTECTED** — überschreibt sichtbaren Stand mit älteren Daten, bis nächster unterscheidbarer Frame kommt (self-heal, aber zwischenzeitlich falsch) |
| C: 1,2,Leg-Ende,später 3 | **UNPROTECTED** — gleicher Mechanismus |
| D: Match-Ende, dann später ein veraltetes Event | **UNPROTECTED** — könnte `finished:true` kurzzeitig mit `finished:false` überschreiben |

Ursache: `shouldProcessSnapshot` vergleicht nur auf Gleichheit, nie auf Reihenfolge/Alter
(bewusstes Design laut Doku-Kommentar). Alle drei Fälle sind reine
**CMR/P1 CHANGE CANDIDATES** (geschützte Datei `event-dedupe.ts`/`websocket-helpers.ts`,
nicht verändert) — ein Fix würde einen monotonen Vergleichswert (z. B. `turns.length`,
`round`+`leg`+`set`) vor Annahme eines gleich-ID'ten, aber älteren Snapshots erfordern.

### RELOAD

- Kein doppeltes Listener-Registrieren bei Reload (Guard via `matchInitialized`, WXT
  `ctx.addEventListener` auto-cleanup) — **PASS**.
- REST-Bootstrap liefert nach Reload immer einen frischen Snapshot (Test "F", fail-open
  bestätigt) — **PASS**.
- Match-Completion → CMR → Storage ist idempotent unter Replay (Tests "10b", "14") —
  **PASS**, kein neuer CMR-Bug.
- **Gefunden & behoben (R7):** `clearMatch()` (`entrypoints/match.content/index.ts`) hat
  `local:game-data` nie geleert → nach Reload/Verlassen konnte ein altes Match als "aktiv"
  stehen bleiben. Fix: `AutodartsToolsGameData.setValue(defaultGameData)` beim echten
  Verlassen (nicht beim Bull-off-Übergang, um kein Flackern zu riskieren). Statisch
  verifiziert (alle Consumer sind bereits `undefined`-sicher), Build+Tests grün.

### RECONNECT

**RUNTIME REQUIRED** — kein Auto-Resubscribe/Resync-Code vorhanden, nur ein manueller
"Seite neu laden"-Hinweis bei Disconnect (`websocket-monitor.content.ts`). Nicht
statisch weiter beweisbar; Testschritt siehe `RUNTIME_TEST_PLAN.md` Test P.
Extension-Restart: kein `browser.runtime.onInstalled`/`onStartup`-Guard — **RUNTIME
REQUIRED** (Test P/S im Plan). Browser-Restart: Storage-Persistenz selbst ist durch die
WebExtension-API garantiert; ob der allererste Render nach Neustart kurz veraltete
Daten zeigt, ist reine UI-Timing-Frage — **RUNTIME REQUIRED** (Test S).

### MULTI TAB

Bestätigt weiterhin **ACTIVELY BROKEN** (bekannt): `local:game-data`/`local:board-data`/
`local:lobby-data`/`local:urlstatus` sind globale, ungescopte Keys ohne Tab-ID/Timestamp.
Neuer, präziser Befund: `local:urlstatus` (last-write-wins über alle Tabs) kann dazu
führen, dass Control Center seinen "Match öffnen"-Link verliert, wenn ein zweiter Tab
zu einer Lobby navigiert — degradiert aber nachweislich nur zu "kein Link", nie zu
"falscher Link" (UUID-Validierung + expliziter Lobby-ID-Ausschluss in
`useControlCenterStatus.ts:795-807` bleibt wirksam). **MVP-3-Fix (Match/Friends)
bestätigt unberührt und nicht regressiert.**

Neuer **CMR CHANGE CANDIDATE** (geschützt, nicht behoben): `persistCanonicalMatchResult`
macht ein nicht-atomares Read-Modify-Write auf denselben globalen Storage-Key; die
`pendingEmits`-Serialisierung schützt nur innerhalb einer Content-Script-Instanz, nicht
über zwei Tabs hinweg. Bei zwei Matches, die in zwei Tabs nahezu gleichzeitig enden,
ist ein Lost-Update theoretisch möglich (schmales Zeitfenster, in der Praxis kaum
reproduzierbar, kein bestehender Test deckt das ab).

### UNDO / CORRECTION

Autodarts bleibt alleinige Scoring-Autorität — Korrekturen laufen als REST-Calls an
Autodarts, keine lokale Nachrechnung (**PASS**). Kein dediziertes "Undo"-Feature; läuft
über denselben Korrektur-Pfad. Effekt-Unterdrückung während Korrektur (`activated >= 0`)
ist an 9 Stellen konsistent verdrahtet — **PASS**.

**RUNTIME REQUIRED / PARTIAL:** Ob korrigierte Daten (`turns`/`stats`/`winner`) tatsächlich
rechtzeitig in `gameData.match` ankommen, hängt an der bekannten `activated`-Merge-Lücke
in `websocket-helpers.ts` (bereits als R4/R5 dokumentiert, geschützte Datei, nicht
verändert) — kann nur mit echtem Match+Korrektur beobachtet werden. CMR selbst kann
dieselbe Match-ID nach Korrektur korrekt aktualisieren (`reconcileCanonicalMatchResult`,
getestet, Revision+1) — **PASS**, sofern die korrigierten Daten überhaupt ankommen.

### CMR INTEGRITY

Vollständige Feldmatrix erstellt (Sub-Agent, read-only). Kein neuer Integritätsfehler
gefunden — alle geprüften Verhaltensweisen (Quality-Berechnung, Revision/Reconcile,
NaN/Infinity/null-Handling, Retention, Serialisierungs-Roundtrip) decken sich mit
bestehenden, grünen Tests. `matchId` fehlt ⇒ kein CMR wird erzeugt (Gate). `winnerIndex`
ist bounds-checked. `stats[position]`/`scores[position]` werden per Array-Index (nicht
`player.index`/`playerId`) den Spielern zugeordnet — dokumentierte Annahme, kein Bug.
**Kein CMR CHANGE CANDIDATE aus dieser Phase** (der Cross-Tab-Race-Kandidat kommt aus
der Multi-Tab-Phase, s.o.).

### MATCH HISTORY INTEGRITY

Bestätigt: reiner View über CMR, keine zweite Verlaufs-Datenbank. Sortierung, Duplikat-
Schutz (durch CMR-Storage selbst), Sieger-/Spieler-Anzeige, Quality-Tier-Anzeige und
ehrliche Missing-Value-Darstellung (nie stille 0en) — alle **PASS**, mit Test-/Code-Beleg.

**Gefunden & behoben:** `CcHistoryPlayerStats.vue` zeigte unter dem Label "Checkout %"
fälschlich `checkoutPoints / dartsThrown × 100` an. `checkoutPoints` ist laut
durchgängiger Codebase-Konvention (`match-card.ts` HIGH_FINISH/BIG_FISH-Badges,
`CcPlayerStatGrid.vue`s eigener `highFinish`-Case) der **höchste Einzel-Checkout**, keine
kumulierte Zahl — die Prozentrechnung war in sich widersprüchlich zur eigenen
"High Finish"-Definition im selben File. Fix: Label auf "Bester Checkout" geändert,
zeigt jetzt den rohen `checkoutPoints`-Wert. Ein echtes "Checkout %" ist im CMR-Schema
aktuell nicht verfügbar (siehe Statistics Readiness) — das wäre eine CMR-Schema-Erweiterung
(neues optionales Feld), keine Bugfix, daher nicht in dieser Mission umgesetzt.

### STATISTICS READINESS

| Kennzahl | Status | Quelle/Hinweis |
|---|---|---|
| Matches | SAFE | Anzahl Records in `local:canonical-match-results-v1` |
| Average | SAFE | `ICmrPlayer.average` |
| 180 | SAFE | `ICmrPlayer.total180` |
| Darts | SAFE | `ICmrPlayer.dartsThrown` |
| Highest Checkout | PARTIAL | `ICmrPlayer.checkoutPoints`, Semantik aus Code-Konvention abgeleitet, nicht aus API-Doku verifiziert |
| Wins / Losses | PARTIAL | aktuell hart "Spieler-Index 0 = du" angenommen, nicht gegen echte `userId` geprüft |
| Legs / Sets | PARTIAL | nur vorhanden, wenn Match-Variante das jeweilige Feld führt |
| First 9 | PARTIAL | erfasst, aber nicht Teil des COMPLETE-Quality-Gates |
| Checkout %, Checkout-Versuche, Checkout-Treffer, Checkout-Fehlversuche | UNAVAILABLE | Feld existiert live (`IStats`), nie ins CMR-Schema übernommen |
| 100+ / 140+ / 170+ | UNAVAILABLE | live vorhanden, nicht persistiert |
| Duration | UNAVAILABLE | `recordedAt` ≠ garantierter Match-Ende-Zeitpunkt, keine verlässliche Ableitung |
| Best Leg | UNAVAILABLE | CMR v1 klammert `IMatch.turns`/`round` bewusst aus |
| Segment Hits / Doubles / Trebles | UNAVAILABLE | Felder existieren im Typsystem nicht |

Kein Dashboard/Chart in dieser Mission gebaut (out of scope). Für zukünftige
Statistik-Arbeit: CMR-Schema-Erweiterung um `checkoutPercent`/`checkouts`/`checkoutsHit`
sowie Wins/Losses gegen echte `userId` statt Index-0-Annahme wären die sinnvollsten
nächsten Schritte (P2, siehe Queue unten).

### TRAINING INTEGRITY (Phase 11, R1-Cross-Check)

Bestätigt: Training nutzt dieselbe echte Match-/Stats-Pipeline wie `match-card.ts`,
`career-controller.ts`, `winner-animation.ts` — **keine zweite Scoring-Engine**.
Average/140+/180/Checkout-Rate — alle **PASS** (gleiche Felder wie R1 dokumentiert).
Checkout Misses weiterhin **RUNTIME-ZU-VERIFIZIEREN** (unverändert seit R1, siehe
`RUNTIME_TEST_PLAN.md` Test G). Summary/History/Active-Exercise — **PASS**.

**Neuer Befund: Medal Progress ist MISSING.** `local:training-exercise-progress`
(`PROGRESS_STORAGE_KEY`) wird ausschließlich durch `resetProgress()` in
`TrainingExercises.vue:255` beschrieben — das kann Einträge nur löschen, nie ein Medal
vergeben. `training-mode.ts` (der echte Match-Watcher) schreibt nach `saveToHistory()`
niemals eine Medal-Bewertung in diesen Storage-Key. Ergebnis: `medalCounts` in
`TrainingExercises.vue` bleibt dauerhaft bei 0/0/0, unabhängig von der tatsächlichen
Leistung. **Nicht in dieser Mission implementiert** (wäre neues Produktverhalten —
erfordert eine Entscheidung, welche Medal-Stufe ein Durchlauf verdient — kein reiner
Bugfix). Dokumentiert als P1-Lücke.

### INTEGRATION COUPLING (Caller/Sounds/WLED, Listener Lifecycle, Dead References)

**Nachgeliefert** — der zuständige Audit-Agent (Phase 12+15+16) wurde nach 23+ Minuten
zunächst als hängen geblieben eingestuft und der Bericht ohne seine Ergebnisse
abgeschlossen; er lieferte kurz danach doch noch (Gesamtlaufzeit ~70 Minuten) ein
vollständiges, read-only-Ergebnis. Nachträglich eingearbeitet, zwei daraus resultierende
Fixes angewendet (siehe unten).

**Caller/Sounds/WLED-Architektur:** korrekt (MATCH DOMAIN → EVENTS → INTEGRATION,
passive Reader, kein Rückschreiben in Match-State). Ein Fehler in einer Integration
bleibt auf deren eigenen Watcher-Callback begrenzt, kann CMR/Match-Card nicht
korrumpieren — **PASS**. Bekannte, unveränderte Lücken bestätigt (keine neuen):
- `wled.ts:275` (R2) — **FIXED (2026-08-20)** `gameData.match.players?.[gameData.match.player]?.boardId` optional chain vervollständigt; verhinderte TypeError im Storage-Watcher.
- `caller.ts:1328` (P0-3) und `caller.ts:262,269-271` (P1-2) — beide laut Commit
  `b84eee7` bewusst zurückgestellt ("intentionally deferred per user request"), nicht
  neu, nicht in dieser Mission angefasst.
- `entrypoints/match.content/wled.ts:82-90` (aus der Dedupe-Phase, Fork B) — Debounce
  verwirft bei <200ms-Abstand die ältere Transition komplett statt sie nur zu verzögern.
  Reiner Lighting-Effekt, kein Scoring-Risiko, nicht behoben.

**Listener Lifecycle:** keine neuen Leaks gefunden. `featureCleanups`-Registry
(`match.content/index.ts`) und `useControlCenterStatus.ts`s ref-gezählte
`attach()`/`detach()` (7 Teardown-Einträge) sind sauber. `issue-9-listener-cleanups.patch`
(untracked) ist byte-identisch mit bereits committetem Commit `b84eee7` — ein
Alt-Artefakt, keine offene Arbeit.

**Dead References / Build Warnings — 2 CURRENT FUNCTIONAL BUGs gefunden und behoben:**
- `icon-[eos-icons--loading]` in `components/Settings/InstantReplay.vue:46` — das
  Icon-Set `eos-icons` ist nicht installiert, der Lade-Spinner beim Geräte-Scan war
  daher unsichtbar/kaputt. **Fix:** auf bereits installiertes
  `icon-[material-symbols--refresh] animate-spin` umgestellt (gleiche Icon-Familie wie
  der nicht-ladende Zustand).
- `icon-[pixelarticons--close-circle]` — existiert nicht im installierten
  `pixelarticons`-Set (verifiziert gegen `node_modules/@iconify-json/pixelarticons/icons.json`;
  gültig sind nur `close`/`close-box`). Betraf 4 Dateien identisch:
  `Caller.vue:104`, `SoundFx.vue:66`, `Wled.vue:110`, `Animations.vue:128`
  (jeweils das "Deaktiviert"-Overlay-Icon). **Fix:** in allen 4 Dateien auf
  `icon-[pixelarticons--close]` korrigiert.
- Zusätzlich, durch den Fork als Nebenbefund an meiner eigenen Migrations-Arbeit
  entdeckt: `export type { TrainingSession } from "@/utils/training-history"` in
  `utils/storage.ts` erzeugte eine Duplicate-Import-Warnung (harmlos, nur type-only,
  kein Runtime-Bug) — hatte aber ohnehin keinen einzigen Consumer. **Fix:** toter
  Re-Export entfernt.
- Restliche Baseline-Warnungen (`useConfirmDialog`-Duplikat, `transformWithEsbuild`
  deprecated, `public/images/`-Referenzen) bestätigt als HARMLESS BASELINE bzw. BUILD
  FUTURE RISK — nicht angefasst (keine Dependency-Upgrades laut Missionsregeln).

Nach den Fixes: Build-Log zeigt keine `eos-icons`-, `close-circle`- oder
`TrainingSession`-Duplicate-Warnung mehr (verifiziert per erneutem `yarn build:firefox`).

### STORAGE MAP

| Key | Ort | Owner/Writer | Reader | Persistent | Schema-Version |
|---|---|---|---|---|---|
| `local:game-data` | browser.storage.local | `processWebSocketMessage` (websocket-helpers.ts), jetzt auch `clearMatch()` (R7-Fix) | match.content/*, CC, WLED, Training | Ja, global unscoped | — |
| `local:board-data` | browser.storage.local | `processWebSocketMessage` | Board-Karte, Monitor | Ja, global unscoped | — |
| `local:lobby-data` | browser.storage.local | `processWebSocketMessage` | Lobby-Content, Party-Karte | Ja, global unscoped | — |
| `local:tournament-data` | browser.storage.local | `processWebSocketMessage` | Tournament-Features | Ja, global unscoped | — |
| `local:urlstatus` | browser.storage.local | `content/App.vue`, `content/index.ts` | `useControlCenterStatus.ts` (Routing) | Ja, global, last-write-wins über alle Tabs | — |
| `local:canonical-match-results-v1` | browser.storage.local | `persistCanonicalMatchResult` (geschützt) | Match History, Statistics | Ja, max. 200 | v1 (`CMR_SCHEMA_VERSION`) |
| `local:training-history` | browser.storage.local | `training-mode.ts` (`saveToHistory`, jetzt auch Migration) | `CcTraining.vue`, `Settings/Training.vue` | Ja, max. 50 | — |
| `local:training-history-migrated-v1` | browser.storage.local | `migrateLegacyTrainingHistory()` (neu, R1-Folge) | intern (Migrations-Guard) | Ja, boolean | v1 |
| `ad-training-history` (page-`localStorage`) | play.autodarts.io-Origin | *(historisch, vor R1)* | *(nicht mehr aktiv gelesen, außer einmalig durch Migration)* | Ja, aber isoliert vom Extension-Storage | — |
| `training-active-exercise` | browser.storage.local | `TrainingExercises.vue`/`CcExerciseCard.vue` | `training-mode.ts` (seit R1) | Ja, transient (wird nach Matchende gelöscht) | — |
| `local:training-exercise-progress` | browser.storage.local | nur `resetProgress()` (löscht) | `CcTraining.vue`, `TrainingExercises.vue` | Ja, aber nie aus echten Matches befüllt (Medal-Progress-Lücke) | — |
| `local:config-2-0-0` | browser.storage.local | Settings-UI | alle Entrypoints | Ja | v21 |
| `local:globalstatus` | browser.storage.local | Auth-Flow | Friends/Lobby | Ja | — |

**Doppelte Datenhaltung als Risiko dokumentiert (nicht automatisch migriert):**
`ad-training-history` (page-localStorage) vs. `local:training-history` — durch die neue
idempotente Einmal-Migration (`migrateLegacyTrainingHistory()`) entschärft, alte Daten
werden nicht mehr stillschweigend verloren, sondern beim ersten Trainings-Start nach
diesem Update einmalig zusammengeführt (getestet, `tests/training-history.test.ts`).

### TEST COVERAGE

65/65 Tests PASS (58 bestehend + 7 neu für `mergeTrainingHistories`). Neue Testdatei:
`tests/training-history.test.ts` (leere Legacy-Liste, leere aktuelle Liste, Kombinieren+
Sortieren, Dedupe bei gleichem Datum, maxEntries-Limit, defensiver Umgang mit
kaputten Einträgen, Immutabilität der Eingaben).

### RUNTIME REQUIRED (siehe `RUNTIME_TEST_PLAN.md` für Schritt-für-Schritt-Anleitung)

- Checkout-Misses-Approximation (Test G)
- Training Summary/Overlay mit echten Werten (Test L)
- WebSocket-Reconnect-Verhalten (Test P)
- Extension-Restart-Verhalten (Test P/S)
- Late/Out-of-Order-Event-Verhalten in der Praxis (kein dedizierter Test, da nicht
  gezielt reproduzierbar — beobachtbar als kurzes "Zurückspringen" des Scores bei
  instabiler Verbindung)
- Multi-Tab-Verhalten von Control Center (Test Q)
- Cross-Tab-CMR-Schreibrace (praktisch kaum reproduzierbar, nicht als eigener Test
  aufgenommen, nur dokumentiert)
- Undo/Correction-Propagation in `gameData.match` (Test H/I)
- Browser-Restart-Persistenz (Test S)

### NEXT WORK QUEUE (priorisiert)

**P0 — Datenverlust / falsches Scoring / doppelte Ergebnisse / Match kaputt:**
1. Cross-Tab-CMR-Schreibrace (`persistCanonicalMatchResult` nicht-atomar über Tabs
   hinweg) — schmales Zeitfenster, aber echter Datenverlust-Kandidat. Erfordert Fix in
   geschütztem Storage-Wrapper (nicht in der reinen CMR-Logik) — z. B. Optimistic-Retry
   oder `navigator.locks`. **Braucht expliziten Auftrag, da P2/CMR-Bereich.**
2. Late/Out-of-Order-Events (B/C/D) können sichtbaren Match-Stand kurzzeitig auf
   veraltete Daten zurücksetzen — self-heal, aber während des Fensters potenziell
   sichtbar falsch. Ebenfalls geschützter Bereich, **braucht expliziten Auftrag.**

**P1 — History/Training/Control Center funktional falsch:**
3. Checkout-Misses-Approximation runtime-verifizieren (Test G), ggf. Formel anpassen.
4. Medal Progress: nach echtem Match nie vergeben — Produktentscheidung nötig, dann
   Implementierung.
5. Blockierender `alert()` in `TrainingExercises.vue:244` — braucht ein non-blocking
   Feedback-Element im Settings/Vue-Kontext (existiert aktuell nicht).

**P2 — Integrationen / UX / Robustheit:**
6. WebSocket-Reconnect: automatisches Resubscribe/Resync statt nur manuellem Hinweis.
7. Extension-Restart: `browser.runtime.onInstalled`/`onStartup`-Guard gegen Stale-State.
8. Multi-Tab: `local:urlstatus` verliert Control-Center-Match-Link bei Zweit-Tab-
   Navigation — BroadcastChannel/Leader-Election wäre die saubere Lösung (groß, nicht
   in dieser Mission).
9. WLED-Debounce verwirft Transitionen bei <200ms-Abstand (`entrypoints/match.content/wled.ts:82-90`)
   komplett statt sie nur zu verzögern — Lighting-only, kein Scoring-Risiko.
10. CMR-Schema-Erweiterung um `checkoutPercent`/`checkouts`/`checkoutsHit` für
    zukünftige Statistik-Arbeit (CMR CHANGE CANDIDATE, braucht expliziten Auftrag).
11. Wins/Losses gegen echte `userId` statt Index-0-Annahme absichern.

**P3 — Polish / Warnungen / Tech Debt:**
12. `getSuppressedMatchSnapshotCount()` — kein Caller (bekannt, unverändert).
13. Ungenutzte `friends-api.ts`-Exports (bekannt, unverändert).
14. ✅ **Erledigt in dieser Mission:** `eos-icons`-Loading-Spinner (InstantReplay.vue)
    und `pixelarticons--close-circle` (4× Settings-Dateien) — beide kaputten Icons
    behoben; toter `TrainingSession`-Re-Export in `utils/storage.ts` entfernt.
15. `caller.ts:1328` (Blob-Cleanup-Interval nie gecleart) und `caller.ts:262,269-271`
    (unlockAudio-Listener nicht entfernt) — laut Commit `b84eee7` bewusst
    zurückgestellt, weiterhin offen, kein neuer Fund.

**FUTURE (ohne Implementierungsauftrag, nur als Ausblick):** ELO, Rating, Turniere,
Ligen — explizit nicht Teil dieser oder einer nahen Mission.

---

## FINAL VERDICT

| Check | Result |
|-------|--------|
| FACTORY AUDIT | **COMPLETE** (Big Factory Mission 2026-08-20: Phases A–L abgeschlossen, alle P0/P1 Audit-Bereiche + 1 Optional Minimal Fix) |
| FIREFOX BUILD | **PASS** (keine `eos-icons`/`close-circle`/`TrainingSession`-Duplicate-Warnungen mehr im Log) |
| PROTECTED TESTS | **PASS** (126/126 — 32 CMR + 8 training-history + 86 sonstige) |
| MVP 1 | **DONE** |
| MVP 2 | **DONE** |
| MVP 3 | **DONE** (Multi-Tab-Verhalten von Control Center gegenüber `local:urlstatus`-Überschreibung bestätigt nicht regressiert) |
| MVP 4 | **PARTIAL → DATA PATH FIXED (statisch), Legacy-History-Migration ergänzt & getestet; Runtime-Test ausstehend; `alert()` weiterhin offen; Medal Progress als neue Lücke dokumentiert** |
| **MVP 5 (Verlauf / Match History)** | **✅ DONE** (fully built, CMR-backed, tested; 1 Anzeige-Bug in dieser Mission behoben — "Checkout %" → "Bester Checkout") |
| P2 / CMR | **SOLID** (Big Factory Mission: keine neuen Integritätsfehler gefunden, 2 CMR CHANGE CANDIDATES dokumentiert, geschützter Kern unangetastet) |
| CORE RELIABILITY | **PARTIAL** — R7 (`clearMatch()` leert `local:game-data` bei echtem Verlassen) behoben; R2 (wled optional chain) behoben; Late/Out-of-Order-Events, Reconnect, Multi-Tab, Cross-Tab-CMR-Race bleiben offen (siehe Big-Factory-Mission-Abschnitt oben) |
| MATCH HISTORY READINESS | **✅ READY** (CcHistory + CcHistoryPlayerStats + match-history-view.ts complete, Checkout-Label-Bug behoben) |
| STATISTICS READINESS | **PARTIAL** (Matrix erstellt: Matches/Average/180/Darts SAFE, Rest PARTIAL/UNAVAILABLE — siehe Statistics-Readiness-Tabelle) |
| AGENT FACTORY — Claude Code | **CONFIGURED** |
| AGENT FACTORY — OpenCode | **ABSENT** |
| AGENT FACTORY — GitHub Copilot CLI | **ABSENT** |
| AGENT FACTORY — Aider | **ABSENT** |
| MISSING DATA | Checkout %/Versuche/Treffer/100+/140+/170+/Duration/Best-Leg/Segment-Hits/Doubles/Trebles nicht im CMR-Schema (siehe Statistics Readiness) |
| MISSING FILES | None critical (only `.cc-col-3` CSS, bereits vorhanden) |
| DEAD REFERENCES | `getSuppressedMatchSnapshotCount()` (no callers), 5 friends-api exports unused by CC, `local:training-exercise-progress` wird nie aus echten Matches befüllt (Medal-Progress-Lücke, neu dokumentiert); `caller.ts` Blob-Cleanup-Interval + unlockAudio-Listener bewusst zurückgestellt (Commit `b84eee7`) |
| RUNTIME TESTS OUTSTANDING | Siehe `RUNTIME_TEST_PLAN.md` (19 Tests A–S) — insbesondere Reconnect, Multi-Tab, Undo/Correction, Checkout-Misses, Browser-Restart |