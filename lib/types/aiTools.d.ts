/**
 * Read-only `dsh_market_pro` Agent tool registered into the Host tool registry
 * when the runtime provides `ctx.tools` and `aiAssistantEnabled` is on.
 *
 * Deliberately imports nothing from `@deepseek-ai/dsh-tools` at runtime so
 * older or minimal DSH hosts without that module continue booting unaffected.
 * Arguments are validated with `zod`, the schema strictly uses DSH's supported
 * JSON Schema subset, and rendered output is wrapped in an unforgeable
 * `<untrusted_market_data>` boundary to defend against indirect prompt injection.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { MarketCatalogResult, MarketInstalledResult, McpHostContext, SafeMarketSettings } from './contract.ts';
export declare const MARKET_TOOL_NAME = "dsh_market_pro";
/**
 * Wrap model-facing tool output in an explicit untrusted-data envelope.
 * Angle brackets are neutralized to fullwidth forms and invisible prompt-injection
 * code points (zero-width, BiDi overrides, Unicode tag block) are stripped so
 * third-party metadata can never close this envelope or smuggle hidden instructions.
 */
export declare function wrapUntrustedMarketData(payload: string): string;
export interface MarketAiToolDeps {
    readonly profile: string;
    readonly readSettings: () => SafeMarketSettings;
    readonly readCatalog: (force: boolean, signal?: AbortSignal) => Promise<MarketCatalogResult>;
    readonly listInstalled: () => Promise<MarketInstalledResult>;
    readonly readMcp: () => McpHostContext;
}
/** Build the registry-ready `dsh_market_pro` tool definition with a compact schema. */
export declare function createMarketAiToolDefinition(deps: MarketAiToolDeps): Record<string, unknown>;
/**
 * Mount the `dsh_market_pro` tool when `ctx.tools` is available and keep its
 * registration synchronized with `settings.aiAssistantEnabled`.
 */
export declare function registerMarketAiTool(ctx: Context, deps: MarketAiToolDeps): {
    sync(): void;
};
