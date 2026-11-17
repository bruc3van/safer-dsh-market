# DSH Market Pro

<img src="./assets/logo.svg" alt="DSH Market Pro Logo：盾牌、插件模块与审查勾选标记" width="96" height="96" />

**精选插件，专业管理：浏览、安装、更新、AI 审查。**

中文 | [English](./README_EN.md)

DeepSeek Harness（DSH）的第三方插件市场。基于人工核实的社区目录 [awesome-dsh-plugin-pro](https://github.com/bruc3van/awesome-dsh-plugin-pro)，把插件精选、浏览、安装、更新和安装后 AI 审查放在同一个界面。

## 为什么是 Pro？

给仓库打上 `dsh-plugin` 标签只是发现线索，不能直接成为收录资格。我们先核实它是不是 DSH 插件，剔除蹭标签和非插件仓库，再把发现与日常管理接起来：

- **精选有依据**：完整目录经过人工核实；精选订阅进一步核实安装目标、bundle 声明和宿主版本范围，并公开[索引生成与排除报告](https://bruc3van.com/markets/dsh/audit.json)。
- **浏览更省事**：精选、全部、已安装分区，支持分类、关键词、包名搜索、插件图标、分页和离线缓存。
- **安装有流程**：通过宿主官方插件管理器检查、安装和启用，支持多选与多组件安装，显示授权要求和执行结果。
- **更新有管理**：检查已安装插件的新版本，查看兼容性并确认更新，保留启用状态，展示进度、重启要求和失败恢复结果。
- **AI 审查有证据**：安装后可把当前 profile、实际版本和本地产物交给 Agent 做只读审查，报告风险与未核实项，由你决定后续处理。

Pro 体现在目录质量和完整使用流程。收录核实不等于安全背书；AI 审查是安装后的辅助检查，不能阻止或撤销插件已经发生的执行。

## 订阅到 DSH 官方「发现」页

**适用版本：DSH V0.2.1-rc.2 及以上。** 这里的版本要求针对官方「发现」页的第三方订阅功能；各插件仍需满足详情中声明的宿主版本要求。

先在网页里找插件：[DSH 插件导航](https://bruc3van.com/dsh-plugins/)。在 DSH 中配置时，请使用下面的 **JSON 订阅地址**，不要填写导航网页地址。

**订阅链接：[https://bruc3van.com/dsh-plugins/index.json](https://bruc3van.com/dsh-plugins/index.json)**

```text
https://bruc3van.com/dsh-plugins/index.json
```

旧地址 `https://bruc3van.com/markets/dsh/index.json` 继续兼容，已有订阅无需更换；新旧地址提供同一份「Bruce 的精选插件」，请勿同时添加。

1. **确认版本**：将 DSH 升级到 **V0.2.1-rc.2 或更高版本**。
2. **开启自定义市场**：打开左侧 **插件**，点击 **实验性插件** 旁的 **更多**，找到 **自定义插件市场** 并开启。启用后，插件页会显示 **已安装 / 发现** 两个标签页。
3. **打开索引源配置**：进入 **发现**。首次使用时点击 **添加索引源**；已有市场时，展开左上角的市场名称下拉菜单，选择 **管理索引源…**。
4. **添加订阅**：在 **索引 URL** 中粘贴上面的 `index.json` 地址，点击 **添加**。确认地址出现在已添加的索引源列表后，关闭弹窗；配置保存在当前 profile 中。
5. **浏览和安装**：在市场下拉菜单中选择 **Bruce 的精选插件**；如需重新读取数据，点击 **刷新**。按分类、关键词或 npm/Git 标签查找插件，查看版本要求后再安装。

如果没有看到「发现」，请先检查 DSH 是否为 V0.2.1-rc.2 及以上版本，以及「自定义插件市场」是否已开启。只开启功能还不会自动添加本订阅源，仍需完成上面的添加步骤。

仅订阅官方「发现」页**无需安装 `dsh-market-pro`**；如需独立市场界面、多选安装和安装后 AI 审查，可另行安装市场插件。开启「自定义插件市场」与本插件自己的「启用 DSH Market Pro」开关是两个不同入口。

索引由 [awesome-dsh-plugin-pro](https://github.com/bruc3van/awesome-dsh-plugin-pro) 自动生成，通过 Cloudflare 上的 `bruc3van.com` 提供无重定向 JSON。收录经过核实的 npm 目标及固定完整提交的 Git 组合包，核实 bundle 声明、时间及官方宿主兼容范围规则，按 Star 选取最多 2000 项，并提供分类、推荐标签与 npm 周下载量排序，因此不是完整仓库目录；收录不代表安全审查或实机兼容保证。

[DSH 插件导航与订阅指南](https://bruc3van.com/dsh-plugins/#subscribe) · [查看索引生成与排除报告](https://bruc3van.com/markets/dsh/audit.json) · [最新版市场插件](https://www.npmjs.com/package/dsh-market-pro)

> [!IMPORTANT]
> **从 1.0.0 起，插件名为 DSH Market Pro，包名为 `dsh-market-pro`**，仓库地址使用 [`bruc3van/dsh-market-pro`](https://github.com/bruc3van/dsh-market-pro)。此前的包名为 `safer-dsh-market`，更早为 `dsh-desktop-safe-market`；旧包不会自动升级为新包。迁移步骤：停用旧插件 → 安装并启用 `dsh-market-pro@1.0.0` → 按需重新设置原来的配置。缓存和待卸载记录沿用原存储标识。

![DSH Market Pro](./assets/screenshots/marketplace.png)

## 功能一览

- **插件市场**：打开即展示订阅源全部精选；浏览、搜索、按分类筛选完整收录目录，支持手动刷新数据与离线缓存。
- **直接安装与可选审查**：安装统一调用官方 `pluginManager`；安装成功后或已安装卡片上可生成只读审查草稿，由你发送。
- **已安装面板**：查看当前 profile 的插件，检查更新、一键停用/启用（即时生效）或卸载。
- **技能页**：列出当前会话可用的技能及其来源、调用方式，可一键打开技能所在文件夹。
- **按需加载目录**：启用前不联网读取社区目录；这不控制宿主或其他插件的网络活动。

## DSH 版本兼容

### 官方插件页接入与开发基线

上面的订阅配置指引面向 **DSH V0.2.1-rc.2 及以上**。当前源码的开发适配基线已升级到 DSH `0.2.2-rc.3`，开发依赖固定到同版本，并使用宿主对应的 Cordis `4.1.0` / Loader `1.1.0`。已通过类型检查、构建及真实 Loader 下的设置与插件启停重启持久化验证；Electron 界面交互尚未实测。下表安装命令指向本插件版本 `1.0.0`，具体兼容范围见下表。

- 增加官方「插件」页的「DSH Market Pro」标签；原独立导航与右侧栏入口继续可用。旧宿主没有 `plugins.tab` 时不会注册该标签。
- 接受新版安装拒绝信息的 `requirements`，并保留旧版 `peers`；技能列表使用宿主当前工作目录。
- 显式声明 `engines.dsh`，移除已退役 `dsh-invariants` 的开发依赖；仅为旧 profile 保留可选 companion 导出。
- 官方「发现」页 format-1 索引由数据源仓库 `awesome-dsh-plugin-pro` 生成和审计，通过 `bruc3van.com` 分发。使用说明见 [官方市场接入](docs/host-market.md)。它不会自动添加索引源或发布文件。

**1.0.0 支持 DSH `0.1.7-rc.2` 与 `0.2.x`，最低要求 `0.1.7-rc.2`，不兼容旧版宿主。** 新版已迁移到新接口且没有保留旧版回退路径：不兼容 DSH 0.1.1 和 0.1.2 系列，也不兼容 0.1.5 系列。请先确认宿主版本，再选择对应的插件版本。

| DSH 宿主版本 | 插件版本 | npm 安装目标 |
| --- | --- | --- |
| `0.2.x`、`0.1.7-rc.2`（当前适配） | `1.0.0` | `dsh-market-pro@1.0.0` |
| `0.1.5` 系列，最低 `0.1.5-rc.1` | `0.5.2` | `dsh-desktop-safe-market@0.5.2` |
| `0.1.2` 系列，最低 `0.1.2-alpha.3` | `0.4.3` | `dsh-desktop-safe-market@0.4.3` |
| `0.1.1` 系列 | `0.3.0` | `dsh-desktop-safe-market@0.3.0` |

**旧宿主请固定插件版本**，不要安装 `latest` 或使用不带版本号的包名升级。例如继续使用 DSH `0.1.5` 时，在支持 CLI 管理的 profile 中（先替换 `<profile>`，不适用于 Electron `desktop`）：

```sh
dsh plugin --profile <profile> add dsh-desktop-safe-market@0.5.2
```

从旧版升级到 `1.0.0` 的注意事项：

- 先把 DSH 升级到 `0.1.7-rc.2` 或 `0.2.x`；
- 市场开关现由宿主保存在当前 profile 的 `cordis.patch.yml` 中，即时生效、重启后保留；
- 旧版 `settings.yaml` 里的 `safe-market` 设置**不会**自动迁入，升级后若市场处于关闭状态，在页面上重新启用一次即可。

## 安装

以下 CLI 示例仅适用于可由 CLI 管理的 profile，**不适用于 Electron 的 `desktop`**。将 `<profile>` 替换为已核实的实际名称。推荐从 [npm](https://www.npmjs.com/package/dsh-market-pro) 安装指定版本：

```sh
dsh plugin --profile <profile> add dsh-market-pro@1.0.0
```

也可以把安装交给你的 Agent，复制这段提示词发过去：

```text
帮我安装 DSH Market Pro 1.0.0：确认宿主兼容 DSH 0.1.7-rc.2 或 0.2.x，并核实当前实例的 profile。优先使用官方 plugin_manager 的 install_bundle，target 为 dsh-market-pro@1.0.0。desktop 禁止用 CLI；没有工具时交接我使用 Electron 官方插件管理界面。其他 profile 仅在工具不可用且确认 CLI 管理同一实例时使用显式 --profile 命令。不要改装到其他 profile，按官方结果说明是否需要重启。
```

需要锁定到本文档对应版本时，使用 GitHub release tarball：

```sh
dsh plugin --profile <profile> add https://github.com/bruc3van/dsh-market-pro/archive/refs/tags/v1.0.0.tar.gz
```

官方管理器负责安装依赖和登记插件，无需手工修改 `package.json`。按返回结果判断是否需要重启：`applied` 表示已生效，`restart-required` 表示安装完成但需重启当前实例；失败或配置覆盖不能当作已生效。

浏览器与桌面客户端连接同一 profile 时看到的是同一份市场数据；CLI 只负责安装和管理插件，不显示界面入口。

## 快速上手

### 1. 启用市场

市场默认是**关闭**的，页面上只有一张说明卡片和「启用 DSH Market Pro」按钮。

启用后才会联网读取社区目录。开关由宿主持久化，重启后保留；页面没有「停用市场」按钮。如需关闭目录读取，可通过宿主支持的配置方式将 `enabled` 设为 `false`。

### 2. 打开市场

| 入口 | 位置 | 依赖 |
| --- | --- | --- |
| 左侧导航 | 「新会话」下方、「工作区」上方的「DSH Market Pro」，在主区域浏览 | DSH 全局面板及侧栏导航插槽 |
| 右侧栏 | 打开会话 → 「打开右侧边栏」→「开始」页选择「DSH Market Pro」 | 右侧 Sidebar 服务 |

两个入口共用开关和操作逻辑，设置页不再重复提供入口。

![右侧栏](./assets/screenshots/marketplace-sidebar.png)

### 3. 浏览与搜索

- **查找插件**：「精选 / 已安装 / 全部」切换订阅精选、本机管理与完整收录目录，默认打开精选。精选和全部都支持分类下拉筛选，以及名称、包名、功能、关键词和分类搜索；搜索保留当前范围。筛选覆盖全部数据，每页显示 50 条，数量随上游发布自动更新。
- **订阅精选**：与 awesome-dsh-plugin-pro 发布的官方订阅插件集合和顺序一致，沿用其名称、描述、分类和关键词；按包名区分同仓库的多个插件。安装使用订阅首个版本的固定 npm 版本或 Git 提交及子目录，宿主仍执行安装检查。
- **插件 Logo**：精选使用订阅里插件自己的 Logo，关联仓库卡片复用图标；图片懒加载，无图或加载失败显示首字母。标题、包名和分类分层显示。
- **插件卡片**：显示分类、作者和最近更新日期，同一列表中的卡片等高、按钮底部对齐。已安装的插件标出「已安装 vX」，按钮显示「管理」，点击跳转到「已安装」。
- **刷新数据**：右上角按钮读取最新目录，刷新中禁止重复点击。
- **更多操作（⋯）**：[GitHub 仓库](https://github.com/bruc3van/dsh-market-pro)、[联系作者](https://x.com/bruc3van)。
- **滚动**：标题、页签、搜索和筛选栏固定，卡片列表独立滚动。宽度足够时（至少 440px），插件页和技能页向下滚动都会把搜索框收起到页签右侧，回滚或回到顶部时复原。
- **回到顶部**：滚动超过约半屏（至少 240px）后右下角出现按钮；遵循系统「减少动效」偏好。

## 安装插件

安装统一通过当前宿主的官方管理器执行，不依赖会话的 Standard / Creator 模式。

### 直接安装

点击卡片上的「安装」，在弹窗中选择组件并确认，由当前宿主的官方插件管理器检查、安装并启用。不需要工作区，也不发送任何提示词。

没有可用安装目标的插件（目录未提供安装信息，或只提供手动说明）按钮显示「安装说明」，弹窗提示「非标准插件，暂无可用安装目标，请前往 GitHub 查看安装说明」，并附上游提供的手动说明和 GitHub 链接。

- **安装前**：可展开「安装详情」查看安装引用、要求与备注；只有多个目标时才显示组件选择。
- **多个安装目标**：支持勾选多个组件，按列表顺序逐个安装；默认只勾选第一项，请按需选择，避免同时安装同一插件的不同来源。来源中的 profile 仅作参考，实际安装到当前宿主的 profile。
- **依赖脚本**：若依赖需要运行安装脚本，会单独请求授权，允许后才继续。
- **取消与恢复**：失败或需要脚本授权时暂停队列，重试只处理当前组件；连接中断时先「查询安装结果」，确认成功后继续。取消后不再启动后续组件；已安装成功的组件保留，不自动回滚。被其他配置覆盖时停止队列，请到官方插件页检查。
- **结果**：区分「已生效」「需要重启」「被其他配置覆盖」「失败」「已取消」。

说明：

- 只使用目录中 `packages.targets[].install` 作为安装目标，`command` 字段**永远不会被执行**；
- `manual` 条目或缺少合法目标的条目只展示说明，不会猜测安装地址；
- 需要宿主提供 `pluginManager` Remote（兼容基线 `0.1.7-rc.2`）；
- **直接安装不做 AI 安全审查**。目录收录和 README 核验都不代表安全或兼容保证。

### 安装后的 AI 审查

安装成功后可点击「AI 审查已安装版本」，也可在「已安装」卡片点击「AI 审查」。批量安装只把已生效或已安装待重启的组件列入审查目标；部分失败时仍可审查已成功的组件，不把失败、取消、被覆盖或未知结果计作成功。

点击后在当前或最近工作区打开会话，将审查草稿填入输入框，**不自动发送**。没有工作区时先选择文件夹；取消或打开失败时可以重试。普通 Standard 模式即可使用只读文件工具审查，不要求 `plugin_manager` 或 Creator。

![AI 审查草稿](./assets/screenshots/marketplace-sec-check.png)

审查先核实当前实例、profile、本地实际包名、精确版本、来源与文件。安装请求引用不是最终版本；不会改审 `latest` 或上游 main，monorepo 必须定位真实子包。检查外连、凭据访问、文件操作、子进程、脚本、依赖、权限、提示词注入和宿主修改，并报告证据与无法核实项。

**插件可能已经执行。审查是事后检查，不提供安装前保护，也不能撤销已发生的执行。** 审查不执行被审代码，不安装、更新、停用或卸载插件，不改配置。发现风险后给出建议，由你通过界面处理。

### 更新

目录中已安装插件的卡片显示「管理」，点击跳转到「已安装」，再使用「检查更新」选择并确认目标版本。更新通过宿主官方接口执行；支持范围、版本选择和失败处理见[检查与更新已安装插件](#检查与更新已安装插件)。已安装卡片的「AI 审查」只检查当前版本，不执行更新。

## 已安装面板

以下是现有已安装管理功能，后端仍包含本地清单编辑和 `pnpm remove`，尚未全部迁移到官方 `pluginManager`。安装入口使用官方管理器；AI 审查只读，不执行这些管理动作。

在插件页选择「已安装」，可以看到：

- 当前 profile 通过官方管理器或 CLI 安装的插件（同时出现在 `dependencies` 与 `dsh.profile.bundles` 中），含版本、简介和当前运行状态；
- 桌面客户端自动接入的市场插件；
- 写在 `dependencies` 里、但没进 `dsh.profile.bundles` 的插件（装上了却不会加载），这类只能卸载，不能启用。

DSH 模板自带的插件不在此列。

![已安装面板](./assets/screenshots/marketplace-installed.png)

### 停用 / 启用

向 profile 的 `cordis.patch.yml`（用户补丁层）写入或移除一行 `- id: <条目> / disabled: true`，同时直接驱动 loader 条目——**立即生效，无需重启**，重启后依旧有效。写入时保留文件中原有的注释和手工内容。

市场插件自身不提供停用按钮，避免关闭当前管理界面。

### 卸载

- **用户插件**：由市场后端先在本会话停用（市场自身卸载跳过即时停用，避免中断操作），再于 profile 目录执行 `pnpm remove`（与官方 `dsh plugin remove` 同一原语），一并去掉依赖、锁文件、`node_modules` 和 `dsh.profile.bundles` 条目，并清理 `pnpm-workspace.yaml` 中该包的 `allowBuilds` / `minimumReleaseAgeExclude` 条目。
- **失败处理**：`pnpm remove` 失败时改为修改清单并说明磁盘未修剪；清单移除也失败时报告卸载失败，重启清理会保留停用行。
- **同会话重装**：刚卸载的插件被残留的停用行按住，卡片会提示「点启用即可恢复」。

### 第三方 DSH Desktop 接入的旧版插件

此兼容逻辑仅针对第三方 [DSH Desktop](https://github.com/bruc3van/dsh-desktop-pro) 曾通过复制文件和归属标记接入的市场，不代表官方 Electron 的安装方式。页面将识别出的副本标为「客户端内置」，并提供移除入口；正常通过官方管理器安装的包仍按普通插件管理。

卸载时先移除当前 profile 的 `bundles` 条目，再检查其他 profile 是否仍引用同一份副本；仍被引用、无法检查或目录不在受管位置时保留文件，避免影响其他 profile。

如果客户端仍在且没有关闭连接设置里的「接入内置安全市场」，它下次启动会重新接入。要彻底移除，请在客户端关闭该开关。没有归属标记的 in-box bundle 属于部署自身，面板不列出也不提供卸载。

市场关闭时，插件页显示启用说明，不展示已安装管理；技能页独立可用。

## 技能页

列出**当前会话**能解析到的技能，包括名称、说明、来源目录和调用方式（AI 可调用 / 可通过 `/名称` 调用），支持搜索。

技能来自当前会话所属 Agent 的可见范围，切换会话后会重新读取。没有打开会话时显示引导；部分来源加载失败时提示列表可能不完整。来源目录可能显示为工作区相对路径、用户目录相对路径或完整路径。

来源目录后的文件夹图标会通过宿主官方的路径打开能力，在系统文件管理器中打开该技能自己的目录（鼠标悬停可看到完整路径）。宿主会先核实路径确实存在于本机；宿主没有桌面环境（如无界面或远程部署）时不显示图标。

![技能页](./assets/screenshots/marketplace-skills.png)

## 检查与更新已安装插件

在「已安装」卡片上点击 **检查更新**，选择目标版本后点击 **确认更新**。检查本身只读，不会自动安装。此功能需要宿主提供 `listVersions` / `updateBundle`（当前适配 DSH `0.2.2-rc.3`）；旧宿主或不支持更新的安装方式会显示原因。

- **npm 插件**：使用官方管理器读取较新版本和兼容信息，默认选择未弃用的兼容稳定版；预发布版和已弃用版本需手动选择，不兼容或非 bundle 的版本不可选。
- **固定提交的 Git 插件**：使用官方「发现」页已经配置的订阅源寻找同包名新版，仅接受宿主标记为同仓库、同子目录的更新；不从社区目录的分支或裸 URL 推测新版本。没有订阅或无候选时明确提示，源读取失败不会显示为「已是最新」。
- 更新由宿主官方 `updateBundle` 执行，保留原启用状态，展示执行阶段、重启要求，以及失败后原版本的恢复结果。网络断开导致结果未确认时，请先到官方插件页核对；市场不会自动重试更新。需要安装脚本授权等额外处理时，可查看详细信息并使用官方插件页继续处理。

## 数据来源

默认读取 [market-catalog.json](https://cdn.jsdelivr.net/npm/awesome-dsh-plugin-feed@latest/data/market-catalog.json)，失败时改用同一 npm 包的 unpkg 镜像。支持 ETag、本地缓存和手动刷新。

- schema 3 同时下发完整的已审核仓库目录和官方订阅发布结果；「全部」按仓库计数，「精选」按订阅插件包计数，不硬编码数量；
- 分类名称与订阅一致，精选保留订阅的插件级分类和关键词；全量仓库也能按关联订阅包名、名称和关键词检索；
- 完整目录保留已归档或禁用仓库，并显示对应状态；没有安装映射的条目提供详情和仓库链接；
- 旧内置 `market-v2.json` 地址自动迁移到新地址，旧解析缓存失效后完整下载一次；自定义 schema 2 数据源继续兼容；
- 安装目标只接受受支持的 npm spec 和 GitHub / Gitee HTTPS 地址，不接受命令、环境变量、路径或 shell 片段；
- 自定义 `catalogBase` 必须填写完整 schema 3 或 schema 2 JSON URL（可含查询参数），不会自动追加文件名。
协议详见 [docs/market-json-spec.md](docs/market-json-spec.md)。

## 配置

市场优先使用宿主 `profileContext` 提供的名称和实际目录，不默认选择 `web`。没有宿主信息时才使用显式 `profile` 配置；两者均缺失时不启动，避免操作错误目标。CLI 示例里的 `<profile>` 仅可替换为允许 CLI 管理的名称，不能填入 Electron `desktop`。

通过宿主支持的配置入口调整以下选项。常规 CLI profile 的配置文件为 `<DSH_HOME>/profiles/<profile>/cordis.patch.yml`；应用管理的目录以宿主为准，不应为绕过安装限制手改文件。

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `enabled` | `false` | 是否允许读取社区目录；页面上的操作由宿主即时保存 |
| `catalogBase` | npm feed 的 `market-catalog.json` 完整 URL | 完整的 schema 3 或兼容 schema 2 JSON 地址 |
| `marketSize` | `1000` | 仅限制旧 schema 2 数据源；schema 3 始终保留完整目录，界面分页 |
| `profile` | `""`（自动识别） | 仅在宿主没有 `profileContext` 时作为显式后备值；不能覆盖当前实例 |

## 安全边界

**收录不代表安全背书。** 直接安装不做安全审查；AI 审查是一次有依据的辅助判断，不是安全结论。

**安装**

- 安装只调用官方 `pluginManager` Remote；可选的安装后审查只准备只读草稿；
- 从不执行目录中的 `command` 字段；
- AI 审查由你发送草稿后开始，发现风险时只建议你通过界面处理；
- 审查交接全程使用官方公开服务（workspaces / sessions / conversation），不读 DOM、不代发消息。

**目录数据**

- 市场文件在 Host 侧读取并重新校验后才发给浏览器（完整已审核目录与订阅精选，不包含未审核的爬取条目），由宿主的 `safe_market` 存储域持久化，实际路径由宿主决定；缓存过期或主动刷新时使用 ETag 条件请求，默认地址不可达时改用 unpkg 镜像，两边都不可达才使用上次的目录；
- 仓库链接由 `owner/name` 重新拼装，不采信文件中的地址——被投毒的文件无法塞进自己的 URL scheme，wire codec 也会强制校验这一形状；
- 卡片全部以纯文本渲染；
- 市场关闭时 Remote 接口直接拒绝，无法绕过开关读取目录。

**提示词**

- 不插入目录描述等自由文本，只提供目标 profile 和 JSON 定位数据（已安装包名／版本，或成功安装的请求引用及应用状态）；定位数据不视为指令，实际产物仍需核实；
- profile 名需通过形状校验（`[A-Za-z0-9][A-Za-z0-9._-]{0,63}`）：它由宿主的运行信息优先提供，用于限定审查实例，不合格时插件直接拒绝启动。

**已安装面板**

- 操作只接受经 wire codec 校验、且确实在 profile 清单中的包名；
- 停用与桌面客户端插件的卸载只做本地文件编辑和 loader 调用；
- 用户插件卸载会在 profile 目录运行 `pnpm remove`（Windows 通过命令解释器启动 `.cmd`），包名限制为安全字符并拒绝选项形态。

## 已知限制

- **技能仅支持浏览**：市场当前不提供技能安装功能。
- **更新依赖宿主能力**：需要宿主提供 `listVersions` / `updateBundle`；内置、本地或未固定提交的 Git 安装可能需要通过原安装方更新。
- **审查依赖可读证据**：当前会话无法读取安装目录时只能报告未核实；AI 审查不等于安全保证。

## 开发

```sh
pnpm install         # 不要加 --ignore-workspace：pnpm 11 只从 workspace 文件读取构建脚本授权
pnpm run check      # 依次进行类型检查、构建、测试；部分测试读取构建产物
```

`devDependencies` 固定在与运行时一致的 `@deepseek-ai/*` 已发布版本；`peerDependencies` 全部可选，实际由 profile 的 `node_modules` 提供。

### 发版

1. 同步修改版本号：`package.json`、`dsh.plugin.json`，以及两份 README 中的安装命令和 tarball 地址。`pnpm test` 中的版本门禁（`test/version.test.ts`）会核对这些位置，CI（`.github/workflows/check.yml`）在每次推送和 PR 上运行同一套检查。
2. 推送 `vX.Y.Z` 标签，CI（`.github/workflows/release.yml`）会创建 GitHub Release，并通过 Trusted Publishing 发布到 [npm](https://www.npmjs.com/package/dsh-market-pro)，无需手动 `npm publish`。

新包首次发布需要先用维护者登录完成 `npm publish --access public`，才能为它单独配置 Trusted Publisher（user `bruc3van`，repo `dsh-market-pro`，workflow filename `release.yml`，允许 `npm publish`）。旧包的发布配置不会自动应用到新包。标签工作流在 npm 已有同版本且打包完整性摘要完全一致时跳过重复发布，内容不一致则失败；后续新版本继续由工作流发布。新包验证可安装后，再更新外部目录引用和旧包的迁移提示。

## 相关项目

**作者维护**

- **[DSH Desktop Pro](https://github.com/bruc3van/dsh-desktop-pro)**：让 Agent 安全常驻桌面的独立 DeepSeek Harness 客户端。官方 Web UI 原封不动，长任务常驻托盘，支持社区插件管理。桌面端预置精选插件订阅，本市场自 0.6.0 起按需自行安装。
- **[awesome-dsh-plugin-pro](https://github.com/bruc3van/awesome-dsh-plugin-pro)**：30 秒为你的 DeepSeek Harness 找到合适的插件。GitHub 上所有带 `dsh-plugin` 标签的仓库每天由脚本自动抓取，再经人工逐个核实——真插件进目录，蹭热度的进黑名单，每条剔除理由公开可查。也是本市场的数据来源。

**官方仓库**

- **[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)**：DeepSeek Harness: Everything is a Plugin. 官方 `dsh` 与 Web UI 的上游项目。本插件是其插件体系上的第三方市场，市场里的每个插件最终都装进它的 profile、运行在它之上。

## 许可证

[MIT](./LICENSE)
