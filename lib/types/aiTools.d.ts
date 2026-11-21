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
/** Structural subset of DSH's `ApprovalService` used before mutating installed plugins. */
export interface MarketApprovalServiceFace {
    request(request: {
        readonly agent: unknown;
        readonly toolName: string;
        readonly callId?: string;
        readonly reason: string;
        readonly displayReason: Readonly<{
            readonly zh: string;
            readonly en: string;
        }>;
        readonly signal?: AbortSignal;
    }): Promise<'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'>;
}
/** Structural subset of DSH's Host `pluginManager` service for update checks and batch updates. */
export interface HostPluginManagerUpdateFace {
    listBundles(): Promise<readonly {
        readonly name: string;
        readonly version?: string;
        readonly installed?: boolean;
        readonly update?: 'registry' | 'git';
    }[]>;
    listVersions?: (name: string, options?: object, signal?: AbortSignal) => Promise<{
        readonly status: 'listed';
        readonly installed: string;
        readonly registry: string | null;
        readonly versions: readonly {
            readonly version: string;
            readonly prerelease: boolean;
            readonly deprecated?: string;
            readonly bundle: boolean;
            readonly incompatible?: {
                readonly requirements: Readonly<Record<string, string>>;
            };
        }[];
    } | {
        readonly status: 'refused';
        readonly reason: string;
    }>;
    updateBundle?: (name: string, version: string, options?: {
        readonly registry?: string | null;
        readonly spec?: string;
        readonly requestId?: string;
    }) => Promise<{
        readonly from: string;
        readonly to: string;
        readonly step: string;
        readonly result: {
            readonly changed: boolean;
            readonly application: string;
            readonly stage?: string;
            readonly target?: string;
            readonly error?: {
                readonly code?: string;
                readonly diagnostic?: string;
            };
            readonly packageResult?: {
                readonly output?: string;
            };
            readonly output?: string;
        };
        readonly restore?: {
            readonly application: string;
        };
    }>;
}
/** Structural subset of DSH's Host `pluginMarket` service for Git subscription update discovery. */
export interface HostPluginMarketUpdateFace {
    listIndexes(): readonly {
        readonly url: string;
    }[] | Promise<readonly {
        readonly url: string;
    }[]>;
    search(url: string, query: {
        readonly text: string;
        readonly sort: {
            readonly kind: 'index';
        };
        readonly offset: number;
        readonly limit: number;
        readonly refresh?: boolean;
        readonly fetchedAt?: number;
    }): Promise<{
        readonly fetchedAt: number;
        readonly nextOffset: number | null;
        readonly entries: readonly {
            readonly name: string;
            readonly versions: readonly {
                readonly version: string;
                readonly update: boolean;
                readonly compatibility: {
                    readonly compatible: boolean;
                    readonly exempted?: boolean;
                };
                readonly install: {
                    readonly spec: string;
                };
            }[];
        }[];
    }>;
}
export interface MarketAiToolDeps {
    readonly profile: string;
    readonly readSettings: () => SafeMarketSettings;
    readonly readCatalog: (force: boolean, signal?: AbortSignal) => Promise<MarketCatalogResult>;
    readonly listInstalled: () => Promise<MarketInstalledResult>;
    readonly readMcp: () => McpHostContext;
    readonly pluginManager?: () => HostPluginManagerUpdateFace | undefined;
    readonly pluginMarket?: () => HostPluginMarketUpdateFace | undefined;
    readonly getApprover?: () => MarketApprovalServiceFace | undefined;
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
