# DSH Market Pro消费协议

## 默认 schema 3：market-catalog.json

默认地址为 `https://cdn.jsdelivr.net/npm/awesome-dsh-plugin-feed@latest/data/market-catalog.json`，回退到同包的 unpkg 地址。上游 `scripts/safe-market-catalog.mjs` 在 npm 打包时生成，不提交另一份全量生成文件。

- `schema_version: 3`。
- `source_fetched_at` / `source_repo_count`：爬取快照时间和扫描仓库数。
- `repository_count` / `entries[]`：与仓库完整目录使用同一个 `catalogRepositories` 审核、描述和排除规则（`excluded_repos`、`market_exclusions`、`leaderboard_exclusions` 与发布者自排除——榜单排除等于市场排除），不套用旧市场的 1000 条限制。保留归档、禁用状态。
- 仓库条目保留 `full_name`、描述、Star、语言、许可证、更新时间、默认分支和分类；可含 `packages` 安装映射、`install_status`（`command` / `manual` / `none`）、关联订阅插件的 `keywords`，以及该插件的 `title_zh` / `title_en` / `description_en`（有订阅插件的仓库用插件级文案替代仓库简介）。`install_status` 是发布方的显式信号：`command` 走官方插件管理器直接安装；`manual` / `none` 表示该仓库没有可直接执行的安装目标，客户端改为生成「AI 核对安装」提示词（填入会话草稿，不自动发送），由 AI 核实仓库、包归属或子目录后再安装——不隐藏条目，也不伪造安装目标。
- `subscription`：已发布的完整 format-1 `dsh-market-index.json`；插件身份、顺序、分类、关键词、Logo、版本与安装来源保持原样。
- `featured`：编辑精选块（`title_zh` / `title_en` / `updated_at` / `entries[{ full_name, description }]`），数据来自上游 `data/featured.json`；同一份数据同时决定官方 format-1 索引里的 `featured` 标签（「编辑推荐」）。该块存在时，「精选」与「订阅」是两个独立页签；不存在时（旧 feed）「精选」仍回退为整个订阅。
- `subscription_sha256` / `subscription_updated_at`：原始订阅文件摘要和生成报告时间。打包前核对索引摘要、插件数量和 `fetchFailures: 0`，不打包与报告不一致的结果。

「精选」按 `featured.entries[]` 的顺序展示编辑精选：每个条目先按仓库匹配订阅插件（采用插件身份与安装目标），再回退到目录行，推荐语使用精选块里的 `description`；精选仓即使被榜单排除（如 `tw93/Mole`）也能出现，未通过来源核验（体积上限、private 包、同名重复等）的条目在官方索引里没有 `featured` 标签，但仍在市场「精选」页签中，没有一键目标时走 AI 核对安装。

「订阅」逐一适配 `subscription.plugins`，按插件包名区分身份；不使用其中 `featured` 标签缩小范围，也不再限制为 50 条。缺少仓库地址的 npm 插件保留，链接指向其 npm 页面。分类使用订阅的 `metadata.categories` 和插件自己的分类；关键词与标签中英文名称参与搜索。重复包名、无效安装来源或缺少订阅将使本次读取失败，保留上次有效缓存，不静默发布部分订阅。

订阅（以及精选里采用插件身份的卡片）安装目标取订阅首个版本：npm 使用 `name@version`，Git 使用 HTTPS 仓库、完整提交和可选的 `path:` 子目录。安装前仍由当前宿主执行 `inspect` 和 `installBundle`。宿主版本要求在详情中展示，过长的显示文本带省略号，安装目标不截断。

Logo 支持订阅内联的 SVG、PNG、JPEG、WebP、GIF 图片及 HTTPS 图片，通过图片元素展示并懒加载；无图或加载失败显示名称首字母。仓库卡片复用关联订阅插件已提供的图标。

「全部」按仓库计数，订阅按插件包计数，精选按推荐条目计数。schema 3 忽略旧 `marketSize` 截断，数量随发布变化；各列表先对完整数据筛选，再每页显示 50 条。**「全部」展示完整目录**（约 2.7 万条，不默认过滤），每张卡片都可点「安装」，由 `install_status` 决定走直接安装还是 AI 核对安装提示词。精选、订阅与全部使用各自的分类计数。包级已安装状态按精确包名匹配，避免同仓库其他插件被误标为已安装。

## 兼容 schema 2：market-v2.json

自定义 schema 2 URL 继续支持，`marketSize` 仅对它生效；上游自 2026-11-18 起不再发布 market-v2，内置旧地址仍自动迁移到 schema 3 目录。自定义 URL 仍原样请求，不自动补文件名。不支持 schema 1。

旧条目的可选 `packages` 包含 `mode`、`targets[]`、`tasks[]`、`requirements[]`、`note` 和 `manual_instructions`。只把校验过的 `install` 作为官方 Remote 的单个参数，命令与来源描述不作为可执行命令。手动安装条目不自动转换。

旧 `featured` / `featured_count` 按 `full_name` 匹配仓库，允许携带内联安装信息；保持旧的 50 条解析上限。该兼容逻辑不影响 schema 3 的订阅精选。

## 缓存与发布

解析格式已升级，旧缓存完整下载一次；后续保留 ETag、持久化缓存、手动刷新及默认 CDN 回退。npm 包的数据摘要包括新全量目录，订阅或全量目录单独变化也会产生新版本。npm 发布接在官方订阅成功发布之后，避免先打包旧订阅；工作流同时清理新文件的 CDN 别名缓存。
