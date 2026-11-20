/**
 * Pure read-only catalog search, detail lookup, and environment summary for
 * the built-in `dsh_market_pro` Agent tool.
 *
 * All remote catalog fields are third-party untrusted text: every string is
 * normalized and tightly bounded here, and base64 icons are stripped so model
 * context stays small and clean.
 */
import type { MarketCatalog, MarketInstalledPackage, MarketInstalledResult, MarketPlugin, McpHostContext } from './contract.ts';
export type AiSearchScope = 'all' | 'featured';
export type AiSearchSort = 'relevance' | 'active' | 'stars' | 'updated';
export type AiInstallStatus = 'command' | 'manual' | 'none';
export type AiLang = 'zh' | 'en';
export interface AiInstallTargetSummary {
    readonly install: string;
    readonly note?: string;
}
export interface AiCatalogEntrySummary {
    readonly fullName: string;
    readonly packageName?: string;
    readonly name: string;
    readonly titleZh?: string;
    readonly titleEn?: string;
    readonly url?: string;
    readonly category: string;
    readonly categoryZh?: string;
    readonly categoryEn?: string;
    readonly stars: number;
    readonly pushedAt: string;
    readonly language?: string;
    readonly license?: string;
    readonly archived?: true;
    readonly disabled?: true;
    readonly featured?: true;
    readonly reason?: string;
    readonly description: string;
    readonly descriptionEn?: string;
    readonly installStatus: AiInstallStatus;
    readonly installTargets?: readonly AiInstallTargetSummary[];
    readonly hasExtraDetails?: true;
    readonly installed: boolean;
    readonly installedVersion?: string;
}
export interface AiCatalogEntryDetail extends AiCatalogEntrySummary {
    readonly url: string;
    readonly defaultBranch: string;
    readonly keywords?: readonly string[];
    readonly tasks?: readonly string[];
    readonly requirements?: readonly string[];
    readonly note?: string;
    readonly manual?: string;
    readonly installedEnabled?: boolean;
}
export interface AiSearchOptions {
    readonly query?: string;
    readonly queries?: readonly string[];
    readonly category?: string;
    readonly scope?: AiSearchScope;
    readonly installableOnly?: boolean;
    readonly excludeInstalled?: boolean;
    readonly includeArchived?: boolean;
    readonly lang?: AiLang;
    readonly sort?: AiSearchSort;
    readonly offset?: number;
    readonly limit?: number;
}
export interface AiSearchResult {
    readonly total: number;
    readonly offset: number;
    readonly limit: number;
    readonly nextOffset: number | null;
    readonly matchMode: 'all' | 'exact' | 'broad';
    readonly stale: boolean;
    readonly invalidCategory?: true;
    readonly availableCategories?: readonly {
        readonly key: string;
        readonly zh: string;
        readonly en: string;
    }[];
    readonly entries: readonly AiCatalogEntrySummary[];
}
export interface AiOverviewResult {
    readonly profile: string;
    readonly fetchedAt: string;
    readonly scanned: number;
    readonly stale: boolean;
    readonly totalRepositories: number;
    readonly featuredCount: number;
    readonly installableCount: number;
    readonly categories: readonly {
        readonly key: string;
        readonly zh: string;
        readonly en: string;
        readonly count: number;
    }[];
    readonly installedCount: number;
    readonly installedPackages: readonly {
        readonly packageName: string;
        readonly version: string;
        readonly enabled: boolean;
        readonly self?: true;
    }[];
    readonly mcpServerCount: number;
    readonly mcpToolCount: number;
}
export interface AiEnvironmentResult {
    readonly profile: string;
    readonly installedError: string;
    readonly installedPackages: readonly {
        readonly packageName: string;
        readonly version: string;
        readonly enabled: boolean;
        readonly repository?: string;
        readonly self?: true;
        readonly inBox?: true;
    }[];
    readonly mcp: {
        readonly managerActive: boolean;
        readonly toolGroups: readonly {
            readonly server: string;
            readonly toolCount: number;
            readonly sampleTools: readonly string[];
        }[];
        readonly unmanagedServers: readonly {
            readonly serverName: string;
            readonly transport: string;
            readonly enabled: boolean;
            readonly phase: string | null;
        }[];
        readonly toolsError?: string;
    };
}
export declare const DEFAULT_AI_LIMIT = 8;
export declare const MAX_AI_LIMIT = 25;
export declare const MAX_AI_QUERIES = 3;
export declare const MAX_AI_DETAIL_TARGETS = 5;
/** Zero-width, BiDi override, and Unicode tag-block characters used in invisible prompt injection. */
export declare const INVISIBLE_INJECTION_PATTERN: RegExp;
/**
 * Strip control, zero-width, BiDi override, and Unicode tag-block characters
 * (used for invisible prompt injection), neutralize `<` / `>` so third-party
 * text can never forge or close framing tags like `</untrusted_market_data>`
 * or `</skill_instructions>`, collapse whitespace, and cap length by code point.
 */
export declare function sanitizeUntrustedText(value: unknown, limit: number): string;
export declare function installStatusOf(item: MarketPlugin): AiInstallStatus;
/** Build a compact index of catalog statistics, categories, and installed status. */
export declare function buildAiOverview(catalog: MarketCatalog, stale: boolean, installed: MarketInstalledResult, mcp: McpHostContext, profile: string): AiOverviewResult;
/** Search curated picks or the complete catalog with weighted relevance, CJK 2-gram fallback, and multi-query merging. */
export declare function searchAiCatalog(catalog: MarketCatalog, stale: boolean, installedPackages: readonly MarketInstalledPackage[], options?: AiSearchOptions): AiSearchResult;
/** Look up one catalog entry by `owner/repo` or `packageName` with complete bounded metadata. */
export declare function lookupAiCatalogDetail(catalog: MarketCatalog, installedPackages: readonly MarketInstalledPackage[], target: string, lang?: AiLang): AiCatalogEntryDetail | null;
/** Batch detail lookup for up to MAX_AI_DETAIL_TARGETS items in one round-trip. */
export declare function lookupAiCatalogDetails(catalog: MarketCatalog, installedPackages: readonly MarketInstalledPackage[], targets: readonly string[], lang?: AiLang): {
    readonly entries: readonly AiCatalogEntryDetail[];
    readonly notFound: readonly string[];
};
/** Build a secret-free, sanitized summary of installed plugins and MCP servers in this profile. */
export declare function buildAiEnvironment(profile: string, installed: MarketInstalledResult, mcp: McpHostContext): AiEnvironmentResult;
