/**
 * The client-side Typert Remote contribution for the dshMarketPro host service:
 * mounts the shared strict descriptors into `ctx.remote.dshMarketPro`. The
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

/** The dshMarketPro Remote namespace's client contribution. */
export const SAFE_MARKET_REMOTE: TypertRemoteContribution = {
  package: 'dsh-market-pro',
  descriptors: SAFE_MARKET_INVOCATIONS,
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  // Typed face of the mounted namespace. Note: the runtime access is NOT the
  // dotted `ctx.remote.dshMarketPro` read — that path walks the cordis fiber
  // chain and stops at the Loader's runtime-less internal forks between a
  // plugin entry and the root fiber. The plugin resolves the namespace
  // service through `ctx.reflect.get('remote.dshMarketPro')` instead
  // (see client/index.ts).
  /** The `dshMarketPro` namespace face mounted under `ctx.remote.dshMarketPro`. */
  interface TypertRemoteNamespace$6473684d61726b657450726f {
    getCatalog: (force: boolean, signal?: AbortSignal) => Promise<RemoteResult<MarketCatalogResult>>
    // The Session id marshals as the first positional argument (wire field
    // `sessionId`), before the cancellation signal.
    listSkills: (sessionId: string, signal?: AbortSignal) => Promise<RemoteResult<MarketSkillsResult>>
    describe: () => Promise<RemoteResult<MarketEnvironment>>
    getSettings: () => Promise<RemoteResult<SafeMarketSettings>>
    updateSettings: (update: SafeMarketSettingsUpdate) => Promise<RemoteResult<SafeMarketSettings>>
    listInstalled: () => Promise<RemoteResult<MarketInstalledResult>>
    setInstalledEnabled: (update: SetInstalledEnabledUpdate) => Promise<RemoteResult<MarketInstalledResult>>
    uninstallInstalled: (update: UninstallInstalledUpdate) => Promise<RemoteResult<MarketInstalledResult>>
  }
  interface TypertRemoteMap {
    'dshMarketPro/getCatalog': (force: boolean, signal?: AbortSignal) => Promise<RemoteResult<MarketCatalogResult>>
    'dshMarketPro/listSkills': (sessionId: string, signal?: AbortSignal) => Promise<RemoteResult<MarketSkillsResult>>
    'dshMarketPro/describe': () => Promise<RemoteResult<MarketEnvironment>>
    'dshMarketPro/getSettings': () => Promise<RemoteResult<SafeMarketSettings>>
    'dshMarketPro/updateSettings': (update: SafeMarketSettingsUpdate) => Promise<RemoteResult<SafeMarketSettings>>
    'dshMarketPro/listInstalled': () => Promise<RemoteResult<MarketInstalledResult>>
    'dshMarketPro/setInstalledEnabled': (update: SetInstalledEnabledUpdate) => Promise<RemoteResult<MarketInstalledResult>>
    'dshMarketPro/uninstallInstalled': (update: UninstallInstalledUpdate) => Promise<RemoteResult<MarketInstalledResult>>
  }
  interface TypertRemoteNamespaceMap {
    dshMarketPro: TypertRemoteNamespace$6473684d61726b657450726f
  }
}
