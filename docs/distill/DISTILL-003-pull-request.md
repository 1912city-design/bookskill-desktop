# DISTILL-003：多源蒸馏（先支持访谈/文本上传）

## 摘要

从当时的 `origin/integration` @ `5fe203b` 开工，经 GRAPH-001 合入后的 `4d60314`，再变基到当前 `origin/integration` @ `b6ff0ea0bcc024371341ea782eb06bee93cb9d44`（Merge PR #24 COUNCIL-002，2026-11-17 21:39:53 Asia/Shanghai）。新增许可/合成访谈夹具，复用锁定 5 段模板生成完整蒸馏结果与 draft Skill。智囊团引用该结果时可见 `source_filename`。`packages/core/src/index.ts` 保留既有 council / distill / graph 导出块，仅在其后追加本票导出；此次变基无冲突。未改 `packages/core/src/council/**` 或 `packages/core/src/graph/**`，未做桌面上传 UI。

风险：**中（medium）**。请保持本 PR OPEN，目标仍为 `integration`。不要合入，不要改指向 `main`，不要宣布完成或盖 G1/G2。自测不是独立 QA。

## 变更

- 新增 `packages/core/src/distill/multi-source.ts`：`importInterviewOrText` / `citeImportedSourceWithCouncil`
- `packages/core/src/index.ts` 仅在既有 council / distill / graph 导出块之后追加多源导出
- 新增 `packages/core/test/distill-003.test.ts` 与合成夹具 `packages/core/test/fixtures/distill-003/`
- 报告与测试日志：`docs/distill/DISTILL-003-REPORT.md`

## 验收对照

1. 导入合成访谈 `合成访谈_决策节奏复盘.txt`，按锁定 5 段校验通过，并产生 draft Skill（不为 published）。
2. `citeImportedSourceWithCouncil` 的 utterance、citations 与正文均可见该 `source_filename`。只使用 COUNCIL-001 公开 API。
3. 缺段、改标题、第 5 段空 Skill 时失败且不写 Skill。
4. 测试（工作树 `/workspace/bookskill-worktrees/DISTILL-003`，变基到 `b6ff0ea` 后重跑，Asia/Shanghai）：
   - `pnpm --filter @bookskill/core test`：**117/117**，exit 0，2026-11-17 21:41:15–21:41:16 CST
   - `pnpm --filter @bookskill/desktop test`（含 `tsc --noEmit`）：**74/74**，exit 0，2026-11-17 21:41:16–21:41:19 CST
5. 未合入，未触 `main`，未改锁定原件或既有 `fixtures/distill` 哈希，未改 `packages/core/src/graph/**`。

## 残差

见 `docs/distill/DISTILL-003-REPORT.md`。主要：无桌面上传 UI；不新增第四个固定智囊团席位；自测不是独立 QA。

## 请不要

- 自行合并本 PR
- 把目标改成 `main` 或合入 `main`
- 标 Done / 盖 G1/G2 / 发布 / 宣布完成
