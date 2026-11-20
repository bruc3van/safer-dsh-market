import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registerSafeMarketSettings } from '../src/settings.ts'
import { Config } from '../src/index.ts'

test('catalog access and AI assistant are enabled by default and declared as live Config fields', () => {
  assert.equal(Config({}).enabled.get(), true)
  assert.equal(Config({ enabled: true }).enabled.get(), true)
  assert.equal(Config({ enabled: false }).enabled.get(), false)
  assert.equal(Config.dict.enabled.meta.volatile, true)
  assert.equal(Config({}).aiAssistantEnabled.get(), true)
  assert.equal(Config({ aiAssistantEnabled: false }).aiAssistantEnabled.get(), false)
  assert.equal(Config.dict.aiAssistantEnabled.meta.volatile, true)
})

test('settings write to the actual profile entry and read the retained live reference', async () => {
  const calls: unknown[][] = []
  const fiber = { entry: { options: { id: 'custom-market-entry' } } }
  let enabled = false
  let aiAssistantEnabled = true
  let disposed = false
  let dispose = () => {}
  const config = {
    ...Config({}),
    enabled: { get: () => enabled },
    aiAssistantEnabled: { get: () => aiAssistantEnabled },
  }
  const ctx = {
    fiber,
    effect: (setup: () => () => void) => { dispose = setup() },
    settings: {
      configure: (...args: unknown[]) => { calls.push(args); return () => { disposed = true } },
      update: async (ns: string, patch: { enabled?: boolean; aiAssistantEnabled?: boolean }) => {
        calls.push([ns, patch])
        if (patch.enabled !== undefined) enabled = patch.enabled
        if (patch.aiAssistantEnabled !== undefined) aiAssistantEnabled = patch.aiAssistantEnabled
      },
    },
  }
  const settings = registerSafeMarketSettings(ctx, config)
  assert.deepEqual(calls, [[{ auto: false }, fiber]])
  assert.deepEqual(settings.get(), { enabled: false, aiAssistantEnabled: true })
  await settings.update({ enabled: true })
  assert.deepEqual(calls[1], ['custom-market-entry', { enabled: true }])
  assert.deepEqual(settings.get(), { enabled: true, aiAssistantEnabled: true })
  await settings.update({ aiAssistantEnabled: false })
  assert.deepEqual(calls[2], ['custom-market-entry', { aiAssistantEnabled: false }])
  assert.deepEqual(settings.get(), { enabled: true, aiAssistantEnabled: false })
  enabled = false
  assert.deepEqual(settings.get(), { enabled: false, aiAssistantEnabled: false })
  dispose()
  assert.equal(disposed, true)
})

test('settings persistence failures propagate and do not change the live permission', async () => {
  const ctx = {
    fiber: { entry: { options: { id: 'market' } } },
    effect: (setup: () => unknown) => setup(),
    settings: { configure: () => () => {}, update: async () => { throw new Error('write refused') } },
  }
  const settings = registerSafeMarketSettings(ctx, Config({ enabled: false, aiAssistantEnabled: true }))
  await assert.rejects(settings.update({ enabled: true }), /write refused/)
  assert.deepEqual(settings.get(), { enabled: false, aiAssistantEnabled: true })
})
