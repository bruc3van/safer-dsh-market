# DSH 官方发现页订阅与市场接入

用户订阅配置适用于 **DSH V0.2.1-rc.2 及以上**：左侧 **插件 → 实验性插件旁的「更多」→ 自定义插件市场**，开启后在 **发现** 中添加 JSON 索引源。完整开启、配置和检索步骤见[README](../README.md#订阅到-dsh-官方发现页)；也可以先访问 [DSH 插件导航](https://bruc3van.com/dsh-plugins/) 浏览目录。

以下技术适配最初依据本地 `deepseek-harness` 的 `dsh-v0.2.1-alpha.5` tag 和同版本 npm 包，随 `safer-dsh-market@0.10.0` 发布。这是开发基线记录，不是要求用户使用 alpha 版。

## 官方插件页

市场通过 `plugins.tab` 注册「安全市场」标签，共享原市场的数据源、安装队列和审查功能。该插槽是可选的：旧宿主或未启用官方插件管理界面时，原独立入口仍可用。注册跟随插槽和插件生命周期销毁。

市场仍使用自己的多选安装确认框和官方 `pluginManager` Remote。官方标签 owner 的 `install` 要求精确版本和已确认的版本元数据；旧社区目录含裸 npm 包名、分支及多组件目标，不能直接冒充这种版本记录。因此这里没有把目录目标硬塞给 owner 安装框。审查草稿的回调另名注入，避免与 owner 的 `install` 冲突。

## 官方发现索引源

生成器、回归测试、定时更新工作流、索引与审计报告已迁到数据源仓库 `awesome-dsh-plugin` 的 `scripts/host-market/` 和 `data/`。市场插件不再生成或发布第二套索引。

- 订阅地址：`https://bruc3van.com/dsh-plugins/index.json`（Bruce 的精选插件）；旧地址 `https://bruc3van.com/markets/dsh/index.json` 继续兼容，已有订阅无需更换，不要重复添加。
- 审计地址：`https://bruc3van.com/markets/dsh/audit.json`

站点只转发已生成的 JSON，不重定向；后续数据源更新无需重新构建站点。使用方法和收录边界见数据源仓库的 `scripts/host-market/README.md`。

宿主「发现」页和 `plugin_market` 工具消费 format-1 索引；现有社区 `market-v2.json` 继续供本插件使用。兼容范围遵循官方 `dshRange`：显式 `engines.dsh` 优先，否则使用 DSH peerDependencies 的范围交集；无约束时省略 engines。无效范围或空交集仍排除。收录不等于实机兼容或安全验证。

## 验证边界

自动化覆盖新版 Loader/Settings 启动、RPC 注册、设置重启持久化、标签生命周期及审查回调隔离、安装失败信息、新旧技能目录路径。仍需真实 Desktop 验收插件页排版、安装交互和发现源订阅。

## 分类、筛选与排序

订阅索引使用官方 format-1 metadata：沿用社区中英文分类，保留包关键词并补充安装映射的任务关键词，提供 npm/Git 来源标签，以及 GitHub Star 数、仓库更新时间两项排序。宿主自身提供发布时间与搜索最佳匹配。默认仍按 Star 降序。

每日 CI 除社区目录外，也核验完整已批准目录中有明确安装映射的候选；不受 600 条展示上限限制。缺映射保持待核实，手动安装不转换，来源未通过核验不收录。社区 v1/v2 与现有市场展示规则保持独立。
