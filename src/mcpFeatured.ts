/**
 * Shared built-in curated MCP server catalog and pure identity/filter rules.
 *
 * Dependency-free on purpose so both the Host (`dsh_mcp_pro` Agent tool and
 * Settings installer) and the browser (`McpView` Featured sub-tab) read the
 * exact same verified catalog and matching logic.
 * @module dsh-market-pro/mcpFeatured
 */

/** High-level discovery category for curated MCP servers. */
export type FeaturedMcpCategory = 'docs' | 'search' | 'browser' | 'dev' | 'office' | 'visual' | 'life' | 'memory'

/** Ordered category list for filter controls and overview summaries. */
export const FEATURED_MCP_CATEGORIES: readonly FeaturedMcpCategory[] = [
  'docs',
  'search',
  'browser',
  'dev',
  'office',
  'visual',
  'life',
  'memory',
]

/** One user-supplied value a curated server accepts or requires before starting. */
export interface FeaturedMcpInput {
  readonly key: string
  readonly where: 'env' | 'header' | 'arg'
  /** Optional CLI flag placed immediately before an `arg` value (e.g. `-a`, `-s`). */
  readonly flag?: string
  readonly labelZh: string
  readonly labelEn: string
  readonly descriptionZh?: string
  readonly descriptionEn?: string
  readonly placeholder?: string
  readonly secret?: boolean
  readonly required?: boolean
  /** Header value template around the user's input, e.g. `Bearer {}`. Defaults to `{}`. */
  readonly format?: string
}

/** One curated MCP server entry shipped with the plugin. */
export interface FeaturedMcpServer {
  readonly id: string
  readonly title: string
  readonly publisher: string
  /** GitHub `owner/repo` slug used for logo/avatar fallback. */
  readonly repo?: string
  /** Explicit logo URL when the project has a dedicated icon. */
  readonly icon?: string
  readonly homepage: string
  readonly category: FeaturedMcpCategory
  readonly descriptionZh: string
  readonly descriptionEn: string
  readonly transport: 'stdio' | 'streamable-http'
  readonly command?: string
  readonly args?: readonly string[]
  readonly env?: Readonly<Record<string, string>>
  /** Override the manager's default handshake budget for a slow cold start. */
  readonly startupTimeoutMs?: number
  readonly url?: string
  readonly headers?: Readonly<Record<string, string>>
  readonly inputs: readonly FeaturedMcpInput[]
}

/** Curated MCP servers verified for DSH's `stdio` and `streamable-http` manager. */
export const FEATURED_MCP_SERVERS: readonly FeaturedMcpServer[] = [
  {
    id: 'context7',
    title: 'Context7',
    publisher: 'Upstash',
    repo: 'upstash/context7',
    icon: 'https://avatars.githubusercontent.com/u/74989412?s=96&v=4',
    homepage: 'https://context7.com',
    category: 'docs',
    descriptionZh: '实时拉取主流开发库与框架的最新官方文档和代码示例，减少模型使用过时 API。',
    descriptionEn: 'Up-to-date documentation and code examples for any library, straight into the prompt.',
    transport: 'streamable-http',
    url: 'https://mcp.context7.com/mcp',
    inputs: [
      {
        key: 'CONTEXT7_API_KEY',
        where: 'header',
        labelZh: 'API Key',
        labelEn: 'API key',
        descriptionZh: '可选，用于提高请求配额（可在 context7.com/dashboard 获取）。',
        descriptionEn: 'Optional — raises the rate limit. From context7.com/dashboard.',
        placeholder: 'ctx7sk-…',
        secret: true,
        required: false,
        format: '{}',
      },
    ],
  },
  {
    id: 'deepwiki',
    title: 'DeepWiki',
    publisher: 'Cognition',
    repo: 'CognitionAI/deepwiki',
    icon: 'https://avatars.githubusercontent.com/u/163493330?s=96&v=4',
    homepage: 'https://deepwiki.com',
    category: 'docs',
    descriptionZh: '针对任意公开 GitHub 仓库提问并查阅结构化 Wiki，快速理解陌生项目架构。',
    descriptionEn: 'Ask questions about any public GitHub repository and read its generated wiki.',
    transport: 'streamable-http',
    url: 'https://mcp.deepwiki.com/mcp',
    inputs: [],
  },
  {
    id: 'playwright',
    title: 'Playwright',
    publisher: 'Microsoft',
    repo: 'microsoft/playwright-mcp',
    icon: 'https://playwright.dev/img/playwright-logo.svg',
    homepage: 'https://github.com/microsoft/playwright-mcp',
    category: 'browser',
    descriptionZh: '驱动真实浏览器打开网页、点击、输入并读取无障碍树，适合网页测试与自动化操作。',
    descriptionEn: 'Drive a real browser: open pages, click, type, and read them through the accessibility tree.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@playwright/mcp@latest'],
    inputs: [],
  },
  {
    id: 'chrome-devtools',
    title: 'Chrome DevTools',
    publisher: 'Google',
    repo: 'ChromeDevTools/chrome-devtools-mcp',
    icon: 'https://avatars.githubusercontent.com/u/11260967?s=96&v=4',
    homepage: 'https://github.com/ChromeDevTools/chrome-devtools-mcp',
    category: 'browser',
    descriptionZh: '控制和调试实时 Chrome：查看控制台日志、网络请求、性能 Trace 与页面截图。',
    descriptionEn: 'Control and inspect a live Chrome: console, network, performance traces, and screenshots.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'chrome-devtools-mcp@latest'],
    inputs: [],
  },
  {
    id: 'github',
    title: 'GitHub',
    publisher: 'GitHub',
    repo: 'github/github-mcp-server',
    icon: 'https://avatars.githubusercontent.com/u/9919?s=96&v=4',
    homepage: 'https://github.com/github/github-mcp-server',
    category: 'dev',
    descriptionZh: '管理 GitHub 仓库、Issue、Pull Request、Actions 工作流与全站代码检索。',
    descriptionEn: 'Repositories, issues, pull requests, Actions, and code search on GitHub.',
    transport: 'streamable-http',
    url: 'https://api.githubcopilot.com/mcp/',
    inputs: [
      {
        key: 'Authorization',
        where: 'header',
        labelZh: 'Personal Access Token',
        labelEn: 'Personal access token',
        descriptionZh: '在 github.com/settings/personal-access-tokens 创建并授予所需仓库权限。',
        descriptionEn: 'Create a token at github.com/settings/personal-access-tokens.',
        placeholder: 'github_pat_…',
        secret: true,
        required: true,
        format: 'Bearer {}',
      },
    ],
  },
  {
    id: 'exa',
    title: 'Exa',
    publisher: 'Exa',
    repo: 'exa-labs/exa-mcp-server',
    icon: 'https://avatars.githubusercontent.com/u/77906174?s=96&v=4',
    homepage: 'https://docs.exa.ai/reference/exa-mcp',
    category: 'search',
    descriptionZh: '面向 Agent 的语义网页搜索与代码搜索，返回干净的网页正文内容。',
    descriptionEn: 'Web search and code search built for agents, with clean page contents.',
    transport: 'streamable-http',
    url: 'https://mcp.exa.ai/mcp',
    inputs: [],
  },
  {
    id: 'anysearch',
    title: 'AnySearch',
    publisher: 'AnySearch',
    repo: 'anysearch-ai/anysearch-mcp-server',
    icon: 'https://avatars.githubusercontent.com/u/271186954?s=96&v=4',
    homepage: 'https://github.com/anysearch-ai/anysearch-mcp-server',
    category: 'search',
    descriptionZh: '实时网页搜索、垂直领域搜索（金融、论文、代码、安全等）及 Markdown 全文抓取。',
    descriptionEn: 'Real-time web search, vertical searches (finance, papers, code, security), and full pages as Markdown.',
    transport: 'streamable-http',
    url: 'https://api.anysearch.com/mcp',
    inputs: [
      {
        key: 'Authorization',
        where: 'header',
        labelZh: 'API Key',
        labelEn: 'API key',
        descriptionZh: '可选，用于提高配额（可在 anysearch.com/console/api-keys 获取）。',
        descriptionEn: 'Optional — raises the rate limit. From anysearch.com/console/api-keys.',
        placeholder: 'as_sk_…',
        secret: true,
        required: false,
        format: 'Bearer {}',
      },
    ],
  },
  {
    id: 'filesystem',
    title: 'Filesystem',
    publisher: 'Model Context Protocol',
    repo: 'modelcontextprotocol/servers',
    icon: 'https://avatars.githubusercontent.com/u/182288589?s=96&v=4',
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem',
    category: 'dev',
    descriptionZh: '在指定授权目录范围内读取、写入和搜索本地文件，适合安全开放额外目录。',
    descriptionEn: 'Read, write, and search files, limited to the folders you allow.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    inputs: [
      {
        key: 'dir',
        where: 'arg',
        labelZh: '授权目录路径',
        labelEn: 'Allowed folder path',
        descriptionZh: '允许该服务器读写的本地绝对目录路径。',
        descriptionEn: 'The local folder path this server may read and write.',
        placeholder: '/Users/you/projects',
        required: true,
      },
    ],
  },
  {
    id: 'fetch',
    title: 'Fetch',
    publisher: 'Model Context Protocol',
    repo: 'modelcontextprotocol/servers',
    icon: 'https://avatars.githubusercontent.com/u/182288589?s=96&v=4',
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/fetch',
    category: 'search',
    descriptionZh: '抓取指定网页并将正文转换为适合模型阅读的 Markdown 格式（需本机安装 uv）。',
    descriptionEn: 'Fetch a web page and convert its content into Markdown (requires uv).',
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-fetch'],
    inputs: [],
  },
  {
    id: 'memory',
    title: 'Memory',
    publisher: 'Model Context Protocol',
    repo: 'modelcontextprotocol/servers',
    icon: 'https://avatars.githubusercontent.com/u/182288589?s=96&v=4',
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/memory',
    category: 'memory',
    descriptionZh: '基于本地知识图谱的持久化记忆，让 Agent 跨会话记住实体、关系与偏好。',
    descriptionEn: 'A persistent knowledge graph the agent keeps across conversations.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    inputs: [],
  },
  {
    id: 'sequential-thinking',
    title: 'Sequential Thinking',
    publisher: 'Model Context Protocol',
    repo: 'modelcontextprotocol/servers',
    icon: 'https://avatars.githubusercontent.com/u/182288589?s=96&v=4',
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking',
    category: 'memory',
    descriptionZh: '提供结构化分步推理、反思修订与分支探索工具，适合复杂架构与排错任务。',
    descriptionEn: 'Think a problem through step by step, revising and branching as it goes.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    inputs: [],
  },
  {
    id: 'git',
    title: 'Git',
    publisher: 'Model Context Protocol',
    repo: 'modelcontextprotocol/servers',
    icon: 'https://avatars.githubusercontent.com/u/182288589?s=96&v=4',
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/git',
    category: 'dev',
    descriptionZh: '读取、检索并操作本地 Git 仓库的提交历史、分支与差异（需本机安装 uv）。',
    descriptionEn: 'Read, search, and manipulate local Git repositories (requires uv).',
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-git'],
    inputs: [],
  },
  {
    id: 'time',
    title: 'Time',
    publisher: 'Model Context Protocol',
    repo: 'modelcontextprotocol/servers',
    icon: 'https://avatars.githubusercontent.com/u/182288589?s=96&v=4',
    homepage: 'https://github.com/modelcontextprotocol/servers/tree/main/src/time',
    category: 'dev',
    descriptionZh: '获取全球各地当前时间并进行 IANA 时区换算（需本机安装 uv）。',
    descriptionEn: 'Current time anywhere and conversions between IANA time zones (requires uv).',
    transport: 'stdio',
    command: 'uvx',
    args: ['mcp-server-time'],
    inputs: [],
  },
  {
    id: 'cloudflare-docs',
    title: 'Cloudflare Docs',
    publisher: 'Cloudflare',
    repo: 'cloudflare/mcp-server-cloudflare',
    icon: 'https://avatars.githubusercontent.com/u/314135?s=96&v=4',
    homepage: 'https://github.com/cloudflare/mcp-server-cloudflare',
    category: 'docs',
    descriptionZh: '检索 Cloudflare Workers、Pages、R2、Zero Trust 等全套官方技术文档。',
    descriptionEn: 'Search Cloudflare’s official documentation for Workers, Pages, R2, and more.',
    transport: 'streamable-http',
    url: 'https://docs.mcp.cloudflare.com/mcp',
    inputs: [],
  },
  {
    id: 'microsoft-learn',
    title: 'Microsoft Learn',
    publisher: 'Microsoft',
    repo: 'MicrosoftDocs/mcp',
    icon: 'https://avatars.githubusercontent.com/u/22479449?s=96&v=4',
    homepage: 'https://github.com/MicrosoftDocs/mcp',
    category: 'docs',
    descriptionZh: '检索微软与 Azure 官方文档、API 参考及权威代码示例。',
    descriptionEn: 'Official Microsoft and Azure documentation and code samples.',
    transport: 'streamable-http',
    url: 'https://learn.microsoft.com/api/mcp',
    inputs: [],
  },
  {
    id: 'huggingface',
    title: 'Hugging Face',
    publisher: 'Hugging Face',
    repo: 'huggingface/hf-mcp-server',
    icon: 'https://avatars.githubusercontent.com/u/25720743?s=96&v=4',
    homepage: 'https://huggingface.co/settings/mcp',
    category: 'docs',
    descriptionZh: '搜索 Hugging Face Hub 上的开源模型、数据集、Spaces 应用与论文。',
    descriptionEn: 'Search models, datasets, Spaces, and papers on the Hugging Face Hub.',
    transport: 'streamable-http',
    url: 'https://huggingface.co/mcp',
    inputs: [],
  },
  {
    id: 'brave-search',
    title: 'Brave Search',
    publisher: 'Brave',
    repo: 'brave/brave-search-mcp-server',
    icon: 'https://avatars.githubusercontent.com/u/12301619?s=96&v=4',
    homepage: 'https://github.com/brave/brave-search-mcp-server',
    category: 'search',
    descriptionZh: '使用 Brave 独立搜索引擎进行网页、新闻、图片与本地信息检索。',
    descriptionEn: 'Web, news, image, and local search from Brave’s independent index.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@brave/brave-search-mcp-server'],
    inputs: [
      {
        key: 'BRAVE_API_KEY',
        where: 'env',
        labelZh: 'Brave API Key',
        labelEn: 'Brave API key',
        descriptionZh: '在 brave.com/search/api 申请 API Key。',
        descriptionEn: 'Obtain an API key at brave.com/search/api.',
        secret: true,
        required: true,
      },
    ],
  },
  {
    id: 'firecrawl',
    title: 'Firecrawl',
    publisher: 'Firecrawl',
    repo: 'firecrawl/firecrawl-mcp-server',
    icon: 'https://avatars.githubusercontent.com/u/135057108?s=96&v=4',
    homepage: 'https://github.com/firecrawl/firecrawl-mcp-server',
    category: 'search',
    descriptionZh: '抓取、整站爬取并搜索网页内容，输出结构干净的 Markdown。',
    descriptionEn: 'Scrape, crawl, and search the web into clean Markdown.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'firecrawl-mcp'],
    inputs: [
      {
        key: 'FIRECRAWL_API_KEY',
        where: 'env',
        labelZh: 'Firecrawl API Key',
        labelEn: 'Firecrawl API key',
        descriptionZh: '在 firecrawl.dev/app/api-keys 获取 API Key。',
        descriptionEn: 'Obtain an API key at firecrawl.dev/app/api-keys.',
        secret: true,
        required: true,
      },
    ],
  },
  {
    id: 'tavily',
    title: 'Tavily',
    publisher: 'Tavily',
    repo: 'tavily-ai/tavily-mcp',
    icon: 'https://avatars.githubusercontent.com/u/170207473?s=96&v=4',
    homepage: 'https://github.com/tavily-ai/tavily-mcp',
    category: 'search',
    descriptionZh: '专为 AI Agent 优化的联网搜索与网页正文提取服务。',
    descriptionEn: 'Search and extract web content with Tavily.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'tavily-mcp'],
    inputs: [
      {
        key: 'TAVILY_API_KEY',
        where: 'env',
        labelZh: 'Tavily API Key',
        labelEn: 'Tavily API key',
        descriptionZh: '在 app.tavily.com 获取 API Key。',
        descriptionEn: 'Obtain an API key at app.tavily.com.',
        secret: true,
        required: true,
      },
    ],
  },
  {
    id: 'amap-maps',
    title: '高德地图',
    publisher: 'Amap',
    repo: 'amap-demo/amap-maps-mcp-server',
    icon: 'https://avatars.githubusercontent.com/u/22885400?s=96&v=4',
    homepage: 'https://lbs.amap.com/api/mcp-server/summary',
    category: 'life',
    descriptionZh: '高德官方地图服务：路线规划、POI 地点检索、地理编码、周边查询与实时天气。',
    descriptionEn: 'Official Amap (Gaode) Maps MCP: routing, POI search, geocoding, nearby search, and weather.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@amap/amap-maps-mcp-server'],
    inputs: [
      {
        key: 'AMAP_MAPS_API_KEY',
        where: 'env',
        labelZh: '高德 Web 服务 Key',
        labelEn: 'Amap API key',
        descriptionZh: '在高德开放平台控制台（lbs.amap.com）创建 Web 服务类型的 API Key。',
        descriptionEn: 'Create a Web Service API key at lbs.amap.com.',
        secret: true,
        required: true,
      },
    ],
  },
  {
    id: 'baidu-map',
    title: '百度地图',
    publisher: 'Baidu Maps',
    repo: 'baidu-maps/mcp',
    icon: 'https://avatars.githubusercontent.com/u/204146226?s=96&v=4',
    homepage: 'https://lbsyun.baidu.com/faq/api?title=mcpserver/base',
    category: 'life',
    descriptionZh: '百度地图官方 MCP：地点检索、路线规划、实时路况、地理编码与天气查询。',
    descriptionEn: 'Official Baidu Maps MCP: place search, routing, live traffic, geocoding, and weather.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@baidumap/mcp-server-baidu-map'],
    inputs: [
      {
        key: 'BAIDU_MAP_API_KEY',
        where: 'env',
        labelZh: '百度地图 AK',
        labelEn: 'Baidu Map API key',
        descriptionZh: '在百度地图开放平台（lbsyun.baidu.com）创建服务端 AK。',
        descriptionEn: 'Create a server-side AK at lbsyun.baidu.com.',
        secret: true,
        required: true,
      },
    ],
  },
  {
    id: '12306',
    title: '12306 火车票',
    publisher: '12306-mcp',
    repo: 'Joooook/12306-mcp',
    icon: 'https://avatars.githubusercontent.com/u/118427326?s=96&v=4',
    homepage: 'https://github.com/Joooook/12306-mcp',
    category: 'life',
    descriptionZh: '实时查询中国铁路 12306 车次、余票、票价、中转方案与经停站，开箱即用免密钥。',
    descriptionEn: 'Real-time China Railway 12306 train schedules, ticket availability, transfers, and stops.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '12306-mcp'],
    inputs: [],
  },
  {
    id: 'lark-mcp',
    title: '飞书 / Lark',
    publisher: 'Larksuite',
    repo: 'larksuite/lark-openapi-mcp',
    icon: 'https://avatars.githubusercontent.com/u/54944174?s=96&v=4',
    homepage: 'https://github.com/larksuite/lark-openapi-mcp',
    category: 'office',
    descriptionZh: '飞书官方 OpenAPI MCP：读写云文档、操作多维表格、管理群聊与发送消息。',
    descriptionEn: 'Official Feishu / Lark OpenAPI MCP for docs, Bitable, chats, and messaging.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@larksuiteoapi/lark-mcp', 'mcp'],
    inputs: [
      {
        key: 'APP_ID',
        where: 'arg',
        flag: '-a',
        labelZh: '飞书 App ID',
        labelEn: 'Feishu / Lark App ID',
        descriptionZh: '在飞书开放平台应用凭证页获取（通常以 cli_ 开头）。',
        descriptionEn: 'App ID from the Feishu/Lark developer console (usually starts with cli_).',
        placeholder: 'cli_…',
        required: true,
      },
      {
        key: 'APP_SECRET',
        where: 'arg',
        flag: '-s',
        labelZh: '飞书 App Secret',
        labelEn: 'Feishu / Lark App Secret',
        descriptionZh: '对应应用的 App Secret，将安全存入 DSH 凭据库。',
        descriptionEn: 'App Secret for the application; stored securely in the credential store.',
        secret: true,
        required: true,
      },
    ],
  },
  {
    id: 'dingtalk-mcp',
    title: '钉钉',
    publisher: 'DingTalk',
    repo: 'open-dingtalk/dingtalk-mcp',
    icon: 'https://avatars.githubusercontent.com/u/31611746?s=96&v=4',
    homepage: 'https://open.dingtalk.com/document/ai-dev/dingtalk-server-api-mcp-overview',
    category: 'office',
    descriptionZh: '钉钉官方 MCP：接入通讯录、日程、待办、审批与消息等钉钉服务端能力。',
    descriptionEn: 'Official DingTalk MCP for contacts, calendar, tasks, approvals, and enterprise messaging.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'dingtalk-mcp@latest'],
    env: { ACTIVE_PROFILES: 'ALL' },
    inputs: [
      {
        key: 'DINGTALK_Client_ID',
        where: 'env',
        labelZh: '钉钉 Client ID',
        labelEn: 'DingTalk Client ID',
        descriptionZh: '在钉钉开放平台应用凭证与基础信息中获取。',
        descriptionEn: 'Client ID from the DingTalk Open Platform console.',
        required: true,
      },
      {
        key: 'DINGTALK_Client_Secret',
        where: 'env',
        labelZh: '钉钉 Client Secret',
        labelEn: 'DingTalk Client Secret',
        descriptionZh: '对应应用的 Client Secret，将安全存入 DSH 凭据库。',
        descriptionEn: 'Client Secret for the DingTalk app.',
        secret: true,
        required: true,
      },
      {
        key: 'ACTIVE_PROFILES',
        where: 'env',
        labelZh: '启用的能力集',
        labelEn: 'Active profiles',
        descriptionZh: '可选，默认 ALL；也可按需填逗号分隔模块（如 dingtalk-contacts,dingtalk-calendar）。',
        descriptionEn: 'Optional (defaults to ALL); comma-separated profile IDs to limit exposed tools.',
        placeholder: 'ALL',
        required: false,
      },
    ],
  },
  {
    id: 'yuque',
    title: '语雀',
    publisher: 'Yuque',
    repo: 'yuque/yuque-mcp-server',
    icon: 'https://avatars.githubusercontent.com/u/34602419?s=96&v=4',
    homepage: 'https://github.com/yuque/yuque-mcp-server',
    category: 'office',
    descriptionZh: '连接语雀个人或团队知识库，支持文档搜索、阅读、创建与编辑更新。',
    descriptionEn: 'Connect to Yuque knowledge bases to search, read, create, and update docs.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'yuque-mcp'],
    inputs: [
      {
        key: 'YUQUE_TOKEN',
        where: 'env',
        labelZh: '语雀 API Token',
        labelEn: 'Yuque API token',
        descriptionZh: '在语雀个人设置 → Token 中生成个人或团队访问令牌。',
        descriptionEn: 'Generate an API token in your Yuque account settings.',
        secret: true,
        required: true,
      },
      {
        key: 'YUQUE_HOST',
        where: 'env',
        labelZh: '自定义语雀域名',
        labelEn: 'Custom Yuque host',
        descriptionZh: '可选，使用企业独立空间或私有部署时填写。',
        descriptionEn: 'Optional — only needed for enterprise custom domains.',
        placeholder: 'https://your-org.yuque.com',
        required: false,
      },
    ],
  },
  {
    id: 'notion',
    title: 'Notion',
    publisher: 'Notion',
    repo: 'makenotion/notion-mcp-server',
    icon: 'https://avatars.githubusercontent.com/u/4792552?s=96&v=4',
    homepage: 'https://github.com/makenotion/notion-mcp-server',
    category: 'office',
    descriptionZh: 'Notion 官方 MCP：搜索、读取与编辑 Notion 工作区中的页面、块和数据库。',
    descriptionEn: 'Official Notion MCP to search, read, and update pages, blocks, and databases.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@notionhq/notion-mcp-server'],
    inputs: [
      {
        key: 'NOTION_TOKEN',
        where: 'env',
        labelZh: 'Notion Integration Token',
        labelEn: 'Notion integration token',
        descriptionZh: '在 notion.so/profile/integrations 创建内部集成并授权目标页面。',
        descriptionEn: 'Create an internal integration at notion.so/profile/integrations.',
        placeholder: 'ntn_…',
        secret: true,
        required: true,
      },
    ],
  },
  {
    id: 'markitdown',
    title: 'MarkItDown',
    publisher: 'Microsoft',
    repo: 'microsoft/markitdown',
    icon: 'https://avatars.githubusercontent.com/u/6154722?s=96&v=4',
    homepage: 'https://github.com/microsoft/markitdown',
    category: 'office',
    descriptionZh: '微软官方格式转换工具：将 PDF、Word、PPT、Excel 等文档一键转为 Markdown（需本机安装 uv）。',
    descriptionEn: 'Official Microsoft converter for turning PDF, Word, PPT, Excel, and more into Markdown (requires uv).',
    transport: 'stdio',
    command: 'uvx',
    args: ['markitdown-mcp'],
    inputs: [],
  },
  {
    id: 'antv-chart',
    title: 'AntV 图表',
    publisher: 'AntV',
    repo: 'antvis/mcp-server-chart',
    icon: 'https://avatars.githubusercontent.com/u/19199542?s=96&v=4',
    homepage: 'https://github.com/antvis/mcp-server-chart',
    category: 'visual',
    descriptionZh: '蚂蚁 AntV 官方可视化 MCP：免密钥生成柱状图、折线图、饼图、思维导图等 25+ 种专业图表。',
    descriptionEn: 'Official AntV MCP for generating 25+ chart types including bar, line, pie, and mind maps.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@antv/mcp-server-chart'],
    inputs: [],
  },
  {
    id: 'next-ai-drawio',
    title: 'Next AI Draw.io',
    publisher: 'Next AI Draw.io',
    repo: 'DayuanJiang/next-ai-draw-io',
    icon: 'https://avatars.githubusercontent.com/u/34411969?s=96&v=4',
    homepage: 'https://github.com/DayuanJiang/next-ai-draw-io',
    category: 'visual',
    descriptionZh: '在实时浏览器画布中让 AI 直接绘制和修改 Draw.io 架构图、流程图与系统拓扑图。',
    descriptionEn: 'Draw and edit live Draw.io architecture and flow diagrams in the browser alongside your agent.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@next-ai-drawio/mcp-server@latest'],
    // A cold npm install can exceed the manager's 30-second startup budget.
    startupTimeoutMs: 120_000,
    inputs: [],
  },
  {
    id: 'minimax',
    title: 'MiniMax',
    publisher: 'MiniMax',
    repo: 'MiniMax-AI/MiniMax-MCP',
    icon: 'https://avatars.githubusercontent.com/u/194880281?s=96&v=4',
    homepage: 'https://github.com/MiniMax-AI/MiniMax-MCP',
    category: 'visual',
    descriptionZh: 'MiniMax 官方多模态 MCP：语音合成、音色克隆、文生图与视频生成（默认国内接口，需本机安装 uv）。',
    descriptionEn: 'Official MiniMax multimodal MCP for TTS, voice cloning, image, and video generation (requires uv).',
    transport: 'stdio',
    command: 'uvx',
    args: ['minimax-mcp'],
    env: { MINIMAX_API_HOST: 'https://api.minimaxi.com' },
    inputs: [
      {
        key: 'MINIMAX_API_KEY',
        where: 'env',
        labelZh: 'MiniMax API Key',
        labelEn: 'MiniMax API key',
        descriptionZh: '在 MiniMax 开放平台（platform.minimaxi.com）获取与域名匹配的 API Key。',
        descriptionEn: 'API key matching your chosen host (China: platform.minimaxi.com; Global: platform.minimax.io).',
        secret: true,
        required: true,
      },
      {
        key: 'MINIMAX_API_HOST',
        where: 'env',
        labelZh: 'API Host',
        labelEn: 'API host',
        descriptionZh: '可选，默认国内站 https://api.minimaxi.com；国际站请填 https://api.minimax.io。',
        descriptionEn: 'Optional — defaults to https://api.minimaxi.com; use https://api.minimax.io for global keys.',
        placeholder: 'https://api.minimaxi.com',
        required: false,
      },
      {
        key: 'MINIMAX_MCP_BASE_PATH',
        where: 'env',
        labelZh: '本地输出目录',
        labelEn: 'Local output directory',
        descriptionZh: '可选，保存生成的音频/图片/视频文件的本地绝对路径。',
        descriptionEn: 'Optional local folder path for saving generated media files.',
        placeholder: '/Users/you/Downloads',
        required: false,
      },
    ],
  },
  {
    id: 'edgeone-pages',
    title: 'EdgeOne Pages',
    publisher: 'Tencent EdgeOne',
    repo: 'TencentEdgeOne/edgeone-pages-mcp',
    icon: 'https://avatars.githubusercontent.com/u/176978739?s=96&v=4',
    homepage: 'https://github.com/TencentEdgeOne/edgeone-pages-mcp',
    category: 'dev',
    descriptionZh: '腾讯云 EdgeOne Pages 官方 MCP：将 HTML 与静态网页一键部署并生成可分享的公网访问链接（中国区）。',
    descriptionEn: 'Official Tencent EdgeOne Pages MCP to deploy HTML & static sites to a live public URL (China region).',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@edgeone/makers-mcp@latest', '--region', 'china'],
    inputs: [
      {
        key: 'EDGEONE_PAGES_API_TOKEN',
        where: 'env',
        labelZh: 'EdgeOne API Token',
        labelEn: 'EdgeOne API token',
        descriptionZh: '可选，填写后可跳过浏览器登录流程（在 pages.edgeone.ai 获取）。',
        descriptionEn: 'Optional — skips interactive browser login when provided.',
        secret: true,
        required: false,
      },
    ],
  },
  {
    id: 'figma',
    title: 'Figma',
    publisher: 'Framelink',
    repo: 'GLips/Figma-Context-MCP',
    icon: 'https://avatars.githubusercontent.com/u/842883?s=96&v=4',
    homepage: 'https://github.com/GLips/Figma-Context-MCP',
    category: 'dev',
    descriptionZh: '让 Agent 直接读取 Figma 设计稿结构、布局与样式元数据，高效还原前端页面。',
    descriptionEn: 'Give your coding agent structured access to Figma layouts and styles for accurate UI implementation.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'figma-developer-mcp', '--stdio'],
    inputs: [
      {
        key: 'FIGMA_API_KEY',
        where: 'env',
        labelZh: 'Figma Personal Access Token',
        labelEn: 'Figma personal access token',
        descriptionZh: '在 Figma 账号设置 → Security 中生成只读访问令牌。',
        descriptionEn: 'Generate a personal access token in Figma Account Settings -> Security.',
        placeholder: 'figd_…',
        secret: true,
        required: true,
      },
    ],
  },
  {
    id: 'repomix',
    title: 'Repomix',
    publisher: 'Repomix',
    repo: 'yamadashy/repomix',
    icon: 'https://avatars.githubusercontent.com/u/5019072?s=96&v=4',
    homepage: 'https://repomix.com',
    category: 'dev',
    descriptionZh: '将本地或远程 Git 仓库高效打包为适合 AI 阅读与搜索的结构化代码上下文。',
    descriptionEn: 'Pack local or remote codebases into AI-friendly files for fast reading and search.',
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'repomix', '--mcp'],
    inputs: [],
  },
]

/** Look up one curated server by its canonical id (case-insensitive). */
export function findFeaturedMcpById(id: string): FeaturedMcpServer | undefined {
  const target = id.trim().toLowerCase()
  if (target === '') return undefined
  return FEATURED_MCP_SERVERS.find(item => item.id.toLowerCase() === target)
}

/** `uvx` options that consume the following argument (except `--from`, whose value is the package). */
const UV_VALUED_OPTS = new Set([
  '--with', '-w', '--with-editable', '--with-requirements', '-p', '--python', '--prerelease',
  '--index', '--index-url', '-i', '--extra-index-url', '--default-index',
  '--resolution', '--constraints', '-c', '--overrides',
])

const basenameLower = (command: string): string =>
  command.trim().replace(/^.*[\\/]/, '').replace(/\.(?:exe|cmd|bat)$/i, '').toLowerCase()

/**
 * Canonical identity key for an MCP server, independent of its configured
 * server name: normalized endpoint URL for HTTP, or `<runner> <package>`
 * (version tag stripped) for stdio.
 */
export function mcpIdentityKey(target: {
  readonly transport?: string
  readonly url?: string
  readonly command?: string
  readonly args?: readonly string[]
}): string {
  if (target.transport === 'streamable-http' || target.transport === 'http') {
    return (target.url ?? '').trim().toLowerCase().replace(/\/+$/, '')
  }
  if (target.transport !== 'stdio') return ''
  let cmd = basenameLower(target.command ?? '')
  let args = [...(target.args ?? [])]
  if (cmd === '') return ''
  // Unwrap Windows `cmd /c <command> ...` wrappers so static/manual rows still match.
  if (cmd === 'cmd' && args.length >= 2 && /^\/[ck]$/i.test(args[0]!)) {
    cmd = basenameLower(args[1]!)
    args = args.slice(2)
  }
  const isUv = cmd === 'uvx'
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i]!.trim()
    if (isUv && UV_VALUED_OPTS.has(arg)) {
      i += 1
      continue
    }
    if (arg === '' || arg.startsWith('-') || arg === 'run' || arg === 'dlx') continue
    const at = arg.lastIndexOf('@')
    const pkg = at > 0 ? arg.slice(0, at) : arg
    return `${cmd} ${pkg.toLowerCase()}`
  }
  return cmd
}

/** Pick an available server name within DSH's 1–32 char grammar (`id`, `id-2`, …). */
export function pickAvailableServerName(baseId: string, taken: ReadonlySet<string>): string {
  const clean = baseId.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'mcp-server'
  if (!taken.has(clean)) return clean
  for (let suffix = 2; suffix < 1000; suffix += 1) {
    const tail = `-${suffix}`
    const candidate = `${clean.slice(0, 32 - tail.length)}${tail}`
    if (!taken.has(candidate)) return candidate
  }
  return clean
}

/** Whether a curated server matches the active category filter and search text. */
export function matchesFeaturedMcp(
  item: FeaturedMcpServer,
  query: string,
  category: FeaturedMcpCategory | 'all',
): boolean {
  if (category !== 'all' && item.category !== category) return false
  const needle = query.trim().toLocaleLowerCase()
  if (needle === '') return true
  const haystack = [
    item.id,
    item.title,
    item.publisher,
    item.descriptionZh,
    item.descriptionEn,
    item.command ?? '',
    ...(item.args ?? []),
    item.url ?? '',
  ].join(' ').toLocaleLowerCase()
  return haystack.includes(needle)
}

/** Short runtime label shown on curated MCP cards (`HTTP`, `npx`, `uvx`, …). */
export function featuredRuntimeBadge(item: FeaturedMcpServer): string {
  if (item.transport === 'streamable-http') return 'HTTP'
  return item.command ?? 'stdio'
}

/** Preview target line shown in the curated detail dialog (command line or URL). */
export function featuredTargetPreview(item: FeaturedMcpServer): string {
  if (item.transport === 'streamable-http') return item.url ?? ''
  return [item.command ?? '', ...(item.args ?? [])].filter(part => part !== '').join(' ')
}

/** Whether any input on this curated server is required before saving. */
export function hasRequiredInputs(item: FeaturedMcpServer): boolean {
  return item.inputs.some(input => input.required === true)
}

/** Whether any input on this curated server is a secret credential. */
export function hasSecretInputs(item: FeaturedMcpServer): boolean {
  return item.inputs.some(input => input.secret === true)
}
