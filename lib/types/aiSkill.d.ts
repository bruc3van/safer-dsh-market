/**
 * Built-in `dsh-market-pro` Agent Skill registered through `ctx.skills`.
 *
 * Uses `registerProvider` at `BUNDLED_SKILL_RANK` (600) so user-defined or
 * project-local skills with the same name can override it cleanly, and
 * invalidates live whenever `settings.aiAssistantEnabled` flips. Falls back
 * safely on hosts whose `skills` service lacks provider registration.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SafeMarketSettings } from './contract.ts';
export declare const MARKET_SKILL_NAME = "dsh-market-pro";
export declare const MARKET_SKILL_PROVIDER = "dsh-market-pro";
/** Matches `@deepseek-ai/dsh-skill`'s `BUNDLED_SKILL_RANK` without requiring a runtime import. */
export declare const MARKET_SKILL_RANK = 600;
export declare const MARKET_SKILL_DESCRIPTION = "Discover, compare, and recommend DSH plugins, MCP servers, and extensions from the DSH Market Pro catalog (curated picks + 28,000+ community repos), inspect installed capabilities, and guide safe installation via plugin_manager. / \u4F7F\u7528\u63D2\u4EF6\u5E02\u573APro\u5728\u5BF9\u8BDD\u4E2D\u67E5\u627E\u3001\u5BF9\u6BD4\u3001\u63A8\u8350 DSH \u63D2\u4EF6\u4E0E MCP\uFF0C\u5E76\u6307\u5BFC\u5B89\u5168\u5B89\u88C5\u4E0E\u5BA1\u67E5\u3002";
export declare const MARKET_SKILL_WHEN_TO_USE = "Use when the user wants to find, compare, or pick DSH plugins, MCP servers, or extensions for a task or workflow, asks what plugins exist in DSH Market Pro, or wants AI-assisted plugin recommendation, installation, or post-install security review. Do not invoke for unrelated coding or general tasks.";
/** Build the model-facing instruction body for the built-in `dsh-market-pro` skill. */
export declare function buildMarketSkillContent(profile: string): string;
export interface MarketAiSkillDeps {
    readonly profile: string;
    readonly readSettings: () => SafeMarketSettings;
}
/**
 * Register the built-in `dsh-market-pro` skill and keep its visibility synced
 * with `settings.aiAssistantEnabled`.
 */
export declare function registerMarketAiSkill(ctx: Context, deps: MarketAiSkillDeps): {
    sync(): void;
};
