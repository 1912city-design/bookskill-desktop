# feat(graph): add knowledge-library interactive graph

**Risk: medium**

## Summary

Adds an interactive knowledge graph inside the existing 知识库 view, backed by the already-merged GRAPH-001 public API. Nodes and edges for the three locked distillations are grouped by book (including a life-graph summary). Clicking a node jumps to the corresponding passage when the locator is a confirmed fixture substring; otherwise the UI marks `来源定位未确认` and does not invent a precise locator. No sixth top-level nav item is added. `DEFAULT_ROUTE_ID` remains `chat`.

Desktop main process calls `buildKnowledgeGraph`, `loadKnowledgeGraph`, `saveKnowledgeGraph`, and `knowledgeGraphPath` from `@bookskill/core`. This PR does not rewrite `packages/core/src/graph/**`. New renderer graph code does not value-import the core barrel. Council IPC/bridge methods already on `integration` are preserved; graph keys are appended only.

Base: `integration` @ `b6ff0ea0bcc024371341ea782eb06bee93cb9d44`. Do not merge until independent QA passes. Do not retarget `main`.

## Acceptance checklist

- [x] Graph view opens inside the knowledge library with stable testids (`library-graph`, node, edge, book group, life, locate, unconfirmed, error)
- [x] Combined nodes and edges for the three locked books are visible
- [x] Clicking a node jumps to a fixture-substring passage or clearly marks `来源定位未确认`
- [x] Aggregation by book is visible (life-graph and by-book grouping)
- [x] After adding a fourth validated distillation, the graph updates
- [x] `DEFAULT_ROUTE_ID` is still `chat`; still five routes
- [x] `pnpm --filter @bookskill/core test` and `pnpm --filter @bookskill/desktop test` (includes `tsc --noEmit`) exit 0
- [ ] Independent QA (not this PR author's self-test)

## Test commands and results

Node v24.22.1, pnpm 10.34.6. Times are Asia/Shanghai (CST, UTC+8).

```bash
pnpm --filter @bookskill/core test
```

Start 2026-11-17 21:43:04 Asia/Shanghai, end 2026-11-17 21:43:06 Asia/Shanghai. **108 pass / 0 fail, exit 0.**

```bash
pnpm --filter @bookskill/desktop test
```

Script includes `tsc --noEmit`. Start 2026-11-17 21:43:35 Asia/Shanghai, end 2026-11-17 21:43:39 Asia/Shanghai. **81 pass / 0 fail, exit 0.**

Logs: `docs/graph/GRAPH-002-pnpm-core-test-output.txt`, `docs/graph/GRAPH-002-pnpm-desktop-test-output.txt`.

## Residuals

- Unit tests do not open a packaged Electron window.
- Locators that are not fixture substrings stay unconfirmed; no invented precise locators.
- Independent QA must pass before merge, completeness claims, G1/G2, publish, or targeting `main`.
- Fixture bytes and SHA256SUMS were not changed.
