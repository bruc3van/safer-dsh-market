import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ownerAvatarUrl } from '../src/client/avatar.ts'

test('a plugin without its own icon falls back to its GitHub owner avatar', () => {
  assert.equal(ownerAvatarUrl('Owner-1/repo'), 'https://avatars.githubusercontent.com/Owner-1?s=96')
  for (const bad of [undefined, '', 'npm', 'owner', '-bad-/repo', 'a.b/repo', 'owner/repo/extra', 'javascript:x/y']) {
    assert.equal(ownerAvatarUrl(bad), undefined, String(bad))
  }
})
