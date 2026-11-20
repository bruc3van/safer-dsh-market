/**
 * Regression tests for moving static MCP rows under the manager, the
 * credential clear verb, the Settings document opener, and the editor's
 * reconnect and close-timeout fields.
 *
 * - the Host plan: which secrets become credentials, which expressions carry
 *   over, and which rows cannot be adopted at all;
 * - the Host verb: secrets are stored (or reused) before the entry is written
 *   switched off, and nothing is written when the name is already managed;
 * - the controller: the static row is switched off through the plugin
 *   manager before the managed entry is switched on.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Context } from '@deepseek-ai/cordis'
import { mcpHostContextSchema } from '../src/contract.ts'
import { adoptMcp, adoptionPlan, unmanagedOf, type McpLoaderEntry } from '../src/mcp.ts'
import { draftFromEntry, emptyDraft, entryFromDraft, validateDraft } from '../src/client/mcpModel.ts'
import {
  createMcpController, staticKey, type McpHosts, type McpPluginChange,
} from '../src/client/mcpController.ts'

const CLIENT = '@deepseek-ai/dsh-mcp-client'
const MANAGER = '@deepseek-ai/dsh-mcp-manager'

function entry(id: string, name: string, config?: unknown): McpLoaderEntry {
  return { id: `include:${id}`, disabled: false, options: { id, name, config }, fiber: { state: 2 } }
}

const context7Config = {
  serverName: 'context7', transport: 'stdio', command: 'cmd',
  args: ['/c', 'npx', '-y', '@upstash/context7-mcp', '--api-key', 'ctx7sk-00000000-0000-4000-8000-000000000000'],
  env: { CTX7_TOKEN: 'secret-value', LOG: 'info', HOME_TOKEN: { __jsExpr: 'process.env.HOME_TOKEN' } },
  expandTemplates: true,
  failOnStartupError: true,
  reconnect: { maxAttempts: 3 },
}

// ——— the Host plan ———

test('a stdio row plans its secrets as credentials and carries the rest verbatim', () => {
  const plan = adoptionPlan(context7Config)
  assert.ok(!('blocker' in plan))
  assert.equal(plan.name, 'context7')
  assert.deepEqual(plan.secrets, [
    { label: '--api-key', value: 'ctx7sk-00000000-0000-4000-8000-000000000000' },
    { label: 'CTX7_TOKEN', value: 'secret-value' },
  ])
  assert.deepEqual(plan.dropped, ['failOnStartupError'])
  assert.deepEqual(plan.build(['CTX7_KEY', 'CTX7_ENV']), {
    transport: 'stdio',
    command: 'cmd',
    args: ['/c', 'npx', '-y', '@upstash/context7-mcp', '--api-key', '${credential:CTX7_KEY}'],
    env: { CTX7_TOKEN: '${credential:CTX7_ENV}', LOG: 'info', HOME_TOKEN: '${credential:HOME_TOKEN}' },
    reconnect: { maxAttempts: 3 },
  })
})

test('an http row keeps its header scheme and templates each secret query value without breaking URL encoding', () => {
  const plan = adoptionPlan({
    serverName: 'web', transport: 'streamable-http',
    url: 'https://x.dev/mcp?api_key=a%26b%3Dc%20d&v=1',
    headers: { Authorization: 'Bearer abcdefghijklmnop', Accept: 'json' },
  })
  assert.ok(!('blocker' in plan))
  assert.deepEqual(plan.secrets, [{ label: 'api_key', value: 'a%26b%3Dc%20d' }, { label: 'Authorization', value: 'abcdefghijklmnop' }])
  assert.deepEqual(plan.build(['A', 'B']), {
    transport: 'streamable-http',
    url: 'https://x.dev/mcp?api_key=${credential:A}&v=1',
    headers: { Authorization: 'Bearer ${credential:B}', Accept: 'json' },
  })
})

test('an expression other than process.env.NAME, a container expression, a bad name or an unknown transport blocks adoption', () => {
  assert.deepEqual(adoptionPlan({ ...context7Config, env: { X: { __jsExpr: '`a${process.env.X}`' } } }), { blocker: 'expression' })
  assert.deepEqual(adoptionPlan({ ...context7Config, env: { __jsExpr: 'process.env' } }), { blocker: 'expression' })
  assert.deepEqual(adoptionPlan({ ...context7Config, args: { __jsExpr: '["a"]' } }), { blocker: 'expression' })
  assert.deepEqual(adoptionPlan({ serverName: 'web', transport: 'streamable-http', url: 'https://x.dev', headers: { __jsExpr: '({})' } }), { blocker: 'expression' })
  assert.deepEqual(adoptionPlan({ ...context7Config, startupTimeoutMs: { __jsExpr: '1000 * 5' } }), { blocker: 'expression' })
  assert.deepEqual(adoptionPlan({ ...context7Config, serverName: 'has space' }), { blocker: 'name' })
  assert.deepEqual(adoptionPlan({ ...context7Config, transport: 'sse' }), { blocker: 'transport' })
  assert.deepEqual(unmanagedOf(entry('expr-env', CLIENT, { ...context7Config, env: { __jsExpr: 'process.env' } })).envKeys, [])
})

test('the scan reports each row\'s blocker on the wire, and still never its secrets', () => {
  const view = unmanagedOf(entry('static-mcp-context7', CLIENT, context7Config))
  assert.equal(view.adoptBlocker, '')
  assert.equal(unmanagedOf(entry('bad', CLIENT, { ...context7Config, transport: 'sse' })).adoptBlocker, 'transport')
  assert.ok(!JSON.stringify(view).includes('ctx7sk-'))
  mcpHostContextSchema.parse({ managerEntry: null, managerActive: false, unmanaged: [view], tools: [], toolsError: '' })
})

// ——— the Host verb ———

function hostCtx(options: {
  managed?: string[]
  stored?: Record<string, string>
  writable?: boolean
  settingsServers?: Record<string, unknown>
  revision?: number
} = {}) {
  const store = new Map(Object.entries(options.stored ?? {}))
  const calls: { method: string; args: unknown[] }[] = []
  const services: Record<string, unknown> = {
    mcpManager: { list: () => (options.managed ?? []).map(name => ({ name })) },
    credentials: {
      describe: async (ref: string) => ({ configured: store.has(ref) }),
      resolve: async (ref: string) => store.has(ref) ? { value: store.get(ref)! } : undefined,
      set: async (ref: string, value: string) => { calls.push({ method: 'set', args: [ref] }); store.set(ref, value) },
    },
  }
  const ctx = {
    get: (name: string) => services[name],
    settings: {
      writable: options.writable ?? true,
      describe: () => [{ ns: 'mcp', revision: options.revision ?? 4, value: { servers: options.settingsServers ?? {} } }],
      mutate: async (ns: string, ops: unknown, expectedRevision?: number) => {
        calls.push({ method: 'mutate', args: [ns, ops, expectedRevision] })
      },
    },
  } as unknown as Context
  return { ctx, calls, store }
}

const entries = [entry('mcp', MANAGER), entry('static-mcp-context7', CLIENT, context7Config)]

test('adoption stores secrets first, reuses an equal one, skips a different one, then writes the entry off', async () => {
  const { ctx, calls, store } = hostCtx({
    stored: { MCP_CONTEXT7_API_KEY: 'someone-else', MCP_CONTEXT7_CTX7_TOKEN: 'secret-value' },
  })
  const result = await adoptMcp(ctx, entries, 'include:static-mcp-context7')
  assert.deepEqual(result, {
    name: 'context7', stored: ['MCP_CONTEXT7_API_KEY_2'], reused: ['MCP_CONTEXT7_CTX7_TOKEN'], dropped: ['failOnStartupError'],
  })
  assert.equal(store.get('MCP_CONTEXT7_API_KEY'), 'someone-else', 'an unrelated stored value is never overwritten')
  assert.equal(store.get('MCP_CONTEXT7_API_KEY_2'), 'ctx7sk-00000000-0000-4000-8000-000000000000')
  assert.deepEqual(calls.map(call => call.method), ['set', 'mutate'])
  const [ns, ops, expectedRevision] = calls[1]!.args as [string, { op: string; path: string[]; value: Record<string, unknown> }[], number]
  assert.equal(ns, 'mcp')
  assert.equal(expectedRevision, 4)
  assert.deepEqual(ops[0]!.path, ['servers', 'context7'])
  assert.equal(ops[0]!.value.enabled, false)
  assert.ok(!JSON.stringify(ops).includes('ctx7sk-'), 'the entry names the credential, never the value')
})

test('adoption refuses read-only settings and names already present in manager or Settings before storing anything', async () => {
  const readonlyHost = hostCtx({ writable: false })
  await assert.rejects(adoptMcp(readonlyHost.ctx, entries, 'include:static-mcp-context7'), /settings-readonly/)
  assert.deepEqual(readonlyHost.calls, [])

  const settingsClash = hostCtx({ settingsServers: { context7: { enabled: false } } })
  await assert.rejects(adoptMcp(settingsClash.ctx, entries, 'include:static-mcp-context7'), /name-taken/)
  assert.deepEqual(settingsClash.calls, [])

  const { ctx, calls } = hostCtx({ managed: ['context7'] })
  await assert.rejects(adoptMcp(ctx, entries, 'include:static-mcp-context7'), /name-taken/)
  await assert.rejects(adoptMcp(ctx, entries, 'include:nope'), /not-found/)
  assert.deepEqual(calls, [])
})

// ——— the controller ———

const emptySettings = { ns: 'mcp', revision: 1, value: { servers: {} } }

function adoptHosts(change: McpPluginChange, enabled = true) {
  const calls: { method: string; args: unknown[] }[] = []
  const record = (method: string, ...args: unknown[]) => { calls.push({ method, args }) }
  const server = { ...unmanagedOf(entry('static-mcp-context7', CLIENT, context7Config)), enabled }
  const hosts: McpHosts = {
    manager: () => ({
      watch: () => ({ async *[Symbol.asyncIterator]() { /* no frames */ } }),
      restart: async () => ({ ok: true, value: undefined }),
      probe: async () => ({ ok: false, error: { code: 'x', message: 'x' } }),
    }),
    settings: () => ({
      describe: async () => ({ ok: true, value: { writable: true, namespaces: [emptySettings] } }),
      mutate: async (ns, ops, revision) => { record('mutate', ops, revision); return { ok: true, value: { ...emptySettings, revision: 2 } } },
      openSettingsDocument: async () => { record('open'); return { ok: true, value: { opened: true } } },
    }),
    credentials: () => ({
      describe: async () => ({ ok: true, value: {} }),
      set: async () => ({ ok: true, value: undefined }),
      unset: async (ref) => { record('unset', ref); return { ok: true, value: undefined } },
    }),
    plugins: () => ({
      listPlugins: async () => ({ ok: true, value: [{ entryId: server.loaderId, moduleName: CLIENT, enabled }] }),
      setPluginEnabled: async (id, value) => { record('setPluginEnabled', id, value); return { ok: true, value: change } },
    }),
    inspect: async () => ({ managerEntry: 'mcp', managerActive: true, unmanaged: [server], tools: [], toolsError: '' }),
    adopt: async (loaderId) => {
      record('adopt', loaderId)
      return { name: 'context7', stored: ['MCP_CONTEXT7_API_KEY'], reused: [], dropped: [] }
    },
  }
  return { hosts, calls, loaderId: server.loaderId }
}

const settle = () => new Promise<void>((resolve) => { setTimeout(resolve, 20) })

test('adopting a running row writes it, switches the static row off, then switches the entry on', async () => {
  const { hosts, calls, loaderId } = adoptHosts({ changed: true, application: 'applied' })
  const controller = createMcpController(hosts, { debounceMs: 1 })
  const detach = controller.attach()
  await settle()
  assert.ok(controller.supports('adopt'))
  await controller.adopt(loaderId)
  assert.deepEqual(calls.map(call => call.method), ['adopt', 'setPluginEnabled', 'mutate'])
  assert.deepEqual(calls[1]!.args, [loaderId, false])
  assert.deepEqual(calls[2]!.args[0], [{ op: 'set', path: ['servers', 'context7', 'enabled'], value: true }])
  assert.equal(controller.getSnapshot().adopted.context7?.state, 'enabled')
  assert.equal(controller.getSnapshot().errors[staticKey(loaderId)], undefined)
  await controller.remove('context7')
  assert.equal(controller.getSnapshot().adopted.context7, undefined, 'removing the managed row clears its adoption note')
  detach()
})

test('when the static row stops only after a restart, the managed entry stays off', async () => {
  const { hosts, calls, loaderId } = adoptHosts({ changed: true, application: 'restart-required' })
  const controller = createMcpController(hosts, { debounceMs: 1 })
  const detach = controller.attach()
  await settle()
  await controller.adopt(loaderId)
  assert.ok(!calls.some(call => call.method === 'mutate'))
  assert.equal(controller.getSnapshot().adopted.context7?.state, 'restart')
  detach()
})

test('a stopped row is adopted without touching the plugin manager', async () => {
  const { hosts, calls, loaderId } = adoptHosts({ changed: true, application: 'applied' }, false)
  const controller = createMcpController(hosts, { debounceMs: 1 })
  const detach = controller.attach()
  await settle()
  await controller.adopt(loaderId)
  assert.deepEqual(calls.map(call => call.method), ['adopt'])
  assert.equal(controller.getSnapshot().adopted.context7?.state, 'kept-off')
  detach()
})

test('clearing a credential and opening the Settings document are the official verbs', async () => {
  const { hosts, calls } = adoptHosts({ changed: true, application: 'applied' })
  const controller = createMcpController(hosts, { debounceMs: 1 })
  assert.ok(controller.supports('unsetCredential') && controller.supports('openDocument'))
  assert.equal(await controller.clearCredential('A_TOKEN'), '')
  assert.equal(await controller.openSettingsDocument(), '')
  assert.deepEqual(calls.map(call => call.method), ['unset', 'open'])

  const noDoc = createMcpController({
    ...hosts,
    settings: () => ({
      ...hosts.settings()!,
      describe: async () => ({ ok: true, value: { writable: true, hasDocument: false, namespaces: [emptySettings] } }),
    }),
  }, { debounceMs: 1 })
  const detachNoDoc = noDoc.attach()
  await settle()
  assert.equal(noDoc.getSnapshot().hasSettingsDocument, false)
  detachNoDoc()

  const bare = createMcpController({ ...hosts, settings: () => undefined, credentials: () => undefined, adopt: undefined })
  assert.ok(!bare.supports('adopt') && !bare.supports('unsetCredential') && !bare.supports('openDocument'))
})

// ——— reconnect and close-timeout fields ———

test('resolved defaults read as empty, and only changed reconnect fields are written', () => {
  const draft = draftFromEntry('s', {
    transport: 'stdio', command: 'node', enabled: true, closeTimeoutMs: 5000,
    reconnect: { enabled: true, initialDelayMs: 500, maxDelayMs: 30_000, maxAttempts: 3 },
  })
  assert.deepEqual([draft.closeTimeoutMs, draft.reconnectEnabled, draft.initialDelayMs, draft.maxDelayMs, draft.maxAttempts], ['', true, '', '', '3'])
  assert.deepEqual(entryFromDraft(draft).reconnect, { maxAttempts: 3 })
  const off = entryFromDraft({ ...draft, reconnectEnabled: false, maxAttempts: '', closeTimeoutMs: '8000' })
  assert.deepEqual(off.reconnect, { enabled: false })
  assert.equal(off.closeTimeoutMs, 8000)
  assert.equal(entryFromDraft({ ...draft, maxAttempts: '' }).reconnect, undefined)
})

test('reconnect numbers are positive integers and disabled reconnect ignores stale invalid inputs', () => {
  const base = { ...emptyDraft(), name: 's', command: 'node' }
  assert.deepEqual(validateDraft({ ...base, maxAttempts: '0', closeTimeoutMs: 'x' }, new Set()).map(error => error.field), ['closeTimeoutMs', 'maxAttempts'])
  assert.deepEqual(validateDraft({ ...base, initialDelayMs: '60000' }, new Set()), [{ field: 'maxDelayMs', code: 'order' }])
  assert.deepEqual(validateDraft({ ...base, initialDelayMs: '0', maxAttempts: 'abc', reconnectEnabled: false }, new Set()), [])
  assert.deepEqual(entryFromDraft({ ...base, initialDelayMs: '0', maxAttempts: 'abc', reconnectEnabled: false }).reconnect, { enabled: false })
})
