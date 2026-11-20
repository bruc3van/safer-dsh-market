/**
 * End-to-end tests for agent-native discovery:
 * - pure catalog search, ranking, detail, and environment summaries
 * - built-in `dsh-market-pro` skill registration against the real SkillRegistry
 * - read-only `dsh_market_pro` tool registration and execution against a real Cordis context
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import { Context } from '@deepseek-ai/cordis'
import SkillRegistry from '@deepseek-ai/dsh-skill'
import {
  buildAiEnvironment,
  buildAiOverview,
  lookupAiCatalogDetail,
  searchAiCatalog,
} from '../src/aiSearch.ts'
import {
  MARKET_SKILL_NAME,
  MARKET_SKILL_PROVIDER,
  MARKET_SKILL_RANK,
  registerMarketAiSkill,
} from '../src/aiSkill.ts'
import {
  MARKET_TOOL_NAME,
  createMarketAiToolDefinition,
  registerMarketAiTool,
} from '../src/aiTools.ts'
import type {
  MarketCatalog,
  MarketInstalledPackage,
  MarketInstalledResult,
  MarketPlugin,
  McpHostContext,
  SafeMarketSettings,
} from '../src/contract.ts'

const makePlugin = (over: Partial<MarketPlugin> = {}): MarketPlugin => ({
  fullName: 'acme/feishu-bot',
  owner: 'acme',
  name: 'feishu-bot',
  url: 'https://github.com/acme/feishu-bot',
  description: '飞书消息推送与群机器人插件',
  descriptionEn: 'Feishu message push and group bot plugin',
  stars: 320,
  language: 'TypeScript',
  license: 'MIT',
  pushedAt: '2026-11-18T00:00:00Z',
  defaultBranch: 'main',
  category: 'messaging',
  categoryZh: '消息与通知',
  categoryEn: 'Messaging',
  installStatus: 'command',
  installInfo: {
    mode: 'command',
    targets: [{ install: 'dsh-feishu-bot@1.2.0', profile: 'web', note: 'Need FEISHU_WEBHOOK' }],
    tasks: ['Send Feishu notifications'],
    requirements: ['FEISHU_WEBHOOK env var'],
    note: 'Supports card messages',
    manual: '',
  },
  keywords: ['feishu', 'lark', 'notify'],
  icon: 'data:image/svg+xml;base64,AAAA',
  ...over,
})

const fixtureCatalog = (): MarketCatalog => {
  const feishu = makePlugin()
  const drawio = makePlugin({
    fullName: 'bruc3van/bruce-drawio',
    owner: 'bruc3van',
    name: 'bruce-drawio',
    packageName: 'bruce-drawio',
    titleZh: '架构图绘制',
    titleEn: 'Diagram Drawer',
    url: 'https://github.com/bruc3van/bruce-drawio',
    description: '对话内生成 Draw.io 流程图与架构图',
    descriptionEn: 'Generate Draw.io architecture diagrams in chat',
    stars: 520,
    pushedAt: '2026-11-19T00:00:00Z',
    category: 'design',
    categoryZh: '设计与图表',
    categoryEn: 'Design & Diagrams',
    installInfo: {
      mode: 'command',
      targets: [{ install: 'bruce-drawio@2.0.0', profile: 'web', note: '' }],
      tasks: ['Create architecture diagrams'],
      requirements: [],
      note: '',
      manual: '',
    },
    keywords: ['drawio', 'diagram', 'architecture'],
  })
  const manualRepo = makePlugin({
    fullName: 'community/legacy-git',
    owner: 'community',
    name: 'legacy-git',
    url: 'https://github.com/community/legacy-git',
    description: 'Git 提交助手与 PR 总结',
    descriptionEn: 'Git commit helper and PR summary',
    stars: 90,
    pushedAt: '2026-11-10T00:00:00Z',
    category: 'dev',
    categoryZh: '开发工具',
    categoryEn: 'Developer Tools',
    installStatus: 'none',
    installInfo: undefined,
    keywords: ['git', 'pr'],
  })
  const archivedRepo = makePlugin({
    fullName: 'old/archived-feishu',
    owner: 'old',
    name: 'archived-feishu',
    url: 'https://github.com/old/archived-feishu',
    description: '旧版飞书机器人',
    stars: 999,
    archived: true,
  })
  return {
    items: [feishu, drawio, manualRepo, archivedRepo],
    categories: [
      { key: 'messaging', zh: '消息与通知', en: 'Messaging', count: 2 },
      { key: 'design', zh: '设计与图表', en: 'Design & Diagrams', count: 1 },
      { key: 'dev', zh: '开发工具', en: 'Developer Tools', count: 1 },
    ],
    featured: {
      titleZh: '编辑精选',
      titleEn: "Editor's Picks",
      updatedAt: '2026-11-19',
      count: 1,
      entries: [{ item: drawio, reason: '画架构图又快又清晰' }],
    },
    fetchedAt: '2026-11-19T12:00:00Z',
    refreshedAt: '2026-11-19T12:05:00Z',
    scanned: 40000,
  }
}

const installedPackagesFixture: readonly MarketInstalledPackage[] = [
  {
    packageName: 'dsh-market-pro',
    version: '1.6.0',
    description: 'market',
    repository: 'bruc3van/dsh-market-pro',
    self: true,
    inBox: false,
    unregistered: false,
    enabled: true,
    entries: [],
    error: '',
    heldDown: false,
  },
  {
    packageName: 'bruce-drawio',
    version: '1.9.0',
    description: 'drawio',
    repository: 'bruc3van/bruce-drawio',
    self: false,
    inBox: false,
    unregistered: false,
    enabled: true,
    entries: [],
    error: '',
    heldDown: false,
  },
]

const installedResultFixture: MarketInstalledResult = {
  packages: installedPackagesFixture,
  profile: 'web',
  error: '',
}

const mcpFixture: McpHostContext = {
  managerEntry: 'mcp-manager',
  managerActive: true,
  unmanaged: [{
    entryId: 'static-1',
    loaderId: 'static-1',
    serverName: 'custom-http',
    transport: 'streamable-http',
    command: '',
    args: [],
    envKeys: [],
    url: 'https://example.com/mcp',
    headerKeys: ['Authorization'],
    enabled: true,
    phase: 'active',
    plaintextSecrets: ['headers.Authorization'],
    adoptBlocker: '',
  }],
  tools: [{
    server: 'context7',
    tools: [{ name: 'mcp__context7__resolve-library-id', description: 'Resolve library' }],
  }],
  toolsError: '',
}

test('aiSearch ranks relevance, marks installed plugins, strips icons, and falls back to broad matches', () => {
  const catalog = fixtureCatalog()
  const exact = searchAiCatalog(catalog, false, installedPackagesFixture, { query: 'drawio' })
  assert.equal(exact.matchMode, 'exact')
  assert.equal(exact.total, 1)
  assert.equal(exact.entries[0]!.fullName, 'bruc3van/bruce-drawio')
  assert.equal(exact.entries[0]!.installed, true)
  assert.equal(exact.entries[0]!.installedVersion, '1.9.0')
  assert.equal(exact.entries[0]!.featured, true)
  assert.equal(exact.entries[0]!.reason, '画架构图又快又清晰')
  assert.equal('icon' in exact.entries[0]!, false, 'base64 icons must never enter tool output')

  // Archived entries are excluded by default unless explicitly requested.
  const withoutArchived = searchAiCatalog(catalog, false, installedPackagesFixture, { query: '飞书' })
  assert.equal(withoutArchived.entries.map(e => e.fullName).includes('old/archived-feishu'), false)
  const withArchived = searchAiCatalog(catalog, false, installedPackagesFixture, { query: '飞书', includeArchived: true })
  assert.equal(withArchived.entries.map(e => e.fullName).includes('old/archived-feishu'), true)

  // Broad fallback kicks in when all ANDed terms match nothing together.
  const broad = searchAiCatalog(catalog, false, installedPackagesFixture, { query: '飞书 nonexistentkeyword' })
  assert.equal(broad.matchMode, 'broad')
  assert.equal(broad.entries[0]!.fullName, 'acme/feishu-bot')

  // Direct-installable filter excludes catalog-only entries.
  const installable = searchAiCatalog(catalog, false, installedPackagesFixture, { installableOnly: true })
  assert.equal(installable.entries.some(e => e.fullName === 'community/legacy-git'), false)
})

test('aiSearch overview, detail, and environment return structured bounded summaries without secrets', () => {
  const catalog = fixtureCatalog()
  const overview = buildAiOverview(catalog, false, installedResultFixture, mcpFixture, 'web')
  assert.equal(overview.profile, 'web')
  assert.equal(overview.totalRepositories, 4)
  assert.equal(overview.featuredCount, 1)
  assert.equal(overview.installedCount, 2)
  assert.equal(overview.mcpServerCount, 2)
  assert.equal(overview.mcpToolCount, 1)

  const detail = lookupAiCatalogDetail(catalog, installedPackagesFixture, 'bruce-drawio')
  assert.ok(detail)
  assert.equal(detail.fullName, 'bruc3van/bruce-drawio')
  assert.equal(detail.installed, true)
  assert.equal(detail.installedEnabled, true)
  assert.equal(detail.installTargets?.[0]?.install, 'bruce-drawio@2.0.0')
  assert.equal(lookupAiCatalogDetail(catalog, installedPackagesFixture, 'does/not-exist'), null)

  const env = buildAiEnvironment('web', installedResultFixture, mcpFixture)
  const serialized = JSON.stringify(env)
  assert.equal(env.profile, 'web')
  assert.equal(env.mcp.toolGroups[0]!.server, 'context7')
  assert.equal(env.mcp.unmanagedServers[0]!.serverName, 'custom-http')
  assert.equal(serialized.includes('Authorization'), false, 'header names/secrets are omitted from AI environment')
})

test('aiSearch merges monorepo/featured entries, avoids sibling false-installed, and resolves detail by install targets', () => {
  const monoRepoRow = makePlugin({
    fullName: 'org/mono-plugins',
    owner: 'org',
    name: 'mono-plugins',
    packageName: undefined,
    description: 'Monorepo hosting multiple DSH plugins',
    stars: 410,
    pushedAt: '2026-11-19T00:00:00Z',
    category: 'dev',
    categoryZh: '开发工具',
    categoryEn: 'Developer Tools',
    installStatus: 'none',
    installInfo: undefined,
  })
  const pkgA = makePlugin({
    fullName: 'org/mono-plugins',
    owner: 'org',
    name: 'plugin-a',
    packageName: '@org/plugin-a',
    titleZh: '插件 A',
    stars: 0,
    pushedAt: '',
    category: 'dsh:subscription',
    categoryZh: '精选订阅',
    categoryEn: 'Curated',
    installStatus: 'command',
    installInfo: {
      mode: 'command',
      targets: [{ install: '@org/plugin-a@1.0.0', profile: 'web', note: '' }],
      tasks: ['Run A'],
      requirements: [],
      note: '',
      manual: '',
    },
  })
  const pkgB = makePlugin({
    fullName: 'org/mono-plugins',
    owner: 'org',
    name: 'plugin-b',
    packageName: '@org/plugin-b',
    titleZh: '插件 B',
    stars: 0,
    pushedAt: '',
    category: 'dsh:subscription',
    categoryZh: '精选订阅',
    categoryEn: 'Curated',
    installStatus: 'command',
    installInfo: {
      mode: 'command',
      targets: [{ install: '@org/plugin-b@2.1.0', profile: 'web', note: '' }],
      tasks: ['Run B'],
      requirements: [],
      note: '',
      manual: '',
    },
  })
  const inlineFeatured = makePlugin({
    fullName: 'inline/only-pick',
    owner: 'inline',
    name: 'only-pick',
    packageName: undefined,
    stars: 0,
    category: 'dsh:featured',
    categoryZh: '编辑精选',
    categoryEn: "Editor's Picks",
    installStatus: 'command',
    installInfo: {
      mode: 'command',
      targets: [{ install: 'inline-pkg@1.4.0', profile: 'web', note: '' }],
      tasks: ['Inline task'],
      requirements: [],
      note: '',
      manual: '',
    },
  })

  const catalog: MarketCatalog = {
    items: [monoRepoRow],
    categories: [{ key: 'dev', zh: '开发工具', en: 'Developer Tools', count: 1 }],
    featured: {
      titleZh: '编辑精选',
      titleEn: "Editor's Picks",
      updatedAt: '2026-11-19',
      count: 3,
      entries: [
        { item: pkgA, reason: '精选 A' },
        { item: pkgB, reason: '精选 B' },
        { item: inlineFeatured, reason: '内联精选' },
      ],
    },
    fetchedAt: '2026-11-19T12:00:00Z',
    refreshedAt: '2026-11-19T12:05:00Z',
    scanned: 100,
  }

  const installed: readonly MarketInstalledPackage[] = [
    {
      packageName: '@org/plugin-a',
      version: '1.0.0',
      description: 'a',
      repository: 'org/mono-plugins',
      self: false,
      inBox: false,
      unregistered: false,
      enabled: true,
      entries: [],
      error: '',
      heldDown: false,
    },
    {
      packageName: 'inline-pkg',
      version: '',
      description: '',
      repository: 'inline/only-pick',
      self: false,
      inBox: false,
      unregistered: false,
      enabled: false,
      entries: [],
      error: 'manifest unreadable',
      heldDown: false,
    },
  ]

  // scope="all" preserves both monorepo sibling packages AND inline featured, enriched with repo stars & install targets.
  const allInstallable = searchAiCatalog(catalog, false, installed, { scope: 'all', installableOnly: true })
  assert.equal(allInstallable.total, 3)
  const foundA = allInstallable.entries.find(e => e.packageName === '@org/plugin-a')
  const foundB = allInstallable.entries.find(e => e.packageName === '@org/plugin-b')
  const foundInline = allInstallable.entries.find(e => e.fullName === 'inline/only-pick')
  assert.ok(foundA && foundB && foundInline)
  assert.equal(foundA.installed, true)
  assert.equal(foundA.installedVersion, '1.0.0')
  assert.equal(foundA.stars, 410)
  assert.equal(foundA.category, 'dev')
  assert.equal(foundB.installed, false, 'uninstalled monorepo sibling must not inherit installed status via repo fallback')
  assert.equal(foundB.installedVersion, undefined)
  assert.equal(foundB.stars, 410)
  assert.equal(foundB.featured, true)
  assert.equal(foundB.reason, '精选 B')
  assert.equal(foundInline.installed, false, 'errored installed package must not be marked installed')

  // Overview installableCount counts merged featured & inline installable entries.
  const overview = buildAiOverview(catalog, false, { packages: installed, profile: 'web', error: '' }, mcpFixture, 'web')
  assert.equal(overview.installableCount, 3)

  // Detail lookup by subscription packageName backfills repo stars & keeps featured reason.
  const detailB = lookupAiCatalogDetail(catalog, installed, '@org/plugin-b')
  assert.ok(detailB)
  assert.equal(detailB.stars, 410)
  assert.equal(detailB.featured, true)
  assert.equal(detailB.reason, '精选 B')
  assert.equal(detailB.installed, false)

  // Detail lookup by versioned spec or unversioned package name hits inline featured entry too.
  const detailByPkg = lookupAiCatalogDetail(catalog, installed, 'inline-pkg')
  assert.ok(detailByPkg)
  assert.equal(detailByPkg.fullName, 'inline/only-pick')
  assert.equal(detailByPkg.featured, true)
  assert.equal(detailByPkg.reason, '内联精选')

  const detailBySpec = lookupAiCatalogDetail(catalog, installed, 'inline-pkg@1.4.0')
  assert.ok(detailBySpec)
  assert.equal(detailBySpec.fullName, 'inline/only-pick')
  assert.equal(detailBySpec.featured, true)

  // Detail lookup by versioned spec on fixtureCatalog preserves featured metadata.
  const fixtureDetail = lookupAiCatalogDetail(fixtureCatalog(), installedPackagesFixture, 'bruce-drawio@2.0.0')
  assert.ok(fixtureDetail)
  assert.equal(fixtureDetail.featured, true)
  assert.equal(fixtureDetail.reason, '画架构图又快又清晰')
})

test('built-in dsh-market-pro skill registers into real SkillRegistry, allows user override, and toggles live', async () => {
  const ctx = new Context()
  try {
    const skillsFiber = ctx.plugin(SkillRegistry)
    await skillsFiber.await()
    let settings: SafeMarketSettings = { enabled: true, aiAssistantEnabled: true }

    const handle = registerMarketAiSkill(ctx, {
      profile: 'web',
      readSettings: () => settings,
    })
    await setImmediate()

    const initial = await ctx.skills.list()
    const bundled = initial.find(skill => skill.name === MARKET_SKILL_NAME)
    assert.ok(bundled, 'dsh-market-pro skill must be listed when enabled')
    assert.equal(bundled.provider, MARKET_SKILL_PROVIDER)
    assert.equal(bundled.source, 'bundled')
    assert.deepEqual(bundled.invocation, { modelInvocable: true, userInvocable: true })

    const loaded = await ctx.skills.get(MARKET_SKILL_NAME)
    assert.ok(loaded)
    assert.match(loaded.content, /dsh_market_pro/)
    assert.match(loaded.content, /plugin_manager/)
    assert.match(loaded.content, /Current DSH profile: `web`/)

    // A lower-rank provider (e.g. user/project skill) cleanly overrides the bundled rank (600).
    const disposeOverride = ctx.skills.registerProvider(() => ({
      name: 'custom-override',
      async list() {
        return [{
          name: MARKET_SKILL_NAME,
          description: 'User custom override',
          invocation: { modelInvocable: true, userInvocable: true },
          source: 'user-dsh',
          provider: 'custom-override',
          rank: MARKET_SKILL_RANK - 100,
          locator: 'override',
        }]
      },
      async get() {
        return {
          name: MARKET_SKILL_NAME,
          description: 'User custom override',
          invocation: { modelInvocable: true, userInvocable: true },
          source: 'user-dsh',
          provider: 'custom-override',
          content: 'Custom user override body',
        }
      },
    }))
    assert.equal((await ctx.skills.get(MARKET_SKILL_NAME))?.provider, 'custom-override')
    disposeOverride()
    assert.equal((await ctx.skills.get(MARKET_SKILL_NAME))?.provider, MARKET_SKILL_PROVIDER)

    // Turning off aiAssistantEnabled hides the skill immediately after sync().
    settings = { enabled: true, aiAssistantEnabled: false }
    handle.sync()
    assert.equal((await ctx.skills.list()).some(skill => skill.name === MARKET_SKILL_NAME), false)
    assert.equal(await ctx.skills.get(MARKET_SKILL_NAME), undefined)

    // Re-enabling restores it immediately.
    settings = { enabled: true, aiAssistantEnabled: true }
    handle.sync()
    assert.equal((await ctx.skills.list()).some(skill => skill.name === MARKET_SKILL_NAME), true)
  } finally {
    await ctx.fiber.dispose()
  }
})

test('dsh_market_pro tool validates inputs, handles all actions, and respects settings switches', async () => {
  let settings: SafeMarketSettings = { enabled: true, aiAssistantEnabled: true }
  const catalog = fixtureCatalog()
  const tool = createMarketAiToolDefinition({
    profile: 'web',
    readSettings: () => settings,
    readCatalog: async () => ({ catalog, stale: false, error: '' }),
    listInstalled: async () => installedResultFixture,
    readMcp: () => mcpFixture,
  }) as {
    name: string
    parameters: Record<string, unknown>
    output: { schema: Record<string, unknown>; render: (args: unknown, value: unknown) => unknown[] }
    isConcurrencySafe: () => boolean
    execute: (args: unknown, exec?: { signal?: AbortSignal }) => Promise<string>
  }

  assert.equal(tool.name, MARKET_TOOL_NAME)
  assert.equal(tool.isConcurrencySafe(), true)

  const overview = JSON.parse(await tool.execute({ action: 'overview' })) as { totalRepositories: number; featuredCount: number }
  assert.equal(overview.totalRepositories, 4)
  assert.equal(overview.featuredCount, 1)

  const featured = JSON.parse(await tool.execute({ action: 'featured' })) as { entries: { fullName: string }[] }
  assert.deepEqual(featured.entries.map(e => e.fullName), ['bruc3van/bruce-drawio'])

  const search = JSON.parse(await tool.execute({ action: 'search', query: 'git' })) as { entries: { fullName: string }[] }
  assert.deepEqual(search.entries.map(e => e.fullName), ['community/legacy-git'])

  const detail = JSON.parse(await tool.execute({ action: 'detail', target: 'acme/feishu-bot' })) as { found: boolean; entry: { installStatus: string } }
  assert.equal(detail.found, true)
  assert.equal(detail.entry.installStatus, 'command')

  await assert.rejects(() => tool.execute({ action: 'detail' }), /target/)
  await assert.rejects(() => tool.execute({ action: 'detail', target: '   ' }), /target/)
  await assert.rejects(() => tool.execute({ action: 'unknown' }), /Invalid arguments/)

  // Missing target on detail must reject before touching catalog/installed I/O even when catalog is off.
  let catalogReads = 0
  let installedReads = 0
  const spyTool = createMarketAiToolDefinition({
    profile: 'web',
    readSettings: () => ({ enabled: false, aiAssistantEnabled: true }),
    readCatalog: async () => {
      catalogReads += 1
      return { catalog, stale: false, error: '' }
    },
    listInstalled: async () => {
      installedReads += 1
      return installedResultFixture
    },
    readMcp: () => mcpFixture,
  }) as { execute: (args: unknown) => Promise<string> }
  await assert.rejects(() => spyTool.execute({ action: 'detail' }), /target/)
  await assert.rejects(() => spyTool.execute({ action: 'detail', target: '  ' }), /target/)
  assert.equal(catalogReads, 0)
  assert.equal(installedReads, 0)

  // When online catalog is off, environment still works while catalog queries report catalog-disabled.
  settings = { enabled: false, aiAssistantEnabled: true }
  const envWhenOff = JSON.parse(await tool.execute({ action: 'environment' })) as { profile: string }
  assert.equal(envWhenOff.profile, 'web')
  const searchWhenOff = JSON.parse(await tool.execute({ action: 'search', query: 'git' })) as { error: string }
  assert.equal(searchWhenOff.error, 'catalog-disabled')

  // When AI assistant is off, execution refuses.
  settings = { enabled: true, aiAssistantEnabled: false }
  await assert.rejects(() => tool.execute({ action: 'overview' }), /disabled/)

  // AbortSignal is honored.
  settings = { enabled: true, aiAssistantEnabled: true }
  const controller = new AbortController()
  controller.abort(new Error('user aborted'))
  await assert.rejects(() => tool.execute({ action: 'overview' }, { signal: controller.signal }), /user aborted/)
})

test('registerMarketAiTool dynamically registers and withdraws tool on settings toggle and teardown', async () => {
  const ctx = new Context()
  const registered = new Map<string, { def: Record<string, unknown>; when?: () => boolean }>()
  ctx.provide('tools', {
    register(def: Record<string, unknown>, options?: { when?: () => boolean }) {
      const name = String(def.name)
      registered.set(name, { def, when: options?.when })
      return () => { registered.delete(name) }
    },
  } as unknown as never)
  try {
    let settings: SafeMarketSettings = { enabled: true, aiAssistantEnabled: true }
    const handle = registerMarketAiTool(ctx, {
      profile: 'web',
      readSettings: () => settings,
      readCatalog: async () => ({ catalog: fixtureCatalog(), stale: false, error: '' }),
      listInstalled: async () => installedResultFixture,
      readMcp: () => mcpFixture,
    })
    await setImmediate()

    assert.equal(registered.has(MARKET_TOOL_NAME), true)
    assert.equal(registered.get(MARKET_TOOL_NAME)?.when?.(), true)

    // Verify tool parameters & output strictly stay within DSH's supported JSON Schema subset.
    const allowedSchemaKeys = new Set([
      'type', 'oneOf', 'properties', 'required', 'additionalProperties', 'items', 'enum', 'const',
      'description', 'title', 'default', 'examples',
    ])
    const checkSchema = (node: unknown): void => {
      if (node === null || typeof node !== 'object' || Array.isArray(node)) return
      for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
        assert.ok(allowedSchemaKeys.has(key), `unsupported JSON Schema keyword "${key}"`)
        if (key === 'properties' && value !== null && typeof value === 'object') {
          for (const child of Object.values(value as Record<string, unknown>)) checkSchema(child)
        } else if (key === 'items') {
          checkSchema(value)
        }
      }
    }
    const def = registered.get(MARKET_TOOL_NAME)!.def as { parameters: unknown; output: { schema: unknown } }
    checkSchema(def.parameters)
    checkSchema(def.output.schema)

    settings = { enabled: true, aiAssistantEnabled: false }
    handle.sync()
    assert.equal(registered.has(MARKET_TOOL_NAME), false)

    settings = { enabled: true, aiAssistantEnabled: true }
    handle.sync()
    assert.equal(registered.has(MARKET_TOOL_NAME), true)
  } finally {
    await ctx.fiber.dispose()
  }
  assert.equal(registered.has(MARKET_TOOL_NAME), false)
})
