/** Environment variable overriding the default harness home. */
export declare const DSH_HOME_ENV = "DSH_HOME";
/** Directory under the harness home holding every profile. */
export declare const PROFILES_DIR = "profiles";
/** The user patch layer inside a profile directory. */
export declare const PROFILE_PATCH_FILENAME = "cordis.patch.yml";
/**
 * Bundle layers every shipped profile template carries. The manager never
 * lists these: they are the deployment itself.
 *
 * A name in `dsh.profile.bundles` is not enough to treat a plugin as
 * user-installed. Official `dsh plugin` never touches a name that is not a
 * profile dependency, and the desktop client seats its in-box market the
 * same way — a bundle entry plus a copied directory, no dependency.
 *
 * Such a seat IS listed when it carries the client's ownership marker (see
 * {@link desktopSeatBundles}), because otherwise nothing could ever remove
 * it: the official CLI will not touch it, and the client that seated it may
 * be uninstalled by now. The old worry — that an uninstall would be silently
 * undone by the next bundled boot — is answered on the card instead, which
 * says so plainly. A seat with no marker is the deployment's own and stays
 * out.
 */
export declare const SHIPPED_BUNDLES: ReadonlySet<string>;
/** Resolve the harness home: `$DSH_HOME`, then `~/.dsh`. */
export declare function resolveDshHome(env?: NodeJS.ProcessEnv): string;
/**
 * Resolve a profile's directory. The name rules (and the `node_modules`
 * exclusion, the launcher's flat fallback path) mirror the harness's own
 * `resolveProfileDir`, so a profile the launcher accepts resolves identically
 * here.
 */
export declare function resolveProfileDir(name: string, home?: string): string;
/** One entry row inside a patch's `insert` list. */
export interface PatchInsertRow {
    id?: string;
    name?: string;
    group?: boolean | null;
    config?: unknown;
    [key: string]: unknown;
}
/** One row of a patch list: an `insert` list, or an id-targeted override. */
export interface PatchRow {
    id?: string;
    insert?: PatchInsertRow[];
    [key: string]: unknown;
}
/** The profile manifest's slices the manager reads and edits. */
export type ProfileManifest = Record<string, unknown> & {
    dependencies?: Record<string, string>;
    dsh?: {
        bundle?: {
            patch?: string;
        };
        profile?: {
            bundles?: string[];
        };
    };
};
/**
 * Write a file atomically (tmp + rename), the include's own discipline.
 *
 * The scratch path carries the writer's pid and a serial, not a bare `.tmp`.
 * The manager serializes its own verbs, but a profile is shared — the web
 * GUI, a CLI and the desktop client can all be editing the same manifest —
 * and two writers sharing one scratch name interleave into a file that is
 * neither version. Distinct scratch names make the rename the only race, and
 * a rename is the atomic step this function exists for.
 */
export declare function atomicWrite(file: string, content: string): Promise<void>;
/** Read and parse the profile manifest. */
export declare function readManifest(profileDir: string): Promise<ProfileManifest>;
/** Write the manifest back (2-space JSON, trailing newline, atomic). */
export declare function writeManifest(profileDir: string, manifest: ProfileManifest): Promise<void>;
/**
 * The marker the desktop client writes into a seat it copied in, naming
 * itself the owner. It is what makes an in-box seat removable from here: a
 * bundle with no dependency is normally untouchable (the deployment itself),
 * but a directory that says who put it there is a different thing — someone
 * seated it automatically, and the person living in this profile should be
 * able to un-seat it.
 */
export declare const DESKTOP_SEAT_MARKER = ".dsh-desktop-seat.json";
/**
 * Whether this bundle is a desktop-client seat: listed, not a dependency, and
 * carrying the client's ownership marker in the directory the profile
 * resolves it from.
 */
export declare function isDesktopSeat(profileDir: string, packageName: string): boolean;
/** The directory an in-box desktop seat occupies, for removal. */
export declare function desktopSeatDir(profileDir: string, packageName: string): string | undefined;
/** Keep a shared seat while another profile still resolves it. Fail closed on unreadable profiles. */
export declare function seatHasOtherReferences(profileDir: string, packageName: string, seatDir: string): Promise<boolean>;
/**
 * Bundle names listed in the profile that are NOT dependencies and NOT
 * shipped template layers — the in-box seats. Only those carrying the desktop
 * client's marker are returned: an unmarked one is the deployment's own and
 * stays out of the panel, as before.
 */
export declare function desktopSeatBundles(manifest: ProfileManifest, profileDir: string): string[];
/**
 * The bundles a user installed (`dsh plugin add`): names that sit in
 * `dsh.profile.bundles` and in `dependencies`. Shipped template layers and
 * in-box seats (a bundle name with no dependency) are not in this set.
 */
export declare function userBundles(manifest: ProfileManifest): string[];
/**
 * Whether a resolvable dependency declares a `dsh.bundle` patch — i.e. is a
 * plugin, not a plain library sitting in `dependencies`.
 */
export declare function declaresBundle(profileDir: string, packageName: string): boolean;
/**
 * Plugin packages that sit in `dependencies` but not in `dsh.profile.bundles`.
 * They are installed but not composed — the whale-girl shape: pnpm wrote the
 * dep, reconcile never registered the layer. Listed so the panel can uninstall
 * them; plain libraries (zod and friends) stay out.
 */
export declare function unregisteredPlugins(manifest: ProfileManifest, profileDir: string): string[];
/** The profile's pnpm workspace file: `allowBuilds` and `minimumReleaseAgeExclude`. */
export declare const PROFILE_WORKSPACE_FILENAME = "pnpm-workspace.yaml";
/**
 * Drop one package's leftover install-gate entries from the profile's
 * `pnpm-workspace.yaml`: its `allowBuilds` key, and any
 * `minimumReleaseAgeExclude` row that names it. Other keys and comments stay.
 * A missing file is a no-op.
 * @returns true when the file changed.
 */
export declare function removePackageInstallGate(profileDir: string, packageName: string): Promise<boolean>;
/**
 * Remove one bundle from the manifest: its dependency entry and its
 * `dsh.profile.bundles` seat, the exact two facts the next boot's composition
 * and the CLI's reconcile read. For a user plugin the manager also runs
 * `pnpm remove` so the lockfile and `node_modules` go with them; this helper
 * is the manifest half, and the fallback when pnpm cannot run.
 * @returns true when the manifest changed.
 */
export declare function removeBundle(manifest: ProfileManifest, packageName: string): boolean;
/** Parse a patch-list file (a missing file is an empty list, per the launcher's own rule). */
export declare function readPatchList(file: string): Promise<PatchRow[]>;
/**
 * The loader entry rows a patch list introduces, in patch-addressable form:
 * top-level inserts, group children (a group row itself is always enabled and
 * never listed, but its children are real entries), and rows inserted into a
 * group another layer declared. These ids are what `{ id, disabled: true }`
 * override rows target.
 */
export declare function collectEntryRows(patches: readonly PatchRow[]): {
    id: string;
    name: string;
}[];
/**
 * Resolve a package's root directory from the profile anchor: Node's own
 * node_modules lookup order (the profile's `node_modules` first, then the
 * launcher's healed `profiles/node_modules` fallback on the parent walk), so
 * the result matches what the Loader imports.
 */
export declare function packageDirFromProfile(profileDir: string, packageName: string): string | undefined;
/** One installed bundle's display facts plus the entry ids it introduces. */
export interface BundleInfo {
    version: string;
    description: string;
    /** `owner/name` when the manifest points at a GitHub repository; '' otherwise. */
    repository: string;
    entries: {
        id: string;
        name: string;
    }[];
}
/**
 * The GitHub `owner/name` a package manifest's `repository` field names.
 *
 * npm allows the field in several spellings — the object form, the shorthand
 * string (`owner/name`, `github:owner/name`), and a git URL in any of the
 * scheme flavours — and every one of them may also point somewhere that is
 * not GitHub at all. This reduces the ones that do to a bare slug and answers
 * '' for everything else, including a `directory` sub-path (a monorepo entry
 * whose repository is shared with other packages, so the slug would join the
 * wrong catalog row).
 * @param manifest - the parsed package manifest.
 * @returns the `owner/name` slug, or '' when the field names no GitHub repository.
 */
export declare function repositorySlugOf(manifest: unknown): string;
/** Read one installed bundle: its manifest display facts and its patch's entry rows. */
export declare function readBundleInfo(profileDir: string, packageName: string): Promise<BundleInfo>;
/**
 * Set or clear this manager's disable rows for the given entry ids in the
 * profile's user patch layer — the edit every enable/disable/uninstall funnel
 * through. Disable appends `- id: <id>` / `disabled: true` rows (skipping ids
 * already carrying one); enable removes exactly the rows this manager writes,
 * never a hand-written override (more keys, a `!!js` expression, a config
 * override), which keeps its own shape. The document round-trips through the
 * yaml CST, so comments and untouched rows keep their original text; the
 * launcher recomposes the tree on the save, which is what makes the edit live.
 * @returns the ids whose exact disable rows were added or removed.
 */
export declare function setEntryDisabled(file: string, ids: readonly string[], disabled: boolean): Promise<string[]>;
