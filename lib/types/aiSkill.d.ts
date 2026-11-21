/**
 * Built-in `dsh-market-pro` (plugin discovery) and `dsh-mcp-pro` (MCP server
 * discovery & safe installation) Agent Skills registered through `ctx.skills`.
 *
 * Uses `registerProvider` at `BUNDLED_SKILL_RANK` (600) so user-defined or
 * project-local skills with the same name can override them cleanly, and
 * invalidates live whenever `settings.aiAssistantEnabled` flips. Falls back
 * safely on hosts whose `skills` service lacks provider registration.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SafeMarketSettings } from './contract.ts';
export declare const MARKET_SKILL_NAME = "dsh-market-pro";
export declare const MCP_SKILL_NAME = "dsh-mcp-pro";
export declare const MARKET_SKILL_PROVIDER = "dsh-market-pro";
/** Matches `@deepseek-ai/dsh-skill`'s `BUNDLED_SKILL_RANK` without requiring a runtime import. */
export declare const MARKET_SKILL_RANK = 600;
export declare const MARKET_SKILL_DESCRIPTION = "Search, compare, and recommend DSH plugins & MCPs via DSH Market Pro, check & batch-update installed plugins to latest versions, and guide safe installation. / \u63D2\u4EF6\u5E02\u573APro AI \u9009\u578B\u3001\u5B89\u5168\u5B89\u88C5\u4E0E\u4E00\u952E\u6279\u91CF\u66F4\u65B0\u52A9\u624B\u3002";
export declare const MARKET_SKILL_WHEN_TO_USE = "Invoke when finding, comparing, recommending, installing, checking updates for, batch-updating, or reviewing DSH plugins/MCPs. Skip for unrelated tasks.";
export declare const MCP_SKILL_DESCRIPTION = "Find, compare, and safely install MCP servers into DSH via DSH Market Pro (curated catalog + custom MCPs with credential templates & approval). / MCP \u9009\u578B\u4E0E\u5B89\u5168\u5B89\u88C5\u52A9\u624B\u3002";
export declare const MCP_SKILL_WHEN_TO_USE = "Invoke when finding, recommending, checking, installing, or toggling MCP servers in DSH. Skip for unrelated tasks.";
/** Build the model-facing instruction body for the built-in `dsh-market-pro` skill. */
export declare function buildMarketSkillContent(profile: string): string;
/** Build the model-facing instruction body for the built-in `dsh-mcp-pro` skill. */
export declare function buildMcpSkillContent(profile: string): string;
export interface MarketAiSkillDeps {
    readonly profile: string;
    readonly readSettings: () => SafeMarketSettings;
}
/**
 * Register the built-in `dsh-market-pro` and `dsh-mcp-pro` skills and keep
 * their visibility synced with `settings.aiAssistantEnabled`.
 */
export declare function registerMarketAiSkill(ctx: Context, deps: MarketAiSkillDeps): {
    sync(): void;
};
