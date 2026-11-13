# DATA-001：本地 schema 与迁移

- ID：DATA-001
- 目标：实现执行合同第 3.1 节数据表、迁移脚本、备份/恢复基础测试。升级 schema 后旧数据仍可读取；迁移失败可恢复备份。
- 负责人 Agent：backend_engineer
- 依赖：REPO-001
- 输入/受影响模块：BookSkill 自有 schema、migration、本地库
- 允许工具：实现 schema、迁移、基础备份恢复测试
- 禁止操作：把 AnythingLLM 内部数据库当作唯一业务数据源；无备份窗口的破坏性迁移；推送 main
- 状态：Backlog
- 验收条件（可测试）：
  1. 合同列出的对象均有表与 UUID 主键，并有迁移脚本。
  2. 从 N 迁移到 N+1 后旧数据可读取。
  3. 故意失败的迁移会恢复备份，数据与失败前一致。
  4. 业务库路径位于 BookSkill 数据目录。
- 测试命令：schema/migration/backup 测试套件（任务启动时写入具体命令）。
- 交付物路径：迁移脚本、测试、任务报告。
- 失败升级条件：迁移损坏数据则回滚并 BLOCKED，不得继续扩表。
