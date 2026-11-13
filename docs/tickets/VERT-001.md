# VERT-001：从书到对话 Skill 的完整薄切片

- ID：VERT-001
- 目标：导入许可测试材料、带来源知识卡、一个可运行 Skill、一次多轮对话、引用和反馈记录。退出并重启后数据仍在；回答能展示原书来源；没有来源时明确标注。
- 负责人 Agent：ai_skill_engineer
- 依赖：APP-001, DATA-001, GOV-001（测试材料必须自有、开放许可或人工合成）
- 输入/受影响模块：导入、知识卡、Skill 运行、对话、引用、反馈
- 允许工具：使用项目内许可测试 PDF/EPUB；实现最小闭环与自动测试
- 禁止操作：使用无授权整本书作仓库测试数据；把无来源内容伪装成书中结论；自动发布 Skill；推送 main
- 状态：Done（本地薄切片；未合入；不是正式交付；未宣布 G1/G2；远端 PR 因 B-001 未开）
- 启动时间：2026-11-13 17:31 Asia/Shanghai
- 完成时间：2026-11-13 17:39 Asia/Shanghai（实现提交 `bbf74352eb6bdb7952193f0ad079cc92f78590d5`）；独立复测 2026-11-13 17:40:05–17:40:08 Asia/Shanghai
- 分支：`feat/VERT-001` @ `7cc95eea53e4fe620332dd0cf804a6063cd5582c`（实现 `bbf74352eb6bdb7952193f0ad079cc92f78590d5`；本地工作分支汇入已验收的 APP-001、DATA-001、FIXT-001，不改 main / integration）
- 工作树：`/workspace/bookskill-worktrees/VERT-001`
- 验收条件（可测试）：见合同 VERT-001 与 AT-02/AT-03/AT-04 的最小子集；必须可自动跑。
- 测试命令：在 `/workspace/bookskill-worktrees/VERT-001` 执行 `pnpm --filter @bookskill/core test` 与 `pnpm --filter @bookskill/desktop test`。
- 独立复测结果：core 6 passed，0 failed，exit 0（17:40:05）；desktop 16 passed，0 failed，exit 0（17:40:06）；另核 data 11 passed，exit 0（17:40:08）。
- 交付物路径：`packages/core/**`、桌面壳有限接线、`docs/vert/VERT-001-REPORT.md`、`docs/vert/pull-request.md`、`docs/vert/pnpm-core-test-output.txt`、`docs/vert/pnpm-desktop-test-output.txt`。只读使用 FIXT-001 样本。
- 失败升级条件：切片失败则停止扩展非核心功能，只修本切片。
