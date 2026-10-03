# Protected Core Enforcement (PKG-7)

Schützt die 5 Protected-Core-Dateien vor unbeabsichtigten Änderungen. Ergänzt das Gate
(`scripts/gate.mjs`), ersetzt es nicht: Das Gate klassifiziert und prüft, diese Schichten sperren früh.

## Geschützte Dateien (Quelle: `scripts/gate.config.json` → `protectedCore.files`)

- `utils/canonical-match-result.ts`
- `utils/canonical-match-result-storage.ts`
- `utils/event-dedupe.ts`
- `utils/websocket-helpers.ts`
- `components/Settings/PrecisionMap.vue`

Eine Erweiterung der Liste braucht ein eigenes Review und die ausdrückliche Freigabe des Nutzers.
`tests/core-guard.test.mjs` prüft, dass die D1-Regeln exakt dieser Liste entsprechen.

Herkunft der 5. Datei: `MASTER_AUTODARTS_ELITE.md` §4 führt `PrecisionMap.vue` ausdrücklich als Protected Core
(angelegt 2026-08-29), `PRE_LIVE_FREEZE.md` nennt sie als unveränderte Geometrie-Baseline. Ein Beschluss, sie aus dem Schutz zu nehmen,
ist im Repo nicht dokumentiert. Die vorübergehende 4er-Liste (CLAUDE.md, AGENTS.md, Gate, Stand 2026-10-02 bis zu dieser Änderung)
wurde deshalb auf Nutzerentscheidung wieder auf 5 Dateien erweitert.

Historische Folge (AUFGELÖST, Stand 2026-10-03): Der ursprüngliche P40-Commit `3a8979c` (ELO-Consent-UI) änderte `PrecisionMap.vue`
ohne Trailer; `core-guard range origin/main..HEAD` hätte ihn gemeldet und `pre-push` den Push abgelehnt. Die Historie wurde seitdem umgeschrieben
(Backup-Branch `backup/pre-p40-trailer-rewrite-20261003`): P40 ist jetzt `79a5034` und trägt `Protected-Core-Approved: …`. Auf HEAD `1b65b55`
(gepusht, `origin/main` identisch) liefert `node scripts/core-guard.mjs range origin/main..HEAD` Exit 0 (CURRENT_VERIFIED, 2026-10-03).
Ein Audit der gesamten Historie (`range origin/main`) meldet weiterhin 6 Vor-Guard-Commits (`27d65ab`, `fb00b08`, `691e9c3`, `8e2f2e3`, `80970ec`, `74f9adf`)
ohne Trailer; sie liegen vor PKG-7 und sind keine Push-Blocker. Ob der `pre-push`-Hook beim realen P40-Push ausgeführt wurde, ist nicht belegt
(IMPLEMENTED_NOT_VERIFIED).

## D1 – Claude Code (`.claude/settings.json`)

- `permissions.ask`: `Edit(<pfad>)` für jede der 5 Dateien. Jede Änderung durch einen Agenten verlangt eine Bestätigung.
  Nur `Edit(...)`-Regeln werden von Claude Code ausgewertet; `Write(...)`-Pfadregeln würden ignoriert.
- `permissions.disableBypassPermissionsMode: "disable"`: neutralisiert `bypassPermissions` und `--dangerously-skip-permissions`
  im Projekt (in beiden Fällen sonst keine ask-Prompts).
- Bewusst KEIN `deny`: Eine ausdrücklich freigegebene Änderung bleibt dadurch möglich.
- Verifiziert (2026-10-02, Claude Code 2.1.287): ask-Regeln aus `settings.json` und `settings.local.json` werden vereinigt;
  im Modus `acceptEdits` greift die ask-Regel; `bypassPermissions` und `--dangerously-skip-permissions` sind wirkungslos.

## D2 – Git-Trailer-Guard (`scripts/core-guard.mjs`, `scripts/githooks/`)

Ein Commit, der eine der 5 Dateien ändert (inkl. Löschen/Umbenennen), braucht in der Commit-Message:

```
Protected-Core-Approved: <konkreter Grund>
```

- Nur nötig, wenn der Commit eine geschützte Datei verändert.
- Grund nicht leer, mindestens 20 Zeichen und mindestens 2 aussagekräftige Wörter. Platzhalter wie `yes`, `ok`, `approved`,
  `true`, `ja`, `freigegeben` werden abgelehnt. Das ist nur eine Formprüfung: Ob der Grund konkret ist, beurteilt ein Mensch.
- Der Trailer dokumentiert eine zuvor vom Nutzer erteilte Freigabe. Er ist keine Freigabe. Agenten dürfen ihn nie selbst setzen oder vorschlagen.
- `commit-msg`: prüft den Commit beim Erstellen. Aus einer Claude-Code-Session heraus (Umgebungsvariable `CLAUDECODE`) wird ein
  Commit, der die geschützten Dateien berührt, immer abgelehnt: erst nach der Freigabe aus dem eigenen Terminal committen.
- `pre-push`: prüft alle Nicht-Merge-Commits, die gepusht würden (auch neue Branches, Branch-Löschungen werden nicht blockiert).
  Fängt damit auch `git commit --no-verify` ab.
- `node scripts/core-guard.mjs range <rev-list-args>` prüft einen beliebigen Commit-Bereich manuell (Audit).

### Aktivierung (einmalig pro Klon, nicht versioniert)

```
git config core.hooksPath scripts/githooks
```

Deaktivieren: `git config --unset core.hooksPath`. Ohne Aktivierung sind die Hooks wirkungslos.
Fehlt `node` im PATH, brechen die Hooks ab (fail closed).

## Bekannte Grenzen

- Lokal nicht lückenlos: `git commit --no-verify` umgeht `commit-msg` (nur `pre-push` fängt es später ab), und
  `git push --no-verify` umgeht beide Hooks. Der Trailer kann technisch auch von einem Agenten geschrieben werden;
  der `CLAUDECODE`-Check lässt sich z.B. mit `env -u CLAUDECODE` umgehen. Verbindlich bleibt die Regel in `AGENTS.md`/`CLAUDE.md`.
- D1 erfasst Datei-Schreibzugriffe über die Edit-Tools sowie `sed`, `tee` und Redirects in Bash. NICHT erfasst: Skripte, die Dateien
  selbst öffnen (Python/Node), und `git checkout`/`git restore` auf Core-Dateien. Bash-Schreibwege werden bewusst nicht pauschal per
  `deny` gesperrt (sonst wären freigegebene Änderungen blockiert). Diese Lücke deckt die Git-Schicht D2 ab.
- Das Gate vergleicht gegen die Paket-Baseline: Eine bereits committete Core-Änderung bleibt für ein später angelegtes Paket
  unsichtbar. `core-guard.mjs range` ist dafür das Audit-Werkzeug.
- GitHub-Branch-Protection, CODEOWNERS und eine CI-Prüfung sind nicht Teil dieses Pakets (Branch-Protection: UNVERIFIED).
