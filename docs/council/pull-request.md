## Summary

Wire the already-merged COUNCIL-001 core API into the existing BookSkill Desktop chat route. This adds a council panel under 问题对话 with three stable seats (`sunzi-decision`, `lunyu-conduct`, `laozi-wuwei`), single-seat Q&A, and a roundtable of at least two seats followed by a summary. Every utterance displays `source_filename`. Citations must be fixture substrings; invented wording is rejected and shown as an error, not as a confirmed quote.

No sixth top-level nav item. `DEFAULT_ROUTE_ID` remains `chat`. Seats stay draft Skills; nothing is auto-published.

**Risk: medium** (UI and IPC wiring; no schema change).

Base: `integration` @ `5fe203b0b1c24d64b53415ddf2242297b225e577`. Head: `SHA_PLACEHOLDER`.

This is not a completeness claim and must not be merged until independent QA passes. Do not target `main`.

## Acceptance checklist

- [x] Three stable seats visible with testids `council-seat-sunzi-decision`, `council-seat-lunyu-conduct`, `council-seat-laozi-wuwei`
- [x] Single-seat ask (injected fixture adapter) points at `孙子兵法_蒸馏结果.md` and displays `source_filename`
- [x] Roundtable: at least two seats speak in order, then a summary; every utterance has `source_filename`
- [x] Invented citations are rejected (core validation) and not shown as confirmed quotes
- [x] Unconfigured generation adapter fails visibly (`council-error`); fixture demo path is explicitly labeled and is not a live model success
- [x] `DEFAULT_ROUTE_ID === "chat"`; still exactly five top-level routes
- [x] `BookskillDesktopBridge` gained required methods; stubs updated in `rel-001.test.ts` and `rel-002.test.ts`
- [x] Renderer council code does not value-import `@bookskill/core`
- [x] No changes to `packages/core/src/council/**`, `distill/**`, `graph/**`, or `packages/data`
- [x] Fixture bytes / SHA256SUMS left unchanged
- [ ] Independent QA (not this self-test)

## Test commands and results

Node `v24.22.1`, pnpm `10.34.6`. Times in Asia/Shanghai.

```bash
pnpm --filter @bookskill/core test
```

2026-11-17 21:29:54–21:29:55 Asia/Shanghai: **100 passed, 0 failed, exit 0**. Log: `docs/council/COUNCIL-002-pnpm-core-test-output.txt`.

```bash
pnpm --filter @bookskill/desktop test
```

Script includes `tsc -p tsconfig.json --noEmit`. 2026-11-17 21:30:17–21:30:20 Asia/Shanghai: **74 passed, 0 failed, exit 0**. Log: `docs/council/COUNCIL-002-pnpm-desktop-test-output.txt`.

## Residuals

- Injected / fixture adapter is not a live model.
- Unit tests do not open a packaged Electron window.
- Independent QA must pass before merge or completeness claims.
- Seats still use draft Skills.
- Later tickets may refine the UI.
- GRAPH-002 / VER-002 were not started.

## Report

`docs/council/COUNCIL-002-REPORT.md`
