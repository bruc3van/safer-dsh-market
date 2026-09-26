/** Exercise the built plugin against the published 0.1.7-rc.2 Loader and Settings. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, realpath, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { boot, initProfile, readProfilePatches } from '@deepseek-ai/dsh-app-boot'
import ConfigEditor from '@deepseek-ai/dsh-config-editor'
import Settings from '@deepseek-ai/dsh-settings'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import * as Market from '../lib/index.js'
import { initialDomainState } from '../src/store.ts'
import { SAFE_MARKET_INVOCATIONS } from '../src/contract.ts'

test('built market boots, exposes all RPC codecs, persists its switch, and restores it after restart', async () => {
  const home = await realpath(await mkdtemp(join(tmpdir(), 'safe-market-host-')))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
  const contexts = []
  try {
    const dir = join(home, 'profiles', 'test')
    initProfile(dir, ['test-market-bundle'])
    const bundle = join(dir, 'node_modules', 'test-market-bundle')
    await mkdir(bundle, { recursive: true })
    await writeFile(join(home, 'package.json'), '{"name":"market-test"}\n')
    await writeFile(join(bundle, 'package.json'), JSON.stringify({
      name: 'test-market-bundle', version: '1.0.0', dsh: { bundle: { patch: 'cordis.patch.yml' } },
    }))
    await writeFile(join(bundle, 'cordis.patch.yml'), JSON.stringify([{ insert: [
      { id: 'config-editor', name: 'cordis:editor' },
      { id: 'settings', name: 'cordis:settings' },
      { id: 'typert', name: 'cordis:typert' },
      { id: 'renamed-market', name: 'cordis:market', config: { profile: 'test' } },
    ] }]))
    await writeFile(join(dir, 'cordis.yml'), '[]\n')
    const profile = {
      name: 'test', startedBundles: ['test-market-bundle'], dir, patchPath: join(dir, 'cordis.patch.yml'),
      installAnchor: join(home, 'package.json'), cwd: home, home, overlays: [], telemetryDisabledEnv: undefined,
    }
    const start = async () => {
      const ctx = await boot('test', join(dir, 'cordis.yml'), readProfilePatches('test', profile), ctx => {
        ctx.provide('profileContext', profile)
        ctx.provide('appReady', { onReady: listener => { listener(); return () => {} } })
        ctx.provide('skills', {})
        ctx.provide('storageDomain', { open: async () => ({
          global: { get: () => initialDomainState, set: async () => {} }, close: async () => {},
        }) })
        Object.assign(ctx.loader.builtins, { editor: ConfigEditor, settings: Settings, typert: TypertRegistry, market: Market })
      })
      contexts.push(ctx)
      await ctx.loader.await()
      assert.ok(ctx.get('safeMarket'), 'the built body must mount under the real Loader')
      return ctx
    }
    const first = await start()
    const market = first.get('safeMarket')
    assert.deepEqual(market.getSettings(), { enabled: false })
    assert.equal(market.describe().profile, 'test')
    assert.equal(first.settings.describe().find(row => row.ns === 'renamed-market').autoGenerate, false)
    await assert.rejects(market.getCatalog(false, new AbortController().signal), /disabled/)
    for (const descriptor of SAFE_MARKET_INVOCATIONS) {
      const registered = first.typert.local.get(`safeMarket/${descriptor.method}`)
      assert.ok(registered, `${descriptor.method} must be registered`)
      const codecs = [...registered.parameters.map(param => param.codec), registered.result]
      for (const codec of codecs) assert.equal(typeof codec.create().safeParse, 'function')
    }
    assert.deepEqual(await market.listInstalled(), { packages: [], profile: 'test', error: '' })
    assert.deepEqual(await market.updateSettings({ field: 'enabled', value: true }), { enabled: true })
    assert.deepEqual(market.getSettings(), { enabled: true }, 'the original service must observe live edits')
    assert.match(await readFile(profile.patchPath, 'utf8'), /enabled: true/)
    await first.fiber.dispose()
    const second = await start()
    assert.deepEqual(second.get('safeMarket').getSettings(), { enabled: true })
    await second.get('safeMarket').updateSettings({ field: 'enabled', value: false })
    assert.deepEqual(second.get('safeMarket').getSettings(), { enabled: false })
  } finally {
    for (const ctx of contexts.reverse()) await ctx.fiber.dispose()
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    await rm(home, { recursive: true, force: true })
  }
})
