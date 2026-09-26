import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerSafeMarketSettings } from '../src/settings.ts'
import { Config } from '../src/index.ts'

test('catalog access is disabled by default and declared as a live Config field', () => {
  assert.equal(Config({}).enabled.get(), false)
  assert.equal(Config({ enabled: true }).enabled.get(), true)
  assert.equal(Config.dict.enabled.meta.volatile, true)
})

test('settings write to the actual profile entry and read the retained live reference', async () => {
  const calls: unknown[][] = []
  const fiber = { entry: { options: { id: 'custom-market-entry' } } }
  let enabled = false
  let disposed = false
  let dispose = () => {}
  const config = { ...Config({}), enabled: { get: () => enabled } }
  const ctx = {
    fiber,
    effect: (setup: () => () => void) => { dispose = setup() },
    settings: {
      configure: (...args: unknown[]) => { calls.push(args); return () => { disposed = true } },
      update: async (ns: string, patch: { enabled: boolean }) => {
        calls.push([ns, patch]); enabled = patch.enabled
      },
    },
  }
  const settings = registerSafeMarketSettings(ctx, config)
  assert.deepEqual(calls, [[{ auto: false }, fiber]])
  assert.deepEqual(settings.get(), { enabled: false })
  await settings.update({ enabled: true })
  assert.deepEqual(calls[1], ['custom-market-entry', { enabled: true }])
  assert.deepEqual(settings.get(), { enabled: true })
  enabled = false
  assert.deepEqual(settings.get(), { enabled: false })
  dispose()
  assert.equal(disposed, true)
})

test('settings persistence failures propagate and do not change the live permission', async () => {
  const ctx = {
    fiber: { entry: { options: { id: 'market' } } },
    effect: (setup: () => unknown) => setup(),
    settings: { configure: () => () => {}, update: async () => { throw new Error('write refused') } },
  }
  const settings = registerSafeMarketSettings(ctx, Config({}))
  await assert.rejects(settings.update({ enabled: true }), /write refused/)
  assert.deepEqual(settings.get(), { enabled: false })
})
