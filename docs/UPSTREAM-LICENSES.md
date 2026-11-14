# BookSkill Desktop — 上游与许可证审查（GOV-001）

**状态：审查记录，等待人工确认。本文件不是法律意见，也不授权任何形式的对外正式发行。**

根许可证为 MIT 只是审查起点，不能替代对依赖、商标、图标、字体、模型权重、CDN 二进制和官方桌面条款的逐项核对。本审查明确不作出“发行事项已经得到批准”的结论。

审查角色：architect。审查日期：2026-11-13（Asia/Shanghai）。

---

## 1. 上游身份

| 项 | 值 |
| --- | --- |
| 官方 URL | https://github.com/Mintplex-Labs/anything-llm |
| 克隆 URL | https://github.com/Mintplex-Labs/anything-llm.git |
| 检出路径（不纳入本仓库） | `/workspace/bookskill-upstream/anything-llm` |
| 分支 | `master`（上游默认分支） |
| 精确 commit | `1626d971c73d70a68602a662e3baf52e160c62ff` |
| `git describe --tags --always` | `v1.19.0-123-g1626d971` |
| 最近 tag | `v1.19.0`（**不是** HEAD 的精确 tag） |
| `v1.19.0` 指向 | `9b1fcab141000eaba9f78ed131151de04904454b`（提交时间 2026-10-25 11:20:42 -0700，即 2026-10-26 02:20:42 Asia/Shanghai） |
| HEAD 提交时间 | 2026-11-12 15:23:03 -0800（2026-11-13 07:23:03 Asia/Shanghai） |
| HEAD 说明 | `fix: guard image downloads in the PDF, DOCX and PPTX file tools (#7143)` |
| 检出时间 | 开始 2026-11-13 17:12:14 Asia/Shanghai；结束 2026-11-13 17:12:17 Asia/Shanghai |
| 克隆方式 | `GIT_LFS_SKIP_SMUDGE=1 git clone --origin official …` |
| 工作区大小 | 124M（含 `.git`） |
| 模型权重 | **未下载** |
| 子模块 | 未初始化；gitlink 已记录 |

更完整的字段见 [`docs/licenses/upstream-checkout.md`](licenses/upstream-checkout.md)。克隆日志：`/tmp/gov001-logs/clone.log`。

GitHub 仓库元数据（`https://api.github.com/repos/Mintplex-Labs/anything-llm`，检索于 2026-11-13）将默认分支标为 `master`，并把 license 字段标为 MIT。该徽章与根 LICENSE 一致，但不能覆盖下文各组件。

---

## 2. 根许可证与第一方源码

根文件 [`LICENSE`](https://github.com/Mintplex-Labs/anything-llm/blob/1626d971c73d70a68602a662e3baf52e160c62ff/LICENSE) 标题为 “The MIT License”，版权人为 **Mintplex Labs Inc.**。文本含标准的使用/复制/修改/合并/发布/再许可/销售授权，以及保留版权与许可声明的条件，和“按现状”免责。SHA-256：`782d2dc18a1ed9028ca992520f42b2e0b6187807da0d14455b8ae608e2e5692e`。摘录：[`docs/licenses/excerpts/anything-llm-root-LICENSE.txt`](licenses/excerpts/anything-llm-root-LICENSE.txt)。

同树内的声明：

| 位置 | 声明 |
| --- | --- |
| `package.json` | `name: anything-llm`，`version: 1.19.0`，`license: MIT`，作者 Timothy Carambat (Mintplex Labs) |
| `frontend/package.json` | `license: MIT` |
| `server/package.json` | `license: MIT`，`version: 1.19.0` |
| `collector/package.json` | `license: MIT`，`version: 1.19.0` |
| `CONTRIBUTING.md` | 向本仓库贡献即同意按 MIT 授权 |
| `README.md` | “This project is MIT licensed.” |
| `TERMS_SELF_HOSTED.md`（Last Updated: March 2026） | “The AnythingLLM core is provided under the MIT License.” 同时说明 Docker / Desktop / Source 的本地数据和可选遥测。摘录已保存。 |

两个 git 子模块在 pinned commit 上的根 LICENSE 同样为 MIT（Copyright (c) Mintplex Labs Inc.），文本与主仓库根 LICENSE 的 SHA-256 相同：

- `embed` @ `a3a2fea57cfc753698110dd0973a607e3209f634`（https://github.com/Mintplex-Labs/anythingllm-embed）
- `browser-extension` @ `385d36c0807221e6674d1325ef06505746c49ceb`（https://github.com/Mintplex-Labs/anythingllm-extension）

本审查克隆未 checkout 子模块工作区；也未扫描它们的第三方 lockfile。`frontend/public/embed/` 中已有一份压缩后的聊天挂件，若进入安装包，应视为该子模块的发行副本。

MIT **不授予商标权**，也不自动覆盖运行时下载的模型、CDN 二进制、系统级 ffmpeg，或第三方供应商标志。

---

## 3. 官方 Desktop 条款（不得作为基座）

https://docs.anythingllm.com/installation-desktop/terms 在 2026-11-13 取得的页面写明：

> This is the terms of use for AnythingLLM Desktop only. All other products and services are covered by their respective terms of use (MIT).

条款标题为 “AnythingLLM Desktop App Terms of Use”，版本 **July 14, 2025**。关键限制（摘义，以原文为准）：

- 授予非独占、不可转让许可，仅限个人和/或内部业务使用；
- 将软件结构与源码称为商业秘密与保密信息；
- 禁止修改、再分发、再许可、出租、逆向工程（法律强制允许的除外）以及去除权利声明；
- 保留 Mintplex Labs 及其供应商的知识产权，包括商标；
- 含出口管制与制裁陈述；适用加利福尼亚州法律。

该官方桌面二进制**不在**本次审查的源码树中，也未在公开 GitHub 上找到可检出的 `anythingllm-desktop` 源码仓库。按项目决策 D-003，BookSkill **不得**重新包装官方桌面二进制。相关法律问题见 L-001。

---

## 4. 将进入或可能进入安装包的组件清单

主表：[`docs/licenses/component-inventory.csv`](licenses/component-inventory.csv)（列：名称、版本或 commit、许可证标识、来源 URL、备注）。

项目计划基于 AnythingLLM **源码**构建桌面产品，因此至少下列第一方目录及它们的生产依赖可能进入安装包：`frontend/`、`server/`、`collector/`，以及字体、图标、（若启用）运行时模型与引擎。`cloud-deployments/`、文档截图和浏览器扩展是否进入安装包，需在产品范围中明确排除或另审。

### 4.1 npm 依赖（实测 registry 字段，不是猜测）

方法：解析 `frontend/yarn.lock`、`server/yarn.lock`、`collector/yarn.lock`，再向 `registry.npmjs.org/<name>/<version>` 读取 `license` 字段。扫描时间：2026-11-13 17:15:10–17:15:22 Asia/Shanghai。日志：`/tmp/gov001-logs/npm-license-scan.log`。未执行 `yarn install`，未拉取模型权重。

| 统计 | 数量 |
| --- | --- |
| lockfile 记录 | frontend 733，server 1078，collector 633 |
| 工作区范围行（`npm-dependencies.csv`） | 2444 |
| 唯一 `name@version` | 1732 |
| 最常见 SPDX | MIT 1382，Apache-2.0 103，ISC 100，BSD-3-Clause 59，BSD-2-Clause 32 |
| 自动扫描 UNKNOWN | 10（其中 1 个被标为生产树：`@zilliz/milvus2-sdk-node@2.3.5`，已做后续实测） |
| 自动扫描命中的 copyleft/受限声明 | 12（主要为 sharp 的 libvips 平台包，以及 `jszip` 的 MIT OR GPL-3.0-or-later） |

完整表：

- [`docs/licenses/npm-dependencies.csv`](licenses/npm-dependencies.csv)
- [`docs/licenses/npm-dependencies-unique.csv`](licenses/npm-dependencies-unique.csv)
- [`docs/licenses/npm-license-summary.json`](licenses/npm-license-summary.json)
- 后续实测更正：[`docs/licenses/npm-manual-followup.md`](licenses/npm-manual-followup.md)

**生产树中需要人工特别注意的依赖：**

| 名称 | 版本或 commit | 许可证标识 | 来源 URL |
| --- | --- | --- | --- |
| @img/sharp-libvips-*（多平台） | 1.0.4 / 1.0.5 / 0.33.5 | LGPL-3.0-or-later 或与 Apache-2.0/MIT 组合 | https://sharp.pixelplumbing.com |
| web-push | 3.6.7 | MPL-2.0 | https://www.npmjs.com/package/web-push |
| dompurify | 3.1.6（frontend）、3.3.3（server） | MPL-2.0 OR Apache-2.0 | https://www.npmjs.com/package/dompurify |
| jszip | 3.10.1 | MIT OR GPL-3.0-or-later | https://github.com/Stuk/jszip |
| xlsx | 0.20.2 | Apache-2.0（来自 SheetJS CDN tarball，不是 npm） | https://cdn.sheetjs.com/xlsx-0.20.2/xlsx-0.20.2.tgz |
| epub2 (epub2-static) | eb0a45cd41ac1a5b4c97766e9935d97583104d35 | UNKNOWN（非标准 MIT-like 文本） | https://github.com/Mintplex-Labs/epub2-static |
| @zilliz/milvus2-sdk-node | 2.3.5 | Apache-2.0（包内 LICENSE；npm 元数据缺失） | https://www.npmjs.com/package/@zilliz/milvus2-sdk-node |
| puppeteer | 21.5.2 | Apache-2.0（包）；随附 Chromium 的完整清单未审 | https://www.npmjs.com/package/puppeteer |
| tesseract.js | 6.0.1 | Apache-2.0（包）；traineddata 未审 | https://www.npmjs.com/package/tesseract.js |

静态 walker 有一个已知限制：当依赖范围是 URL（如 `xlsx@https://cdn.sheetjs.com/…`）或 yarn `npm:` 别名时，可能被标成 `lockfile-only`。`xlsx@0.20.2` 实际是 collector 生产依赖 `node-xlsx` 的传递依赖，应按“可能进入安装包”处理。

### 4.2 字体

| 名称 | 版本或 commit | 许可证标识 | 来源 URL |
| --- | --- | --- | --- |
| Plus Jakarta Sans（`frontend/public/fonts/PlusJakartaSans.ttf`，176144 字节） | 2.071；name table `2.071;TOKO;PlusJakartaSans-Regular` | OFL-1.1 | https://github.com/tokotype/PlusJakartaSans |

实证：

- 使用 fontTools 读取 nameID 13：“This Font Software is licensed under the SIL Open Font License, Version 1.1… https://scripts.sil.org/OFL”。设计者 Gumpita Rahayu，厂商 Tokotype，版权 2020 The Plus Jakarta Sans Project Authors。
- 官方 `OFL.txt`（https://raw.githubusercontent.com/tokotype/PlusJakartaSans/master/OFL.txt，200）已保存。版权行之后**没有**列出 Reserved Font Name。
- AnythingLLM 树中字体旁**没有**随附 OFL.txt。这是发行时的合规问题（L-004），不是对 OFL-1.1 标识本身的否定。

摘录：[`docs/licenses/excerpts/PlusJakartaSans-OFL-1.1.txt`](licenses/excerpts/PlusJakartaSans-OFL-1.1.txt)、[`PlusJakartaSans-name-table.txt`](licenses/excerpts/PlusJakartaSans-name-table.txt)。

### 4.3 商标、图标与品牌资产

MIT 文本未授予 “AnythingLLM”“Mintplex” 或任何第三方品牌的商标许可。媒体盘点见 [`docs/licenses/media-and-branding.csv`](licenses/media-and-branding.csv)（141 个媒体文件；已排除误匹配的源码文件）。

| 类别 | 数量 | 许可证标识 |
| --- | --- | --- |
| AnythingLLM 品牌/favicon/wordmark/宣传图 | 21 | UNKNOWN（商标；不能用根 MIT 代替） |
| 第三方供应商标志 | 57 | UNKNOWN（第三方商标） |
| 产品 UI 插画/动画等 | 62 | 未见单独第三方声明；版权问题与商标问题仍需人工看发行范围 |
| 字体 | 1 | OFL-1.1 |

前端还使用：

- `@phosphor-icons/react`：npm 声明 MIT；
- `@lobehub/icons`：npm 声明 MIT，但图标集含第三方品牌标志（L-003）。

在品牌与标志问题书面确认前，不得把这些资产当作“可以随安装包对外使用”。

### 4.4 模型权重与使用条款

源码树的 `server/storage/models/` 只是缓存目录，当前仅有 README 与 `.placeholder`，**没有**权重文件。本审查也没有下载权重。

| 名称 | 版本或 commit | 许可证标识 | 来源 URL |
| --- | --- | --- | --- |
| Xenova/all-MiniLM-L6-v2（默认 native embedder，约 23MB） | 运行时下载，不在克隆中 | Apache-2.0（HF API） | https://huggingface.co/Xenova/all-MiniLM-L6-v2 |
| sentence-transformers/all-MiniLM-L6-v2（基座） | 未下载 | Apache-2.0（HF API） | https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2 |
| Xenova/nomic-embed-text-v1（可选，约 139MB） | 运行时下载，不在克隆中 | UNKNOWN（转换仓库无 license 字段） | https://huggingface.co/Xenova/nomic-embed-text-v1 |
| nomic-ai/nomic-embed-text-v1（基座） | 未下载 | Apache-2.0（cardData.license） | https://huggingface.co/nomic-ai/nomic-embed-text-v1 |
| MintplexLabs/multilingual-e5-small（可选，约 487MB） | 运行时下载，不在克隆中 | MIT（HF API） | https://huggingface.co/MintplexLabs/multilingual-e5-small |
| intfloat/multilingual-e5-small（基座） | 未下载 | MIT（HF API） | https://huggingface.co/intfloat/multilingual-e5-small |
| Xenova/ms-marco-MiniLM-L-6-v2（native reranker） | 运行时下载，不在克隆中 | UNKNOWN（转换仓库无 license 字段） | https://huggingface.co/Xenova/ms-marco-MiniLM-L-6-v2 |
| cross-encoder/ms-marco-MiniLM-L6-v2（基座，HF 将带连字符的 id 解析到此） | 未下载 | Apache-2.0（cardData.license） | https://huggingface.co/cross-encoder/ms-marco-MiniLM-L6-v2 |
| Xenova/whisper-small（默认本地转写，约 250MB） | 运行时下载，不在克隆中 | Apache-2.0（HF API） | https://huggingface.co/Xenova/whisper-small |
| Xenova/whisper-large（可选，约 1.56GB） | 运行时下载，不在克隆中 | Apache-2.0（HF API） | https://huggingface.co/Xenova/whisper-large |
| Piper TTS 语音包 | 浏览器运行时下载，未钉死版本 | 待逐条确认；piper-tts-web README 称当前 Rhasspy 模型为 MIT；rhasspy/piper 源码 LICENSE 为 MIT | 由 `@mintplex-labs/piper-tts-web` 拉取 |
| 用户可选 GGUF / Lemonade 目录模型 | `models.json` 列出，未下载 | UNKNOWN（必须逐模型） | Hugging Face / ModelScope / 用户提供文件 |
| `cdn.anythingllm.com` 模型镜像 | TERMS_SELF_HOSTED.md 与 native embedder/reranker 源码中引用 | UNKNOWN | https://cdn.anythingllm.com/support/models/ |

`TERMS_SELF_HOSTED.md` 确认：默认 embedder 与 rerank 的 ONNX 模型可能从 Mintplex CDN 镜像下载，作为部分地区访问 Hugging Face 的回退。该 CDN 的再分发条款在本审查中标为 UNKNOWN。

### 4.5 运行时引擎与本地二进制

| 名称 | 版本或 commit | 许可证标识 | 来源 URL |
| --- | --- | --- | --- |
| lemond（内置 Lemonade 构建，Docker 路径） | 2026.40.0 | UNKNOWN（CDN 二进制未取得许可文件） | https://cdn.anythingllm.com/support/lemonade/2026.40.0 |
| lemonade-sdk/lemonade（上游源码，未钉到该 CDN 版本） | 2026-11-13 从 `main` 取得 LICENSE | Apache-2.0 | https://github.com/lemonade-sdk/lemonade |
| llama.cpp 后端（lemond 按标签拉取） | 配置钉为 `b11425`；LICENSE 取自 master（未钉到 b11425） | 源码 MIT；具体二进制 UNKNOWN | https://github.com/ggml-org/llama.cpp |
| 官方 Desktop 的 `anythingllm_lemond` | 不在本源码树 | 视为官方 Desktop 产物，不得复制 | 见第 3 节 |
| ffmpeg | 未内置；collector 在主机上查找 `ffmpeg` | UNKNOWN（取决于具体构建） | https://ffmpeg.org/legal.html |
| Puppeteer / Chromium | puppeteer 21.5.2；Chromium 不在克隆中 | 见 4.1 | https://www.npmjs.com/package/puppeteer |

源码注释写明：lemond 也可用于官方桌面，但桌面引擎标识是 `anythingllm_lemond`，与 Docker 的 `embedded_lemonade` 分开。BookSkill 不得从官方桌面包提取该引擎。

---

## 5. 需人工确认的法律问题

完整清单与事实依据见 [`docs/licenses/legal-questions.md`](licenses/legal-questions.md)。摘要：

1. **L-001** 官方 Desktop 专有条款与 MIT 源码的边界，以及 CDN/桌面引擎二进制能否被再分发。
2. **L-002** AnythingLLM / Mintplex 商标、名称、图标在 BookSkill 安装包中的使用与 MIT 署名方式。
3. **L-003** 第三方供应商标志与 `@lobehub/icons` 品牌图标。
4. **L-004** Plus Jakarta Sans 的 OFL 文本随附与修改/子集化。
5. **L-005** Native 模型、Xenova 转换仓库缺失 license 字段、以及 `cdn.anythingllm.com` 镜像条款。
6. **L-006** 用户可选 GGUF / Lemonade 目录模型须逐个审查，不得未审预置。
7. **L-007** lemond / llama.cpp CDN 或 CUDA 二进制的再分发权；是否应改为从源码自建。
8. **L-008** `epub2-static` 非标准 LICENSE，以及 registry 无 license 字段的 npm 包。
9. **L-009** LGPL（libvips）、MPL（web-push、dompurify 双许可）、jszip 双许可、ffmpeg、Chromium。
10. **L-010** BookSkill 自身源码许可证尚未选定，不得对外宣称。
11. **L-011** 未 checkout 的子模块及其依赖树是否属于发行范围。
12. **L-012** 官方 Desktop 条款中的出口管制陈述，以及第三方模型 API 条款。

---

## 6. 本审查明确没有做的事

- 没有下载模型权重、Lemonade/llama.cpp 二进制或 Puppeteer 的 Chromium。
- 没有把官方 Desktop 安装包当作审查或发布基座。
- 没有修改上游源码后再把修改结果当作已审计结论。
- 没有把上游克隆提交进本仓库。
- 没有选定或对外宣布 BookSkill 自己的 SPDX 许可证。
- 没有得出可以对外正式发行的结论。

后续若扩大发行范围（例如预置模型、捆绑 ffmpeg、启用内置 LLM 引擎、保留上游品牌），必须补做对应组件的许可审查。
