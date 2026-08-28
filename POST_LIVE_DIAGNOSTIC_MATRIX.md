# POST-LIVE DIAGNOSTIC MATRIX — Autodarts Tools V3

**Erstellt:** 2026-08-28, read-only Analyse, Basis: `PRE_LIVE_SNAPSHOT.md` (HEAD `2707ae9`)
**Zweck:** Nachschlagewerk für den Human Live Test heute Abend — falls ein Test-Bereich auffällig
ist, hier direkt die beteiligten Module, relevanten Logs, Storage-Keys, vorhandene Testabdeckung
und wahrscheinliche Fehlerorte nachschlagen, statt live zu suchen.

Legende Impact-Einschätzung: 🔴 hoch (Scoring/Datenverlust-nah) · 🟡 mittel (Feature funktionslos/falsch) · 🟢 niedrig (kosmetisch/isoliert)

---

## 1. Match Start

**1. Module/Dateien:**
- `entrypoints/match.content/index.ts` — `AutodartsToolsUrlStatus.watch()`, REST-Bootstrap (`fetchWithAuth` → `/gs/v0/matches/{id}/state`), `initMatch()`, Bull-off-Übergangserkennung
- `utils/websocket-helpers.ts` 🔒 (geschützt) — `processWebSocketMessage()`, `shouldProcessSnapshot()` (aus `utils/event-dedupe.ts` 🔒)
- `utils/game-data-storage.ts` — `AutodartsToolsGameData`

**2. Relevante Logs:**
- `"Autodarts Tools: Fetching match data with cookie authentication..."`
- `"Autodarts Tools: Match ID:"`, `"Autodarts Tools: Match Data:"`
- `"Autodarts Tools: Match found, initializing match"`
- `"Autodarts Tools: Failed to fetch match data"` (Status/StatusText) — **bei Fehler das Wichtigste**
- `"Autodarts Tools: Error fetching match data:"`

**3. Zustand/Storage:**
- `local:game-data` (`IGameData`: `private`, `gameMode`, `match`) — **nie automatisch geleert außer bei explizitem `clearMatch()`**
- `local:urlstatus` — aktuelle URL, global über alle Tabs (last-write-wins)
- `matchGeneration`/`cleanupBarrier` (Modul-Scope in `index.ts`) — Race-Guard bei schnellem Match-Wechsel

**4. Vorhandene Tests:**
- `tests/lifecycle-contracts.test.mjs` → `'match lifecycle guards stale lazy initializers and serializes cleanup'`
- `tests/match-flow.test.ts`, `tests/live-throw.test.ts`

**5. Symptom → wahrscheinliche Stelle:**
| Symptom | Wahrscheinliche Stelle |
|---|---|
| Match wird gar nicht erkannt / kein Overlay | `index.ts` URL-Regex-Match oder REST-Bootstrap (403/401 → Auth-Cookie) |
| Alter Match-Stand nach Reload sichtbar | `local:game-data` wird bei Reload nicht rechtzeitig überschrieben (bekannte historische Lücke, R7 in `clearMatch()` teils adressiert) |
| Match von vorherigem Tab "leakt" in neuen | `local:game-data`/`local:urlstatus` sind global, kein Tab-Scoping (bekannte, dokumentierte Lücke, nicht in dieser Session behoben) |

**6. Für Reproduzierbarkeit erfassen:**
Exakte URL beim Fehler, Browser-Konsole komplett (inkl. Fetch-Statuscode), ob Reload/Tab-Wechsel unmittelbar vorher stattfand, Autodarts-Spielmodus (X01/Cricket/etc.).

---

## 2. Schnelle Würfe (mehrere Würfe kurz hintereinander)

**1. Module/Dateien:**
- `utils/game-data-debounce-queue.ts` — **heute neu**, gemeinsame FIFO-Queue für WLED/Caller/SoundFx
- `entrypoints/match.content/wled.ts`, `caller.ts`, `sound-fx.ts` — nutzen die Queue (heute gefixt: `cafc473`, `6163b40`)
- `utils/event-dedupe.ts` 🔒 — `shouldProcessSnapshot()`, Zwei-Achsen-Duplikat-Unterdrückung
- `entrypoints/match.content/match-card.ts`, `utils/checkout-path.ts`, `utils/live-throw.ts`

**2. Relevante Logs:**
- `"Autodarts Tools: caller game data updated"` / `"Autodarts Tools: soundFx game data updated"`
- Falls Bug zurückkehrt: fehlende Zwischen-Ansagen/-Effekte sind i.d.R. **lautlos** — kein Error-Log, nur ein *ausbleibendes* Ereignis (schwer an der Konsole allein zu erkennen)

**3. Zustand/Storage:**
- `local:game-data` (Watcher-Quelle)
- Modul-interne Queue-States (`gameDataQueue` in `wled.ts`/`caller.ts`/`sound-fx.ts`, nicht in Storage sichtbar)

**4. Vorhandene Tests:**
- `tests/wled-game-data-queue.test.ts` (6 Tests: Burst-Verarbeitung, `clear()`, Overflow-Verhalten, Einzel-Update)
- `tests/event-dedupe.test.ts`
- `tests/live-throw.test.ts`, `tests/checkout-path.test.ts`

**5. Symptom → wahrscheinliche Stelle:**
| Symptom | Wahrscheinliche Stelle |
|---|---|
| Ansage/Soundeffekt für einen Wurf fehlt komplett bei schneller Folge | Queue-Fix nicht wirksam — `gameDataQueue.push()`-Pfad prüfen, `maxQueueSize` (Default 5) könnte bei extremem Burst greifen |
| Score springt kurz zurück auf älteren Stand | Bekannte, **nicht behobene** Lücke in `event-dedupe.ts` 🔒 (Late/Out-of-Order-Events, self-heal, aber sichtbar) — braucht expliziten Auftrag |
| WLED-Effekt kommt verzögert statt sofort | Erwartetes Verhalten der Queue (max. 200ms Delay pro Item) — kein Bug |

**6. Für Reproduzierbarkeit erfassen:**
Wie viele Würfe in welchem Zeitfenster, welcher spezifische Effekt/welche Ansage fehlte, Board-Modell falls bekannt (Wurfgeschwindigkeit variiert je nach Board-Firmware).

---

## 3. Spielerwechsel

**1. Module/Dateien:**
- `entrypoints/match.content/ai-commentator.ts` — Match-Start-Ansage (heute gefixt: `501460b`, kein `currentPlayerIdx===0`-Gate mehr)
- `entrypoints/match.content/training-mode.ts` — `resolveMyPlayerIndex`, Identity-Resolution
- `entrypoints/match.content/match-card.ts`, `entrypoints/match.content/ft-auto-result.ts`
- `composables/useControlCenterStatus.ts` — `myUserId` (zentral, N2-Centralization)

**2. Relevante Logs:**
- `"Autodarts Tools: KI-Kommentator gestartet"` / `"...spricht: ..."`
- `[training-mode]`-präfixierte Logs bei Identity-Fehlern

**3. Zustand/Storage:**
- `local:game-data.match.player` (aktueller Spieler-Index)
- `local:globalstatus` (`user.id`/Auth-Token → `myUserId`-Auflösung)

**4. Vorhandene Tests:**
- `tests/ai-commentator-identity.test.ts`
- `tests/training-mode-identity.test.ts`
- `tests/lifecycle-contracts.test.mjs` → `'ai-commentator "Game On" fires regardless of which player starts'`

**5. Symptom → wahrscheinliche Stelle:**
| Symptom | Wahrscheinliche Stelle |
|---|---|
| "Game On" fehlt bei Match-Start | Sollte durch heutigen Fix behoben sein — falls doch: `speak()`s Cooldown (5s) prüfen, evtl. anderes Event kurz zuvor |
| Falscher Spieler wird als "ich" behandelt (Stats/Training) | `myUserId`-Auflösung schlägt fehl (spätes Login, Token noch nicht da) |
| Spielerwechsel-UI (Scoreboard) verzögert | `match.player`-Feld selbst kommt von Autodarts, kein Tools-Bug wahrscheinlich |

**6. Für Reproduzierbarkeit erfassen:**
Wer beginnt (Bull-off-Ergebnis), eigener Login-Status beim Matchstart (bereits eingeloggt vs. Login danach), welcher Name/welche ID als "eigener Spieler" in Training/Stats erschien.

---

## 4. Match-/Winner-Ende

**1. Module/Dateien:**
- **5 parallele End-Detektoren** (dokumentiertes, bekanntes Architekturmerkmal, kein neuer Bug): `utils/canonical-match-result.ts` 🔒 (CMR, "single source of truth"-Kandidat), `entrypoints/match.content/match-card.ts`, `entrypoints/match.content/ft-auto-result.ts`, `entrypoints/match.content/career-controller.ts`, `entrypoints/match.content/wled.ts`
- `entrypoints/match.content/winner-animation.ts`
- `entrypoints/match.content/share-card.ts` + `utils/match-finish.ts` (heute gefixt: `094735b`)
- `utils/liga-api.ts` (heute gefixt: `51e7513`)
- `utils/canonical-match-result-storage.ts` 🔒

**2. Relevante Logs:**
- `[FT-AutoResult] Winner erkannt: {...}`
- `[MatchCard]`-präfixierte Errors
- `[CareerController v2.8.0] Karriere gespeichert – Rang: ...`
- `"Autodarts Tools: Winner Animation - Initializing"`
- `"Autodarts Tools: Liga-Ergebnis gespeichert"` / `"...Liga-Submit fehlgeschlagen"`
- `"ShareCard: Fehler"` (falls Rendering scheitert)

**3. Zustand/Storage:**
- `local:canonical-match-results-v1` (Schema v1, max. 200 Einträge) — **wichtigste Quelle für Verlauf/Statistik**
- `match.finished` / `match.winner` — Sentinel: `-1`/`undefined`/`null` = offen, `>=0` = Gewinner-Index (projektweite Konvention, heute zweimal als Bugquelle identifiziert: share-card, liga-api)
- `lastSubmittedMatchId` (Modul-Scope in `liga-api.ts`, Dedup gegen Doppel-Submit)

**4. Vorhandene Tests:**
- `tests/canonical-match-result.test.ts` (17 Tests, Kern-Schutzbereich)
- `tests/match-flow.test.ts`
- `tests/share-card.test.ts` (6 Tests, `didMatchJustFinish`)
- `tests/liga-auto-submit.test.ts` (5 Tests, `isMatchFinished`)

**5. Symptom → wahrscheinliche Stelle:**
| Symptom | Wahrscheinliche Stelle |
|---|---|
| Match erscheint nicht im Verlauf (Control Center → History) | CMR-Erzeugung (`canonical-match-result.ts` 🔒) — `matchId` fehlt ⇒ kein CMR (Gate), oder `winnerIndex` out-of-bounds |
| Winner-Overlay erscheint doppelt/gar nicht | Einer der 5 Detektoren feuert abweichend — welcher, per `[FT-AutoResult]`/`[MatchCard]`/`[CareerController]`-Log-Präfix unterscheidbar |
| Share-Card erscheint nicht trotz aktiviertem Feature | Sollte durch heutigen Fix behoben sein — prüfen ob `precisionMap.shareCardEnabled` in den Settings wirklich aktiv ist |
| Liga-Ergebnis wird nicht übermittelt trotz Share-Code | Sollte durch heutigen Fix behoben sein — prüfen `config.liga.enabled && config.liga.autoSubmit`, Share-Code-Gültigkeit |
| Korrigiertes Ergebnis (nach QuickCorrection) nicht im Verlauf aktualisiert | Bekannte, **nicht behobene** Lücke: `activated`-Merge in `websocket-helpers.ts` 🔒 verwirft neue `turns`/`stats` beim Korrektur-Merge (R4/R5) |

**6. Für Reproduzierbarkeit erfassen:**
Exakter Match-Typ (X01/Cricket/Sets&Legs), ob Match regulär beendet oder per Korrektur/Abbruch, Zeitpunkt (für CMR `recordedAt`-Abgleich), Screenshot des Control-Center-Verlaufs vs. tatsächlichem Ergebnis.

---

## 5. Quick Correction

**1. Module/Dateien:**
- `entrypoints/match.content/QuickCorrection.vue` (heute gefixt: `ca37740`, Listener-Leak)
- `utils/websocket-helpers.ts` 🔒 — `activated`-Feld-Merge (bekannte Lücke, nicht behoben)

**2. Relevante Logs:**
- `"Throw {index} activated successfully"` / `"Error activating throw:"`
- `"No match ID found"`, `"Could not determine throw index"`

**3. Zustand/Storage:**
- `match.activated` (`-1 | 0 | 1 | 2`) — steuert Korrektur-Modus, unterdrückt Effekte während Korrektur an 9 Stellen im Code
- REST-Call: `POST /gs/v0/matches/{id}/corrections`

**4. Vorhandene Tests:**
- `tests/lifecycle-contracts.test.mjs` → `'QuickCorrection.vue removes both keydown listeners on unmount'` (heute neu)
- Keine funktionalen Tests für den Korrektur-Ablauf selbst (nur Lifecycle-Contract)

**5. Symptom → wahrscheinliche Stelle:**
| Symptom | Wahrscheinliche Stelle |
|---|---|
| Numpad-Kurzbefehle (`/`,`*`,`-`) reagieren nach mehreren Matches doppelt/mehrfach | Sollte durch heutigen Fix behoben sein — falls doch: anderer, noch nicht identifizierter Listener |
| Korrigierter Wurf erscheint nicht sofort im Live-Overlay | Bekannte Lücke: `activated`-Merge verwirft `turns`/`stats` aus der Korrektur-Payload (`websocket-helpers.ts` 🔒) |
| Korrektur-UI öffnet sich an falscher Position | `correctionContainerX/Y`-Berechnung, `getBoundingClientRect()` auf `throwElement` |

**6. Für Reproduzierbarkeit erfassen:**
Wie oft QuickCorrection vor dem Fehler in diesem Match/dieser Session verwendet wurde, ob per Klick oder Numpad-Shortcut geöffnet, ob die Korrektur selbst (REST-Call) erfolgreich war (Netzwerk-Tab prüfen).

---

## 6. Caller

**1. Module/Dateien:**
- `entrypoints/match.content/caller.ts` (heute gefixt: `6163b40`, Debounce-Queue)
- `utils/duo-commentator.ts` (LLM-Duo-Modus, optional)
- `utils/tts-provider.ts`

**2. Relevante Logs:**
- `"Autodarts Tools: caller"` (Init), `"Autodarts Tools: caller game data updated"`
- `"Autodarts Tools: caller initialization error"`

**3. Zustand/Storage:**
- `config.caller.enabled`, `config.caller.sounds`
- `local:game-data` (Watcher-Quelle), `local:board-data` (Board-Events → `checkBoardStatus`)
- IndexedDB (Sound-Dateien via `getSoundFromIndexedDB`)

**4. Vorhandene Tests:**
- Keine funktionalen Unit-Tests für Caller-Logik selbst; nur `tests/lifecycle-contracts.test.mjs` → Debounce-Queue-Cleanup-Contract

**5. Symptom → wahrscheinliche Stelle:**
| Symptom | Wahrscheinliche Stelle |
|---|---|
| Ansage fehlt bei schnellem Wurf | Sollte durch heutigen Fix behoben sein (siehe Bereich 2) |
| Keine Ansage überhaupt | `config.caller.enabled` false, oder Sound-Datei fehlt in IndexedDB (`getSoundFromIndexedDB`) |
| Audio bricht nach Bull-off/Board-Reconnect ab | `audioUnlocked`-Flag / Safari-Kompatibilitäts-Pool (`audioPool`), `unlockAudioAbortController` |
| Doppelter Caller (Autodarts-Original + Tools) | `muteAutodartsOriginalCaller()`/`unmuteAutodartsOriginalCaller()` — MutationObserver-basiert, könnte bei DOM-Änderungen der Autodarts-Seite brechen |

**6. Für Reproduzierbarkeit erfassen:**
Welche Ansage genau fehlte (Score-Wert, Checkout, Bust), Zeitpunkt relativ zum Wurf, ob andere Audio-Features (SoundFX/WLED) gleichzeitig betroffen waren.

---

## 7. SoundFX

**1. Module/Dateien:**
- `entrypoints/match.content/sound-fx.ts` (heute gefixt: `6163b40`, Debounce-Queue)

**2. Relevante Logs:**
- `"Autodarts Tools: Sound FX"` (Init), `"Autodarts Tools: soundFx game data updated"`
- `"Autodarts Tools: soundFx initialization error"`

**3. Zustand/Storage:**
- `config.soundFx.enabled`, `config.soundFx.sounds`
- `local:lobby-data` (Lobby-Ein/Austritt-Sounds), `local:board-data`

**4. Vorhandene Tests:**
- Keine funktionalen Unit-Tests; nur Lifecycle-Contract (Debounce-Queue-Cleanup)

**5. Symptom → wahrscheinliche Stelle:**
Analog zu Caller (Bereich 6) — gleiche Codestruktur, gleicher heutiger Fix.

**6. Für Reproduzierbarkeit erfassen:**
Analog zu Caller.

---

## 8. WLED

**1. Module/Dateien:**
- `entrypoints/match.content/wled.ts` (heute gefixt: `cafc473`) + `utils/wled.ts` (`gameDataProcessor`)
- `utils/game-data-debounce-queue.ts`
- `utils/helpers.ts` — `triggerPatterns` (Range-Trigger-Validierung, `range_[min]-[max]`)

**2. Relevante Logs:**
- `"Autodarts Tools: WLED: No effects configured"`

**3. Zustand/Storage:**
- `config.wledFx.effects[]` (Trigger → Effekt-Mapping)
- `activeRequestControllers`/`requestStartTimers` (Modul-Scope, HTTP-Request-Lifecycle zum WLED-Gerät)
- Kommunikation: direkte HTTP-Requests ans WLED-Gerät (LAN, kein Auth)

**4. Vorhandene Tests:**
- `tests/wled-game-data-queue.test.ts`
- `tests/lifecycle-contracts.test.mjs` → WLED-Cleanup-Contract

**5. Symptom → wahrscheinliche Stelle:**
| Symptom | Wahrscheinliche Stelle |
|---|---|
| Effekt fehlt bei schnellem Wurf | Sollte durch heutigen Fix behoben sein |
| Range-Trigger (z.B. "100-140") feuert nie | Bekannte, **nicht behobene** Randnotiz: `triggerPatterns.ranges` erlaubt unsortierte min/max (z.B. "180-0") ohne Validierung — nur bei Fehlkonfiguration relevant |
| Gerät reagiert gar nicht | Netzwerk-Erreichbarkeit des WLED-Geräts im LAN, nicht Tools-seitig |
| Effekt bleibt nach Matchende "hängen" | `setEffectByTrigger("idle", false, true)` beim Cleanup prüfen — sollte laut Lifecycle-Contract-Test greifen |

**6. Für Reproduzierbarkeit erfassen:**
Konfigurierter Trigger (exakter String aus den Settings), WLED-Gerätemodell/Firmware, ob Effekt bei manuellem Test (Settings → Testen-Button) funktioniert.

---

## 9. Enhanced Scoring

**1. Module/Dateien:**
- `entrypoints/match.content/enhanced-scoring-display.ts` (heute gefixt: `2707ae9`, Console-Spam entfernt)

**2. Relevante Logs:**
- `"Autodarts Tools: Enhanced Scoring Display"` (Init)
- `"Autodarts Tools: Enhanced Scoring Display - Game scores changed"` (bleibt, nur bei echtem Wurf-/Spielerwechsel)
- `console.warn("Invalid score text: ...")` — bei unbekanntem Segment-Format

**3. Zustand/Storage:**
- `local:game-data.match.turns[0].throws` (reine Anzeige, kein eigener Storage-Schreibpfad)
- `previousValues` (WeakMap, Modul-Scope — verhindert redundante Re-Animation identischer Werte)

**4. Vorhandene Tests:**
- `tests/lifecycle-contracts.test.mjs` → `'enhanced-scoring-display game-data watcher does not log unconditionally'` (heute neu)

**5. Symptom → wahrscheinliche Stelle:**
| Symptom | Wahrscheinliche Stelle |
|---|---|
| Score-Anzeige aktualisiert sich nicht | `updateScoreDisplays()` — `querySelectorAll`-Selektoren könnten bei Autodarts-UI-Änderung nicht mehr matchen |
| "Invalid score text"-Warnung in Konsole | `isValidScore()`-Regex deckt ein neues Segment-Format nicht ab (z.B. neue Autodarts-Variante) |
| Konsole wieder voller Logs | Regression des heutigen Fixes — Log-Text `"Game data changed"` (ohne "Game scores") sollte NICHT mehr auftauchen |

**6. Für Reproduzierbarkeit erfassen:**
Exakter angezeigter vs. erwarteter Wert, Spielmodus (bei Nicht-X01-Modi könnten Segment-Namen abweichen), Screenshot der fehlerhaften Anzeige.

---

## 10. Control Center

**1. Module/Dateien:**
- `composables/useControlCenterStatus.ts` (zentrale `myUserId`, Status-Aggregation, 1028 Zeilen, 51 watch/computed)
- `components/ControlCenter/views/CcDashboard.vue`, `CcHistory.vue`, `CcStats.vue`, `CcTraining.vue`
- `components/ControlCenter/CcDashboardSummary.vue`, `CcQuickStats.vue`, `CcLiveMatchWidget.vue`, `CcLiveMatchTeaser.vue`, `CcMatchHistory.vue`, `CcHistoryPlayerStats.vue`
- `utils/match-history-view.ts` (reine View-Model-Schicht, kein Storage-Zugriff)
- `utils/canonical-match-result-storage.ts` 🔒 (Read-Only-Konsument)

**2. Relevante Logs:**
- `useControlCenterStatus.ts` hat **keine** eigenen `console.log`-Aufrufe — Fehler dort erscheinen typischerweise als Vue-Warnungen ("Failed to resolve...") oder Runtime-TypeErrors, nicht als eigene Log-Zeilen

**3. Zustand/Storage:**
- `local:canonical-match-results-v1` (History/Stats-Quelle)
- `local:training-history`, `local:training-exercise-progress` (Training-Dashboard-Kachel)
- `local:globalstatus` (`myUserId`-Auflösung, Live-Refresh via `.watch()`)
- `local:urlstatus` (Deep-Link/Routing — bekannte Multi-Tab-Schwäche, last-write-wins)

**4. Vorhandene Tests:**
- `tests/control-center-data-state.test.ts`, `tests/cc-dashboard-watcher-leak-fix.test.ts`, `tests/dashboard-activity.test.ts`, `tests/match-history-view.test.ts`, `tests/match-center-phase5.test.ts`, `tests/statistics.test.ts`
- `tests/lifecycle-contracts.test.mjs` → mehrere `myUserId`-Centralization- und `deriveCcDataState`-Contracts

**5. Symptom → wahrscheinliche Stelle:**
| Symptom | Wahrscheinliche Stelle |
|---|---|
| Dashboard zeigt "Identität unbekannt" trotz Login | `myUserId`-Auflösung in `useControlCenterStatus.ts` — spätes Token, `local:globalstatus` noch leer |
| Verlauf zeigt Match nicht | CMR wurde nicht erzeugt (siehe Bereich 4) — kein Control-Center-Bug, sondern vorgelagert |
| Zwei Tabs zeigen widersprüchliche "aktives Match"-Links | Bekannte, **nicht behobene** Lücke: `local:urlstatus` global, last-write-wins über Tabs |
| Statistik-Zahlen wirken falsch | `utils/match-history-view.ts` KPI-Berechnung, oder zugrundeliegende CMR-Daten unvollständig (Quality-Tier MINIMAL/PARTIAL) |

**6. Für Reproduzierbarkeit erfassen:**
Wie viele Tabs/Fenster offen, Login-Reihenfolge (vor/nach Extension-Start), exakte angezeigte vs. erwartete Zahl/Zustand, Browser-Konsole (Vue-Warnungen).

---

## 11. Training

**1. Module/Dateien:**
- `entrypoints/match.content/training-mode.ts` — `migrateLegacyTrainingHistory()`, `saveToHistory()`, `maybeAwardMedal()`
- `utils/training-history.ts`, `utils/training-performance.ts`, `utils/training-medals.ts`, `utils/training-exercises.ts`
- `components/ControlCenter/views/CcTraining.vue`, `CcHomeTraining.vue`, `CcTrainingActiveReflection.vue`, `CcExerciseCard.vue`
- `components/Settings/TrainingExercises.vue`, `components/Settings/Training.vue`

**2. Relevante Logs:**
- `[training-mode] migrateLegacyTrainingHistory failed`
- `[training-mode] saveToHistory failed`
- `[training-mode] Medaille vergeben: {exerciseId} → {medal}`
- `[training-mode] maybeAwardMedal failed`

**3. Zustand/Storage:**
- `local:training-history` (max. 50 Sessions, Quelle: `saveToHistory()`)
- `local:training-history-migrated-v1` (einmaliger Migrations-Guard, Legacy-`localStorage['ad-training-history']` → `local:training-history`)
- `local:training-exercise-progress` (Medal-Fortschritt pro Übung)
- `training-active-exercise` (transient, gesetzt von `CcExerciseCard.vue`/`TrainingExercises.vue`, gelesen+bereinigt von `training-mode.ts`)
- Stats-Quelle: `match.stats?.[myIndex]?.matchStats` (average/plus140/total180/checkoutPercent — **nicht** `player.stats`, historischer R1-Bugfix)

**4. Vorhandene Tests:**
- `tests/training-history.test.ts`, `tests/training-medals.test.ts`, `tests/training-performance.test.ts`, `tests/training-mode-identity.test.ts`
- `tests/lifecycle-contracts.test.mjs` → mehrere Training-Contracts (History-Watch statt Mount-Only, Medal-Copy-Konsistenz)

**5. Symptom → wahrscheinliche Stelle:**
| Symptom | Wahrscheinliche Stelle |
|---|---|
| Session erscheint nicht im Verlauf | `saveToHistory()` fehlgeschlagen — `[training-mode] saveToHistory failed`-Log prüfen |
| Keine Medaille trotz gutem Ergebnis | `maybeAwardMedal()`-Log prüfen; `local:training-exercise-progress` könnte durch `resetProgress()` zwischenzeitlich geleert worden sein |
| Live-Overlay während Training zeigt 0-Werte | Stats-Pfad-Regression (`match.stats?.[myIndex]?.matchStats` — falls erneut falscher Pfad, historischer R1-Bug-Rückfall) |
| Alte (Legacy-)Sessions fehlen nach Update | `migrateLegacyTrainingHistory()` — Migrations-Guard (`local:training-history-migrated-v1`) bereits gesetzt, aber Migration selbst fehlgeschlagen |

**6. Für Reproduzierbarkeit erfassen:**
Übungstyp/-ID, eigener Login-Status, ob es die erste Trainings-Session nach diesem Extension-Update ist (Migrations-relevant), exakte erwartete vs. angezeigte Statistik.

---

## 12. Mobile Navigation

**1. Module/Dateien:**
- `components/ControlCenter/CcSidebar.vue` — Bottom-Nav-Variante (teilt Sections/Active-State mit der Desktop-Sidebar)
- `components/ControlCenter/CcLiveMatchWidget.vue` — auch in der Bottom-Nav gemountet
- `entrypoints/controlcenter/style.css` — `.cc-bottom-nav`-Breakpoint

**2. Relevante Logs:**
- Keine dedizierten Logs — rein CSS/Layout-Feature, Fehler äußern sich visuell, nicht in der Konsole

**3. Zustand/Storage:**
- Kein eigener Storage — reine UI-Darstellung basierend auf Viewport-Breite

**4. Vorhandene Tests:**
- `tests/lifecycle-contracts.test.mjs` → 5 dedizierte Tests: Bottom-Nav teilt Sections/Navigate, ARIA-Label-Kürzung (WCAG 2.5.3), `.cc-bottom-nav`-Breakpoint-Sichtbarkeit, `CcLiveMatchWidget` in Bottom-Nav gemountet, `testid`-Suffix-Eindeutigkeit bei zwei gleichzeitigen Instanzen, zusätzliches Bottom-Padding nur bei aktivem Live-Match

**5. Symptom → wahrscheinliche Stelle:**
| Symptom | Wahrscheinliche Stelle |
|---|---|
| Bottom-Nav erscheint nicht bei schmaler Breite | CSS-Breakpoint in `style.css` — Browser-Zoom/DevTools-Device-Mode könnte Breite anders melden als echtes Mobilgerät |
| Zwei Live-Match-Widgets kollidieren (gleiche IDs) | `testid`-Suffixierung — falls Regression, Duplikat-IDs im DOM prüfen |
| Navigation-Klick reagiert nicht | Geteilter `navigate`-Handler zwischen Sidebar/Bottom-Nav — Event-Weiterleitung prüfen |

**6. Für Reproduzierbarkeit erfassen:**
Gerät/Viewport-Breite (exakt, z.B. via DevTools-Responsive-Mode-Anzeige), Screenshot, ob echtes Mobilgerät oder Desktop-Browser-Verkleinerung.

---

## 13. Netzwerk-/WebSocket-Unterbrechung

**1. Module/Dateien:**
- `entrypoints/websocket-monitor.content.ts` — Status-Erkennung, Disconnect-Toast
- `entrypoints/websocket-capture.ts` — MAIN-World WebSocket-Interception
- `utils/websocket-helpers.ts` 🔒 — `processWebSocketMessage()` (REST-Bootstrap läuft nur bei URL-Wechsel, **nicht** bei Reconnect — bekannte, dokumentierte, nicht behobene Lücke)

**2. Relevante Logs:**
- `"[Content Script] WebSocket status:"` (`connected`/`disconnected`/`error`)
- `"[WebSocket Capture] Starting initialization"` / `"...Initialized successfully"` / `"...Initialization failed"`
- `"Injecting WebSocket capture script..."` / `"Failed to inject WebSocket capture script:"`

**3. Zustand/Storage:**
- `browser.storage.local['adt-ws-status']` (**kein** `local:`-Präfix, direkter Roh-Key, kein `WxtStorageItem`) — `{status, openSockets, when, info}`
- Sichtbares UI-Element bei Disconnect: `#adt-ws-disconnect-toast` (In-Page-Toast mit "Seite neu laden"-Button)

**4. Vorhandene Tests:**
- **Keine** — historisch als "RUNTIME REQUIRED" dokumentiert (kein Auto-Resubscribe/Resync-Code vorhanden), in dieser Session nicht angefasst (P0-nah, geschützter Kern betroffen)

**5. Symptom → wahrscheinliche Stelle:**
| Symptom | Wahrscheinliche Stelle |
|---|---|
| Toast "Board getrennt" erscheint, verschwindet aber nach Reconnect nicht | `hideWsDisconnectToast()` wird nur bei `status === 'connected'`-Event ausgelöst — prüfen ob dieses Event nach echtem Reconnect zuverlässig feuert |
| Nach Reconnect bleibt Match-Stand veraltet | **Bekannte, nicht behobene Lücke**: kein Auto-Resync — nur manueller Reload über den Toast-Button möglich |
| Extension reagiert nach Reconnect gar nicht mehr | Content-Script selbst evtl. durch Extension-Update invalidiert (`ctx.onInvalidated`) — Seite neu laden nötig |

**6. Für Reproduzierbarkeit erfassen:**
Wie die Trennung ausgelöst wurde (WLAN aus/an, Router-Neustart, Autodarts-Server-Hiccup), Dauer der Trennung, ob Toast erschien, ob "Seite neu laden" das Problem behob, exakter `adt-ws-status`-Wert (via DevTools → Application → Storage, falls zugänglich).

---

## Übergreifende Hinweise

- **Geschützter Kern** (`canonical-match-result.ts`, `canonical-match-result-storage.ts`, `event-dedupe.ts`, `websocket-helpers.ts`) ist an mehreren Stellen oben als "wahrscheinliche Stelle" für bekannte, **nicht behobene** Lücken genannt (Late/Out-of-Order-Events, `activated`-Merge, kein Reconnect-Resync, Multi-Tab). Das sind **keine neuen Funde**, sondern dokumentierte, bewusst zurückgestellte P0/P1-Punkte, die einen expliziten Auftrag brauchen.
- Alle heute (2026-08-28) gefixten Bereiche sind oben explizit als "sollte durch heutigen Fix behoben sein" markiert — falls dort trotzdem ein Symptom auftritt, ist das der höchste Priorität-Befund für die Nachbereitung (Regression eines frisch verifizierten Fixes).
- Präfix-Konvention für Konsolen-Logs ist uneinheitlich (`"Autodarts Tools: X"` vs. `[ModulName]` vs. `[Content Script]`) — beim Filtern der Konsole ggf. mehrere Muster parallel im Blick behalten.
