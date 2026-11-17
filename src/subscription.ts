/** Adapt the published format-1 subscription without collapsing monorepo packages. */
import type { MarketCategory, MarketFeatured, MarketPlugin } from './contract.ts'
import { isInstallSpec } from './installInfo.ts'
import { isMarketIcon, isSafeVersion, PACKAGE_NAME_PATTERN, REPOSITORY_SLUG_PATTERN } from './shapes.ts'

interface SubscriptionPlugin {
  icon?: unknown
  name?: unknown
  title?: unknown
  description?: unknown
  author?: unknown
  repository?: { url?: unknown }
  metadata?: { category?: unknown; keywords?: unknown; labels?: unknown; sortKeys?: { stars?: unknown; repositoryUpdated?: unknown } }
  versions?: { version?: unknown; source?: { type?: unknown; url?: unknown; commit?: unknown; path?: unknown }; engines?: { dsh?: unknown } }[]
}

function label(value: unknown, language: 'zh' | 'en'): string {
  const localized = value && typeof value === 'object' ? (value as Record<string, unknown>)[language] : value
  return typeof localized === 'string' ? [...localized.replace(/\s+/g, ' ').trim()].slice(0, 400).join('') : ''
}

/** The same category aggregation is used for repositories and subscription plugins. */
export function categoriesOf(items: readonly MarketPlugin[]): MarketCategory[] {
  const groups = new Map<string, MarketCategory>()
  for (const item of items) {
    const previous = groups.get(item.category)
    groups.set(item.category, { key: item.category, zh: item.categoryZh, en: item.categoryEn, count: (previous?.count ?? 0) + 1 })
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
}

export function deriveSubscription(value: unknown, updatedAt: string, repositories: ReadonlyMap<string, MarketPlugin>): MarketFeatured {
  const index = value as { format?: unknown; plugins?: SubscriptionPlugin[]; metadata?: { categories?: Record<string, { title?: unknown }>; labels?: Record<string, { title?: unknown }> } } | undefined
  if (index?.format !== 1 || !Array.isArray(index.plugins) || !index.plugins.length)
    throw new Error('The catalog has no published format-1 subscription plugins')
  const names = new Set<string>()
  const entries = index.plugins.map(plugin => {
    const packageName = typeof plugin.name === 'string' ? plugin.name : ''
    if (!PACKAGE_NAME_PATTERN.test(packageName) || names.has(packageName)) throw new Error('Invalid or duplicate subscription plugin identity')
    names.add(packageName)
    const version = plugin.versions?.[0]
    const source = version?.source
    let install = ''
    if (source?.type === 'npm' && typeof version?.version === 'string' && isSafeVersion(version.version))
      install = `${packageName}@${version.version}`
    if (source?.type === 'git' && typeof source.url === 'string' && typeof source.commit === 'string' && /^[a-f0-9]{40}$/i.test(source.commit))
      install = `${source.url.replace(/\.git$/, '')}#${source.commit}${source.path ? `&path:${String(source.path)}` : ''}`
    if (!install || !isInstallSpec(install)) throw new Error(`Invalid subscription install source for ${packageName}`)
    const repoUrl = typeof plugin.repository?.url === 'string' ? plugin.repository.url : source?.type === 'git' ? source.url : ''
    const repoMatch = typeof repoUrl === 'string' ? repoUrl.match(/^https:\/\/(github\.com|gitee\.com)\/([A-Za-z0-9._-]+\/[A-Za-z0-9._-]+)(?:[\/#?]|$)/) : null
    const fullName = repoMatch?.[2]?.replace(/\.git$/, '') ?? ''
    if (fullName && !REPOSITORY_SLUG_PATTERN.test(fullName)) throw new Error(`Invalid subscription repository for ${packageName}`)
    const known = repoMatch?.[1] === 'github.com' ? repositories.get(fullName.toLowerCase()) : undefined
    const category = typeof plugin.metadata?.category === 'string' ? plugin.metadata.category : 'utilities'
    const categoryTitle = index.metadata?.categories?.[category]?.title
    const titleZh = label(plugin.title, 'zh') || label(plugin.title, 'en') || packageName
    const titleEn = label(plugin.title, 'en') || titleZh
    const description = label(plugin.description, 'zh') || label(plugin.description, 'en')
    const keywords = Array.isArray(plugin.metadata?.keywords) ? plugin.metadata.keywords.filter((word): word is string => typeof word === 'string').slice(0, 100).map(word => label(word, 'zh')) : []
    for (const tag of Array.isArray(plugin.metadata?.labels) ? plugin.metadata.labels : []) {
      if (typeof tag !== 'string') continue
      const title = index.metadata?.labels?.[tag]?.title
      keywords.push(label(title, 'zh'), label(title, 'en'))
    }
    const stars = plugin.metadata?.sortKeys?.stars
    const updated = plugin.metadata?.sortKeys?.repositoryUpdated
    const item: MarketPlugin = {
      ...(typeof plugin.icon === 'string' && isMarketIcon(plugin.icon) ? { icon: plugin.icon } : {}),
      packageName, titleZh, titleEn, descriptionEn: label(plugin.description, 'en') || description,
      keywords: keywords.filter(Boolean),
      fullName, owner: fullName.split('/')[0] || label(plugin.author, 'zh') || 'npm',
      name: packageName, url: repoMatch ? `https://${repoMatch[1]}/${fullName}` : `https://www.npmjs.com/package/${packageName}`,
      description, stars: typeof stars === 'number' && Number.isFinite(stars) && stars >= 0 ? Math.floor(stars) : known?.stars ?? 0,
      language: known?.language ?? '', license: known?.license ?? '',
      pushedAt: typeof updated === 'number' && Number.isFinite(updated) && updated > 0 && updated < 8.64e12 ? new Date(updated * 1000).toISOString() : known?.pushedAt ?? '',
      defaultBranch: known?.defaultBranch ?? 'main',
      category, categoryZh: label(categoryTitle, 'zh') || category, categoryEn: label(categoryTitle, 'en') || category,
      installInfo: { mode: 'command', targets: [{ install, profile: '', note: '' }], tasks: keywords.filter(Boolean).slice(0, 30),
        requirements: typeof version?.engines?.dsh === 'string' ? [`DSH ${version.engines.dsh.length > 1900 ? `${version.engines.dsh.slice(0, 1900)}…` : version.engines.dsh}`] : [], note: '', manual: '' },
    }
    return { item, reason: '' }
  })
  return { titleZh: '订阅精选', titleEn: 'Subscription picks', updatedAt, count: entries.length, entries, categories: categoriesOf(entries.map(entry => entry.item)) }
}
