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

/** Sort order for the All catalog view. */
export type MarketSort = 'active' | 'stars' | 'updated'

const DAY_MS = 86_400_000
const ACTIVE_DECAY_DAYS = 30
const ACTIVE_DECAY_EXPONENT = 1.5
const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31
}

function safeStars(stars: number): number {
  return Number.isFinite(stars) && stars > 0 ? stars : 0
}

function parseDayMs(value: string): number {
  const match = ISO_DAY_PATTERN.exec(value)
  if (match !== null) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return Number.NaN
    return Date.UTC(year, month - 1, day)
  }
  return Date.parse(value)
}

function pushedDayOf(value: string): string {
  const match = ISO_DAY_PATTERN.exec(value)
  if (match !== null) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return ''
    return value.slice(0, 10)
  }
  const ms = Date.parse(value)
  if (!Number.isFinite(ms)) return ''
  const date = new Date(ms)
  const year = date.getUTCFullYear()
  if (year < 0 || year > 9999) return ''
  return `${String(year).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

function compareDesc(a: string, b: string): number {
  return a === b ? 0 : b > a ? 1 : -1
}

/** Combine repository stars with update recency, sinking archived or disabled repositories. */
export function activeHeatScore(item: MarketPlugin, referenceMs: number): number {
  const stars = safeStars(item.stars)
  if (item.archived || item.disabled || stars === 0 || !Number.isFinite(referenceMs)) return 0
  const pushedMs = parseDayMs(item.pushedAt)
  if (!Number.isFinite(pushedMs)) return 0
  const ageDays = Math.max(0, (referenceMs - pushedMs) / DAY_MS)
  return stars / ((1 + ageDays / ACTIVE_DECAY_DAYS) ** ACTIVE_DECAY_EXPONENT)
}

/** Sort rows for the All catalog view by active popularity, stars, or update date. */
export function sortMarketRows(items: readonly MarketPlugin[], sort: MarketSort, referenceAt = ''): MarketPlugin[] {
  if (items.length <= 1) return [...items]
  if (sort === 'stars') {
    return items
      .map(item => ({ item, stars: safeStars(item.stars), day: pushedDayOf(item.pushedAt) }))
      .sort((a, b) =>
        b.stars - a.stars
        || compareDesc(a.day, b.day)
        || a.item.fullName.localeCompare(b.item.fullName))
      .map(entry => entry.item)
  }
  if (sort === 'updated') {
    return items
      .map(item => ({ item, stars: safeStars(item.stars), day: pushedDayOf(item.pushedAt) }))
      .sort((a, b) =>
        compareDesc(a.day, b.day)
        || b.stars - a.stars
        || a.item.fullName.localeCompare(b.item.fullName))
      .map(entry => entry.item)
  }
  const parsedRef = referenceAt === '' ? Number.NaN : parseDayMs(referenceAt)
  const referenceMs = Number.isFinite(parsedRef) ? parsedRef : Date.now()
  return items
    .map(item => ({
      item,
      inactive: item.archived || item.disabled ? 1 : 0,
      score: activeHeatScore(item, referenceMs),
      day: pushedDayOf(item.pushedAt),
      stars: safeStars(item.stars),
    }))
    .sort((a, b) =>
      a.inactive - b.inactive
      || b.score - a.score
      || compareDesc(a.day, b.day)
      || b.stars - a.stars
      || a.item.fullName.localeCompare(b.item.fullName))
    .map(entry => entry.item)
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
 * Count how many plugins in the full catalog match the query across all
 * categories, so narrowed scopes can tell the user whether widening to All
 * will yield results.
 */
export function allCatalogMatchCount(
  items: readonly MarketPlugin[],
  featured: MarketFeatured | undefined,
  query: string,
  english: boolean,
): number {
  const rows = marketRows(items, featured, query)
  if (query === '') return rows.length
  let count = 0
  for (const item of rows) {
    if (matches(item, query, '', english)) count += 1
  }
  return count
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
  if (item.bundleEnabled === false) return 'disabled'
  // A bundle whose patch declares no entry rows is neither running nor
  // stopped — installed, with nothing live to report.
  if (item.entries.length === 0) return 'installed'
  if (!item.enabled) return 'disabled'
  if (!item.entries.some(entry => entry.enabled)) return 'installed'
  return item.entries.some(entry => entry.phase === 'failed') ? 'failed' : 'running'
}
