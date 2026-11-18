/**
 * The row rules: which catalog rows a filter keeps, and what an installed
 * row's badge says.
 *
 * A plain module for the same reason {@link ../client/owned.ts | owned.ts} is
 * one — these are decisions, not rendering, and `node --test` cannot import a
 * `.tsx` at all (it strips types but does not transform JSX). Logic that lives
 * beside the markup is logic that can only be checked through a React tree, so
 * it lives here and the section imports it.
 */
import type { MarketFeatured, MarketFeaturedEntry, MarketInstalledPackage, MarketPlugin, MarketSkill } from '../contract.ts'

/**
 * The category chip that selects the installed set instead of a catalog
 * category. The catalog's own keys are slugs from the shortlist, so a value
 * carrying a colon cannot collide with one.
 */
export const INSTALLED_FILTER = 'dsh:installed'

/** Card-state key for a review launched from the shared installation result panel. */
export const SELF_CARD_KEY = 'dsh:self'

/** Card-state key for a review launched from the installed-package view. */
export function installedReviewCardKey(packageName: string): string {
  return `dsh:review:${packageName}`
}

/** `1998` → `2.0k`: a card has room for the magnitude, not the digits. */
export function starCount(stars: number): string {
  if (stars < 1_000) return String(stars)
  return `${(stars / 1_000).toFixed(stars < 10_000 ? 1 : 0)}k`
}

/** Whether one row survives the current query and category filter. */
export function matches(item: MarketPlugin, query: string, category: string, english: boolean): boolean {
  if (category !== '' && item.category !== category) return false
  if (query === '') return true
  const haystack = `${item.fullName} ${item.name} ${item.packageName ?? ''} ${item.titleZh ?? ''} ${item.titleEn ?? ''} ${item.keywords?.join(' ') ?? ''} ${item.installInfo?.targets.map(t => t.install).join(" ") ?? ""} ${item.installInfo?.tasks.join(" ") ?? ""} ${item.description} ${item.descriptionEn ?? ''} ${english ? item.categoryEn : item.categoryZh} ${item.language}`
    .toLocaleLowerCase()
  return query.split(/\s+/).every(word => haystack.includes(word))
}

/**
 * Picks surviving the query and optional subscription category, in published
 * order. Legacy editorial reasons remain searchable alongside row fields.
 */
export function featuredRows(featured: MarketFeatured | undefined, query: string, english: boolean, category = ''): readonly MarketFeaturedEntry[] {
  if (featured === undefined) return []
  return featured.entries.filter(entry =>
    matches({ ...entry.item, description: `${entry.item.description} ${entry.reason}` }, query, category, english))
}

/**
 * The rows the All view filters. A pick the shortlist does not carry is still
 * something the legacy market can install, so a search reaches it too.
 * Schema 3 keeps the repository list distinct from subscription packages.
 */
export function marketRows(items: readonly MarketPlugin[], featured: MarketFeatured | undefined, query: string): readonly MarketPlugin[] {
  if (query === '' || featured === undefined || featured.categories !== undefined) return items
  const listed = new Set(items.map(item => item.fullName.toLowerCase()))
  return [...items, ...featured.entries.map(entry => entry.item).filter(item => !listed.has(item.fullName.toLowerCase()))]
}

/**
 * How a row can be installed, from the same two sources the install button
 * reads: the publisher's `install_status` when the feed carries one (schema 3),
 * otherwise the parsed packages block. A row that claims a command target the
 * wire pass could not validate is treated as uninstallable, never as a
 * clickable install that would fail later.
 */
export function installState(item: MarketPlugin): 'command' | 'manual' | 'none' {
  const status = item.installStatus ?? item.installInfo?.mode ?? 'none'
  if (status === 'manual') return item.installInfo?.mode === 'manual' ? 'manual' : 'none'
  if (status === 'command') {
    return item.installInfo?.mode === 'command' && item.installInfo.targets.length > 0 ? 'command' : 'none'
  }
  return 'none'
}

/** Whether the card offers anything beyond a GitHub link. */
export function hasInstallTarget(item: MarketPlugin): boolean {
  return installState(item) !== 'none'
}

/** Stable card identity across repository and package lists, including monorepos. */
export function marketKey(item: MarketPlugin): string {
  return item.packageName ? `package:${item.packageName}` : `repo:${item.fullName}`
}

/** Paginate a complete result set; filtering and counts always use all results. */
export function pageOf<T>(items: readonly T[], requested: number, size = 50) {
  const pages = Math.max(1, Math.ceil(items.length / size))
  const current = Math.min(requested, pages - 1)
  const offset = current * size
  return { items: items.slice(offset, offset + size), current, pages, total: items.length,
    start: items.length ? offset + 1 : 0, end: Math.min(offset + size, items.length) }
}

/** Whether one skill survives the current query. */
export function matchesSkill(skill: MarketSkill, query: string): boolean {
  if (query === '') return true
  const haystack = `${skill.name} ${skill.description} ${skill.whenToUse} ${skill.provider} ${skill.source ?? ''} ${skill.sourceDirectory ?? ''}`.toLocaleLowerCase()
  return query.split(/\s+/).every(word => haystack.includes(word))
}

/** The status a package row shows, from its own live facts. */
export function stateOf(item: MarketInstalledPackage): 'readFailed' | 'unregistered' | 'disabled' | 'failed' | 'running' | 'installed' {
  if (item.error !== '') return 'readFailed'
  if (item.unregistered) return 'unregistered'
  // A bundle whose patch declares no entry rows is neither running nor
  // stopped — installed, with nothing live to report.
  if (item.entries.length === 0) return 'installed'
  if (!item.enabled) return 'disabled'
  return item.entries.some(entry => entry.phase === 'failed') ? 'failed' : 'running'
}
