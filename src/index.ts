/**
 * safer-dsh-market host plugin: the package entry, and deliberately
 * nothing more than a guard around the real body in `./plugin.ts`.
 *
 * The market is seated into a profile that ANY dsh installation may boot —
 * the desktop client copies it into `<DSH_HOME>/profiles/node_modules`, where
 * its `@deepseek-ai/*` imports resolve upward to whichever runtime is
 * serving, exactly like a plugin installed with `dsh plugin add`. That is
 * what lets one copy work across the bundled runtime, a dsh on PATH, and an
 * npx-cached one. It also means the market can meet a runtime it was never
 * built against, with no client present to withdraw it.
 *
 * Two of its imports are evaluated at import time and would throw on an
 * unsupported runtime: `defineDomain(...)` and the `TypertRemoteService`
 * base class. A throw during import does not fail
 * just this plugin — it fails the WHOLE plugin tree, so the deployment's own
 * plugins die with the market, and so does any CLI sharing the profile.
 *
 * Hence the split. This file touches only what is bundled into its own
 * artifact (schemastery and configuration constants) and reaches the body
 * through a dynamic import inside `ctx.effect`. On a runtime that cannot
 * satisfy it, the import rejects, the market says so once, and every other
 * plugin boots untouched.
 *
 * `name`, `inject` and `Config` stay here because the Loader reads them
 * before deciding to load anything at all.
 * @module safer-dsh-market
 */
import type { Context, Volatile } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { DEFAULT_CATALOG_BASE } from './catalog.ts'
import { PACKAGE_NAME, PROFILE_NAME_PATTERN } from './shapes.ts'

/** Cordis plugin name (the Loader entry and client bundle id). */
export const name = PACKAGE_NAME

/**
 * Services required before load. `skills` and `storageDomain` join the
 * settings and Typert seats: the market lists what this deployment can
 * resolve, and keeps its reduction across restarts. `loader` is the installed
 * panel's live view of the entry tree its enable/disable verbs nudge.
 *
 * These are also the market's first line of compatibility defence, and the
 * gentle one: a runtime that publishes none of them simply never calls
 * `apply`, with no error anywhere. The guard below covers the harsher case —
 * the services exist, but a module the body imports does not.
 */
export const inject = ['typert', 'settings', 'skills', 'storageDomain', 'loader']

export type {
  MarketCatalog,
  MarketCatalogResult,
  MarketCategory,
  MarketEnvironment,
  MarketPlugin,
  MarketSkill,
  MarketSkillsResult,
  SafeMarketSettings,
} from './contract.ts'

/** Host plugin configuration, validated at load by the Loader. */
export interface Config {
  /** Live, profile-persisted permission to fetch the community catalog. */
  enabled: Volatile<boolean>
  /** A complete JSON feed URL, or a directory containing market.json. */
  catalogBase: string
  /** How many plugins the market shows. */
  marketSize: number
  /**
   * The profile an install would change. It names the `--profile` argument in
   * the review prompt's install command. Used only when the host has no profileContext;
   * an empty value requires automatic detection.
   */
  profile: string
}

/**
 * Configuration schema. Every field is deployment-varying: a fork can point
 * the market at its own curation, a smaller list suits a smaller window, and
 * a deployment booting a differently-named profile must not hand the user a
 * command aimed at someone else's.
 */
export const Config = z.object({
  enabled: z.boolean().default(false).volatile(),
  catalogBase: z.string().default(DEFAULT_CATALOG_BASE),
  marketSize: z.natural().min(1).default(1000),
  profile: z.string().default(''),
})

/**
 * Load the market, or decline to on a runtime that cannot carry it.
 *
 * The specifier is the built artifact's own sibling (`./plugin.js`), kept out
 * of this bundle so the import is a real runtime resolution rather than an
 * inlined module the bundler would have evaluated eagerly — which is the
 * whole point of the split.
 * @param ctx - host cordis context.
 * @param config - Loader-validated configuration, retaining its live references.
 */
export function apply(ctx: Context, config?: Config): void {
  const resolved: Config = config ?? Config({})
  // The profile is the one configured value that leaves this process as
  // prompt text: it names `--profile` in the install command staged into the
  // composer. `resolveProfileDir` holds it to the launcher's directory rules,
  // which admit a name with a space in it; an instruction the user is one
  // keystroke from sending must not be able to carry a second word. Config is
  // not remote text, so this is defence in depth — and the market declines
  // rather than staging a command aimed at something it cannot name.
  if (resolved.profile !== '' && !PROFILE_NAME_PATTERN.test(resolved.profile)) {
    console.error('[safer-dsh-market] refusing to start: the configured profile name '
      + `${JSON.stringify(resolved.profile)} is not a plain profile name, and it would be interpolated `
      + 'into the install command this market stages for review')
    return
  }
  ctx.effect(async () => {
    // Two guards, because the two phases fail for unrelated reasons and the
    // difference is the whole diagnostic value of this file. Importing the
    // body is where an unfamiliar runtime announces itself: the module's own
    // evaluation is what resolves `defineDomain` and `TypertRemoteService`,
    // so a missing module, a missing named export and
    // a "not a function" all land here. Running the body is ordinary plugin
    // work, and a throw from it is this market's bug.
    let body: { applyMarket: (ctx: Context, config: Config) => () => void }
    try {
      body = await import('./plugin.js') as typeof body
    } catch (error) {
      // One line, then out of the way. This is the runtime saying it is not
      // the one this build was made for; every other plugin is unaffected,
      // which is the only outcome that matters here.
      console.warn('[safer-dsh-market] this dsh runtime cannot load the marketplace, skipping it:',
        error instanceof Error ? error.message : String(error))
      return () => {}
    }
    try {
      return body.applyMarket(ctx, resolved)
    } catch (error) {
      // Deliberately NOT the message above. Blaming the runtime for the
      // market's own fault sends whoever reads this log looking for a
      // compatibility problem that does not exist — and the body loaded
      // fine, which is the one thing that message would have ruled out. The
      // whole error goes out, stack included: nobody is coming back to
      // reproduce this.
      console.error('[safer-dsh-market] the marketplace failed to start on a runtime that loaded it; '
        + 'this is a fault in the marketplace, not in the runtime:', error)
      return () => {}
    }
  }, 'safer-dsh-market: load')
}
