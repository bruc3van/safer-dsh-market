/**
 * The client-side Typert Remote contribution for the saferMarket host service:
 * mounts the shared strict descriptors into `ctx.remote.saferMarket`. The
 * descriptors and codecs come from the shared contract module, so the browser
 * bundle and the host manifest stay on one wire definition.
 */
import type { RemoteResult, TypertRemoteContribution } from '@deepseek-ai/dsh-typert-protocol'
import { SAFE_MARKET_INVOCATIONS } from '../contract.ts'
import type {
  MarketCatalogResult,
  MarketEnvironment,
  MarketInstalledResult,
  MarketSkillsResult,
  SafeMarketSettings,
  SafeMarketSettingsUpdate,
  SetInstalledEnabledUpdate,
  UninstallInstalledUpdate,
} from '../contract.ts'

/** The saferMarket Remote namespace's client contribution. */
export const SAFE_MARKET_REMOTE: TypertRemoteContribution = {
  package: 'safer-dsh-market',
  descriptors: SAFE_MARKET_INVOCATIONS,
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  // Typed face of the mounted namespace. Note: the runtime access is NOT the
  // dotted `ctx.remote.saferMarket` read — that path walks the cordis fiber
  // chain and stops at the Loader's runtime-less internal forks between a
  // plugin entry and the root fiber. The plugin resolves the namespace
  // service through `ctx.reflect.get('remote.saferMarket')` instead
  // (see client/index.ts).
  /** The `saferMarket` namespace face mounted under `ctx.remote.saferMarket`. */
  interface TypertRemoteNamespace$736166654d61726b6574 {
    getCatalog: (force: boolean, signal?: AbortSignal) => Promise<RemoteResult<MarketCatalogResult>>
    // The `agent` lookup parameter marshals as the first positional argument
    // (its wire field is `agentId`), before the cancellation signal.
    listSkills: (agentId: string, signal?: AbortSignal) => Promise<RemoteResult<MarketSkillsResult>>
    describe: () => Promise<RemoteResult<MarketEnvironment>>
    getSettings: () => Promise<RemoteResult<SafeMarketSettings>>
    updateSettings: (update: SafeMarketSettingsUpdate) => Promise<RemoteResult<SafeMarketSettings>>
    listInstalled: () => Promise<RemoteResult<MarketInstalledResult>>
    setInstalledEnabled: (update: SetInstalledEnabledUpdate) => Promise<RemoteResult<MarketInstalledResult>>
    uninstallInstalled: (update: UninstallInstalledUpdate) => Promise<RemoteResult<MarketInstalledResult>>
  }
  interface TypertRemoteMap {
    'saferMarket/getCatalog': (force: boolean, signal?: AbortSignal) => Promise<RemoteResult<MarketCatalogResult>>
    'saferMarket/listSkills': (agentId: string, signal?: AbortSignal) => Promise<RemoteResult<MarketSkillsResult>>
    'saferMarket/describe': () => Promise<RemoteResult<MarketEnvironment>>
    'saferMarket/getSettings': () => Promise<RemoteResult<SafeMarketSettings>>
    'saferMarket/updateSettings': (update: SafeMarketSettingsUpdate) => Promise<RemoteResult<SafeMarketSettings>>
    'saferMarket/listInstalled': () => Promise<RemoteResult<MarketInstalledResult>>
    'saferMarket/setInstalledEnabled': (update: SetInstalledEnabledUpdate) => Promise<RemoteResult<MarketInstalledResult>>
    'saferMarket/uninstallInstalled': (update: UninstallInstalledUpdate) => Promise<RemoteResult<MarketInstalledResult>>
  }
  interface TypertRemoteNamespaceMap {
    saferMarket: TypertRemoteNamespace$736166654d61726b6574
  }
}
