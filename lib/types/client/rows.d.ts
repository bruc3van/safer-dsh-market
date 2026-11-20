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
import type { MarketFeatured, MarketFeaturedEntry, MarketInstalledPackage, MarketPlugin, MarketSkill } from '../contract.ts';
/**
 * The category chip that selects the installed set instead of a catalog
 * category. The catalog's own keys are slugs from the shortlist, so a value
 * carrying a colon cannot collide with one.
 */
export declare const INSTALLED_FILTER = "dsh:installed";
/** Card-state key for a review launched from the shared installation result panel. */
export declare const SELF_CARD_KEY = "dsh:self";
/** Card-state key for a review launched from the installed-package view. */
export declare function installedReviewCardKey(packageName: string): string;
/** Sort order for the All catalog view. */
export type MarketSort = 'active' | 'stars' | 'updated';
/** Combine repository stars with update recency, sinking archived or disabled repositories. */
export declare function activeHeatScore(item: MarketPlugin, referenceMs: number): number;
/** Sort rows for the All catalog view by active popularity, stars, or update date. */
export declare function sortMarketRows(items: readonly MarketPlugin[], sort: MarketSort, referenceAt?: string): MarketPlugin[];
/** `1998` → `2.0k`: a card has room for the magnitude, not the digits. */
export declare function starCount(stars: number): string;
/** Whether one row survives the current query and category filter. */
export declare function matches(item: MarketPlugin, query: string, category: string, english: boolean): boolean;
/**
 * Picks surviving the query and optional subscription category, in published
 * order. Legacy editorial reasons remain searchable alongside row fields.
 */
export declare function featuredRows(featured: MarketFeatured | undefined, query: string, english: boolean, category?: string): readonly MarketFeaturedEntry[];
/**
 * The rows the All view filters. A pick the shortlist does not carry is still
 * something the legacy market can install, so a search reaches it too.
 * Schema 3 keeps the repository list distinct from subscription packages.
 */
export declare function marketRows(items: readonly MarketPlugin[], featured: MarketFeatured | undefined, query: string): readonly MarketPlugin[];
/**
 * Count how many plugins in the full catalog match the query across all
 * categories, so narrowed scopes can tell the user whether widening to All
 * will yield results.
 */
export declare function allCatalogMatchCount(items: readonly MarketPlugin[], featured: MarketFeatured | undefined, query: string, english: boolean): number;
/**
 * How a row can be installed, from the same two sources the install button
 * reads: the publisher's `install_status` when the feed carries one (schema 3),
 * otherwise the parsed packages block. A row that claims a command target the
 * wire pass could not validate is treated as uninstallable, never as a
 * clickable install that would fail later.
 */
export declare function installState(item: MarketPlugin): 'command' | 'manual' | 'none';
/** Whether the card offers anything beyond a GitHub link. */
export declare function hasInstallTarget(item: MarketPlugin): boolean;
/** Stable card identity across repository and package lists, including monorepos. */
export declare function marketKey(item: MarketPlugin): string;
/** Paginate a complete result set; filtering and counts always use all results. */
export declare function pageOf<T>(items: readonly T[], requested: number, size?: number): {
    items: T[];
    current: number;
    pages: number;
    total: number;
    start: number;
    end: number;
};
/** Whether one skill survives the current query. */
export declare function matchesSkill(skill: MarketSkill, query: string): boolean;
/** The status a package row shows, from its own live facts. */
export declare function stateOf(item: MarketInstalledPackage): 'readFailed' | 'unregistered' | 'disabled' | 'failed' | 'running' | 'installed';
