# 当前消费协议：market-v2.json

默认地址为 `https://cdn.jsdelivr.net/npm/awesome-dsh-plugin-feed@latest/data/market-v2.json`，回退到 `https://unpkg.com/awesome-dsh-plugin-feed@latest/data/market-v2.json`。`catalogBase` 支持完整 JSON URL 或旧目录地址。消费端同时接受 schema_version 1 / 2。

v2 保留 v1 仓库字段，并允许可选的 `packages`：

- `mode`: `command` 或 `manual`。
- `targets[]`: `install`、`profile`、`note`。只将 install 作为官方 Remote 的单个 spec 参数；command/source 不进入安装调用。最多保留 30 个目标。
- `tasks[]` / `requirements[]`: 功能搜索标签 / 安装要求；每组最多 30 项。
- `note` / `manual_instructions`: 展示备注或手动安装说明。

文字按 2000 字符截断；目标限制 2048 字符，接受受限 npm 包名及版本/tag、GitHub HTTPS 仓库及 tarball URL。命令、路径、凭据 URL、选项或空白不作为可直接安装目标。手动条目不自动转为直接安装。来源 profile 仅展示，实际由当前宿主管理器决定安装位置。

v2 信封还可带可选的编辑精选：

- `featured_count`: 精选条数，用于界面展示；缺失或不是非负整数时，以实际解析出的条数为准。
- `featured`: `title_zh` / `title_en`（≤60 字符，缺失时用「编辑精选」/ "Editor's Picks"）、`updated_at`、`entries[]`。
- `featured.entries[]`: `full_name`（同条目的 slug 规则）与 `reason`（≤200 字符），可选 `description`（≤300 字符）与 `packages`（与条目级 `packages` 结构相同）。

每条精选先按 `full_name`（不区分大小写）匹配 `entries[]` 中的条目，匹配时直接使用该条目（在按 `marketSize` 截断前匹配）；不在 `entries[]` 中的精选必须自带可解析的 `packages` 才会合成一张卡片，否则跳过。合成卡片优先使用精选自带的 `description`；缺失、空白或类型无效时回退到 `reason`，两者均经过文本规范化与长度限制。已匹配主列表的卡片仍使用主列表条目的描述。重复、slug 非法的精选同样跳过，最多保留 50 条，保持发布顺序。字段缺失或格式异常只会让精选不显示，不影响目录本身。

消费端缓存记录了解析格式；解析逻辑变化（如新增精选）后，旧格式的缓存不再使用，首次读取会不带 ETag 完整下载一次。

以下保留旧 v1 发布协议，仅适用于旧自定义源；其分发渠道和条数限制不代表 v2。

---

# `market.json` 发布规范（上游 awesome-dsh-plugin → 下游 safer-dsh-market）

> 本文是两仓之间的接口协议。awesome-dsh-plugin（发布方）每日生成 `data/market.json`；
> safer-dsh-market（消费方）只读这一个文件渲染市场。消费端已按本规范实现，
> 发布端按本规范生成并通过 CI 校验后，两边即接通。字段命名沿用上游快照
> `repositories.json` 的既有命名，生成逻辑是它的纯投影，不需要新的爬取。

## 1. 背景与目标

现状：下游拉取 `repositories.json`（约 2.4 MB 原始爬取）+ `curated.json`（排除名单），在
Host 侧重放过滤与削减。问题：下载大、削减规则在两个仓库各有一份、策略会漂移。

目标：**所有编辑决策（谁被排除、如何分类、如何平衡）上移到发布方**。下游变成纯消费
者——一次请求拿一个已精选的小文件（≤500 KB），本地只做校验、截断与展示排序。

非目标：不改变 `repositories.json` / `curated.json` 本身（它们继续原样发布，服务
CATALOG.md / TOP200.md 与人工分析）；不引入除 GitHub raw 之外的分发渠道。

## 2. 文件与分发

- 路径：仓库内 `data/market.json`，随 main 分支发布，消费端经
  `https://raw.githubusercontent.com/bruc3van/awesome-dsh-plugin/main/data/market.json` 读取
  （消费端配置 `catalogBase` 指向该 `data/` 目录）。
- 预览页：发布方同步生成根目录 `MARKET.md`——`market.json` 的人类可读镜像（中英双语、
  按 Star 数排名的表格），随 `market.json` 一起重建与提交，供在 GitHub 上直接预览市场
  内容而无需安装下游插件；它不属于消费接口，消费端忽略它。
- 编码：UTF-8，JSON minified（单行 + 末尾换行），不落 `null` 字段——可省略的字段直接
  不写。
- 体积上限：**500 KB**；条目数：**1–300**（发牌算法的输出上限 300，见 §5）。
- 刷新节奏：每日 cron 重建（现有 `update-catalog.yml` 里加一步）；**curation 变更合并后
  立即重建**（见 §6 发布规则），保证黑名单修正不用等次日。
- 条件请求：消费端带 `if-none-match` 走 ETag，raw.githubusercontent 已支持，无需额外处理。

## 3. 信封与条目 schema

```json
{
  "schema_version": 1,
  "generated_at": "2026-08-16T01:30:00Z",
  "source_fetched_at": "2026-08-16T01:27:18Z",
  "source_repo_count": 2578,
  "pool_count": 2124,
  "entries": [
    {
      "id": 912345678,
      "full_name": "owner/repo",
      "description": "一句话简介（≤300 字符，已清洗）",
      "stargazers_count": 1234,
      "language": "TypeScript",
      "license": "MIT",
      "pushed_at": "2026-08-14T09:12:33Z",
      "default_branch": "main",
      "category": "agents-workflows",
      "category_zh": "代理与工作流",
      "category_en": "Agents & Workflows"
    }
  ]
}
```

信封字段：

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `schema_version` | 整数 | 恒为 `1`（演进规则见 §7） |
| `generated_at` | 字符串 | 本次生成时刻，ISO 8601 UTC，单调不减 |
| `source_fetched_at` | 字符串 | 来源快照 `repositories.json` 的 `fetched_at`，原样透传 |
| `source_repo_count` | 整数 | 来源快照的 `total_count`（爬取到的仓库总数） |
| `pool_count` | 整数 | 过滤管线之后、发牌之前的候选池大小（诊断用，含熔断，见 §6） |
| `entries` | 数组 | **按发牌顺序排列**（不是 star 顺序！），1–300 条 |

条目字段（全部必写，除注明可省略）：

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| `id` | 正整数 | GitHub 仓库 id，跨改名/转移稳定；整个文件内唯一 |
| `full_name` | 字符串 | `owner/name`，与 GitHub API 返回的 canonical 形式**逐字一致**（大小写敏感），匹配 `^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$` |
| `description` | 字符串 | 清洗后 ≤300 字符（按 Unicode 码点计数），纯文本 |
| `stargazers_count` | 整数 | ≥ 0 |
| `language` | 字符串 | ≤40 字符，无则空串 |
| `license` | 字符串 | SPDX id（`license.spdx_id`），无则空串（不写 `null`） |
| `pushed_at` | 字符串 | ISO 8601 时间戳，≤30 字符 |
| `default_branch` | 字符串 | 必须通过下方分支白名单，否则写 `"main"` |
| `category` / `category_zh` / `category_en` | 字符串 | 必须是 `scripts/categories.mjs` 中的合法类目键（含 fallback 类目）；`category` 非空 ≤60 字符，中英文标签非空 ≤60 字符 |

**刻意不存在的字段**：`html_url`、`homepage`、`topics`、一切富文本/HTML。下游从
`full_name` 重建 `https://github.com/<full_name>` 链接，从不采信文件里的地址——发布端
不要加这些字段，加了也会被消费端忽略。

**分支白名单**（与消费端逐字一致，`default_branch` 不合规即回落 `main`）：

- 匹配 `^[A-Za-z0-9][A-Za-z0-9._/-]*$`；
- 不含 `..` 与 `//`；不以 `/` 或 `.` 结尾；
- 按 `/` 切分后，任一段不得为 `.`、不得以 `.lock` 结尾。

**文本清洗规则**（与消费端逐字一致）：所有文本字段先 `/\s+/g → ' '` 折叠空白并
trim，再按码点截断到上限；截断时以 `…` 结尾，且不得切在代理对中间。

## 4. 生成管线

输入：`data/repositories.json` + `data/curated.json`（两者保持现状不动）。新脚本
（建议 `scripts/market.mjs`，由 `update.mjs` 之后调用，支持 `--from-snapshot` 同款开关）
按以下顺序执行：

1. **过滤**（顺序即规则）：
   - `description` 存在且 `trim()` 非空；
   - `archived !== true` 且 `disabled !== true`；
   - 不在 `curated.json` 的 `excluded_repos` 与 `leaderboard_exclusions` 中
     （键匹配**大小写不敏感**，与现有 `update.mjs` 一致）；
   - （可选加固，建议一并实现）若 `curated.json` 增加了 `excluded_repo_ids`
     （`id → reason` 映射），同样按 `id` 排除——使黑名单在仓库改名后不失效；
   - 不在发布端自排除表：
     `bruc3van/dsh-desktop`、`bruc3van/safer-dsh-market`、
     `bruc3van/awesome-dsh-plugin`；
   - 类目可判定（规则匹配或 override 命中；`category_overrides` 沿用现有逻辑，键
     大小写不敏感）。
2. **清洗**：按 §3 的规则处理每个字段（截断、折叠空白、SPDX、分支白名单回落）。
3. **去重**：按 `id` 去重（快照本身已按 id 去重，此步是防御）。
4. **均衡发牌**（决定 `entries` 的顺序，必须确定性）：
   - 按类目分桶；桶内按 `stargazers_count` 降序、`full_name` 升序（码点序，**不用**
     `localeCompare`——它是环境相关的）；
   - 类目间按「各自最强条目的 star 数」降序排列，平手按类目键升序；
   - 逐轮发牌：第 r 轮按类目顺序各取桶内第 r 条，直到取满 **300** 条或桶全部取尽；
   - `entries` 按发牌先后排列，**不重排**。发牌顺序保证任何前缀都是"每类先出最强、
     再出次强"的平衡名单——下游在这个顺序上截断到它配置的 `marketSize`（默认 1000）。
5. **写出**：minified JSON 写入 `data/market.json`，同时把 `pool_count`（第 1 步之后、
   第 4 步之前的条数）写进信封；并把同一信封渲染为根目录 `MARKET.md` 预览页（见 §2，
   仅渲染已发布内容，熔断中止时不动它）。

## 5. 顺序不变量（CI 可校验）

对文件中每个类目：该类目条目在 `entries` 中出现的子序列，其 `stargazers_count` 必须
非增。这是发牌顺序的特征，也是 CI 里最值得测的结构性质（能抓住排序与截断的大多数
实现错误）。

## 6. 发布规则

- **每日**：`update-catalog.yml` 在刷新快照后调用生成步骤，与现有提交一起 push。
- **curation 合并后立即生效**：`validate-curated.yml` 已在 PR 里跑
  `update.mjs --from-snapshot`；扩展为合并到 main 后（或 PR 分支上）一并重建
  `data/market.json` 并提交。**否则黑名单修正要等到次日 cron 才反映到下游市场。**
- **熔断**：写出前与上一版已提交的 `market.json` 比较——若新 `pool_count` 小于上一版
  的 60%，或 `entries` 为空，**中止发布**（脚本非零退出、不写文件），保留昨日数据并
  在 workflow summary 里报警。这是防「爬取半途失败把市场清空」的安全阀。
- `generated_at` 必须单调不减；快照未变时（304 世界里 diff 为空）不重复提交。

## 7. 演进规则

- **加可选字段**：不升版本，消费端会忽略未知字段。
- **改语义 / 删字段 / 改顺序含义**：升 `schema_version`，新旧版本并存一个过渡期
  （如 `market.json` 与 `market.v2.json`），通知下游切换后再退役旧版。
- 消费端只认 `schema_version === 1`，遇到其它版本报错并提示升级插件——不会静默
  渲染错数据。

## 8. CI 校验清单（发布端 validator，建议 `scripts/validate-market.mjs`）

对每次生成与 PR：

1. 信封字段齐全、类型正确、`schema_version === 1`；
2. 每条 `full_name` 匹配 slug 模式；`id` 与 `full_name` 各自全文件唯一；
3. 不含 `excluded_repos` / `leaderboard_exclusions` / 自排除表中的任何仓库
   （`full_name` 大小写不敏感比对，有 `excluded_repo_ids` 时同时按 `id` 比对）；
4. 每条 `category` 是合法类目键；中英文标签非空；
5. 每条 `default_branch` 通过分支白名单；
6. §5 的顺序不变量成立；
7. `entries.length` 在 1–300；文件体积 ≤ 500 KB；
8. 文本字段全部通过清洗规则（折叠后不超上限）。

## 9. 验收清单（上游实现的 DoD）

- [ ] `scripts/market.mjs` 从快照 + curation 生成 `data/market.json`，支持
      `--from-snapshot`；
- [ ] `update-catalog.yml` 每日生成并提交；`validate-curated.yml` 在 curation 合并
      路径上重建 `market.json`；
- [ ] `scripts/validate-market.mjs` 实现 §8 全部检查并接入两个 workflow；
- [ ] 熔断逻辑（§6）有测试：构造 pool 骤减的输入，断言不写文件；
- [ ] 用当前真实快照生成一次，人工抽查：无黑名单仓库、无自排除仓库、冷门类目仍
      有席位、文件 < 500 KB；
- [ ] README（中英）在 data 说明处补一段 `market.json` 的介绍与指向本规范的链接。
