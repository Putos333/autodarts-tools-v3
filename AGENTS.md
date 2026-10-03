## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Protected scoring core

These files are protected:

- `utils/canonical-match-result.ts`
- `utils/canonical-match-result-storage.ts`
- `utils/event-dedupe.ts`
- `utils/websocket-helpers.ts`
- `components/Settings/PrecisionMap.vue`

Before any change to one of them: STOP. Never modify them automatically. First point out that the change touches the protected scoring core and obtain explicit user approval.

Enforcement (PKG-7, see `docs/PROTECTED_CORE_ENFORCEMENT.md`): edits to these files prompt via `permissions.ask`, and commits/pushes that change them need the trailer `Protected-Core-Approved: <concrete reason>`. The trailer only documents an approval the user gave beforehand. Agents must NEVER write, suggest or add this trailer on their own and must never treat their own judgement as approval; commits touching the protected core are refused inside Claude Code sessions.
