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

test('read-only audit keeps the explicit profile and does not require installation tools', async () => {
  const { zh, en } = await import('../src/client/locales.ts')
  for (const dictionary of [zh, en]) {
    const prompt = dictionary.prompt.replaceAll('{profile}', 'desktop')
    assert.ok(prompt.includes('desktop'))
    assert.ok(!prompt.includes('--profile'))
    assert.ok(!prompt.includes('install_bundle'))
    assert.match(prompt, /不改用默认 web 或其他 profile|Never substitute web or another profile/)
  }
})
