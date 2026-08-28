# Claude-flow / ruflo scaffold archive

Created: 2026-08-26, as part of the "Autodarts Elite lean tooling optimization" pass.

Everything here was moved out of `.claude/skills/`, `.claude/agents/`, and
`.claude/commands/` because it is generic claude-flow orchestration scaffold
(SPARC methodology, swarm/consensus coordination, agentdb/reasoningbank
memory layers, meta skill-building) rather than anything specific to
developing Autodarts Elite / autodarts-tools-v3. Nothing was deleted.

Full untouched backups (tar.gz of the original directories, plus every
config file touched) live in:
`/home/arnonym2302/.claude-lean-backups/20260826-051810/`

## To bring any one piece back

```bash
# a skill
mv .claude/scaffold-archive/skills/<name> .claude/skills/<name>

# an agent group
mv .claude/scaffold-archive/agents/<name> .claude/agents/<name>

# a command group or file
mv .claude/scaffold-archive/commands/<name> .claude/commands/<name>
```

The `mcp__claude-flow__*` / `ruflo` MCP server itself was left fully
installed and configured (see `.mcp.json`, `autoStart: false`) — swarm,
SPARC, and consensus workflows still work on demand, they just no longer
sit permanently in the skill/agent/command listing.

## What was archived

**Skills (19):** sparc-methodology, agentdb-memory-patterns, v3-security-overhaul,
agentdb-optimization, skill-builder, reasoningbank-intelligence, agentdb-advanced,
browser, stream-chain, verification-quality, v3-swarm-coordination,
v3-memory-unification, hooks-automation, swarm-advanced, agentdb-vector-search,
agentdb-learning, reasoningbank-agentdb, swarm-orchestration, github-code-review
(duplicate of the code-review plugin — see below).

**Agents (3 groups / 14 files):** sparc, consensus, swarm.

**Commands (12 groups + 3 files / 129 files):** agents, analysis, automation,
coordination, hive-mind, hooks, memory, monitoring, optimization, sparc, swarm,
workflows, claude-flow-swarm.md, claude-flow-memory.md, claude-flow-help.md.

## What was kept active (and why)

- `github-release-management`, `github-workflow-automation`,
  `github-project-management`, `github-multi-repo` skills, and the
  `commands/github/` group (19 commands) — this project ships real GitHub
  Actions releases (App Store / browser-store artifacts), so these are
  live workflow tooling, not scaffold.
- `v3-mcp-optimization`, `v3-core-implementation`, `v3-cli-modernization`,
  `v3-performance-optimization`, `v3-integration-deep`, `v3-ddd-architecture`
  — named after this project's own v3 migration; plausibly in active use.
- `pair-programming` — general dev-collaboration skill, low overhead.
- `graphify` — explicitly required to stay active.
- `agents/core`, `agents/browser`, `agents/testing` — general-purpose,
  browser-automation, and testing agents; kept for on-demand real
  browser/runtime test support alongside Playwright/chrome-devtools.

This split is a judgment call, not a certainty — if any archived skill turns
out to be part of your regular workflow, just move it back; it costs nothing
and nothing was deleted.
