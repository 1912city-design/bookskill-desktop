# npm registry 扫描的后续实测

`npm-dependencies-unique.csv` 由脚本根据 **npm registry 的 `license` 字段** 生成。下列条目在自动扫描之后用原始许可证文本做了核对。更正不改变“未经人工批准不得公开发行”的立场。

| 名称 | 版本或 commit | 自动扫描结果 | 后续实测 | 证据 | 是否可能进入安装包 |
| --- | --- | --- | --- | --- | --- |
| xlsx | 0.20.2 | UNKNOWN（npm 404） | Apache-2.0 | 锁文件解析自 `https://cdn.sheetjs.com/xlsx-0.20.2/xlsx-0.20.2.tgz`；包内 `package.json` 与 `LICENSE` 均为 Apache-2.0。该版本不在 npm（npm 上观察到的 latest 为 0.18.5，不得混用）。它是 collector 生产依赖 `node-xlsx@0.24.0` 的传递依赖；自动 walker 因依赖范围为 URL 而未把它标进生产树。 | yes |
| @zilliz/milvus2-sdk-node | 2.3.5 | UNKNOWN（registry 无 license 字段） | Apache-2.0 | `https://unpkg.com/@zilliz/milvus2-sdk-node@2.3.5/LICENSE` 与 GitHub `milvus-io/milvus-sdk-node` tag `v2.3.5` 的 LICENSE 一致，均为 Apache-2.0。已发布的 `package.json` 仍无 `license` 字段。 | yes（server 生产依赖） |
| epub2 (epub2-static fork) | eb0a45cd41ac1a5b4c97766e9935d97583104d35 | ISC（若按 npm 包名查询会误导） | UNKNOWN（非标准 MIT-like 文本） | 锁文件指向 git 仓库。pinned commit 的 LICENSE 有许可授权段，但缺少标准 MIT 的署名条件段。 | yes（collector 生产依赖） |
| string-width-cjs@npm:string-width 等 yarn alias | 4.2.3 / 6.0.1 / 7.0.0 | UNKNOWN（对 alias 名请求 registry 返回 404） | 见对应的 `string-width` / `strip-ansi` / `wrap-ansi` 条目（扫描结果为 MIT） | 这是 yarn 的 `npm:` 协议别名，resolved 指向 registry.yarnpkg.com 上的原包 tarball。 | 视构建而定；别名本身不是独立许可证 |

其他 registry 字段为空、仍保持 UNKNOWN 的包：`buffers@0.1.1`、`cohere-ai@7.9.5`、`combine-errors@3.0.3`、`seq-queue@0.0.5`、`voyageai@0.0.3`。不得把它们猜测为可自由分发。
