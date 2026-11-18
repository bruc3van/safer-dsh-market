/** Cross-project acceptance against the actual publisher and consumer implementations.
 * node scripts/verify-upstream-catalog.mjs ../awesome-dsh-plugin-pro
 */
import assert from 'node:assert/strict'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { deriveMarket } from '../src/catalog.ts'
import { marketCatalogSchema } from '../src/contract.ts'
import { marketKey, pageOf } from '../src/client/rows.ts'
import { FEATURED_CATEGORY, SUBSCRIPTION_CATEGORY } from '../src/shapes.ts'

const root = pathToFileURL(`${resolve(process.argv[2] ?? '../awesome-dsh-plugin-pro')}/`)
const { readSafeMarketCatalog } = await import(new URL('scripts/safe-market-catalog.mjs', root).href)
const { catalogRepositories, loadState } = await import(new URL('scripts/render.mjs', root).href)
const { marketBlockedRepoNames } = await import(new URL('scripts/market-pool.mjs', root).href)
const [feed, state, index] = await Promise.all([
  readSafeMarketCatalog(root), loadState(), readFile(new URL('data/dsh-market-index.json', root), 'utf8').then(JSON.parse),
])
const start = performance.now()
const catalog = marketCatalogSchema.parse(deriveMarket(feed, 1000))
const parseAndValidateMs = Math.round(performance.now() - start)
const featured = catalog.featured.entries.map(entry => entry.item)
const picks = (catalog.subscription ?? catalog.featured).entries.map(entry => entry.item)
const blocked = marketBlockedRepoNames(state.curated)
assert.deepEqual(catalog.items.map(item => item.fullName), catalogRepositories(state)
  .filter(repo => !blocked.has(repo.full_name.toLowerCase())).map(repo => repo.full_name))
if (feed.featured) {
  assert.equal(catalog.featured.count, feed.featured.entries.length)
  assert.deepEqual(featured.map(item => item.fullName.toLowerCase()), feed.featured.entries.map(entry => entry.full_name.toLowerCase()))
}
assert.deepEqual(picks.map(item => item.packageName), index.plugins.map(plugin => plugin.name))
assert.equal(new Set(picks.map(marketKey)).size, index.plugins.length)
for (let i = 0; i < index.plugins.length; i++) {
  const plugin = index.plugins[i], item = picks[i], version = plugin.versions[0], source = version.source
  assert.equal(item.category, plugin.metadata.category)
  assert.equal(item.categoryZh, index.metadata.categories[item.category].title.zh)
  assert.equal(item.icon, plugin.icon)
  assert.equal(item.installInfo.targets[0].install, source.type === 'npm'
    ? `${plugin.name}@${version.version}`
    : `${source.url.replace(/\.git$/, '')}#${source.commit}${source.path ? `&path:${source.path}` : ''}`)
}
assert.equal(catalog.featured.categories.reduce((n, category) => n + category.count, 0), featured.length)
assert.equal(catalog.categories.filter(category => category.key !== FEATURED_CATEGORY && category.key !== SUBSCRIPTION_CATEGORY)
  .reduce((n, category) => n + category.count, 0), catalog.items.length)
assert.equal(pageOf(catalog.items, 0).items.length, Math.min(50, catalog.items.length))
assert.equal(pageOf(featured, 0).items.length, Math.min(50, featured.length))
assert.equal(pageOf(featured, 0).pages, Math.ceil(featured.length / 50))
const serialized = JSON.stringify(feed)
console.log(JSON.stringify({
  repositories: catalog.items.length, featuredPicks: featured.length, subscriptionPlugins: picks.length,
  categories: catalog.featured.categories, npmOnlyPlugins: picks.filter(item => !item.fullName).length,
  archivedOrDisabledRepositories: catalog.items.filter(item => item.archived || item.disabled).length,
  subscriptionLogos: picks.filter(item => item.icon).length,
  repositoryLogos: catalog.items.filter(item => item.icon).length,
  feedBytes: Buffer.byteLength(serialized), gzipBytes: gzipSync(serialized).length, parseAndValidateMs,
  subscriptionSha256: feed.subscription_sha256,
  identityAndOrderMatch: true, installSourcesMatch: true, categoryCountsMatch: true,
}, null, 2))
