# Consolidation Feature/Fix Matrix

**Date:** 2026-08-25  
**Branch:** `fix/control-center-p1`  
**Versions:**
- **Version A (Base):** `origin/develop-v298` / `origin/feature/control-center` @ `8166503` (lifecycle hardening + control center merge)
- **Version B (Head):** `fix/control-center-p1` @ `a23f112` (runtime-tested + P0 fixes)

---

## Legend
| Symbol | Meaning |
|--------|---------|
| ✅ | Present in both (no conflict) |
| ➕ | **Only in Version B** (added on current branch) |
| 🔄 | **Modified in Version B** (behavior change) |
| ⚠️ | Potential conflict / needs manual review |
| 📋 | Documentation / test only |

---

## 1. Match Lifecycle & Player Identity (CRITICAL)

| Feature / Fix | Version A | Version B | Status | Notes |
|---------------|-----------|-----------|--------|-------|
| Lifecycle hardening (phases a-e) | ✅ | ✅ | ✅ | Base feature |
| Player identity resolution via userId | ✅ | 🔄 | 🔄 | **B strengthens**: returns early if identity not resolved instead of defaulting to index 0 |
| `resolveMyPlayerIndex` used in training-mode | ✅ | 🔄 | 🔄 | **B fixes**: early return on unresolved identity |
| `resolveMyPlayerIndex` used in ai-commentator | ✅ | 🔄 | 🔄 | **B fixes**: early return on unresolved identity |
| `resolveMyPlayerIndex` used in share-card | ✅ | 🔄 | 🔄 | **B fixes**: early return on unresolved identity |
| CcHistory winner determination by player identity | ✅ | 🔄 | 🔄 | **B fixes**: strict identity-based winner |
| Training local player resolution | ✅ | 🔄 | 🔄 | **B fixes**: early return on unresolved identity |

**Consolidation Decision:** **Take Version B** — All identity resolution changes are strict improvements (fail-closed instead of defaulting to player 0).

---

## 2. P0 Listener Cleanups (Issue #9)

| Feature / Fix | Version A | Version B | Status | Notes |
|---------------|-----------|-----------|--------|-------|
| next-player-on-take-out-stuck: module-top-level monkey-patch removed | ❌ | ➕ | ➕ | **Applied from patch** |
| next-player-on-take-out-stuck: stable handler refs + clean removal | ❌ | ➕ | ➕ | **Applied from patch** |
| discord-webhooks: MutationObserver guard + cleanup | ❌ | ➕ | ➕ | **Applied from patch** |
| discord-webhooks: autoStartTimer cleanup | ❌ | ➕ | ➕ | **Applied from patch** |
| discord-webhooks: injected button removal on feature remove | ❌ | ➕ | ➕ | **Applied from patch** |
| lobby.content/index.ts: registers discordWebhooksOnRemove | ❌ | ➕ | ➕ | **Applied from patch** |
| Test script: `scripts/test-issue-9-listener-lifecycle.mjs` | ❌ | ➕ | ➕ | **Applied from patch** |

**Consolidation Decision:** **Take Version B** — These are pure P0 fixes with no behavioral changes, already applied and tested.

---

## 3. Training System

| Feature / Fix | Version A | Version B | Status | Notes |
|---------------|-----------|-----------|--------|-------|
| Training history persistence | ✅ | ✅ | ✅ | |
| `mergeTrainingHistories` | ✅ | ✅ | ✅ | |
| Training exercise context persistence | ✅ | ✅ | ✅ | |
| Legacy training history migration | ✅ | 🔄 | 🔄 | **B fixes**: only set migrated flag AFTER successful parse+merge; allows retry on failure |
| Training progress storage (`AutodartsToolsTrainingProgress`) | ❌ | ➕ | ➕ | New storage item for per-exercise progress |
| Training exercises UI fixes | ✅ | 🔄 | 🔄 | Settings/Training.vue improvements |

**Consolidation Decision:** **Take Version B** — Migration fix is critical (prevents silent data loss), progress storage is new feature.

---

## 4. Caller / Audio System

| Feature / Fix | Version A | Version B | Status | Notes |
|---------------|-----------|-----------|--------|-------|
| Audio lifecycle hardening | ✅ | ✅ | ✅ | |
| Sound queue system | ✅ | ✅ | ✅ | |
| Console.log removal (debug) | ✅ | 🔄 | 🔄 | **B removes** debug logs from `playSound` |
| Blob cleanup interval (P0-3) | ❌ | ❌ | ⚠️ | **Deferred per user request** — not in either version |
| unlockAudio listeners (P1-2) | ❌ | ❌ | ⚠️ | **Deferred per user request** — not in either version |

**Consolidation Decision:** **Take Version B** (debug log removal). Document deferred items.

---

## 5. WebSocket & Real-time

| Feature / Fix | Version A | Version B | Status | Notes |
|---------------|-----------|-----------|--------|-------|
| WebSocket capture (monkey-patch) | ✅ | ✅ | ✅ | |
| WebSocket monitor (content script) | ✅ | 🔄 | 🔄 | **B improves**: status handling, toast |
| `processWebSocketMessage` + dedupe | ✅ | ✅ | ✅ | |
| `matchSnapshotDedupe` + `shouldProcessSnapshot` | ✅ | ✅ | ✅ | |
| Two-axis exact duplicate suppression | ✅ | ✅ | ✅ | |
| Auto-reconnect handling | ✅ | ✅ | ✅ | Autodarts-owned; full snapshots on reconnect |
| WebSocket helpers improvements | ✅ | 🔄 | 🔄 | Minor utils changes |

**Consolidation Decision:** **Take Version B** — Monitor improvements are additive.

---

## 6. WLED Integration

| Feature / Fix | Version A | Version B | Status | Notes |
|---------------|-----------|-----------|--------|-------|
| WLED effects system | ✅ | ✅ | ✅ | |
| WLED requests bound to feature lifecycle | ✅ | ✅ | ✅ | |
| WLED match content integration | ✅ | 🔄 | 🔄 | Minor fix in match.content/wled.ts |

**Consolidation Decision:** **Take Version B**

---

## 7. Storage & Config

| Feature / Fix | Version A | Version B | Status | Notes |
|---------------|-----------|-----------|--------|-------|
| Canonical match statistics domain | ✅ | ✅ | ✅ | |
| Precision map persistence (canonical contract) | ✅ | 🔄 | 🔄 | **B restores** via canonical contract |
| Screenshot config section (prep) | ❌ | ➕ | ➕ | New storage section, no consumers yet |
| Career config section (prep) | ❌ | ➕ | ➕ | New storage section, no consumers yet |
| Training progress storage | ❌ | ➕ | ➕ | Per-exercise progress tracking |
| Training history migrated flag | ✅ | 🔄 | 🔄 | **B fixes** migration logic |
| `alarms` permission | ❌ | ➕ | ➕ | Added to manifest |

**Consolidation Decision:** **Take Version B** — All additions are forward-compatible prep or fixes.

---

## 8. Control Center (Dashboard, History, Stats)

| Feature / Fix | Version A | Version B | Status | Notes |
|---------------|-----------|-----------|--------|-------|
| Dashboard statistics view | ✅ | ✅ | ✅ | |
| Dashboard summary | ✅ | 🔄 | 🔄 | CcDashboardSummary.vue minor fix |
| Match history view | ✅ | 🔄 | 🔄 | CcHistory.vue, CcMatchHistory.vue fixes |
| Statistics view (canonical) | ✅ | 🔄 | 🔄 | CcStats.vue fixes |
| Board integration status | ✅ | ✅ | ✅ | |
| Training summary in dashboard | ✅ | ✅ | ✅ | |
| Party mode / multiplayer | ✅ | ✅ | ✅ | |
| Match history ↔ statistics linking | ✅ | ✅ | ✅ | |

**Consolidation Decision:** **Take Version B** — All fixes are incremental improvements.

---

## 9. Settings UI (Major Overhaul)

| Feature / Fix | Version A | Version B | Status | Notes |
|---------------|-----------|-----------|--------|-------|
| Feature card toggle handlers wired | ✅ | 🔄 | 🔄 | **B fixes**: toggle handlers + config props |
| Precision map persistence restored | ✅ | 🔄 | 🔄 | **B restores** via canonical contract |
| Settings components refactored | ✅ | 🔄 | 🔄 | **B updates**: About, Buzzer, Crowd, Friends, GameplayExtras, Help, Liga, Regelwerk, Training, TtsProvider, Wled |
| Settings icons (SVG swap) | ✅ | 🔄 | 🔄 | **B**: png→svg icon swap |

**Consolidation Decision:** **Take Version B** — Comprehensive settings overhaul with fixes.

---

## 10. Build & Test Infrastructure

| Feature / Fix | Version A | Version B | Status | Notes |
|---------------|-----------|-----------|--------|-------|
| TypeScript compile | ✅ | ✅ | ✅ | |
| Chrome MV3 build | ✅ | ✅ | ✅ | |
| Firefox MV2 build | ✅ | ✅ | ✅ | |
| Test suite (126 tests) | ✅ | ✅ | ✅ | All pass |
| Dual test runner (.test.ts + .test.mjs) | ❌ | ➕ | ➕ | Single command runs both |
| Factory gate / runtime test plan | ✅ | 🔄 | 🔄 | **B updates** FACTORY_STATUS.md, RUNTIME_TEST_PLAN.md |
| Production build strips console/debugger | ✅ | ✅ | ✅ | |
| Security: auth token removed from console | ✅ | ✅ | ✅ | |

**Consolidation Decision:** **Take Version B** — All improvements.

---

## 11. Other Fixes & Improvements

| Feature / Fix | Version A | Version B | Status | Notes |
|---------------|-----------|-----------|--------|-------|
| Fullscreen listener cleanup | ❌ | ➕ | ➕ | `detach fullscreenchange listener on cleanup` |
| Crowd listeners cleanup | ✅ | ✅ | ✅ | Already in A |
| Soundboard handlers cleanup | ✅ | ✅ | ✅ | Already in A |
| Training summary timer cleanup | ✅ | ✅ | ✅ | Already in A |
| Buzzer window handlers cleanup | ✅ | ✅ | ✅ | Already in A |
| Lazy match lifecycle race guards | ✅ | ✅ | ✅ | Already in A |
| Migration config updates | ✅ | 🔄 | 🔄 | entrypoints/content/migration-config.ts |
| AI commentator improvements | ✅ | 🔄 | 🔄 | Identity resolution fix |
| Share card identity resolution | ✅ | 🔄 | 🔄 | Identity resolution fix |
| WebSocket monitor content script | ✅ | 🔄 | 🔄 | Status handling improvements |

---

## 12. Documentation

| Document | Version A | Version B | Status | Notes |
|----------|-----------|-----------|--------|-------|
| FACTORY_STATUS.md | ✅ | 🔄 | 🔄 | Updated |
| RUNTIME_TEST_PLAN.md | ✅ | 🔄 | 🔄 | Updated with P1 results |
| FINAL_P1_RUNTIME_GATE_REPORT.md | ❌ | ➕ | ➕ | New: complete P1 verification |
| AUTODARTS_ELITE_FACTORY_CERTIFICATION.md | ❌ | ➕ | ➕ | New: certification doc |
| CLAUDE.md | ❌ | ➕ | ➕ | New: project instructions |
| AGENTS.md | ❌ | ➕ | ➕ | New: agent registry |

---

## Consolidation Strategy Summary

### Always Take Version B (HEAD / `fix/control-center-p1`)
1. **All P0/P1 fixes** — Listener cleanups, identity resolution, migration safety
2. **All new storage items** — Forward-compatible, no consumers yet
3. **All settings UI fixes** — Toggle handlers, persistence restoration
4. **All build/test improvements** — Dual runner, updated docs
4. **All debug log removals** — Production hygiene

### No Conflicts Requiring Manual Merge
The diff shows Version B is a **strict superset** of Version A with:
- 13 additional commits
- 150 files changed, 13,243 insertions, 150 deletions
- No reverts of Version A features
- All changes are additive or corrective

### Deferred Items (Not In Either Version)
- **P0-3:** Caller blob cleanup interval
- **P1-2:** Caller unlockAudio listeners
- Document these in release notes as known limitations

---

## Next Steps (Steps 4-6)
1. **Create consolidation branch** from Version A (`develop-v298`)
2. **Cherry-pick / apply** all Version B commits (or diff-apply)
3. **Verify** builds + tests pass
4. **Update** `develop-v298` to consolidation result