# FIXT-001：许可测试材料（VERT-001 前置）

- ID：FIXT-001
- 目标：为导入/阅读/薄切片准备自有或人工合成的 PDF、EPUB、Markdown、TXT 测试样本，并附许可证与校验脚本。不得使用无授权整本书。
- 负责人 Agent：product
- 依赖：无
- 输入/受影响模块：仅 `fixtures/**`、`docs/fixtures/**`
- 允许工具：生成本项目原创/合成文本、打包 PDF/EPUB、写校验脚本与测试
- 禁止操作：把《孙子兵法》《道德经》《论语》或其他无授权整书拷入仓库；修改 GOV/REPO/BOT/治理文件；推送 main；声称材料可替代真实用户书籍
- 状态：Done

## 验收条件（可测试）

1. 至少各有一份测试用 EPUB、文本型 PDF、Markdown、TXT，内容为项目原创合成文本，含至少两个章节/可定位段落。
2. `fixtures/LICENSE.md` 声明这些样本的许可（建议 CC0-1.0 或项目原创允许作为测试数据），并写明不是第三方著作。
3. `fixtures/manifest.json` 记录文件名、格式、SHA-256、章节数。
4. `python3 docs/fixtures/verify_fixt001.py` 在材料缺失、hash 不符或混入已知第三方书名正文时非零退出；材料完整时退出码 0。

## 测试命令

```bash
python3 docs/fixtures/verify_fixt001.py
```

## 交付物路径

- `fixtures/`
- `docs/fixtures/verify_fixt001.py`
- `docs/fixtures/FIXT-001-REPORT.md`
- `docs/fixtures/pull-request.md`

## 失败升级条件

生成工具缺失则改用纯 Python 最小 PDF/EPUB 实现；最多重试 2 次。
