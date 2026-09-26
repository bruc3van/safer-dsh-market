import { test } from 'node:test'
import assert from 'node:assert/strict'
import { setImmediate } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { Context } from '@deepseek-ai/cordis'
import { en, zh } from '../src/client/locales.ts'

// Transform JSX for Node's test runner; production keeps React external.
const result = await build({
  entryPoints: [fileURLToPath(new URL('../src/client/sidebar.tsx', import.meta.url))],
  bundle: true, write: false, platform: 'node', format: 'esm',
})
const { registerMarketNavigation, MarketMain, registerMarketSidebar, MarketSidebar, MARKET_TAB_ID } = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`
)

test('left navigation pairs its destination, returns to conversation, and cleans up on service loss', async () => {
  const ctx = new Context()
  const entries = new Map()
  const face = { loadCatalog: () => undefined }
  let selected = MARKET_TAB_ID
  let dictionary = zh
  ctx.provide('locale', { bind: () => (key: keyof typeof zh) => dictionary[key] })
  ctx.provide('slots', {
    inject: (_name: string, register: () => () => void) => register(),
    register: (entry: { name: string; id?: string; key?: string }, component: unknown) => {
      if (entry.name === 'sidebar.panellist') assert.ok(entries.has('main'))
      entries.set(entry.name, { entry, component })
      return () => entries.delete(entry.name)
    },
  })
  const feature = ctx.plugin((scope: Context) => registerMarketNavigation(scope, () => face))
  await feature.await()
  assert.equal(entries.size, 0)
  const provider = ctx.plugin((scope: Context) => scope.provide('layout', {
    selectPanel: (id: string | null) => { selected = id },
  }))
  await provider.await()
  await setImmediate()
  const row = entries.get('sidebar.panellist').entry
  const main = entries.get('main')
  assert.equal(row.id, MARKET_TAB_ID)
  assert.equal(main.entry.key, row.id)
  assert.equal(row.label(), '安全市场')
  dictionary = en
  assert.equal(row.label(), 'Safe Market')
  assert.equal(main.component, MarketMain)
  const page = MarketMain(main.entry.inject())
  assert.equal(page.props.children.props.loadCatalog, face.loadCatalog)
  page.props.children.props.close()
  assert.equal(selected, null)
  await provider.dispose()
  await setImmediate()
  assert.equal(entries.size, 0)
  await feature.dispose()
})

test('sidebar registration waits for its service, shares the face, and follows plugin lifetime', async () => {
  const ctx = new Context()
  let dictionary = zh
  const types = new Map()
  const bodies = new Map()
  const face = { hooks: { scope: {} } }
  ctx.provide('locale', { bind: () => (key: keyof typeof zh) => dictionary[key] })
  ctx.provide('slots', {
    inject: (_name: string, register: () => () => void) => register(),
    register: (entry: { key: string; inject: () => unknown }, component: unknown) => {
      bodies.set(entry.key, { entry, component })
      return () => bodies.delete(entry.key)
    },
  })
  const feature = ctx.plugin((scope: Context) => registerMarketSidebar(scope, () => face))
  await feature.await()
  assert.equal(types.size, 0)
  assert.equal(bodies.size, 0)
  const provider = ctx.plugin((scope: Context) => {
    scope.provide('sidebarRightTabs', {
      register: (definition: { id: string }) => {
        assert.equal(types.has(definition.id), false)
        types.set(definition.id, definition)
        return () => types.delete(definition.id)
      },
    })
  })
  await provider.await()
  await setImmediate()
  assert.equal(types.size, 1)
  const definition = types.get(MARKET_TAB_ID)
  assert.equal(definition.kind, MARKET_TAB_ID)
  assert.equal(definition.guide[0].id, MARKET_TAB_ID)
  assert.equal(definition.title(), '安全市场')
  assert.equal(definition.guide[0].description(), zh['sidebar.description'])
  dictionary = en
  assert.equal(definition.title(), 'Safe Market')
  assert.equal(definition.guide[0].title(), 'Safe Market')
  assert.equal(bodies.get(MARKET_TAB_ID).entry.inject(), face)
  assert.equal(bodies.get(MARKET_TAB_ID).component, MarketSidebar)
  await feature.dispose()
  assert.equal(types.size, 0)
  assert.equal(bodies.size, 0)
  const reloaded = ctx.plugin((scope: Context) => registerMarketSidebar(scope, () => face))
  await reloaded.await()
  await setImmediate()
  assert.equal(types.size, 1)
  await provider.dispose()
  await setImmediate()
  assert.equal(types.size, 0)
  assert.equal(bodies.size, 0)
  await reloaded.dispose()
})

test('sidebar dismissal closes its own tab after the shared market hand-off', () => {
  let closed = 0
  const loadCatalog = () => undefined
  const wrapper = MarketSidebar({
    useTabInfo: () => ({ tab: { actions: { close: () => { closed++ } } } }),
    loadCatalog,
  })
  const market = wrapper.props.children
  assert.equal(market.props.loadCatalog, loadCatalog)
  assert.equal(closed, 0)
  market.props.close()
  assert.equal(closed, 1)
})
