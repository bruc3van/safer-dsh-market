/**
 * The market's actual body: mounts the `dshMarketPro` Typert Remote service
 * (the reduced community plugin catalog, the deployment's resolvable skills,
 * and the market's own durable settings) and registers its strict Typert
 * manifest. The client half ships in the same package (`./client`); the web
 * server serves it under /plugins/dsh-market-pro/client.js.
 *
 * The client can use the official pluginManager Remote for direct installs,
 * or stage a review prompt. This service owns the catalog and legacy management.
 *
 * DELIBERATELY NOT THE PACKAGE ENTRY. Everything that can fail to resolve on
 * an unfamiliar runtime is reached from here and from nowhere else: the
 * `defineDomain(...)` helper and the `TypertRemoteService` base class are
 * evaluated the moment this file is imported, and either missing throws. A throw at
 * import time fails the WHOLE plugin tree, taking the deployment's own
 * plugins and any CLI sharing the profile down with the market. So `index.ts`
 * imports this file dynamically, inside a guard: an incompatible runtime
 * costs the market and nothing else. See the note there.
 * @module dsh-market-pro/plugin
 */
import type {} from '@deepseek-ai/dsh-app-boot'
import { resolveActiveProfile } from './activeProfile.ts'
import { createRequire } from 'node:module'
import type { Context } from '@deepseek-ai/cordis'
// Type-only: brings the `ctx.typert` Context merge into this program.
import type {} from '@deepseek-ai/dsh-typert-registry'
// Type-only: brings the `ctx.settings` Context merge in.
import type {} from '@deepseek-ai/dsh-settings'
// Type-only: brings the `ctx.storageDomain` Context merge in.
import type {} from '@deepseek-ai/dsh-storage-domain'
// Type-only: brings the `ctx.loader` Context merge in.
import type {} from '@deepseek-ai/cordis-plugin-loader'
import { CATALOG_FORMAT, createCatalogSource, type CatalogCache } from './catalog.ts'
import { createInstalledManager } from './installed.ts'
import { SafeMarketRuntime } from './runtime.ts'
import { registerSafeMarketSettings } from './settings.ts'
import { readSkills } from './skills.ts'
import { adoptMcp, inspectMcpContext, type McpLoaderEntry } from './mcp.ts'
import { adoptDomainState, initialDomainState, safeMarketDomainSpec, type SafeMarketDomainState } from './store.ts'
import { TYPERT_MANIFEST } from './typert.ts'
import type { SafeMarketSettingsUpdate } from './contract.ts'
import { PACKAGE_NAME } from './shapes.ts'
import type { Config } from './index.ts'

/**
 * This package's own version, for the section header.
 *
 * Read from the manifest rather than baked in by the build, so there is no
 * third seat to drift (the build gate already pins package.json against
 * `dsh.plugin.json`). `../package.json` resolves to the package root from
 * both the bundle at `lib/plugin.js` and the source at `src/plugin.ts`, so
 * the value is the same under the Loader and under a source run. A market
 * that cannot read its own manifest still runs — the header just omits the
 * version.
 */
function readSelfVersion(): string {
  try {
    const manifest = createRequire(import.meta.url)('../package.json') as { version?: unknown }
    return typeof manifest.version === 'string' ? manifest.version : ''
  } catch (error) {
    console.warn('[dsh-market-pro] could not read own version:', error)
    return ''
  }
}

/**
 * Mount the market service.
 * @param ctx - host cordis context.
 * @param resolved - plugin configuration, already validated by the entry.
 * @returns a disposer for the entry's effect seat.
 */
export function applyMarket(ctx: Context, resolved: Config): () => void {
  const profile = resolveActiveProfile(ctx.get('profileContext'), resolved.profile)
  // The durable enable switch: the runtime reads its live value on every
  // call, so toggling it in the Web settings takes effect immediately.
  const settings = registerSafeMarketSettings(ctx, resolved)
  const readSettings = () => settings.get()
  const writeSettings = async (update: SafeMarketSettingsUpdate) => {
    // Write the field the update names. The wire codec (a discriminated
    // union) has already rejected any unknown field, so the computed key can
    // only be a real one — and the day a second field joins the union, it is
    // written under its own name instead of silently becoming `enabled`.
    await settings.update({ [update.field]: update.value })
    return settings.get()
  }

  // The reduction's durable seat. The domain opens asynchronously, so the
  // cache port answers from memory until it is there — a market opened in the
  // first moments of boot waits briefly for the domain to open instead of
  // bypassing a warm disk cache with a cold network download.
  let state: SafeMarketDomainState = initialDomainState
  let persist: ((next: SafeMarketDomainState) => void) | undefined
  const disposeController = new AbortController()
  let resolveDomainReady!: () => void
  const domainReady = new Promise<void>((resolve) => { resolveDomainReady = resolve })
  // A stored reduction answers a different question than the current config
  // asked, so only adopt state cut with the same market size and base — and
  // derived by a parse of the same shape as this build's.
  const usable = (candidate: SafeMarketDomainState): boolean =>
    candidate.catalog !== null && candidate.catalogFormat === CATALOG_FORMAT
    && candidate.marketSize === resolved.marketSize && candidate.catalogBase === resolved.catalogBase
  const cache: CatalogCache = {
    ready: domainReady,
    read: () => (
      usable(state)
        ? { catalog: state.catalog, marketEtag: state.marketEtag, activeBase: state.activeBase }
        : { catalog: null, marketEtag: '', activeBase: '' }
    ),
    write: (next) => {
      state = {
        ...state,
        catalog: next.catalog,
        marketEtag: next.marketEtag,
        activeBase: next.activeBase,
        catalogFormat: CATALOG_FORMAT,
        marketSize: resolved.marketSize,
        catalogBase: resolved.catalogBase,
      }
      persist?.(state)
    },
  }

  const catalog = createCatalogSource({
    base: resolved.catalogBase,
    marketSize: resolved.marketSize,
    cache,
    disposeSignal: disposeController.signal,
  })

  // The installed panel uses native bundle management when available. Its
  // desktop seats and legacy profiles still use the profile patch and Loader.
  // The pending-uninstall record lives in a
  // small file under the harness home — deliberately NOT in the storage
  // domain — so the boot sweep runs even when the domain is unavailable:
  // losing the record is what strands stop rows in the user's patch file.
  const installed = createInstalledManager({
    profile: profile.name,
    profileDir: profile.dir,
    home: profile.home,
    selfName: PACKAGE_NAME,
    loader: ctx.loader,
    pluginManager: () => ctx.get('pluginManager'),
    notifyLegacyChange: reason => ctx.emit('plugin-manager/changed', { reason }),
  })

  ctx.effect(async () => {
    try {
      const domain = await ctx.storageDomain.open(safeMarketDomainSpec)
      persist = (next) => {
        // Durability is an optimization, and a failed write must not take the
        // market down with it — the reduction is still in memory either way.
        void domain.global.set(next).catch((error: unknown) => {
          console.warn('[dsh-market-pro] catalog cache write failed:', error)
        })
      }
      const stored = domain.global.get()
      const hadMemoryCatalog = state.catalog !== null
      state = adoptDomainState(state, stored, usable)
      resolveDomainReady()
      if (hadMemoryCatalog || (state.catalog !== null && stored.catalog !== null && state.catalog !== stored.catalog)) {
        // A read landed while the domain was opening, or the adopted disk
        // catalog was compacted (legacy subscription stripped): flush now
        // instead of keeping stale or bloated data on disk.
        persist(state)
      }
      if (readSettings().enabled) catalog.warmup()
      // A pending-uninstall record an older build kept in the domain store:
      // seed the file seat so this boot's sweep still takes its rows back,
      // then forget the field — the file is the seat from now on.
      const legacy = state.pendingUninstall
      if (legacy.length > 0) {
        await installed.adoptPending(legacy)
        state = { ...state, pendingUninstall: [] }
        persist?.(state)
      }
      // Take back last session's uninstall stop rows before serving: the
      // composition no longer carries their targets (or a reinstall wants
      // them gone), and the user's patch file should not keep our litter.
      await installed.sweep()
      return () => {
        disposeController.abort()
        resolveDomainReady()
        persist = undefined
        void domain.close()
      }
    } catch (error) {
      resolveDomainReady()
      // A damaged or version-mismatched store must not take the market down
      // with it: the catalog and the skills page still run from memory, and
      // the next successful read simply cannot survive the restart.
      console.warn('[dsh-market-pro] catalog cache unavailable, running memory-only:', error)
      if (readSettings().enabled) catalog.warmup()
      // The pending-uninstall seat is a file, not this domain: the sweep still
      // runs and takes last session's stop rows back out of the patch layer.
      await installed.sweep()
      return () => {
        disposeController.abort()
        resolveDomainReady()
        persist = undefined
      }
    }
  }, 'dsh-market-pro: catalog cache')

  new SafeMarketRuntime(
    ctx,
    catalog,
    readSettings,
    writeSettings,
    (sessionId, signal) => readSkills(ctx, sessionId, signal),
    { profile: profile.name, version: readSelfVersion() },
    installed,
    () => inspectMcpContext(ctx, ctx.loader.entries() as Iterable<McpLoaderEntry>),
    loaderId => adoptMcp(ctx, ctx.loader.entries() as Iterable<McpLoaderEntry>, loaderId),
  )

  // Strict endpoint registration: the gateway resolves the market's calls
  // from this manifest, independent of decorator marker state.
  ctx.effect(() => {
    const dispose = ctx.typert.register(TYPERT_MANIFEST)
    return () => { void dispose() }
  }, 'dsh-market-pro: typert manifest')

  // Everything above is owned by `ctx` and torn down with the fiber; abort
  // any in-flight catalog refresh immediately so teardown never waits on I/O.
  return () => {
    disposeController.abort()
    resolveDomainReady()
  }
}
