/**
 * The installed-plugin manager: the host half of the market's "已安装" panel.
 *
 * It answers three verbs over the plugins a user installed into this profile,
 * plus the in-box seats the desktop client marked as its own. Shipped
 * template layers, and unmarked in-box bundles, are the deployment itself and
 * are never listed. A marked seat IS listed, because otherwise nothing could
 * remove it: the official CLI will not touch a name that is not a profile
 * dependency, and the client that seated it may be uninstalled by now.
 *
 * - **list** reads the profile manifest's user bundles (and any plugin still
 *   in `dependencies` but missing from `dsh.profile.bundles`, so a failed
 *   reconcile cannot hide from uninstall), joins each bundle's patch-declared
 *   entry ids against the live Loader tree, and reports the package-level
 *   enable state the panel toggles.
 * - **setEnabled** writes (or removes) `disabled: true` rows in the profile's
 *   own patch layer — the durable seat the launcher recomposes from on every
 *   boot — and then nudges the live entries directly, so the change takes
 *   effect now even on a launcher without the patch-file watcher. The two
 *   paths are idempotent against each other: whichever lands second finds no
 *   diff left to apply.
 * - **uninstall** stops the entries for the rest of this session (same
 *   disable-row mechanism, so a mid-session patch-file recompose cannot
 *   revive them) and records the rows it wrote so the next boot's
 *   {@link InstalledManager.sweep} can take them back out of the user's
 *   patch file. For a user plugin it then runs `pnpm remove` in the profile
 *   directory — the same primitive official `dsh plugin remove` forwards to
 *   — so the lockfile and `node_modules` go with the manifest edit; an
 *   in-box seat has no pnpm tree and is removed by deleting its copy. A
 *   failed pnpm run still drops the name from the manifest (next boot will
 *   not compose it) and the result `notice` carries the leftover fault
 *   details so the panel can wrap them in localized copy.
 *
 * Listing, enable, disable, and in-box uninstall stay local file edits plus
 * an in-process Loader call. User-plugin uninstall is the one verb that
 * spawns: `pnpm remove` against the profile directory, never the network
 * as an install.
 */
import type { Loader } from '@deepseek-ai/cordis-plugin-loader';
import { type MarketInstalledResult } from './contract.ts';
/** One uninstall the manager still has disable rows out for. */
export interface PendingUninstall {
    readonly packageName: string;
    readonly entryIds: readonly string[];
    readonly at: string;
    /** False until removal from the manifest has been verified; absent in legacy records. */
    readonly completed?: boolean;
}
/** The manager's construction facts. */
export interface InstalledManagerOptions {
    /** The active profile name reported by the host launcher. */
    readonly profile: string;
    /** Actual launcher-owned directory, including application-owned profiles. */
    readonly profileDir?: string;
    /** This plugin's own package name: the one row the panel must not disable. */
    readonly selfName: string;
    /** The live Loader (the `loader` service). */
    readonly loader: Loader;
    /** Harness home override; defaults to the environment's resolution. */
    readonly home?: string;
    /**
     * The pending-uninstall seat file: one small JSON array per profile under
     * the harness home (see {@link pendingFilePath}). A file, not the storage
     * domain, so the boot sweep still runs when the domain is unavailable —
     * losing the record is what strands stop rows in the user's patch file.
     */
    readonly pendingFile?: string;
    /**
     * Drop a user-plugin dependency from the profile install tree. Defaults to
     * `pnpm remove` in the profile directory (what official `dsh plugin remove`
     * forwards to). Tests inject a stub so they do not need a real pnpm project.
     * In-box seats never call this: they are not dependencies.
     */
    readonly removeDependency?: (packageName: string) => Promise<RemoveDependencyResult>;
}
/** Outcome of pruning one user-plugin dependency (pnpm remove, or a test stub). */
export interface RemoveDependencyResult {
    readonly ok: boolean;
    readonly detail: string;
}
/** The manager face the Remote service delegates to. */
export interface InstalledManager {
    list(): Promise<MarketInstalledResult>;
    setEnabled(packageName: string, enabled: boolean): Promise<MarketInstalledResult>;
    uninstall(packageName: string): Promise<MarketInstalledResult>;
    /** Take back disable rows of finished uninstalls; run once at plugin start. */
    sweep(): Promise<void>;
    /**
     * Seed the file seat from a record an older version kept in the storage
     * domain (one-time migration). The file wins when it already holds
     * records; the caller then forgets the legacy field.
     */
    adoptPending(records: readonly PendingUninstall[]): Promise<void>;
}
/**
 * The pending-uninstall seat for one profile: a small JSON file under the
 * harness home (`$DSH_HOME` or `~/.dsh`), owned by this plugin and per
 * profile — a sweep must only ever touch its own profile's rows. Profile
 * names are validated (no separators) before they reach this path.
 */
export declare function pendingFilePath(profile: string, home?: string): string;
/**
 * Run `pnpm remove <name>` in the profile directory. The package name is
 * shape-checked again here so a future caller cannot turn the spawn into a
 * shell string; Windows uses an explicit command interpreter with a validated package name. Network is not required for a remove of an already-fetched tree.
 */
export declare function pnpmRemoveCommand(packageName: string, platform?: NodeJS.Platform): {
    command: string;
    args: string[];
};
export declare function spawnPnpmRemove(profileDir: string, packageName: string): Promise<RemoveDependencyResult>;
/**
 * Create the manager over one profile directory.
 * @param options - profile identity, the live Loader, and the durable record seat.
 */
export declare function createInstalledManager(options: InstalledManagerOptions): InstalledManager;
