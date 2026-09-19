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

| Feld | Wert |
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
- **Geschützter Kern-Hinweis:** `utils/websocket-helpers.ts` enthält einen temporären `[AD-ELITE MATCH] TEMP-DIAG`-Console-Block (L273–288, loggt jeden Snapshot), bewusst für den Human-Test; vor Release Review/Entfernung (nur mit ausdrücklicher Freigabe, Protected Core).

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
| Push ohne ausdrückliche Freigabe | **verboten** |

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
| Lifecycle-Contract-Suite | IMPLEMENTED + TESTED | `tests/lifecycle-contracts.test.mjs`: 49 `test()`-Blöcke |

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
| PrecisionMap (geschützt) | IMPLEMENTED (unverändert) | Persistenz via canonical contract (`8e2f2e3`) |
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
| Lifecycle-Contracts (`yarn test:lifecycle`) | 49 `test()`-Blöcke PASS (HEAD `2422705b`) |
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
