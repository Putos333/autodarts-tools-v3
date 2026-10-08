# TESTING – Fast Lane (S0–S3)

Schlankes, reproduzierbares Prüfverfahren. Qualität und Reproduzierbarkeit stehen vor Zeitgewinn.

## Ebenen

| Ebene | Wann | Was | Autorität |
|---|---|---|---|
| **S0** | nach jeder Dateiänderung | nur betroffene Tests, 1–15 s typisch | nie Freigabe für Commit oder Release |
| **S1** | genau einmal vor dem Commit, wenn Code **und** Doku final sind | `yarn gate run <package>`: Klassifikation bestimmt die relevanten Gates, Ergebnisse werden gecacht | lokale Freigabe zum Commit |
| **S2** | PR-/Push-CI | vollständige automatisierte Prüfung: `yarn test:all`, Komponenten, Typecheck, Chrome- und Firefox-Build, Playwright (laut Workflows) | Freigabe zum Merge |
| **S3** | nur bei echten Live-Pfaden | manueller Board-/Kiosk-Test durch einen Menschen | Laufzeit-Abnahme |

Live-Pfade (S3 nötig): `entrypoints/match.content/**`, WebSocket-/Socket-Laufzeit, geschützter Scoring-Kern, WLED, Caller und weitere nachweislich hardware- oder laufzeitkritische Pfade.

## S0 – `scripts/test-related.mjs`

```
yarn test:related                         # geänderte Dateien aus git status
yarn test:related <datei...>              # explizite Dateien
yarn test:related --list <datei...>       # nur auflisten, nichts ausführen
node scripts/test-related.mjs --hook      # Claude-Code-PostToolUse (JSON von stdin)
```

Der Hook ist in `.claude/settings.json` eingetragen (`PostToolUse`, Matcher `Edit|MultiEdit|Write`, Timeout 180 s). Er läuft nach jedem Edit/Write und gibt bei Fehlern Exit 2 mit Fehlerausgabe auf stderr zurück; leere oder kaputte Payloads sind ein stiller No-op.

**Was S0 erkennt** (Dateien `.ts`, `.vue`, `.js`, `.mjs` unter `utils`, `components`, `composables`, `entrypoints`, `src`, `socket`, `scripts`, `tests`):

- statische Imports (relativ, `@/`, `~/`, `src/`, `import()`, `require()`), rückwärts und transitiv bis zu den Tests
- Pfadnennungen in Tests, z. B. Quelltext-Vertragstests wie `tests/lifecycle-contracts.test.mjs`
- Composable-Auto-Imports: ein exportierter Name aus `composables/` wird in einer anderen Datei verwendet
- Vue-Komponenten im Template (`<PascalCase>` oder `<kebab-case>`)

**Was S0 nicht erkennt:** Laufzeitkopplungen (Storage-Schlüssel, Events, WebSocket-Nachrichten, CSS-Klassen) und eigenständige CSS-Dateien.

**„Kein Test erreicht“ heißt nicht „sicher“.** S0 meldet das ehrlich und beendet sich mit Exit 0; das Gate (S1) läuft vor dem Commit trotzdem voll.

### CSS

Es gibt keine CSS-Abhängigkeitsanalyse. CSS-only-Änderungen können legitim keinen S0-Test auslösen; das ist **keine** Abdeckungsaussage. S1 bleibt Pflicht. Bei sichtbar relevanten CSS-/UI-Änderungen ist eine visuelle Prüfung angemessen.

## Testbefehle

| Befehl | Inhalt |
|---|---|
| `yarn test` | App-Tests: `tests/*.test.ts`, `tests/lifecycle-contracts.test.mjs`, `tests/preview-script.test.mjs` |
| `yarn test:tooling` | Tooling-Tests: `tests/gate.test.mjs`, `tests/core-guard.test.mjs`, `tests/test-related.test.mjs` |
| `yarn test:all` | `yarn test && yarn test:tooling` (CI, `factory-check`, `preflight`) |
| `yarn test:components` | Vitest-Komponententests (`tests/components/**`) |
| `yarn test:e2e` | Playwright (Details in `CLAUDE.md`) |
| `yarn test:related` | S0-Selektor |

Jede Datei `tests/*.test.{ts,mjs}` gehört genau einem der Befehle `test` oder `test:tooling`; `tests/test-related.test.mjs` prüft das gegen `package.json`. Eine neue `tests/*.test.mjs` muss deshalb in `package.json` einem der beiden Befehle zugeordnet werden.

## Gate `tooling`

Das Gate `tooling` (`yarn test:tooling`, gecacht) ist Pflicht bei Änderungen an `scripts/gate.*`, `scripts/core-guard.mjs`, `scripts/githooks/**`, `scripts/test-related.mjs`, `tests/gate.test.mjs`, `tests/core-guard.test.mjs`, `tests/test-related.test.mjs` sowie bei Build-Abhängigkeiten (`package.json`, `yarn.lock`, `.nvmrc` u. a.). Der Selektor und seine Tests sind damit durch echte Tests geschützt, nicht nur durch einen Syntax-Check.

## Node-Version

Das Projekt verlangt die Version aus `.nvmrc`. Das Gate blockiert bei einer abweichenden Major-Version. Die Validierung läuft mit der geforderten Version, z. B. `PATH=$HOME/.nvm/versions/node/<version>/bin:$PATH`. Der S0-Hook nutzt das `node` aus dem PATH der Claude-Code-Sitzung; ein Test-Ergebnis unter anderer Major-Version ist nur Feedback und ersetzt S1 nicht.

## Verbindliche Stopp-Regeln

1. Ein grüner Lauf ist Evidenz für die unveränderte Revision.
2. Keine identische Vollprüfung ohne neuen Code oder konkreten Grund wiederholen.
3. S0 ersetzt S1 nie.
4. Lokal nicht doppeln, was eine gültige S2-CI nach bestandenem S1 ohnehin ausführt, außer ein konkretes Risiko oder ein Fehler erfordert die lokale Reproduktion.
5. Höchstens ein Review pro unverändertem Diff.
6. Keine Commits, die nur einen Verifikationsstand festhalten.
7. Die Dokumentation ist vor dem finalen S1 vollständig.
8. **Tooling-Freeze** nach Aktivierung: Gate, Hooks, Routing und Test-Infrastruktur ändern sich nur für einen reproduzierten Defekt oder ein ausdrücklich geplantes Wartungspaket.
9. Neue Tests schützen Verhalten, Verträge oder die Test-Infrastruktur selbst; keine Tests, die nur Dokumentationswortlaut prüfen.
10. Flaky Tests werden repariert oder mit einem Issue in Quarantäne genommen – nie bis grün wiederholt.

## Metriken

- Median der Zeit von „Änderung fertig“ bis „PR grün“ (Richtwert Klein/Mittel: normalerweise unter 1 Stunde)
- Anzahl redundanter Verifikations-Wiederholungen
- CI-Wiederholungen wegen Flakes oder Infrastruktur
- entkommene Regressionen
- Status-only-Commits (Ziel: 0)

Es gibt bewusst keine Zielquote für „feat/fix-Commits“.
