import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stageReviewPrompt } from '../src/client/handoff.ts'

test('review draft is prepared inside host navigation before the conversation is revealed', async () => {
  const events: string[] = []
  const scope = {}
  const result = await stageReviewPrompt(
    { scope: id => { assert.equal(id, 'session'); return scope } },
    { openWorkspace: async (id, beforeOpen) => {
      assert.equal(id, 'workspace')
      events.push('retain')
      beforeOpen!('session')
      events.push('reveal')
    } },
    { input: { for: actx => {
      assert.equal(actx, scope)
      return { setDraft: text => { assert.equal(text, 'review only'); events.push('draft') } }
    } } },
    'workspace', 'review only',
  )
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(events, ['retain', 'draft', 'reveal'])
})

test('a superseded navigation does not stage a draft or claim success', async () => {
  const result = await stageReviewPrompt(
    { scope: () => { throw new Error('unexpected scope access') } },
    { openWorkspace: async () => {} },
    { input: { for: () => { throw new Error('unexpected draft access') } } },
    'workspace', 'review',
  )
  assert.deepEqual(result, { ok: false, reason: 'cancelled' })
})

test('missing session scope aborts host navigation before revealing the conversation', async () => {
  let revealed = false
  const result = await stageReviewPrompt(
    { scope: () => undefined },
    { openWorkspace: async (_id, beforeOpen) => { beforeOpen!('session'); revealed = true } },
    { input: { for: () => { throw new Error('unexpected draft access') } } },
    'workspace', 'review',
  )
  assert.deepEqual(result, { ok: false, reason: 'failed', message: 'the new session did not open' })
  assert.equal(revealed, false)
})

test('draft and connection failures return the host error', async () => {
  for (const phase of ['connect', 'draft']) {
    const result = await stageReviewPrompt(
      { scope: () => ({}) },
      { openWorkspace: async (_id, beforeOpen) => {
        if (phase === 'connect') throw new Error(phase)
        beforeOpen!('session')
      } },
      { input: { for: () => ({ setDraft: () => { throw new Error(phase) } }) } },
      'workspace', 'review',
    )
    assert.deepEqual(result, { ok: false, reason: 'failed', message: phase })
  }
})
