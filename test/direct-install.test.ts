import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createDirectInstaller, type InstallHost } from '../src/client/directInstall.ts'
import { parseInstallInfo, isInstallSpec } from '../src/installInfo.ts'
import { deriveMarket } from '../src/catalog.ts'
import { marketCatalogSchema } from '../src/contract.ts'

function host(overrides: Partial<InstallHost> = {}): InstallHost {
  return {
    inspect: async () => ({ ok: true, value: { status: 'accepted', kind: 'registry', bundle: true, registry: null } }),
    installBundle: async () => ({ ok: true, value: { application: 'applied' } }),
    cancelInstall: async () => ({ ok: true, value: { status: 'cancelled' } }),
    waitForInstall: async () => ({ ok: true, value: { application: 'restart-required' } }),
    ...overrides,
  } as InstallHost
}

test('v2 feed preserves targets and tasks on the wire without executable commands', () => {
  const catalog = deriveMarket({ schema_version: 2, entries: [{ full_name: 'owner/demo', category: 'tools', packages: {
    mode: 'command', targets: [{ install: '@owner/demo@1.2.3', profile: 'web', command: 'rm -rf /', note: 'Account required' }], tasks: ['Word'], requirements: ['Node 24'],
  } }] }, 20)
  const row = marketCatalogSchema.parse(catalog).items[0]!
  assert.equal(row.installInfo?.targets[0]?.install, '@owner/demo@1.2.3')
  assert.deepEqual(row.installInfo?.tasks, ['Word'])
  assert.ok(!JSON.stringify(row).includes('rm -rf'))
})
test('feed rejects shell commands, flags, local paths and credential URLs', () => {
  for (const value of ['npm install demo', '--help', '/tmp/demo', 'file:../demo', 'demo;id', 'demo@$(id)', 'https://user:pass@github.com/a/b']) assert.equal(isInstallSpec(value), false, value)
  for (const value of ['demo', '@owner/demo@1.2.3', 'demo@latest', 'git+https://github.com/a/b.git', 'https://github.com/a/b#main', 'https://github.com/a/b#main&path:/packages/plugin', 'https://codeload.github.com/a/b/tar.gz/refs/heads/main', 'https://raw.githubusercontent.com/a/b/main/dist/plugin.tgz', 'https://github.com/a/b/releases/download/v1/demo.tgz']) assert.equal(isInstallSpec(value), true, value)
  assert.equal(parseInstallInfo({ mode: 'manual', manual_instructions: 'Read README', targets: [{ install: 'demo' }] })?.mode, 'manual')
})
test('refused inspection never installs; missing host is an explicit failure', async () => {
  let calls = 0
  const installer = createDirectInstaller(() => host({ inspect: async () => ({ ok: true, value: { status: 'refused', problem: 'not-a-bundle', reason: 'No bundle' } }), installBundle: async () => { calls++; return { ok: true, value: { application: 'applied' } } } }))
  await installer.start('demo')
  assert.equal(calls, 0)
  assert.equal(installer.getSnapshot().phase, 'failed')
  const missing = createDirectInstaller(() => undefined)
  await missing.start('demo')
  assert.equal(missing.getSnapshot().phase, 'failed')
})
test('install uses selected spec, host profile, and explicit script approval only', async () => {
  const calls: unknown[] = []
  const installer = createDirectInstaller(() => host({ installBundle: async (spec, options) => {
    calls.push({ spec, options })
    return calls.length === 1 ? { ok: true, value: { application: 'failed', pendingBuilds: ['native-addon'] } } : { ok: true, value: { application: 'restart-required' } }
  } }))
  await installer.start('demo@1.0.0')
  assert.equal(installer.getSnapshot().phase, 'failed')
  assert.equal((calls[0] as any).options.approvedBuilds, undefined)
  await installer.approve()
  assert.deepEqual((calls[1] as any).options.approvedBuilds, ['native-addon'])
  assert.equal((calls[1] as any).options.profile, undefined)
  assert.equal(installer.getSnapshot().application, 'restart-required')
})
test('lost reply prevents duplicate installation and can recover the original result', async () => {
  let calls = 0
  const installer = createDirectInstaller(() => host({ installBundle: async () => { calls++; throw new Error('Disconnected') } }))
  await installer.start('demo')
  await installer.start('other')
  assert.equal(calls, 1)
  assert.equal(installer.getSnapshot().phase, 'unknown')
  await installer.recover()
  assert.equal(installer.getSnapshot().application, 'restart-required')
})
test('concurrent clicks share one operation and cancellation waits for host settlement', async () => {
  let finish!: (value: any) => void
  const installer = createDirectInstaller(() => host({ installBundle: () => new Promise(resolve => { finish = resolve }) }))
  const pending = installer.start('demo')
  await new Promise(resolve => setImmediate(resolve))
  await installer.start('other')
  assert.equal(installer.getSnapshot().spec, 'demo')
  await installer.cancel()
  assert.equal(installer.getSnapshot().phase, 'cancelling')
  finish({ ok: true, value: { application: 'cancelled' } })
  await pending
  assert.equal(installer.getSnapshot().application, 'cancelled')
})
