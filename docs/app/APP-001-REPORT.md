# APP-001 交接报告

- 任务：桌面骨架
- 负责人：frontend_engineer
- 分支：`feat/APP-001`（从 `feat/REPO-001` 拉出）
- 工作区：`/workspace/bookskill-worktrees/APP-001`
- 完成时间：2026-11-13 17:28 Asia/Shanghai
- 状态：Linux 开发骨架、自动测试与未签名 dir 产物已完成本地交付；**不是** V1 目标 OS（Windows 11 / macOS 13+）构建，**不能宣布 G1 已通过**。发布仓库尚未连接，因此没有远端 PR、没有签名安装包、也没有正式发布。

## 做了什么

在 `packages/desktop` 新增自包含的 `@bookskill/desktop` Electron 壳（未改根 `package.json`、`pnpm-workspace.yaml`、数据层、治理文档或 CI 脚本）：

- 产品名显示为 `BookSkill Desktop`（窗口标题与侧栏）
- 五个可导航的一级入口：问题对话（默认）、书库、知识库、Skills、设置与数据
- 渲染/启动失败时显示可见错误面板（`role="alert"`），不是白屏
- 首次启动在独立 BookSkill 数据目录创建 `conversations/`、`library/`、`knowledge/`、`skills/`、`settings/`、`logs/` 与 `layout.json`
- 数据目录解析沿用 `@bookskill/repo-baseline` 的 `resolveDataDir()`，拒绝 AnythingLLM / Mintplex 用户数据路径
- 未包装、未再分发 AnythingLLM 官方桌面二进制；图标与界面为 BookSkill 原作，不含 AnythingLLM 商标、图标或 wordmark
- 未访问 `/workspace/书籍蒸馏工作台/运行时`，未读密钥

本机还打出了未签名的 Linux x64 开发 dir，路径见下文。该目录已被根 `.gitignore` 的 `out/` 规则忽略，不入库。

为加入工作区包，更新了根目录 `pnpm-lock.yaml`。这是安装依赖所必需的，没有改根脚本，因此根目录 `pnpm test` 仍只跑 `@bookskill/repo-baseline`。桌面测试请使用 `pnpm --filter @bookskill/desktop test`。

## 验收条件逐条结果

| # | 条件 | 结果 |
|---|---|---|
| 1 | 可启动的桌面应用骨架，显示产品名 `BookSkill Desktop` | **通过（Linux 开发构建）。** `pnpm --filter @bookskill/desktop smoke` 与未签名 dir 中的 `bookskill-desktop --smoke` 均看到产品名与窗口标题 `问题对话 · BookSkill Desktop`。 |
| 2 | 五个一级入口，默认为问题对话，导航可测试而不是空按钮 | **通过。** 单元测试断言五个标签与默认路由；冒烟快照确认侧栏按钮可查询，默认 `aria-current="page"` 在「问题对话」。点击入口会切换主视图。 |
| 3 | 错误边界：渲染失败时有可见错误，不是白屏 | **通过。** `renderWithBoundary()` / `buildErrorPanelHTML()` 单测覆盖可见 `role="alert"` 面板、文案转义与捕获抛错。启动失败会把错误交给同一块面板，而不是空白窗口。可重复步骤：给 `index.html` 加上 `?crash=1` 或 `?bootError=...` 可直接看到错误页。 |
| 4 | 首次启动在独立 BookSkill 数据目录创建结构；不使用或覆盖 AnythingLLM 默认用户目录 | **通过。** 可用 `BOOKSKILL_DATA_DIR` 指向临时目录。单测与冒烟均创建了约定子目录和 `layout.json`。指向 `anythingllm-desktop` / `anything-llm` / `mintplex` 的覆盖路径会抛错，并且不会创建该目录。 |
| 5 | 至少完成当前 Linux 开发构建/启动冒烟；明确这还不是 V1 目标 OS 构建，不能宣布 G1 已通过 | **Linux 冒烟通过，G1 未通过。** 本机是 Linux x86_64。未制作 Windows 11 或 macOS 13+ 开发构建。未签名 Linux dir 不能当作正式安装包，也不能当作 G1 证据。 |
| 6 | 自动测试本机跑通：导航入口、默认问题对话、数据目录创建、拒绝 AnythingLLM 路径 | **通过。** `pnpm --filter @bookskill/desktop test` 退出码 0，15 passed / 0 failed。 |
| 7 | 写入 `docs/app/APP-001-REPORT.md` 与 `docs/app/pull-request.md`，在 `feat/APP-001` 提交；不 push、不合入 main/integration | **本报告与 PR 草案已写。** 提交后不会 push 或合并。 |

## 测试 / 构建命令及本机结果（Asia/Shanghai）

本机：Linux x86_64，Node v24.22.1，pnpm 10.34.6，Electron 39.8.10。命令都在 `/workspace/bookskill-worktrees/APP-001` 执行。

| 命令 | 退出码 | 时间 | 结果 |
|---|---|---|---|
| `pnpm install` | 0 | 2026-11-13 17:25 CST | 工作区安装成功。pnpm 10 忽略了 `electron` 与 `esbuild` 的 build scripts；esbuild 仍可使用平台可选包。 |
| `node install.js`（electron 官方安装脚本） | 0 | 2026-11-13 17:26 CST | 下载官方 Electron 二进制到 `node_modules`。不是 AnythingLLM 官方桌面包。 |
| `pnpm --filter @bookskill/desktop test` | 0 | 2026-11-13 17:28:07–17:28:10 CST | 15 passed / 0 failed。覆盖导航入口、默认「问题对话」、数据目录创建、拒绝 AnythingLLM 路径、错误边界可见输出。 |
| `pnpm --filter @bookskill/desktop build` | 0 | 包含在 smoke / pack 中 | 产出 `packages/desktop/dist/`（不入库）。 |
| `pnpm --filter @bookskill/desktop smoke` | 0 | 2026-11-13 17:27 CST | Linux 启动冒烟通过。证据：`docs/app/linux-smoke-result.json`、`docs/app/linux-smoke-layout.json`。 |
| `pnpm --filter @bookskill/desktop pack:dir` | 0 | 2026-11-13 17:27 CST | 未签名 Linux x64 dir，约 284M：`packages/desktop/out/BookSkill Desktop-linux-x64`（gitignore，不入库）。说明：`docs/app/linux-pack-dir.txt`。 |
| 对上述 dir 中 `bookskill-desktop --smoke` | 0 | 2026-11-13 17:27 CST | 未签名产物可启动，默认进入问题对话。证据：`docs/app/linux-pack-smoke-result.json`。 |

冒烟使用的临时数据目录示例：`/tmp/bookskill-desktop-smoke-LGhfkC`。该目录含 `layout.json`（`product` 为 `BookSkill Desktop`，`schema` 为 `bookskill-desktop-app-001`）以及 `conversations`、`library`、`knowledge`、`skills`、`settings`、`logs`。Electron 的 `userData` 被放到该目录下的 `electron-user-data/`，没有落到 AnythingLLM 路径。

首次冒烟曾因容器内 Chromium 对 `/dev/shm` 的用法失败（退出码 1）。主进程已加上 `disable-dev-shm-usage`，并在 CI/容器/`--smoke` 时附加 `no-sandbox` 与 `no-zygote`。修复后冒烟退出码 0。这只是本机开发环境的启动参数，不是正式发行配置。

## 可启动性

- **可以启动（Linux 开发）。** `pnpm --filter @bookskill/desktop start` 会构建并启动 Electron 壳。交互式冒烟已由 `--smoke` 自动完成。
- 未签名 dir 中的可执行文件 `bookskill-desktop` 也可以在本机以 `--smoke` 启动并退出码 0。
- **不可以**把这次结果说成 Windows 11 或 macOS 13+ 已可构建、已可启动。

## 未解决风险

- **G1 未通过。** 没有 Windows 11 / macOS 13+ runner 或开发构建，也没有签名证书与商店账户。Linux 中间证据不能升级为 G1。
- 发布仓库仍未连接；不能开远端 PR，不能跑 GitHub Actions，不能发布。
- 根 CI / 根 `pnpm test` 尚未包含 `@bookskill/desktop`（APP-001 禁止改根脚本，以避免与 DATA-001 冲突）。
- pnpm 10 默认跳过 `electron` 的 install script。新环境需要 `scripts/ensure-electron.mjs`，或由仓库维护者在根配置中批准该 build script。本次未改根 `package.json`。
- GOV-001 的 L-001 / L-002 仍待法律确认。本壳未引入 AnythingLLM 源码、官方二进制或品牌资产，但后续若适配上游模块，仍须遵守已提出的法律问题，不得把官方 Desktop 条款未决事项当成已批准。
- 首次启动目录结构是 APP-001 骨架约定（`bookskill-desktop-app-001`）。DATA-001 的正式 schema / 迁移落地后可能需要衔接，而不是把该布局当成最终数据库。
- 壳内五个入口目前是可导航占位页，业务能力属于后续切片。
- 容器里会出现无害的 dbus 连接错误日志；不作为启动失败依据。
- 未签名 dir 含 Chromium 与其第三方许可证清单（`LICENSES.chromium.html`）。正式安装包发行前仍须完成许可证审查（D-011 / L-009 等）。

## 法律与品牌边界（只读遵守）

- 未包装、未再分发 AnythingLLM 官方 Desktop 二进制（L-001）。
- 未把 AnythingLLM / Mintplex 的商标、图标、favicon 或 wordmark 放进产品界面（L-002）。
- 应用图标是 BookSkill 原作几何书签图形（`packages/desktop/resources/icon.svg` 与 PNG），产品名可按 D-001 由负责人后续替换。
