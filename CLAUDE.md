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
| Unit/regression tests | project test runner (`yarn test`, `yarn test:lifecycle`, `yarn test:components`); browser E2E see next row |
| Browser E2E (extension) | Playwright test suite (`@playwright/test` 1.62.1, `tests/e2e`, 13 tests incl. 1 visual-regression test). After `yarn wxt build`: `yarn test:e2e` (without `$DISPLAY`: `xvfb-run -a yarn test:e2e`). Runs in CI as job "Playwright E2E". Not a `yarn gate` stage |
| Firefox extension | existing `yarn build:firefox` + `web-ext` (global install) for lint/runtime when needed |
| Chrome live debug | Chrome DevTools MCP (project-scoped, `chrome-devtools-mcp@1.8.0`; see Verified tool status) |
| Browser automation (interactive/agentic) | Playwright MCP — on demand only, not for simple checks. Currently NOT enabled in this project (plugin installed, project-locally disabled). It is separate from the Playwright test suite above (npm package, no MCP needed). Enable only for a concrete need |
| GitHub | `gh` CLI = verified main path (authenticated). GitHub MCP/plugin is installed but project-locally disabled and optional — not a prerequisite; do not demand activation or a token |
| Library/API docs | Context7 via the claude.ai connector if available in the session (the Context7 plugin is installed but project-locally disabled); otherwise official docs. Don't use `ecc:docs-lookup` (broken tool names) |
| Code review | `code-review` skill after relevant implementation changes |
| Specialized review | `pr-review-toolkit:*` (code-reviewer, silent-failure-hunter) only when warranted |
| Security | `security-review` skill only for security-relevant changes (the `security-guidance` plugin is project-locally disabled) |
| Parallel investigation | native `fork`/subagents only for genuinely independent sub-tasks |

**Not standard tools right now:**
- **Ruflo/Claude-Flow**: optional/deaktiviert — confirmed upstream package defect (`ERR_MODULE_NOT_FOUND` on MCP start). Do not repair/reinstall without a new upstream release. Use native `fork` for parallelization instead.
- **OmniRoute**: not activated — no running server, no verified provider health, direct Anthropic connection works. Don't activate without explicit instruction.
- **`.claude/agents/browser/browser-agent.yaml`**: non-functional — references a `browser/*` tool family that was never connected in this environment. Use Chrome DevTools MCP / Playwright / `web-ext` directly instead.

## Verified tool status (E3.2/E3.3, 2026-10-03)

Reality check of the routing table above (Playwright rows and the E2E-CI row updated 2026-10-04). Evidence class: VERIFIED = read from local config/files or computed locally; "not invoked" = presence confirmed, function not called.

| Tool | Status |
|---|---|
| `gh` CLI | INSTALLED (2.45.0), authenticated; used in practice (CI runs, repo queries) |
| GitHub MCP/plugin (`github@claude-plugins-official`) | INSTALLED (user scope); DISABLED in `.claude/settings.local.json`. Its HTTP definition reads `GITHUB_PERSONAL_ACCESS_TOKEN`, which is not set in the shell. Optional; do not activate without explicit instruction |
| Playwright npm package | INSTALLED: `@playwright/test` 1.62.1 (exact devDependency; transitive `playwright` and `playwright-core` 1.62.1), `playwright.config.ts`, suite in `tests/e2e` (commit `5389f1a`, 2026-10-04) |
| Playwright CLI | AVAILABLE via the project (`yarn playwright`, `node_modules/.bin/playwright`); still no global install (only `web-ext` is installed globally) |
| Playwright skills | NOT FOUND (only gstack-internal files mention `playwright-core`) |
| Playwright browser | Playwright-managed Chromium (Chrome for Testing 151.0.7922.34, revision 1234), run headed under Xvfb. The default headless shell does not load the extension; Google Chrome 154 does not load it either (verified). The new headless mode (`channel: "chromium"`) loaded it in a probe but is not adopted |
| E2E in CI | Job "Playwright E2E" in `.github/workflows/pr-control-center.yml` (ubuntu-24.04, Xvfb-headed, `fonts-noto-core`, browser cache), merged via PR #17 (merge commit `92b723e`). Run 37220303579 on main: success, 13 passed. Browser cache was a MISS in the observed runs (PR and main); a cache hit has not been observed. The failure-artifact upload has not been exercised |
| Playwright MCP (`playwright@claude-plugins-official`) | INSTALLED (user scope, `npx @playwright/mcp@latest`, unpinned); DISABLED in this project. On demand/optional, not activated |
| Context7 plugin | INSTALLED (user scope); DISABLED in this project |
| Context7 access | claude.ai connector present in sessions (`mcp__claude_ai_Context7__*`, presence verified, not invoked); Codex has its own `context7` entry in `~/.codex/config.toml` |
| Chrome DevTools MCP | CONFIGURED in `~/.claude.json` for this project (stdio, `chrome-devtools-mcp@1.8.0`); the ECC plugin duplicate (`@latest`) is disabled via `disabledMcpServers`. Tools present in sessions, not invoked. An uncommitted local `.codex/config.toml` entry adds the same server for Codex |

### ECC hook profile (deliberate project decision)

`ECC_HOOK_PROFILE=minimal` (project `.claude/settings.local.json`, not versioned) is the **deliberate current Setup 2.0 decision**, introduced in Phase 2B-1 on 2026-10-01 ("ECC hook reduction") and verified at the time. It is not a rollback candidate based on older documentation. `standard` is the stronger hook profile (ECC default when the variable is unset); `minimal` is a deliberately measured project decision, not a generally safer one.

With `minimal` (verified by evaluating `hook-flags.js` for ECC 2.2.1) these ECC groups are **not active**: GateGuard (Bash and Edit/Write fact-forcing), `config-protection`, `governance-capture`, `mcp-health-check`, and the standard-only quality/convenience hooks (e.g. `post:quality-gate`). Still active: `pre:bash:block-no-verify` and the Bash dispatcher. Additionally, 7 ECC session/observe hooks are disabled user-wide via `ECC_DISABLED_HOOKS` (see `docs/SETUP_2_0_DEV_AGENT_SETUP.md` section 2).

Substitute protection layers (they do not replace GateGuard's fact-forcing): `pre:bash:block-no-verify`; project-local `destructive-guard.sh` (PreToolUse/Bash); `permissions.ask` plus `disableBypassPermissionsMode` for the protected core files; the git hooks `commit-msg`/`pre-push` (`scripts/core-guard.mjs`, `core.hooksPath=scripts/githooks`); 50 `Agent(ecc:…)` deny rules (local-only in the git-ignored `.claude/settings.local.json`); the validation gate; the Truth & Verification Contract below.

### Routing principle

- Local repo work -> local repo tools.
- GitHub -> `gh` (verified main path).
- Browser/UI QA -> automated regression: the Playwright suite (`yarn test:e2e`); debugging: Chrome DevTools MCP; Playwright MCP only as an optional extra; `web-ext` for Firefox.
- Library/API docs -> Context7 connector, depending on availability.
- Optional MCPs only for a concrete need; no redundant permanently-active tools without proven benefit.

### Known low-priority open points (intentionally not changed)

- Stale `mcp__github__*` allow rules in `~/.claude/settings.local.json` (old tool-name form, no effect).
- The graphify hook text ("MANDATORY: run graphify query") conflicts with "graphify only when structural relationships matter".

## Agent Mapping

| Role | Agent |
|---|---|
| MAIN | main session itself — orchestration, implementation, decisions |
| BUG-TRIAGE | native `fork` (reproduce/root-cause) or `Explore` (read-only search) |
| CODE-REVIEW | normal review: `code-review` skill (primary). Special cases: `pr-review-toolkit:code-reviewer` + `pr-review-toolkit:silent-failure-hunter` (regressions, lifecycle, race conditions, side effects). ECC/Codex review functions are not automatic competing primaries (`ecc:typescript-reviewer`, `ecc:vue-reviewer` are denied locally) |
| TEST/VALIDATION | `.claude/agents/testing/production-validator.md` |
| BROWSER/RUNTIME | no dedicated agent — call Chrome DevTools MCP / `web-ext` directly from MAIN; automated E2E via `yarn test:e2e` (Playwright suite) |

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

**Protected scoring core** (`utils/canonical-match-result.ts`, `utils/canonical-match-result-storage.ts`, `utils/event-dedupe.ts`, `utils/websocket-helpers.ts`, `components/Settings/PrecisionMap.vue`): STOP before any change and report the finding — never modify automatically. Enforcement: `permissions.ask` on these paths plus the git trailer guard (`Protected-Core-Approved: <concrete reason>`, see `docs/PROTECTED_CORE_ENFORCEMENT.md`). Agents must never write or propose that trailer on their own; it only documents a prior explicit user approval.

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
