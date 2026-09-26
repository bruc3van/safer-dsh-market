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
import type { Context, Volatile } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
/** Cordis plugin name (the Loader entry and client bundle id). */
export declare const name = "safer-dsh-market";
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
export declare const inject: string[];
export type { MarketCatalog, MarketCatalogResult, MarketCategory, MarketEnvironment, MarketPlugin, MarketSkill, MarketSkillsResult, SafeMarketSettings, } from './contract.ts';
/** Host plugin configuration, validated at load by the Loader. */
export interface Config {
    /** Live, profile-persisted permission to fetch the community catalog. */
    enabled: Volatile<boolean>;
    /** A complete JSON feed URL, or a directory containing market.json. */
    catalogBase: string;
    /** How many plugins the market shows. */
    marketSize: number;
    /**
     * The profile an install would change. It names the `--profile` argument in
     * the review prompt's install command. Used only when the host has no profileContext;
     * an empty value requires automatic detection.
     */
    profile: string;
}
/**
 * Configuration schema. Every field is deployment-varying: a fork can point
 * the market at its own curation, a smaller list suits a smaller window, and
 * a deployment booting a differently-named profile must not hand the user a
 * command aimed at someone else's.
 */
export declare const Config: z<Schemastery.ObjectS<NoInfer<{
    enabled: z<boolean, boolean, "volatile-defined">;
    catalogBase: z<string, string, "defined">;
    marketSize: z<number, number, "defined">;
    profile: z<string, string, "defined">;
}>>, Schemastery.ObjectT<NoInfer<{
    enabled: z<boolean, boolean, "volatile-defined">;
    catalogBase: z<string, string, "defined">;
    marketSize: z<number, number, "defined">;
    profile: z<string, string, "defined">;
}>>, "plain">;
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
export declare function apply(ctx: Context, config?: Config): void;
