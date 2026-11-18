import { test } from 'node:test'
import assert from 'node:assert/strict'
import { stageReviewPrompt } from '../src/client/handoff.ts'

test('review draft is prepared inside host navigation before the conversation is revealed', async () => {
  const events: string[] = []
  const binding = {}
  const result = await stageReviewPrompt(
    { binding: id => { assert.equal(id, 'session'); return binding } },
    { openWorkspace: async (id, beforeOpen) => {
      assert.equal(id, 'workspace')
      events.push('retain')
      beforeOpen!('session')
      events.push('reveal')
    } },
    { input: { requestDraftInitialization: (target, options) => {
      assert.equal(target, binding)
      assert.deepEqual(options, { prompt: 'review only', whenDraftExists: 'keep' })
      events.push('draft')
      return 'applied'
    } } },
    'workspace', 'review only',
  )
  assert.deepEqual(result, { ok: true })
  assert.deepEqual(events, ['retain', 'draft', 'reveal'])
})

test('a reused blank session with an existing draft is not changed or revealed', async () => {
  let revealed = false
  const result = await stageReviewPrompt(
    { binding: () => ({}) },
    { openWorkspace: async (_id, beforeOpen) => { beforeOpen!('session'); revealed = true } },
    { input: { requestDraftInitialization: (_binding, options) => {
      assert.equal(options.whenDraftExists, 'keep')
      return 'preserved'
    } } },
    'workspace', 'review',
  )
  assert.deepEqual(result, { ok: false, reason: 'draft-exists' })
  assert.equal(revealed, false)
})

test('legacy input only accepts a draft after verifying that text and attachments are empty', async () => {
  const staged: string[] = []
  const legacy = (draft: string, attachmentIds: string[]) => stageReviewPrompt(
    { scope: () => ({}) },
    { openWorkspace: async (_id, beforeOpen) => beforeOpen!('session') },
    { input: { for: () => ({
      state: { getSnapshot: () => ({ draft, attachmentIds, phase: 'plain' }) },
      setDraft: text => staged.push(text),
    }) } },
    'workspace', 'review',
  )
  assert.deepEqual(await legacy('unsent', []), { ok: false, reason: 'draft-exists' })
  assert.deepEqual(await legacy('', ['file']), { ok: false, reason: 'draft-exists' })
  assert.deepEqual(await legacy('', []), { ok: true })
  assert.deepEqual(staged, ['review'])
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

test('missing session binding aborts host navigation before revealing the conversation', async () => {
  let revealed = false
  const result = await stageReviewPrompt(
    { binding: () => undefined },
    { openWorkspace: async (_id, beforeOpen) => { beforeOpen!('session'); revealed = true } },
    { input: { requestDraftInitialization: () => { throw new Error('unexpected draft access') } } },
    'workspace', 'review',
  )
  assert.deepEqual(result, { ok: false, reason: 'failed', message: 'the new session did not open' })
  assert.equal(revealed, false)
})

test('draft and connection failures return the host error', async () => {
  for (const phase of ['connect', 'draft']) {
    const result = await stageReviewPrompt(
      { binding: () => ({}) },
      { openWorkspace: async (_id, beforeOpen) => {
        if (phase === 'connect') throw new Error(phase)
        beforeOpen!('session')
      } },
      { input: { requestDraftInitialization: () => { throw new Error(phase) } } },
      'workspace', 'review',
    )
    assert.deepEqual(result, { ok: false, reason: 'failed', message: phase })
  }
})
