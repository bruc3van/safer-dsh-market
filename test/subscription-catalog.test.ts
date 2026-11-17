import test from 'node:test'
import assert from 'node:assert/strict'
import { deriveMarket } from '../src/catalog.ts'
import { marketCatalogSchema, type MarketInstalledPackage } from '../src/contract.ts'
import { featuredRows, marketKey, marketRows, matches, pageOf } from '../src/client/rows.ts'
import { ownedBy, ownedIndexOf } from '../src/client/owned.ts'
import { isMarketIcon } from '../src/shapes.ts'

const repository = { full_name: 'owner/monorepo', description: 'Repository', category: 'agents-workflows', category_zh: 'Agent 工作流', category_en: 'Agent workflows' }
const packageRow = (name: string, overrides = {}) => ({
  name, title: { zh: `插件 ${name}`, en: `Plugin ${name}` }, description: { zh: '编排任务', en: 'Orchestrate tasks' },
  repository: { url: 'https://github.com/owner/monorepo' },
  metadata: { category: 'agents-workflows', keywords: ['工作流编排', 'orchestration'] },
  versions: [{ version: '1.2.3', source: { type: 'npm', registry: 'https://registry.npmjs.org/' }, engines: { dsh: '^0.2.2' } }], ...overrides,
})
const feed = (plugins = [packageRow('@demo/one'), packageRow('@demo/two')]) => ({
  schema_version: 3, entries: [repository, { ...repository, full_name: 'owner/archived', archived: true }],
  subscription_updated_at: '2026-11-17T07:27:26Z',
  subscription: { format: 1, metadata: { categories: { 'agents-workflows': { title: { zh: 'Agent 工作流', en: 'Agent workflows' } } } }, plugins },
})

test('complete catalog ignores legacy size cuts and preserves package identities and subscription categories', () => {
  const catalog = marketCatalogSchema.parse(deriveMarket(feed(), 1))
  assert.equal(catalog.items.length, 2)
  assert.ok(catalog.items[1]?.archived)
  assert.equal(catalog.featured?.count, 2)
  const picks = catalog.featured!
  assert.deepEqual(picks.entries.map(entry => entry.item.packageName), ['@demo/one', '@demo/two'])
  assert.equal(new Set(picks.entries.map(entry => marketKey(entry.item))).size, 2)
  assert.deepEqual(picks.categories, [{ key: 'agents-workflows', zh: 'Agent 工作流', en: 'Agent workflows', count: 2 }])
  assert.equal(featuredRows(picks, 'orchestration', false, 'agents-workflows').length, 2)
  assert.equal(featuredRows(picks, '', false, 'developer-tools').length, 0)
  assert.equal(marketRows(catalog.items, picks, 'one').length, 2, 'All remains a repository list')
  assert.ok(matches(picks.entries[0]!.item, 'plugin 编排', '', false))
})

test('all subscription plugins survive beyond the old fifty-pick cap', () => {
  const catalog = deriveMarket(feed(Array.from({ length: 130 }, (_, i) => packageRow(`plugin-${i}`))), 1)
  assert.equal(catalog.featured?.entries.length, 130)
  assert.equal(catalog.featured?.count, 130)
})

test('npm-only, Gitee, and Git subdirectory packages retain usable links and exact pinned installs', () => {
  const catalog = marketCatalogSchema.parse(deriveMarket(feed([
    packageRow('npm-only', { repository: undefined }),
    packageRow('gitee-plugin', { repository: { url: 'https://gitee.com/demo/plugin' } }),
    packageRow('git-child', { versions: [{ version: '1.0.0', source: { type: 'git', url: 'https://github.com/owner/monorepo', commit: 'a'.repeat(40), path: 'plugins/child' } }] }),
  ]), 1000))
  const items = catalog.featured!.entries.map(entry => entry.item)
  assert.equal(items[0]?.fullName, '')
  assert.equal(items[0]?.url, 'https://www.npmjs.com/package/npm-only')
  assert.equal(items[0]?.installInfo?.targets[0]?.install, 'npm-only@1.2.3')
  assert.equal(items[1]?.url, 'https://gitee.com/demo/plugin')
  assert.equal(items[2]?.installInfo?.targets[0]?.install, `https://github.com/owner/monorepo#${'a'.repeat(40)}&path:plugins/child`)
})

test('plugin logos preserve supported image sources and discard executable or local URLs', () => {
  const icon = 'data:image/svg+xml;base64,PHN2Zy8+'
  const catalog = marketCatalogSchema.parse(deriveMarket(feed([
    packageRow('with-logo', { icon }),
    packageRow('without-logo'),
    packageRow('unsafe-logo', { icon: 'javascript:alert(1)' }),
  ]), 1000))
  assert.equal(catalog.featured?.entries[0]?.item.icon, icon)
  assert.equal(catalog.featured?.entries[1]?.item.icon, undefined)
  assert.equal(catalog.featured?.entries[2]?.item.icon, undefined)
  assert.ok(isMarketIcon('https://example.com/logo.png'))
  assert.ok(!isMarketIcon('file:///C:/logo.png'))
  assert.ok(!isMarketIcon('data:text/html;base64,PHN2Zy8+'))
})

test('broken subscription sources cannot quietly become a smaller featured set', () => {
  assert.throws(() => deriveMarket({ ...feed(), subscription: undefined }, 1000), /no published/)
  assert.throws(() => deriveMarket(feed([packageRow('same'), packageRow('same')]), 1000), /duplicate/)
  assert.throws(() => deriveMarket(feed([packageRow('bad', { versions: [{ version: '1.0.0', source: { type: 'git', url: 'https://evil.example/x/y', commit: 'a'.repeat(40) } }] })]), 1000), /install source/)
})

test('installed badges use exact package identity for monorepo siblings', () => {
  const installed = { packageName: '@demo/one', repository: 'owner/monorepo', error: '' } as MarketInstalledPackage
  const index = ownedIndexOf([installed])
  const picks = deriveMarket(feed(), 1000).featured!
  assert.equal(ownedBy(index, picks.entries[0]!.item), installed)
  assert.equal(ownedBy(index, picks.entries[1]!.item), undefined)
})

test('pagination searches the complete list and renders only the selected fifty results', () => {
  const items = Array.from({ length: 28440 }, (_, i) => i)
  const first = pageOf(items, 0), second = pageOf(items, 1), last = pageOf(items, 568)
  assert.deepEqual([first.total, first.pages, first.start, first.end, first.items.length], [28440, 569, 1, 50, 50])
  assert.equal(second.items[0], 50)
  assert.deepEqual([last.start, last.end, last.items.length], [28401, 28440, 40])
  assert.equal(pageOf(items.filter(i => i === 28439), 568).items[0], 28439)
  assert.equal(pageOf([], 568).items.length, 0)
})
