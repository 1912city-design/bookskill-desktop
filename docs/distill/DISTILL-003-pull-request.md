# DISTILL-003：多源蒸馏（先支持访谈/文本上传）

## 摘要

从 `origin/integration` @ `5fe203b0b1c24d64b53415ddf2242297b225e577` 拉出 `feat/DISTILL-003`，新增许可/合成访谈夹具，并复用锁定 5 段模板生成完整蒸馏结果与 draft Skill。智囊团引用该结果时可见 `source_filename`。未从 `feat/GRAPH-001` 拉出，未改 `packages/core/src/graph/**`，未做桌面上传 UI。

风险：**中（medium）**。请保持本 PR OPEN，目标仍为 `integration`。不要合入，不要改指向 `main`，不要宣布完成或盖 G1/G2。自测不是独立 QA。

## 变更

- 新增 `packages/core/src/distill/multi-source.ts`：`importInterviewOrText` / `citeImportedSourceWithCouncil`
- `packages/core/src/index.ts` 仅追加多源导出，未改写 council / distill / 既有导出块
- 新增 `packages/core/test/distill-003.test.ts` 与合成夹具 `packages/core/test/fixtures/distill-003/`
- 报告与测试日志：`docs/distill/DISTILL-003-REPORT.md`

## 验收对照

1. 导入合成访谈 `合成访谈_决策节奏复盘.txt`，按锁定 5 段校验通过，并产生 draft Skill（不为 published）。
2. `citeImportedSourceWithCouncil` 的 utterance、citations 与正文均可见该 `source_filename`。只使用 COUNCIL-001 公开 API。
3. 缺段、改标题、第 5 段空 Skill 时失败且不写 Skill。
4. 测试（工作树 `/workspace/bookskill-worktrees/DISTILL-003`，Asia/Shanghai）：
   - `pnpm --filter @bookskill/core test`：**109/109**，exit 0，2026-11-17 21:36:39–21:36:41 CST
   - `pnpm --filter @bookskill/desktop test`（含 `tsc --noEmit`）：**66/66**，exit 0，2026-11-17 21:36:41–21:36:44 CST
5. 未合入，未触 `main`，未改锁定原件或既有 `fixtures/distill` 哈希。

## 残差

见 `docs/distill/DISTILL-003-REPORT.md`。主要：无桌面上传 UI；不新增第四个固定智囊团席位；自测不是独立 QA；GRAPH-001 合入后 `index.ts` 追加块需一并保留。

## 请不要

- 自行合并本 PR
- 把目标改成 `main` 或合入 `main`
- 标 Done / 盖 G1/G2 / 发布 / 宣布完成
