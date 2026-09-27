import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { en, zh } from '../src/client/locales.ts'
import { buildReviewPrompt, installedReviewTargets } from '../src/client/reviewPrompt.ts'
import type { DirectState } from '../src/client/directInstall.ts'

test('installed audits preserve identity and forbid mutations in every profile and language', () => {
  for (const dictionary of [en, zh]) {
    for (const profile of ['desktop', 'DeSkToP', 'web', 'research-team']) {
      for (const targets of [
        [{ packageName: '@acme/plugin', version: '0.5.1' }],
        [{ installReference: 'https://github.com/acme/mono#v1.0.0&path:/packages/plugin', application: 'restart-required' }],
        [{ packageName: 'safer-dsh-market', version: '0.7.5' }],
      ]) {
        const prompt = buildReviewPrompt((key, params) => Object.entries(params ?? {}).reduce(
          (text, [key, value]) => text.replaceAll(`{${key}}`, value), dictionary[key]), { profile, targets })
        assert.ok(prompt.includes(JSON.stringify(targets, null, 2)))
        assert.ok(prompt.includes(profile))
        assert.ok(!/\{(?:profile|targets|url|installed)\}/.test(prompt))
        assert.match(prompt, /不得安装、升级、重装、启用、停用或卸载|Do not install, upgrade, reinstall, enable, disable, or uninstall/)
        assert.match(prompt, /不是安装前的安全放行|not pre-install approval/)
        assert.match(prompt, /没有 plugin_manager 也可|plugin_manager is not required/)
        assert.match(prompt, /不要求切换 Creator|Do not .*require Creator mode/)
        assert.match(prompt, /不悄悄改审 latest|never silently substitute latest/)
        assert.match(prompt, /monorepo/)
        assert.match(prompt, /dist.integrity/)
      }
    }
  }
})

test('review targets include only successful components of a partially completed batch', () => {
  const queue: DirectState['queue'] = [
    { spec: 'first', phase: 'done', application: 'applied', message: '' },
    { spec: 'restart', phase: 'done', application: 'restart-required', message: '' },
    ...['cancelled', 'overridden', 'failed'].map(application => ({ spec: application, phase: 'done' as const, application, message: '' })),
    ...(['unknown', 'installing', 'checking', 'idle', 'failed'] as const).map(phase => ({ spec: phase, phase, message: '' })),
  ]
  assert.deepEqual(installedReviewTargets({ phase: 'failed', spec: 'failed', message: '', pendingBuilds: [], queue }), [
    { installReference: 'first', application: 'applied' },
    { installReference: 'restart', application: 'restart-required' },
  ])
})

test('build has no pre-install review mode or upgrade prompt', async () => {
  const bundle = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  for (const removed of ['AI 审查安装', 'AI review install"', 'prompt.upgrade', 'ReviewSelector', 'function InstallModeSelector']) {
    assert.equal(bundle.includes(removed), false, `obsolete UI in bundle: ${removed}`)
  }
})
