# DSH Market Pro消费协议

## 默认 schema 3：market-catalog.json

默认地址为 `https://cdn.jsdelivr.net/npm/awesome-dsh-plugin-feed@latest/data/market-catalog.json`，回退到同包的 unpkg 地址。上游 `scripts/safe-market-catalog.mjs` 在 npm 打包时生成，不提交另一份全量生成文件。

- `schema_version: 3`。
- `source_fetched_at` / `source_repo_count`：爬取快照时间和扫描仓库数。
- `repository_count` / `entries[]`：与仓库完整目录使用同一个 `catalogRepositories` 审核、描述和排除规则，不套用旧市场的 1000 条限制或榜单排除规则。保留归档、禁用状态。
- 仓库条目保留 `full_name`、描述、Star、语言、许可证、更新时间、默认分支和分类；可含 `packages` 安装映射和关联订阅插件的 `keywords`。
- `subscription`：已发布的完整 format-1 `dsh-market-index.json`；插件身份、顺序、分类、关键词、Logo、版本与安装来源保持原样。
- `subscription_sha256` / `subscription_updated_at`：原始订阅文件摘要和生成报告时间。打包前核对索引摘要、插件数量和 `fetchFailures: 0`，不打包与报告不一致的结果。

「精选」逐一适配 `subscription.plugins`，按插件包名区分身份；不使用其中 `featured` 标签缩小范围，也不再限制为 50 条。缺少仓库地址的 npm 插件保留，链接指向其 npm 页面。分类使用订阅的 `metadata.categories` 和插件自己的分类；关键词与标签中英文名称参与搜索。重复包名、无效安装来源或缺少订阅将使本次读取失败，保留上次有效缓存，不静默发布部分精选。

精选安装目标取订阅首个版本：npm 使用 `name@version`，Git 使用 HTTPS 仓库、完整提交和可选的 `path:` 子目录。安装前仍由当前宿主执行 `inspect` 和 `installBundle`。宿主版本要求在详情中展示，过长的显示文本带省略号，安装目标不截断。

Logo 支持订阅内联的 SVG、PNG、JPEG、WebP、GIF 图片及 HTTPS 图片，通过图片元素展示并懒加载；无图或加载失败显示名称首字母。仓库卡片复用关联订阅插件已提供的图标。

「全部」按仓库计数，精选按插件包计数。schema 3 忽略旧 `marketSize` 截断，数量随发布变化；两个列表先对完整数据筛选，再每页显示 50 条。精选与全部使用各自的分类计数。包级已安装状态按精确包名匹配，避免同仓库其他插件被误标为已安装。

## 兼容 schema 2：market-v2.json

自定义 schema 2 URL 继续支持，`marketSize` 仅对它生效；内置 jsDelivr / unpkg 的旧 `@latest/data/market-v2.json` 地址自动迁移到新目录。自定义 URL 仍原样请求，不自动补文件名。不支持 schema 1。

旧条目的可选 `packages` 包含 `mode`、`targets[]`、`tasks[]`、`requirements[]`、`note` 和 `manual_instructions`。只把校验过的 `install` 作为官方 Remote 的单个参数，命令与来源描述不作为可执行命令。手动安装条目不自动转换。

旧 `featured` / `featured_count` 按 `full_name` 匹配仓库，允许携带内联安装信息；保持旧的 50 条解析上限。该兼容逻辑不影响 schema 3 的订阅精选。

## 缓存与发布

解析格式已升级，旧缓存完整下载一次；后续保留 ETag、持久化缓存、手动刷新及默认 CDN 回退。npm 包的数据摘要包括新全量目录，订阅或全量目录单独变化也会产生新版本。npm 发布接在官方订阅成功发布之后，避免先打包旧订阅；工作流同时清理新文件的 CDN 别名缓存。
