/**
 * The safe-market Host Remote service (`ctx.saferMarket`, wire namespace
 * `saferMarket`). Registered as a TypertRemoteService so the Host Gateway
 * exports its `@Remote` methods to the Web client under
 * `/api/saferMarket/<method>`.
 *
 * The catalog read lives here rather than in the browser for two reasons:
 * the crawl is 2.4 MB and the browser needs 1000 rows of it, and the rows
 * carry remote text whose sanitizing belongs on one side of the wire, not in
 * every renderer that touches them.
 */
import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { CatalogSource } from './catalog.ts';
import type { InstalledManager } from './installed.ts';
import type { SkillReadAgent } from './skills.ts';
import type { MarketCatalogResult, MarketEnvironment, MarketInstalledResult, MarketSkillsResult, SafeMarketSettings, SafeMarketSettingsUpdate, SetInstalledEnabledUpdate, UninstallInstalledUpdate } from './contract.ts';
/** Market service: the reduced catalog, the plugin's durable settings, and the installed-panel verbs. */
export declare class SafeMarketRuntime extends TypertRemoteService {
    private readonly catalog;
    private readonly readSettings;
    private readonly writeSettings;
    private readonly readSkills;
    private readonly environment;
    private readonly installed;
    /**
     * Register the service under the `saferMarket` key (the wire namespace).
     * @param ctx - owning cordis context.
     * @param catalog - the catalog reader.
     * @param readSettings - live settings read.
     * @param writeSettings - durable settings write.
     * @param installed - the installed-plugin manager.
     */
    constructor(ctx: Context, catalog: CatalogSource, readSettings: () => SafeMarketSettings, writeSettings: (update: SafeMarketSettingsUpdate) => Promise<SafeMarketSettings>, readSkills: (agent: SkillReadAgent, signal: AbortSignal) => Promise<MarketSkillsResult>, environment: MarketEnvironment, installed: InstalledManager);
    /**
     * The deployment facts the browser needs to NAME the install command —
     * which profile an install would change. This plugin never runs it.
     */
    describe(): MarketEnvironment;
    /**
     * The skills the addressed session can currently resolve.
     *
     * Read-only, and deliberately not gated on the market switch: listing what
     * is already installed reaches nothing outside this machine, so it answers
     * whether or not the user has turned the catalog on.
     * @param agent - the live agent resolved from the `agentId` wire field; its
     *   scope chain selects the layers, its session header the workspace.
     * @param signal - caller lifetime; discovery races it.
     * @returns the merged skill list, and whether discovery was complete.
     */
    listSkills(agent: SkillReadAgent, signal: AbortSignal): Promise<MarketSkillsResult>;
    /** Read the resolved durable settings through the plugin-owned wire. */
    getSettings(): SafeMarketSettings;
    /** Persist one settings field and return the resolved section. */
    updateSettings(update: SafeMarketSettingsUpdate): Promise<SafeMarketSettings>;
    /**
     * Read the reduced community catalog.
     *
     * Refuses while the market is off: the switch is what authorizes this Host
     * to reach the snapshot at all, so a disabled market must not be reachable
     * by asking the wire directly.
     * @param force - bypass the refresh interval (a user gesture, not a poll).
     * @param signal - caller lifetime; the reads race it.
     * @returns the catalog, or the reason it could not be read.
     */
    getCatalog(force: boolean, signal: AbortSignal): Promise<MarketCatalogResult>;
    /**
     * The plugins installed into this profile, with live enable state.
     *
     * Like the skills read, deliberately not gated on the market switch: the
     * answer comes from this machine's own profile files and Loader tree, so it
     * reaches nothing outside and answers whether or not the catalog is on.
     */
    listInstalled(): Promise<MarketInstalledResult>;
    /**
     * Enable or disable one installed package: durable rows in the profile's own
     * patch layer, then a live nudge so the change applies without a restart.
     */
    setInstalledEnabled(update: SetInstalledEnabledUpdate): Promise<MarketInstalledResult>;
    /**
     * Uninstall one installed package. A user plugin is stopped, then pruned
     * with `pnpm remove` (lockfile and `node_modules` included); an in-box
     * seat is dropped from the manifest and its copied directory is deleted.
     * The next boot's sweep takes the stop rows back out of the user's patch
     * file.
     */
    uninstallInstalled(update: UninstallInstalledUpdate): Promise<MarketInstalledResult>;
}
