/**
 * The client-side Typert Remote contribution for the saferMarket host service:
 * mounts the shared strict descriptors into `ctx.remote.saferMarket`. The
 * descriptors and codecs come from the shared contract module, so the browser
 * bundle and the host manifest stay on one wire definition.
 */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol';
import type { MarketCatalogResult, MarketEnvironment, MarketInstalledResult, MarketSkillsResult, SafeMarketSettings, SafeMarketSettingsUpdate, SetInstalledEnabledUpdate, UninstallInstalledUpdate } from '../contract.ts';
/** The saferMarket Remote namespace's client contribution. */
export declare const SAFE_MARKET_REMOTE: TypertRemoteContribution;
declare module '@deepseek-ai/dsh-typert-protocol' {
    /** The `saferMarket` namespace face mounted under `ctx.remote.saferMarket`. */
    interface TypertRemoteNamespace$736166654d61726b6574 {
        getCatalog: (force: boolean, signal?: AbortSignal) => Promise<RemoteResult<MarketCatalogResult>>;
        listSkills: (agentId: string, signal?: AbortSignal) => Promise<RemoteResult<MarketSkillsResult>>;
        describe: () => Promise<RemoteResult<MarketEnvironment>>;
        getSettings: () => Promise<RemoteResult<SafeMarketSettings>>;
        updateSettings: (update: SafeMarketSettingsUpdate) => Promise<RemoteResult<SafeMarketSettings>>;
        listInstalled: () => Promise<RemoteResult<MarketInstalledResult>>;
        setInstalledEnabled: (update: SetInstalledEnabledUpdate) => Promise<RemoteResult<MarketInstalledResult>>;
        uninstallInstalled: (update: UninstallInstalledUpdate) => Promise<RemoteResult<MarketInstalledResult>>;
    }
    interface TypertRemoteMap {
        'saferMarket/getCatalog': (force: boolean, signal?: AbortSignal) => Promise<RemoteResult<MarketCatalogResult>>;
        'saferMarket/listSkills': (agentId: string, signal?: AbortSignal) => Promise<RemoteResult<MarketSkillsResult>>;
        'saferMarket/describe': () => Promise<RemoteResult<MarketEnvironment>>;
        'saferMarket/getSettings': () => Promise<RemoteResult<SafeMarketSettings>>;
        'saferMarket/updateSettings': (update: SafeMarketSettingsUpdate) => Promise<RemoteResult<SafeMarketSettings>>;
        'saferMarket/listInstalled': () => Promise<RemoteResult<MarketInstalledResult>>;
        'saferMarket/setInstalledEnabled': (update: SetInstalledEnabledUpdate) => Promise<RemoteResult<MarketInstalledResult>>;
        'saferMarket/uninstallInstalled': (update: UninstallInstalledUpdate) => Promise<RemoteResult<MarketInstalledResult>>;
    }
    interface TypertRemoteNamespaceMap {
        saferMarket: TypertRemoteNamespace$736166654d61726b6574;
    }
}
