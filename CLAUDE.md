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
