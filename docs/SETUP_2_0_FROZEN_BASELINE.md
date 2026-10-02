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

## VERIFICATION (frisch, 2026-10-02, direkt ausgeführte Gate-Kommandos aus `scripts/gate.config.json`)

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
