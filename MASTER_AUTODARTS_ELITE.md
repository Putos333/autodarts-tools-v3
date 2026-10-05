# MASTER AUTODARTS ELITE — ZENTRALE ARBEITS- UND REFERENZDOKUMENTATION

> Dokumentationsdatei. Kein darin enthaltener Entwicklungsauftrag ist hiermit ausgeführt.
> Grundlage: MASTER REQUIREMENTS / PROMPT AUDIT (READ-ONLY), Stand 2026-08-28/29.
> Jede Aussage ist am aktuellen Code/Test-Bestand bei HEAD `2422705b` belegt; nicht belegte Werte sind explizit als `UNKNOWN` markiert.

---

## 1. PROJEKTIDENTITÄT

| Feld | Wert |
|---|---|
| Produktname | Tools for Autodarts (Browser-Extension) |
| Projektname | AUTODARTS ELITE |
| Version | 2.9.98 |
| Extension-Identity | `Tools for Autodarts` (`package.json` version 2.9.98; `wxt.config.ts` L52/L59) |
| Technik | TypeScript, Vue 3, WXT 0.20.20 |
| Human-Live-Referenz | **Firefox MV2** |
| Sekundäres Kompatibilitätsziel | **Chrome MV3** |

## 2. REPOSITORY / BRANCH / BASELINE

> **Aktualisierung 2026-10-03:** Der aktuelle Stand steht in Abschnitt 21
> (`main`, HEAD `1b65b55`). Abschnitt 20 (HEAD `7688352`, Alt-Hash) ist
> historisch. Die folgende Tabelle ist der historische
> Audit-Stand vom 2026-08-29 und bleibt als Nachweis erhalten.

| Feld | Wert (historisch, 2026-08-29) |
|---|---|
| Repository | `~/autodarts-tools-v3` |
| Branch | `consolidate/final-runtime-2.9.98` |
| Baseline / HEAD | `2422705b98b7712c5a28cd8df65a836bd587043f` (Phase-5B-Checkpoint) |
| Push-Status | NONE (kein Push ohne ausdrückliche Freigabe) |
| Audit-Worktree | nur Phase-5B-Component-Tests (uncommitted), kein Produktionscode geändert, Protected Core unverändert |

---

## 3. ARCHITEKTUR (verifiziert)

- **Entrypoints:** `match.content` (Lazy-Loading + `registerCleanup`-Pipeline mit `cleanupBarrier`), `lobby`/`lobbynew.content`, `boards.content`, `content`, `websocket-monitor.content`, `websocket-capture` (MAIN-World-Monkey-Patch), `controlcenter` (Vue-App), popup, background.
- **Match-Datenfluss:** Autodarts-WebSocket → `websocket-capture` (MAIN) → `processWebSocketMessage` (`utils/websocket-helpers.ts`) → Zwei-Achsen-Dedupe (`utils/event-dedupe.ts` `shouldProcessSnapshot`) → `local:game-data`.
- **Match-Ende:** CMR (`utils/canonical-match-result.ts`) als single-source-of-truth-Kandidat; 5 parallele End-Detektoren (CMR, `match-card.ts`, `ft-auto-result.ts`, `career-controller.ts`, `wled.ts`) als dokumentiertes Architekturmerkmal.
- **Control Center:** `composables/useControlCenterStatus.ts` (zentrale `myUserId`, Liveness-Windowing, disposed-guard), Views `CcDashboard`/`CcHistory`/`CcStats`/`CcTraining`, `utils/control-center-data-state.ts`, `utils/match-history-view.ts` (reine View-Model-Schicht, kein Storage-Zugriff).
- **Live-Board:** `CcLiveBoard.vue` (SVG, max. 3 Dart-Marker), `utils/dartboard-geometry.ts` (`resolveLiveDartPoint`: echte `coords` → deterministischer Segment-Fallback → kein Marker), eingebunden nur im Live-Throw-Zweig von `CcMatchHero.vue` (ein physischer Slot, nie im Checkout-Route-Zweig).
- **Geschützter Kern-Hinweis:** `utils/websocket-helpers.ts` enthält einen temporären `[AD-ELITE MATCH] TEMP-DIAG`-Console-Block (zum Audit L273–288; Stand 2026-10-02 `utils/websocket-helpers.ts` L266–288, loggt jeden Snapshot), bewusst für den Human-Test; vor Release Review/Entfernung (nur mit ausdrücklicher Freigabe, Protected Core).

---

## 4. PROTECTED CORE (vollständig)

Die folgenden Dateien dürfen **niemals ohne ausdrückliche Freigabe** geändert werden. Jede Änderungsabsicht ist **vor** der Umsetzung zu melden.

1. `utils/canonical-match-result.ts`
2. `utils/canonical-match-result-storage.ts`
3. `utils/event-dedupe.ts`
4. `utils/websocket-helpers.ts`
5. `components/Settings/PrecisionMap.vue`

Im Audit verifiziert: alle fünf unverändert; Tests für den Kern grün (CMR 32, Dedupe 26).

---

## 5. STATUS-ZUSAMMENFASSUNG

| Punkt | Wert |
|---|---|
| **P0 GAPS aktuell** | **NONE** |
| **Human Live Test bisher** | **NOT PERFORMED** |
| Friends Presence | **PAUSED** |
| CCPARTY N2 | **DEFERRED** |
| Push ohne ausdrückliche Freigabe | **verboten** (HISTORICAL, Stand 2026-10-02: kein Push erfolgt, 34 Commits voraus; überholt, siehe Abschnitt 21: gepusht, 0/0) |
| Gate (Stand 2026-10-02) | HISTORICAL_VERIFIED_NOT_RERUN_ON_1b65b55: 8/8 PASS unter Node v22.23.2 für `fa9b9f3` + `7688352` (Alt-Hashes, heute `a7ceb2e` + `12279ff`; Abschnitt 20, Mapping in Abschnitt 21) |

Es wurde kein echter Board-/Runtime-Test dokumentiert. Kein Punkt trägt den Status `LIVE VERIFIED`. „Automatische Tests PASS", „technisch ready", „PRE-LIVE READY" ist **kein** Human-Live-PASS.

---

## 6. IMPLEMENTIERTE FUNKTIONEN (Audit-Bestand, HEAD `2422705b`)

### 6.1 MATCH / SCORING

| Funktion | Status | Beleg |
|---|---|---|
| Canonical Match Result (Schema v1, Quality MINIMAL/PARTIAL/COMPLETE, Revision, Retention 200) | IMPLEMENTED + TESTED | `utils/canonical-match-result.ts` L170/210/265/344; 32 Tests |
| WebSocket-Verarbeitung (matches/lobbies/boards) | IMPLEMENTED + TESTED | `utils/websocket-helpers.ts` L221/233/292; 26 Tests |
| Event-Dedupe (Zwei-Achsen, fail-open) | IMPLEMENTED + TESTED | `utils/event-dedupe.ts` L97; 26 Tests |
| Schnelle Wurffolge (FIFO-Queue, maxQueueSize 5) | IMPLEMENTED + TESTED | `utils/game-data-debounce-queue.ts`; 4 Tests |
| Bust-Erkennung | IMPLEMENTED + TESTED | `checkout-path.ts` L76, `ai-commentator.ts` L467; 18 Tests |
| Checkout-Route inkl. Bogey-Warning | IMPLEMENTED + TESTED | `utils/checkout-path.ts`; 18 Tests |
| Bull-off beide Reihenfolgen / Game-On (ohne Spieler-Index-Gate) | IMPLEMENTED + TESTED | `ai-commentator.ts` L416–425; Lifecycle-Contract + Identity-Test |
| Spielerwechsel-Anzeige | IMPLEMENTED + TESTED | `CcMatchHero.component.test.ts` (Player-Switch) |
| Single/Double/Triple/Bull-Konsum | IMPLEMENTED | `checkout-path.ts` L81, `enhanced-scoring-display.ts` |

### 6.2 CONTROL CENTER

| Funktion | Status | Beleg |
|---|---|---|
| Dashboard (CcDashboard/CcDashboardSummary/CcQuickStats) | IMPLEMENTED + TESTED | Component-Tests (5) + `cc-dashboard-watcher-leak-fix.test.ts` |
| Match Hero + Live-Board (Single-Slot-Invariante) | IMPLEMENTED + TESTED | `CcMatchHero.vue` L156/193; Component-Test |
| Live Board SVG, max. 3 Marker | IMPLEMENTED + TESTED | `CcLiveBoard.vue` L168–172; 7 Tests |
| Koordinaten / Segment-Fallback | IMPLEMENTED + TESTED | `utils/dartboard-geometry.ts` L224/254; 402-Zeilen-Test |
| Restscore / Spieleranzeige | IMPLEMENTED + TESTED | `CcMatchHero`; Component-Test |
| System Status Footer | IMPLEMENTED + TESTED | `CcSystemStatusFooter.vue`; 5 Tests |
| Performance Strip | IMPLEMENTED + TESTED | `CcPerformanceStrip.vue`; 5 Tests |
| History inkl. Expansion | IMPLEMENTED + TESTED | `CcHistory.vue` L163/473; `cc-history-expand` (3, Phase 5B) |
| Stats-Ansicht | **PARTIAL** (nur 5 SAFE-Metriken) | `views/CcStats.vue`; `statistics.test.ts` |
| Training-Ansicht | IMPLEMENTED | `views/CcTraining.vue` |
| State-Composable (myUserId, Liveness, Dispose) | IMPLEMENTED + TESTED | `useControlCenterStatus.ts` L142/192/365/390; Liveness-Tests (4) |
| Mobile Bottom Navigation | IMPLEMENTED + TESTED | `CcSidebar.vue` L45/56; 5+ Lifecycle-Contracts |
| Responsive Mobile/Desktop/TV (360px–TV) | IMPLEMENTED + TESTED (statisch) | `style.css` @media 480–1800px; DOM-vermessene Viewports |
| Dialoge (useAppConfirmDialog) | IMPLEMENTED | `composables/useAppConfirmDialog.ts`; kein `useConfirmDialog` mehr |

### 6.3 CALLER / AUDIO

| Funktion | Status | Beleg |
|---|---|---|
| Caller FIFO-Queue | IMPLEMENTED + TESTED | `caller.ts` L23; Lifecycle-Contract |
| Caller Blob-Cleanup (60s-Intervall) | IMPLEMENTED + TESTED | `caller.ts` L48/83–84/1351; Lifecycle-Contract |
| Caller Audio-Unlock / audioPool | IMPLEMENTED | `caller.ts` L20/250/304 |
| Mute nativer Autodarts-Caller | IMPLEMENTED | `caller.ts` L188–237, `mute-native-caller.ts` |
| Caller-Ansagen (180/Checkout/Bust/Winner/Cricket) | IMPLEMENTED | `caller.ts` L620–738 |
| SoundFX FIFO-Queue | IMPLEMENTED + TESTED | `sound-fx.ts` L26; Lifecycle-Contract |
| SoundFX Blob-Cleanup / onRemove | IMPLEMENTED + TESTED | `sound-fx.ts` L55/169/187–193; Lifecycle-Contract |
| SoundFX Dual-Channel (Triple+Nummer) | IMPLEMENTED | `sound-fx.ts` L1481/927 |
| AI-Commentator Game-On | IMPLEMENTED + TESTED | `ai-commentator.ts` L417–425; Contract + Identity-Test |
| AI-Commentator 180/Checkout/Bust/Matchshot/Leg | IMPLEMENTED | `ai-commentator.ts` L451–475/370–396 |
| AI-Commentator Cooldown/Dedup (3s / eventKey 5s) | IMPLEMENTED | `ai-commentator.ts` L305/588–630 |
| Duo-Commentator / TTS-Provider | IMPLEMENTED | `utils/duo-commentator.ts`, `utils/tts-provider.ts` |
| Walk-On | IMPLEMENTED + TESTED | `walk-on.ts`; Lifecycle-Contract |

### 6.4 WLED

| Funktion | Status | Beleg |
|---|---|---|
| FIFO-Queue (200ms, keine verlorenen Trigger) | IMPLEMENTED + TESTED | `wled.ts` L20/22; 4 Tests |
| Trigger-Mapping (Bull-off/Lobby/Game-Events) | IMPLEMENTED | `wled.ts` L216/273/132–159 |
| Doppeltrigger-Vermeidung | IMPLEMENTED | FIFO + `onlyOnce` |
| Lifecycle/Cleanup (AbortController/Timer/idle) | IMPLEMENTED + TESTED | `wled.ts` L26–34/170/194/200; Lifecycle-Contract |
| Geräte-Kommunikation (LAN-HTTP, kein Auth) | IMPLEMENTED | `utils/wled.ts` L3/364–447 |

### 6.5 TRAINING

| Funktion | Status | Beleg |
|---|---|---|
| Legacy-Migration (idempotent, `mergeTrainingHistories`) | IMPLEMENTED + TESTED | `training-mode.ts` L36, `training-history.ts` L32; 8 Tests |
| saveToHistory | IMPLEMENTED | `training-mode.ts` L416 |
| maybeAwardMedal / Medal-Progress | IMPLEMENTED + TESTED | `training-mode.ts` L469, `training-medals.ts` L60/70; 24 Tests |
| Identity-Gates (`resolveMyPlayerIndex`) | IMPLEMENTED + TESTED | `training-mode.ts` L106; 3 Tests |
| Aktive Exercise-Gates + Cleanup | IMPLEMENTED | `training-mode.ts` L56/58/67; Lifecycle-Contract |
| Bestwerte / Performance | IMPLEMENTED + TESTED | `utils/training-performance.ts`; 20 Tests |
| Notifications, kein `alert()` | IMPLEMENTED + TESTED | `TrainingExercises.vue` L169–195 (AppNotification/useNotification) |
| Training-UI (CC + Settings) | IMPLEMENTED | `CcTraining.vue`, `CcExerciseCard.vue`, `CcHomeTraining.vue`, `TrainingExercises.vue`, `Training.vue` |

### 6.6 MATCH HISTORY / SHARING

| Funktion | Status | Beleg |
|---|---|---|
| Match History (CMR-basiert) | IMPLEMENTED + TESTED | `CcHistory.vue`, `utils/match-history-view.ts`; 22+ Tests |
| Career Match | IMPLEMENTED | `career-controller.ts` L49/88; verdrahtet `match.content/index.ts` L431 |
| Share Card (wasFinished-Fix) | IMPLEMENTED + TESTED | `share-card.ts` L14/41, `utils/match-finish.ts`; 6 Tests |
| Liga Share Code Auto-Submit (Dedup) | IMPLEMENTED + TESTED | `utils/liga-api.ts` L394/417/420/458; 5 Tests |

### 6.7 CORRECTION / INPUT

| Funktion | Status | Beleg |
|---|---|---|
| Quick Correction (Klick) | IMPLEMENTED + TESTED | `QuickCorrection.vue` L444; Lifecycle (source-pattern) |
| Numpad-Shortcuts `/ * -` (Throw 1/2/3) | IMPLEMENTED + TESTED | `QuickCorrection.vue` L261; Lifecycle-Contract (kein anonymer Leak) |
| Numpad-Grid-Eingabe | IMPLEMENTED | `QuickCorrection.vue` L283 |
| Genau einmal pro Tastendruck | IMPLEMENTED (Code) | Listener in `onUnmounted` entfernt L246–249; „2–3 Matches"-Verhalten = Live-only |
| Listener-Cleanup | IMPLEMENTED + TESTED | L238–249; Lifecycle-Contract |

### 6.8 LIFECYCLE / STABILITÄT

| Funktion | Status | Beleg |
|---|---|---|
| registerCleanup-Pipeline (`cleanupBarrier`) | IMPLEMENTED + TESTED | `match.content/index.ts` L57/204/478; Lifecycle-Contract |
| MutationObserver-Disconnect | IMPLEMENTED + TESTED | `career-match.ts`; Contract |
| Interval/Timeout-Cleanup (color-change, clutch-moments, automatic-next-leg) | IMPLEMENTED + TESTED | 3 Module; Contracts |
| OnRemove / OnInvalidated / Monkey-Patch | IMPLEMENTED + TESTED | `websocket-capture.ts` (MAIN-World); Module-Teardowns |
| disposed-guard (stateful CC-Komponenten) | IMPLEMENTED + TESTED | Component-Tests + Phase 5B |
| Console-Spam entfernt (Enhanced Scoring) | IMPLEMENTED + TESTED | `enhanced-scoring-display.ts` L11/32/92; Contract |
| Lifecycle-Contract-Suite | IMPLEMENTED + TESTED | `tests/lifecycle-contracts.test.mjs`: 49 `test()`-Blöcke (Audit-Stand; Stand 2026-10-02: 54) |
| Next-Player-on-Take-Out-Stuck: Timer-/Race-Teardown | IMPLEMENTED + TESTED (Commit `7688352`) | Contract + Vitest-Verhaltenstest `next-player-lifecycle.component.test.ts` |
| Discord-Webhooks/-Stream: Listener-Teardown, Stale-Async-Guards, `turns`-Guard | IMPLEMENTED + CONTRACT-TESTED (Commit `7688352`) | nur Quelltext-Contract-Tests, kein Verhaltenstest; HTTP-Abbruch DEFERRED |

### 6.9 BROWSER / BUILD

| Funktion | Status | Beleg |
|---|---|---|
| Firefox MV2 | IMPLEMENTED (Build) | `.output/firefox-mv2/manifest.json` (v2, 2.9.98) |
| Chrome MV3 | IMPLEMENTED (Build) | `.output/chrome-mv3/manifest.json` (v3, 2.9.98) |
| TypeScript / WXT | IMPLEMENTED + TESTED | `vue-tsc --noEmit` 0 Fehler; Scripts `test`/`test:lifecycle`/`test:components`/`preflight`/`compile`/`build`/`build:firefox` |
| Version 2.9.98 / Extension-Identity | IMPLEMENTED | `package.json`, `wxt.config.ts` |

### 6.10 UX / SETTINGS / WEITERE

| Funktion | Status | Beleg |
|---|---|---|
| Settings-Surface (48 Komponenten) | IMPLEMENTED | `components/Settings/` (Caller, SoundFx, Wled, Liga, Career, QuickCorrection, PrecisionMap, TrainingExercises, …) |
| CC-Navigation / Sections | IMPLEMENTED + TESTED | `components/ControlCenter/sections.ts`; Lifecycle-Contracts |
| PrecisionMap (geschützt) | IMPLEMENTED (zuletzt geändert in `79a5034` (Alt-Hash `3a8979c`), P40 ELO-Consent-UI; der Commit trägt jetzt den Trailer `Protected-Core-Approved`, siehe Abschnitt 21) | Persistenz via canonical contract (`8e2f2e3`) |
| Shuffle-Players-Hang-Fix | IMPLEMENTED + TESTED | `lobby.content/index.ts` L18/75–77; `shuffle-players.test.ts` |
| Automatic Fullscreen + Fullscreenchange-Cleanup | IMPLEMENTED + TESTED | `automatic-fullscreen.ts` L114/123–125; Contract |
| TtsProvider Security-Tabelle (tbody) | IMPLEMENTED | `TtsProvider.vue` L306/323 |
| Human-Test-Panel (opt-in) | IMPLEMENTED | `CcMatchHumanTestPanel.vue` (Commit `4c6fc1d`) |

---

## 7. PARTIAL / MISSING / REGRESSION / UNKNOWN

### PARTIAL
- **Stats-Ansicht** (B9): nur 5 SAFE-Metriken; CMR V2-Felder fehlen.
- **Screenshot-Config-Section** (K5): Storage vorbereitet, kein Consumer.

### MISSING (echte Implementierungslücken / Roadmap)
- **Reconnect Auto-Resync** (A4): kein Auto-Resubscribe/Resync, nur Disconnect-Erkennung + Toast + manueller Reload (`websocket-monitor.content.ts` L100–125). Dokumentiert (RUNTIME_TEST_PLAN Test P).
- **Multi-Tab-Schutz** (M8): globale Storage-Keys, last-write-wins, kein BroadcastChannel/Leader-Election. Dokumentiert.
- **Vollständige Statistics** (CMR V2-Metriken: `checkoutPercent`, `plus100/140/170`, `checkouts`, Match-Dauer) — Roadmap BLOCKED.
- **Charts** (M2) — Roadmap BLOCKED.
- **Achievements** (M3) — Roadmap BLOCKED.
- **Solo Challenges Ausbau** (M4) — Roadmap PARTIAL.
- **Rating** (M5) — Roadmap BLOCKED.
- **Tournaments Ausbau** (M6) — kein Domänenmodell.
- **H2H** (M7) — Roadmap BLOCKED.

### REGRESSION
- **NONE** — im Audit keine Regression gefunden.

### UNKNOWN
- **Late/Out-of-Order-Events** (A14): geschützter Kern, self-heal aber sichtbar; kein dedizierter Test; Verhalten am echten Board nicht belegt → `UNKNOWN`.

---

## 8. RUNTIME REQUIRED / FEHLENDE RUNTIME-VERIFIKATION

Diese Punkte sind implementiert, aber **nur durch einen echten Human-Live-Test** abschließend verifizierbar (kein automatischer Test deckt sie ab):

- Reconnect-Verhalten real (Toast, manueller Reload, voller Stand nach Reload).
- Checkout-Misses-Approximation (`checkouts - checkoutsHit`) gegen echtes Match.
- Bull-off beide Reihenfolgen real; Game-On in beiden Fällen.
- Schnelle Wurffolgen real (<200ms) — keine verlorenen Ansagen/Effekte.
- Caller/SoundFX/AI-Commentator-Ansagen real (180/Checkout/Bust/Matchshot/Triple), keine Überlappungen.
- WLED-LAN-Gerät real (Trigger, keine verlorenen/doppelten Effekte).
- Echtes Audio (Audio-Unlock, Mute nativer Caller, TTS, Walk-On).
- Quick Correction real über 2–3 Matches (Numpad-Shortcuts genau einmal).
- Share Card / Liga Share Code nach Matchende real.
- Enhanced Scoring Display: kein Log-Spam bei echtem Match.
- Mobile Bottom Navigation auf echtem Gerät/Viewport.
- Live-Board/Dartmarker mit echten `coords`-Daten vom Board.
- Control Center: Dashboard/History/Stats mit realen CMR-Daten.

---

## 9. TESTABDECKUNG (verifizierter Bestand)

| Suite | Ergebnis |
|---|---|
| Unit/Targeted (`yarn test`, node:test) | 446/446 PASS (67 Suiten, Stand Phase-3.5-Freeze; danach nur Component-Tests ergänzt) |
| Lifecycle-Contracts (`yarn test:lifecycle`) | 49 `test()`-Blöcke PASS (HEAD `2422705b`, historisch); Stand 2026-10-02: 54 PASS |
| Stand 2026-10-02 (HEAD `7688352`, Alt-Hash; HISTORICAL_VERIFIED_NOT_RERUN_ON_1b65b55) | Component-Tests 90/90 PASS (12 Dateien); `vue-tsc --noEmit` ohne Fehler; Gate 8/8 PASS unter Node v22.23.2. Die Zeilen darüber sind der historische Audit-Stand. |
| Component-Tests (`tests/components/`, Vitest) | Phase 5A (50) + Phase 5B (cc-history-expand 3, control-center-liveness 4) + CcLiveBoard (7) + CcMatchHero (6) |
| TypeScript (`vue-tsc --noEmit`) | 0 Fehler |
| Firefox MV2 Build | PASS (~4,29 MB) |
| Chrome MV3 Build | PASS (~4,29 MB) |

**Bekannte Test-Lücken (fehlende Tests, keine Implementierungslücke):**
- Caller/SoundFX/AI-Commentator-Ansagen: keine funktionalen Unit-Tests (nur Queue/Lifecycle).
- QuickCorrection funktionaler Ablauf: kein Unit-Test (nur Lifecycle source-pattern).
- WLED-Geräte-Anbindung: kein Integrationstest.
- Mute-native-caller, TTS/duo, Audio-Unlock: keine funktionalen Tests.
- useAppConfirmDialog, TtsProvider-tbody, PrecisionMap-Persistenz: keine dedizierten Tests.

---

## 10. HUMAN-LIVE-VERFAHREN (Minimum-Live-Gate)

**Streng sequenziell pro Testpunkt:**
1. **T01** → reale Benutzeraktion am echten Board / an der echten Autodarts-Runtime durchführen.
2. Screenshot/Ergebnis dokumentieren (Vorlage: `HUMAN_LIVE_TEST_CHECKLIST.md`, `LIVE_TEST_RESULT_TEMPLATE.md`; Triage: `POST_LIVE_DIAGNOSTIC_MATRIX.md`; Ablauf: `RUNTIME_TEST_PLAN.md` Sessions 1–4).
3. Ergebnis als PASS/FAIL festhalten.
4. **Erst nach PASS** → nächster Test (T02, …).

**Verboten:** Einen Human-Test simulieren, mit Mock-Daten ersetzen oder als PASS annehmen. Ein PASS erfordert einen dokumentierten Test an der realen Runtime bzw. am echten Board.

**Minimum-Live-Gate (20 Punkte):** Firefox-Erweiterung real geladen · Autodarts real geöffnet/eingeloggt · Extension↔Autodarts reale Verbindung · reales Board + 3 Kameras · echtes Match gestartet · reale Würfe erkannt · korrektes Scoring · Spielerwechsel · Single/Double/Triple · Bust · Checkout · Leg-Ende · Caller · SoundFX · WLED · Control Center · Live Board/Dartdarstellung · Restscore/Matchzustand · keine Doppeltrigger/Listener-Probleme · keine relevanten neuen Runtime-/Browser-Errors.

**Zusätzlich gezielt prüfen:** Bull-off beide Reihenfolgen/Game-On · schnelle Wurffolge · Quick Correction/Numpad (2–3 Matches) · Share Card/Liga Share Code nach Matchende · Enhanced Scoring Display (kein Log-Spam) · Mobile Bottom Navigation.

**Bei Befund:** nicht selbst beheben während des Live-Tests; sammeln, danach gemeinsam auswerten.

---

## 11. FEHLERWORKFLOW (bei FAIL)

```
REPRODUCE
→ ROOT CAUSE
→ MINIMAL FIX
→ TARGETED RETEST
→ RELEVANT REGRESSION
→ denselben Human-Test erneut durchführen
→ erst nach PASS weiter
```

Bei P0: STOP und exakt berichten, nicht beheben. Protected Core: vor jeder Änderung Meldung + ausdrückliche Freigabe.

---

## 12. ENTWICKLUNGSREGELN

- Vor jeder neuen Implementierung prüfen, ob die Funktion bereits vorhanden ist oder durch bestehende Architektur abgedeckt wird (Code, CHANGELOG, CONSOLIDATION_MATRIX, ROADMAP_DEPENDENCIES, Settings-Liste, Git-Historie).
- **Keine Feature-Duplikate:** keine zweite Board-Engine; CMR `local:canonical-match-results-v1` ist die einzige autorisierte historische Quelle; keine Statistik-Berechnung in Vue-Komponenten; kein setValue auf game-data/board-data/lobby-data im Control Center.
- **Kein unnötiges Refactoring** ohne konkreten Auftrag.
- Bestehende Änderungen **niemals ungefragt verwerfen**.
- Tatsächliche Tests ausführen; Ergebnisse **niemals annehmen** ohne eigenen Lauf.
- Neue Logik → passende Unit-Tests (node:test).
- UI → Component-Tests (Vitest, `tests/components/`).
- Listener/Timer/Observer → Lifecycle-Contracts.
- Typecheck (`vue-tsc --noEmit`) und relevante Builds (firefox + chrome) vor Commit.
- **Cleanup/Dispose/OnRemove zwingend:** Listener, MutationObserver, Intervalle, Timer und Monkey-Patches sauber entfernen/disposen.
- **Keine Listener-Leaks** über Matches hinweg (genau einmal pro Tastendruck).
- **Kein Console-Spam auf Hot Paths** (nur Log bei tatsächlicher Wurf-/Spielerwechsel-Änderung).
- Schnelle Wurffolgen dürfen keine Events/Ansagen verlieren (FIFO-Queue, maxQueueSize 5, 200ms).
- Responsive von 360px bis TV ohne Überlappungen/Overflow.

---

## 13. PERFORMANCE- UND STABILITÄTSANFORDERUNGEN

- Kein Console-Spam auf Hot Paths; Init-Log ok.
- Keine Listener-Leaks über Matches hinweg; alle Handler mit stable Reference und Removal.
- Schnelle Wurffolgen (<200ms) verlieren keine Effekte/Ansagen.
- Responsive 360px–TV ohne Überlappungen.

---

## 14. STOP-GATES

- **P0 gefunden** → STOP, exakt berichten, nicht beheben.
- **Protected Core müsste geändert werden** → STOP, ausdrückliche Freigabe verlangen.
- **Unerwartete Regression** → STOP, Zustand sichern, berichten.
- **Produktionsänderung außerhalb des Auftrags erforderlich** → STOP.
- **Push erforderlich** → STOP und ausdrückliche Freigabe verlangen.

---

## 15. POST-LIVE BACKLOG (erst nach bestandenem Minimum-Live-Gate priorisieren; vollständiger Human-Live-Test bleibt Release-Gate)

### WLED
- Event Priority Engine
- Camera-Safe WLED Mode
- Player Colors
- Double/Triple/Bull/180/Bust/Game/Match-Won Mapping
- optional Multi-WLED Endpoints

### Caller
- Real-Life Caller
- Require/Checkout-Ansagen härten
- Audio Priority
- Random Caller pro Match/Leg
- Blind-Support

### Architektur
- zentrale normalisierte Event Engine
- Diagnose-Export ohne Secrets

---

## 16. VORERST NICHT ÜBERNEHMEN

- separate WLED-Hub-Weboberfläche
- separate Caller-Weboberfläche
- unnötige zweite Serverarchitektur
- riesige Effektbibliothek nur wegen der Anzahl
- LED-Matrix/AWTRIX
- Funktionen, die das Control Center lediglich duplizieren

---

## 17. TOOLING

- **Claude-Mem** gezielt für vorhandenes Projektwissen verwenden (frühere Anforderungen, Entscheidungen, Belege); nicht für redundante Bestandsaufnahme.
- **Headroom** nur einsetzen, wenn es Kontext/Tokens tatsächlich sinnvoll reduziert.
- **Keine unnötigen Repository-Komplettscans**; gezielte graphify-Queries/Dateisuche statt Voll-Durchsuchen.

---

## 18. GIT-REGELN

- Vor jedem Commit: **Git-Status und Diff prüfen**; nichts Verdächtiges/Secret-artiges mitcommitten.
- **Kein Fetch/Pull während kontrollierter Gates.**
- **Kein Push ohne ausdrückliche Benutzerfreigabe.**
- Keine destruktiven Git-Operationen ohne Freigabe; vor `reset`/`checkout --`/`clean` uncommittete Arbeit stashen/committen.

---

## 19. PRIORITÄT

- **Human Live Test hat jetzt Priorität vor neuen Features.** Kein neues Feature vor dem Minimum-Live-Gate ohne ausdrückliche Freigabe.
- Nach bestandenem Minimum-Live-Gate: Post-Live-Backlog (Abschnitt 15) priorisieren.
- **Vollständiger Human-Live-Test bleibt Release-Gate** (vor Release/Tagging komplett dokumentiert).

## 20. SETUP 2.0 / GATEKEEPER / LIFECYCLE – VERIFIZIERTER STAND (2026-10-02, HEAD `7688352`)

Historische Angaben weiter oben (Branch `consolidate/final-runtime-2.9.98`,
HEAD `2422705b`, 446 Tests, Phase-5B-Stand) bleiben als Audit-Nachweis
erhalten und sind **nicht** der aktuelle Stand.

| Feld | Wert (verifiziert) |
|---|---|
| Branch / HEAD | `main` / `7688352` |
| Commit A | `fa9b9f3` `chore(gate): add validation gate and align CI workflows` |
| Commit B | `7688352` `fix(lifecycle): harden teardown and async cleanup` |
| Gate | vorhanden (`scripts/gate.mjs`, `scripts/gate.config.json`, `yarn gate`); Node-22-Pflicht aus `.nvmrc` (v22.23.2) |
| Gate-Ergebnis | 8/8 PASS unter Node v22.23.2 für den Inhalt von `fa9b9f3` + `7688352` (Paket `lifecycle-fixes-20261002b`, Baseline `ea35d57`, erneut mit `--force` ausgeführt) |
| Push | **nicht erfolgt**; `origin/main` (lokal gespeicherte Referenz, ohne Fetch) ist 34 Commits zurück |
| Human Live QA | **DEFERRED**; kein Release-Gate dadurch bestanden |

**Lifecycle-Fixes (Commit B):**
- Next-Player-on-Take-Out-Stuck: Countdown-Timer auf Modul-Scope, `OnRemove`
  stoppt Timer und entfernt das Countdown-Span, Generations-Token wird vor dem
  ersten `await` des Setups gezogen und nach den Awaits geprüft (Race-Fix).
- Discord (`discord-webhooks.ts`, `discord-stream.ts`): Start-Game-Listener
  werden getrackt und bei `OnRemove` samt Marker-Attribut entfernt;
  Generations-Guards verhindern, dass späte async Rückläufer nach dem Teardown
  Zustand oder Config ändern; `turns[0]` in `discord-stream.ts` ist abgesichert.
  Ein bereits abgeschickter HTTP-Request wird weiterhin **nicht** abgebrochen
  (DEFERRED).
- Tests: `tests/lifecycle-contracts.test.mjs` (54 Tests, Quelltext-Contract)
  und neu `tests/components/next-player-lifecycle.component.test.ts`
  (Vitest, Fake-Timer, gemockte Storage-Module; 8 Verhaltenstests zu Timer,
  `OnRemove`, spätem Setup-/Watcher-Rückläufer und wiederholtem Setup).
  Component-Tests insgesamt zuletzt 90/90 PASS, `vue-tsc --noEmit` ohne Fehler.
  Für Discord gibt es weiterhin nur Quelltext-Contract-Tests, keinen Verhaltenstest.

**Gatekeeper (Commit A):** `gate run <paket-id>` klassifiziert den Changeset
gegen die Baseline des Pakets und führt die verlangten Stufen aus (`diffcheck`,
`syntax`, `workflow-consistency`, `compile`, `test`, `components`,
`build-firefox`, `build-chrome`). Gate-Zustand und Audit liegen unter
`.git/autodarts-gate/` (nicht versioniert). Ohne Changeset gegenüber der
Baseline führt `run` keine Stufe aus (`CLASS: NONE`); der erste Lauf gegen den
committeten Stand lieferte deshalb keinen Beleg, gültig ist der Lauf mit
`--force` gegen die Paket-Baseline `ea35d57`. Das Gate meldet für Lifecycle-Dateien
`human review required`. Nach menschlichem Review der Lifecycle-Dateien wurde das Paket
`lifecycle-fixes-20261002b` am 2026-10-02 per `gate close` geschlossen (CLOSED bei
HEAD `e618c34`); dafür waren Node 22 und ein erneuter `gate run` nötig, weil sich der
Fingerprint der leichten Stufen durch den Docs-Commit geändert hatte.
Die CI-Workflows (`build-firefox.yml`, `pr-control-center.yml`) führen
`yarn test` nur noch einmal aus und bauen über `wxt` direkt; ein CI-Lauf auf
GitHub ist mangels Push **nicht** erfolgt.

**Protected-Core-Erzwingung (offen, nicht final entschieden):** Das Gate
meldet bei Änderung der fünf Core-Dateien `PROTECTED_CORE_CHANGED` bzw. bei
direkten Nutzern `APPROVAL_REQUIRED` (Exit 3) – aber nur, wenn `gate run`
ausgeführt wird. Es existieren kein Git-Hook, keine CI-Prüfung mit dem Gate,
kein CODEOWNERS und keine `permissions.deny`-Regel auf die Core-Pfade; der
Schutz in `AGENTS.md`/`CLAUDE.md` ist Dokumentation. Review ist gemeldet,
nicht technisch erzwungen. Die Core-Dateien sind durch die Commits A und B
nicht verändert.
*Nachtrag (Bauphase 2.0, PKG-7 und Core-5-Wiederherstellung):* Der Absatz beschreibt den Stand vor PKG-7. Seitdem gibt es
`permissions.ask` und einen Git-Trailer-Guard, und die Core-Liste umfasst wieder 5 Dateien (inkl. `components/Settings/PrecisionMap.vue`);
siehe `docs/PROTECTED_CORE_ENFORCEMENT.md`.

**p345.sh / Identitäts-Rewrite (D11):** `~/AUTODARTS_D11_EXEC/p345.sh` (SHA256
`85b4414475bff8d9bdba77e21f08a7734fe950321689359262c632235dcb9b67`, Pre-Patch-Stand) ist
ein geplanter lokaler Identitäts-Rewrite von `origin/main..HEAD`
(zum Planungszeitpunkt 32 Commits) und hat **nichts** mit dem Protected
Scoring Core zu tun. Eine Ausführung ist **nicht belegt** (Bash-History enthält
einen Aufruf, ohne Zeitstempel/Ergebnis); es gibt keinen `run-*`-Ausgabeordner,
alle 34 lokalen Commits tragen unverändert den Platzhalter-Autor, die stichprobenartig geprüften Tags zeigen
auf die Originalcommits. Das Script darf nicht ausgeführt werden. Vor einem Push
ist die Autor-Identität aller dann voraus liegenden Commits (inzwischen 34,
nicht 32) neu zu entscheiden.

**Weiterhin offen (Stand 2026-10-02):**
- TEMP-DIAG-Bereinigung: 5 Non-Core-Stellen (`utils/friends-api.ts` ×2,
  `entrypoints/auth-cookie.ts`, `entrypoints/content/index.ts`,
  `composables/useControlCenterFriends.ts`) und ein Core-Block in
  `utils/websocket-helpers.ts` (L266–288, nur mit ausdrücklicher Freigabe).
- MCP-Konsolidierung (Inventar liegt vor, Zielstack nicht festgelegt).
- (Erledigt, hier nur zur Nachvollziehbarkeit) claude-mem-Setup-Blocker: **CLOSED** (2026-10-02). Projekt-lokal `false`. Beleg: Die
  Projekt-Session (cwd `~/autodarts-tools-v3`, Start 01:33) hat 0 claude-mem-Prozesse im
  Prozessbaum (nur `headroom` und `chrome-devtools`); im claude-mem-Log gibt es von
  Worker-Shutdown 01:32:46 bis 04:51 keine Aktivität. Die laufenden claude-mem-Prozesse
  (Worker-Daemon, Chroma, Observer) gehören zu einem globalen Daemon, der um 04:51:49 von
  einem MCP-Client gestartet wurde, und zur MCP-Instanz einer außerhalb des Projekts
  gestarteten Session; seit 04:51 registrierte sich nur diese Session bei claude-mem.
  Hinweis: Eine außerhalb des Projekts gestartete Session lädt das global aktivierte
  Plugin weiterhin; die projekt-lokale Deaktivierung gilt für im Projekt gestartete Sessions.
  Die frühere RSS-Angabe (ca. 653 MB → 0 MB) ist nur durch frühere Session-Transcripts
  belegt, nicht durch Repo-Dokumente oder claude-mem-Logs.
- `.claude/settings.local.json.bak-20260930T234259` untracked im Arbeitsbaum
  (Empfehlung: aus dem Arbeitsbaum in die externen Backups verschieben).
- Push-Freigabe und Identitäts-Entscheidung (siehe oben).
- Human-Live-QA und alle dort aufgeführten Hardware-Punkte (Release-Gate).

## 21. POST-P40 STATUS-RECONCILIATION (2026-10-03, HEAD `1b65b55`)

Dokumentarischer Nachtrag. Die Abschnitte 1–20 bleiben als historischer Nachweis erhalten; wo sie
„kein Push", „34 Commits voraus", „CI nicht geprüft" oder Alt-Hashes nennen, gilt dieser Abschnitt.
Es wurde kein Code und keine Konfiguration geändert.

### 21.1 CURRENT_VERIFIED (HEAD `1b65b55`, 2026-10-03)

| Fakt | Wert | Evidenz |
|---|---|---|
| HEAD | `1b65b554717361e8c7901bf11cbcf89e24a8a5a7` (`fix(elo): bind consent to backend host`) | `git rev-parse HEAD` |
| `origin/main` | identisch (0/0, gepusht) | `git rev-parse origin/main`; `git ls-remote origin refs/heads/main` |
| P40 | IMPLEMENTED · PUSHED · POST_PUSH_VERIFIED · ORIGIN_MAIN_SYNCHRONIZED | P40 = `79a5034`, P41-Doku = `8d79d04`, Consent-Host-Bindung = HEAD `1b65b55`; Sync und CI siehe unten. Die Post-Push-Verifikation selbst ist eine Operator-Angabe. |
| GitHub-CI | `pr-control-center` (push, `main`) Run 37133647668 = `success`, `headSha` = `1b65b55` | `gh run view 37133647668` |
| Protected-Core-Audit | `node scripts/core-guard.mjs range origin/main..HEAD` = Exit 0 (leerer Bereich) | direkt ausgeführt |
| P40-Commit | `79a5034` trägt `Protected-Core-Approved: …` | `git log -1 79a5034` |
| Git-Hooks | `core.hooksPath = scripts/githooks` (`commit-msg`, `pre-push`) | `git config` |
| Remote-Tags | 0 (die 42 Recovery-Tags existieren nur lokal) | `git ls-remote --tags origin` |
| Branch-Protection `main` | keine (HTTP 404) | `gh api …/branches/main/protection` |

### 21.2 HISTORICAL_VERIFIED_NOT_RERUN_ON_1b65b55

Diese Ergebnisse wurden auf früheren Ständen verifiziert und auf HEAD `1b65b55` **nicht** neu ausgeführt.
Sie sind keine aktuellen Ergebnisse (Re-Verifikation: eigener CURRENT-HEAD RE-VERIFICATION GATE, offen):

- `yarn test` 531/531, `yarn test:components` 90/90 (Stand `9158b35`, heute `9826231`)
- Firefox-Build PASS, Chrome-Build PASS, `vue-tsc --noEmit` ohne Fehler
- Gate 8/8 PASS unter Node v22.23.2 (Alt-Stand `fa9b9f3` + `7688352`, Paket `lifecycle-fixes-20261002b`)
- Package-C-Teststände (501/501, Lifecycle 50/50, Components 82/82)
- Die CI auf GitHub führte für `1b65b55` `yarn test`, `yarn test:components`, `yarn compile` und beide Builds aus (Workflow-Definition in `.github/workflows/pr-control-center.yml`) und war erfolgreich. Das ist CI-Evidenz, kein lokaler Lauf.

### 21.3 Hash-Mapping (History-Rewrite)

Die Historie wurde umgeschrieben (u. a. Trailer an P40, Backup-Branch `backup/pre-p40-trailer-rewrite-20261003`).
Die in älteren Abschnitten genannten Hashes sind **keine Vorfahren** von `1b65b55` (die Objekte existieren noch lokal).
Zuordnung über den Commit-Betreff (INFERRED, kein Rewrite-Protokoll im Repo):

| Alt (in älteren Abschnitten) | Neu (in HEAD-Historie) | Betreff |
|---|---|---|
| `fa9b9f3` | `a7ceb2e` | chore(gate): add validation gate and align CI workflows |
| `7688352` | `12279ff` | fix(lifecycle): harden teardown and async cleanup |
| `e618c34` | `1090aba` | docs(setup): sync Setup 2.0 verified state |
| `9158b35` | `9826231` | docs(setup): close out Setup 2.0 gate package and claude-mem verification |
| `3a8979c` | `79a5034` | Setup 2.0 P40: require explicit consent before ELO network traffic |
| `c34ffbe` | `9979bda` | Setup 2.0 Package C: remove inactive Ruflo residue |
| `5fafa23` | `fb835fa` | Setup 2.0 D1: archive stale Codex Ruflo skills |
| `70fd00e` | `638f3a5` | Setup 2.0 D2: archive final stale Codex skills |
| `eb761cb` | `018c216` | Setup 2.0 D5: remove stale Codex environment flags |
| `e4c17ad` | `ca5f597` | Setup 2.0 D7: protect scoring core for Codex |
| `ea35d57` | `4fca81a` | Setup 2.0 D8: document D4-D7 verified state |

Recovery-Tags tragen weiterhin den Alt-Hash im Namen, zeigen aber auf Commits der neuen Historie
(Beispiele: `setup-2.0-frozen-20261002` → `9826231`, `setup-2.0-pD8-pre-docs-e4c17ad` → `5df6b0e`).
Die Tag-Namen sind daher keine Hash-Belege.

### 21.4 Status-Klassen

- **IMPLEMENTED_NOT_VERIFIED:** Codex-Hook-Ausführung, Trust-Status und Laden von `AGENTS.md`; Vite-MCP-Erreichbarkeit; Verhaltenstests für Discord (nur Contract-Tests); Wirkung des `pre-push`-Guards im realen Push.
- **OPEN:** TEMP-DIAG-Bereinigung (5 Non-Core-Stellen); MCP-Konsolidierung; WebSocket-Auto-Resync; Multi-Tab-Schutz; Branch-Protection/CODEOWNERS/CI-Core-Guard; Herkunft von `.ruvector/` und `ruvector.db`; lokale Änderung `.codex/config.toml` (Entscheidung); untracked `.claude/settings.local.json.bak-20260930T234259`; Human Live QA (alle Punkte der `HUMAN_LIVE_TEST_CHECKLIST.md`); CURRENT-HEAD RE-VERIFICATION GATE.
- **OPEN_DECISION:** Autor-Identität, siehe 21.5.
- **BLOCKED:** TEMP-DIAG-Core-Block (`utils/websocket-helpers.ts`, nur mit ausdrücklicher Freigabe); Release-Gate (Hardware/Human Live QA); `p345.sh` (darf nicht ausgeführt werden).
- **OPTIONAL:** Remote-Tags; ECC-Katalogreduktion (ECC-D4); weitere Codex-Governance; `.codex/hooks.json`-Portabilität.

### 21.5 OPEN_DECISION: Autor-Identität

Alle 121 Commits des Autors `Sergej` tragen `du@example.com` (Platzhalter; zusätzlich 21 Commits von `Putos333` und 1 von `Emergent`).
Die Commits sind bereits gepusht; eine Änderung erfordert einen Rewrite und einen Force-Push auf eine öffentliche Remote.
Es wurde nichts geändert, `git config` blieb unverändert. Entscheidung offen und ausdrücklich dem Nutzer vorbehalten.

### 21.6 CURRENT_VERIFIED: Re-Verifikation auf HEAD `9f859ef` (2026-10-03)

HEAD `9f859ef0234b5f5fa5380b2f7be0a1d4a5f21549` (`docs(setup): reconcile post-P40 verified state`) ist `1b65b55` plus ein reiner Doku-Commit
(6 Markdown-Dateien); Produktcode und Konfiguration sind identisch zu `1b65b55`. Ausgeführt unter Node v22.23.2 (`.nvmrc`), jeweils Exit 0:

| Prüfung | Befehl | Ergebnis |
|---|---|---|
| Typecheck | `yarn compile` (`vue-tsc --noEmit`) | CURRENT_VERIFIED: PASS |
| Unit-Tests | `yarn test` | CURRENT_VERIFIED: PASS, 596/596, 82 Suiten, 0 fail, 0 skipped |
| Component-Tests | `yarn test:components` | CURRENT_VERIFIED: PASS, 97/97, 13 Dateien |
| Firefox-MV2-Build | `yarn wxt build -b firefox` | CURRENT_VERIFIED: PASS |
| Chrome-MV3-Build | `yarn wxt build` | CURRENT_VERIFIED: PASS |
| Core-Guard | `node scripts/core-guard.mjs range origin/main..HEAD` | CURRENT_VERIFIED: Exit 0 |
| `git diff --check` | – | CURRENT_VERIFIED: PASS |
| Setup-Gate (`yarn gate run`) | – | NOT RUN: für diesen DOCS_ONLY-HEAD kein Gate-Paket vorgesehen (`gate classify`: OK) |

Diese Werte ersetzen die Zahlen 531/531, 90/90 und die früheren Build-/Typecheck-Aussagen als aktuellen Stand. Die früheren Ergebnisse
(531/531, 90/90, Gate 8/8 Alt-Stand, Package-C-Zahlen) bleiben als **HISTORICAL_VERIFIED** erhalten. Die Markierung
`HISTORICAL_VERIFIED_NOT_RERUN_ON_1b65b55` in 21.2 beschreibt den Stand vor diesem Lauf. Seit dem Lauf nicht neu ausgeführt: Setup-Gate.
Die höheren Zahlen (596/97) entsprechen den seit dem Alt-Stand hinzugekommenen Commits (u. a. PKG-1, Discord, ELO); das ist nicht einzeln aufgeschlüsselt (INFERRED).

## 22. PLAYWRIGHT / E2E-CI (2026-10-04, HEAD `92b723e`)

Nachtrag zu Abschnitt 21; dieser bleibt als Stand vom 2026-10-03 erhalten. Details: `docs/SETUP_2_0_DEV_AGENT_SETUP.md` Abschnitt 12.

| Fakt | Stand (2026-10-04) | Evidenz |
|---|---|---|
| Playwright | `@playwright/test` 1.62.1 exakt, integriert (Commit `5389f1a`) | `package.json`, `yarn.lock` |
| E2E-Suite | 13/13 PASS lokal (Chromium 151.0.7922.34, headed unter Xvfb), inkl. 1 Visual-Regression-Test | `yarn test:e2e` |
| E2E-CI | Job „Playwright E2E" in `pr-control-center.yml`, PR #17 gemergt (Merge-Commit `92b723e`) | `gh pr view 17` |
| CI auf `main` (Run 37220303579) | „Control Center PR Gates" SUCCESS, „Playwright E2E" SUCCESS (13 passed) | `gh run view` |
| Playwright-Browser-Cache | MISS in den beobachteten Läufen (PR und `main`); Cache-Treffer nicht beobachtet | Job-Log |
| Gate | `playwright.config.ts` = `BUILD_DEPENDENCY`; `yarn gate run` PASS; E2E ist keine Gate-Stufe | `scripts/gate.config.json` |
| Fehler-Artefakt-Upload | nicht ausgelöst, unerprobt | Job-Log |

**Weiterhin offen (ohne Hardware):** TEMP-DIAG (5 Non-Core-Stellen; zwei Core-Logs und das Human-Test-Panel bleiben bis nach Human Live QA unverändert), MCP-Konsolidierung,
Branch-Protection (keine; keine Rulesets), CODEOWNERS (keiner), Autor-Identität (`du@example.com`, 127 Commits), Dependency-Triage (`yarn audit --groups dependencies`: 0 critical,
16 high, 5 moderate), Dependabot aus. **Human Live QA ist nicht der nächste Gate** (DEFERRED/BLOCKED, Hardware); Hardware ist für den Setup-Abschluss nicht erforderlich.
