# RELEASE READINESS — Autodarts Tools V3

**Stand:** 2026-08-17, nach FINAL PRE-RUNTIME FACTORY HARDENING MISSION
**Branch:** `feature/control-center`
**Basis:** FACTORY_STATUS.md, RUNTIME_TEST_PLAN.md, statischer Code-Audit

Jeder Punkt ist ehrlich bewertet: PASS, FAIL, PARTIAL, RUNTIME REQUIRED oder
UNKNOWN. Kein Punkt wird beschönigt.

## SECURITY

| Punkt | Status | Detail |
|---|---|---|
| Token-Logging | **PASS** | `console.log(authToken)` in `QuickCorrection.vue` entfernt (TD-01, heute behoben) |
| esbuild.drop wirksam | **PASS** | Root Cause gefunden und behoben (falsch verschachtelt unter `build.esbuild` statt Top-Level `esbuild`) — Build-Output zeigt jetzt drastisch reduzierte console.*-Aufrufe |
| Secrets im Repo | **PASS** | Repositoryweiter Scan (API-Keys, Tokens, Passwörter) — nichts gefunden |
| Verschlüsselte API-Key-Speicherung | **PASS** | `utils/secure-storage.ts` — AES-GCM 256, Schlüssel in IndexedDB, verlässt den Browser nie |
| Manifest-Permissions | **PASS** | Minimal (`storage`, `activeTab`), keine `<all_urls>`, host_permissions auf konkrete Domains beschränkt |
| Liga-Backend-Auth | **PARTIAL** | `jsonbin.io` ohne Master-Key, nur Share-Code-Schutz — akzeptabel für aktuelle Nutzung, Risiko bei Skalierung/echten Namen (TD-17, unverändert) |

## BUILD

| Punkt | Status | Detail |
|---|---|---|
| Firefox Build | **PASS** | `yarn build:firefox`, 11-12s, 4.07 MB (nach esbuild-Fix kleiner als zuvor) |
| Build-Warnungen | **PASS** | Nur `transformWithEsbuild` deprecated (Vite-intern, kein Handlungsbedarf) + Plugin-Timing-Hinweis |
| Manifest korrekt | **PASS** | MV2, korrekte content_scripts, web_accessible_resources plausibel |
| Keine Secrets im Bundle | **PASS** | geprüft, keine Treffer |
| Keine Debug-URLs im Bundle | **PASS** | nur `wled-device.local` (mDNS, Nutzer-eigenes Gerät) und Platzhalter-Text für lokale Kalibrierungsserver |

## TESTS

| Punkt | Status | Detail |
|---|---|---|
| Unit-Test-Baseline | **PASS** | 73/73 (65 bestehend + 8 neu für `normalizeOrigin`) |
| Typecheck (unsere Dateien) | **PASS** | 0 neue Typfehler in Control Center/Training/History/Friends-Diagnostic-Dateien (8 gezielt behoben) |
| Typecheck (Gesamt-Baseline) | **PARTIAL** | 61 bekannte, vorbestehende Fehler in unangetasteten Alt-Dateien (nicht heute verursacht, nicht massenhaft repariert) |
| Integration/E2E-Tests | **FAIL** | 0 vorhanden — reine Unit-Test-Ebene |

## RUNTIME

| Punkt | Status | Detail |
|---|---|---|
| Normales Match | **RUNTIME REQUIRED** | kein Test bisher live gelaufen |
| Match-Ende / Sieger | **RUNTIME REQUIRED** | — |
| Checkout-Werte | **RUNTIME REQUIRED** | Checkout-Misses-Approximation insbesondere ungeprüft |
| Reconnect | **RUNTIME REQUIRED** | kein Auto-Resync-Code vorhanden (bekannt) |
| Multi-Tab | **RUNTIME REQUIRED** | globale Storage-Keys, kein Timestamp-Schutz (bekannt) |
| Browser-Restart | **RUNTIME REQUIRED** | Persistenz durch WebExtension-API garantiert, erster Render-Zustand nicht statisch beweisbar |

## MATCH

| Punkt | Status | Detail |
|---|---|---|
| Ein Schreibpfad für Match-State | **PASS** | verifiziert, `processWebSocketMessage` + `clearMatch()` |
| Match-ID-Auflösung | **PASS** | Board-ID wird vor jedem Fetch explizit zu Match-ID aufgelöst |
| `activated`-Merge-Korrektheit | **PARTIAL** | bekannter Merge-Bug (R4/R5), geschützter Kern, nicht heute angefasst |
| Late/Out-of-Order-Events | **PARTIAL** | statisch bewiesen unprotected, geschützter Kern |

## CMR

| Punkt | Status | Detail |
|---|---|---|
| Schema v1 stabil | **PASS** | unverändert, 32 Tests grün |
| Idempotenz | **PASS** | getestet (unchanged/rejected-weaker/updated) |
| Retention/Sanitize | **PASS** | getestet, robust gegen korrupte Einträge |
| Statistics-taugliche Felder | **PARTIAL** | nur 5 Metriken SAFE (siehe `STATISTICS_DATA_CONTRACT.md`) |

## TRAINING

| Punkt | Status | Detail |
|---|---|---|
| Stats-Datenpfad | **PASS** | R1 verifiziert, `match.stats?.[0]?.matchStats` |
| Legacy-Migration | **PASS** | idempotent, getestet (7 Tests) |
| Checkout-Misses | **RUNTIME REQUIRED** | Approximation, nicht live verifiziert |
| Medal-Progress | **FAIL** | wird nach echten Matches nie befüllt (bekannte Lücke, heute nicht behoben — Produktentscheidung nötig) |
| Blockierender `alert()` (TrainingExercises.vue) | **PASS** | heute auf bestehende `useNotification`/`AppNotification`-Infrastruktur migriert |

## CONTROL CENTER

| Punkt | Status | Detail |
|---|---|---|
| Keine zweite Match-Wahrheit | **PASS** | verifiziert, kein `setValue` auf game-data/board-data/lobby-data im gesamten Control-Center-Code |
| Preview-Flags korrekt | **PASS** | `training` hat kein Drift mehr (bereits vor dieser Mission korrekt, dokumentiert) |
| Broken Links/Icons | **PASS** | keine toten Imports, keine hartkodierten Versionen, keine TODO/FIXME/HACK gefunden |
| Button-Click-Typfehler | **PASS** | 5 Stellen heute behoben (`openAutodarts`/`openClassicSettings` ohne Event-Wrapper) |
| Laufzeit-Verhalten | **RUNTIME REQUIRED** | UI zur Laufzeit nie getestet |

## STORAGE

| Punkt | Status | Detail |
|---|---|---|
| Ein Schreibpfad pro Domain-Key | **PASS** | verifiziert |
| Multi-Tab-Schutz | **FAIL** | kein Owner/Timestamp/Tab-ID-Konzept auf irgendeinem Storage-Key |
| Verwaiste Keys | **PARTIAL** | `local:training-exercise-progress` faktisch verwaist (nur gelöscht, nie befüllt) |
| Doppelte Datenhaltung | **PASS** | einzige gefundene Doppelhaltung (Training-History Legacy vs. neu) bereits durch Migration entschärft |

## MULTI-TAB

| Punkt | Status | Detail |
|---|---|---|
| Statisch vorbereitet | **PASS** | Szenarien A/B/C dokumentiert (siehe `ROADMAP_DEPENDENCIES.md`) |
| Tatsächlicher Schutz | **NOT READY** | kein Code-Schutz vorhanden, nur Dokumentation |
| MVP-3-Fix (Lobby-vs-Match-ID) betroffen | **PASS** | bestätigt unberührt, UUID-Validierung bleibt wirksam |

## RECONNECT

| Punkt | Status | Detail |
|---|---|---|
| Verbindungsstatus-Erkennung | **PASS** | `websocket-monitor.content.ts` erkennt Disconnect, zeigt Hinweis |
| Auto-Resubscribe | **FAIL** | nicht vorhanden |
| Auto-Resync nach Reconnect | **FAIL** | nicht vorhanden, nur manueller Reload |
| Doppelte Listener-Registrierung | **PASS** | nicht gefunden (WXT `ctx.addEventListener` Auto-Cleanup) |

## PRIVACY

| Punkt | Status | Detail |
|---|---|---|
| Keine erfundenen Friends-Daten | **PASS** | verifiziert, `getFriendsDiagnostic()` |
| Granulare Löschung (CMR/Training) | **FAIL** | nur Voll-Löschung vorhanden |
| Export (CMR/History) | **FAIL** | bewusst nicht implementiert (laut Spec) |
| Verschlüsselte API-Keys | **PASS** | siehe Security |

## DOCUMENTATION

| Punkt | Status | Detail |
|---|---|---|
| FACTORY_STATUS.md aktuell | **PASS** | konsistent mit Code (heute stichprobenartig geprüft) |
| RUNTIME_TEST_PLAN.md vollständig | **PASS** | 19 Tests, heute um Prioritäten + Session-Reihenfolge ergänzt |
| Diese Datei (RELEASE_READINESS.md) | **PASS** | neu erstellt |
| STATISTICS_DATA_CONTRACT.md | **PASS** | neu erstellt |
| ROADMAP_DEPENDENCIES.md | **PASS** | neu erstellt |

---

## GESAMTBEWERTUNG

**SAFE TO COMMIT:** YES
**SAFE TO PUSH:** YES (nach heutigem Security-Fix — TD-01/TD-02 waren die einzigen Push-Blocker)
**SAFE TO START RUNTIME TOMORROW:** YES

Kein einziger RUNTIME-REQUIRED-Punkt ist ein bekannter, unbehobener P0-Bug —
sie sind schlicht noch nie beobachtet worden. Die statische Vorbereitung ist
damit abgeschlossen; alles Weitere ist echte Laufzeit-Wahrheit.
