/**
 * The safe-market Host Remote service (`ctx.dshMarketPro`, wire namespace
 * `dshMarketPro`). Registered as a TypertRemoteService so the Host Gateway
 * exports its `@Remote` methods to the Web client under
 * `/api/dshMarketPro/<method>`.
 *
 * The catalog read lives here rather than in the browser for two reasons:
 * network reads share a durable cache across clients, and remote text is
 * sanitized on one side of the wire before any renderer sees it.
 */
import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { CatalogSource } from './catalog.ts'
import type { InstalledManager } from './installed.ts'
import type { McpAdoptResult, McpHostContext } from './contract.ts'
import type {
  MarketCatalogResult,
  MarketEnvironment,
  MarketInstalledResult,
  MarketSkillsResult,
  SafeMarketSettings,
  SafeMarketSettingsUpdate,
  SetInstalledEnabledUpdate,
  UninstallInstalledUpdate,
} from './contract.ts'

/** Market service: the reduced catalog, the plugin's durable settings, and the installed-panel verbs. */
export class SafeMarketRuntime extends TypertRemoteService {
  /**
   * Register the service under the `dshMarketPro` key (the wire namespace).
   * @param ctx - owning cordis context.
   * @param catalog - the catalog reader.
   * @param readSettings - live settings read.
   * @param writeSettings - durable settings write.
   * @param installed - the installed-plugin manager.
   */
  constructor(
    ctx: Context,
    private readonly catalog: CatalogSource,
    private readonly readSettings: () => SafeMarketSettings,
    private readonly writeSettings: (update: SafeMarketSettingsUpdate) => Promise<SafeMarketSettings>,
    private readonly readSkills: (sessionId: string, signal: AbortSignal) => Promise<MarketSkillsResult>,
    private readonly environment: MarketEnvironment,
    private readonly installed: InstalledManager,
    private readonly readMcp: () => McpHostContext,
    private readonly adopt: (loaderId: string) => Promise<McpAdoptResult>,
  ) {
    super(ctx, 'dshMarketPro')
  }

  /**
   * The deployment facts the browser needs to NAME the install command —
   * which profile an install would change. This plugin never runs it.
   */
  @Remote
  describe(): MarketEnvironment {
    return this.environment
  }

  /**
   * The skills the addressed session can currently resolve.
   *
   * Read-only, and deliberately not gated on the market switch: listing what
   * is already installed reaches nothing outside this machine, so it answers
   * whether or not the user has turned the catalog on.
   * @param sessionId - the Session whose directory and preset select the
   *   layers; a cold Session is read, never resumed.
   * @param signal - caller lifetime; discovery races it.
   * @returns the merged skill list, and whether discovery was complete.
   */
  @Remote
  async listSkills(sessionId: string, signal: AbortSignal): Promise<MarketSkillsResult> {
    return await this.readSkills(sessionId, signal)
  }

  /** Read the resolved durable settings through the plugin-owned wire. */
  @Remote
  getSettings(): SafeMarketSettings {
    return this.readSettings()
  }

  /** Persist one settings field and return the resolved section. */
  @Remote
  updateSettings(update: SafeMarketSettingsUpdate): Promise<SafeMarketSettings> {
    return this.writeSettings(update)
  }

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
  @Remote
  async getCatalog(force: boolean, signal: AbortSignal): Promise<MarketCatalogResult> {
    if (!this.readSettings().enabled) {
      throw new Error('DSH Market Pro is disabled in Settings')
    }
    return await this.catalog.read(force, signal)
  }

  /**
   * The plugins installed into this profile, with live enable state.
   *
   * Like the skills read, deliberately not gated on the market switch: the
   * answer comes from this machine's own profile files and Loader tree, so it
   * reaches nothing outside and answers whether or not the catalog is on.
   */
  @Remote
  async listInstalled(): Promise<MarketInstalledResult> {
    return await this.installed.list()
  }

  /**
   * Enable or disable one installed package: durable rows in the profile's own
   * patch layer, then a live nudge so the change applies without a restart.
   */
  @Remote
  async setInstalledEnabled(update: SetInstalledEnabledUpdate): Promise<MarketInstalledResult> {
    return await this.installed.setEnabled(update.packageName, update.enabled)
  }

  /**
   * Uninstall one installed package. A user plugin is stopped, then pruned
   * with `pnpm remove` (lockfile and `node_modules` included); an in-box
   * seat is dropped from the manifest and its copied directory is deleted.
   * The next boot's sweep takes the stop rows back out of the user's patch
   * file.
   */
  @Remote
  async uninstallInstalled(update: UninstallInstalledUpdate): Promise<MarketInstalledResult> {
    return await this.installed.uninstall(update.packageName)
  }

  /**
   * The MCP facts the official manager and Settings Remotes do not carry:
   * the manager's own entry id, unmanaged static rows (masked), and the live
   * MCP tools. Read-only and local, so not gated on the market switch.
   */
  @Remote
  inspectMcp(): McpHostContext {
    return this.readMcp()
  }

  /**
   * Move one static MCP row under the manager: its plaintext secrets go to
   * the credential store and its templated entry is written through
   * Settings, switched off — all on the Host, so no value crosses the wire.
   * Switching the static row off is left to the official plugin manager.
   */
  @Remote
  async adoptMcp(request: { readonly loaderId: string }): Promise<McpAdoptResult> {
    return await this.adopt(request.loaderId)
  }
}
