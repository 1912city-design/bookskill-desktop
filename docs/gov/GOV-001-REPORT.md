# GOV-001 执行报告

- 任务：上游和许可证审查
- 角色：architect
- 工作区：`/workspace/bookskill-worktrees/GOV-001`
- 分支：`feat/GOV-001`
- 日期：2026-11-13 Asia/Shanghai

本报告是任务执行记录。它不构成法律意见，也不授权 BookSkill Desktop 对外正式发行。

## 改动摘要

在 `feat/GOV-001` 上新增治理与许可证文档，未改动应用代码、CI、`.gitignore`、仓库治理主文件或工单正文。

1. 只读克隆 https://github.com/Mintplex-Labs/anything-llm 到 `/workspace/bookskill-upstream/anything-llm`（该克隆按合同不纳入本仓库）。检出 commit `1626d971c73d70a68602a662e3baf52e160c62ff`，分支 `master`，时间 2026-11-13 17:12:17 Asia/Shanghai。未下载模型权重。工作区约 124M。
2. 用根 LICENSE、子模块 pinned commit 的 LICENSE、字体 name table、官方 OFL.txt、Hugging Face 模型卡片 API、npm registry `license` 字段、以及若干 tarball/raw 文本做了实测，而不是凭 GitHub MIT 徽章下结论。
3. 写出主报告 `docs/UPSTREAM-LICENSES.md`、组件/依赖/媒体清单、许可摘录、需人工确认的问题列表，以及检查脚本 `docs/licenses/verify_gov001.py`。

上游克隆与密钥、真实用户书籍无关；未读取 `/workspace/书籍蒸馏工作台/运行时` 下的任何文件。

## 验收条件逐条结果

| # | 验收条件 | 结果 | 说明 |
| --- | --- | --- | --- |
| 1 | 写明上游官方 URL、用于审计的 commit hash / tag、检出时间 | **满足** | 见 `docs/UPSTREAM-LICENSES.md` 第 1 节与 `docs/licenses/upstream-checkout.md`。URL https://github.com/Mintplex-Labs/anything-llm；commit `1626d971c73d70a68602a662e3baf52e160c62ff`；最近 tag `v1.19.0`（HEAD 超前 123 个提交，不是精确 tag）；检出结束时间 2026-11-13 17:12:17 Asia/Shanghai。 |
| 2 | 产出根许可证及第三方依赖清单（至少覆盖将进入安装包的组件），含名称、版本或 commit、许可证标识、来源 URL | **满足** | `docs/licenses/component-inventory.csv`、`npm-dependencies.csv`、`npm-dependencies-unique.csv`。npm 唯一条目 1732 个。后续对 SheetJS `xlsx@0.20.2` 与 milvus SDK 用包内 LICENSE 做了补测，见 `npm-manual-followup.md`。 |
| 3 | 单独列出商标、图标、字体、模型权重及其许可证/使用条款；未知项标 `UNKNOWN`，不得猜测为可自由发行 | **满足** | 字体 OFL-1.1 已用 name table 与官方 OFL.txt 实测。商标与 57 个供应商标志标为 UNKNOWN。部分 Xenova 转换模型、CDN 二进制、逐个 GGUF、ffmpeg 构建标为 UNKNOWN。未把缺失字段猜测成可自由发行。 |
| 4 | 明确列出需人工确认的法律问题；结论不得写成发行事项已经得到批准 | **满足** | `docs/licenses/legal-questions.md` 列出 L-001 至 L-012。主报告与本报告均声明：根 MIT 只是起点，审查记录不是批准。 |
| 5 | 存在可运行的检查命令：清单文件存在、至少记录上游 hash、报告中不含越权结论；缺失或越权时非零退出 | **满足** | `python3 docs/licenses/verify_gov001.py`。实测见下一节。 |

## 测试命令及结果

在 worktree 根目录 `/workspace/bookskill-worktrees/GOV-001` 执行：

```bash
python3 docs/licenses/verify_gov001.py
echo exit:$?
```

实测输出（工作目录 `/workspace/bookskill-worktrees/GOV-001`，2026-11-13 Asia/Shanghai）：

```
GOV-001 verify passed
repo_root=/workspace/bookskill-worktrees/GOV-001
upstream_commit_hashes_found=['1626d971c73d70a68602a662e3baf52e160c62ff', '385d36c0807221e6674d1325ef06505746c49ceb', '9b1fcab141000eaba9f78ed131151de04904454b', 'a3a2fea57cfc753698110dd0973a607e3209f634', 'eb0a45cd41ac1a5b4c97766e9935d97583104d35']
required_files=ok
no_public_release_approval_claim=ok
note=passing this script is not a legal approval and does not authorize public release
```

退出码：**0**

负向检查（在 `/tmp/gov001-neg` 的临时副本上运行，不修改本分支文件）：

| 场景 | 退出码 | 脚本输出要点 |
| --- | --- | --- |
| 删除 `docs/UPSTREAM-LICENSES.md` | 1 | `missing required file: docs/UPSTREAM-LICENSES.md` |
| 从主报告和 checkout 记录中去掉全部 40 位 hash | 1 | `no 40-character upstream commit hash recorded ...` |
| 在临时副本报告末尾写入脚本必须拒绝的肯定性对外发行批准句 | 1 | 报告命中 public-release approval claim，非零退出 |

另外的辅助实测（非正式验收命令，但已执行）：

- `GIT_LFS_SKIP_SMUDGE=1 git clone --origin official https://github.com/Mintplex-Labs/anything-llm.git /workspace/bookskill-upstream/anything-llm` — 退出码 0；日志 `/tmp/gov001-logs/clone.log`。
- `python3 /tmp/gov001-scan-npm.py` — 退出码 0；解析 lockfile 并查询 npm registry；日志 `/tmp/gov001-logs/npm-license-scan.log`。
- Hugging Face `api/models`、raw LICENSE、SheetJS tarball 内 LICENSE、unpkg milvus LICENSE — HTTP 200，文本已摘录到 `docs/licenses/excerpts/`。

为确认脚本会在越权结论或缺失 hash 时失败，提交前还在临时副本上做过负向检查（不修改本分支将提交的文件）。结果写入测试节。

## 未解决风险

- 法律问题 L-001–L-012 全部待人工确认。任一未解决时，本地开发可以继续，但不得对外正式发行。
- 子模块未 checkout，其第三方依赖树未扫描。
- npm walker 对 URL 范围与 yarn alias 的生产树标记不完整；已用人工 follow-up 补了 `xlsx`。
- `lemond` / llama.cpp / Chromium / 模型权重均未下载，许可证结论对“具体产物”仍不完整。
- 磁盘约剩 61G；本审查有意不拉取大文件。若后续预置模型，需单独控制体积并补审。
- 发布仓库仍未连接；本任务按合同只做本地提交，不 push、不开远端 PR、不合并到 `main`/`integration`。
- 无 BLOCKED：上游可以检出，许可证文本冲突已记为待确认问题而不是克隆失败。不阻塞 REPO-001 / BOT-001。

## 交付文件

- `docs/UPSTREAM-LICENSES.md`
- `docs/licenses/README.md`
- `docs/licenses/upstream-checkout.md`
- `docs/licenses/component-inventory.csv`
- `docs/licenses/npm-dependencies.csv`
- `docs/licenses/npm-dependencies-unique.csv`
- `docs/licenses/npm-license-summary.json`
- `docs/licenses/npm-manual-followup.md`
- `docs/licenses/media-and-branding.csv`
- `docs/licenses/legal-questions.md`
- `docs/licenses/verify_gov001.py`
- `docs/licenses/excerpts/`（及其中 README）
- `docs/gov/GOV-001-REPORT.md`
- `docs/gov/pull-request.md`
