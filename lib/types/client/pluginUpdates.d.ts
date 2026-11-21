/** Update discovery and replacement use the official Host's package identities and decisions. */
import type { BundleInfo, MarketIndexSummary, MarketQuery, MarketSearchResult, PluginInstallRequestId, PluginUpdateProgress, PluginUpdateResult, PluginVersionList, Registry } from '@deepseek-ai/dsh-api-remotes/client';
type Reply<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: {
        message: string;
    };
};
export interface UpdateHost {
    listBundles(): Promise<Reply<readonly Pick<BundleInfo, 'name' | 'version' | 'installed' | 'update'>[]>>;
    listVersions(name: string, options: object): Promise<Reply<PluginVersionList>>;
    updateBundle(name: string, version: string, options: {
        registry?: Registry;
        spec?: string;
        requestId: PluginInstallRequestId;
    }): Promise<Reply<PluginUpdateResult>>;
}
export interface UpdateMarketHost {
    listIndexes(): Promise<Reply<readonly MarketIndexSummary[]>>;
    search(url: string, query: MarketQuery): Promise<Reply<MarketSearchResult>>;
}
export interface UpdateChoice {
    version: string;
    prerelease: boolean;
    deprecated?: string;
    blocked?: string;
    source: {
        registry: Registry;
    } | {
        spec: string;
        index: string;
    };
}
export interface AvailableUpdate {
    readonly packageName: string;
    readonly installed: string;
    readonly version: string;
    readonly kind: 'registry' | 'git';
    readonly source: UpdateChoice['source'];
}
export type BatchItemStatus = 'pending' | 'running' | 'applied' | 'restart-required' | 'overridden' | 'cancelled' | 'failed' | 'unknown' | 'skipped';
export interface BatchUpdateItem {
    readonly packageName: string;
    readonly from: string;
    readonly to: string;
    readonly kind: 'registry' | 'git';
    readonly source: UpdateChoice['source'];
    readonly self: boolean;
    readonly status: BatchItemStatus;
    readonly step?: PluginUpdateProgress['step'];
    readonly message?: string;
    readonly restoreApplication?: 'applied' | 'restart-required' | 'overridden' | 'cancelled' | 'failed';
    readonly result?: PluginUpdateResult;
}
export interface BatchUpdateState {
    readonly phase: 'idle' | 'running' | 'done';
    readonly items: readonly BatchUpdateItem[];
    readonly currentIndex: number;
    readonly stopRequested: boolean;
}
export interface UpdateState {
    phase: 'idle' | 'checking' | 'ready' | 'updating' | 'done' | 'error' | 'unknown';
    packageName: string;
    installed: string;
    kind?: 'registry' | 'git';
    choices: readonly UpdateChoice[];
    selected: string;
    message: string;
    warnings: readonly string[];
    omitted: number;
    step?: PluginUpdateProgress['step'];
    result?: PluginUpdateResult;
    /** Every settled update invalidates installed facts, including a failed update with restoration. */
    revision: number;
    /** Newest compatible stable version detected per installed package name. */
    available: Readonly<Record<string, string>>;
    /** Resolved update targets for one-click batch updates without a second lookup. */
    availableDetails: Readonly<Record<string, AvailableUpdate>>;
    /** Sequential batch update queue (skips failures, orders self last). */
    batch: BatchUpdateState;
}
/** Keep caller order while always placing the marketplace itself last so a self-reload cannot interrupt earlier updates. */
export declare function orderBatchTargets<T extends {
    readonly packageName: string;
}>(items: readonly T[], selfName: string): T[];
/** One shared operation survives switching between the market's three entry points. */
export declare function createPluginUpdater(host: () => UpdateHost | undefined, market: () => UpdateMarketHost | undefined): {
    getSnapshot: () => UpdateState;
    subscribe: (listener: () => void) => () => void;
    probe(packageNames?: readonly string[]): Promise<void>;
    check(packageName: string): Promise<void>;
    select(version: string): void;
    confirm(): Promise<void>;
    startBatch(targets: readonly (string | AvailableUpdate)[], selfName?: string): Promise<void>;
    requestStopBatch(): void;
    resetBatch(): void;
    progress(event: PluginUpdateProgress): void;
    close(): void;
};
export type PluginUpdater = ReturnType<typeof createPluginUpdater>;
export {};
