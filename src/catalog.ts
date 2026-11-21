/** Read the full catalog and published subscription (or a legacy v2 feed).
 * Remote metadata is validated before entering the client wire contract.
 */
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib'
import { parseInstallInfo } from './installInfo.ts'
import type { MarketCatalog, MarketCategory, MarketFeatured, MarketFeaturedEntry, MarketPlugin } from './contract.ts'
import { FEATURED_CATEGORY, SUBSCRIPTION_CATEGORY, isMarketIcon, isSafeBranchName, REPOSITORY_SLUG_PATTERN } from './shapes.ts'
import { categoriesOf, deriveSubscription } from './subscription.ts'
import { extractFileFromTgzResponse } from './tarball.ts'

/** Default feed and mirrors (including China-reachable npmmirror tarball) serve the same npm package dataset. */
export const DEFAULT_CATALOG_BASE = 'https://cdn.jsdelivr.net/npm/awesome-dsh-plugin-feed@latest/data/market-catalog-v4.json'
export const CN_MIRROR_CATALOG_BASE = 'https://registry.npmmirror.com/awesome-dsh-plugin-feed/latest'
export const MIRROR_CATALOG_BASE = 'https://unpkg.com/awesome-dsh-plugin-feed@latest/data/market-catalog-v4.json'

const LEGACY_CN_MIRROR_FILES_PREFIX = 'https://registry.npmmirror.com/awesome-dsh-plugin-feed/latest/files/data/'
const TARBALL_CATALOG_PATHS = ['package/data/market-catalog-v4.json', 'package/data/market-catalog.json'] as const
const NPMMIRROR_ETAG_PREFIX = 'npmmirror:'

/** Start the next mirror concurrently if the leading source has not answered within this window. */
const DEFAULT_HEDGE_DELAY_MS = 3_000

/** The market is refreshed daily upstream; asking more often than this is noise. */
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1_000

/** Back off automatic background revalidation briefly after a failure so offline reads stay quiet. */
const BACKGROUND_RETRY_MS = 60 * 1_000

/** One attempt against one base; a chain of three costs at most three times this. */
const FETCH_TIMEOUT_MS = 20_000

/** Bound both the response stream and decompression. The compact v4 feed is ~11.6 MiB. */
const MAX_CATALOG_BYTES = 64 * 1024 * 1024

/** unpkg and npmmirror answer every `@latest` path with a 302; a few more hops is already a loop. */
const MAX_REDIRECTS = 5

/** A description longer than this is a README pasted into the field, not a summary. */
const DESCRIPTION_LIMIT = 300

/** A card title is a name, not a sentence — the publisher caps it at 60. */
const TITLE_LIMIT = 60

const SCHEMA_VERSION = 2

/**
 * The shape {@link deriveMarket} produces. A stored catalog records the
 * format it was derived under, and the cache gate refuses any other: a
 * revalidation only asks whether the FEED changed, so after an upgrade that
 * changes the parse a 304 would keep serving the old build's reduction
 * forever. Bump this whenever the derived catalog gains or changes a field.
 * 1 — before the editorial picks; 2 — `featured`; 3 — inline pick descriptions;
 * 4 — v2-only feeds; 5 — complete catalogs and package-identified subscriptions;
 * 6 — up to 100 editorial picks with their own category totals;
 * 7 — schema-4 compact feed support, subscription icon/keyword hydration, and npmmirror failover.
 * 8 — the editorial pick cap grows from 100 to 1000.
 */
export const CATALOG_FORMAT = 8

/** The editorial list is capped. Published subscription packages are not. */
const FEATURED_LIMIT = 1000

/** A pick's reason is one sentence, not a second description. */
const REASON_LIMIT = 200

/** One published entry (schema 2/3 full keys or schema 4 compact keys), before the wire pass. */
interface RawEntry {
  icon?: unknown
  keywords?: unknown
  archived?: unknown
  disabled?: unknown
  packages?: unknown
  install_status?: unknown
  title_zh?: unknown
  title_en?: unknown
  description_en?: unknown
  full_name?: unknown
  description?: unknown
  stargazers_count?: unknown
  language?: unknown
  license?: unknown
  pushed_at?: unknown
  default_branch?: unknown
  category?: unknown
  category_zh?: unknown
  category_en?: unknown
  // Schema 4 compact keys
  n?: unknown
  d?: unknown
  s?: unknown
  c?: unknown
  p?: unknown
  l?: unknown
  lic?: unknown
  b?: unknown
  is?: unknown
  pkg?: unknown
  tz?: unknown
  te?: unknown
  de?: unknown
  ar?: unknown
  di?: unknown
}

/** The envelope's editorial section, before the wire pass. */
interface RawFeatured {
  title_zh?: unknown
  title_en?: unknown
  updated_at?: unknown
  entries?: unknown
}

/** One editorial pick. `packages` is present only for a pick the shortlist lacks. */
interface RawFeaturedEntry {
  full_name?: unknown
  description?: unknown
  reason?: unknown
  packages?: unknown
}

/**
 * Where a parsed catalog survives a restart. The catalog source neither opens
 * nor closes this — the plugin body owns the domain's lifecycle and hands the
 * source a narrow port, so a deployment without durable storage can still run
 * the market from memory alone.
 */
export interface CatalogCache {
  /**
   * The last parse, the ETag it was derived with, and the base that served
   * it. A record written before the mirror existed has no serving base; the
   * empty string reads as "the primary answered" (see `attempt` below).
   */
  read: () => { catalog: MarketCatalog | null; marketEtag: string; activeBase: string }
  /** Persist a fresh parse. Failures are the cache's own business. */
  write: (next: { catalog: MarketCatalog; marketEtag: string; activeBase: string }) => void
  /** Resolves once the backing durable store has finished loading (or degraded to memory-only). */
  ready?: Promise<void>
}

/** Deployment-varying knobs the plugin config owns. */
export interface CatalogOptions {
  /** A complete schema-3 catalog or legacy schema-2 JSON feed URL. */
  readonly base: string
  /** Legacy schema-2 size limit; schema 3 is never truncated. */
  readonly marketSize: number
  /** Durable seat for the parse; absent means memory-only. */
  readonly cache?: CatalogCache
  /** Aborted when the owning plugin tears down, cancelling in-flight background refreshes. */
  readonly disposeSignal?: AbortSignal
  /** Delay before launching the next mirror concurrently during multi-source failover. */
  readonly hedgeDelayMs?: number
}

/**
 * Drop the redundant `subscription` payload when an editorial `featured` list
 * is already present. The client never renders `subscription` separately, so
 * omitting it trims ~6 MiB from disk persistence, startup validation, and RPC.
 */
export function stripUnusedSubscription(catalog: MarketCatalog): MarketCatalog {
  if (catalog.featured === undefined || catalog.subscription === undefined) return catalog
  const { subscription: _unused, ...rest } = catalog
  return {
    ...rest,
    categories: catalog.categories.filter(entry => entry.key !== SUBSCRIPTION_CATEGORY),
  }
}

function text(value: unknown, limit: number): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.replace(/\s+/g, ' ').trim()
  // Cut by code point, not by UTF-16 unit, so a limit landing inside a
  // surrogate pair cannot leave a lone half behind.
  const points = [...trimmed]
  return points.length > limit ? `${points.slice(0, limit - 1).join('')}…` : trimmed
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0
}

/** `owner/name` with nothing else in it — the only shape a link is built from. */
function repositorySlug(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return REPOSITORY_SLUG_PATTERN.test(value) ? value : null
}

/**
 * The branch the prompt's tarball fallback names. Remote text from a public
 * snapshot: anything outside the safe pattern (which excludes whitespace and
 * every prompt-injection character) falls back to `main` rather than being
 * interpolated into the review prompt.
 */
function branchName(value: unknown): string {
  if (typeof value !== 'string') return 'main'
  const trimmed = text(value, 100)
  return trimmed !== '' && isSafeBranchName(trimmed) ? trimmed : 'main'
}

/**
 * Resolve the envelope's editorial picks against the parsed rows. A pick that
 * names a row borrows that row whole — looked up before the size cut, so a
 * pick deep in the file still resolves; a pick the shortlist lacks becomes a
 * card built from its own `packages` block; a pick that is neither is dropped.
 * Nothing here can fail the market: an absent or malformed section, or one
 * whose every pick was dropped, reads as "no picks".
 * @param value - the envelope's `featured` field, whatever it is.
 * @param declared - the envelope's `featured_count`; the resolved length stands in when it is not a count.
 * @param rows - every parsed row, keyed by lower-cased `owner/name`.
 * @returns the resolved picks, or undefined when there are none.
 */
function deriveFeatured(value: unknown, declared: unknown, rows: ReadonlyMap<string, MarketPlugin>, copy = new Map<string, string>()): MarketFeatured | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw = value as RawFeatured
  if (!Array.isArray(raw.entries)) return undefined
  const titleZh = text(raw.title_zh, 60) || '编辑精选'
  const titleEn = text(raw.title_en, 60) || "Editor's Picks"
  const entries: MarketFeaturedEntry[] = []
  const seen = new Set<string>()
  for (const candidate of raw.entries.slice(0, FEATURED_LIMIT) as unknown[]) {
    if (candidate === null || typeof candidate !== 'object') continue
    const pick = candidate as RawFeaturedEntry
    const fullName = repositorySlug(pick.full_name)
    if (fullName === null) continue
    const key = fullName.toLowerCase()
    if (seen.has(key)) continue
    const reason = text(pick.reason, REASON_LIMIT)
    const known = rows.get(key)
    if (known !== undefined) {
      seen.add(key)
      const description = copy.get(key) ?? ''
      entries.push({ item: description === '' ? known : { ...known, description }, reason })
      continue
    }
    // A dangling reference with no install block of its own has nothing to
    // show; one whose block does not parse has nothing to install. Older
    // feeds without an inline description still fall back to the reason.
    const installInfo = pick.packages === undefined ? undefined : parseInstallInfo(pick.packages)
    if (installInfo === undefined) continue
    seen.add(key)
    const slash = fullName.indexOf('/')
    entries.push({
      item: {
        installInfo,
        fullName,
        owner: fullName.slice(0, slash),
        name: fullName.slice(slash + 1),
        url: `https://github.com/${fullName}`,
        description: text(pick.description, DESCRIPTION_LIMIT) || reason,
        stars: 0,
        language: '',
        license: '',
        pushedAt: '',
        defaultBranch: 'main',
        category: FEATURED_CATEGORY,
        categoryZh: titleZh,
        categoryEn: titleEn,
      },
      reason,
    })
  }
  if (entries.length === 0) return undefined
  return {
    titleZh, titleEn, updatedAt: text(raw.updated_at, 30), count: count(declared) || entries.length, entries,
    categories: categoriesOf(entries.map(entry => entry.item)),
  }
}

/**
 * Parse the published market into the catalog the browser renders. The
 * publisher's file order is preserved. Only legacy schema-2 feeds are
 * truncated to marketSize; schema 3 carries the complete reviewed catalog.
 * @param body - the parsed catalog JSON body.
 * @param marketSize - legacy schema-2 row limit.
 * @returns the parsed and validated catalog.
 * @throws when the body is not a market this plugin understands.
 */
export function deriveMarket(body: unknown, marketSize: number): MarketCatalog {
  const envelope = body as {
    schema_version?: unknown; entries?: unknown; category_table?: unknown; source_fetched_at?: unknown; source_repo_count?: unknown; featured?: unknown; featured_count?: unknown
    subscription?: unknown; subscription_updated_at?: unknown
  }
  const schema = envelope.schema_version
  if (schema !== SCHEMA_VERSION && schema !== 3 && schema !== 4) {
    const version = schema === undefined ? 'absent' : String(schema)
    throw new Error(`unsupported market schema version ${version}; expected 2, 3, or 4`)
  }
  const isCompact = schema === 4
  const isCompleteCatalog = schema === 3 || schema === 4
  const categoryTable: Array<[string, string, string]> = []
  if (isCompact && Array.isArray(envelope.category_table)) {
    for (const tuple of envelope.category_table as unknown[]) {
      if (Array.isArray(tuple) && typeof tuple[0] === 'string') {
        const key = text(tuple[0], 60)
        categoryTable.push([key, text(tuple[1], 60) || key, text(tuple[2], 60) || key])
      } else {
        categoryTable.push(['', '', ''])
      }
    }
  }
  const rows = Array.isArray(envelope.entries) ? envelope.entries as RawEntry[] : []
  if (rows.length === 0) throw new Error('the published market carried no entries')

  const items: MarketPlugin[] = []
  const knownNames = new Set<string>()
  for (const row of rows) {
    const rawFullName = isCompact ? (row.n ?? row.full_name) : row.full_name
    const fullName = repositorySlug(rawFullName)
    // The publisher's validator makes either case impossible; the wire pass
    // exists so a poisoned or broken file cannot steer the renderer.
    if (fullName === null || knownNames.has(fullName)) continue
    knownNames.add(fullName)
    const catTuple = isCompact && typeof row.c === 'number' && Number.isInteger(row.c)
      ? categoryTable[row.c]
      : undefined
    const category = catTuple ? catTuple[0] : text(row.category, 60)
    if (category === '') continue
    const categoryZh = catTuple ? catTuple[1] : (text(row.category_zh, 60) || category)
    const categoryEn = catTuple ? catTuple[2] : (text(row.category_en, 60) || category)
    const slash = fullName.indexOf('/')
    // Plugin-level copy the publisher added for a repository that publishes a
    // subscription plugin: the card should name the plugin, not the repository.
    const titleZh = text(isCompact ? (row.tz ?? row.title_zh) : row.title_zh, TITLE_LIMIT)
    const titleEn = text(isCompact ? (row.te ?? row.title_en) : row.title_en, TITLE_LIMIT)
    const descriptionEn = text(isCompact ? (row.de ?? row.description_en) : row.description_en, DESCRIPTION_LIMIT)
    const rawPackages = isCompact ? (row.pkg ?? row.packages) : row.packages
    const rawStatus = isCompact ? (row.is ?? row.install_status ?? 'none') : row.install_status
    const archived = isCompact ? (row.ar === 1 || row.ar === true || row.archived === true) : row.archived === true
    const disabled = isCompact ? (row.di === 1 || row.di === true || row.disabled === true) : row.disabled === true
    items.push({
      ...(typeof row.icon === 'string' && isMarketIcon(row.icon) ? { icon: row.icon } : {}),
      ...(Array.isArray(row.keywords) ? { keywords: row.keywords.filter((word): word is string => typeof word === 'string').slice(0, 200).map(word => text(word, 100)) } : {}),
      ...(archived ? { archived: true } : {}),
      ...(disabled ? { disabled: true } : {}),
      ...(rawPackages === undefined ? {} : { installInfo: parseInstallInfo(rawPackages) }),
      ...(rawStatus === 'command' || rawStatus === 'manual' || rawStatus === 'none' ? { installStatus: rawStatus } : {}),
      ...(titleZh === '' ? {} : { titleZh }),
      ...(titleEn === '' ? {} : { titleEn }),
      ...(descriptionEn === '' ? {} : { descriptionEn }),
      fullName,
      owner: fullName.slice(0, slash),
      name: fullName.slice(slash + 1),
      url: `https://github.com/${fullName}`,
      description: text(isCompact ? (row.d ?? row.description) : row.description, DESCRIPTION_LIMIT),
      stars: count(isCompact ? (row.s ?? row.stargazers_count) : row.stargazers_count),
      language: text(isCompact ? (row.l ?? row.language) : row.language, 40),
      license: text(isCompact ? (row.lic ?? row.license) : row.license, 40),
      pushedAt: text(isCompact ? (row.p ?? row.pushed_at) : row.pushed_at, 30),
      defaultBranch: branchName(isCompact ? (row.b ?? row.default_branch) : row.default_branch),
      category,
      categoryZh,
      categoryEn,
    })
  }

  // Schema 3/4 is a complete repository catalog. Legacy marketSize reductions
  // must not silently cut an upgraded installation back down to 1000 rows.
  const cut = isCompleteCatalog ? items : items.slice(0, marketSize)
  const categories: MarketCategory[] = categoriesOf(cut)

  // The picks lead the list whatever their count; the ranked categories
  // after them are exactly what a feed without picks produces.
  const byName = new Map<string, MarketPlugin>()
  for (const item of items) if (!byName.has(item.fullName.toLowerCase())) byName.set(item.fullName.toLowerCase(), item)
  let featured: MarketFeatured | undefined
  let subscription: MarketFeatured | undefined
  if (isCompleteCatalog) {
    subscription = deriveSubscription(envelope.subscription, text(envelope.subscription_updated_at, 40), byName)
    // Hydrate deduplicated plugin icons and search keywords from the embedded
    // subscription onto repository rows so compact feeds avoid duplicating ~1.7 MiB
    // of base64 icons without losing card artwork or package-name search.
    const subIconByRepo = new Map<string, string>()
    const subKeywordsByRepo = new Map<string, Set<string>>()
    for (const entry of subscription.entries) {
      const key = entry.item.fullName.toLowerCase()
      if (key === '') continue
      if (entry.item.icon && !subIconByRepo.has(key)) subIconByRepo.set(key, entry.item.icon)
      const words = subKeywordsByRepo.get(key) ?? new Set<string>()
      for (const word of [entry.item.packageName, entry.item.titleZh, entry.item.titleEn, ...(entry.item.keywords ?? [])]) {
        if (typeof word === 'string' && word !== '') words.add(word)
      }
      subKeywordsByRepo.set(key, words)
    }
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]!
      const key = item.fullName.toLowerCase()
      const icon = item.icon ?? subIconByRepo.get(key)
      const extraKeywords = subKeywordsByRepo.get(key)
      if (icon === item.icon && extraKeywords === undefined) continue
      const mergedKeywords = extraKeywords === undefined
        ? item.keywords
        : [...new Set([...(item.keywords ?? []), ...extraKeywords])].slice(0, 200)
      const hydrated: MarketPlugin = {
        ...item,
        ...(icon === undefined ? {} : { icon }),
        ...(mergedKeywords === undefined ? {} : { keywords: mergedKeywords }),
      }
      items[i] = hydrated
      byName.set(key, hydrated)
    }
    // Editorial picks prefer the published plugin card and its install target,
    // then fall back to the repository row. The editorial description wins.
    const editorial = envelope.featured !== undefined && envelope.featured !== null
    if (editorial) {
      const rowsForPicks = new Map(byName)
      const copy = new Map<string, string>()
      const rawEntries = (envelope.featured as { entries?: unknown }).entries
      for (const raw of Array.isArray(rawEntries) ? rawEntries : []) {
        if (raw === null || typeof raw !== 'object') continue
        const pick = raw as { full_name?: unknown; description?: unknown }
        const slug = repositorySlug(pick.full_name)
        if (slug === null) continue
        const description = text(pick.description, DESCRIPTION_LIMIT)
        if (description !== '') copy.set(slug.toLowerCase(), description)
      }
      for (const entry of subscription.entries) {
        const key = entry.item.fullName.toLowerCase()
        if (key !== '') rowsForPicks.set(key, entry.item)
      }
      const picks = deriveFeatured(envelope.featured, undefined, rowsForPicks, copy)
      if (picks !== undefined) {
        featured = picks
        // Icons and keywords have already been hydrated onto `items` and `picks`,
        // and the client never renders `subscription` as a separate scope when
        // editorial picks are present. Dropping it here saves ~6 MiB on disk and RPC.
        subscription = undefined
      } else {
        // No editorial pick survived the wire pass. `subscription` only travels
        // alongside an editorial list (see MarketCatalog), so fall back exactly
        // like a feed without picks: the subscription becomes the pick list.
        featured = subscription
        subscription = undefined
      }
    } else {
      // Older schema-3 feed: the subscription is the only pick list.
      featured = subscription
      subscription = undefined
    }
  } else {
    featured = deriveFeatured(envelope.featured, envelope.featured_count, byName)
  }
  if (featured !== undefined) {
    categories.unshift({ key: FEATURED_CATEGORY, zh: featured.titleZh, en: featured.titleEn, count: featured.count })
  }
  if (subscription !== undefined) {
    categories.unshift({ key: SUBSCRIPTION_CATEGORY, zh: subscription.titleZh, en: subscription.titleEn, count: subscription.count })
  }

  return {
    items: cut,
    categories,
    ...(featured === undefined ? {} : { featured }),
    ...(subscription === undefined ? {} : { subscription }),
    fetchedAt: text(envelope.source_fetched_at, 40),
    refreshedAt: new Date().toISOString(),
    scanned: count(envelope.source_repo_count) || rows.length,
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message === '' ? 'unknown error' : error.message
  const value = String(error)
  return value === '' ? 'unknown error' : value
}

/**
 * Fetch one URL, following redirects by hand. The DSH host's sandboxed fetch
 * does not follow them itself, and unpkg answers every `@latest` path with a
 * 302 to the pinned version. The whole chain shares one timeout; a hop that
 * leaves the origin drops the ETag (it certifies the first server's content
 * only), and a hop down from https to http is refused.
 * @param url - the first URL.
 * @param etag - the ETag to revalidate with, or '' for a plain request.
 * @returns the first non-redirect response.
 */
async function fetchFollowing(
  url: string,
  etag: string,
  abortSignal?: AbortSignal,
  acceptEncoding = 'gzip',
): Promise<Response> {
  const timeout = AbortSignal.timeout(FETCH_TIMEOUT_MS)
  const signal = abortSignal === undefined ? timeout : AbortSignal.any([timeout, abortSignal])
  const origin = new URL(url).origin
  let current = url
  for (let hop = 0; ; hop += 1) {
    const sameOrigin = new URL(current).origin === origin
    const response = await fetch(current, {
      signal,
      // The host's fetch wrapper asks for compression by default and then
      // hands the compressed bytes through undecoded; asking for identity
      // makes the CDN answer in plain text. `readJson` still copes if a
      // server compresses anyway.
      // A cold catalog read is ~19 MB of JSON; asking for gzip turns that into
      // ~6 MB over the wire. gzip specifically (not br): its magic number lets
      // readJson decode the body even when the host wrapper leaves the bytes
      // compressed with an unexpected header shape.
      headers: etag !== '' && sameOrigin
        ? { 'accept-encoding': acceptEncoding, 'if-none-match': etag }
        : { 'accept-encoding': acceptEncoding },
    })
    if (![301, 302, 303, 307, 308].includes(response.status)) return response
    const location = response.headers.get('location')
    if (location === null || location === '') throw new Error(`catalog HTTP ${String(response.status)} without a location`)
    if (hop + 1 > MAX_REDIRECTS) throw new Error('catalog redirected too many times')
    const next = new URL(location, current)
    if (next.protocol !== 'https:' && !(next.protocol === 'http:' && new URL(current).protocol === 'http:')) {
      throw new Error(`catalog redirected to an unsupported URL (${next.protocol})`)
    }
    // Drain the redirect body so the connection can be reused.
    await response.body?.cancel().catch(() => undefined)
    current = next.href
  }
}

/**
 * Parse a JSON body that may arrive still compressed. The feed is a JSON
 * object, so a body that starts (after whitespace) with `{` or `[` is already
 * plain text whatever `content-encoding` claims — a fetch that decoded it
 * leaves the header in place. Anything else is decoded by the gzip magic
 * number or the declared encoding before parsing.
 * @param response - a successful response.
 * @returns the parsed body.
 */
async function readJson(response: Response): Promise<unknown> {
  const tooLarge = 'catalog exceeds the 64 MiB size limit'
  if (Number(response.headers.get('content-length')) > MAX_CATALOG_BYTES) {
    void response.body?.cancel().catch(() => undefined)
    throw new Error(tooLarge)
  }
  if (response.body === null) throw new Error('catalog response is empty')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      length += value.byteLength
      if (length > MAX_CATALOG_BYTES) {
        void reader.cancel().catch(() => undefined)
        throw new Error(tooLarge)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  let bytes = chunks.length === 1 ? chunks[0]! : Buffer.concat(chunks, length)
  let start = 0
  while (start < bytes.length && (bytes[start] === 0x20 || bytes[start] === 0x09 || bytes[start] === 0x0a || bytes[start] === 0x0d)) start += 1
  const plain = bytes[start] === 0x7b || bytes[start] === 0x5b || (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
  if (!plain) {
    const encoding = (response.headers.get('content-encoding') ?? '').trim().toLowerCase()
    const options = { maxOutputLength: MAX_CATALOG_BYTES }
    try {
      if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes, options)
      else if (encoding === 'br') bytes = brotliDecompressSync(bytes, options)
      else if (encoding === 'deflate') bytes = inflateSync(bytes, options)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ERR_BUFFER_TOO_LARGE') throw new Error(tooLarge)
      throw error
    }
  }
  return JSON.parse(new TextDecoder().decode(bytes))
}

/** The catalog reader: memory first, then the network. */
export interface CatalogSource {
  /**
   * Read the catalog.
   * @param force - bypass the refresh interval (a user gesture, not a poll).
   * @param signal - caller lifetime.
   */
  read: (force: boolean, signal?: AbortSignal) => Promise<{ catalog: MarketCatalog | null; stale: boolean; error: string }>
  /**
   * Kick off a non-blocking background refresh when no fresh catalog is cached
   * yet, so opening the market page hits memory immediately.
   */
  warmup: () => void
}

function isAllowedTarballUrl(metadataUrl: string, tarballUrl: string): boolean {
  try {
    const meta = new URL(metadataUrl)
    const target = new URL(tarballUrl)
    if (target.protocol !== 'https:' && !(target.protocol === 'http:' && meta.protocol === 'http:')) return false
    return target.host === meta.host
      || (meta.host === 'registry.npmmirror.com' && target.host === 'cdn.npmmirror.com')
  } catch {
    return false
  }
}

interface PackageManifest {
  readonly schema_version?: unknown
  readonly version?: unknown
  readonly dist?: { readonly tarball?: unknown; readonly integrity?: unknown }
}

type AttemptOutcome =
  | { readonly kind: 'not-modified'; readonly activeBase: string }
  | { readonly kind: 'fresh'; readonly catalog: MarketCatalog; readonly marketEtag: string; readonly activeBase: string }

/**
 * Build the catalog reader.
 * @param options - the base URL, the market size, and the durable seat.
 * @returns the reader.
 */
export function createCatalogSource(options: CatalogOptions): CatalogSource {
  // Migrate previous built-in URLs (market-v2.json / market-catalog.json / legacy npmmirror /files) even when persisted by the host.
  const migrateBuiltIn = (base: string): string => {
    for (const current of [DEFAULT_CATALOG_BASE, MIRROR_CATALOG_BASE]) {
      if (
        base === current.replace('market-catalog-v4.json', 'market-v2.json') ||
        base === current.replace('market-catalog-v4.json', 'market-catalog.json')
      ) return current
    }
    if (
      base === `${LEGACY_CN_MIRROR_FILES_PREFIX}market-v2.json` ||
      base === `${LEGACY_CN_MIRROR_FILES_PREFIX}market-catalog.json` ||
      base === `${LEGACY_CN_MIRROR_FILES_PREFIX}market-catalog-v4.json`
    ) return CN_MIRROR_CATALOG_BASE
    return base
  }
  const primary = migrateBuiltIn(options.base)
  // The mirrors (China-reachable npmmirror tarball, then unpkg) stand behind the
  // default feed only. A deployment that pointed the market at its own mirror or
  // curation gets exactly that one source — silently switching datasets is not
  // what `catalogBase` was configured for.
  const chain = primary === DEFAULT_CATALOG_BASE
    ? [primary, CN_MIRROR_CATALOG_BASE, MIRROR_CATALOG_BASE]
    : [primary]
  const hedgeDelayMs = options.hedgeDelayMs !== undefined && Number.isFinite(options.hedgeDelayMs) && options.hedgeDelayMs >= 0
    ? options.hedgeDelayMs
    : DEFAULT_HEDGE_DELAY_MS
  // The durable seat is NOT seeded at construction time. The plugin body
  // hands the source a cache port whose backing domain opens asynchronously
  // after this constructor returns, so reading it here would always see the
  // initial (empty) state and a restart would pay a full download instead of
  // a 304. The seed is instead pulled lazily, on the first read — by then
  // the domain is open, and the port answers from the state the effect
  // adopted. Reading it again whenever the closure is still empty also
  // covers a read that raced the domain open.
  let catalog: MarketCatalog | null = null
  let marketEtag = ''
  // The base that served the current catalog: the sticky first choice for
  // the next read. '' means unknown (memory-only, or a cache written before
  // the mirror existed) and is treated as "the primary".
  let activeBase = ''
  const seedFromCache = (): void => {
    if (catalog !== null) return
    const cached = options.cache?.read()
    if (cached === undefined || cached.catalog === null) return
    const migratedBase = cached.activeBase ? migrateBuiltIn(cached.activeBase) : ''
    if (migratedBase && !chain.includes(migratedBase)) return
    catalog = stripUnusedSubscription(cached.catalog)
    marketEtag = migratedBase === cached.activeBase ? cached.marketEtag : ''
    activeBase = migratedBase
  }
  let inFlight: Promise<{ catalog: MarketCatalog | null; stale: boolean; error: string }> | null = null
  let lastBackgroundFailureAt = 0

  const raceWithSignal = async <T>(pending: Promise<T>, signal?: AbortSignal): Promise<T> => {
    if (signal === undefined) return await pending
    if (signal.aborted) throw signal.reason ?? new Error('This operation was aborted')
    let abort: (() => void) | undefined
    const aborted = new Promise<never>((_, reject) => {
      abort = (): void => { reject(signal.reason ?? new Error('This operation was aborted')) }
      signal.addEventListener('abort', abort, { once: true })
    })
    try {
      return await Promise.race([pending, aborted])
    } finally {
      if (abort !== undefined) signal.removeEventListener('abort', abort)
    }
  }

  const waitForCache = async (signal?: AbortSignal): Promise<void> => {
    if (catalog !== null || options.cache?.ready === undefined) return
    await raceWithSignal(options.cache.ready.catch(() => undefined), signal)
  }

  const fresh = (): boolean => {
    if (catalog === null) return false
    const at = Date.parse(catalog.refreshedAt)
    return Number.isFinite(at) && Date.now() - at < REFRESH_INTERVAL_MS
  }

  /**
   * One fetch against one base, bound to the fetch timeout and optional race
   * abort signal. Pure until committed by {@link commitOutcome}, so concurrent
   * hedged attempts never overwrite each other's state.
   */
  const attempt = async (base: string, abortSignal?: AbortSignal): Promise<AttemptOutcome> => {
    // The stored ETag certifies one server's content; a conditional request
    // only goes to the base that issued it. An unknown serving base (legacy
    // record) can only have been the primary.
    const conditional = catalog !== null && marketEtag !== ''
      && (activeBase === '' ? base === primary : activeBase === base)
    const wireEtag = conditional && !marketEtag.startsWith(NPMMIRROR_ETAG_PREFIX) ? marketEtag : ''
    const response = await fetchFollowing(base, wireEtag, abortSignal)
    if (response.status === 304) {
      if (catalog === null) throw new Error('catalog HTTP 304')
      return { kind: 'not-modified', activeBase }
    }
    if (!response.ok) throw new Error(`catalog HTTP ${String(response.status)}`)
    const body = await readJson(response)
    const manifest = body !== null && typeof body === 'object' ? body as PackageManifest : null
    if (manifest !== null && manifest.schema_version === undefined && typeof manifest.dist?.tarball === 'string') {
      const version = typeof manifest.version === 'string' ? manifest.version : ''
      const integrity = typeof manifest.dist.integrity === 'string' ? manifest.dist.integrity : ''
      const versionTag = integrity !== ''
        ? `${NPMMIRROR_ETAG_PREFIX}${version}:${integrity}`
        : version !== '' ? `${NPMMIRROR_ETAG_PREFIX}${version}` : ''
      if (conditional && versionTag !== '' && marketEtag === versionTag) {
        return { kind: 'not-modified', activeBase: base }
      }
      const tarballUrl = manifest.dist.tarball
      if (!isAllowedTarballUrl(base, tarballUrl)) {
        throw new Error('catalog tarball URL is not on an allowed registry host')
      }
      const tarResponse = await fetchFollowing(tarballUrl, '', abortSignal, 'identity')
      if (!tarResponse.ok) throw new Error(`catalog tarball HTTP ${String(tarResponse.status)}`)
      const extracted = await extractFileFromTgzResponse(tarResponse, TARBALL_CATALOG_PATHS, MAX_CATALOG_BYTES)
      const parsed = JSON.parse(extracted.toString('utf8')) as unknown
      return {
        kind: 'fresh',
        catalog: deriveMarket(parsed, options.marketSize),
        marketEtag: versionTag,
        activeBase: base,
      }
    }
    return {
      kind: 'fresh',
      catalog: deriveMarket(body, options.marketSize),
      marketEtag: response.headers.get('etag') ?? '',
      activeBase: base,
    }
  }

  const commitOutcome = (outcome: AttemptOutcome): MarketCatalog => {
    if (outcome.kind === 'not-modified') {
      if (catalog === null) throw new Error('catalog HTTP 304')
      catalog = { ...catalog, refreshedAt: new Date().toISOString() }
      activeBase = outcome.activeBase
      options.cache?.write({ catalog, marketEtag, activeBase })
      return catalog
    }
    catalog = outcome.catalog
    marketEtag = outcome.marketEtag
    activeBase = outcome.activeBase
    options.cache?.write({ catalog, marketEtag, activeBase })
    return catalog
  }

  /** The chain in the order this read tries: the sticky base first. */
  const orderedBases = (): string[] =>
    activeBase === '' || !chain.includes(activeBase)
      ? chain
      : [activeBase, ...chain.filter(base => base !== activeBase)]

  /** A short host label for an error that names two failed attempts. */
  const baseLabel = (base: string): string => {
    try { return new URL(base).host } catch { return base }
  }

  const refresh = async (): Promise<MarketCatalog> => {
    const bases = orderedBases()
    if (bases.length === 1) {
      return commitOutcome(await attempt(bases[0]!, options.disposeSignal))
    }
    return await new Promise<MarketCatalog>((resolve, reject) => {
      const raceController = new AbortController()
      const combinedSignal = options.disposeSignal === undefined
        ? raceController.signal
        : AbortSignal.any([raceController.signal, options.disposeSignal])
      const failures: Array<string | undefined> = Array.from({ length: bases.length }, () => undefined)
      let settled = false
      let nextIndex = 0
      let active = 0
      let hedgeTimer: ReturnType<typeof setTimeout> | undefined

      const clearHedge = (): void => {
        if (hedgeTimer !== undefined) {
          clearTimeout(hedgeTimer)
          hedgeTimer = undefined
        }
      }

      const scheduleHedge = (): void => {
        clearHedge()
        if (settled || nextIndex >= bases.length) return
        hedgeTimer = setTimeout(() => {
          hedgeTimer = undefined
          launchNext()
        }, hedgeDelayMs)
      }

      const finish = (outcome: AttemptOutcome): void => {
        if (settled) return
        settled = true
        clearHedge()
        raceController.abort()
        try {
          resolve(commitOutcome(outcome))
        } catch (error) {
          reject(error)
        }
      }

      const failAll = (error: unknown): void => {
        if (settled) return
        settled = true
        clearHedge()
        raceController.abort()
        reject(error)
      }

      const launchNext = (): void => {
        if (settled || nextIndex >= bases.length) return
        const idx = nextIndex
        const base = bases[idx]!
        nextIndex += 1
        active += 1
        scheduleHedge()
        void attempt(base, combinedSignal).then(
          (outcome) => {
            active -= 1
            finish(outcome)
          },
          (error: unknown) => {
            active -= 1
            if (settled) return
            if (options.disposeSignal?.aborted) {
              failAll(error)
              return
            }
            failures[idx] = `${baseLabel(base)}: ${errorText(error)}`
            if (nextIndex < bases.length && active === 0) {
              clearHedge()
              launchNext()
              return
            }
            if (active === 0 && nextIndex >= bases.length) {
              failAll(new Error(failures.filter((entry): entry is string => entry !== undefined).join('; ')))
            }
          },
        )
      }

      launchNext()
    })
  }

  const startRefresh = (): Promise<{ catalog: MarketCatalog | null; stale: boolean; error: string }> => {
    return (inFlight ??= (async () => {
      try {
        const next = await refresh()
        lastBackgroundFailureAt = 0
        return { catalog: next, stale: false, error: '' }
      } catch (error) {
        lastBackgroundFailureAt = Date.now()
        // A catalog already in memory still answers the question; the
        // browser is told the answer is old rather than shown a blank tab.
        const message = errorText(error)
        if (catalog !== null) return { catalog, stale: true, error: message }
        return { catalog: null, stale: false, error: message }
      } finally {
        inFlight = null
      }
    })())
  }

  const maybeRevalidateInBackground = (): void => {
    if (inFlight !== null || options.disposeSignal?.aborted) return
    if (Date.now() - lastBackgroundFailureAt < BACKGROUND_RETRY_MS) return
    void startRefresh()
  }

  return {
    read: async (force, signal) => {
      // A caller that arrives already aborted must not start the network
      // read its answer would have needed.
      if (signal?.aborted) throw signal.reason ?? new Error('This operation was aborted')
      if (catalog === null && options.cache?.ready !== undefined) await waitForCache(signal)
      seedFromCache()
      if (signal?.aborted) throw signal.reason ?? new Error('This operation was aborted')
      if (!force && catalog !== null) {
        if (!fresh()) maybeRevalidateInBackground()
        return { catalog, stale: false, error: '' }
      }
      // One network read at a time: the tab can be reopened while the first
      // is still running, and two downloads answer the same question. The
      // shared request is bound to the per-attempt fetch timeout only —
      // caller lifetimes never abort it, because the abort of one caller must
      // not hand every other caller a dead answer. A caller that aborts stops
      // waiting for its own copy of the result; the read itself finishes and
      // serves whoever is still listening. `force` against an already running
      // read merges into it (that read IS the fresh download force asked
      // for), so no force gesture is dropped or duplicated.
      return await raceWithSignal(startRefresh(), signal)
    },
    warmup: () => {
      if (options.disposeSignal?.aborted) return
      const run = (): void => {
        if (options.disposeSignal?.aborted) return
        seedFromCache()
        if (!fresh()) maybeRevalidateInBackground()
      }
      if (catalog === null && options.cache?.ready !== undefined) {
        void options.cache.ready.then(run, run)
        return
      }
      run()
    },
  }
}
