# DSH 官方发现页订阅与市场接入

用户订阅配置适用于 **DSH V0.2.1-rc.2 及以上**：左侧 **插件 → 实验性插件旁的「更多」→ 自定义插件市场**，开启后在 **发现** 中添加 JSON 索引源。完整步骤见 [README](../README.md#订阅到-dsh-官方发现页)；也可以先访问 [DSH 插件导航](https://bruc3van.com/dsh-plugins/) 浏览目录。

## 宿主适配

`safer-dsh-market@0.12.0` 的开发依赖固定到 DSH `0.2.2-rc.3`，Cordis / Loader / Schemastery 使用宿主的 `4.1.0` / `1.1.0` / `3.19.0`，Zod 固定到宿主的 `4.6.6`。DSH peer 范围接纳 `0.2.2-rc.1` 起的同系列 RC；`engines.dsh` 沿用 `>=0.1.7-rc.2 <0.3.0`，宿主使用 `includePrerelease: true` 检查。

核对了 rc.1 → rc.3 的插件页、侧栏插槽、会话控制器、Loader/Settings 和安装 Remote。`plugins.tab` 新增 owner 的 `update` 回调，市场与 owner 的安装、更新回调保持隔离；侧栏仍通过 `sidebar.panellist` 注册。现有市场直接安装、审查草稿和技能列表接口继续适用。本插件的菜单使用原生 disclosure，没有使用本次改变的宿主浮层定位接口。

市场通过 `plugins.tab` 注册「安全市场」标签，共享原市场的数据源、安装队列和审查功能。注册跟随插槽和插件生命周期销毁；独立入口和右侧栏仍可用。

市场使用自己的多选安装确认框和官方 `pluginManager` Remote。官方标签 owner 的安装入口要求精确版本和版本元数据；社区 v2 目录允许裸 npm 包名、分支及多组件目标，不能直接作为官方索引的版本记录。

## 两种数据协议

- 本插件读取 npm feed 的 `market-v2.json`，仅支持 `schema_version: 2`，默认 jsDelivr、失败回退到同包的 unpkg。`catalogBase` 必须是完整 v2 JSON URL；不再支持废弃的 `market.json` / schema 1 或目录地址补文件名。升级会失效旧解析缓存并完整下载一次。安装目标新增接受上游实际提供的 Gitee HTTPS 仓库，仍先交给官方管理器 inspect。见 [消费协议](market-json-spec.md)。
- 官方「发现」页和 `plugin_market` 工具读取 format-1 `index.json`。生成器、测试、发布流程、索引与生成报告由数据源仓库 [awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin/tree/main/scripts/host-market) 维护，本插件不生成或发布另一套索引，也不自动添加订阅。

订阅地址：`https://bruc3van.com/dsh-plugins/index.json`（Bruce 的精选插件）。旧订阅地址 `https://bruc3van.com/markets/dsh/index.json` 由站点继续提供相同数据，已有订阅无需重复添加。该 URL 别名与已废弃的社区 `market.json` 是不同的接口。

生成与排除报告：`https://bruc3van.com/markets/dsh/audit.json`。此报告用于追溯生成来源，不是官方安全审计认证。

## 数据源当前订阅规则

以下依据上游 2026-11-17 的生成器说明：

- 从社区 v2 目录（含精选）和完整已批准且具备安装映射的目录选取候选，核实 npm/Git 来源、实际 manifest、bundle、完整性与官方 `dshRange`。按 Star 排序最多收录 **2000 个插件**，已核验编辑推荐保留在名额内；缺映射或手动安装不转换。
- format-1 索引使用官方 `@deepseek-ai/dsh-plugin-market-index@0.2.2-rc.3` 校验。显式 `engines.dsh` 优先，否则求 DSH peer 范围交集；无约束时省略，不补造范围。
- 编辑推荐保留原用途分类，额外附加「编辑推荐」标签；分类、功能和推荐标签可组合筛选。保留 npm/Git 来源、更新时间及 Star 档位标签，每类最多一个；用途与前提标签逐包审阅，每包最多三个，展示字段变化后等待复核。
- 默认按 Star 降序，可选 GitHub Star、仓库更新时间及 npm 周下载量排序。npm 使用公共来源的 `last-week` 窗口；读取失败或 Git 来源省略该指标，真实零值保留。发布时间和最佳匹配由宿主提供。
- 生成报告记录多宿主版本声明匹配覆盖（主目标 rc.3）、推荐来源和插件数量、展示质量与证据哈希。声明匹配不等于实机兼容或安全验收。
- 站点从 `market-release` 的不可变发布记录读取，并核对生成任务及索引、报告摘要。读取失败时使用已校验的随站快照并通过 `X-Market-Fallback` 标注；显式指定版本不可用时返回 503。数据源成功发布后无需重新构建站点。

社区 v2 feed 与官方订阅有各自的生成和分发流程；本插件不会因为官方订阅扩容而自动显示 2000 项。

## 验证边界

自动化覆盖 rc.3 下类型检查、构建、真实 Loader/Settings 启动、RPC 注册、设置及插件启停跨重启持久化，以及插件页回调隔离、安装失败信息和技能目录路径。另用真实 HTTP 服务验证 v1 拒绝和带查询参数的 v2 地址原样请求。Electron 页面交互与实际安装仍需在真实 Desktop 中验收。

2026-11-17 线上取样中，jsDelivr、unpkg 和主分支 v2 文件的 SHA-256 一致；真实解析得到 1000 条目录、50 条精选，安装目标全部保留。官方订阅的 1465 个插件、1550 个版本安装目标通过 rc.3 官方校验器，索引摘要与生成报告一致，站点未使用备用快照。本机系统 HTTP 请求可下载这些数据，终端 Node 的真实目录读取仍在两个 CDN 超时，使用进程级本地代理后也未通过；Electron 网络与界面交互尚未实测。

## 已安装插件更新（0.12.0）

市场的「已安装」卡片通过官方 Remote 的 `listBundles` 读取更新资格，npm 使用 `listVersions(name, {})`，固定提交的 Git 使用 `pluginMarket.listIndexes / search` 查询现有订阅。Git 查询按已配置来源顺序读取，按精确包名匹配，并只采用宿主 `MarketListingVersion.update` 标记的同源更新；兼容性和版本豁免沿用官方判定。

用户确认目标版本后调用 `updateBundle(name, version, options)`：npm 传回列表所用 registry，Git 原样传回宿主提供的固定提交 spec；两者均携带请求 ID 并监听 `plugin-manager/update-state`。启用状态、移除、替换、恢复及重启语义由宿主实现。更新成功或失败结束后均刷新已安装列表；传输失败显示结果未确认，不自动重试安装。安装脚本授权等额外操作交由官方插件页处理。

自动化覆盖检查只读、精确 RPC 参数、稳定版选择、预发布/弃用提示、兼容性阻止、Git 分页与来源、检查失败、请求进度匹配、重复确认、失败恢复及迟到响应。Playwright 预览使用真实市场组件和控制器、模拟 Remote 边界验证交互与窄屏布局，未更新用户的实际插件。
