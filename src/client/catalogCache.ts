/**
 * Client-side in-memory catalog cache shared across all market surfaces
 * (left navigation, right sidebar, Plugins tab).
 *
 * Avoids re-fetching and re-parsing the multi-megabyte catalog over RPC every
 * time the user leaves and re-enters the marketplace, while still re-syncing
 * with the Host after reconnects, explicit refreshes, or when the Host may
 * have finished a background stale-while-revalidate refresh.
 */
import type { MarketCatalogResult } from '../contract.ts'

/** How long a fresh client copy is reused without re-asking the Host. */
export const CLIENT_CATALOG_TTL_MS = 5 * 60 * 1_000

/** Shorter sync window when the cached copy is past the Host's refresh interval (SWR in progress). */
const HOST_STALE_WINDOW_MS = 6 * 60 * 60 * 1_000
const CLIENT_SWR_SYNC_MS = 15 * 1_000

/** Milestones shown in the cold-load progress state before the first catalog arrives. */
export type CatalogLoadingStage = 'connect' | 'download' | 'index' | 'slow'

/**
 * Compute a smooth, monotonic progress percentage and stage label from elapsed
 * cold-load time. Approaches 94% asymptotically so the bar keeps moving gently
 * on slow networks without ever faking completion before the catalog lands.
 */
export function loadingProgressOf(elapsedMs: number): { readonly percent: number; readonly stage: CatalogLoadingStage } {
  const t = Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0
  if (t < 1_500) {
    return { percent: Math.round(6 + (t / 1_500) * 22), stage: 'connect' }
  }
  if (t < 5_000) {
    return { percent: Math.round(28 + ((t - 1_500) / 3_500) * 36), stage: 'download' }
  }
  if (t < 9_500) {
    return { percent: Math.round(64 + ((t - 5_000) / 4_500) * 20), stage: 'index' }
  }
  const extra = 10 * (1 - Math.exp(-(t - 9_500) / 14_000))
  return { percent: Math.min(94, Math.round(84 + extra)), stage: 'slow' }
}

export interface ClientCatalogCache {
  /** Synchronously return the last successful catalog, if any. */
  peek: () => MarketCatalogResult | null
  /** Read the catalog, reusing memory cache and coalescing concurrent requests. */
  load: (force: boolean) => Promise<MarketCatalogResult>
  /** Mark the cached copy for re-sync on the next read without blanking the UI. */
  invalidate: () => void
}

export function createClientCatalogCache(
  fetchCatalog: (force: boolean) => Promise<MarketCatalogResult>,
  now: () => number = () => Date.now(),
): ClientCatalogCache {
  let cached: MarketCatalogResult | null = null
  let cachedAt = 0
  let invalidated = false
  let inFlight: Promise<MarketCatalogResult> | null = null
  let inFlightForce = false
  let inFlightSeq = 0
  let generation = 0

  const isFresh = (): boolean => {
    if (cached === null || cached.catalog === null || cached.stale || invalidated) return false
    const age = now() - cachedAt
    const refreshedMs = Date.parse(cached.catalog.refreshedAt)
    const hostFresh = Number.isFinite(refreshedMs) && now() - refreshedMs < HOST_STALE_WINDOW_MS
    const ttl = hostFresh ? CLIENT_CATALOG_TTL_MS : CLIENT_SWR_SYNC_MS
    return age >= 0 && age < ttl
  }

  return {
    peek: () => cached,
    invalidate: () => {
      invalidated = true
      generation += 1
      inFlight = null
      inFlightForce = false
      inFlightSeq = 0
    },
    load: async (force) => {
      if (!force && isFresh() && cached !== null) return cached
      if (inFlight !== null && (!force || inFlightForce)) return await inFlight
      const seq = ++generation
      const request = (async (): Promise<MarketCatalogResult> => {
        try {
          const result = await fetchCatalog(force)
          if (seq === generation && result.catalog !== null) {
            cached = result
            cachedAt = now()
            invalidated = false
          }
          return result
        } catch (error) {
          if (cached !== null && cached.catalog !== null) {
            const message = error instanceof Error ? error.message : String(error)
            return { catalog: cached.catalog, stale: true, error: message }
          }
          throw error
        } finally {
          if (inFlightSeq === seq) {
            inFlight = null
            inFlightForce = false
          }
        }
      })()
      inFlight = request
      inFlightForce = force
      inFlightSeq = seq
      return await request
    },
  }
}
