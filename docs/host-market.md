# DSH 0.2.1-alpha.5 官方市场接入

本次适配依据本地 `deepseek-harness` 的 `dsh-v0.2.1-alpha.5` tag 和同版本 npm 包。适配随 `safer-dsh-market@0.10.0` 发布。

## 官方插件页

市场通过 `plugins.tab` 注册「安全市场」标签，共享原市场的数据源、安装队列和审查功能。该插槽是可选的：旧宿主或未启用官方插件管理界面时，原独立入口仍可用。注册跟随插槽和插件生命周期销毁。

市场仍使用自己的多选安装确认框和官方 `pluginManager` Remote。官方标签 owner 的 `install` 要求精确版本和已确认的版本元数据；旧社区目录含裸 npm 包名、分支及多组件目标，不能直接冒充这种版本记录。因此这里没有把目录目标硬塞给 owner 安装框。审查草稿的回调另名注入，避免与 owner 的 `install` 冲突。

## 官方发现索引源

生成器、回归测试、定时更新工作流、索引与审计报告已迁到数据源仓库 `awesome-dsh-plugin` 的 `scripts/host-market/` 和 `data/`。市场插件不再生成或发布第二套索引。

- 订阅地址：`https://bruc3van.com/markets/dsh/index.json`
- 审计地址：`https://bruc3van.com/markets/dsh/audit.json`

站点只转发已生成的 JSON，不重定向；后续数据源更新无需重新构建站点。使用方法和收录边界见数据源仓库的 `scripts/host-market/README.md`。

宿主「发现」页和 `plugin_market` 工具消费 format-1 索引；现有社区 `market-v2.json` 继续供本插件使用。市场插件自身已声明 `engines.dsh`，以便正式发布版本被索引生成器识别。

## 验证边界

自动化覆盖新版 Loader/Settings 启动、RPC 注册、设置重启持久化、标签生命周期及审查回调隔离、安装失败信息、新旧技能目录路径。仍需真实 Desktop 验收插件页排版、安装交互和发现源订阅。
