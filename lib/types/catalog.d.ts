import type { MarketCatalog } from './contract.ts';
/** Default feed and mirrors (including China-reachable npmmirror) serve the same npm package dataset. */
export declare const DEFAULT_CATALOG_BASE = "https://cdn.jsdelivr.net/npm/awesome-dsh-plugin-feed@latest/data/market-catalog-v4.json";
export declare const CN_MIRROR_CATALOG_BASE = "https://registry.npmmirror.com/awesome-dsh-plugin-feed/latest/files/data/market-catalog-v4.json";
export declare const MIRROR_CATALOG_BASE = "https://unpkg.com/awesome-dsh-plugin-feed@latest/data/market-catalog-v4.json";
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
 */
export declare const CATALOG_FORMAT = 7;
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
    read: () => {
        catalog: MarketCatalog | null;
        marketEtag: string;
        activeBase: string;
    };
    /** Persist a fresh parse. Failures are the cache's own business. */
    write: (next: {
        catalog: MarketCatalog;
        marketEtag: string;
        activeBase: string;
    }) => void;
}
/** Deployment-varying knobs the plugin config owns. */
export interface CatalogOptions {
    /** A complete schema-3 catalog or legacy schema-2 JSON feed URL. */
    readonly base: string;
    /** Legacy schema-2 size limit; schema 3 is never truncated. */
    readonly marketSize: number;
    /** Durable seat for the parse; absent means memory-only. */
    readonly cache?: CatalogCache;
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
export declare function deriveMarket(body: unknown, marketSize: number): MarketCatalog;
/** The catalog reader: memory first, then the network. */
export interface CatalogSource {
    /**
     * Read the catalog.
     * @param force - bypass the refresh interval (a user gesture, not a poll).
     * @param signal - caller lifetime.
     */
    read: (force: boolean, signal?: AbortSignal) => Promise<{
        catalog: MarketCatalog | null;
        stale: boolean;
        error: string;
    }>;
}
/**
 * Build the catalog reader.
 * @param options - the base URL, the market size, and the durable seat.
 * @returns the reader.
 */
export declare function createCatalogSource(options: CatalogOptions): CatalogSource;
