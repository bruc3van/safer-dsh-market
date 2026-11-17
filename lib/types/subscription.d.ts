/** Adapt the published format-1 subscription without collapsing monorepo packages. */
import type { MarketCategory, MarketFeatured, MarketPlugin } from './contract.ts';
/** The same category aggregation is used for repositories and subscription plugins. */
export declare function categoriesOf(items: readonly MarketPlugin[]): MarketCategory[];
export declare function deriveSubscription(value: unknown, updatedAt: string, repositories: ReadonlyMap<string, MarketPlugin>): MarketFeatured;
