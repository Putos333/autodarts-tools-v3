## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Tool-Routing (AUTODARTS ELITE)

Verified working toolchain (2026-08-28, see PRE_LIVE_SNAPSHOT.md / POST_LIVE_DIAGNOSTIC_MATRIX.md for the audit trail). Pick the single best tool per task — don't cascade through multiple tools when one suffices.

| Task | Tool |
|---|---|
| Codebase/symbol search | Read/Grep/Glob + TypeScript LSP (`.ts` only — no `.vue` support) |
| Architecture/relationships | graphify — only when structural relationships actually matter, not for simple lookups |
| Implementation | native Edit/Write, only the files actually required |
| Unit/regression tests | project test runner (`yarn test`, `yarn test:lifecycle`) |
| Firefox extension | existing `yarn build:firefox` + `web-ext` (global install) for lint/runtime when needed |
| Chrome live debug | Chrome DevTools MCP |
| Browser automation | Playwright — only for real automated interaction/regression, not for simple checks |
| GitHub | official GitHub MCP (`plugin:github:github`) primary; `gh` CLI only as fallback for operations the MCP doesn't cover |
| Code review | `code-review` skill after relevant implementation changes |
| Specialized review | `pr-review-toolkit:*` (code-reviewer, silent-failure-hunter) only when warranted |
| Security | `security-guidance`/`security-review` only for security-relevant changes |
| Parallel investigation | native `fork`/subagents only for genuinely independent sub-tasks |

**Not standard tools right now:**
- **Ruflo/Claude-Flow**: optional/deaktiviert — confirmed upstream package defect (`ERR_MODULE_NOT_FOUND` on MCP start). Do not repair/reinstall without a new upstream release. Use native `fork` for parallelization instead.
- **OmniRoute**: not activated — no running server, no verified provider health, direct Anthropic connection works. Don't activate without explicit instruction.
- **`.claude/agents/browser/browser-agent.yaml`**: non-functional — references a `browser/*` tool family that was never connected in this environment. Use Chrome DevTools MCP / Playwright / `web-ext` directly instead.

## Agent Mapping

| Role | Agent |
|---|---|
| MAIN | main session itself — orchestration, implementation, decisions |
| BUG-TRIAGE | native `fork` (reproduce/root-cause) or `Explore` (read-only search) |
| CODE-REVIEW | `pr-review-toolkit:code-reviewer` + `pr-review-toolkit:silent-failure-hunter` (regressions, lifecycle, race conditions, side effects) |
| TEST/VALIDATION | `.claude/agents/testing/production-validator.md` |
| BROWSER/RUNTIME | no dedicated agent — call Chrome DevTools MCP / Playwright / `web-ext` directly from MAIN |

Don't create new agents for roles already covered above.

## Token-/Context-Efficiency

- Reuse existing audit/diagnostic docs (PRE_LIVE_SNAPSHOT.md, POST_LIVE_DIAGNOSTIC_MATRIX.md) instead of re-analyzing already-checked areas without a concrete reason
- Search/segment large files first (Grep, LSP `documentSymbol`) instead of loading them whole
- Give subagents only the minimal context needed for their sub-task; have them return compact results (file+line, finding, impact/risk), not raw dumps
- No repeated project summaries or long status reports during work
- No repeated code review without a new change since the last one
- Targeted tests first, then relevant regression; full regression only at defined gates (before commit, after a fix series)
- Don't regenerate already-verified results without cause

Quality and reproducibility still outrank token-saving.

## Post-Live Bug Workflow

OBSERVATION → POST_LIVE_DIAGNOSTIC_MATRIX.md → REPRODUCE → ROOT CAUSE → IMPACT/RISK → MINIMAL FIX → TARGETED TEST → RELEVANT REGRESSION → TYPECHECK → BUILD (if affected) → CODE REVIEW → RUNTIME RETEST (if useful)

**Protected scoring core** (`utils/canonical-match-result.ts`, `utils/canonical-match-result-storage.ts`, `utils/event-dedupe.ts`, `utils/websocket-helpers.ts`): STOP before any change and report the finding — never modify automatically.

Push only after explicit user approval — never automatic.

## Truth & Verification Contract v1.0

Gilt für jede Arbeit an diesem Projekt. Ergänzt die Regeln oben, ersetzt sie nicht.

**Setup-Check vor jeder Bauphase** (kleinstes Setup, das die Aufgabe zuverlässig löst; nicht möglichst viele Agents/MCPs): zuerst ausgeben, dann erst arbeiten:
`SETUP CHECK` → TASK / LEAD AGENT / SUPPORTING AGENTS / SKILLS / MCPs / TOOLS / TEST/QA / REASON

1. **Wahrheit vor Zustimmung**: technisch falsche oder unbelegte Annahmen ausdrücklich benennen und begründen.
2. **Nie unausgeführte Ergebnisse behaupten** (Test, Build, Command, MCP/API-Aufruf, Browser-Test, Git-Vorgang, Agent, Hook, Deployment). Nicht ausgeführt = `NOT VERIFIED`, nie PASS.
3. **PASS nur mit Evidenz**: Build = ausgeführt + Exit-Code 0; Tests = ausgeführt + Ergebnis geprüft; MCP = Verbindung UND Funktion getestet ("connected" allein reicht nicht); Fix = Fehler reproduziert/verstanden, Fix angewendet, gezielt erneut getestet. Keine extrapolierten PASS.
4. **Evidenzklassen**: VERIFIED (Datei/Command/Test/Tool/API direkt bestätigt) · INFERRED (Schluss aus Verifiziertem, nie als VERIFIED darstellen) · UNKNOWN · BLOCKED. Bei wichtigen Aussagen Unsicherheit offenlegen und benennen, was zur Verifikation fehlt.
5. **Nichts erfinden**: Dateien, Branches, Commits, Funktionen, APIs, Dependencies, Tests, Agents, Skills, MCPs, Configs, Logs, Versionen, URLs, Issues, Releases. Unbekanntes zuerst untersuchen; prüfbare Fakten prüfen statt raten (Projektzustand > Test/Build > Git-Historie > offizielle Doku > MCP/API > Inferenz). Zeitabhängiges: aktuelle offizielle Doku.
6. **Inspect before modifying**: relevante Dateien lesen, Architektur/Abhängigkeiten/Tests/Risiken bestimmen. Keine Blind-Patches.
7. **Konflikte** (Tests, Agents, Doku vs. Runtime, MCP vs. lokale Dateien): CONFLICT → INVESTIGATE → PRIMARY EVIDENCE → RESOLVE → VERIFY. Nie das gewünschte Ergebnis auswählen.
8. **Fix-Workflow**: REPRODUCE → ROOT CAUSE → MINIMAL FIX → TARGETED RETEST → RELEVANT REGRESSION → FINAL VERIFICATION. Kein Refactoring, wo nicht technisch nötig.
9. **Bestehende Arbeit schützen**: nie ungeprüft löschen/überschreiben/resetten/stashen/committen/verwerfen. Vor riskanten Änderungen `git status`, betroffene Dateien, Backup/Branch bewerten.
10. **Source vs. generiert** (`.output/`, `.wxt/`, `dist/`, `build/`, `coverage/`): vor Dateizahlen TRACKED SOURCE von UNTRACKED GENERATED trennen.
11. **Secrets** (Tokens, PATs, API-Keys, Passwörter, Cookies, Authorization-Header) nie ausgeben oder loggen; Existenz booleschen prüfen; nicht unnötig in Projektdateien speichern.
12. **Abschlussbericht nach einer Bauphase**: IMPLEMENTATION / TARGETED TESTS / REGRESSION / BUILD / RUNTIME QA (je PASS/FAIL/NOT RUN bzw. NOT APPLICABLE) · GIT STATUS (verifiziert) · KNOWN ISSUES · UNVERIFIED · FINAL STATUS (PASS / PASS WITH LIMITATIONS + Einschränkungen / BLOCKED / FAIL).
