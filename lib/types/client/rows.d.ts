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
/** `1998` → `2.0k`: a card has room for the magnitude, not the digits. */
export declare function starCount(stars: number): string;
/** Whether one row survives the current query and category filter. */
export declare function matches(item: MarketPlugin, query: string, category: string, english: boolean): boolean;
/**
 * The editorial picks that survive the current query, in the publisher's
 * order. The reason is searched alongside the row's own fields; the pick's
 * category is the picks themselves, so no category filter applies.
 */
export declare function featuredRows(featured: MarketFeatured | undefined, query: string, english: boolean): readonly MarketFeaturedEntry[];
/**
 * The rows the All view filters. A pick the shortlist does not carry is still
 * something the market can install, so a search reaches it too; without a
 * query the view stays the shortlist its count names.
 */
export declare function marketRows(items: readonly MarketPlugin[], featured: MarketFeatured | undefined, query: string): readonly MarketPlugin[];
/** Whether one skill survives the current query. */
export declare function matchesSkill(skill: MarketSkill, query: string): boolean;
/** The status a package row shows, from its own live facts. */
export declare function stateOf(item: MarketInstalledPackage): 'readFailed' | 'unregistered' | 'disabled' | 'failed' | 'running' | 'installed';
