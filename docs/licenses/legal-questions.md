# GOV-001 需人工确认的法律问题

本文只列出问题，不给出“可以发行”或“已经批准”的结论。在负责人书面确认之前，不得把 AnythingLLM 源码、官方桌面二进制、商标、字体、模型或第三方标志放入公开发行的 BookSkill 安装包。

## L-001 官方 Desktop 条款与 MIT 源码不是同一许可

- 事实：https://docs.anythingllm.com/installation-desktop/terms（页面标明版本 2025-07-14）声明其仅适用于 AnythingLLM Desktop，并授予不可转让的个人/内部使用许可，同时限制修改、再分发、再许可和逆向工程。
- 事实：同一页面写明其他产品与服务适用各自条款（MIT）。仓库根许可证与 `TERMS_SELF_HOSTED.md` 将核心源码表述为 MIT。
- 问题：BookSkill 基于源码构建的桌面安装包，是否会被第三方或权利人视为受官方 Desktop 条款约束？官方桌面使用的 `anythingllm_lemond` 引擎与 CDN 上的 `lemond` 构建是否允许被再分发？
- 明确禁止：不得包装或再分发官方 Desktop 二进制。

## L-002 商标、名称与品牌资产

- 事实：MIT 许可证不授予商标权。仓库中含 AnythingLLM / Mintplex 名称、图标、favicon、wordmark 及宣传图，见 `media-and-branding.csv`。
- 问题：BookSkill 产品名称、图标与安装包是否必须完全去除这些标志？何种署名（copyright notice）是 MIT 所要求、且不构成商标使用？
- 产品自身名称与图标仍待负责人决定（见 `docs/DECISIONS.md`）。

## L-003 第三方供应商标志

- 事实：`frontend/src/media/` 下有至少 57 个供应商/产品标志；前端还依赖 `@lobehub/icons`（npm 声明 MIT，但图标集含品牌标志）。
- 问题：在安装包或设置页中展示 OpenAI、Anthropic、Google 等标志，是否构成商标合理使用，或需要另行授权？若不能使用，是否应在发行前替换为中性文案/自绘图标？

## L-004 Plus Jakarta Sans（OFL-1.1）通知与保留名称

- 事实：内嵌字体 `frontend/public/fonts/PlusJakartaSans.ttf` 的 name table 声明 SIL OFL 1.1；官方 OFL.txt 已从 https://github.com/tokotype/PlusJakartaSans 取得。AnythingLLM 树中未在字体旁放置 OFL.txt。官方 OFL.txt 的版权行之后未列出 Reserved Font Name。
- 问题：发行安装包时如何满足 OFL 的许可文本随附要求？若对字体做子集化或改名，是否触发保留字体名称条款？

## L-005 运行时模型与 CDN 镜像条款

- 事实：默认/可选本地模型由 `@xenova/transformers` 在运行时下载，并可回退到 `https://cdn.anythingllm.com/support/models/`。部分 Xenova 转换仓库（`Xenova/nomic-embed-text-v1`、`Xenova/ms-marco-MiniLM-L-6-v2`）在 Hugging Face API 上没有 license 字段，尽管其基座模型卡片为 Apache-2.0。CDN 本身未在本审查中找到可引用的镜像许可文件。
- 问题：BookSkill 是否允许默认打开 native embedder / whisper / reranker 并触发这些下载？转换仓库与基座模型的许可是否视为同一？CDN 镜像是否允许再分发或预置到安装包？
- 本审查未下载任何模型权重。

## L-006 用户可选 GGUF / Lemonade 目录模型

- 事实：`embeddedLemonade/models.json` 列出 Llama、Qwen、Gemma、gpt-oss 等模型，将从 Hugging Face 或 ModelScope 下载。各模型有独立且可能受限的条款。
- 问题：安装包是否预置任何 GGUF？默认推荐模型是否包含限制商用或限制再分发的权重？需要逐模型审查后才能放入安装包。

## L-007 lemond / llama.cpp 二进制再分发

- 事实：Docker/内置引擎会从 `cdn.anythingllm.com/support/lemonade/2026.40.0` 获取 lemond，并按 `b11425` 拉取 llama.cpp 后端；CUDA 构建来自 lemonade-sdk 自己的标签。lemonade 源码仓库主分支 LICENSE 为 Apache-2.0，llama.cpp 源码 LICENSE 为 MIT，但本审查未哈希 CDN 二进制，也未取得与该 URL 捆绑的许可文件。
- 问题：BookSkill 是否必须从源码自行构建这些引擎，而不是再分发 Mintplex CDN 二进制？CDN 产物的再分发权是什么？

## L-008 版权声明不完整或元数据缺失的依赖

- `epub2` 使用 git 依赖 `Mintplex-Labs/epub2-static@eb0a45cd41ac1a5b4c97766e9935d97583104d35`。其 LICENSE 类似 MIT，但缺少标准 MIT 中“必须保留版权与许可声明”的条件段。npm 上原包声明为 ISC，与该 fork 文本不一致。法律定性待确认。
- 若干 npm 包的 registry `license` 字段为空（如 `cohere-ai@7.9.5`、`voyageai@0.0.3`、`buffers@0.1.1` 等）。即使当前 walker 未把它们标为生产树，也不得假定可以自由分发。
- `@zilliz/milvus2-sdk-node@2.3.5` 的 npm 元数据无 license 字段；随后在已发布包的 LICENSE 文件中测得 Apache-2.0。若包含该连接器，仍需随附 Apache 声明。

## L-009 强 copyleft 或需选择许可的组件

- `sharp` 的 `@img/sharp-libvips-*` 平台包声明 `LGPL-3.0-or-later`，且 sharp 是 collector 生产依赖。对应源码提供、动态链接或替换义务待确认。
- `web-push@3.6.7` 为 `MPL-2.0`（server 生产依赖）。
- `dompurify` 为 `MPL-2.0 OR Apache-2.0`。
- `jszip@3.10.1` 为 `MIT OR GPL-3.0-or-later`，若选择 MIT 需留下书面记录。
- 若安装包附带 ffmpeg 或 Puppeteer/Chromium，还需对具体构建做许可证盘点（Chromium 第三方清单、ffmpeg 的 GPL/LGPL 与外部库）。

## L-010 产品自身许可证尚未选定

- 按项目决策，GOV-001 完成并经负责人批准前，不得自行选定并对外宣称 BookSkill 的源码许可证。
- 问题：BookSkill 自有代码将采用何种 SPDX 许可证？如何与上游 MIT 署名要求、以及上述 copyleft 组件共存？

## L-011 子模块与未展开的依赖树

- `embed` 与 `browser-extension` 子模块在本审查克隆中未 checkout。已按 pinned commit 取得根 LICENSE（均为 MIT），但未扫描它们的第三方 lockfile。
- 若桌面产品不需要浏览器扩展或嵌入式聊天挂件，应在发行范围中明确排除。

## L-012 出口管制与第三方服务条款

- 官方 Desktop 条款含美国出口管制与制裁陈述。该文本是否以及如何适用于基于 MIT 源码的再分发，需法律意见。
- 用户若启用 OpenAI 等外部服务，受那些服务自己的条款约束（`TERMS_SELF_HOSTED.md` 已提示）。这不影响源码许可，但影响默认集成是否应出现在公开发行说明中。
