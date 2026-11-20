/**
 * The client-side Typert Remote contribution for the dshMarketPro host service:
 * mounts the shared strict descriptors into `ctx.remote.dshMarketPro`. The
 * descriptors and codecs come from the shared contract module, so the browser
 * bundle and the host manifest stay on one wire definition.
 */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { McpHostContext, MarketCatalogResult, MarketEnvironment, MarketInstalledResult, MarketSkillsResult, SafeMarketSettings, SafeMarketSettingsUpdate, SetInstalledEnabledUpdate, UninstallInstalledUpdate } from '../contract.ts';
/** The dshMarketPro Remote namespace's client contribution. */
export declare const SAFE_MARKET_REMOTE: TypertRemoteContribution;
declare module '@deepseek-ai/dsh-typert-protocol' {
    /** The `dshMarketPro` namespace face mounted under `ctx.remote.dshMarketPro`. */
    interface TypertRemoteNamespace$6473684d61726b657450726f {
        getCatalog: (force: boolean, signal?: AbortSignal) => Promise<RemoteResult<MarketCatalogResult>>;
        listSkills: (sessionId: string, signal?: AbortSignal) => Promise<RemoteResult<MarketSkillsResult>>;
        describe: () => Promise<RemoteResult<MarketEnvironment>>;
        getSettings: () => Promise<RemoteResult<SafeMarketSettings>>;
        updateSettings: (update: SafeMarketSettingsUpdate) => Promise<RemoteResult<SafeMarketSettings>>;
        listInstalled: () => Promise<RemoteResult<MarketInstalledResult>>;
        setInstalledEnabled: (update: SetInstalledEnabledUpdate) => Promise<RemoteResult<MarketInstalledResult>>;
        uninstallInstalled: (update: UninstallInstalledUpdate) => Promise<RemoteResult<MarketInstalledResult>>;
        inspectMcp: () => Promise<RemoteResult<McpHostContext>>;
    }
    interface TypertRemoteMap {
        'dshMarketPro/getCatalog': (force: boolean, signal?: AbortSignal) => Promise<RemoteResult<MarketCatalogResult>>;
        'dshMarketPro/listSkills': (sessionId: string, signal?: AbortSignal) => Promise<RemoteResult<MarketSkillsResult>>;
        'dshMarketPro/describe': () => Promise<RemoteResult<MarketEnvironment>>;
        'dshMarketPro/getSettings': () => Promise<RemoteResult<SafeMarketSettings>>;
        'dshMarketPro/updateSettings': (update: SafeMarketSettingsUpdate) => Promise<RemoteResult<SafeMarketSettings>>;
        'dshMarketPro/listInstalled': () => Promise<RemoteResult<MarketInstalledResult>>;
        'dshMarketPro/setInstalledEnabled': (update: SetInstalledEnabledUpdate) => Promise<RemoteResult<MarketInstalledResult>>;
        'dshMarketPro/uninstallInstalled': (update: UninstallInstalledUpdate) => Promise<RemoteResult<MarketInstalledResult>>;
        'dshMarketPro/inspectMcp': () => Promise<RemoteResult<McpHostContext>>;
    }
    interface TypertRemoteNamespaceMap {
        dshMarketPro: TypertRemoteNamespace$6473684d61726b657450726f;
    }
}
