# docs/licenses — GOV-001 清单与摘录索引

本目录存放上游许可证审查的可检查产物。它不是法律批准书，也不授权公开发行。

| 文件 | 说明 |
| --- | --- |
| `../UPSTREAM-LICENSES.md` | 审查主报告 |
| `upstream-checkout.md` | 上游 URL、分支、commit、检出时间 |
| `component-inventory.csv` | 将进入或可能进入安装包的主要组件清单 |
| `npm-dependencies.csv` | frontend/server/collector 的 yarn.lock 解析结果（含工作区） |
| `npm-dependencies-unique.csv` | 去重后的 name@version 与 npm registry 许可证字段 |
| `npm-license-summary.json` | 扫描统计、UNKNOWN 与 copyleft 列表 |
| `npm-manual-followup.md` | 对 registry 扫描的后续实测更正 |
| `media-and-branding.csv` | 字体、图标、商标与媒体文件盘点 |
| `legal-questions.md` | 需人工确认的法律问题 |
| `excerpts/` | 已实测的许可证文本摘录（不含密钥或模型权重） |
| `verify_gov001.py` | 交付物与越权结论检查脚本 |

自动化 npm 扫描日志：`/tmp/gov001-logs/npm-license-scan.log`。克隆日志：`/tmp/gov001-logs/clone.log`。
