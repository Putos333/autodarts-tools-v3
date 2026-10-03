# AUTODARTS ELITE – SETUP 2.0 FROZEN BASELINE

**HEAD `9158b35` · DATE 2026-10-02**

Dokumentarischer Freeze und Recovery-Punkt. Dieses Dokument verändert weder Produktcode
noch Tooling. Ergänzt `docs/SETUP_2_0_DEV_AGENT_SETUP.md` (Abschnitt 9) und
`MASTER_AUTODARTS_ELITE.md` (Abschnitt 20).

## RECOVERY BASELINE

| Feld | Wert |
|---|---|
| RECOVERY BASELINE | `9158b35` (`docs(setup): close out Setup 2.0 gate package and claude-mem verification`) |
| BRANCH | `main` |
| NODE | `v22.23.2` (`.nvmrc`) |
| KNOWN STATUS | Setup 2.0 **READY**, keine Hard Blocker |
| Protected Core | gegenüber `origin/main` unverändert |

## VERIFICATION (HISTORICAL_VERIFIED_NOT_RERUN_ON_1b65b55; 2026-10-02, direkt ausgeführte Gate-Kommandos aus `scripts/gate.config.json`)

| Stufe | Kommando | Ergebnis |
|---|---|---|
| diffcheck | `git diff --check` | PASS |
| compile | `yarn compile` | PASS |
| tests | `yarn test` | PASS, 531/531 |
| components | `yarn test:components` | PASS, 90/90 |
| Firefox build | `yarn wxt build -b firefox` | PASS |
| Chrome build | `yarn wxt build` | PASS |

Einschränkung: `yarn gate run` ergibt bei HEAD = Paket-Baseline `CLASS: NONE` (keine Stufen).
Eine Gate-Paketverifikation von `9158b35` existiert deshalb nicht; die Stufen `syntax` und
`workflow-consistency` (interne Gate-Stufen) wurden nicht ausgeführt, da für den Stand nicht erforderlich.

## KNOWN INTENTIONAL STATE

- Kein Push; 36 Commits ahead von `origin/main` (lokale Referenz, Messzeitpunkt 2026-10-02).
- Human Live QA: DEFERRED.
- P345 (`~/AUTODARTS_D11_EXEC/p345.sh`): nicht ausgeführt, darf nicht ausgeführt werden.
- `.claude/settings.local.json.bak-20260930T234259` untracked (bekannt, absichtlich).
- Projektlokal: claude-mem deaktiviert (`false`), ECC 2.2.1 aktiv, keine Tool-Updates in diesem Stand.
- Offen, kein Hard Blocker: TEMP-DIAG-Bereinigung, Protected-Core-Erzwingung, MCP-Konsolidierung.

## RECOVERY TAG (nur Vorschlag, nicht angelegt)

`setup-2.0-frozen-20261002` (lokal, auf `9158b35`). Anlage nur nach ausdrücklicher Zustimmung:
`git tag setup-2.0-frozen-20261002 9158b35`. Rollback auf den Stand: `git switch -c recovery/setup-2.0 setup-2.0-frozen-20261002`
(kein Reset von `main`).

## NACHTRAG 2026-10-03 (HEAD `1b65b55`, Post-P40)

Dieser Nachtrag überholt die Aussagen oben, wo sie vom heutigen Stand abweichen; die Tabellen oben bleiben als historischer Nachweis erhalten.
Vollständige Tabellen und Hash-Mapping: `MASTER_AUTODARTS_ELITE.md` Abschnitt 21.

- **Hash-Mapping:** Der RECOVERY BASELINE-Hash `9158b35` ist durch einen History-Rewrite keine Vorfahre von `1b65b55` mehr; derselbe Commit
  (`docs(setup): close out Setup 2.0 gate package and claude-mem verification`) heißt jetzt `9826231` (Zuordnung über den Betreff, INFERRED).
- **Recovery-Tag:** `setup-2.0-frozen-20261002` existiert inzwischen lokal und zeigt auf `9826231` (VERIFIED, `git rev-parse`). Er ist nicht auf
  der Remote (Remote-Tags: 0). Die Aussage „nicht angelegt" oben ist überholt.
- **Push:** erfolgt. HEAD = `origin/main` = `1b65b554717361e8c7901bf11cbcf89e24a8a5a7`, 0/0; „36 Commits ahead" und „Kein Push" oben sind überholt.
- **CI:** `pr-control-center` auf `main`, Run 37133647668, `headSha` `1b65b55`: `success` (CURRENT_VERIFIED).
- **Tabelle VERIFICATION oben (531/531, 90/90, Firefox-/Chrome-Build, diffcheck, compile):** HISTORICAL_VERIFIED_NOT_RERUN_ON_1b65b55.
- **OPEN_DECISION:** Autor-Identität `du@example.com` (121 Commits, gepusht); nichts geändert.
- **Rollback-Hinweis (unverändert gültig):** `git switch -c recovery/setup-2.0 setup-2.0-frozen-20261002` (kein Reset von `main`).
