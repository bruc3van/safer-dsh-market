/**
 * Pure read-only catalog search, detail lookup, and environment summary for
 * the built-in `dsh_market_pro` Agent tool.
 *
 * All remote catalog fields are third-party untrusted text: every string is
 * normalized and tightly bounded here, and base64 icons are stripped so model
 * context stays small and clean.
 */
import type {
  MarketCatalog,
  MarketInstalledPackage,
  MarketInstalledResult,
  MarketPlugin,
  McpHostContext,
} from './contract.ts'
import { FEATURED_CATEGORY, SUBSCRIPTION_CATEGORY } from './shapes.ts'

export type AiSearchScope = 'all' | 'featured'
export type AiSearchSort = 'relevance' | 'active' | 'stars' | 'updated'
export type AiInstallStatus = 'command' | 'manual' | 'none'
export type AiLang = 'zh' | 'en'

export interface AiInstallTargetSummary {
  readonly install: string
  readonly note?: string
}

export interface AiCatalogEntrySummary {
  readonly fullName: string
  readonly packageName?: string
  readonly name: string
  readonly titleZh?: string
  readonly titleEn?: string
  readonly url?: string
  readonly category: string
  readonly categoryZh?: string
  readonly categoryEn?: string
  readonly stars: number
  readonly pushedAt: string
  readonly language?: string
  readonly license?: string
  readonly archived?: true
  readonly disabled?: true
  readonly featured?: true
  readonly reason?: string
  readonly description: string
  readonly descriptionEn?: string
  readonly installStatus: AiInstallStatus
  readonly installTargets?: readonly AiInstallTargetSummary[]
  readonly hasExtraDetails?: true
  readonly installed: boolean
  readonly installedVersion?: string
}

export interface AiCatalogEntryDetail extends AiCatalogEntrySummary {
  readonly url: string
  readonly defaultBranch: string
  readonly keywords?: readonly string[]
  readonly tasks?: readonly string[]
  readonly requirements?: readonly string[]
  readonly note?: string
  readonly manual?: string
  readonly installedEnabled?: boolean
}

export interface AiSearchOptions {
  readonly query?: string
  readonly queries?: readonly string[]
  readonly category?: string
  readonly scope?: AiSearchScope
  readonly installableOnly?: boolean
  readonly excludeInstalled?: boolean
  readonly includeArchived?: boolean
  readonly lang?: AiLang
  readonly sort?: AiSearchSort
  readonly offset?: number
  readonly limit?: number
}

export interface AiSearchResult {
  readonly total: number
  readonly offset: number
  readonly limit: number
  readonly nextOffset: number | null
  readonly matchMode: 'all' | 'exact' | 'broad'
  readonly stale: boolean
  readonly invalidCategory?: true
  readonly availableCategories?: readonly { readonly key: string; readonly zh: string; readonly en: string }[]
  readonly entries: readonly AiCatalogEntrySummary[]
}

export interface AiOverviewResult {
  readonly profile: string
  readonly fetchedAt: string
  readonly scanned: number
  readonly stale: boolean
  readonly totalRepositories: number
  readonly featuredCount: number
  readonly installableCount: number
  readonly categories: readonly { readonly key: string; readonly zh: string; readonly en: string; readonly count: number }[]
  readonly installedCount: number
  readonly installedPackages: readonly { readonly packageName: string; readonly version: string; readonly enabled: boolean; readonly self?: true }[]
  readonly mcpServerCount: number
  readonly mcpToolCount: number
}

export interface AiEnvironmentResult {
  readonly profile: string
  readonly installedError: string
  readonly installedPackages: readonly {
    readonly packageName: string
    readonly version: string
    readonly enabled: boolean
    readonly repository?: string
    readonly self?: true
    readonly inBox?: true
  }[]
  readonly mcp: {
    readonly managerActive: boolean
    readonly toolGroups: readonly {
      readonly server: string
      readonly toolCount: number
      readonly sampleTools: readonly string[]
    }[]
    readonly unmanagedServers: readonly {
      readonly serverName: string
      readonly transport: string
      readonly enabled: boolean
      readonly phase: string | null
    }[]
    readonly toolsError?: string
  }
}

const DAY_MS = 86_400_000
const ACTIVE_DECAY_DAYS = 30
const ACTIVE_DECAY_EXPONENT = 1.5
const ISO_DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T ])/

export const DEFAULT_AI_LIMIT = 8
export const MAX_AI_LIMIT = 25
export const MAX_AI_QUERIES = 3
export const MAX_AI_DETAIL_TARGETS = 5

/** Zero-width, BiDi override, and Unicode tag-block characters used in invisible prompt injection. */
export const INVISIBLE_INJECTION_PATTERN = /[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\u{e0000}-\u{e007f}]/gu

/**
 * Strip control, zero-width, BiDi override, and Unicode tag-block characters
 * (used for invisible prompt injection), neutralize `<` / `>` so third-party
 * text can never forge or close framing tags like `</untrusted_market_data>`
 * or `</skill_instructions>`, collapse whitespace, and cap length by code point.
 */
export function sanitizeUntrustedText(value: unknown, limit: number): string {
  if (typeof value !== 'string' || Number.isNaN(limit) || limit <= 0) return ''
  const cleaned = value
    .replace(/[\u0000-\u001f\u007f-\u009f]/gu, ' ')
    .replace(INVISIBLE_INJECTION_PATTERN, '')
    .replaceAll('<', '＜')
    .replaceAll('>', '＞')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned === '' || !Number.isFinite(limit)) return cleaned
  const maxLen = Math.floor(limit)
  if (maxLen <= 0) return ''
  const points = [...cleaned]
  return points.length > maxLen ? `${points.slice(0, maxLen - 1).join('')}…` : cleaned
}

function clip(value: unknown, limit: number): string {
  return sanitizeUntrustedText(value, limit)
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31
}

function safeStars(stars: number): number {
  return Number.isFinite(stars) && stars > 0 ? Math.floor(stars) : 0
}

function parseDayMs(value: string): number {
  const match = ISO_DAY_PATTERN.exec(value)
  if (match !== null) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    if (month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)) {
      return Date.UTC(year, month - 1, day)
    }
    return Number.NaN
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

function packageNameFromSpec(spec: string): string {
  const trimmed = spec.trim()
  if (trimmed === '') return ''
  return trimmed.startsWith('@')
    ? trimmed.replace(/^(@[^/]+\/[^@]+)@.+$/, '$1')
    : trimmed.replace(/^([^@/:]+)@.+$/, '$1')
}

function heatScore(item: MarketPlugin, referenceMs: number): number {
  const stars = safeStars(item.stars)
  if (item.archived || item.disabled || stars === 0 || !Number.isFinite(referenceMs)) return 0
  const pushedMs = parseDayMs(item.pushedAt)
  if (!Number.isFinite(pushedMs)) return 0
  const ageDays = Math.max(0, (referenceMs - pushedMs) / DAY_MS)
  return stars / ((1 + ageDays / ACTIVE_DECAY_DAYS) ** ACTIVE_DECAY_EXPONENT)
}

export function installStatusOf(item: MarketPlugin): AiInstallStatus {
  const status = item.installStatus ?? item.installInfo?.mode ?? 'none'
  if (status === 'manual') return item.installInfo?.mode === 'manual' ? 'manual' : 'none'
  if (status === 'command') {
    return item.installInfo?.mode === 'command' && item.installInfo.targets.length > 0 ? 'command' : 'none'
  }
  return 'none'
}

interface InstalledLookup {
  readonly byPackage: ReadonlyMap<string, MarketInstalledPackage>
  readonly byRepo: ReadonlyMap<string, MarketInstalledPackage>
}

function buildInstalledLookup(packages: readonly MarketInstalledPackage[]): InstalledLookup {
  const byPackage = new Map<string, MarketInstalledPackage>()
  const byRepo = new Map<string, MarketInstalledPackage>()
  for (const pkg of packages) {
    if (pkg.error !== '') continue
    byPackage.set(pkg.packageName.toLowerCase(), pkg)
    if (pkg.repository !== '') {
      const repoKey = pkg.repository.toLowerCase()
      if (!byRepo.has(repoKey)) byRepo.set(repoKey, pkg)
    }
  }
  return { byPackage, byRepo }
}

function matchInstalled(lookup: InstalledLookup, item: MarketPlugin): MarketInstalledPackage | undefined {
  if (item.packageName) {
    return lookup.byPackage.get(item.packageName.toLowerCase())
  }
  const targets = item.installInfo?.targets ?? []
  for (const target of targets) {
    const base = packageNameFromSpec(target.install)
    if (base === '') continue
    const found = lookup.byPackage.get(base.toLowerCase())
    if (found !== undefined) return found
  }
  if (item.fullName !== '') {
    return lookup.byRepo.get(item.fullName.toLowerCase())
  }
  return undefined
}

function hasExtraDetailsOf(item: MarketPlugin, maxTargets: number): boolean {
  const info = item.installInfo
  if (info === undefined) return false
  return info.requirements.length > 0
    || info.note.trim() !== ''
    || info.manual.trim() !== ''
    || info.targets.length > maxTargets
}

function toSummary(
  item: MarketPlugin,
  lookup: InstalledLookup,
  featuredReason?: string,
  maxTargets = 2,
  lang?: AiLang,
  isDetail = false,
): AiCatalogEntrySummary {
  const status = installStatusOf(item)
  const owned = matchInstalled(lookup, item)
  const targets = status === 'command' && item.installInfo !== undefined
    ? item.installInfo.targets.slice(0, maxTargets).map(target => {
      const note = clip(target.note, 100)
      return note === '' ? { install: target.install } : { install: target.install, note }
    })
    : undefined
  const titleZh = clip(item.titleZh, 70)
  const titleEn = clip(item.titleEn, 70)
  const descZh = clip(item.description, 200)
  const descEn = clip(item.descriptionEn, 200)
  const reason = clip(featuredReason, 160)
  const language = clip(item.language, 40)
  const license = clip(item.license, 40)
  const category = clip(item.category, 60)
  const categoryZh = clip(item.categoryZh, 50)
  const categoryEn = clip(item.categoryEn, 50)
  const canonicalGithub = item.fullName !== '' && item.url === `https://github.com/${item.fullName}`
  const description = lang === 'en' ? (descEn || descZh) : (descZh || descEn)
  const includeDescEn = lang === undefined && descEn !== '' && descEn !== description
  const includeTitleZh = titleZh !== '' && (lang !== 'en' || titleEn === '')
  const includeTitleEn = titleEn !== '' && (lang !== 'zh' || titleZh === '')
  const includeCategoryZh = categoryZh !== '' && (lang !== 'en' || categoryEn === '')
  const includeCategoryEn = categoryEn !== '' && (lang !== 'zh' || categoryZh === '')
  const hasExtraDetails = !isDetail && hasExtraDetailsOf(item, maxTargets)
  return {
    fullName: item.fullName,
    ...(item.packageName ? { packageName: item.packageName } : {}),
    name: clip(item.name, 70),
    ...(includeTitleZh ? { titleZh } : {}),
    ...(includeTitleEn ? { titleEn } : {}),
    ...(isDetail || !canonicalGithub ? { url: item.url } : {}),
    category,
    ...(includeCategoryZh ? { categoryZh } : {}),
    ...(includeCategoryEn ? { categoryEn } : {}),
    stars: safeStars(item.stars),
    pushedAt: pushedDayOf(item.pushedAt),
    ...(language !== '' ? { language } : {}),
    ...(license !== '' ? { license } : {}),
    ...(item.archived ? { archived: true as const } : {}),
    ...(item.disabled ? { disabled: true as const } : {}),
    ...(featuredReason !== undefined ? { featured: true as const } : {}),
    ...(reason !== '' ? { reason } : {}),
    description,
    ...(includeDescEn ? { descriptionEn: descEn } : {}),
    installStatus: status,
    ...(targets !== undefined && targets.length > 0 ? { installTargets: targets } : {}),
    ...(hasExtraDetails ? { hasExtraDetails: true as const } : {}),
    installed: owned !== undefined,
    ...(owned !== undefined && owned.version !== '' ? { installedVersion: clip(owned.version, 60) } : {}),
  }
}

const CJK_CHAR = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u
const CJK_RUN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+/gu
const CJK_SPLIT = /([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+)/u
const ALNUM_CHAR = /[\p{L}\p{N}]/u

function cjkBigrams(term: string): string[] {
  const grams = new Set<string>()
  for (const run of term.match(CJK_RUN) ?? []) {
    const chars = [...run]
    if (chars.length < 3) continue
    for (let i = 0; i < chars.length - 1; i += 1) {
      grams.add(`${chars[i]!}${chars[i + 1]!}`)
    }
  }
  return [...grams].slice(0, 12)
}

function tokenizeQuery(query: string): string[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (normalized === '') return []
  const tokens: string[] = []
  const seen = new Set<string>()
  const push = (token: string): void => {
    if (token === '' || seen.has(token)) return
    seen.add(token)
    tokens.push(token)
  }
  for (const chunk of normalized.split(/[\s,，、;；/]+/)) {
    if (chunk === '') continue
    if (!CJK_CHAR.test(chunk)) {
      push(chunk)
      continue
    }
    for (const part of chunk.split(CJK_SPLIT)) {
      if (part === '') continue
      if (CJK_CHAR.test(part)) {
        push(part)
      } else {
        const trimmed = part.replace(/^[-_.:：·・()（）【】[\]]+|[-_.:：·・()（）【】[\]]+$/g, '')
        if (trimmed !== '' && ALNUM_CHAR.test(trimmed)) push(trimmed)
      }
    }
  }
  return tokens.slice(0, 12)
}

interface CandidateRow {
  readonly item: MarketPlugin
  readonly featuredReason?: string
}

function candidateIdentity(item: MarketPlugin): string {
  if (item.packageName) return `package:${item.packageName.toLowerCase()}`
  if (item.fullName !== '') return `repo:${item.fullName.toLowerCase()}`
  return ''
}

function mergeFeaturedWithRepoRow(
  featuredItem: MarketPlugin,
  repoRow: MarketPlugin,
  preferRepoCategory: boolean,
): MarketPlugin {
  const featuredHasInstall = installStatusOf(featuredItem) !== 'none'
  const repoHasInstall = installStatusOf(repoRow) !== 'none'
  const installInfo = featuredHasInstall
    ? featuredItem.installInfo
    : repoHasInstall
      ? repoRow.installInfo
      : (featuredItem.installInfo ?? repoRow.installInfo)
  const installStatus = featuredHasInstall
    ? (featuredItem.installStatus ?? featuredItem.installInfo?.mode)
    : repoHasInstall
      ? (repoRow.installStatus ?? repoRow.installInfo?.mode)
      : (featuredItem.installStatus ?? repoRow.installStatus)
  const mergedKeywords = featuredItem.keywords !== undefined || repoRow.keywords !== undefined
    ? [...new Set([...(featuredItem.keywords ?? []), ...(repoRow.keywords ?? [])])]
    : undefined
  const useRepoCategory = repoRow.category !== '' && (
    preferRepoCategory
    || featuredItem.category === ''
    || featuredItem.category === FEATURED_CATEGORY
    || featuredItem.category === SUBSCRIPTION_CATEGORY
  )
  const packageName = featuredItem.packageName || repoRow.packageName
  const titleZh = featuredItem.titleZh || repoRow.titleZh
  const titleEn = featuredItem.titleEn || repoRow.titleEn
  const descriptionEn = featuredItem.descriptionEn || repoRow.descriptionEn
  const archived = featuredItem.archived || repoRow.archived
  const disabled = featuredItem.disabled || repoRow.disabled
  return {
    ...repoRow,
    ...featuredItem,
    fullName: featuredItem.fullName !== '' ? featuredItem.fullName : repoRow.fullName,
    owner: featuredItem.owner !== '' ? featuredItem.owner : repoRow.owner,
    name: featuredItem.name !== '' ? featuredItem.name : repoRow.name,
    url: featuredItem.url !== '' ? featuredItem.url : repoRow.url,
    stars: safeStars(featuredItem.stars) > 0 ? featuredItem.stars : repoRow.stars,
    pushedAt: featuredItem.pushedAt !== '' ? featuredItem.pushedAt : repoRow.pushedAt,
    language: featuredItem.language !== '' ? featuredItem.language : repoRow.language,
    license: featuredItem.license !== '' ? featuredItem.license : repoRow.license,
    defaultBranch: featuredItem.defaultBranch !== '' ? featuredItem.defaultBranch : repoRow.defaultBranch,
    category: useRepoCategory ? repoRow.category : featuredItem.category,
    categoryZh: useRepoCategory ? repoRow.categoryZh : featuredItem.categoryZh,
    categoryEn: useRepoCategory ? repoRow.categoryEn : featuredItem.categoryEn,
    description: featuredItem.description !== '' ? featuredItem.description : repoRow.description,
    ...(packageName ? { packageName } : {}),
    ...(titleZh ? { titleZh } : {}),
    ...(titleEn ? { titleEn } : {}),
    ...(descriptionEn ? { descriptionEn } : {}),
    ...(installInfo !== undefined ? { installInfo } : {}),
    ...(installStatus !== undefined ? { installStatus } : {}),
    ...(mergedKeywords !== undefined ? { keywords: mergedKeywords } : {}),
    ...(archived ? { archived: true } : {}),
    ...(disabled ? { disabled: true } : {}),
  }
}

function buildFeaturedPool(catalog: MarketCatalog): CandidateRow[] {
  if (catalog.featured === undefined) return []
  const repoByFullName = new Map<string, MarketPlugin>()
  for (const item of catalog.items) {
    const key = item.fullName.toLowerCase()
    if (key !== '' && !repoByFullName.has(key)) repoByFullName.set(key, item)
  }
  return catalog.featured.entries.map((entry) => {
    const repoKey = entry.item.fullName.toLowerCase()
    const repoRow = repoKey !== '' ? repoByFullName.get(repoKey) : undefined
    return {
      item: repoRow !== undefined ? mergeFeaturedWithRepoRow(entry.item, repoRow, false) : entry.item,
      featuredReason: entry.reason,
    }
  })
}

function buildAllCatalogPool(catalog: MarketCatalog): CandidateRow[] {
  const featuredEntries = catalog.featured?.entries ?? []
  const featuredByRepo = new Map<string, { item: MarketPlugin; reason: string }[]>()
  for (const entry of featuredEntries) {
    const repoKey = entry.item.fullName.toLowerCase()
    if (repoKey === '') continue
    const list = featuredByRepo.get(repoKey)
    if (list !== undefined) list.push(entry)
    else featuredByRepo.set(repoKey, [entry])
  }

  const pool: CandidateRow[] = []
  const seenKeys = new Set<string>()
  const consumed = new Set<{ item: MarketPlugin; reason: string }>()

  const pushUnique = (row: CandidateRow): void => {
    const key = candidateIdentity(row.item)
    if (key !== '' && seenKeys.has(key)) return
    if (key !== '') seenKeys.add(key)
    pool.push(row)
  }

  for (const repoRow of catalog.items) {
    const repoKey = repoRow.fullName.toLowerCase()
    const picks = repoKey !== '' ? featuredByRepo.get(repoKey) : undefined
    if (picks === undefined || picks.length === 0) {
      pushUnique({ item: repoRow })
      continue
    }
    for (const pick of picks) {
      consumed.add(pick)
      pushUnique({
        item: mergeFeaturedWithRepoRow(pick.item, repoRow, true),
        featuredReason: pick.reason,
      })
    }
    if (repoRow.packageName) {
      pushUnique({ item: repoRow })
    }
  }

  for (const entry of featuredEntries) {
    if (consumed.has(entry)) continue
    pushUnique({ item: entry.item, featuredReason: entry.reason })
  }

  return pool
}

function scoreCandidate(row: CandidateRow, terms: readonly string[], fullQuery: string): { matchedCount: number; exactTerms: number; score: number } {
  const { item, featuredReason } = row
  const fullName = item.fullName.toLocaleLowerCase()
  const pkg = (item.packageName ?? '').toLocaleLowerCase()
  const name = item.name.toLocaleLowerCase()
  const titles = `${item.titleZh ?? ''} ${item.titleEn ?? ''}`.toLocaleLowerCase()
  const keywords = (item.keywords ?? []).join(' ').toLocaleLowerCase()
  const targets = (item.installInfo?.targets.map(t => t.install).join(' ') ?? '').toLocaleLowerCase()
  const prose = `${item.description} ${item.descriptionEn ?? ''} ${featuredReason ?? ''} ${item.installInfo?.tasks.join(' ') ?? ''}`.toLocaleLowerCase()
  const meta = `${item.category} ${item.categoryZh} ${item.categoryEn} ${item.language}`.toLocaleLowerCase()
  const combinedText = `${titles} ${keywords} ${prose} ${meta}`

  let matchedCount = 0
  let exactTerms = 0
  let score = 0

  if (fullQuery !== '' && (pkg === fullQuery || fullName === fullQuery || name === fullQuery)) {
    score += 140
  }

  for (const term of terms) {
    let best = 0
    if (pkg === term || fullName === term || name === term) best = 90
    else if (pkg.includes(term) || fullName.includes(term) || name.includes(term)) best = 50
    else if (titles.includes(term)) best = 45
    else if (keywords.includes(term) || targets.includes(term)) best = 30
    else if (prose.includes(term)) best = 16
    else if (meta.includes(term)) best = 10
    if (best > 0) {
      matchedCount += 1
      exactTerms += 1
      score += best
      continue
    }
    // CJK 2-gram fallback so natural Chinese phrases like "画架构图" match "Draw.io 流程图与架构图".
    const grams = cjkBigrams(term)
    if (grams.length > 0) {
      let gramHits = 0
      let titleHits = 0
      for (const gram of grams) {
        if (titles.includes(gram)) {
          gramHits += 1
          titleHits += 1
        } else if (combinedText.includes(gram)) {
          gramHits += 1
        }
      }
      if (gramHits > 0 && (gramHits >= 2 || gramHits / grams.length >= 0.34)) {
        matchedCount += 1
        score += Math.round((gramHits / grams.length) * (titleHits > 0 ? 24 : 14))
      }
    }
  }

  if (matchedCount > 0) {
    if (featuredReason !== undefined) score += 16
    if (installStatusOf(item) === 'command') score += 10
    if (item.archived || item.disabled) score -= 50
  }
  return { matchedCount, exactTerms, score }
}

function normalizePage(offset: number | undefined, limit: number | undefined): { offset: number; limit: number } {
  const resolvedOffset = offset ?? 0
  const resolvedLimit = limit ?? DEFAULT_AI_LIMIT
  if (!Number.isInteger(resolvedOffset) || resolvedOffset < 0) {
    throw new Error('offset must be a non-negative integer')
  }
  if (!Number.isInteger(resolvedLimit) || resolvedLimit < 1 || resolvedLimit > MAX_AI_LIMIT) {
    throw new Error(`limit must be an integer from 1 to ${MAX_AI_LIMIT}`)
  }
  return { offset: resolvedOffset, limit: resolvedLimit }
}

/** Build a compact index of catalog statistics, categories, and installed status. */
export function buildAiOverview(
  catalog: MarketCatalog,
  stale: boolean,
  installed: MarketInstalledResult,
  mcp: McpHostContext,
  profile: string,
): AiOverviewResult {
  let installableCount = 0
  for (const row of buildAllCatalogPool(catalog)) {
    if (installStatusOf(row.item) === 'command') installableCount += 1
  }
  const categories = catalog.categories
    .filter(entry => entry.key !== FEATURED_CATEGORY && entry.key !== SUBSCRIPTION_CATEGORY)
    .map(entry => ({ key: clip(entry.key, 60), zh: clip(entry.zh, 50), en: clip(entry.en, 50), count: entry.count }))
  const mcpToolCount = mcp.tools.reduce((sum, group) => sum + group.tools.length, 0)
  const serverNames = new Set([
    ...mcp.tools.map(group => group.server),
    ...mcp.unmanaged.map(server => server.serverName).filter(name => name !== ''),
  ])
  return {
    profile: clip(profile, 80),
    fetchedAt: clip(catalog.fetchedAt, 64),
    scanned: catalog.scanned,
    stale,
    totalRepositories: catalog.items.length,
    featuredCount: catalog.featured?.entries.length ?? 0,
    installableCount,
    categories,
    installedCount: installed.packages.length,
    installedPackages: installed.packages.slice(0, 50).map(pkg => ({
      packageName: clip(pkg.packageName, 120),
      version: clip(pkg.version, 60),
      enabled: pkg.enabled,
      ...(pkg.self ? { self: true as const } : {}),
    })),
    mcpServerCount: serverNames.size,
    mcpToolCount,
  }
}

interface SortKey {
  readonly inactive: number
  readonly heat: number
  readonly day: string
  readonly stars: number
  readonly tieKey: string
}

function sortKeyOf(item: MarketPlugin, sort: AiSearchSort, referenceMs: number): SortKey {
  const tieKey = item.packageName
    ? `${item.fullName}\0${item.packageName}`
    : (item.fullName || item.name)
  return {
    inactive: item.archived || item.disabled ? 1 : 0,
    heat: sort === 'active' ? heatScore(item, referenceMs) : 0,
    day: pushedDayOf(item.pushedAt),
    stars: safeStars(item.stars),
    tieKey,
  }
}

function compareSortKeys(left: SortKey, right: SortKey, sort: AiSearchSort): number {
  const dayCmp = left.day === right.day ? 0 : right.day > left.day ? 1 : -1
  if (sort === 'stars') {
    return right.stars - left.stars || dayCmp || left.tieKey.localeCompare(right.tieKey)
  }
  if (sort === 'updated') {
    return dayCmp || right.stars - left.stars || left.tieKey.localeCompare(right.tieKey)
  }
  return left.inactive - right.inactive
    || right.heat - left.heat
    || dayCmp
    || right.stars - left.stars
    || left.tieKey.localeCompare(right.tieKey)
}

/** Search curated picks or the complete catalog with weighted relevance, CJK 2-gram fallback, and multi-query merging. */
export function searchAiCatalog(
  catalog: MarketCatalog,
  stale: boolean,
  installedPackages: readonly MarketInstalledPackage[],
  options: AiSearchOptions = {},
): AiSearchResult {
  const { offset, limit } = normalizePage(options.offset, options.limit)
  const scope: AiSearchScope = options.scope ?? 'all'
  const category = (options.category ?? '').trim().toLocaleLowerCase()
  const installableOnly = options.installableOnly === true
  const excludeInstalled = options.excludeInstalled === true
  const includeArchived = options.includeArchived === true
  const lang = options.lang
  const seenQueries = new Set<string>()
  const queryPlans: { readonly raw: string; readonly terms: readonly string[] }[] = []
  for (const candidate of [
    ...(typeof options.query === 'string' ? [options.query] : []),
    ...(Array.isArray(options.queries) ? options.queries : []),
  ]) {
    const raw = candidate.trim().toLocaleLowerCase()
    if (raw === '' || seenQueries.has(raw)) continue
    const terms = tokenizeQuery(raw)
    if (terms.length === 0) continue
    seenQueries.add(raw)
    queryPlans.push({ raw, terms })
    if (queryPlans.length >= MAX_AI_QUERIES) break
  }
  const sort: AiSearchSort = options.sort ?? (queryPlans.length > 0 ? 'relevance' : 'active')
  const lookup = buildInstalledLookup(installedPackages)

  const pool = scope === 'featured' ? buildFeaturedPool(catalog) : buildAllCatalogPool(catalog)

  const filtered = pool.filter(({ item }) => {
    if (!includeArchived && (item.archived || item.disabled)) return false
    if (installableOnly && installStatusOf(item) !== 'command') return false
    if (excludeInstalled && matchInstalled(lookup, item) !== undefined) return false
    if (category !== '') {
      const cat = item.category.toLocaleLowerCase()
      const catZh = item.categoryZh.toLocaleLowerCase()
      const catEn = item.categoryEn.toLocaleLowerCase()
      if (cat !== category && catZh !== category && catEn !== category) return false
    }
    return true
  })

  const availableCategories = catalog.categories
    .filter(entry => entry.key !== FEATURED_CATEGORY && entry.key !== SUBSCRIPTION_CATEGORY)
    .map(entry => ({ key: clip(entry.key, 60), zh: clip(entry.zh, 50), en: clip(entry.en, 50) }))
  const categoryKnown = category === '' || availableCategories.some(entry =>
    entry.key.toLocaleLowerCase() === category
    || entry.zh.toLocaleLowerCase() === category
    || entry.en.toLocaleLowerCase() === category)

  const parsedRef = catalog.fetchedAt === '' ? Number.NaN : parseDayMs(catalog.fetchedAt)
  const referenceMs = Number.isFinite(parsedRef) ? parsedRef : Date.now()
  const tieSort: AiSearchSort = sort === 'relevance' ? 'active' : sort

  if (queryPlans.length === 0) {
    const ordered = scope === 'featured' && options.sort === undefined
      ? filtered
      : filtered
        .map(row => ({ row, key: sortKeyOf(row.item, tieSort, referenceMs) }))
        .sort((left, right) => compareSortKeys(left.key, right.key, tieSort))
        .map(entry => entry.row)
    const slice = ordered.slice(offset, offset + limit)
    const next = offset + slice.length
    return {
      total: ordered.length,
      offset,
      limit,
      nextOffset: next < ordered.length ? next : null,
      matchMode: 'all',
      stale,
      ...(filtered.length === 0 && !categoryKnown ? { invalidCategory: true as const, availableCategories } : {}),
      entries: slice.map(row => toSummary(row.item, lookup, row.featuredReason, 2, lang)),
    }
  }

  const exactMatches: { row: CandidateRow; score: number; exactTerms: number; key: SortKey }[] = []
  const broadMatches: { row: CandidateRow; matchedCount: number; score: number; key: SortKey }[] = []
  for (const row of filtered) {
    let bestExactScore = Number.NEGATIVE_INFINITY
    let bestExactTerms = 0
    let bestBroadMatched = 0
    let bestBroadScore = Number.NEGATIVE_INFINITY
    for (const plan of queryPlans) {
      const { matchedCount, exactTerms, score } = scoreCandidate(row, plan.terms, plan.raw)
      if (matchedCount === plan.terms.length) {
        if (score > bestExactScore || (score === bestExactScore && exactTerms > bestExactTerms)) {
          bestExactScore = score
          bestExactTerms = exactTerms
        }
      } else if (matchedCount > 0 && plan.terms.length > 1) {
        if (matchedCount > bestBroadMatched || (matchedCount === bestBroadMatched && score > bestBroadScore)) {
          bestBroadMatched = matchedCount
          bestBroadScore = score
        }
      }
    }
    if (bestExactScore > Number.NEGATIVE_INFINITY) {
      exactMatches.push({ row, score: bestExactScore, exactTerms: bestExactTerms, key: sortKeyOf(row.item, tieSort, referenceMs) })
    } else if (bestBroadMatched > 0) {
      broadMatches.push({ row, matchedCount: bestBroadMatched, score: bestBroadScore, key: sortKeyOf(row.item, tieSort, referenceMs) })
    }
  }

  const useBroad = exactMatches.length === 0 && broadMatches.length > 0
  const ranked = useBroad
    ? broadMatches.sort((a, b) =>
      b.matchedCount - a.matchedCount
      || (sort === 'relevance' ? b.score - a.score : 0)
      || compareSortKeys(a.key, b.key, tieSort))
    : exactMatches.sort((a, b) =>
      (sort === 'relevance' ? (b.score - a.score || b.exactTerms - a.exactTerms) : 0)
      || compareSortKeys(a.key, b.key, tieSort))

  const slice = ranked.slice(offset, offset + limit)
  const next = offset + slice.length
  return {
    total: ranked.length,
    offset,
    limit,
    nextOffset: next < ranked.length ? next : null,
    matchMode: useBroad ? 'broad' : 'exact',
    stale,
    ...(filtered.length === 0 && !categoryKnown ? { invalidCategory: true as const, availableCategories } : {}),
    entries: slice.map(entry => toSummary(entry.row.item, lookup, entry.row.featuredReason, 2, lang)),
  }
}

function matchesExactIdentity(item: MarketPlugin, key: string): boolean {
  return (item.fullName !== '' && item.fullName.toLowerCase() === key)
    || (item.packageName !== undefined && item.packageName.toLowerCase() === key)
}

function matchesInstallTarget(item: MarketPlugin, key: string): boolean {
  return item.installInfo?.targets.some((target) => {
    const spec = target.install.toLowerCase()
    return spec === key || packageNameFromSpec(spec) === key
  }) ?? false
}

/** Look up one catalog entry by `owner/repo` or `packageName` with complete bounded metadata. */
export function lookupAiCatalogDetail(
  catalog: MarketCatalog,
  installedPackages: readonly MarketInstalledPackage[],
  target: string,
  lang?: AiLang,
): AiCatalogEntryDetail | null {
  const key = target.trim().toLowerCase()
  if (key === '') return null
  const lookup = buildInstalledLookup(installedPackages)

  const featuredEntries = catalog.featured?.entries ?? []
  const featuredMatch = featuredEntries.find(entry => matchesExactIdentity(entry.item, key))
    ?? featuredEntries.find(entry => matchesInstallTarget(entry.item, key))

  let matchedItem: MarketPlugin | undefined
  let featuredReason: string | undefined

  if (featuredMatch !== undefined) {
    featuredReason = featuredMatch.reason
    const repoKey = featuredMatch.item.fullName.toLowerCase()
    const pkgKey = featuredMatch.item.packageName?.toLowerCase() ?? ''
    const catalogRow = repoKey !== ''
      ? catalog.items.find(item => item.fullName.toLowerCase() === repoKey)
      : pkgKey !== ''
        ? catalog.items.find(item => item.packageName?.toLowerCase() === pkgKey)
        : undefined
    matchedItem = catalogRow !== undefined
      ? mergeFeaturedWithRepoRow(featuredMatch.item, catalogRow, false)
      : featuredMatch.item
  } else {
    const catalogRow = catalog.items.find(item => matchesExactIdentity(item, key))
      ?? catalog.items.find(item => matchesInstallTarget(item, key))
    if (catalogRow !== undefined) {
      const pkgKey = catalogRow.packageName?.toLowerCase() ?? ''
      const repoKey = catalogRow.fullName.toLowerCase()
      const linkedFeatured = (pkgKey !== ''
        ? featuredEntries.find(entry => entry.item.packageName?.toLowerCase() === pkgKey)
        : undefined)
        ?? (repoKey !== ''
          ? (() => {
              const sameRepo = featuredEntries.filter(entry => entry.item.fullName.toLowerCase() === repoKey)
              return sameRepo.length === 1 ? sameRepo[0] : undefined
            })()
          : undefined)
      if (linkedFeatured !== undefined) {
        matchedItem = mergeFeaturedWithRepoRow(linkedFeatured.item, catalogRow, false)
        featuredReason = linkedFeatured.reason
      } else {
        matchedItem = catalogRow
      }
    }
  }

  if (matchedItem === undefined) return null

  const summary = toSummary(matchedItem, lookup, featuredReason, 10, lang, true)
  const owned = matchInstalled(lookup, matchedItem)
  const keywords = matchedItem.keywords?.map(word => clip(word, 50)).filter(word => word !== '').slice(0, 15)
  const tasks = matchedItem.installInfo?.tasks.map(task => clip(task, 120)).filter(task => task !== '').slice(0, 8)
  const requirements = matchedItem.installInfo?.requirements.map(req => clip(req, 120)).filter(req => req !== '').slice(0, 8)
  const note = clip(matchedItem.installInfo?.note, 220)
  const manual = clip(matchedItem.installInfo?.manual, 300)

  return {
    ...summary,
    url: matchedItem.url,
    defaultBranch: matchedItem.defaultBranch,
    ...(keywords !== undefined && keywords.length > 0 ? { keywords } : {}),
    ...(tasks !== undefined && tasks.length > 0 ? { tasks } : {}),
    ...(requirements !== undefined && requirements.length > 0 ? { requirements } : {}),
    ...(note !== '' ? { note } : {}),
    ...(manual !== '' ? { manual } : {}),
    ...(owned !== undefined ? { installedEnabled: owned.enabled } : {}),
  }
}

/** Batch detail lookup for up to MAX_AI_DETAIL_TARGETS items in one round-trip. */
export function lookupAiCatalogDetails(
  catalog: MarketCatalog,
  installedPackages: readonly MarketInstalledPackage[],
  targets: readonly string[],
  lang?: AiLang,
): { readonly entries: readonly AiCatalogEntryDetail[]; readonly notFound: readonly string[] } {
  const entries: AiCatalogEntryDetail[] = []
  const notFound: string[] = []
  const seenInputs = new Set<string>()
  const seenIdentities = new Set<string>()
  let processed = 0
  for (const raw of targets) {
    const trimmed = raw.trim()
    if (trimmed === '') continue
    const dedup = trimmed.toLowerCase()
    if (seenInputs.has(dedup)) continue
    seenInputs.add(dedup)
    processed += 1
    if (processed > MAX_AI_DETAIL_TARGETS) break
    const found = lookupAiCatalogDetail(catalog, installedPackages, trimmed, lang)
    if (found !== null) {
      const identity = found.packageName
        ? `package:${found.packageName.toLowerCase()}`
        : found.fullName !== ''
          ? `repo:${found.fullName.toLowerCase()}`
          : ''
      if (identity === '' || !seenIdentities.has(identity)) {
        if (identity !== '') seenIdentities.add(identity)
        entries.push(found)
      }
    } else {
      notFound.push(clip(trimmed, 120))
    }
  }
  return { entries, notFound }
}

/** Build a secret-free, sanitized summary of installed plugins and MCP servers in this profile. */
export function buildAiEnvironment(
  profile: string,
  installed: MarketInstalledResult,
  mcp: McpHostContext,
): AiEnvironmentResult {
  return {
    profile: clip(profile, 80),
    installedError: clip(installed.error, 200),
    installedPackages: installed.packages.slice(0, 100).map(pkg => ({
      packageName: clip(pkg.packageName, 120),
      version: clip(pkg.version, 60),
      enabled: pkg.enabled,
      ...(pkg.repository !== '' ? { repository: clip(pkg.repository, 140) } : {}),
      ...(pkg.self ? { self: true as const } : {}),
      ...(pkg.inBox ? { inBox: true as const } : {}),
    })),
    mcp: {
      managerActive: mcp.managerActive,
      toolGroups: mcp.tools.slice(0, 40).map(group => ({
        server: clip(group.server, 80),
        toolCount: group.tools.length,
        sampleTools: group.tools.slice(0, 8).map(tool => clip(tool.name, 80)),
      })),
      unmanagedServers: mcp.unmanaged.slice(0, 40).map(server => ({
        serverName: clip(server.serverName, 80),
        transport: server.transport,
        enabled: server.enabled,
        phase: server.phase,
      })),
      ...(mcp.toolsError !== '' ? { toolsError: clip(mcp.toolsError, 200) } : {}),
    },
  }
}
