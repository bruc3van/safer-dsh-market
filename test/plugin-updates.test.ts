import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { MarketListingEntry, MarketListingVersion, MarketSearchResult, PluginVersion, PluginVersionList, PluginUpdateResult } from '@deepseek-ai/dsh-api-remotes/client'
import { createPluginUpdater, type UpdateHost, type UpdateMarketHost } from '../src/client/pluginUpdates.ts'

const ok = <T>(value: T) => ({ ok: true as const, value })
const failed = (message: string) => ({ ok: false as const, error: { message } })
const version = (number: string, extra: Partial<PluginVersion> = {}): PluginVersion =>
  ({ version: number, tags: [], prerelease: false, bundle: true, ...extra })
const listed = (versions: PluginVersion[]): PluginVersionList =>
  ({ status: 'listed', installed: '1.0.0', registry: 'https://registry.npmjs.org/', attempts: [], versions, omitted: 0 })
const outcome: PluginUpdateResult = { from: '1.0.0', to: '2.0.0', step: 'install',
  result: { changed: true, application: 'applied', stage: 'install', target: 'demo@2.0.0' } }
function host(overrides: Partial<UpdateHost> = {}): UpdateHost {
  return {
    listBundles: async () => ok([{ name: 'demo', version: '1.0.0', installed: true, update: 'registry' }]),
    listVersions: async () => ok(listed([version('2.0.0')])),
    updateBundle: async () => ok(outcome), ...overrides,
  }
}
const gitSpec = `git+https://github.com/owner/plugins.git#${'a'.repeat(40)}&path:/packages/demo`
function gitEntry(name = 'demo', overrides: Partial<MarketListingVersion> = {}): MarketListingEntry {
  return { name, metadata: { keywords: [], labels: [], sortKeys: {} }, installation: { status: 'update-available', installedVersion: '1.0.0' },
    versions: [{ version: '2.0.0', publishTimestamp: 1, source: { type: 'git', url: 'https://github.com/owner/plugins.git', commit: 'a'.repeat(40), path: 'packages/demo' },
      engines: {}, update: true, compatibility: { compatible: true }, install: { spec: gitSpec }, ...overrides }] }
}
function page(entries: MarketListingEntry[], nextOffset: number | null = null): MarketSearchResult {
  return { url: 'https://example.test/index.json', title: { en: 'Test' }, metadata: { categories: {}, labels: {}, sortKeys: {} }, fetchedAt: 123, entries, total: entries.length, nextOffset }
}

test('checking is read-only, chooses a stable compatible version, and confirms with all Remote arguments', async () => {
  const calls: unknown[][] = []
  const updater = createPluginUpdater(() => host({
    listVersions: async (...args) => { calls.push(['list', ...args]); return ok(listed([
      version('3.0.0-rc.1', { prerelease: true }), version('2.1.0', { deprecated: 'Retired' }), version('2.0.0'),
    ])) },
    updateBundle: async (...args) => { calls.push(['update', ...args]); return ok(outcome) },
  }), () => undefined)
  await updater.check('demo')
  assert.deepEqual(calls, [['list', 'demo', {}]])
  assert.equal(updater.getSnapshot().selected, '2.0.0')
  await updater.confirm()
  assert.equal(calls[1]?.length, 4)
  assert.deepEqual(calls[1]?.slice(0, 3), ['update', 'demo', '2.0.0'])
  const options = calls[1]?.[3] as Record<string, unknown>
  assert.equal(options.registry, 'https://registry.npmjs.org/')
  assert.equal(typeof options.requestId, 'string')
  assert.equal('enabled' in options, false, 'the Host preserves enabled state')
  assert.equal(updater.getSnapshot().phase, 'done')
  assert.equal(updater.getSnapshot().revision, 1)
})

test('prereleases need explicit selection; incompatible and non-bundle versions cannot update', async () => {
  let updates = 0
  const updater = createPluginUpdater(() => host({ listVersions: async () => ok(listed([
    version('4.0.0', { incompatible: { name: 'demo', version: '4.0.0', runtimeVersion: '0.2.2-rc.3', requirements: { 'engines.dsh': '>=1.0.0' } } }),
    version('3.0.0', { bundle: false }), version('2.0.0-beta.1', { prerelease: true }),
  ])), updateBundle: async () => { updates++; return ok(outcome) } }), () => undefined)
  await updater.check('demo')
  assert.equal(updater.getSnapshot().selected, '')
  updater.select('4.0.0')
  updater.select('3.0.0')
  await updater.confirm()
  assert.equal(updates, 0)
  updater.select('2.0.0-beta.1')
  await updater.confirm()
  assert.equal(updates, 1)
})

test('Host inventory owns eligibility and a refused lookup never means latest', async () => {
  let checks = 0
  const unsupported = createPluginUpdater(() => host({
    listBundles: async () => ok([{ name: 'demo', installed: true }]),
    listVersions: async () => { checks++; return ok(listed([])) },
  }), () => undefined)
  await unsupported.check('demo')
  assert.equal(unsupported.getSnapshot().phase, 'error')
  assert.equal(checks, 0)
  const refused = createPluginUpdater(() => host({ listVersions: async () => ok({ status: 'refused', problem: 'network', reason: 'Registry timed out', attempts: [] }) }), () => undefined)
  await refused.check('demo')
  assert.equal(refused.getSnapshot().phase, 'error')
  assert.match(refused.getSnapshot().message, /timed out/)
})

test('missing update services and missing Git subscriptions explain the required setup', async () => {
  const unsupported = createPluginUpdater(() => undefined, () => undefined)
  await unsupported.check('demo')
  assert.equal(unsupported.getSnapshot().phase, 'error')
  assert.match(unsupported.getSnapshot().message, /Upgrade DSH/)
  const git = host({ listBundles: async () => ok([{ name: 'demo', version: '1.0.0', installed: true, update: 'git' }]) })
  const missing = createPluginUpdater(() => git, () => ({ listIndexes: async () => ok([]), search: async () => { throw new Error('No index may be invented') } }))
  await missing.check('demo')
  assert.equal(missing.getSnapshot().phase, 'error')
  assert.match(missing.getSnapshot().message, /Add a subscription index/)
})

test('Git checks configured indexes, exact names and Host origin decisions, preserving pagination and pinned path', async () => {
  const calls: unknown[][] = []
  const manager = host({ listBundles: async () => ok([{ name: 'demo', version: '1.0.0', installed: true, update: 'git' }]),
    listVersions: async () => { throw new Error('Git must not query npm') },
    updateBundle: async (...args) => { calls.push(['update', ...args]); return ok(outcome) },
  })
  const market: UpdateMarketHost = {
    listIndexes: async () => ok([{ url: 'https://example.test/index.json' }]),
    search: async (...args) => {
      calls.push(['search', ...args])
      return ok(args[1].offset === 0 ? page([gitEntry('demo-lookalike')], 100)
        : page([{ ...gitEntry(), versions: [gitEntry('demo', { version: '9.0.0', update: false }).versions[0]!, gitEntry().versions[0]!] }]))
    },
  }
  const updater = createPluginUpdater(() => manager, () => market)
  await updater.check('demo')
  assert.equal(updater.getSnapshot().selected, '2.0.0')
  assert.equal(updater.getSnapshot().choices.length, 1)
  assert.deepEqual(calls[0], ['search', 'https://example.test/index.json', { text: 'demo', sort: { kind: 'index' }, offset: 0, limit: 100, refresh: true }])
  assert.deepEqual(calls[1], ['search', 'https://example.test/index.json', { text: 'demo', sort: { kind: 'index' }, offset: 100, limit: 100, fetchedAt: 123 }])
  await updater.confirm()
  const options = calls[2]?.[3] as Record<string, unknown>
  assert.equal(options.spec, gitSpec)
  assert.equal('registry' in options, false)
})

test('Git source failures remain visible when another source offers an update; all failures are errors', async () => {
  const manager = host({ listBundles: async () => ok([{ name: 'demo', version: '1.0.0', installed: true, update: 'git' }]) })
  const market: UpdateMarketHost = { listIndexes: async () => ok([{ url: 'https://failed.test/index.json' }, { url: 'https://working.test/index.json' }]),
    search: async url => url.includes('failed') ? failed('unreachable') : ok(page([gitEntry()])),
  }
  const updater = createPluginUpdater(() => manager, () => market)
  await updater.check('demo')
  assert.equal(updater.getSnapshot().phase, 'ready')
  assert.match(updater.getSnapshot().warnings[0]!, /unreachable/)
  const allFailed = createPluginUpdater(() => manager, () => ({ ...market, search: async () => failed('offline') }))
  await allFailed.check('demo')
  assert.equal(allFailed.getSnapshot().phase, 'error')
})

test('Git badge and dialog skip earlier indexes with only incompatible versions', async () => {
  const manager = host({ listBundles: async () => ok([{ name: 'demo', version: '1.0.0', installed: true, update: 'git' }]) })
  const first = 'https://first.test/index.json'
  const second = 'https://second.test/index.json'
  const updater = createPluginUpdater(() => manager, () => ({
    listIndexes: async () => ok([{ url: first }, { url: second }]),
    search: async url => ok(page(url === first ? [gitEntry('demo', {
      version: '3.0.0', compatibility: { compatible: false, requirements: { 'engines.dsh': '>=1' } },
    })] : [gitEntry()])),
  }))
  await updater.probe(['demo'])
  assert.equal(updater.getSnapshot().available.demo, '2.0.0')
  await updater.check('demo')
  const state = updater.getSnapshot()
  assert.equal(state.available.demo, '2.0.0')
  assert.equal(state.selected, '2.0.0')
  assert.deepEqual(state.choices.map(choice => choice.source), [{ index: second, spec: gitSpec }])
})

test('updates serialize confirmation, match progress ids, and retain restoration outcomes', async () => {
  let finish!: (value: ReturnType<typeof ok<PluginUpdateResult>>) => void
  let options!: Parameters<UpdateHost['updateBundle']>[2]
  let updates = 0
  const updater = createPluginUpdater(() => host({ updateBundle: async (_name, _version, input) => {
    updates++; options = input
    return new Promise(resolve => { finish = resolve })
  } }), () => undefined)
  await updater.check('demo')
  const pending = updater.confirm()
  await updater.confirm()
  updater.close()
  await updater.check('other')
  assert.equal(updates, 1)
  assert.equal(updater.getSnapshot().packageName, 'demo')
  updater.progress({ requestId: 'unrelated' as typeof options.requestId, step: 'removing' })
  assert.equal(updater.getSnapshot().step, 'checking')
  updater.progress({ requestId: options.requestId, step: 'restoring' })
  assert.equal(updater.getSnapshot().step, 'restoring')
  const restored: PluginUpdateResult = { ...outcome, result: { ...outcome.result, application: 'failed' }, restore: { ...outcome.result, target: 'demo@1.0.0' } }
  finish(ok(restored))
  await pending
  assert.equal(updater.getSnapshot().result, restored)
  assert.equal(updater.getSnapshot().revision, 1)
})

test('transport failure remains unknown and never automatically repeats an update', async () => {
  let updates = 0
  const updater = createPluginUpdater(() => host({ updateBundle: async () => { updates++; throw new Error('Connection lost') } }), () => undefined)
  await updater.check('demo')
  await updater.confirm()
  await updater.confirm()
  assert.equal(updater.getSnapshot().phase, 'unknown')
  assert.match(updater.getSnapshot().message, /Connection lost/)
  assert.equal(updater.getSnapshot().revision, 1)
  assert.equal(updates, 1)
})

test('closing a check discards its late response', async () => {
  let finish!: (value: ReturnType<typeof ok<PluginVersionList>>) => void
  const updater = createPluginUpdater(() => host({ listVersions: () => new Promise(resolve => { finish = resolve }) }), () => undefined)
  const pending = updater.check('demo')
  await Promise.resolve()
  updater.close()
  finish(ok(listed([version('2.0.0')])))
  await pending
  assert.equal(updater.getSnapshot().phase, 'idle')
  assert.equal(updater.getSnapshot().choices.length, 0)
})

test('probe records available updates from registry and Git sources and clears after confirm', async () => {
  const manager = host({
    listBundles: async () => ok([
      { name: 'demo', version: '1.0.0', installed: true, update: 'registry' },
      { name: 'git-demo', version: '1.0.0', installed: true, update: 'git' },
      { name: 'fresh', version: '1.0.0', installed: true, update: 'registry' },
    ]),
    listVersions: async name => ok(listed(name === 'demo' ? [version('2.1.0-beta.1', { prerelease: true }), version('2.0.0')] : [])),
    updateBundle: async () => ok(outcome),
  })
  const market: UpdateMarketHost = {
    listIndexes: async () => ok([{ url: 'https://example.test/index.json' }]),
    search: async () => ok(page([gitEntry('git-demo')])),
  }
  const updater = createPluginUpdater(() => manager, () => market)
  await updater.probe(['demo', 'git-demo', 'fresh'])
  assert.deepEqual(updater.getSnapshot().available, { demo: '2.0.0', 'git-demo': '2.0.0' })
  await updater.check('demo')
  await updater.confirm()
  assert.deepEqual(updater.getSnapshot().available, { 'git-demo': '2.0.0' })
})

test('batch update orders self last, skips failures, tracks progress, and clears applied updates', async () => {
  const order: string[] = []
  const manager = host({
    listBundles: async () => ok([
      { name: 'dsh-market-pro', version: '1.9.1', installed: true, update: 'registry' },
      { name: 'broken-plugin', version: '1.0.0', installed: true, update: 'registry' },
      { name: 'good-plugin', version: '0.5.0', installed: true, update: 'registry' },
    ]),
    listVersions: async name => ok({
      status: 'listed',
      installed: name === 'dsh-market-pro' ? '1.9.1' : name === 'broken-plugin' ? '1.0.0' : '0.5.0',
      registry: 'https://registry.npmjs.org/',
      attempts: [],
      versions: [version(name === 'dsh-market-pro' ? '1.9.2' : name === 'broken-plugin' ? '1.1.0' : '0.6.0')],
      omitted: 0,
    }),
    updateBundle: async (name, to) => {
      order.push(`${name}@${to}`)
      if (name === 'broken-plugin') {
        return ok({
          from: '1.0.0',
          to,
          step: 'install',
          result: { changed: false, application: 'failed', stage: 'install', target: `${name}@${to}` },
          restore: { changed: true, application: 'applied', stage: 'install', target: 'broken-plugin@1.0.0' },
        })
      }
      return ok({
        from: name === 'dsh-market-pro' ? '1.9.1' : '0.5.0',
        to,
        step: 'install',
        result: {
          changed: true,
          application: name === 'dsh-market-pro' ? 'restart-required' : 'applied',
          stage: 'install',
          target: `${name}@${to}`,
        },
      })
    },
  })
  const updater = createPluginUpdater(() => manager, () => undefined)
  await updater.probe(['dsh-market-pro', 'broken-plugin', 'good-plugin'])
  assert.deepEqual(updater.getSnapshot().available, {
    'dsh-market-pro': '1.9.2',
    'broken-plugin': '1.1.0',
    'good-plugin': '0.6.0',
  })

  await updater.startBatch(['dsh-market-pro', 'broken-plugin', 'good-plugin'], 'dsh-market-pro')
  assert.deepEqual(order, ['broken-plugin@1.1.0', 'good-plugin@0.6.0', 'dsh-market-pro@1.9.2'])
  const snap = updater.getSnapshot()
  assert.equal(snap.batch.phase, 'done')
  assert.deepEqual(
    snap.batch.items.map(item => [item.packageName, item.status, item.restoreApplication, item.self]),
    [
      ['broken-plugin', 'failed', 'applied', false],
      ['good-plugin', 'applied', undefined, false],
      ['dsh-market-pro', 'restart-required', undefined, true],
    ],
  )
  // Applied and restart-required packages are removed from available; failed remains retryable.
  assert.deepEqual(snap.available, { 'broken-plugin': '1.1.0' })
  assert.ok(snap.availableDetails['broken-plugin'])
  assert.equal(snap.availableDetails['good-plugin'], undefined)
})

test('requestStopBatch lets the current update settle and marks remaining items skipped', async () => {
  let finishFirst!: (value: ReturnType<typeof ok<PluginUpdateResult>>) => void
  const called: string[] = []
  const manager = host({
    listBundles: async () => ok([
      { name: 'first', version: '1.0.0', installed: true, update: 'registry' },
      { name: 'second', version: '1.0.0', installed: true, update: 'registry' },
    ]),
    listVersions: async () => ok(listed([version('2.0.0')])),
    updateBundle: async (name) => {
      called.push(name)
      return new Promise(resolve => { finishFirst = resolve })
    },
  })
  const updater = createPluginUpdater(() => manager, () => undefined)
  await updater.probe(['first', 'second'])
  const pending = updater.startBatch(['first', 'second'])
  await Promise.resolve()
  updater.requestStopBatch()
  assert.equal(updater.getSnapshot().batch.stopRequested, true)
  finishFirst(ok(outcome))
  await pending
  assert.deepEqual(called, ['first'])
  assert.deepEqual(
    updater.getSnapshot().batch.items.map(item => [item.packageName, item.status]),
    [['first', 'applied'], ['second', 'skipped']],
  )
})

test('probe prunes uninstalled or non-updatable packages so stale candidates cannot enter batch updates', async () => {
  let installedList = [
    { name: 'keep-me', version: '1.0.0', installed: true, update: 'registry' as const },
    { name: 'remove-me', version: '1.0.0', installed: true, update: 'registry' as const },
  ]
  const updated: string[] = []
  const manager = host({
    listBundles: async () => ok(installedList),
    listVersions: async () => ok(listed([version('2.0.0')])),
    updateBundle: async (name) => { updated.push(name); return ok(outcome) },
  })
  const updater = createPluginUpdater(() => manager, () => undefined)
  await updater.probe(['keep-me', 'remove-me'])
  assert.deepEqual(updater.getSnapshot().available, { 'keep-me': '2.0.0', 'remove-me': '2.0.0' })

  // Uninstall remove-me and re-probe: stale candidate must be pruned from both maps.
  installedList = [{ name: 'keep-me', version: '1.0.0', installed: true, update: 'registry' as const }]
  await updater.probe(['keep-me'])
  assert.deepEqual(updater.getSnapshot().available, { 'keep-me': '2.0.0' })
  assert.equal(updater.getSnapshot().availableDetails['remove-me'], undefined)

  await updater.startBatch(['keep-me', 'remove-me'])
  assert.deepEqual(updated, ['keep-me'])
})

test('retrying a failed batch target pins the shown target version even if background probe finds a newer release', async () => {
  let latestOnRegistry = '2.0.0'
  let attempt = 0
  const submitted: string[] = []
  const manager = host({
    listBundles: async () => ok([{ name: 'demo', version: '1.0.0', installed: true, update: 'registry' }]),
    listVersions: async () => ok(listed([version(latestOnRegistry)])),
    updateBundle: async (name, to) => {
      attempt += 1
      submitted.push(`${name}@${to}`)
      if (attempt === 1) {
        return ok({
          from: '1.0.0',
          to,
          step: 'install',
          result: { changed: false, application: 'failed', stage: 'install', target: `${name}@${to}` },
        })
      }
      return ok({
        from: '1.0.0',
        to,
        step: 'install',
        result: { changed: true, application: 'applied', stage: 'install', target: `${name}@${to}` },
      })
    },
  })
  const updater = createPluginUpdater(() => manager, () => undefined)
  await updater.probe(['demo'])
  await updater.startBatch(['demo'])
  const failedItem = updater.getSnapshot().batch.items[0]!
  assert.equal(failedItem.status, 'failed')
  assert.equal(failedItem.to, '2.0.0')

  // Background probe discovers 3.0.0 while the result view still shows the failed 2.0.0 attempt.
  latestOnRegistry = '3.0.0'
  await updater.probe(['demo'])
  assert.equal(updater.getSnapshot().available.demo, '3.0.0')

  // Retrying with the pinned target from the result view must submit 2.0.0, not 3.0.0,
  // and must preserve the newer 3.0.0 availability badge afterward.
  await updater.startBatch([{
    packageName: failedItem.packageName,
    installed: failedItem.from,
    version: failedItem.to,
    kind: failedItem.kind,
    source: failedItem.source,
  }])
  assert.deepEqual(submitted, ['demo@2.0.0', 'demo@2.0.0'])
  assert.equal(updater.getSnapshot().available.demo, '3.0.0')
})
