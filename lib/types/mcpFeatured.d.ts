/**
 * Shared built-in curated MCP server catalog and pure identity/filter rules.
 *
 * Dependency-free on purpose so both the Host (`dsh_mcp_pro` Agent tool and
 * Settings installer) and the browser (`McpView` Featured sub-tab) read the
 * exact same verified catalog and matching logic.
 * @module dsh-market-pro/mcpFeatured
 */
/** High-level discovery category for curated MCP servers. */
export type FeaturedMcpCategory = 'docs' | 'search' | 'browser' | 'dev' | 'office' | 'visual' | 'life' | 'memory';
/** Ordered category list for filter controls and overview summaries. */
export declare const FEATURED_MCP_CATEGORIES: readonly FeaturedMcpCategory[];
/** One user-supplied value a curated server accepts or requires before starting. */
export interface FeaturedMcpInput {
    readonly key: string;
    readonly where: 'env' | 'header' | 'arg';
    /** Optional CLI flag placed immediately before an `arg` value (e.g. `-a`, `-s`). */
    readonly flag?: string;
    readonly labelZh: string;
    readonly labelEn: string;
    readonly descriptionZh?: string;
    readonly descriptionEn?: string;
    readonly placeholder?: string;
    readonly secret?: boolean;
    readonly required?: boolean;
    /** Header value template around the user's input, e.g. `Bearer {}`. Defaults to `{}`. */
    readonly format?: string;
}
/** One curated MCP server entry shipped with the plugin. */
export interface FeaturedMcpServer {
    readonly id: string;
    readonly title: string;
    readonly publisher: string;
    /** GitHub `owner/repo` slug used for logo/avatar fallback. */
    readonly repo?: string;
    /** Explicit logo URL when the project has a dedicated icon. */
    readonly icon?: string;
    readonly homepage: string;
    readonly category: FeaturedMcpCategory;
    readonly descriptionZh: string;
    readonly descriptionEn: string;
    readonly transport: 'stdio' | 'streamable-http';
    readonly command?: string;
    readonly args?: readonly string[];
    readonly env?: Readonly<Record<string, string>>;
    /** Override the manager's default handshake budget for a slow cold start. */
    readonly startupTimeoutMs?: number;
    readonly url?: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly inputs: readonly FeaturedMcpInput[];
}
/** Curated MCP servers verified for DSH's `stdio` and `streamable-http` manager. */
export declare const FEATURED_MCP_SERVERS: readonly FeaturedMcpServer[];
/** Look up one curated server by its canonical id (case-insensitive). */
export declare function findFeaturedMcpById(id: string): FeaturedMcpServer | undefined;
/**
 * Canonical identity key for an MCP server, independent of its configured
 * server name: normalized endpoint URL for HTTP, or `<runner> <package>`
 * (version tag stripped) for stdio.
 */
export declare function mcpIdentityKey(target: {
    readonly transport?: string;
    readonly url?: string;
    readonly command?: string;
    readonly args?: readonly string[];
}): string;
/** Pick an available server name within DSH's 1–32 char grammar (`id`, `id-2`, …). */
export declare function pickAvailableServerName(baseId: string, taken: ReadonlySet<string>): string;
/** Whether a curated server matches the active category filter and search text. */
export declare function matchesFeaturedMcp(item: FeaturedMcpServer, query: string, category: FeaturedMcpCategory | 'all'): boolean;
/** Short runtime label shown on curated MCP cards (`HTTP`, `npx`, `uvx`, …). */
export declare function featuredRuntimeBadge(item: FeaturedMcpServer): string;
/** Preview target line shown in the curated detail dialog (command line or URL). */
export declare function featuredTargetPreview(item: FeaturedMcpServer): string;
/** Whether any input on this curated server is required before saving. */
export declare function hasRequiredInputs(item: FeaturedMcpServer): boolean;
/** Whether any input on this curated server is a secret credential. */
export declare function hasSecretInputs(item: FeaturedMcpServer): boolean;
