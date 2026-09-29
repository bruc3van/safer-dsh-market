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
  const haystack = `${item.fullName} ${item.installInfo?.targets.map(t => t.install).join(" ") ?? ""} ${item.installInfo?.tasks.join(" ") ?? ""} ${item.description} ${english ? item.categoryEn : item.categoryZh} ${item.language}`
    .toLocaleLowerCase()
  return query.split(/\s+/).every(word => haystack.includes(word))
}

/**
 * The editorial picks that survive the current query, in the publisher's
 * order. The reason is searched alongside the row's own fields; the pick's
 * category is the picks themselves, so no category filter applies.
 */
export function featuredRows(featured: MarketFeatured | undefined, query: string, english: boolean): readonly MarketFeaturedEntry[] {
  if (featured === undefined) return []
  return featured.entries.filter(entry =>
    matches({ ...entry.item, description: `${entry.item.description} ${entry.reason}` }, query, '', english))
}

/**
 * The rows the All view filters. A pick the shortlist does not carry is still
 * something the market can install, so a search reaches it too; without a
 * query the view stays the shortlist its count names.
 */
export function marketRows(items: readonly MarketPlugin[], featured: MarketFeatured | undefined, query: string): readonly MarketPlugin[] {
  if (query === '' || featured === undefined) return items
  const listed = new Set(items.map(item => item.fullName.toLowerCase()))
  return [...items, ...featured.entries.map(entry => entry.item).filter(item => !listed.has(item.fullName.toLowerCase()))]
}

/** Whether one skill survives the current query. */
export function matchesSkill(skill: MarketSkill, query: string): boolean {
  if (query === '') return true
  const haystack = `${skill.name} ${skill.description} ${skill.whenToUse} ${skill.provider} ${skill.sourceDirectory ?? ''}`.toLocaleLowerCase()
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
