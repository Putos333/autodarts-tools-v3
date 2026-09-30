# Codex variants of stale Ruflo / swarm / agentdb skills

Archived in Setup 2.0 Package D1 (2026-09-30). These 29 skills were moved out of
`.agents/skills/<name>/` (the Codex skill directory of this repository).
Nothing was deleted; git history is preserved (`git mv`).

Why they are archived: they only describe claude-flow / ruflo / swarm / agentdb
tooling that is no longer part of this project (Ruflo residue was removed in
Setup 2.0 Package C and C3). Their commands point at a package name that does
not exist (`npx @Codex-flow/cli@latest`, the result of a text rename from
"claude" to "Codex"), at `npx ruflo@alpha` / `npx ruv-swarm`, or at agents and
code (for example `v3-memory-specialist`, `v3/`) that are not present.
No configuration, hook, script, workflow or code in the repository referenced them.

Layout: `.agents/skills/<name>/SKILL.md` became
`.claude/scaffold-archive/skills/codex/<name>/SKILL.md`. The sibling folders in
`skills/` hold the earlier Claude variants (a few are byte-identical, for example
`agentdb-advanced`, `agentdb-learning`, `agentdb-optimization`,
`reasoningbank-intelligence`, `swarm-orchestration`, `v3-memory-unification`).

Restore one skill for Codex:

```bash
git mv .claude/scaffold-archive/skills/codex/<name> .agents/skills/<name>
```

Recovery points: git tag `setup-2.0-pD1-pre-codex-stale-skill-archive-ca79698`
(state before the move) and an external backup under
`~/.claude-mem-backups/pkgD1-<timestamp>/` (tar.gz with SHA-256 manifest).

Not part of this archive: `.agents/skills/graphify` (kept, Graphify integration)
and the three generic skills `pair-programming`, `skill-builder`,
`v3-security-overhaul` (still in `.agents/skills/`, decision pending).
