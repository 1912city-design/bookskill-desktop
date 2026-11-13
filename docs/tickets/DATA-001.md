# DATA-001：本地 schema 与迁移

- ID：DATA-001
- 目标：实现执行合同第 3.1 节数据表、迁移脚本、备份/恢复基础测试。升级 schema 后旧数据仍可读取；迁移失败可恢复备份。
- 负责人 Agent：backend_engineer
- 依赖：REPO-001
- 输入/受影响模块：BookSkill 自有 schema、migration、本地库
- 允许工具：实现 schema、迁移、基础备份恢复测试
- 禁止操作：把 AnythingLLM 内部数据库当作唯一业务数据源；无备份窗口的破坏性迁移；推送 main
- 状态：Done（本地；未合入；合入 integration 需人工确认；远端 PR 因 B-001 未开）
- 启动时间：2026-11-13 17:21 Asia/Shanghai
- 完成时间：2026-11-13 17:26 Asia/Shanghai（实现提交）；独立复测 2026-11-13 17:27:16 Asia/Shanghai
- 分支：`feat/DATA-001` @ `8bf68e114237653fc86538ed28e47154e9a723e2`（实现 `af14b5c7415d191f7f981073ad855014b0de195a`；从 `feat/REPO-001` 拉出，不改 main）
- 工作树：`/workspace/bookskill-worktrees/DATA-001`
- 验收条件（可测试）：
  1. 合同列出的对象均有表与 UUID 主键，并有迁移脚本。
  2. 从 N 迁移到 N+1 后旧数据可读取。
  3. 故意失败的迁移会恢复备份，数据与失败前一致。
  4. 业务库路径位于 BookSkill 数据目录。
- 测试命令：在 `/workspace/bookskill-worktrees/DATA-001` 执行 `pnpm --filter @bookskill/data test`。
- 独立复测结果：11 passed，0 failed，exit 0（2026-11-13 17:27:16 Asia/Shanghai）。任务自测日志：`docs/data/pnpm-test-output.txt`。
- 交付物路径：`packages/data/**`、`docs/data/DATA-001-REPORT.md`、`docs/data/pull-request.md`。
- 失败升级条件：迁移损坏数据则回滚并 BLOCKED，不得继续扩表。
