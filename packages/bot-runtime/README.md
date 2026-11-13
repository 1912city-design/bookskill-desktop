# bot-runtime

BookSkill Desktop 的 Grok 执行器运行时（BOT-001）。

- 加载仓库根目录 `.bookskill/` 下的角色、工具、预算与状态机配置
- 以 fail-closed 策略执行工具调用：未知角色、角色无权、以及被禁工具一律失败并写入审计日志
- **不实现**任何可用的「合并 main」或「发布生产」路径
- 任务状态可持久化；高风险工单不能自动合入 integration
- 审计日志对密钥明文脱敏
- `create_pull_request` / `read_ci_results` 在发布仓库未连接时返回 BLOCKED（B-001 / B-007）

## 测试

本包自包含，不依赖根目录 `package.json` 或 pnpm workspace（由 REPO-001 拥有）。

```bash
cd packages/bot-runtime
npm test
# 等价于
node --test tests/*.test.js
```

若以后根仓库已由 REPO-001 接好 pnpm workspace，也可以用：

```bash
pnpm --dir packages/bot-runtime test
```
