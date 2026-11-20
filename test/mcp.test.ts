/**
 * Regression tests for the MCP page.
 *
 * Three layers, each pinned where it decides something:
 * - the shared shapes: what counts as a plaintext secret and how it is masked
 *   (the Host scan relies on this before anything crosses the wire);
 * - the Host scan: which Loader rows are the manager and which are static
 *   servers, and that a static row's secrets never leave the Host;
 * - the client model and controller: how the official reads fold into cards,
 *   and that every write is the path-addressed, revision-checked Settings
 *   edit the manager validates — with secrets stored before the entry names them.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Context } from '@deepseek-ai/cordis'
import { mcpHostContextSchema, type McpHostContext } from '../src/contract.ts'
import { inspectMcpContext, groupTools, unmanagedOf, type McpLoaderEntry } from '../src/mcp.ts'
import {
  credentialRefsIn, isSecretField, isSecretUrl, looksSecretValue, malformedTemplate, maskUrl, secretArgIndexes,
} from '../src/mcpShapes.ts'
import {
  buildRows, canProbe, canRestart, commandRisks, convertToCredential, draftFromEntry, emptyDraft, entryFromDraft,
  pendingToStore, saveOps, splitCommandLine, statusKind, suggestRef, targetOf, validateDraft,
  type McpServerView, type McpSettingsView,
} from '../src/client/mcpModel.ts'
import {
  createMcpController, staticKey, type McpHosts, type McpManagerFace, type McpPluginChange, type McpPluginRow,
} from '../src/client/mcpController.ts'

// ——— shapes ———

test('well-known and opaque tokens read as secrets; paths, packages and flags do not', () => {
  assert.ok(looksSecretValue('ctx7sk-00000000-0000-4000-8000-000000000000'))
  assert.ok(looksSecretValue('ghp_abcdefghijklmnopqrstuvwxyz0123456789'))
  assert.ok(looksSecretValue('sk-proj-AbCdEf0123456789xyz'))
  assert.ok(looksSecretValue('Bearer abcdef0123456789'))
  for (const value of ['@upstash/context7-mcp', '-y', 'C:\\Users\\me\\node_modules\\@playwright\\mcp\\cli.js',
    'https://example.com/mcp', '${credential:GITHUB_TOKEN}', 'mcp', '']) {
    assert.equal(looksSecretValue(value), false, value)
  }
})

test('an argument after a secret flag, or in --flag=value form, is a secret position', () => {
  assert.deepEqual(secretArgIndexes(['/c', 'npx', '-y', '@upstash/context7-mcp', '--api-key', 'abc123']), [5])
  assert.deepEqual(secretArgIndexes(['--token=hunter2hunter2', '--port', '3000']), [0])
  assert.deepEqual(secretArgIndexes(['--api-key', '${credential:CTX7}']), [])
})

test('named fields and URL queries follow the same rule, and templates never count', () => {
  assert.ok(isSecretField('GITHUB_TOKEN', 'abc'))
  assert.equal(isSecretField('GITHUB_TOKEN', '${credential:GITHUB_TOKEN}'), false)
  assert.equal(isSecretField('DEBUG', 'true'), false)
  assert.equal(isSecretField('API_KEY_ENABLED', 'true'), false)
  assert.ok(isSecretUrl('https://x.dev/mcp?api_key=abc'))
  assert.equal(isSecretUrl('https://x.dev/mcp?api_key=${credential:X}'), false)
  assert.equal(maskUrl('https://x.dev/mcp?api_key=abc&v=1'), 'https://x.dev/mcp?api_key=••••••&v=1')
})

test('template grammar matches the manager: one well-formed token or a named failure', () => {
  assert.deepEqual(credentialRefsIn('Bearer ${credential:A} ${credential:B_2}'), ['A', 'B_2'])
  assert.equal(malformedTemplate('${credential:A}'), undefined)
  assert.equal(malformedTemplate('${env:HOME}'), '${env:HOME}')
  assert.equal(malformedTemplate('${credential:1BAD}'), '${credential:1BAD}')
})

// ——— Host scan ———

const PHASE_ACTIVE = 2

function entry(id: string, name: string, config?: unknown, extra: Partial<McpLoaderEntry> = {}): McpLoaderEntry {
  return { id: `include:${id}`, disabled: false, options: { id, name, config }, fiber: { state: PHASE_ACTIVE }, ...extra }
}

const context7 = entry('static-mcp-context7', '@deepseek-ai/dsh-mcp-client', {
  serverName: 'context7', transport: 'stdio', command: 'cmd',
  args: ['/c', 'npx', '-y', '@upstash/context7-mcp', '--api-key', 'ctx7sk-00000000-0000-4000-8000-000000000000'],
  env: { CTX7_TOKEN: 'secret-value', LOG: 'info' },
})

test('a static row leaves the Host masked: secret args replaced, env values dropped', () => {
  const view = unmanagedOf(context7)
  assert.equal(view.serverName, 'context7')
  assert.equal(view.loaderId, 'include:static-mcp-context7', 'the plugin manager addresses rows by the Loader identity')
  assert.deepEqual(view.args, ['/c', 'npx', '-y', '@upstash/context7-mcp', '--api-key', '••••••'])
  assert.deepEqual(view.envKeys, ['CTX7_TOKEN', 'LOG'])
  assert.deepEqual(view.plaintextSecrets, ['args[5]', 'env.CTX7_TOKEN'])
  assert.ok(!JSON.stringify(view).includes('ctx7sk-'))
  assert.ok(!JSON.stringify(view).includes('secret-value'))
  assert.equal(view.phase, 'active')
})

test('the scan names the manager entry, lists static rows and groups live tools', () => {
  const ctx = {
    get: (name: string) => name === 'tools'
      ? { definitions: () => [
          { name: 'mcp__context7__resolve-library-id', description: '  Resolve\n a library  ' },
          { name: 'mcp__my__srv__tool', description: 'nested name' },
          { name: 'read_file', description: 'not mcp' },
        ] }
      : name === 'mcpManager' ? { list: () => [{ name: 'my__srv' }] } : undefined,
  } as unknown as Context
  const result: McpHostContext = inspectMcpContext(ctx, [
    entry('mcp-manager', '@deepseek-ai/dsh-mcp-manager', { servers: {} }),
    context7,
    entry('other', 'dsh-market-pro'),
  ])
  assert.equal(result.managerEntry, 'mcp-manager')
  assert.equal(result.managerActive, true)
  assert.deepEqual(result.unmanaged.map(server => server.serverName), ['context7'])
  assert.deepEqual(result.tools.map(group => [group.server, group.tools.length]), [['context7', 1], ['my__srv', 1]])
  assert.equal(result.tools[0]!.tools[0]!.description, 'Resolve a library')
  assert.equal(result.toolsError, '')
  assert.doesNotThrow(() => mcpHostContextSchema.parse(result))
})

test('a runtime without the manager or the tool registry still answers', () => {
  const result = inspectMcpContext({ get: () => { throw new Error('no such service') } } as unknown as Context, [context7])
  assert.equal(result.managerEntry, null)
  assert.equal(result.unmanaged.length, 1)
  assert.notEqual(result.toolsError, '')
  assert.doesNotThrow(() => mcpHostContextSchema.parse(result))
})

test('an unknown server namespace splits at the first separator', () => {
  assert.deepEqual(groupTools([{ name: 'mcp__web__search' }], []).map(group => group.server), ['web'])
})

// ——— model ———

const settingsView: McpSettingsView = {
  ns: 'mcp-manager',
  revision: 7,
  value: {
    servers: {
      mine: { transport: 'stdio', command: 'npx', args: ['-y', 'pkg', '--token', 'abcdefabcdef'], env: {}, enabled: true },
      base: { transport: 'streamable-http', url: 'https://x.dev/mcp', headers: { Authorization: 'Bearer ${credential:X_TOKEN}' }, enabled: true },
      tuned: { transport: 'stdio', command: 'node', args: [], enabled: false },
    },
  },
  base: { servers: { base: {}, tuned: {} } },
  user: { servers: { mine: {}, tuned: { enabled: false } } },
}

const views: McpServerView[] = [
  { name: 'mine', configured: true, status: { state: 'connected', toolCount: 3, connectedAt: 1 } },
  { name: 'base', configured: true, status: { state: 'waiting-credentials', lastError: 'credential "X_TOKEN" is not configured' } },
  { name: 'tuned', configured: true, status: { state: 'disabled' } },
  { name: 'plugin', configured: true, status: { state: 'connecting', attempt: 0 } },
  { name: 'gone', configured: false, status: { state: 'failed', reason: 'cleanup', result: { closeConfirmed: false } } },
]

test('rows carry their source, so each card offers only the verbs Settings allows', () => {
  const rows = buildRows(views, settingsView)
  assert.deepEqual(rows.map(row => [row.name, row.source]), [
    ['mine', 'user'], ['base', 'inherited'], ['tuned', 'overridden'], ['plugin', 'registered'], ['gone', 'retained'],
  ])
  const [mine, base, tuned, plugin, gone] = rows
  assert.deepEqual(mine!.plaintext, ['args[3]'])
  assert.deepEqual(base!.refs, ['X_TOKEN'])
  assert.equal(statusKind(base!.status), 'issue')
  assert.equal(statusKind(gone!.status), 'locked')
  assert.equal(canRestart(tuned!), false, 'a disabled entry is enabled, not restarted')
  assert.equal(canProbe(tuned!), true, 'a disabled entry may be probed first')
  assert.equal(canProbe(gone!), false)
  assert.equal(canRestart(plugin!), true)
  assert.equal(targetOf(mine!.entry), 'npx -y pkg --token ••••••')
})

test('validation mirrors the manager: name grammar, collisions, per-transport fields, templates, timers', () => {
  const draft = { ...emptyDraft(), name: 'bad name', command: '' }
  const codes = (errors: ReturnType<typeof validateDraft>) => errors.map(error => `${error.field}:${error.code}`)
  assert.deepEqual(codes(validateDraft(draft, new Set())), ['name:pattern', 'command:required'])
  assert.deepEqual(codes(validateDraft({ ...draft, name: 'context7', command: 'x' }, new Set(['context7']))), ['name:taken'])
  assert.deepEqual(codes(validateDraft({ ...emptyDraft(), name: 'h', transport: 'streamable-http', url: 'ftp://x' }, new Set())), ['url:scheme'])
  assert.deepEqual(codes(validateDraft({
    ...emptyDraft(), name: 'e', command: 'x', env: [{ key: 'A', value: '${env:A}' }, { key: 'A', value: '' }], startupTimeoutMs: '1.5',
  }, new Set())), ['env:duplicate', 'template:malformed', 'startupTimeoutMs:number'])
})

test('a draft writes only its transport\'s fields and carries the ones it does not render', () => {
  const draft = draftFromEntry('base', serversOfValue('base'))
  assert.equal(draft.transport, 'streamable-http')
  const entry = entryFromDraft({ ...draft, command: 'leftover', extra: { reconnect: { maxAttempts: 3 } } })
  assert.deepEqual(entry, {
    reconnect: { maxAttempts: 3 },
    transport: 'streamable-http', url: 'https://x.dev/mcp', headers: { Authorization: 'Bearer ${credential:X_TOKEN}' }, enabled: true,
  })
})

function serversOfValue(name: string) {
  return (settingsView.value as { servers: Record<string, never> }).servers[name]!
}

test('a rename drops the old key in the same write', () => {
  const draft = { ...draftFromEntry('mine', serversOfValue('mine')), name: 'renamed' }
  const ops = saveOps(draft, 'mine')
  assert.deepEqual(ops[0], { op: 'unset', path: ['servers', 'mine'] })
  assert.deepEqual(ops[1]!.path, ['servers', 'renamed'])
  assert.equal(saveOps(draft, 'renamed').length, 1)
})

test('converting a plaintext value stores it as a pending credential and leaves only the template', () => {
  let draft = { ...emptyDraft(), name: 'gh', command: 'npx', args: ['--api-key', 'abc123', '--token=xyz'],
    env: [{ key: 'GITHUB_TOKEN', value: 'ghp_1' }] }
  draft = convertToCredential(draft, 'args[1]', 'A')
  draft = convertToCredential(draft, 'args[2]', 'B')
  draft = convertToCredential(draft, 'env.GITHUB_TOKEN', 'C')
  assert.deepEqual(draft.args, ['--api-key', '${credential:A}', '--token=${credential:B}'])
  assert.deepEqual(draft.env, [{ key: 'GITHUB_TOKEN', value: '${credential:C}' }])
  assert.deepEqual(draft.pending, [{ ref: 'A', value: 'abc123' }, { ref: 'B', value: 'xyz' }, { ref: 'C', value: 'ghp_1' }])
  // The user typed over one template afterwards: that secret is no longer named and must not be stored.
  assert.deepEqual(pendingToStore({ ...draft, args: ['--api-key', 'typed', '--token=${credential:B}'] }).map(secret => secret.ref), ['B', 'C'])

  const http = convertToCredential({ ...emptyDraft(), transport: 'streamable-http', url: 'https://x/mcp?key=k%201',
    headers: [{ key: 'Authorization', value: 'Bearer tok' }] }, 'headers.Authorization', 'H')
  assert.deepEqual(http.headers, [{ key: 'Authorization', value: 'Bearer ${credential:H}' }])
  const url = convertToCredential(http, 'url', 'U')
  assert.equal(url.url, 'https://x/mcp?key=${credential:U}')
  assert.deepEqual(url.pending.at(-1), { ref: 'U', value: 'k 1' })
})

test('credential names are legal and do not collide', () => {
  assert.equal(suggestRef('context7', 'api-key'), 'MCP_CONTEXT7_API_KEY')
  assert.equal(suggestRef('7x', 'x', new Set(['MCP_7X_X'])), 'MCP_7X_X_2')
  assert.match(suggestRef('', ''), /^[A-Za-z_][A-Za-z0-9_]*$/)
})

test('pasted command lines split on quotes, and fetch/shell launchers earn a risk note', () => {
  assert.deepEqual(splitCommandLine('npx -y "@scope/pkg" --dir \'C:\\My Files\' ""'), ['npx', '-y', '@scope/pkg', '--dir', 'C:\\My Files', ''])
  assert.deepEqual(commandRisks('cmd', ['/c', 'npx', '-y', 'pkg']), ['fetch', 'shell'])
  assert.deepEqual(commandRisks('C:\\tools\\server.exe', ['--port', '1']), [])
  assert.deepEqual(commandRisks('uvx', ['mcp-server-fetch']), ['fetch'])
})

// ——— controller ———

type Call = { method: string; args: unknown[] }

function fakeHosts(options: {
  host?: Partial<McpHostContext>
  mutate?: (ns: string, ops: unknown, revision?: number) => { ok: true; value: McpSettingsView } | { ok: false; error: { code: string; message: string } }
  setCredential?: (ref: string) => { ok: true; value: void } | { ok: false; error: { code: string; message: string } }
  frames?: McpServerView[][]
} = {}) {
  const calls: Call[] = []
  const record = (method: string, ...args: unknown[]) => { calls.push({ method, args }) }
  const manager: McpManagerFace = {
    watch(signal) {
      record('watch')
      const frames = options.frames ?? [views]
      return {
        async *[Symbol.asyncIterator]() {
          for (const frame of frames) yield frame
          await new Promise<void>((resolve) => { signal?.addEventListener('abort', () => resolve()) })
        },
      }
    },
    restart: async (name) => { record('restart', name); return { ok: true, value: undefined } },
    probe: async (name) => {
      record('probe', name)
      return { ok: true, value: { ok: true, toolNames: ['a'], truncated: false, durationMs: 12, closeConfirmed: true } }
    },
  }
  const hosts: McpHosts = {
    manager: () => manager,
    settings: () => ({
      describe: async () => { record('describe'); return { ok: true, value: { writable: true, namespaces: [{ ...settingsView }] } } },
      mutate: async (ns, ops, revision) => {
        record('mutate', ns, ops, revision)
        return options.mutate?.(ns, ops, revision) ?? { ok: true, value: { ...settingsView, revision: (revision ?? 0) + 1 } }
      },
    }),
    credentials: () => ({
      describe: async (refs) => { record('credentials.describe', refs); return { ok: true, value: { X_TOKEN: { configured: false, writable: true } } } },
      set: async (ref) => { record('credentials.set', ref); return options.setCredential?.(ref) ?? { ok: true, value: undefined } },
    }),
    inspect: async () => {
      record('inspect')
      return { managerEntry: 'mcp-manager', managerActive: true, unmanaged: [], tools: [], toolsError: '', ...options.host }
    },
  }
  return { hosts, calls }
}

const settle = () => new Promise<void>((resolve) => { setTimeout(resolve, 20) })

test('attaching reads the Host, then Settings and credentials, then streams the live list', async () => {
  const { hosts, calls } = fakeHosts()
  const controller = createMcpController(hosts, { debounceMs: 1 })
  const detach = controller.attach()
  await settle()
  const snapshot = controller.getSnapshot()
  assert.equal(snapshot.mode, 'full')
  assert.deepEqual(snapshot.rows.map(row => row.source), ['user', 'inherited', 'overridden', 'registered', 'retained'])
  assert.equal(snapshot.credentials.X_TOKEN?.configured, false)
  assert.deepEqual(calls.slice(0, 3).map(call => call.method), ['inspect', 'describe', 'credentials.describe'])
  assert.ok(calls.some(call => call.method === 'watch'))
  detach()
})

test('a runtime without the manager is legacy: no stream, no Settings read', async () => {
  const { hosts, calls } = fakeHosts({ host: { managerEntry: null } })
  const controller = createMcpController(hosts, { debounceMs: 1 })
  const detach = controller.attach()
  await settle()
  assert.equal(controller.getSnapshot().mode, 'legacy')
  assert.deepEqual(calls.map(call => call.method), ['inspect'])
  detach()
})

test('enable, remove and restart are the narrow official verbs, revision-checked', async () => {
  const { hosts, calls } = fakeHosts()
  const controller = createMcpController(hosts, { debounceMs: 1 })
  const detach = controller.attach()
  await settle()
  await controller.setEnabled('tuned', true)
  await controller.remove('mine')
  await controller.restart('plugin')
  const mutations = calls.filter(call => call.method === 'mutate').map(call => call.args)
  assert.deepEqual(mutations[0], ['mcp-manager', [{ op: 'set', path: ['servers', 'tuned', 'enabled'], value: true }], 7])
  assert.deepEqual(mutations[1], ['mcp-manager', [{ op: 'unset', path: ['servers', 'mine'] }], 8], 'the next write carries the new revision')
  assert.ok(calls.some(call => call.method === 'restart' && call.args[0] === 'plugin'))
  detach()
})

test('a stale write reloads Settings and reports the conflict', async () => {
  const { hosts, calls } = fakeHosts({ mutate: () => ({ ok: false, error: { code: 'settings-conflict', message: 'stale' } }) })
  const controller = createMcpController(hosts, { debounceMs: 1 })
  const detach = controller.attach()
  await settle()
  const before = calls.filter(call => call.method === 'describe').length
  const outcome = await controller.save({ ...emptyDraft(), name: 'n', command: 'x' }, undefined)
  assert.deepEqual(outcome, { ok: false, conflict: true, message: 'settings-conflict: stale' })
  assert.equal(calls.filter(call => call.method === 'describe').length, before + 1)
  detach()
})

test('a save stores pending secrets first, and writes nothing when one store fails', async () => {
  const draft = convertToCredential({ ...emptyDraft(), name: 'gh', command: 'npx', env: [{ key: 'GITHUB_TOKEN', value: 'ghp_1' }] },
    'env.GITHUB_TOKEN', 'GH')
  const ok = fakeHosts()
  const controller = createMcpController(ok.hosts, { debounceMs: 1 })
  const detach = controller.attach()
  await settle()
  assert.deepEqual(await controller.save(draft, undefined), { ok: true })
  const order = ok.calls.map(call => call.method).filter(method => method === 'credentials.set' || method === 'mutate')
  assert.deepEqual(order, ['credentials.set', 'mutate'])
  const written = ok.calls.find(call => call.method === 'mutate')!.args[1] as { value: { env: Record<string, string> } }[]
  assert.deepEqual(written[0]!.value.env, { GITHUB_TOKEN: '${credential:GH}' })
  detach()

  const failing = fakeHosts({ setCredential: () => ({ ok: false, error: { code: 'credential/rejected', message: 'read-only' } }) })
  const second = createMcpController(failing.hosts, { debounceMs: 1 })
  const detachSecond = second.attach()
  await settle()
  const outcome = await second.save(draft, undefined)
  assert.equal(outcome.ok, false)
  assert.ok(!failing.calls.some(call => call.method === 'mutate'))
  detachSecond()
})

test('a probe result is kept per server', async () => {
  const { hosts } = fakeHosts()
  const controller = createMcpController(hosts, { debounceMs: 1 })
  const detach = controller.attach()
  await settle()
  await controller.probe('tuned')
  const probe = controller.getSnapshot().probes.tuned
  assert.equal(probe?.status, 'done')
  detach()
})

// ——— static rows through the official plugin manager ———

const staticRow = (serverName: string, loaderId: string, enabled = true) => ({
  ...unmanagedOf(entry(loaderId.replace(/^include:/, ''), '@deepseek-ai/dsh-mcp-client', { serverName, transport: 'stdio', command: 'node' })),
  enabled,
})

function pluginHosts(rows: McpPluginRow[], change: McpPluginChange, unmanaged = [staticRow('context7', 'include:static-mcp-context7')]) {
  const base = fakeHosts({ host: { unmanaged } })
  const calls = base.calls
  const hosts: McpHosts = {
    ...base.hosts,
    plugins: () => ({
      listPlugins: async () => { calls.push({ method: 'listPlugins', args: [] }); return { ok: true, value: rows } },
      setPluginEnabled: async (id, enabled) => { calls.push({ method: 'setPluginEnabled', args: [id, enabled] }); return { ok: true, value: change } },
    }),
  }
  return { hosts, calls }
}

const listed = (entryId: string, readOnlyReason?: McpPluginRow['readOnlyReason']): McpPluginRow =>
  ({ entryId, moduleName: '@deepseek-ai/dsh-mcp-client', enabled: true, ...(readOnlyReason ? { readOnlyReason } : {}) })

test('a static row is switchable exactly when the plugin manager lists it without a read-only reason', async () => {
  const { hosts } = pluginHosts(
    [listed('include:a'), listed('include:b', 'unaddressable')],
    { changed: true, application: 'applied' },
    [staticRow('a', 'include:a'), staticRow('b', 'include:b'), staticRow('c', 'include:c')],
  )
  const controller = createMcpController(hosts, { debounceMs: 1 })
  const detach = controller.attach()
  await settle()
  assert.deepEqual(controller.getSnapshot().staticToggles, {
    'include:a': { available: true },
    'include:b': { available: false, reason: 'unaddressable' },
    'include:c': { available: false, reason: 'unlisted' },
  })
  detach()
})

test('switching a static row is the official setPluginEnabled call, then a fresh Host read', async () => {
  const { hosts, calls } = pluginHosts([listed('include:static-mcp-context7')], { changed: true, application: 'applied' })
  const controller = createMcpController(hosts, { debounceMs: 1 })
  const detach = controller.attach()
  await settle()
  const inspectsBefore = calls.filter(call => call.method === 'inspect').length
  await controller.setStaticEnabled('include:static-mcp-context7', false)
  assert.deepEqual(calls.find(call => call.method === 'setPluginEnabled')?.args, ['include:static-mcp-context7', false])
  assert.equal(calls.filter(call => call.method === 'inspect').length, inspectsBefore + 1)
  assert.equal(controller.getSnapshot().errors[staticKey('include:static-mcp-context7')], undefined)
  detach()
})

test('restart-required is a notice, overridden is an error, and a name clash is refused before the call', async () => {
  const key = staticKey('include:static-mcp-context7')
  const restart = pluginHosts([listed('include:static-mcp-context7')], { changed: true, application: 'restart-required' })
  const first = createMcpController(restart.hosts, { debounceMs: 1 })
  const detachFirst = first.attach()
  await settle()
  await first.setStaticEnabled('include:static-mcp-context7', false)
  assert.equal(first.getSnapshot().notices[key], 'restart-required')
  assert.equal(first.getSnapshot().errors[key], undefined)
  detachFirst()

  const overridden = pluginHosts([listed('include:static-mcp-context7')], { changed: true, application: 'overridden' })
  const second = createMcpController(overridden.hosts, { debounceMs: 1 })
  const detachSecond = second.attach()
  await settle()
  await second.setStaticEnabled('include:static-mcp-context7', false)
  assert.equal(second.getSnapshot().errors[key], 'overridden')
  detachSecond()

  // `mine` is an enabled managed server in the fake Settings view.
  const clash = pluginHosts([listed('include:mine-static')], { changed: true, application: 'applied' },
    [staticRow('mine', 'include:mine-static', false)])
  const third = createMcpController(clash.hosts, { debounceMs: 1 })
  const detachThird = third.attach()
  await settle()
  await third.setStaticEnabled('include:mine-static', true)
  assert.equal(third.getSnapshot().errors[staticKey('include:mine-static')], 'name-conflict')
  assert.ok(!clash.calls.some(call => call.method === 'setPluginEnabled'))
  detachThird()
})

// ——— review regressions ———

test('every secret query parameter is checked, not only the first', () => {
  const url = 'https://x.dev/mcp?api_key=${credential:A}&token=plain'
  assert.ok(isSecretUrl(url))
  const draft = convertToCredential({ ...emptyDraft(), transport: 'streamable-http', url }, 'url', 'B')
  assert.equal(draft.url, 'https://x.dev/mcp?api_key=${credential:A}&token=${credential:B}')
  assert.deepEqual(draft.pending, [{ ref: 'B', value: 'plain' }])
})

test('a failed first Host read is an error, not a legacy runtime, and a refresh recovers the stream', async () => {
  const { hosts, calls } = fakeHosts()
  let fail = true
  const inspect = hosts.inspect
  const controller = createMcpController({ ...hosts, inspect: async () => { if (fail) throw new Error('not mounted'); return inspect() } },
    { debounceMs: 1 })
  const detach = controller.attach()
  await settle()
  assert.equal(controller.getSnapshot().mode, 'error')
  assert.equal(controller.getSnapshot().hostError, 'not mounted')
  assert.ok(!calls.some(call => call.method === 'watch'))
  fail = false
  await controller.refresh()
  await settle()
  assert.equal(controller.getSnapshot().mode, 'full')
  assert.equal(calls.filter(call => call.method === 'watch').length, 1)
  await controller.refresh()
  assert.equal(calls.filter(call => call.method === 'watch').length, 1, 'a running stream is not restarted')
  detach()
})

test('a slow Settings read cannot roll back the revision a write just returned', async () => {
  const { hosts } = fakeHosts()
  let release: (() => void) | undefined
  let slow = false
  const settings = hosts.settings()!
  const controller = createMcpController({
    ...hosts,
    settings: () => ({
      ...settings,
      describe: async () => {
        if (slow) await new Promise<void>((resolve) => { release = resolve })
        return settings.describe()
      },
    }),
  }, { debounceMs: 1 })
  const detach = controller.attach()
  await settle()
  slow = true
  controller.settingsChanged()
  await settle()
  await controller.setEnabled('tuned', true)
  assert.equal(controller.getSnapshot().settings?.revision, 8)
  release?.()
  await settle()
  assert.equal(controller.getSnapshot().settings?.revision, 8, 'the stale describe (revision 7) was discarded')
  detach()
})

test('forwarded settings and credential events re-read only while a page is attached', async () => {
  const { hosts, calls } = fakeHosts()
  const controller = createMcpController(hosts, { debounceMs: 1 })
  controller.settingsChanged()
  controller.credentialsChanged()
  await settle()
  assert.equal(calls.length, 0)
  const detach = controller.attach()
  await settle()
  const describes = calls.filter(call => call.method === 'describe').length
  const credentialReads = calls.filter(call => call.method === 'credentials.describe').length
  controller.settingsChanged()
  controller.credentialsChanged()
  await settle()
  assert.ok(calls.filter(call => call.method === 'describe').length > describes)
  assert.ok(calls.filter(call => call.method === 'credentials.describe').length > credentialReads)
  detach()
})
