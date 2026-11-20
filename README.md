# DSH Market Pro

<img src="./assets/logo.svg" alt="DSH Market Pro Logo" width="96" height="96" />

**精选插件，专业管理：浏览、安装、更新、AI 审查。**

中文 | [English](./README_EN.md)

DeepSeek Harness（DSH）的第三方插件市场。基于经过核实的社区目录 [awesome-dsh-plugin-pro](https://github.com/bruc3van/awesome-dsh-plugin-pro)，让你在同一个界面里完成插件发现、安装、更新、技能查看与安装后 AI 安全审查。

![插件市场主界面](./assets/screenshots/marketplace.png)

## 主要功能

- **精选与全量目录**：剔除蹭标签与非插件项目。打开即展示编辑精选，同时提供完整插件目录，支持按分类筛选、关键词与包名搜索。
- **一键安装**：已收录安装信息的插件可直接点击安装并启用；未提供直接安装信息的仓库，可一键生成提示词交由 AI 核实后完成安装。
- **已安装管理与更新**：集中查看已安装的插件，支持随时启用/停用（立即生效，无需重启）、卸载，或一键检查新版本并完成升级。
- **安装后 AI 审查**：支持对已安装插件生成审查草稿并填入对话框（由你确认发送），让 AI 协助排查本地插件代码中的联网请求、凭据读取或脚本执行等潜在风险。
- **技能浏览**：按项目、用户、内置等来源筛选和搜索当前对话可用的技能，直观查看每个技能的说明与调用方式。
- **MCP 管理**：基于 DSH 官方 MCP 管理器（DSH ≥ 0.2.2-rc.2）查看每台 MCP 服务器的实时连接状态与工具，支持添加、编辑、启停、测试连接、重启；明文密钥可一键转存为凭据，直接写入 profile 的静态 MCP 也会只读列出并提示风险。

## 安装方式

1. 打开 DSH 左侧导航栏的 **插件** 页面。
2. 在官方插件安装界面中输入 **`dsh-market-pro`** 进行安装并启用。
3. 安装完成后，即可从左侧导航栏的 **插件市场Pro**、插件页顶部标签或会话右侧边栏打开市场。

## 界面预览

### 侧边栏快捷入口

除了左侧主导航外，也可以在任意对话中展开右侧边栏，快速打开 **插件市场Pro**。

![右侧栏入口](./assets/screenshots/marketplace-sidebar.png)

### 已安装管理与检查更新

在 **已安装** 页面管理当前环境中的插件，一键切换启用状态、检查可用更新或卸载插件。

![已安装面板](./assets/screenshots/marketplace-installed.png)

### 安装后 AI 安全审查

在安装完成弹窗或已安装插件卡片上点击 **AI 审查**，自动在会话输入框中准备审查提示词草稿，由你发送给 AI 进行只读检查。

![AI 审查草稿](./assets/screenshots/marketplace-sec-check.png)

### 技能页

在市场顶部的 **技能** 页签或对话标题下方的 **技能** 入口中，查看当前会话可用的全部技能、来源分类及调用方式（AI 自动调用或 `/名称` 手动调用）。

![全局技能页](./assets/screenshots/marketplace-skills.png)

![对话内技能页](./assets/screenshots/conversation-skills.png)

## 使用提示

- **安全提醒**：目录收录仅核实项目是否为 DSH 插件，不代表安全背书。安装前请留意插件来源与权限要求。
- **关于 AI 审查**：AI 审查是在插件安装后对本地文件进行的辅助检查，供你评估风险参考，无法阻止或撤销插件安装时已经发生的执行。

## 相关项目

- **[DSH Desktop Pro](https://github.com/bruc3van/dsh-desktop-pro)**：让 Agent 安全常驻桌面的独立 DeepSeek Harness 客户端。
- **[awesome-dsh-plugin-pro](https://github.com/bruc3van/awesome-dsh-plugin-pro)**：经过每日核实的 DSH 社区插件目录，也是本市场的数据来源。
- **[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)**：DeepSeek Harness 官方仓库。

## 许可证

[MIT](./LICENSE)
