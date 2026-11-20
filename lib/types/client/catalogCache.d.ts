/**
 * Client-side in-memory catalog cache shared across all market surfaces
 * (left navigation, right sidebar, Plugins tab).
 *
 * Avoids re-fetching and re-parsing the multi-megabyte catalog over RPC every
 * time the user leaves and re-enters the marketplace, while still re-syncing
 * with the Host after reconnects, explicit refreshes, or when the Host may
 * have finished a background stale-while-revalidate refresh.
 */
import type { MarketCatalogResult } from '../contract.ts';
/** How long a fresh client copy is reused without re-asking the Host. */
export declare const CLIENT_CATALOG_TTL_MS: number;
/** Milestones shown in the cold-load progress state before the first catalog arrives. */
export type CatalogLoadingStage = 'connect' | 'download' | 'index' | 'slow';
/**
 * Compute a smooth, monotonic progress percentage and stage label from elapsed
 * cold-load time. Approaches 94% asymptotically so the bar keeps moving gently
 * on slow networks without ever faking completion before the catalog lands.
 */
export declare function loadingProgressOf(elapsedMs: number): {
    readonly percent: number;
    readonly stage: CatalogLoadingStage;
};
export interface ClientCatalogCache {
    /** Synchronously return the last successful catalog, if any. */
    peek: () => MarketCatalogResult | null;
    /** Read the catalog, reusing memory cache and coalescing concurrent requests. */
    load: (force: boolean) => Promise<MarketCatalogResult>;
    /** Mark the cached copy for re-sync on the next read without blanking the UI. */
    invalidate: () => void;
}
export declare function createClientCatalogCache(fetchCatalog: (force: boolean) => Promise<MarketCatalogResult>, now?: () => number): ClientCatalogCache;
