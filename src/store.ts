/**
 * The market's durable domain: the reduced catalog and the ETags that let the
 * next read ask conditionally.
 *
 * Caching the parsed catalog rather than the published file is the point. The
 * published market is small and moves at most once a day; what the browser
 * needs is its own cut of it. Keeping that cut on disk means a Host restart
 * costs one 304 instead of a download, and a Host that cannot reach GitHub at
 * all still opens the market with the last catalog it saw.
 */
import { z } from 'zod'
import { defineDomain } from '@deepseek-ai/dsh-storage-domain'
import { marketCatalogSchema } from './contract.ts'

/** One uninstall whose stop rows are still in the user's patch file. */
export const pendingUninstallState = z.object({
  packageName: z.string(),
  entryIds: z.array(z.string()),
  at: z.string(),
})

/** The durable state: one catalog, plus what it was fetched with. */
export const safeMarketDomainState = z.object({
  /** The last reduction, or null before the first successful read. */
  catalog: z.union([marketCatalogSchema, z.null()]),
  /**
   * ETag of `market.json` when the catalog was derived.
   *
   * Defaulted, not required, because this field REPLACED the two the catalog
   * carried before 0.2.1 (`repositoriesEtag` / `curatedEtag`, one per upstream
   * file) without the domain version being bumped. A record written by an
   * older build therefore has no `marketEtag`, and a required field would
   * reject the whole global — which does not merely lose the ETag, it makes
   * `open` throw, drops the market to memory-only for good (a store that
   * never opens is never written back, so it never heals), and costs a full
   * download on every boot with an empty market whenever GitHub is
   * unreachable. Defaulting to `''` reads the legacy record, keeps its
   * catalog, and asks unconditionally once; the first successful write
   * rewrites the global in the current shape. The dropped fields need no
   * declaration — an object codec strips unknown keys.
   */
  marketEtag: z.string().default(''),
  /**
   * The base that served the current catalog — the sticky first choice for
   * the next read, so an environment where the primary never answers does
   * not pay its timeout on every refresh (see catalog.ts). Defaulted, not
   * required, for the same reason `marketEtag` is: a record written before
   * the mirror fallback existed has no serving base, and rejecting the whole
   * global over a missing field would cost exactly the resilience this field
   * exists to buy. `''` reads as "the primary answered"; a 200 that serves a
   * fresh market records the serving base, while a 304 keeps `''` (the
   * primary answered — which is what `''` already means).
   */
  activeBase: z.string().default(''),
  /**
   * The derivation format the catalog was reduced under (`CATALOG_FORMAT` in
   * catalog.ts). Defaulted for the same reason as the two fields above; a
   * record written before the field existed reads as format 1, which the
   * cache gate then refuses, so the first read after an upgrade downloads
   * unconditionally instead of revalidating the old reduction with a 304.
   */
  catalogFormat: z.number().int().default(1),
  /**
   * The market size the catalog was reduced with. A deployment that changes
   * `marketSize` must not keep serving a list cut to the old number.
   */
  marketSize: z.number().int().min(1),
  /** The catalog base the reduction came from, for the same reason. */
  catalogBase: z.string(),
  /**
   * LEGACY — the pending-uninstall record an older build kept here. The
   * current build reads it once at boot to seed the file-backed seat (see
   * installed.ts) and then clears the field; it stays in the schema so a
   * store written before the move still parses and its record is not lost.
   */
  pendingUninstall: z.array(pendingUninstallState).default([]),
})

/** Durable market state inferred from {@link safeMarketDomainState}. */
export type SafeMarketDomainState = z.infer<typeof safeMarketDomainState>

/**
 * The empty state a first run opens with. It satisfies the domain schema
 * (`marketSize` is at least 1) even though nothing here is ever persisted:
 * the initial state is only the memory answer before the first read, and a
 * value the schema rejects would break any future path that validates it.
 */
export const initialDomainState: SafeMarketDomainState = {
  catalog: null,
  marketEtag: '',
  activeBase: '',
  catalogFormat: 1,
  marketSize: 1,
  catalogBase: '',
  pendingUninstall: [],
}

/**
 * The `safe_market` domain spec: one global singleton, no tables. The plugin
 * opens this through `ctx.storageDomain`; the spec object is the single
 * source of the domain's identity, version, and schema.
 */
export const safeMarketDomainSpec = defineDomain({
  // Domain names are `/^[a-z][a-z0-9_]*$/` — no hyphen, unlike the settings
  // namespace and the package name. A mismatch throws at module load, which
  // fails the whole plugin tree, not just this plugin.
  name: 'safe_market',
  version: 1,
  global: { schema: safeMarketDomainState, initial: initialDomainState },
  tables: {},
})

/**
 * Adopt the durable state when the domain opens, as one pure step so the
 * merge has regression tests: the pending-uninstall record always follows the
 * disk, and a memory catalog that landed while the domain was opening keeps
 * precedence over the disk (it is newer). Otherwise the stored catalog is
 * adopted WHOLE — the cut and the base it was cut under included, because the
 * cache gate re-checks `marketSize`/`catalogBase` against the live config on
 * every read: adopting the rows without the numbers they were reduced under
 * would leave the cache permanently unusable (a full re-download every boot,
 * and an empty market when GitHub is unreachable).
 * @param current - the in-memory state built before the domain opened.
 * @param stored - the domain's durable state as read from disk.
 * @param isUsable - whether a candidate state answers the current config.
 * @returns the merged state the plugin runs with.
 */
export function adoptDomainState(
  current: SafeMarketDomainState,
  stored: SafeMarketDomainState,
  isUsable: (candidate: SafeMarketDomainState) => boolean,
): SafeMarketDomainState {
  const next: SafeMarketDomainState = { ...current, pendingUninstall: stored.pendingUninstall ?? current.pendingUninstall }
  if (current.catalog !== null) return next
  if (!isUsable(stored)) return next
  return {
    ...next,
    catalog: stored.catalog,
    marketEtag: stored.marketEtag,
    activeBase: stored.activeBase,
    catalogFormat: stored.catalogFormat,
    marketSize: stored.marketSize,
    catalogBase: stored.catalogBase,
  }
}
