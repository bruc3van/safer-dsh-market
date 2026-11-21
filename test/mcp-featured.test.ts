import { test } from 'node:test'
import assert from 'node:assert/strict'
import { SERVER_NAME_PATTERN } from '../src/mcpShapes.ts'
import type { McpUnmanagedServer } from '../src/contract.ts'
import { en, zh, type SafeMarketLocaleKey } from '../src/client/locales.ts'
import { draftPlaintext, entryFromDraft, pendingToStore, validateDraft, type McpRow } from '../src/client/mcpModel.ts'
import {
  FEATURED_MCP_CATEGORIES,
  FEATURED_MCP_SERVERS,
  draftFromFeatured,
  featuredRuntimeBadge,
  featuredTargetPreview,
  findInstalledFeatured,
  hasRequiredInputs,
  hasSecretInputs,
  matchesFeaturedMcp,
  mcpIdentityKey,
  pickAvailableServerName,
  validateFeaturedValues,
} from '../src/client/mcpFeatured.ts'

const byId = (id: string) => {
  const item = FEATURED_MCP_SERVERS.find(entry => entry.id === id)
  assert.ok(item, `missing featured server ${id}`)
  return item
}

test('curated catalog invariants: valid unique ids, identity keys, transports, links, and locales', () => {
  const ids = new Set<string>()
  const keys = new Set<string>()
  const categories = new Set<string>(FEATURED_MCP_CATEGORIES)
  assert.ok(FEATURED_MCP_SERVERS.length >= 15)

  for (const category of FEATURED_MCP_CATEGORIES) {
    const key = `mcp.featured.category.${category}` as SafeMarketLocaleKey
    assert.ok(zh[key].trim() !== '', `missing zh copy for ${key}`)
    assert.ok(en[key].trim() !== '', `missing en copy for ${key}`)
  }

  for (const item of FEATURED_MCP_SERVERS) {
    assert.match(item.id, SERVER_NAME_PATTERN, `illegal id ${item.id}`)
    assert.equal(ids.has(item.id), false, `duplicate id ${item.id}`)
    ids.add(item.id)

    assert.ok(categories.has(item.category), `unknown category ${item.category}`)
    assert.ok(item.title.trim() !== '')
    assert.ok(item.publisher.trim() !== '')
    assert.ok(item.descriptionZh.trim() !== '')
    assert.ok(item.descriptionEn.trim() !== '')
    assert.match(item.icon ?? '', /^https:\/\//)
    assert.match(item.homepage, /^https:\/\//)

    const identity = mcpIdentityKey(item)
    assert.notEqual(identity, '', `empty identity key for ${item.id}`)
    assert.equal(keys.has(identity), false, `duplicate identity key ${identity}`)
    keys.add(identity)

    if (item.transport === 'streamable-http') {
      assert.match(item.url ?? '', /^https:\/\//)
      assert.equal(featuredRuntimeBadge(item), 'HTTP')
      assert.equal(featuredTargetPreview(item), item.url)
    } else {
      assert.ok((item.command ?? '').trim() !== '')
      assert.equal(featuredRuntimeBadge(item), item.command)
      assert.ok(featuredTargetPreview(item).startsWith(item.command!))
    }

    for (const input of item.inputs) {
      assert.ok(input.key.trim() !== '')
      assert.ok(input.labelZh.trim() !== '')
      assert.ok(input.labelEn.trim() !== '')
    }
  }
})

test('mcpIdentityKey normalizes trailing slashes, package versions, uvx flags, and Windows cmd wrappers', () => {
  assert.equal(
    mcpIdentityKey({ transport: 'streamable-http', url: 'https://api.githubcopilot.com/mcp/' }),
    mcpIdentityKey({ transport: 'streamable-http', url: 'HTTPS://API.GITHUBCOPILOT.COM/mcp' }),
  )
  assert.equal(
    mcpIdentityKey({ transport: 'stdio', command: 'npx', args: ['-y', '@playwright/mcp@latest'] }),
    'npx @playwright/mcp',
  )
  assert.equal(
    mcpIdentityKey({ transport: 'stdio', command: 'C:\\Windows\\System32\\cmd.exe', args: ['/c', 'npx.cmd', '-y', '@playwright/mcp@0.1.0'] }),
    'npx @playwright/mcp',
  )
  assert.equal(
    mcpIdentityKey({ transport: 'stdio', command: 'uvx', args: ['-p', '3.13', 'mcp-server-fetch'] }),
    'uvx mcp-server-fetch',
  )
})

test('findInstalledFeatured matches renamed managed rows, static rows, and plugin-registered rows', () => {
  const rows: McpRow[] = [
    {
      name: 'my-browser',
      source: 'user',
      entry: { transport: 'stdio', command: 'npx', args: ['-y', '@playwright/mcp@0.2.0'], enabled: true },
      plaintext: [],
      refs: [],
    },
    {
      name: 'deepwiki',
      source: 'registered',
      plaintext: [],
      refs: [],
    },
    {
      name: 'exa',
      source: 'retained',
      plaintext: [],
      refs: [],
    },
  ]
  const unmanaged: McpUnmanagedServer[] = [
    {
      entryId: 'static-ctx7',
      loaderId: 'include:static-ctx7',
      serverName: 'ctx7-local',
      transport: 'streamable-http',
      command: '',
      args: [],
      envKeys: [],
      url: 'https://mcp.context7.com/mcp/',
      headerKeys: [],
      enabled: true,
      phase: 'active',
      plaintextSecrets: [],
      adoptBlocker: '',
    },
  ]

  assert.deepEqual(findInstalledFeatured(byId('playwright'), rows, unmanaged), { name: 'my-browser', source: 'managed' })
  assert.deepEqual(findInstalledFeatured(byId('context7'), rows, unmanaged), { name: 'ctx7-local', source: 'static' })
  assert.deepEqual(findInstalledFeatured(byId('deepwiki'), rows, unmanaged), { name: 'deepwiki', source: 'managed' })
  assert.equal(findInstalledFeatured(byId('exa'), rows, unmanaged), null)
})

test('pickAvailableServerName avoids collisions and enforces 32-character limit', () => {
  assert.equal(pickAvailableServerName('context7', new Set()), 'context7')
  assert.equal(pickAvailableServerName('context7', new Set(['context7'])), 'context7-2')
  assert.equal(pickAvailableServerName('context7', new Set(['context7', 'context7-2'])), 'context7-3')

  const longId = 'a'.repeat(32)
  const picked = pickAvailableServerName(longId, new Set([longId]))
  assert.equal(picked.length, 32)
  assert.match(picked, SERVER_NAME_PATTERN)
  assert.ok(picked.endsWith('-2'))
})

test('validateFeaturedValues enforces server name rules and required inputs', () => {
  const github = byId('github')
  const ctx7 = byId('context7')
  assert.equal(hasRequiredInputs(github), true)
  assert.equal(hasSecretInputs(github), true)
  assert.equal(hasRequiredInputs(ctx7), false)
  assert.equal(hasSecretInputs(ctx7), true)

  assert.deepEqual(validateFeaturedValues(github, '', {}, new Set()), [
    { field: 'name', code: 'required' },
    { field: 'input', key: 'Authorization', code: 'required' },
  ])
  assert.deepEqual(validateFeaturedValues(github, 'bad name', { Authorization: 'tok' }, new Set()), [
    { field: 'name', code: 'pattern' },
  ])
  assert.deepEqual(validateFeaturedValues(github, 'github', { Authorization: 'tok' }, new Set(['github'])), [
    { field: 'name', code: 'taken' },
  ])
  assert.deepEqual(validateFeaturedValues(github, 'github', { Authorization: '${credential:bad-ref}' }, new Set()), [
    { field: 'input', key: 'Authorization', code: 'malformed' },
  ])
  assert.deepEqual(validateFeaturedValues(byId('filesystem'), 'filesystem', { dir: '/tmp/${env:HOME}' }, new Set()), [
    { field: 'input', key: 'dir', code: 'malformed' },
  ])
  assert.deepEqual(validateFeaturedValues(ctx7, 'context7', {}, new Set()), [])
})

test('draftFromFeatured moves secret headers and env vars into credentials without leaking plaintext', () => {
  const github = byId('github')
  const githubDraft = draftFromFeatured(github, { Authorization: 'github_pat_secret1234567890' }, {
    name: 'github',
    enabled: true,
    takenRefs: new Set(['MCP_GITHUB_AUTHORIZATION']),
  })
  assert.deepEqual(validateDraft(githubDraft, new Set()), [])
  assert.deepEqual(draftPlaintext(githubDraft), [])
  assert.deepEqual(githubDraft.headers, [
    { key: 'Authorization', value: 'Bearer ${credential:MCP_GITHUB_AUTHORIZATION_2}' },
  ])
  assert.deepEqual(pendingToStore(githubDraft), [
    { ref: 'MCP_GITHUB_AUTHORIZATION_2', value: 'github_pat_secret1234567890' },
  ])
  const serialized = JSON.stringify(entryFromDraft(githubDraft))
  assert.equal(serialized.includes('github_pat_secret1234567890'), false)

  // Already-templated credential references are kept verbatim with no duplicate pending secret.
  const templated = draftFromFeatured(github, { Authorization: '${credential:MY_GH_PAT}' }, {
    name: 'github',
    enabled: false,
  })
  assert.deepEqual(templated.headers, [{ key: 'Authorization', value: 'Bearer ${credential:MY_GH_PAT}' }])
  assert.deepEqual(pendingToStore(templated), [])
  assert.deepEqual(validateDraft(templated, new Set()), [])

  // Pasting a repeated `Bearer ` prefix (plaintext or template) never produces `Bearer Bearer …`.
  const repeatedPlain = draftFromFeatured(github, { Authorization: 'Bearer github_pat_secret9999999999' }, {
    name: 'github',
    enabled: true,
  })
  assert.deepEqual(repeatedPlain.headers, [{ key: 'Authorization', value: 'Bearer ${credential:MCP_GITHUB_AUTHORIZATION}' }])
  assert.deepEqual(pendingToStore(repeatedPlain), [{ ref: 'MCP_GITHUB_AUTHORIZATION', value: 'github_pat_secret9999999999' }])

  const repeatedTemplate = draftFromFeatured(github, { Authorization: 'Bearer ${credential:MY_GH_PAT}' }, {
    name: 'github',
    enabled: true,
  })
  assert.deepEqual(repeatedTemplate.headers, [{ key: 'Authorization', value: 'Bearer ${credential:MY_GH_PAT}' }])
  assert.deepEqual(pendingToStore(repeatedTemplate), [])

  // Mixed plaintext + credential template in a secret input is still routed through pending storage.
  const mixedSecret = draftFromFeatured(github, { Authorization: 'ghp_leak ${credential:MY_GH_PAT}' }, {
    name: 'github',
    enabled: true,
  })
  assert.equal(JSON.stringify(entryFromDraft(mixedSecret)).includes('ghp_leak'), false)
  assert.deepEqual(pendingToStore(mixedSecret), [
    { ref: 'MCP_GITHUB_AUTHORIZATION', value: 'ghp_leak ${credential:MY_GH_PAT}' },
  ])

  // Secret env var + arg input.
  const braveDraft = draftFromFeatured(byId('brave-search'), { BRAVE_API_KEY: 'BSA_secret_token_value' }, {
    name: 'brave-search',
    enabled: true,
  })
  assert.deepEqual(validateDraft(braveDraft, new Set()), [])
  assert.deepEqual(draftPlaintext(braveDraft), [])
  assert.deepEqual(braveDraft.env, [{ key: 'BRAVE_API_KEY', value: '${credential:MCP_BRAVE_SEARCH_BRAVE_API_KEY}' }])
  assert.deepEqual(pendingToStore(braveDraft), [{ ref: 'MCP_BRAVE_SEARCH_BRAVE_API_KEY', value: 'BSA_secret_token_value' }])

  const fsDraft = draftFromFeatured(byId('filesystem'), { dir: '/Users/dev/code' }, {
    name: 'filesystem',
    enabled: true,
  })
  assert.deepEqual(validateDraft(fsDraft, new Set()), [])
  assert.deepEqual(fsDraft.args, ['-y', '@modelcontextprotocol/server-filesystem', '/Users/dev/code'])

  // Flag-prefixed args (`-a` plain + `-s` secret templated as credential).
  const larkDraft = draftFromFeatured(byId('lark-mcp'), {
    APP_ID: 'cli_a1b2c3d4',
    APP_SECRET: 'super_secret_feishu_app_secret_1234',
  }, { name: 'lark-mcp', enabled: true })
  assert.deepEqual(validateDraft(larkDraft, new Set()), [])
  assert.deepEqual(draftPlaintext(larkDraft), [])
  assert.deepEqual(larkDraft.args, [
    '-y',
    '@larksuiteoapi/lark-mcp',
    'mcp',
    '-a',
    'cli_a1b2c3d4',
    '-s',
    '${credential:MCP_LARK_MCP_APP_SECRET}',
  ])
  assert.deepEqual(pendingToStore(larkDraft), [
    { ref: 'MCP_LARK_MCP_APP_SECRET', value: 'super_secret_feishu_app_secret_1234' },
  ])
})

test('the Draw.io featured draft passes its cold-start timeout to the Settings entry', () => {
  const draft = draftFromFeatured(byId('next-ai-drawio'), {}, { name: 'next-ai-drawio', enabled: true })
  assert.deepEqual(validateDraft(draft, new Set()), [])
  assert.equal(entryFromDraft(draft).startupTimeoutMs, 120_000)
})

test('matchesFeaturedMcp filters by category and Chinese/English/package queries', () => {
  const playwright = byId('playwright')
  assert.equal(matchesFeaturedMcp(playwright, '', 'all'), true)
  assert.equal(matchesFeaturedMcp(playwright, '', 'browser'), true)
  assert.equal(matchesFeaturedMcp(playwright, '', 'docs'), false)
  assert.equal(matchesFeaturedMcp(playwright, '浏览器', 'all'), true)
  assert.equal(matchesFeaturedMcp(playwright, '@playwright/mcp', 'all'), true)
  assert.equal(matchesFeaturedMcp(playwright, 'accessibility', 'browser'), true)
  assert.equal(matchesFeaturedMcp(playwright, 'nonexistent-xyz', 'all'), false)
  assert.equal(matchesFeaturedMcp(byId('amap-maps'), '高德', 'life'), true)
  assert.equal(matchesFeaturedMcp(byId('12306'), '火车票', 'life'), true)
  assert.equal(matchesFeaturedMcp(byId('lark-mcp'), '飞书', 'office'), true)
  assert.equal(matchesFeaturedMcp(byId('antv-chart'), '图表', 'visual'), true)
})
