# AUTODARTS ELITE – Setup 2.0: Entwicklungs- und Agent-Setup

Referenzdokument für den verifizierten Konfigurationsstand des Entwicklungs-
und Agent-Setups (Package A, Package B / D1, Package C / C3, Codex-Audit,
Codex-Skill-Archivierung D1/D2, Codex-Audit D4, Codex-Config-Cleanup D5,
Governance-Audit D6, AGENTS.md-Schutzregel D7, Graphify). Es dient
als Recovery-, Wartungs- und Konfigurationsreferenz.

- Stand der Verifikation: 2026-09-30 (Abschnitte 1–8); spätere Statusaktualisierung
  2026-10-02 (HEAD `7688352`, Alt-Hash, Gatekeeper, Lifecycle-Fixes) in Abschnitt 9;
  Post-P40-Stand (HEAD `1b65b55`, 2026-10-03) in Abschnitt 10
- Verifizierte Versionen: ECC 2.2.1 (Claude-Code-Plugin, lokal aktiviert),
  Claude Code 2.1.285, claude-mem 13.16.1, Graphify 0.9.43,
  Codex CLI 0.153.4 (in D4 read-only festgestellt)
- Spätere Statusaktualisierung (D8): Die Abschnitte 5.2 bis 5.8 und 8
  berücksichtigen die Pakete D4 bis D7 (Repository-Stand `e4c17ad`). Die
  Angabe „Repository-Stand bei Erstellung“ unten bleibt der historische Stand.
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
**Überholt (Stand 2026-10-03):** Dieser Absatz beschreibt den Stand vom 2026-09-30. Seit Phase 2B-1
(2026-10-01) gilt projektlokal bewusst `ECC_HOOK_PROFILE=minimal`; siehe Abschnitt 11.

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

**Nicht angewendet:** ECC-D4 (Kappe für Beschreibungslängen,
`skillListingMaxDescChars`; nicht zu verwechseln mit dem späteren
Setup-Paket D4, dem Codex-Audit, Abschnitt 5.2). Skills und Commands wurden durch D1 nicht
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
  (50/50) und `yarn test:components` (82/82) erfolgreich (HISTORICAL_VERIFIED_NOT_RERUN_ON_1b65b55); ECC und claude-mem
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
- `.codex/hooks.json` ist getrackt und enthält Graphify-Guard-Hooks
  (`hook-guard search` / `hook-guard read --strict`) sowie einen
  `SessionStart`-Hook auf `.codex/hooks/session-start.sh`.
- **Spätere Statusaktualisierung (Package D4, read-only, Repository-Stand
  `f6cadf8`):** `.codex/config.toml`, `.codex/hooks.json`,
  `.codex/hooks/session-start.sh` und `AGENTS.md` wurden nach D2 gezielt
  auditiert. Der frühere Vermerk „nicht abschließend auditiert“ ist damit
  überholt. Das Paket änderte nichts am Repository.
  - **VERIFIED:** `hooks.json` definiert drei Hooks (PreToolUse
    `Bash|Grep` → `graphify hook-guard search`, PreToolUse `Read|Glob` →
    `graphify hook-guard read --strict`, SessionStart →
    `.codex/hooks/session-start.sh`); alle Ziele existieren. JSON, TOML und
    Shell-Syntax sind gültig. `session-start.sh` liest nur Git-Metadaten und
    ist byte-identisch mit `.claude/hooks/session-start.sh`. `hook-guard`
    ist laut Quelltext ein Hinweis-Guard, der bei Fehlern nicht blockiert.
    `config.toml` enthielt `mcp_servers.vite` (URL auf `localhost:5173`) und
    `shell_environment_policy.inherit = "core"`; `wxt.config.ts` nutzt
    `ViteMcp()`. Das `SKILL.md` und die `references/` des Projekt-Graphify-
    Skills sind identisch mit dem benutzerweiten Graphify-Skill (SHA-256).
  - **UNKNOWN / NEEDS RECHECK (durch D4 nicht bewiesen):** ob Codex die
    Projekt-Hooks tatsächlich ausführt (in `~/.codex/config.toml` existieren
    Trust-Einträge für die beiden PreToolUse-Hooks, nicht für den
    SessionStart-Hook; das Verhalten ohne Eintrag ist ungeklärt); ob
    `--strict` mit den Codex-Toolnamen wirkt; Graphify-Abhängigkeit im realen
    Codex-Laufzeitkontext (nach Quelltext optional); Vorrang zwischen
    Projekt- und benutzerweitem Graphify-Skill; Runtime-Erreichbarkeit des
    Vite-MCP (Port 5173 lauschte bei der Prüfung nicht; Pfad `/__mcp/sse`
    nicht gegen die Plugin-Doku geprüft); ob die in D5 entfernten Variablen
    außerhalb des Repositories gelesen wurden.
- Die weitere Codex-Governance ist teilweise beantwortet (D6/D7, unten),
  der Rest bleibt **OPEN** (Abschnitt 8).

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

### 5.6 Package D5 (Codex) – veraltete Umgebungsvariablen entfernt

- **Ergebnis:** PASS. Aus `.codex/config.toml` wurden ausschließlich die drei
  im D4-Audit als veraltet belegten Variablen entfernt, ohne Verbraucher im
  getrackten Repository:
  - `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`
  - `CLAUDE_FLOW_V3_ENABLED`
  - `CLAUDE_FLOW_HOOKS_ENABLED`
  Damit war die Tabelle `[shell_environment_policy.set]` leer; ihre
  Kopfzeile und die Leerzeile davor wurden mit entfernt (5 gelöschte Zeilen).
- **Erhalten und unverändert:** `mcp_servers.vite` (URL) und
  `shell_environment_policy.inherit = "core"`. Keine weitere
  Codex-Konfigurationsänderung; `hooks.json` und `session-start.sh` blieben
  unberührt. Die Datei ist danach gültiges TOML.
- **Commit:** `eb761cbc11304a3285073349098b09ca8ce24230`
  (`AUTODARTS ELITE Setup 2.0 D5: remove stale Codex environment flags`)
- **Recovery-Tag:** `setup-2.0-pD5-pre-codex-config-cleanup-f6cadf8`.
  Ein externes Backup war nicht nötig (Datei getrackt). Kein Push.
- **UNKNOWN:** ob die Variablen außerhalb des Repositories gelesen wurden.
  Rückgängig machen: `git revert eb761cb`.

### 5.7 Package D6 – Governance-Audit (read-only)

- Der Schutz des Protected Scoring Core war in `CLAUDE.md` vorhanden. Er
  ist dokumentarisch; im Projekt wurde keine technische Erzwingung
  (Deny-Regel, Hook oder CI-Prüfung) gefunden.
- `AGENTS.md` enthielt damals nur die Graphify-Regel. Die Governance-Lücke
  für Codex wurde festgestellt.
- D6 war rein lesend und erzeugte **keinen Commit** und keine
  Repository-Änderung.

### 5.8 Package D7 – Schutzregel in `AGENTS.md`

- **Ergebnis:** PASS. Die Governance-Lücke in `AGENTS.md` wurde durch einen
  neuen Abschnitt „Protected scoring core“ unterhalb des Graphify-Blocks
  geschlossen (11 hinzugefügte Zeilen). Inhalt: vor jeder Änderung an einer
  der vier Dateien STOP, nie automatisch ändern, zuerst darauf hinweisen und
  ausdrückliche Freigabe einholen.
- **Geschützte Pfade:**
  - `utils/canonical-match-result.ts`
  - `utils/canonical-match-result-storage.ts`
  - `utils/event-dedupe.ts`
  - `utils/websocket-helpers.ts`
- Die Graphify-Regel blieb unverändert; `CLAUDE.md`, Codex-Konfiguration,
  Hooks, Anwendungscode und die vier geschützten Dateien selbst blieben
  unberührt.
- **Commit:** `e4c17adb9b207d5493a77455683fadd910c1e2ba`
  (`AUTODARTS ELITE Setup 2.0 D7: protect scoring core for Codex`)
- **Recovery-Tag:** `setup-2.0-pD7-pre-agents-protected-core-eb761cb`. Kein
  Push.
- **Grenze:** Die Regel ist dokumentarisch. Dass Codex `AGENTS.md` in diesem
  Setup tatsächlich lädt, ist lokal nicht bewiesen (UNKNOWN). Eine
  technische Erzwingung existiert weiterhin nicht (Abschnitt 8).

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
  `setup-2.0-pD3-pre-docs-70fd00e`, für D5:
  `setup-2.0-pD5-pre-codex-config-cleanup-f6cadf8`, für D7:
  `setup-2.0-pD7-pre-agents-protected-core-eb761cb`, für D8:
  `setup-2.0-pD8-pre-docs-e4c17ad`. Weitere Tags folgen dem
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

Nicht Bestandteil der Pakete A, B/D1, C, C3, Codex-D1/D2 sowie D3 bis D8.
Keine automatische Ausführung, jeweils separate Entscheidung erforderlich.

- **A) Ignorierte Ruflo-/Claude-Flow-Reste:** Die 14 ignorierten Dateien in
  `.claude-flow/`, `.swarm/` und `.ruflo/` wurden mit Package C3 entfernt
  (siehe Abschnitt 5.1, erledigt). Weiterhin offen: Im Projekt existieren
  ignorierte Einträge `.ruvector/` und `ruvector.db`; deren Herkunft wurde
  nicht abschließend geprüft, sie waren nicht Bestandteil von C3.
- **B) Codex – teilweise erledigt, Rest OPEN/UNKNOWN:** Die
  Skill-Archivierung (Abschnitte 5.3 und 5.4), das read-only Audit von
  `config.toml` und `hooks.json` (D4, Abschnitt 5.2), der Config-Cleanup (D5)
  und die Schutzregel in `AGENTS.md` (D7) sind abgeschlossen. Weiterhin
  **OPEN/UNKNOWN**:
  - tatsächliche Ausführung der Codex-Hooks und deren Trust-Status (kein
    Trust-Eintrag für den SessionStart-Hook gefunden; Verhalten ungeklärt),
  - Wirkung von `hook-guard read --strict` mit den Codex-Toolnamen,
  - Graphify-Abhängigkeit im realen Codex-Laufzeitkontext (nach Quelltext
    optional, nicht im Betrieb geprüft),
  - Vorrang zwischen Projekt- und benutzerweitem Graphify-Skill (Inhalt
    identisch, Auswahlverhalten nicht bewiesen); der benutzerweite
    `~/.codex/AGENTS.md` verweist außerdem auf den nicht existierenden Pfad
    `~/.Codex/skills/graphify/SKILL.md` (außerhalb des Repositories, nicht
    geändert),
  - Runtime-Erreichbarkeit des Vite-MCP (EXTERNAL: laufender Dev-Server
    nötig),
  - ob Codex `AGENTS.md` tatsächlich lädt (lokal nicht bewiesen).
- **H) Technische Erzwingung des Protected Scoring Core:** Der Schutz besteht
  in `CLAUDE.md` und `AGENTS.md` nur dokumentarisch. Eine technische
  Erzwingung (z. B. Deny-Regel oder Prüfung vor dem Commit) existiert nicht
  und wäre eine separate Entscheidung.
- **I) Portabilität von `.codex/hooks.json`:** Die Datei enthält absolute,
  private Pfade. Keine Entscheidung getroffen.
- **F) Push:** (HISTORICAL; erledigt, siehe Abschnitt 10: gepusht, `origin/main` = `1b65b55`.) Die lokale Commit-Kette war nicht gepusht und benötigte
  eine explizite Freigabe. Zuletzt festgestellt (D8-Audit, Stand `e4c17ad`):
  31 Commits vor der lokal gespeicherten Referenz `origin/main`, ohne Fetch.
  Der tatsächliche Stand des Remotes ist UNKNOWN/EXTERNAL; die Anzahl ist bei
  jedem Push-Vorgang neu zu ermitteln.
- **G) ECC-Updates:** Nach jedem ECC-Update Agent-Katalog und Deny-Liste
  (Abschnitt 4) erneut prüfen.
- **C) Dokumentations-Restpunkte:** `CLAUDE.md`,
  `.claude/agents/browser/browser-agent.yaml` und `.claude/commands/github/`
  nur nach separater Prüfung ändern.
- **D) Weitere ECC-Katalogreduktion:** Skills und Commands wurden durch D1
  nicht reduziert. Eine weitere Reduktion nur über einen separat verifizierten,
  unterstützten Mechanismus, ohne ECC-Source-Patch.
- **E) ECC-D4 / Package B D4** (Beschreibungs-Kappe; nicht das Setup-Paket
  D4 aus Abschnitt 5.2): separate Entscheidung.

## 9. SETUP 2.0 / GATEKEEPER / LIFECYCLE – VERIFIZIERTER STAND (2026-10-02, HEAD `7688352`)

Die Abschnitte 1–8 bleiben als Recovery-Nachweis (Stand `e4c17ad`/D8) erhalten;
Abschnitt 8 (Push: 31 Commits voraus) ist durch diese Aktualisierung überholt
(inzwischen 34).

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

## 10. POST-P40 STATUS-RECONCILIATION (2026-10-03, HEAD `1b65b55`)

Nachtrag; die Abschnitte 1–9 bleiben als historischer Nachweis erhalten. Wo sie „Push nicht erfolgt",
„31/34 Commits voraus", „CI nicht erfolgt" oder Alt-Hashes nennen, gilt dieser Abschnitt. Vollständige
Tabellen und Hash-Mapping: `MASTER_AUTODARTS_ELITE.md` Abschnitt 21. Keine Code- oder Konfigurationsänderung.

**CURRENT_VERIFIED (HEAD `1b65b554717361e8c7901bf11cbcf89e24a8a5a7`):**
- HEAD = `origin/main`, 0/0 (gepusht); P40 IMPLEMENTED · PUSHED · POST_PUSH_VERIFIED · ORIGIN_MAIN_SYNCHRONIZED
  (P40 `79a5034`, P41-Doku `8d79d04`, Consent-Host-Bindung `1b65b55`; Post-Push-Verifikation: Operator-Angabe).
- GitHub-CI `pr-control-center` auf `main`, Run 37133647668, `headSha` = `1b65b55`: `success`.
- `node scripts/core-guard.mjs range origin/main..HEAD`: Exit 0; `core.hooksPath = scripts/githooks`.
- Remote-Tags: 0 (die Recovery-Tags aus Abschnitt 7 existieren nur lokal); `main` ohne Branch-Protection (HTTP 404).

**HISTORICAL_VERIFIED_NOT_RERUN_ON_1b65b55:** Gate 8/8 (Alt-Stand `fa9b9f3` + `7688352`), `yarn test` 531/531, Components 90/90,
Firefox-/Chrome-Build, `vue-tsc`, Package-C-Teststände (501/501, 50/50, 82/82).

**History-Rewrite:** Die in den Abschnitten 5–9 genannten Hashes (u. a. `c34ffbe`, `5fafa23`, `70fd00e`, `eb761cb`, `e4c17ad`, `ea35d57`,
`fa9b9f3`, `7688352`, `e618c34`, `9158b35`) sind keine Vorfahren von `1b65b55`. Neue Hashes: `9979bda`, `fb835fa`, `638f3a5`, `018c216`,
`ca5f597`, `4fca81a`, `a7ceb2e`, `12279ff`, `1090aba`, `9826231` (Zuordnung über den Commit-Betreff, INFERRED).
Recovery-Tags behalten den Alt-Hash im Namen, zeigen aber auf Commits der neuen Historie; Tag-Namen sind keine Hash-Belege.

**OPEN:** CURRENT-HEAD RE-VERIFICATION; TEMP-DIAG (5 Non-Core-Stellen); MCP-Konsolidierung; Branch-Protection; Codex-Laufzeitverhalten
(Abschnitt 8-B, weiter UNKNOWN); lokale Änderung `.codex/config.toml`; untracked `.claude/settings.local.json.bak-20260930T234259`.
**BLOCKED:** TEMP-DIAG-Core-Block (nur mit ausdrücklicher Freigabe); Release-Gate (Human Live QA, Hardware); `p345.sh` (darf nicht ausgeführt werden).

**OPEN_DECISION – Autor-Identität:** 121 Commits tragen `du@example.com` und sind gepusht. Die in Abschnitt 9 verlangte Entscheidung vor dem
Push wurde nicht dokumentiert. Eine Änderung bräuchte einen Rewrite und einen Force-Push; nichts geändert, `git config` unverändert.

**Nachtrag 2026-10-03 (Re-Verifikation, HEAD `9f859ef` = `1b65b55` + Doku-Commit):** CURRENT_VERIFIED unter Node v22.23.2, jeweils Exit 0:
`yarn compile` PASS; `yarn test` 596/596 (82 Suiten); `yarn test:components` 97/97 (13 Dateien); `yarn wxt build -b firefox` PASS; `yarn wxt build` PASS;
`core-guard range origin/main..HEAD` Exit 0. Setup-Gate NOT RUN (kein Gate-Paket für DOCS_ONLY-HEAD). Die Angaben
`HISTORICAL_VERIFIED_NOT_RERUN_ON_1b65b55` oben beschreiben den Stand vor diesem Lauf und bleiben als **HISTORICAL_VERIFIED** erhalten;
„CURRENT-HEAD RE-VERIFICATION" unter OPEN ist erledigt.

## 11. TOOL-ROUTING UND ECC-PROFIL: VERIFIZIERTER REALZUSTAND (2026-10-03, HEAD `fc6e809`)

Nachtrag aus den Prüfungen E3.1–E3.3. Er beschreibt den Ist-Zustand, ändert keine Konfiguration und überholt die
Aussagen in Abschnitt 2 (Profil `standard`) und in der früheren `CLAUDE.md`-Routing-Tabelle (GitHub-MCP primär). Die
gleichen Angaben stehen kompakt in `CLAUDE.md` („Verified tool status"). Evidenz: lokal gelesene Konfiguration bzw. lokal
berechnet (ECC `hook-flags.js`); „nicht aufgerufen" heißt: Vorhandensein bestätigt, Funktion nicht ausgeführt.

### 11.1 ECC-Hook-Profil: bewusste Projektentscheidung

- **Einstellung:** `env.ECC_HOOK_PROFILE = "minimal"` in `.claude/settings.local.json` (projektlokal, nicht versioniert).
  Die Umgebungsvariable hat Vorrang vor der Plugin-Option `hook_profile` (User-Ebene `standard`); ohne Variable gilt `standard`.
- **Einführung:** Phase 2B-1, 2026-10-01 („ECC HOOK REDUCTION"), laut Session-Transkripten damals geprüft und mit PASS vermerkt.
  Die Messergebnisse dieser Phase sind nicht im Repository dokumentiert (UNKNOWN). Entscheidung des Nutzers (E3.3A, 2026-10-03):
  `minimal` bewusst beibehalten, kein Rückbau auf Grundlage älterer Dokumentation.
- **Einordnung:** `standard` ist das stärkere Hook-Profil. `minimal` ist eine bewusst vermessene Projektentscheidung, kein generell
  sichereres Profil.
- **Unter `minimal` nicht aktiv** (berechnet für ECC 2.2.1): GateGuard (`pre:bash:gateguard-fact-force`,
  `pre:edit-write:gateguard-fact-force`), `pre:config-protection`, `pre:governance-capture`, `pre:mcp-health-check`,
  `post:quality-gate` und die übrigen nur für `standard`/`strict` freigegebenen Komfort- und Qualitätshooks.
  **Weiter aktiv:** `pre:bash:block-no-verify`, der Bash-Dispatcher. Zusätzlich sind die 7 Hooks aus Abschnitt 2 per
  `ECC_DISABLED_HOOKS` (User-Ebene) abgeschaltet.
- **Ersatzschutzschichten** (ersetzen GateGuards Faktenzwang vor Edits nicht): `block-no-verify`; projektlokaler Hook
  `destructive-guard.sh` (PreToolUse/Bash, Exit 2 blockt); `permissions.ask` + `disableBypassPermissionsMode` für die 5 Core-Dateien
  (`docs/PROTECTED_CORE_ENFORCEMENT.md`); Git-Hooks `commit-msg`/`pre-push` mit `scripts/core-guard.mjs`
  (`core.hooksPath=scripts/githooks`); 46 `Agent(ecc:…)`-Deny-Regeln; Validation-Gate; Truth & Verification Contract in `CLAUDE.md`.
- **Weitere projektlokale Einstellungen** in `.claude/settings.local.json` (bisher hier nicht beschrieben): Plugins `hookify`, `playwright`,
  `github`, `context7`, `security-guidance`, `claude-mem` auf `false`; `ecc@ecc` aktiv. Diese Plugin-Disables beeinflussen die ECC-Hooks nicht.
- **Hinweis:** Dieselbe Variable steht auch in der lokalen, nicht committeten `.codex/config.toml` (OPEN: Entscheidung dazu).

### 11.2 Werkzeugstatus und Routing

| Werkzeug | Verifizierter Status |
|---|---|
| `gh` CLI | INSTALLED (2.45.0), angemeldet; Hauptweg für GitHub-Aufgaben |
| GitHub-MCP/Plugin | INSTALLED (User), projektlokal DISABLED; liest `GITHUB_PERSONAL_ACCESS_TOKEN` (in der Shell nicht gesetzt); optional, keine Voraussetzung, keine Aktivierung verlangt |
| Playwright npm-Paket | NOT FOUND (weder `package.json` noch `node_modules`, keine Konfiguration) |
| Playwright CLI | NOT FOUND |
| Playwright Skills | NOT FOUND (nur gstack-interne Dateien) |
| Playwright MCP (Plugin) | INSTALLED (User, `@playwright/mcp@latest`, ungepinnt), projektlokal DISABLED; on demand/optional, nicht aktiviert |
| Context7 Plugin | INSTALLED (User), projektlokal DISABLED |
| Context7 Zugang | claude.ai-Connector in Sessions vorhanden (`mcp__claude_ai_Context7__*`, nicht aufgerufen); Codex hat eigenen Eintrag |
| Chrome DevTools MCP | konfiguriert in `~/.claude.json` (Projekt, stdio, `chrome-devtools-mcp@1.8.0`); ECC-Duplikat (`@latest`) per `disabledMcpServers` aus; nicht aufgerufen |

Routing-Prinzip: lokale Repo-Arbeit mit lokalen Repo-Werkzeugen; GitHub über `gh`; Browser/UI-QA über die vorhandenen Playwright-/Chrome-DevTools-Wege
nach Bedarf; Library/API-Doku über Context7/Connector nach Verfügbarkeit; optionale MCPs nur bei konkretem Bedarf aktivieren; keine
redundanten dauerhaft aktiven Werkzeuge ohne belegten Nutzen.

### 11.3 Bewusst nicht bereinigt (niedrige Priorität, getrennt zu behandeln)

- Veraltete `mcp__github__*`-Allow-Regeln in `~/.claude/settings.local.json` (alte Namensform, wirkungslos).
- graphify-Hook-Text („MANDATORY: run graphify query") widerspricht der Regel „graphify nur bei Beziehungsfragen".
- Weitere E3.1-Befunde bleiben offen: Node-Default v24 vs. `.nvmrc` v22.23.2, der Codex-Sollstand „0.153.3" (nirgends belegt; dokumentiert ist 0.153.4),
  zwei Alt-Worktrees ohne exklusive Commits, lokale `.codex/config.toml`-Änderung.
