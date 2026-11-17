# 当前消费协议：market-v2.json

默认地址为 `https://cdn.jsdelivr.net/npm/awesome-dsh-plugin-feed@latest/data/market-v2.json`，回退到 `https://unpkg.com/awesome-dsh-plugin-feed@latest/data/market-v2.json`。`catalogBase` 必须填写完整的 v2 JSON URL（可以含查询参数），消费端原样请求，不再自动补文件名。仅接受 `schema_version: 2`；上游已废弃的 `market.json` 和 schema 1 不再支持。旧自定义源需切换到 v2 URL。

v2 提供仓库字段，并允许可选的 `packages`：

- `mode`: `command` 或 `manual`。
- `targets[]`: `install`、`profile`、`note`。只将 install 作为官方 Remote 的单个 spec 参数；command/source 不进入安装调用。最多保留 30 个目标。
- `tasks[]` / `requirements[]`: 功能搜索标签 / 安装要求；每组最多 30 项。
- `note` / `manual_instructions`: 展示备注或手动安装说明。

文字按 2000 字符截断；目标限制 2048 字符，接受受限 npm 包名及版本/tag、GitHub / Gitee HTTPS 仓库及 GitHub tarball URL。命令、路径、凭据 URL、选项或空白不作为可直接安装目标。手动条目不自动转为直接安装。来源 profile 仅展示，实际由当前宿主管理器决定安装位置。

v2 信封还可带可选的编辑精选：

- `featured_count`: 精选条数，用于界面展示；缺失或不是非负整数时，以实际解析出的条数为准。
- `featured`: `title_zh` / `title_en`（≤60 字符，缺失时用「编辑精选」/ "Editor's Picks"）、`updated_at`、`entries[]`。
- `featured.entries[]`: `full_name`（同条目的 slug 规则）与 `reason`（≤200 字符），可选 `description`（≤300 字符）与 `packages`（与条目级 `packages` 结构相同）。

每条精选先按 `full_name`（不区分大小写）匹配 `entries[]` 中的条目，匹配时直接使用该条目（在按 `marketSize` 截断前匹配）；不在 `entries[]` 中的精选必须自带可解析的 `packages` 才会合成一张卡片，否则跳过。合成卡片优先使用精选自带的 `description`；缺失、空白或类型无效时回退到 `reason`，两者均经过文本规范化与长度限制。已匹配主列表的卡片仍使用主列表条目的描述。重复、slug 非法的精选同样跳过，最多保留 50 条，保持发布顺序。字段缺失或格式异常只会让精选不显示，不影响目录本身。

消费端缓存记录了解析格式；解析逻辑变化（如新增精选）后，旧格式的缓存不再使用，首次读取会不带 ETag 完整下载一次。
