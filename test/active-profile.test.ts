import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveActiveProfile } from '../src/activeProfile.ts'

test('launcher profile overrides stale web configuration for desktop and custom names', () => {
  for (const name of ['desktop', 'research-team', 'web']) {
    const context = { name, dir: `/app/data/${name}`, home: '/app/data' }
    assert.deepEqual(resolveActiveProfile(context, 'web'), context)
  }
})
test('non-profile hosts require an explicit valid profile; never guess web', () => {
  assert.deepEqual(resolveActiveProfile(undefined, 'custom'), { name: 'custom' })
  for (const name of ['', '../web', 'web; echo bad']) {
    assert.throws(() => resolveActiveProfile(undefined, name))
  }
  assert.throws(() => resolveActiveProfile({ name: '', dir: '/app', home: '/app' }, 'web'))
  assert.throws(() => resolveActiveProfile({ name: 'desktop', dir: '', home: '/app' }, 'web'))
})

test('review prompts require explicit profile selection and stop on a mismatch', async () => {
  const { zh, en } = await import('../src/client/locales.ts')
  for (const dictionary of [zh, en]) {
    for (const key of ['prompt', 'prompt.upgrade'] as const) {
      const prompt = dictionary[key].replaceAll('{profile}', 'desktop')
      assert.match(prompt, /--profile desktop/)
      assert.ok(!prompt.includes('--profile web'))
    }
  }
})

test('both review flows route Electron profiles through official management rather than CLI', async () => {
  const { zh, en } = await import('../src/client/locales.ts')
  for (const dictionary of [zh, en]) {
    for (const key of ['prompt', 'prompt.upgrade'] as const) {
      const prompt = dictionary[key]
      assert.match(prompt, /plugin_manager/)
      assert.match(prompt, /list_bundles/)
      assert.match(prompt, /install_bundle/)
      assert.match(prompt, /desktop/)
      assert.match(prompt, /Electron/)
    }
  }
  assert.match(zh.prompt, /禁止改装 web、手改 profile 或直接运行 pnpm/)
  assert.match(en['prompt.upgrade'], /Do not substitute web, edit profile files, or run pnpm directly/)
})
