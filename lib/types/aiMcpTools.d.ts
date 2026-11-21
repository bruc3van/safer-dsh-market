/**
 * Agent-native `dsh_mcp_pro` tool registered into the Host tool registry when
 * `ctx.tools` is available and `settings.aiAssistantEnabled` is on.
 *
 * - Read actions (`list_featured`, `search_featured`, `detail`, `list_configured`)
 *   are concurrency-safe, read-only, and require no approval.
 * - Mutating actions (`install_featured`, `install_custom`, `set_enabled`)
 *   always fail closed through the Host's native `approval` service before
 *   mutating `dsh-mcp-manager` Settings, and reject any plaintext secrets.
 *
 * Deliberately imports nothing from `@deepseek-ai/dsh-tools` or
 * `@deepseek-ai/dsh-sandbox` at runtime so older/minimal DSH hosts boot cleanly.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SafeMarketSettings } from './contract.ts';
import { type ManagedMcpInspection, type ManagedMcpInstallPlan, type ManagedMcpInstallResult, type McpLoaderEntry } from './mcp.ts';
export declare const MCP_TOOL_NAME = "dsh_mcp_pro";
export declare const MAX_AI_MCP_QUERIES = 3;
export declare const MAX_AI_MCP_DETAILS = 6;
export declare const MAX_AI_MCP_LIMIT = 50;
/** Wrap model-facing MCP discovery/result output in an unforgeable untrusted-data boundary. */
export declare function wrapUntrustedMcpData(payload: string): string;
/** Structural subset of DSH's `ApprovalService`. */
export interface McpApprovalServiceFace {
    request(req: {
        readonly agent: unknown;
        readonly toolName: string;
        readonly callId?: string;
        readonly reason: string;
        readonly displayReason?: Readonly<Record<string, string>>;
        readonly signal?: AbortSignal;
    }): Promise<'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'>;
}
export interface McpToolExecContext {
    readonly agent?: unknown;
    readonly callId?: string;
    readonly signal?: AbortSignal;
}
export interface MarketAiMcpToolDeps {
    readonly profile: string;
    readonly readSettings: () => SafeMarketSettings;
    readonly inspectMcp: () => ManagedMcpInspection;
    readonly installMcp: (plan: ManagedMcpInstallPlan) => Promise<ManagedMcpInstallResult>;
    readonly setMcpEnabled: (name: string, enabled: boolean) => Promise<{
        readonly name: string;
        readonly enabled: boolean;
    }>;
    readonly getApprover: () => McpApprovalServiceFace | undefined;
}
/** Build the registry-ready `dsh_mcp_pro` tool definition. */
export declare function createMarketAiMcpToolDefinition(deps: MarketAiMcpToolDeps): Record<string, unknown>;
/**
 * Mount the `dsh_mcp_pro` tool when `ctx.tools` is available and keep its
 * registration synchronized with `settings.aiAssistantEnabled`.
 */
export declare function registerMarketAiMcpTool(ctx: Context, deps: {
    readonly profile: string;
    readonly readSettings: () => SafeMarketSettings;
    readonly entries: () => Iterable<McpLoaderEntry>;
}): {
    sync(): void;
};
