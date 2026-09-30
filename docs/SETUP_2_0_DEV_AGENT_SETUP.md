# AUTODARTS ELITE – Setup 2.0: Entwicklungs- und Agent-Setup

Referenzdokument für den verifizierten Konfigurationsstand des Entwicklungs-
und Agent-Setups (Package A, Package B / D1, Package C / C3, Codex-Audit,
Codex-Skill-Archivierung D1/D2, Graphify). Es dient
als Recovery-, Wartungs- und Konfigurationsreferenz.

- Stand der Verifikation: 2026-09-30
- Verifizierte Versionen: ECC 2.2.1 (Claude-Code-Plugin, lokal aktiviert),
  Claude Code 2.1.285, claude-mem 13.16.1, Graphify 0.9.43
- Repository-Stand bei Erstellung: Package-C-Commit `c34ffbedbd1be19bf39a518ef1a16420fbb42ebc`
- Dieses Dokument beschreibt Konfiguration und Entwicklungswerkzeuge, keinen
  Anwendungscode. Es enthält keine Secrets und keine vollständigen privaten
  Konfigurationsdateien.

Wichtig: Zwei der beschriebenen Konfigurationen liegen **nicht im Repository**
(`~/.claude/settings.json` und `.claude/settings.local.json`). Dieses Dokument
ist daher die einzige repositoryseitige Beschreibung dieser Konfigurationen.

## 1. Rollenverteilung

| Komponente | Rolle |
|---|---|
| Git | Source of Truth für Code |
| Tests / Build | Source of Truth für Verifikation |
| claude-mem | **Primary Memory Owner**: Sitzungsgedächtnis, Beobachtungen, Kontext-Wiederherstellung. Nie Wahrheitsquelle für Build- oder Teststatus. |
| ECC (Plugin) | Engineering-, Governance-, Skill- und Agent-Schicht. Keine Memory-Aufgaben. |
| Graphify | Struktur- und Beziehungsanalyse des Codes (`graphify-out/`, Runtime-/Analyseoutput, kein Anwendungscode) |

## 2. Package A – ECC-Memory-Duplikate deaktiviert

**Ziel:** claude-mem ist der einzige Memory-/Persistence-Owner. ECC führt keine
zweite Memory-Kette aus, behält aber seine Schutz- und Governance-Funktionen.

**Konfiguration (außerhalb des Repositories):** `~/.claude/settings.json`,
Schlüssel `env.ECC_DISABLED_HOOKS`, kommagetrennte ECC-Hook-IDs. Das ECC-Profil
bleibt `standard` (`pluginConfigs.ecc@ecc.options.hook_profile`), es wurde nicht
auf `minimal` gestellt, weil `minimal` auch GateGuard und `config-protection`
abgeschaltet hätte.

Deaktivierte ECC-Hooks (7):

```text
session:start
stop:session-end
stop:evaluate-session
session:end:marker
pre:compact
pre:observe
post:observe:continuous-learning
```

**Bewusst erhalten** (u. a.): GateGuard (Bash und Edit/Write),
`pre:bash:block-no-verify`, `config-protection`, `governance-capture`,
Skill-Tracking, Qualitäts- und Engineering-Hooks.

**Im verifizierten Zustand belegt:**
- Die 7 IDs sind laut ECC-Gating-Funktion (`scripts/lib/hook-flags.js`) deaktiviert,
  die Schutz- und Engineering-Hooks aktiviert.
- In einer frischen Session lieferten die ECC-SessionStart-Hooks keinen Kontext
  und es entstanden keine neuen ECC-Session-Dateien unter `~/.claude/session-data`.
- GateGuard blockierte in frischen Sessions den ersten Bash-Aufruf
  (`permissionDecision: deny`); `block-no-verify` blockierte eine Fake-Payload
  mit dem Umgehungs-Flag (Exit 2) und ließ eine harmlose durch (Exit 0).
- claude-mem Health: `ok` (13.16.1).

**Einschränkung:** Die Abschaltung hängt an den Hook-IDs. Ändert ein
ECC-Update eine ID, greift die Abschaltung stillschweigend nicht mehr.
Siehe Abschnitt 4.

## 3. Package B / D1 – ECC-Agent-Katalog reduziert

**Ziel:** den im Kontext sichtbaren ECC-Agent-Katalog verkleinern, ohne die
ausgewählten Engineering-, UI-, QA- und Security-Fähigkeiten zu verlieren.

**Konfiguration (projektlokal, nicht getrackt):** `.claude/settings.local.json`,
Schlüssel `permissions.deny` mit Einträgen der Form `Agent(ecc:<name>)`.

- Der Mechanismus ist eine Claude-Code-Funktion (`Agent(<Name>)`,
  exakter Namensvergleich), keine ECC-Funktion. Es wurde kein ECC-Quellcode
  verändert.
- Die Datei wird durch die globale Git-Ignore-Regel `**/.claude/settings.local.json`
  (`~/.config/git/ignore`) ausgeschlossen. Sie ist deshalb nicht Teil des
  Repository-Diffs und wurde bewusst nicht per `git add -f` eingecheckt.
- Unbekannte Namen in der Deny-Liste sind harmlos (getestet, kein Fehler,
  keine Wirkung).

**Gemessener Effekt für den aktuell verifizierten ECC-2.2.1-Katalog**
(frische Headless-Session, Modell `sonnet[1m]`, Auswertung der Attachments
`skill_listing` und `agent_listing_delta` im Session-Transkript; Tokens
geschätzt als Zeichen ÷ 4):

| Bereich | vor D1 | nach D1 |
|---|---|---|
| ECC-Agents | 68 | 22 |
| Agent-Katalog | 18.544 Zeichen | 5.945 Zeichen (ca. −67,9 %) |
| Skills (292 Einträge) | 8.806 Zeichen | 8.806 Zeichen (unverändert) |
| Commands (83 Einträge, nur als Command) | 10.128 Zeichen | 10.128 Zeichen (unverändert) |
| ECC gesamt | 37.478 Zeichen (ca. 9.370 Tokens) | 24.879 Zeichen (ca. 6.220 Tokens), ca. −33,6 % |

Für den aktuell verifizierten ECC-2.2.1-Katalog wurden nach D1 22 sichtbare
ECC-Agents gemessen. Die Messung wurde in zwei voneinander unabhängigen frischen
Sessions mit identischem Ergebnis reproduziert (gleiche Agent-Menge, gleiche
Zeichenzahlen). Für den aktuell verifizierten ECC-2.2.1-Katalog enthält die
D1-Konfiguration 46 Deny-Einträge. Beides sind gemessene Baselines, keine
Vertragswerte.

**Nicht angewendet:** D4 (Kappe für Beschreibungslängen,
`skillListingMaxDescChars`). Skills und Commands wurden durch D1 nicht
reduziert. Für Plugin-Skills gibt es keinen unterstützten Filter
(`skillOverrides` gilt laut Claude-Code-Doku nicht für Plugin-Skills, ein
`Skill(...)`-Deny blendet den Eintrag nicht aus dem Katalog aus – gemessen).

### 3.1 Behaltene Agents (Klassifikation zum Zeitpunkt der Messung)

- **KEEP – CORE (10):** `architect`, `vue-reviewer`, `typescript-reviewer`,
  `a11y-architect`, `performance-optimizer`, `security-reviewer`, `e2e-runner`,
  `tdd-guide`, `build-error-resolver`, `doc-updater`
- **KEEP – SPECIALIST (6):** `silent-failure-hunter`, `pr-test-analyzer`,
  `database-reviewer`, `python-reviewer`, `spec-miner`, `loop-operator`
- **KEEP – UNCERTAIN (6, bis Nutzen geklärt):** `planner`, `refactor-cleaner`,
  `agent-evaluator`, `harness-optimizer`, `gan-planner`, `gan-generator`

Nicht-ECC-Agents (u. a. `pr-review-toolkit:*`, `feature-dev:*`,
`production-validator`) sind von D1 nicht betroffen.

### 3.2 Deny-Liste (46 Einträge, versionsabhängig)

Rekonstruktionsreferenz für `.claude/settings.local.json`, falls die lokale
Datei verloren geht. Nur der Block `permissions` ist hier wiedergegeben; die
übrigen Schlüssel der Datei (u. a. die Aktivierung des ECC-Plugins) gehören
nicht zu D1.

```json
{
  "permissions": {
    "deny": [
      "Agent(ecc:chief-of-staff)",
      "Agent(ecc:code-architect)",
      "Agent(ecc:code-explorer)",
      "Agent(ecc:code-reviewer)",
      "Agent(ecc:code-simplifier)",
      "Agent(ecc:comment-analyzer)",
      "Agent(ecc:conversation-analyzer)",
      "Agent(ecc:cpp-build-resolver)",
      "Agent(ecc:cpp-reviewer)",
      "Agent(ecc:csharp-reviewer)",
      "Agent(ecc:dart-build-resolver)",
      "Agent(ecc:django-build-resolver)",
      "Agent(ecc:django-reviewer)",
      "Agent(ecc:docs-lookup)",
      "Agent(ecc:fastapi-reviewer)",
      "Agent(ecc:flutter-reviewer)",
      "Agent(ecc:fsharp-reviewer)",
      "Agent(ecc:gan-evaluator)",
      "Agent(ecc:go-build-resolver)",
      "Agent(ecc:go-reviewer)",
      "Agent(ecc:harmonyos-app-resolver)",
      "Agent(ecc:healthcare-reviewer)",
      "Agent(ecc:homelab-architect)",
      "Agent(ecc:java-build-resolver)",
      "Agent(ecc:java-reviewer)",
      "Agent(ecc:kotlin-build-resolver)",
      "Agent(ecc:kotlin-reviewer)",
      "Agent(ecc:marketing-agent)",
      "Agent(ecc:mle-reviewer)",
      "Agent(ecc:network-architect)",
      "Agent(ecc:network-config-reviewer)",
      "Agent(ecc:network-troubleshooter)",
      "Agent(ecc:opensource-forker)",
      "Agent(ecc:opensource-packager)",
      "Agent(ecc:opensource-sanitizer)",
      "Agent(ecc:php-reviewer)",
      "Agent(ecc:pytorch-build-resolver)",
      "Agent(ecc:rag-pipeline-reviewer)",
      "Agent(ecc:react-build-resolver)",
      "Agent(ecc:react-reviewer)",
      "Agent(ecc:rust-build-resolver)",
      "Agent(ecc:rust-reviewer)",
      "Agent(ecc:seo-specialist)",
      "Agent(ecc:swift-build-resolver)",
      "Agent(ecc:swift-reviewer)",
      "Agent(ecc:type-design-analyzer)"
    ]
  }
}
```

Begründungsgruppen: Sprach- und Domänen-Spezialisten ohne Bezug zum Projekt;
7 Duplikate installierter Anthropic-Plugin-Agents (`code-architect`,
`code-explorer`, `code-reviewer`, `code-simplifier`, `comment-analyzer`,
`conversation-analyzer`, `type-design-analyzer`); 2 als defekt bekannte Agents
(`docs-lookup`, `gan-evaluator`).

## 4. ECC-Update-Wartungsvertrag

Diese Regeln gelten nach jedem ECC-Update (und bei jeder Änderung an der
ECC-Installation):

1. Nach jedem ECC-Update muss der Agent-Katalog erneut gemessen werden.
2. Neue oder umbenannte ECC-Agents dürfen **nicht** automatisch gesperrt werden.
3. Neue Agents werden zuerst analysiert.
4. Danach wird bewusst zwischen KEEP und DENY entschieden.
5. Die Zahl 22 ist eine gemessene Baseline für ECC 2.2.1, kein unveränderlicher
   Vertrag.
6. Die 46 Deny-Einträge sind versionsabhängig.
7. Die erforderlichen Spezialisten müssen nach jedem ECC-Update weiterhin
   verfügbar sein, mindestens: `vue-reviewer`, `typescript-reviewer`,
   `silent-failure-hunter`, `database-reviewer`, `python-reviewer`,
   `spec-miner`, `loop-operator`.
8. Package-A-Sicherheits- und Governance-Funktionen (GateGuard,
   `pre:bash:block-no-verify`, `config-protection`, `governance-capture`)
   dürfen durch zukünftige Katalogoptimierungen nicht versehentlich
   deaktiviert werden.
9. claude-mem bleibt Primary Memory Owner.
10. ECC Memory Duplication soll weiterhin 0 bleiben (die 7 Hook-IDs aus
    Abschnitt 2 müssen nach einem Update weiterhin deaktiviert sein; geänderte
    IDs prüfen).

Vorgehen zur Nachmessung (schreibfrei bezüglich Konfiguration): eine frische
nicht-interaktive Session starten (`claude -p` mit kurzem Prompt und
`--output-format stream-json`), im Session-Transkript die Attachments
`agent_listing_delta` (Agent-Katalog) und `skill_listing` (Skills/Commands)
auswerten und mit den Werten aus Abschnitt 3 vergleichen. Zusätzlich die
Deny-Liste gegen die dann registrierten ECC-Agents abgleichen.

## 5. Package C – inaktive Ruflo-/Claude-Flow-Reste entfernt

- **Ergebnis:** PASS. 50 getrackte, inaktive Ruflo-/Claude-Flow-Dateien wurden
  in einem Commit entfernt (`.claude/helpers/` bis auf 6 generische Dateien,
  6 `v3-*`-Skills, `pair-programming`, der Agent `tdd-london-swarm`,
  `.claude-flow/` (getrackte Dateien) und `.swarm/schema.sql`).
- **Package-C-Commit:** `c34ffbedbd1be19bf39a518ef1a16420fbb42ebc`
  (`AUTODARTS ELITE Setup 2.0 Package C: remove inactive Ruflo residue`)
- **Recovery-Tag:** `setup-2.0-pC-pre-ruflo-residue-cleanup-83782f8`
  (zeigt auf den Stand unmittelbar vor Package C).
- Anwendungscode und Protected Scoring Core blieben unberührt. Nach dem
  Commit liefen `yarn compile`, `yarn test` (501/501), `yarn test:lifecycle`
  (50/50) und `yarn test:components` (82/82) erfolgreich; ECC und claude-mem
  blieben funktional.
- Außerhalb des Repositories wurde in `~/.claude/CLAUDE.md` nur der Satz zur
  Reaktivierbarkeit von Ruflo entfernt (Backup vorhanden).
- Es gibt keine automatische Wiederinstallation dieser Altbestände.

Bewusst **nicht** entfernt (unverändert): `.claude/commands/github/`,
6 generische Helper (`.claude/helpers/.helpers-version`, `auto-commit.sh`,
`checkpoint-manager.sh`, `github-safe.js`, `helpers.manifest.json`,
`standard-checkpoint-hooks.sh`), `.claude/agents/browser/browser-agent.yaml`,
`.claude/scaffold-archive/`, `.agents/`, `.codex/`.

### 5.1 Package C3 – ignorierte Ruflo-/Claude-Flow-Reste entfernt

Die 14 nach Package C zurückgebliebenen, ignorierten Laufzeitdateien wurden in
einem separaten Schritt (Package C3) entfernt:

- **Ergebnis:** PASS. 14/14 Dateien wurden einzeln entfernt (`.swarm/`: zwei
  SQLite-Sätze jeweils mit DB, WAL und SHM; `.claude-flow/`: Zeiger-, Metrik-,
  Audit-, Policy- und Agent-Store-Dateien; `.ruflo/`: eine Browser-Session-
  Datei), danach die leeren Verzeichnisse `.swarm/`, `.claude-flow/` und
  `.ruflo/`. Vorab war forensisch (auf Kopien) belegt, dass die Datenbanken
  keine Projektdaten enthielten und kein Verbraucher existierte.
- **Recovery-Tag:** `setup-2.0-pC3-pre-ruflo-ignored-cleanup-00027e0`
  (Stand vor C3; die Dateien waren ignoriert, der Tag markiert den
  Repository-Stand, die Dateien selbst liegen im externen Backup).
- **Externes Backup:** `~/.claude-mem-backups/pkgC3-<Zeitstempel>/` mit
  Archiv, SHA-256-Manifest und Verweis auf das frühere Package-C-Backup. Der
  Restore-Test (Entpacken und Hash-Vergleich, 14/14) war vor dem Entfernen
  bestanden.
- Die Entfernung ignorierter Dateien erzeugt keinen Git-Commit. Es gab keine
  Änderung an Anwendungscode oder Protected Scoring Core.
- `.ruvector/` und `ruvector.db` sind ausdrücklich **nicht** Bestandteil von
  Package C oder C3 und blieben unverändert.
- Graphify: KEEP, kein Update durchgeführt (der Graph enthielt keine Knoten
  dieser Pfade). Package A blieb PASS: claude-mem bleibt Primary Memory Owner,
  die 7 ECC-Duplikat-Hooks bleiben deaktiviert, GateGuard und
  `pre:bash:block-no-verify` blieben wirksam. In einer frischen Session wurden
  die Reste nicht neu erzeugt.

### 5.2 Codex-Audit (`.agents/`, `.codex/`)

Namenshinweis: Die Bezeichnungen „D1“ und „D2“ der folgenden Abschnitte
beziehen sich auf die Archivierung von **Codex-Skills** und sind nicht
identisch mit „Package B / D1“ (ECC-Agent-Katalog, Abschnitt 3).

- Codex wurde separat auditiert (read-only). Entscheidung: Codex bleibt
  vorerst als **optionaler Harness** erhalten.
- `.codex/config.toml` und `.codex/hooks.json` wurden **nicht verändert** und
  in diesem Rahmen auch nicht abschließend auditiert (siehe Abschnitt 8, B).
- `.codex/hooks.json` ist getrackt und enthält Graphify-Guard-Hooks
  (`hook-guard search` / `hook-guard read --strict`) sowie einen
  `SessionStart`-Hook auf `.codex/hooks/session-start.sh`.
- Die weitere Codex-Governance ist **OPEN** (Abschnitt 8).

### 5.3 Package D1 (Codex) – 29 veraltete Codex/Ruflo-Skills archiviert

- **Ergebnis:** PASS. 29 nachweislich veraltete Codex-Skills (Ruflo-, Swarm-,
  AgentDB- und claude-flow-Varianten) wurden per `git mv` von `.agents/skills/`
  nach `.claude/scaffold-archive/skills/codex/` verschoben. Nichts wurde
  gelöscht; die Git-Historie bleibt erhalten.
- **Commit:** `5fafa2352c0843c8300c34be43d64cbe0f1b3d71`
  (`AUTODARTS ELITE Setup 2.0 D1: archive stale Codex Ruflo skills`)
- **Recovery-Tag:** `setup-2.0-pD1-pre-codex-stale-skill-archive-ca79698`
  (Stand vor dem Verschieben). Externes Backup: `~/.claude-mem-backups/pkgD1-<Zeitstempel>/`.
- Graphify blieb aktiv und unverändert. Kein Push.

### 5.4 Package D2 (Codex) – drei generische Codex-Skills archiviert

- **Ergebnis:** PASS. Nach separatem Read-only-Audit (je Skill: ARCHIVE
  CANDIDATE) wurden `pair-programming`, `skill-builder` und
  `v3-security-overhaul` nach `.claude/scaffold-archive/skills/codex/`
  archiviert (`git mv`, Dateiinhalt unverändert).
- **Commit:** `70fd00ea29dc7e492301d0a68987f8faec45f352`
  (`AUTODARTS ELITE Setup 2.0 D2: archive final stale Codex skills`)
- **Recovery-Tag:** `setup-2.0-pD2-pre-final-codex-skill-archive-5fafa23`
  (zeigt auf den D1-Commit, den Stand direkt vor D2).
- **Externes Backup:** `~/.claude-mem-backups/pkgD2-20260930-154212/`
  (Archiv, SHA-256-Manifest, Referenzdatei). Backup-Restore und SHA-256-Prüfung
  aller drei `SKILL.md`: PASS (externe forensische Prüfung, laut Nutzermeldung).
- Danach enthält `.agents/skills/` nur noch `graphify`.
- Graphify-Konfiguration und -Hooks wurden durch D1/D2 nicht verändert; kein
  Graphify-Update in diesen Paketen. Anwendungscode, Protected Scoring Core und
  Runtime-Autodarts-Artefakte blieben unberührt. Kein Push.

### 5.5 Stand ECC und claude-mem (keine Neuprüfung in D3)

Package D3 ist rein dokumentarisch und hat ECC und claude-mem weder geändert
noch neu geprüft. Maßgeblich bleiben die in den Abschnitten 1–4 dokumentierten,
zuvor verifizierten Ergebnisse (claude-mem als Primary Memory Owner,
deaktivierte ECC-Duplikat-Hooks, reduzierter Agent-Katalog). Alles darüber
hinaus ist **NEEDS RECHECK** nach jedem ECC-/claude-mem-Update.

## 6. Graphify

- **Status:** KEEP. Graphify bleibt Bestandteil des Entwicklungs- und
  Analyse-Setups (Version 0.9.43, zwei Guard-Hooks im Projekt).
- Nach Package C war der Graph veraltet und wurde einmal mit dem normalen
  `graphify update .` (ohne `--force`) neu aufgebaut, nach vorherigem Backup
  von `graphify-out/`. Der neue Graph wurde bei Commit `c34ffbe` gebaut
  (8.570 Knoten, 11.497 Kanten).
- Die entfernten Ruflo-Dateien sind seitdem nicht mehr aktiv im Graph, und
  die vier Dateien des Protected Scoring Core sind weiterhin im Graph
  vorhanden. Es wurden nur Dateien unter `graphify-out/` geändert.
- `graphify-out/` ist Runtime-/Analyseoutput, per `.gitignore` ausgeschlossen
  und kein Anwendungscode.
- Ein Graphify-Update wird nicht automatisch bei jedem Paket ausgeführt,
  sondern nur, wenn es für den Graphzustand erforderlich ist.

## 7. Recovery und Backups

- **Recovery-Tags** sind definierte Wiederherstellungspunkte im Repository,
  kein automatischer Rollback. Für Package C:
  `setup-2.0-pC-pre-ruflo-residue-cleanup-83782f8`, für Package C3:
  `setup-2.0-pC3-pre-ruflo-ignored-cleanup-00027e0`, für Codex-D1:
  `setup-2.0-pD1-pre-codex-stale-skill-archive-ca79698`, für Codex-D2:
  `setup-2.0-pD2-pre-final-codex-skill-archive-5fafa23`, für D3:
  `setup-2.0-pD3-pre-docs-70fd00e`. Weitere Tags folgen dem
  Schema `setup-2.0-pN-pre-<thema>-<sha>`.
- **Externe Backups** liegen außerhalb des Repositories unter
  `~/.claude-mem-backups/` (Verzeichnis mit eingeschränkten Rechten,
  Zeitstempel im Namen, jeweils mit SHA-256-Manifest):
  - Sicherung von `~/.claude/settings.json` vor Package A,
  - Sicherung der claude-mem-Konfiguration,
  - `pkgC-<Zeitstempel>/`: die 50 entfernten Dateien, die 14 ignorierten
    Ruflo-Dateien und die globale `CLAUDE.md`,
  - `pkgC3-<Zeitstempel>/`: die 14 ignorierten Ruflo-Dateien (DB-Sätze mit
    WAL und SHM), Archiv mit SHA-256-Manifest und Restore-Test,
  - `graphify-<Zeitstempel>/`: vollständige Kopie von `graphify-out/`,
  - `pkg-b-<Zeitstempel>/`: `.claude/settings.local.json` vor D1 (ECC),
  - `pkgD1-<Zeitstempel>/`: Archiv der 29 Codex-Skills mit SHA-256-Manifest,
  - `pkgD2-20260930-154212/`: die drei Codex-Skills mit SHA-256-Manifest.
- Wiederherstellung von Dateien aus einem Recovery-Tag erfolgt gezielt pro
  Pfad, nicht per Reset des Repositories.
- `.claude/settings.local.json` und `~/.claude/settings.json` sind nicht
  versioniert. Ihre Wiederherstellung erfolgt aus den externen Backups bzw.
  aus den Referenzen in diesem Dokument.

## 8. OPEN DECISION GATES

Nicht Bestandteil der Pakete A, B/D1, C, C3 und Codex-D1/D2. Keine automatische Ausführung,
jeweils separate Entscheidung erforderlich.

- **A) Ignorierte Ruflo-/Claude-Flow-Reste:** Die 14 ignorierten Dateien in
  `.claude-flow/`, `.swarm/` und `.ruflo/` wurden mit Package C3 entfernt
  (siehe Abschnitt 5.1, erledigt). Weiterhin offen: Im Projekt existieren
  ignorierte Einträge `.ruvector/` und `ruvector.db`; deren Herkunft wurde
  nicht abschließend geprüft, sie waren nicht Bestandteil von C3.
- **B) Codex-Audit – teilweise erledigt, Rest OPEN:** Die Skill-Archivierung
  ist abgeschlossen (Abschnitte 5.3 und 5.4). Weiterhin **OPEN/PENDING**:
  - Read-only-Audit von `.codex/config.toml` und `.codex/hooks.json`,
  - vollständige Klärung der Abhängigkeit der Codex-Hooks von Graphify,
  - Klärung der Codex-Governance gegenüber `CLAUDE.md` / `AGENTS.md`.
- **F) Push:** Die lokale Commit-Kette ist nicht gepusht und benötigt weiterhin
  eine explizite Freigabe. Die Anzahl der lokal vorauslaufenden Commits ist
  bei jedem Push-Vorgang neu zu ermitteln (bei D2-Abschluss: 28, danach
  NEEDS RECHECK).
- **G) ECC-Updates:** Nach jedem ECC-Update Agent-Katalog und Deny-Liste
  (Abschnitt 4) erneut prüfen.
- **C) Dokumentations-Restpunkte:** `CLAUDE.md`,
  `.claude/agents/browser/browser-agent.yaml` und `.claude/commands/github/`
  nur nach separater Prüfung ändern.
- **D) Weitere ECC-Katalogreduktion:** Skills und Commands wurden durch D1
  nicht reduziert. Eine weitere Reduktion nur über einen separat verifizierten,
  unterstützten Mechanismus, ohne ECC-Source-Patch.
- **E) Package B D4** (Beschreibungs-Kappe): separate Entscheidung.
