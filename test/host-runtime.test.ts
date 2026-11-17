/** Exercise the built plugin against the published 0.2.2-rc.3 Loader and Settings. */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, realpath, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { boot, getDshRuntimeVersion, initProfile, readProfilePatches } from '@deepseek-ai/dsh-app-boot'
import ConfigEditor from '@deepseek-ai/dsh-config-editor'
import Settings from '@deepseek-ai/dsh-settings'
import TypertRegistry from '@deepseek-ai/dsh-typert-registry'
import * as Market from '../lib/index.js'
import { initialDomainState } from '../src/store.ts'
import { SAFE_MARKET_INVOCATIONS } from '../src/contract.ts'

test('built market boots, registers RPCs, and persists settings and plugin toggles across restarts', async () => {
  assert.equal(getDshRuntimeVersion(), '0.2.2-rc.3')
  const home = await realpath(await mkdtemp(join(tmpdir(), 'safe-market-host-')))
  const previousHome = process.env.DSH_HOME
  process.env.DSH_HOME = home
  const contexts = []
  try {
    // Application-owned directory: neither config nor DSH_HOME may redirect the manager.
    const dir = join(home, 'application-profile', 'test')
    initProfile(dir, ['test-market-bundle', 'test-user-bundle'])
    const manifestPath = join(dir, 'package.json')
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    manifest.dependencies['test-user-bundle'] = '1.0.0'
    await writeFile(manifestPath, JSON.stringify(manifest))
    const userBundle = join(dir, 'node_modules', 'test-user-bundle')
    await mkdir(userBundle, { recursive: true })
    await writeFile(join(userBundle, 'package.json'), JSON.stringify({
      name: 'test-user-bundle', version: '1.0.0', dsh: { bundle: { patch: 'cordis.patch.yml' } },
    }))
    await writeFile(join(userBundle, 'cordis.patch.yml'), JSON.stringify([{ insert: [
      { id: 'test-user-entry', name: 'cordis:demo' },
    ] }]))
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
      { id: 'renamed-market', name: 'cordis:market', config: { profile: 'web' } },
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
        Object.assign(ctx.loader.builtins, {
          editor: ConfigEditor, settings: Settings, typert: TypertRegistry, market: Market,
          demo: ctx => { ctx.provide('marketTestDemo', true) },
        })
      })
      contexts.push(ctx)
      await ctx.loader.await()
      assert.ok(ctx.get('dshMarketPro'), 'the built body must mount under the real Loader')
      return ctx
    }
    const first = await start()
    const market = first.get('dshMarketPro')
    assert.deepEqual(market.getSettings(), { enabled: false })
    assert.equal(market.describe().profile, 'test')
    assert.equal(first.settings.describe().find(row => row.ns === 'renamed-market').autoGenerate, false)
    await assert.rejects(market.getCatalog(false, new AbortController().signal), /disabled/)
    for (const descriptor of SAFE_MARKET_INVOCATIONS) {
      const registered = first.typert.local.get(`dshMarketPro/${descriptor.method}`)
      assert.ok(registered, `${descriptor.method} must be registered`)
      const codecs = [...registered.parameters.map(param => param.codec), registered.result]
      for (const codec of codecs) assert.equal(typeof codec.create().safeParse, 'function')
    }
    // Either previous package may still be present during migration. Withdrawing
    // its strict endpoints must leave the new market callable.
    for (const [packageName, namespace] of [
      ['dsh-desktop-safe-market', 'safeMarket'],
      ['safer-dsh-market', 'saferMarket'],
    ]) {
      const legacyInvocations = SAFE_MARKET_INVOCATIONS.map(descriptor => ({
        ...descriptor,
        id: descriptor.id.replace('dsh-market-pro#dshMarketPro/', `${packageName}#${namespace}/`),
        service: namespace, namespace,
      }))
      const legacy = first.typert.register({
        package: packageName, face: 'host', schemas: [],
        model: { services: [], events: [], objects: [] }, invocations: legacyInvocations,
      })
      assert.ok(first.typert.local.get(`${namespace}/updateSettings`))
      await legacy()
      assert.equal(first.typert.local.get(`${namespace}/updateSettings`), undefined)
      assert.ok(first.typert.local.hasSeen(`${namespace}/updateSettings`))
      assert.ok(first.typert.local.get('dshMarketPro/updateSettings'), 'legacy teardown must preserve the new strict endpoint')
      assert.equal(first.get('dshMarketPro').describe().profile, 'test')
    }
    const installed = await market.listInstalled()
    assert.equal(installed.error, '')
    assert.equal(installed.profile, 'test')
    assert.equal(installed.packages.length, 1)
    assert.equal(installed.packages[0].packageName, 'test-user-bundle')
    assert.equal(installed.packages[0].entries[0].phase, 'active')
    assert.equal(first.get('marketTestDemo'), true)
    const disabled = await market.setInstalledEnabled({ packageName: 'test-user-bundle', enabled: false })
    assert.equal(disabled.error, '')
    assert.equal(disabled.packages[0].enabled, false)
    assert.equal(first.get('marketTestDemo'), undefined)
    assert.deepEqual(await market.updateSettings({ field: 'enabled', value: true }), { enabled: true })
    assert.deepEqual(market.getSettings(), { enabled: true }, 'the original service must observe live edits')
    assert.match(await readFile(profile.patchPath, 'utf8'), /enabled: true/)
    await first.fiber.dispose()
    const second = await start()
    assert.deepEqual(second.get('dshMarketPro').getSettings(), { enabled: true })
    assert.equal(second.get('marketTestDemo'), undefined, 'the user patch must keep the plugin disabled after restart')
    const enabled = await second.get('dshMarketPro').setInstalledEnabled({ packageName: 'test-user-bundle', enabled: true })
    assert.equal(enabled.error, '')
    assert.equal(enabled.packages[0].entries[0].phase, 'active')
    assert.equal(second.get('marketTestDemo'), true)
    await second.get('dshMarketPro').updateSettings({ field: 'enabled', value: false })
    assert.deepEqual(second.get('dshMarketPro').getSettings(), { enabled: false })
    await second.fiber.dispose()
    const third = await start()
    assert.equal(third.get('marketTestDemo'), true, 'the plugin must stay enabled after restart')
    assert.deepEqual(third.get('dshMarketPro').getSettings(), { enabled: false })
  } finally {
    for (const ctx of contexts.reverse()) await ctx.fiber.dispose()
    if (previousHome === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previousHome
    await rm(home, { recursive: true, force: true })
  }
})
