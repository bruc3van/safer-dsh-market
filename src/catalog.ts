/** Read the curated v2 feed; preserve v1 support for custom directory sources.
 * Remote metadata is validated before entering the client wire contract.
 */
import { brotliDecompressSync, gunzipSync, inflateSync } from 'node:zlib'
import { parseInstallInfo } from './installInfo.ts'
import type { MarketCatalog, MarketCategory, MarketFeatured, MarketFeaturedEntry, MarketPlugin } from './contract.ts'
import { FEATURED_CATEGORY, isSafeBranchName, REPOSITORY_SLUG_PATTERN } from './shapes.ts'

/** Default feed and CDN fallback serve the same npm package dataset. */
export const DEFAULT_CATALOG_BASE = 'https://cdn.jsdelivr.net/npm/awesome-dsh-plugin-feed@latest/data/market-v2.json'
export const MIRROR_CATALOG_BASE = 'https://unpkg.com/awesome-dsh-plugin-feed@latest/data/market-v2.json'

/** The market is refreshed daily upstream; asking more often than this is noise. */
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1_000

/** One attempt against one base; a chain of two costs at most twice this. */
const FETCH_TIMEOUT_MS = 20_000

/** unpkg answers every `@latest` path with one 302; a few more hops is already a loop. */
const MAX_REDIRECTS = 5

/** A description longer than this is a README pasted into the field, not a summary. */
const DESCRIPTION_LIMIT = 300

/** The legacy schema remains accepted for custom sources. */
const SCHEMA_VERSION = 1

/**
 * The shape {@link deriveMarket} produces. A stored catalog records the
 * format it was derived under, and the cache gate refuses any other: a
 * revalidation only asks whether the FEED changed, so after an upgrade that
 * changes the parse a 304 would keep serving the old build's reduction
 * forever. Bump this whenever the derived catalog gains or changes a field.
 * 1 — before the editorial picks; 2 — `featured`; 3 — inline pick descriptions.
 */
export const CATALOG_FORMAT = 3

/** Editorial picks are a short list; anything longer is not one. */
const FEATURED_LIMIT = 50

/** A pick's reason is one sentence, not a second description. */
const REASON_LIMIT = 200

/** One published entry, before the wire pass. Every field may be anything. */
interface RawEntry {
  packages?: unknown
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
}

/** Deployment-varying knobs the plugin config owns. */
export interface CatalogOptions {
  /** A complete JSON feed URL, or a directory containing market.json. */
  readonly base: string
  /** How many plugins the market shows. */
  readonly marketSize: number
  /** Durable seat for the parse; absent means memory-only. */
  readonly cache?: CatalogCache
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
function deriveFeatured(value: unknown, declared: unknown, rows: ReadonlyMap<string, MarketPlugin>): MarketFeatured | undefined {
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
      entries.push({ item: known, reason })
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
  return { titleZh, titleEn, updatedAt: text(raw.updated_at, 30), count: count(declared) || entries.length, entries }
}

/**
 * Parse the published market into the catalog the browser renders. The
 * publisher's order IS the balance — every category places its best entry
 * before any places its second — so rows are kept in file order and truncated
 * to the requested size; nothing is re-ranked here.
 * @param body - the parsed `market.json` body.
 * @param marketSize - how many rows the browser shows.
 * @returns the parsed, validated, truncated catalog.
 * @throws when the body is not a market this plugin understands.
 */
export function deriveMarket(body: unknown, marketSize: number): MarketCatalog {
  const envelope = body as {
    schema_version?: unknown; entries?: unknown; source_fetched_at?: unknown; source_repo_count?: unknown; featured?: unknown; featured_count?: unknown
  }
  if (envelope.schema_version !== SCHEMA_VERSION && envelope.schema_version !== 2) {
    const version = envelope.schema_version === undefined ? 'absent' : String(envelope.schema_version)
    throw new Error(`unsupported market.json schema version ${version}`)
  }
  const rows = Array.isArray(envelope.entries) ? envelope.entries as RawEntry[] : []
  if (rows.length === 0) throw new Error('the published market carried no entries')

  const items: MarketPlugin[] = []
  const knownNames = new Set<string>()
  for (const row of rows) {
    const fullName = repositorySlug(row.full_name)
    // The publisher's validator makes either case impossible; the wire pass
    // exists so a poisoned or broken file cannot steer the renderer.
    if (fullName === null || knownNames.has(fullName)) continue
    knownNames.add(fullName)
    const category = text(row.category, 60)
    if (category === '') continue
    const slash = fullName.indexOf('/')
    items.push({
      ...(row.packages === undefined ? {} : { installInfo: parseInstallInfo(row.packages) }),
      fullName,
      owner: fullName.slice(0, slash),
      name: fullName.slice(slash + 1),
      url: `https://github.com/${fullName}`,
      description: text(row.description, DESCRIPTION_LIMIT),
      stars: count(row.stargazers_count),
      language: text(row.language, 40),
      license: text(row.license, 40),
      pushedAt: text(row.pushed_at, 30),
      defaultBranch: branchName(row.default_branch),
      category,
      categoryZh: text(row.category_zh, 60) || category,
      categoryEn: text(row.category_en, 60) || category,
    })
  }

  const cut = items.slice(0, marketSize)
  const categories: MarketCategory[] = []
  for (const item of cut) {
    const known = categories.find(entry => entry.key === item.category)
    if (known === undefined) categories.push({ key: item.category, zh: item.categoryZh, en: item.categoryEn, count: 1 })
    else (known as { count: number }).count += 1
  }
  categories.sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))

  // The picks lead the list whatever their count; the ranked categories
  // after them are exactly what a feed without picks produces.
  const byName = new Map<string, MarketPlugin>()
  for (const item of items) if (!byName.has(item.fullName.toLowerCase())) byName.set(item.fullName.toLowerCase(), item)
  const featured = deriveFeatured(envelope.featured, envelope.featured_count, byName)
  if (featured !== undefined) {
    categories.unshift({ key: FEATURED_CATEGORY, zh: featured.titleZh, en: featured.titleEn, count: featured.count })
  }

  return {
    items: cut,
    categories,
    ...(featured === undefined ? {} : { featured }),
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
async function fetchFollowing(url: string, etag: string): Promise<Response> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS)
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
      headers: etag !== '' && sameOrigin
        ? { 'accept-encoding': 'identity', 'if-none-match': etag }
        : { 'accept-encoding': 'identity' },
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
  let bytes: Uint8Array = new Uint8Array(await response.arrayBuffer())
  let start = 0
  while (start < bytes.length && (bytes[start] === 0x20 || bytes[start] === 0x09 || bytes[start] === 0x0a || bytes[start] === 0x0d)) start += 1
  const plain = bytes[start] === 0x7b || bytes[start] === 0x5b || (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf)
  if (!plain) {
    const encoding = (response.headers.get('content-encoding') ?? '').trim().toLowerCase()
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = gunzipSync(bytes)
    else if (encoding === 'br') bytes = brotliDecompressSync(bytes)
    else if (encoding === 'deflate') bytes = inflateSync(bytes)
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
}

/**
 * Build the catalog reader.
 * @param options - the base URL, the market size, and the durable seat.
 * @returns the reader.
 */
export function createCatalogSource(options: CatalogOptions): CatalogSource {
  const primary = options.base.replace(/\/+$/, '')
  // The mirror stands behind the default feed only. A deployment that
  // pointed the market at its own mirror or curation gets exactly that one
  // source — silently switching datasets is not what `catalogBase` was
  // configured for.
  const chain = primary === DEFAULT_CATALOG_BASE ? [primary, MIRROR_CATALOG_BASE] : [primary]
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
    if (cached.activeBase && !chain.includes(cached.activeBase)) return
    catalog = cached.catalog
    marketEtag = cached.marketEtag
    activeBase = cached.activeBase
  }
  let inFlight: Promise<{ catalog: MarketCatalog | null; stale: boolean; error: string }> | null = null

  const fresh = (): boolean => {
    if (catalog === null) return false
    const at = Date.parse(catalog.refreshedAt)
    return Number.isFinite(at) && Date.now() - at < REFRESH_INTERVAL_MS
  }

  /**
   * One fetch against one base, bound to the fetch timeout. Success consumes
   * the answer and makes the base sticky: a 304 renews the freshness stamp
   * (it is only asked for with the ETag that same base issued), a 200
   * replaces the catalog. Throwing leaves the state untouched, so the next
   * base in the chain starts from the same place.
   */
  const attempt = async (base: string): Promise<MarketCatalog> => {
    const marketUrl = base.endsWith('.json') ? base : `${base}/market.json`
    // The stored ETag certifies one server's content; a conditional request
    // only goes to the base that issued it. An unknown serving base (legacy
    // record) can only have been the primary.
    const conditional = catalog !== null && marketEtag !== ''
      && (activeBase === '' ? base === primary : activeBase === base)
    const response = await fetchFollowing(marketUrl, conditional ? marketEtag : '')
    if (response.status === 304) {
      // Only asked for when a catalog exists (see `conditional`); guard for
      // the type, since TypeScript cannot read the correlation out of the
      // boolean above.
      if (catalog === null) throw new Error('catalog HTTP 304')
      catalog = { ...catalog, refreshedAt: new Date().toISOString() }
      options.cache?.write({ catalog, marketEtag, activeBase })
      return catalog
    }
    if (!response.ok) throw new Error(`catalog HTTP ${String(response.status)}`)
    catalog = deriveMarket(await readJson(response), options.marketSize)
    marketEtag = response.headers.get('etag') ?? ''
    activeBase = base
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
    const failures: string[] = []
    for (const base of orderedBases()) {
      try {
        return await attempt(base)
      } catch (error) {
        // One failure ends the read only when no base is left. A
        // single-source chain keeps the bare message; a two-source chain
        // names the host of each failed attempt.
        failures.push(chain.length > 1 ? `${baseLabel(base)}: ${errorText(error)}` : errorText(error))
      }
    }
    throw new Error(failures.join('; '))
  }

  return {
    read: async (force, signal) => {
      seedFromCache()
      // A caller that arrives already aborted must not start the network
      // read its answer would have needed.
      if (signal?.aborted) throw signal.reason ?? new Error('This operation was aborted')
      if (!force && fresh() && catalog !== null) return { catalog, stale: false, error: '' }
      // One network read at a time: the tab can be reopened while the first
      // is still running, and two downloads answer the same question. The
      // shared request is bound to the per-attempt fetch timeout only —
      // caller lifetimes never abort it, because the abort of one caller must
      // not hand every other caller a dead answer. A caller that aborts stops
      // waiting for its own copy of the result; the read itself finishes and
      // serves whoever is still listening. `force` against an already running
      // read merges into it (that read IS the fresh download force asked
      // for), so no force gesture is dropped or duplicated.
      const pending = (inFlight ??= (async () => {
        try {
          return { catalog: await refresh(), stale: false, error: '' }
        } catch (error) {
          // A catalog already in memory still answers the question; the
          // browser is told the answer is old rather than shown a blank tab.
          const message = errorText(error)
          if (catalog !== null) return { catalog, stale: true, error: message }
          return { catalog: null, stale: false, error: message }
        } finally {
          inFlight = null
        }
      })())
      if (signal === undefined) return await pending
      // This caller's abort resolves its wait as a cancellation; the shared
      // read is untouched and stays in flight for the other callers.
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
    },
  }
}
