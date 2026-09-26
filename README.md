# safer-dsh-market

包名已由 `dsh-desktop-safe-market` 改为 `safer-dsh-market`。新名称需要单独发布到 npm 并配置 Trusted Publisher；旧包不会自动升级为新包。迁移时先停用旧插件，再安装并启用新插件，按需重新设置原来的配置。缓存和待卸载记录继续沿用原存储路径。GitHub 仓库同步更名为 `bruc3van/safer-dsh-market`。

**发现插件，按需安装。**

中文 | [English](./README_EN.md)

基于 awesome-dsh-plugin-feed 推荐目录的 DeepSeek Harness 插件市场，支持按名称、安装包名、功能标签和分类搜索。

默认使用 **精简安装（直接安装）**：点击推荐卡片，选择并确认安装目标，调用当前宿主的官方插件管理器检查、安装并启用。无需工作区，不发送提示词。安装前展示要求和备注；需要执行依赖脚本时单独确认，支持取消及连接中断后的结果查询。安装结果区分已生效、需要重启、被配置覆盖、失败和取消。

也可切换到 **提示词安装（AI 审查）**，保留原来的会话审查流程。插件升级和市场自身升级仍使用审查提示词。直接安装不会执行 AI 安全审查，目录收录及 README 核验均不等于安全或兼容保证。

`packages.targets[].install` 是直接安装目标，`command` 不会被执行。多目标由用户选择，每次只安装一个；来源中的 profile 仅作参考，实际操作当前宿主的 profile。`manual` 条目或缺少合法目标的条目提供说明，不猜测安装地址。直接安装需要宿主提供 `pluginManager` Remote（本项目兼容基线为 0.1.7-rc.2）。

## 两种查看方式

**方式一：左侧导航。** 点击「新会话」下方、「工作区」上方的「安全市场」，在中间主区域浏览。准备好安装提示词后会自动回到对话。

**方式二：右侧栏。** 打开一个会话，点击「打开右侧边栏」，在「开始」页选择「安全市场」，即可在侧栏标签页中浏览。

两种方式共用市场开关和操作逻辑。左侧导航需要 DSH 提供全局面板及侧栏导航插槽；右侧栏入口需要右侧 Sidebar 服务。

## 界面与操作

- **入口**：保留左侧导航和右侧栏，设置页不再重复提供市场入口。
- **刷新市场**：右上角读取最新市场目录，刷新中显示状态并禁止重复点击。
- **更多操作（⋯）**：包含「升级市场插件」、[GitHub 仓库](https://github.com/bruc3van/safer-dsh-market)和[联系作者](https://x.com/bruc3van)。升级仍先准备审查提示词。
- **滚动浏览**：标题、副标题、标签栏和搜索区域固定；分类与卡片列表独立滚动。宽度足够时，向后浏览会把搜索框带动效移到标签栏右侧，反向滚动恢复；窄侧栏保留整行搜索。
- **回到顶部**：列表滚动超过约半屏（至少 240px）后，右下角显示按钮，返回当前列表顶部；支持系统减少动效偏好。

## 它解决什么问题

装插件本质上是在自己的机器上运行别人写的代码。普通目录回答「有哪些插件」，然后把风险留给你的那一次点击；「这个插件安全吗」始终无人回答——而它恰恰是你点安装那一刻真正在赌的东西。

这个插件连接社区推荐数据与官方安装能力：按用途发现插件，直接确认安装；需要 AI 审查时切换到提示词模式。

## DSH 版本兼容

**Safe Market 0.7.2 最低要求 DSH `0.1.7-rc.2`，不兼容旧版宿主。** 本次升级迁移到了新版接口，没有保留旧版回退路径；不兼容 DSH 0.1.1 和 0.1.2 系列，也不兼容 0.1.5 系列。请先确认宿主版本，再选择对应的插件版本。

| DSH 宿主版本 | 应使用的插件版本 | npm 安装目标 |
| --- | --- | --- |
| `0.1.7-rc.2`（当前适配并验证的版本） | `0.7.2` | `safer-dsh-market@0.7.2` |
| `0.1.5` 系列，最低 `0.1.5-rc.1` | `0.5.2` | `dsh-desktop-safe-market@0.5.2` |
| `0.1.2` 系列，最低 `0.1.2-alpha.3` | `0.4.3` | `dsh-desktop-safe-market@0.4.3` |
| `0.1.1` 系列 | `0.3.0` | `dsh-desktop-safe-market@0.3.0` |

**旧宿主请固定插件版本，不要直接安装 `latest` 或使用不带版本号的包名升级。** 例如，继续使用 DSH `0.1.5` 时：

```sh
dsh plugin --profile web add dsh-desktop-safe-market@0.5.2
```

升级到插件 `0.7.2` 时，先将 DSH 升级到 `0.1.7-rc.2`。市场开关现在由宿主保存在当前 profile 的 `cordis.patch.yml` 中，即时生效并在重启后保留。旧版 `settings.yaml` 中的 `safe-market` 设置不会自动迁入；升级后若市场关闭，请在页面上重新启用一次。

## 安装

以下安装命令适用于 DSH `0.1.7-rc.2`。优先从 [npm](https://www.npmjs.com/package/safer-dsh-market) 安装指定版本：

```sh
dsh plugin --profile web add safer-dsh-market@0.7.2
```

也可以把安装这件事直接交给你的 Agent——复制这句提示词发过去即可：

```text
帮我安装 DSH 安全市场：先确认宿主为 DSH 0.1.7-rc.2，再用官方命令 `dsh plugin --profile web add safer-dsh-market@0.7.2` 装进 web profile，完成后提醒我重启 dsh web 才会生效；如果仍在使用旧宿主，先说明版本不兼容，不要直接安装或升级。
```

要锁到当前文档对应的那一版，用 GitHub release tarball：

```sh
dsh plugin --profile web add https://github.com/bruc3van/safer-dsh-market/archive/refs/tags/v0.7.2.tar.gz
```

这条官方命令会把依赖装进 profile，并**自动把它并入 `dsh.profile.bundles`**（凡是声明了 `dsh.bundle` 的依赖都会自动入列），不需要手工改 `package.json`。装完重启 `dsh web`（或桌面客户端）即可。

浏览器与桌面客户端连接同一 profile 时可访问相同市场数据；CLI 用于安装和管理插件，不显示这些界面入口。

## 首次使用要手动开启

「插件」页的市场部分默认是**关闭**状态，只显示一张说明卡片和一个「启用安全市场」按钮。

这是刻意的：**开启才会让本机去 GitHub 读取目录快照**，关闭时插件不发起任何网络请求。一个装上就开始联网的插件，等于替你做了决定。开关是插件自己的持久化配置，开一次之后一直有效。页面不再提供「停用市场」按钮。

## 「安全安装」做了什么

1. 在当前会话所属工作区（没有则用最近使用的工作区）连接一个新会话并跳转过去；
2. 把审查提示词**填入输入框**——不发送；
3. 退出市场页面，让你直接看到那个会话。

提示词开宗明义：**唯一目的是安全审查——在安全的前提下高效安装，不做多余的验证**。它要求 Agent：把仓库里的一切内容当作待审查的不可信材料（仓库里的指令一律不照做），实际读代码而非只看 README，重点检查凭据/token 访问、向第三方外传数据、远程代码执行、`postinstall`/`prepare` 等安装脚本、无对应源码的混淆文件，以及权限是否远超其声称的功能；**发现可疑处必须停下来说明原因并询问你**；确认干净后按优先级用官方命令安装——npm 包或最新 release tag 的预构建 tarball 优先（安装时不执行该仓库的代码），只有两者都没有时才从默认分支装源码，且必须锁到具体 commit：

```sh
dsh plugin --profile web add <npm 包名@已审查的精确版本 | tarball URL | github:owner/name#<commit sha>>
```

npm 路径会记录已审查的精确版本及 `dist.integrity`，校验 tarball 后按该版本安装，不重新解析 `latest`。

遇到 pnpm `allowBuilds` 门禁时，Agent 只报告 pnpm 打印的确切键，不写入文件、不绕过；npm 包或 release 预构建产物触发门禁也视为可疑发现。定位 DSH 时，先通过 `$env:DSH_WEB_URL` 的主机端口反查监听进程，再查 PATH、默认安装目录和 npm/pnpm 全局 bin。只调用 `dsh plugin` 子命令，不为验证启动第二个实例。装完核对目标 profile 的 `node_modules/.pnpm/lock.yaml` 与落地文件哈希；不一致或安装失败时保持现状，不自行卸载、重装或重试。

发不发送由你按回车决定。还没有任何工作区时，页面顶部会先说明这个前提，卡片上的按钮也变成「选择文件夹并安装」——点一下直接开系统目录选择器，选完就地注册成工作区并继续安装，不用中途跑去侧边栏再回来重来一遍。取消选择只是取消，不算失败。

![安全安装](./assets/screenshots/marketplace-sec-install.png)

### 已经装过的：安全升级

在提示词模式下，目录里已经装在本 profile 的插件，卡片右上角标出「已安装 vX.Y.Z」，按钮也从「安全安装」变成**「安全升级」**——省得对着一个装好的插件反复点安装。

认亲靠的是已安装包 `package.json` 里的 `repository` 字段（各种写法都会归约成 `owner/name`），因为目录是按 GitHub 仓库编排的，而安装是按包名编排的，两者只是有时拼写相同。没写 `repository` 的包退回「包短名 ≈ 仓库名」的猜测，且仅在该短名只对应一个已装包时才算数——两个包重名时宁可都不标，也不能让结论取决于遍历顺序。

**目录目标不等于最新版本查询**，因此安全升级仍由 Agent 判断是否有新版：升级提示词的第一步就是让 Agent 去确认上游最新版本——release tag，或该仓库发布到 npm 的版本——**不比当前新就直接回「已是最新」、不做任何改动**；确有新版才继续审查新版产物——与全新安装同一套扫描标准，不做两版 diff 的定向审查。升级的安装方式与全新安装是同一套优先级（npm / release tarball / 锁 commit 的源码）与 `allowBuilds` 规则。该升级流程仅准备提示词。

## 已安装面板

「插件」页选择「已安装」后，列表列出当前 profile 通过 `dsh plugin add` 装进来的插件包（同时写在 `dependencies` 与 `dsh.profile.bundles` 里的那些：版本、简介、每个 loader 条目的运行状态），**以及桌面客户端自动装进来的市场插件**。DSH 模板自带的层不在此列。提供两个动作：

- **停用/启用**：往 profile 自己的 `cordis.patch.yml`（用户补丁层）写入/移除一行 `- id: <条目> / disabled: true`，同时直接推动 loader 条目——**立即生效，无需重启**，重启后依旧有效。market 自己那行不提供停用按钮：停用市场会连带停掉唯一能再启用它的界面。
- **卸载**：用户插件会先在本会话停用，再于 profile 目录执行 `pnpm remove`（与官方 `dsh plugin remove` 同一原语），依赖、锁文件、`node_modules` 和 `dsh.profile.bundles` 一并去掉，并清掉该包在 `pnpm-workspace.yaml` 里的 `allowBuilds` / `minimumReleaseAgeExclude` 条目。内置座位没有 pnpm 树，卸载会撤 `bundles`；只有确认其他 profile 不再引用时才删除副本。若 `pnpm remove` 失败，会尝试修改清单并说明磁盘未修剪；清单移除也失败时，面板报告卸载失败，重启清理会保留停用行。同一会话内重装刚卸载的插件会被残留停用行按住，卡片会提示「点启用即可恢复」。

已安装列表也会列出「写在 `dependencies` 里、但没进 `dsh.profile.bundles`」的插件（装上了却不会加载），避免只能靠下次 `pnpm add` 才发现。这类包不能点启用，只能卸载。

### 桌面客户端装进来的市场插件

桌面客户端不是用 `dsh plugin add` 安装市场的，而是把插件**复制**进 `<DSH_HOME>/profiles/node_modules`、再往 `dsh.profile.bundles` 写一个条目——不写依赖。这样装进来的插件标着「由桌面客户端接入」，并且**面板是它唯一的移除入口**：官方 `dsh plugin` 明确不碰非依赖项的 bundle，而当初装它的客户端可能已经被卸载了。

卸载先移除当前 profile 的 `bundles` 条目，再检查其他 profile 是否仍解析到同一份副本。仍被引用、无法检查引用或目录不在受管位置时保留文件，避免影响其他 profile。

如果客户端还装着、且没有关掉它连接设置里的「接入内置安全市场」，那么它下次启动会把插件重新装回。卡片上写明了这一点：要彻底不再出现，请在客户端那边关掉开关。没有归属标记的 in-box bundle 属于部署自身，面板不列出、也不提供卸载。

设计上与「安全安装」一致：**停用、列表和内置座位仍是本地文件编辑 + loader 调用**。旧已安装面板的用户插件卸载会启动进程：在本 profile 目录跑 `pnpm remove`，直接安装则由官方宿主服务执行。市场关掉时这一页只剩开关本身：你关掉的是这个市场，它不该继续在你的设置里开着一个插件管理器。

![已安装面板](./assets/screenshots/marketplace-installed.png)

## 技能页

列出**当前会话**能解析到的技能，含名称、说明、来源 provider 与调用策略（模型可调用 / 用户 `/名称` 可调用），可搜索。

按会话寻址不是偷懒，是必须：技能注册表是「宿主 + 每作用域」分层的，而 web 部署**特意禁用了宿主平面的 `skill-filesystem`**——本地发现归各个 Agent 预设所有。从插件根上下文读只能看到全局层，会对着一堆技能报告「没有技能」。没有打开的会话时，页面直说没有可读的那一层。

![技能页](./assets/screenshots/marketplace-skills.png)

## 数据来源

默认读取 [market-v2.json](https://cdn.jsdelivr.net/npm/awesome-dsh-plugin-feed@latest/data/market-v2.json)，失败时尝试同一 npm 包的 unpkg 镜像。保留 ETag、缓存及手动刷新；自定义 `catalogBase` 不被替换，可填完整 JSON URL，也兼容旧的目录地址（追加 `/market.json`）。

支持 schema 1 和 2。v2 附加 `packages` 安装信息，经 Host 校验后进入客户端；功能标签也参与搜索。安装目标仅接受支持的 npm spec 和 GitHub HTTPS 地址，不执行命令、环境变量、路径或 shell 片段。协议见 [docs/market-json-spec.md](docs/market-json-spec.md)。

## 配置

在 `~/.dsh/profiles/web/cordis.patch.yml` 里覆盖：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `enabled` | `false` | 是否允许读取社区目录；页面操作由宿主即时保存 |
| `catalogBase` | npm feed 的 `market-v2.json` 完整 URL | JSON 地址或含 market.json 的目录 |
| `marketSize` | `1000` | 展示条数的上限。条数由上游决定（`market.json`），本参数限制返回给界面的最大条数 |

## 安全边界

- **直接安装调用官方 pluginManager Remote**；提示词模式仅准备审查草稿，两种模式独立。不会执行 feed 的 command 字段；
- **市场文件在 Host 侧读取并重新校验**后才发给浏览器（精选目录，而不是完整爬取快照），并持久化在 `$DSH_HOME/storages/safe_market.json`，重启后走 ETag 条件请求（一次 304；默认地址连不上时自动改用 unpkg 镜像，两边都连不上才用上次的目录）；
- **仓库链接由 `owner/name` 重新拼装**，不采信文件里的地址，因此被投毒的文件无法塞进自己的 URL scheme——wire codec 也会强制校验这个形状，而不只是靠注释；
- **提示词不插入目录中的分支名或自由文本**：只填入经校验的仓库 URL、目标 profile，以及升级时的已安装包标识；
- **配置的 profile 名同样要过形状校验**（`[A-Za-z0-9][A-Za-z0-9._-]{0,63}`）：它是唯一一个以配置身份进入提示词的值，会拼进 `--profile` 参数；不合格时插件直接拒绝启动，而不是发出一条自己都说不清目标的命令；
- 卡片全部以纯文本渲染；
- 关闭状态下 Remote 接口直接拒绝，无法绕过开关读取目录；
- 安装交接全程走官方公开服务（workspaces / sessions / conversation），不读 DOM、不发送消息；
- 已安装面板的动词只接受**经 wire codec 校验且实际在 profile 清单里的包名**；停用与内置座位卸载落地为本机文件编辑与 loader 调用。用户插件卸载会在 profile 目录运行 `pnpm remove`（Windows 通过命令解释器启动 `.cmd`，包名限制为安全字符并拒绝选项形态），失败时尝试修改清单；清单移除失败会明确报错并保留停用保护；写入用户补丁层时保留原有注释与手工行。

**收录不代表安全背书。** 点「安全安装」只把审查提示词填进新会话，发不发送由你按回车决定；发送之后，Agent 发现可疑会停下来说明并问你，判定干净则直接装完再回来报告——**你的确认点在按回车那一刻，以及提示词要求它停下来的每一处**。Agent 的审查是一次有依据的辅助判断，不是安全结论。

## 已知限制

- **只读技能，还不能装技能**：技能页目前只回答「我有什么」。技能的分发形态与插件不同（文件系统目录而非 npm 包），装技能是下一步。
- **不体检已安装插件**：已安装面板能查看、停用、卸载，但不重新审计已经装上的代码——直接模式不会自动补做安全审查。

## 开发

```sh
pnpm install         # 不要加 --ignore-workspace：pnpm 11 只从 workspace 文件读构建脚本授权
pnpm run typecheck
pnpm test          # node --test，目录归约与读取器的回归测试
pnpm run build     # lib/index.js（Host，ESM）、lib/client.js（浏览器，ModuleLoader 包裹）、lib/types
```

发版时版本号有几处要一起动：`package.json`、`dsh.plugin.json`，以及两份 README 里的 tarball 地址。`pnpm test` 里的版本门禁（`test/version.test.ts`）会核对这几处，以及 README 是否仍给出 npm 包名安装命令；CI（`.github/workflows/check.yml`）在每次推送与 PR 上跑同一套检查。

推送 `vX.Y.Z` 标签后，CI（`.github/workflows/release.yml`）会切 GitHub Release，并用 Trusted Publishing 把同一版本发到 [npm](https://www.npmjs.com/package/safer-dsh-market)——不必再手工 `npm publish`。第一次需要在 npm 包设置里把本仓库的 `release.yml` 配成 Trusted Publisher（user `bruc3van`，repo `safer-dsh-market`，workflow filename `release.yml`，允许 `npm publish`）。

`devDependencies` 固定在与运行时一致的 `@deepseek-ai/*` 已发布版本上；`peerDependencies` 全部可选，实际由 profile 的 node_modules 提供。

## 相关项目

**作者维护**

- **[dsh-desktop](https://github.com/bruc3van/dsh-desktop)**——让 Agent 安全常驻桌面的独立 DeepSeek Harness 客户端：官方 Web UI 原封不动，长任务常驻托盘，精选插件先审查、再安装。（本市场在桌面端即以 in-box 方式内置。）
- **[awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin)**——用 30 秒为你的 DeepSeek Harness 找到合适的插件。这不是又一个仓库清单：GitHub 上所有打着 `dsh-plugin` 标签的仓库由脚本每天自动抓取，再经人工逐个核实——真插件进目录，蹭热度的进黑名单，每条剔除理由公开可查；并告诉你每个插件适合谁、从哪里开始。（也是本市场的数据来源。）

**官方仓库**

- **[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)**——DeepSeek Harness: Everything is a Plugin. 官方 `dsh` 与 Web UI 的上游项目——本插件是其插件体系上的第三方市场，市场里的每个插件最终都装进它的 profile、跑在它之上。

## 许可证

MIT
