/**
 * The saferMarket wire contract, shared verbatim by the host manifest
 * (`ctx.typert.register` in typert.ts) and the client contribution
 * (`ctx.remote.$mount` in client/remote.ts). The service exposes the reduced
 * community catalog and the plugin's own durable settings.
 *
 * Everything that crosses this boundary is remote text from a public
 * snapshot. It is reduced and sanitized on the Host — the repository link in
 * particular is rebuilt from `owner/name` rather than carried over from the
 * snapshot — so the browser half only ever renders values this contract has
 * already fixed the shape of.
 */
import { z } from 'zod';
import { type InstallInfo } from './installInfo.ts';
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol';
/** One row of the market: a community plugin the catalog kept. */
export interface MarketPlugin {
    readonly installInfo?: InstallInfo;
    /** `owner/name`, the catalog's identity for the entry. */
    readonly fullName: string;
    readonly owner: string;
    readonly name: string;
    /** Rebuilt from fullName on the Host — never the snapshot's own href. */
    readonly url: string;
    readonly description: string;
    readonly stars: number;
    readonly language: string;
    readonly license: string;
    /** ISO date of the last push, for the "still maintained" read. */
    readonly pushedAt: string;
    /** The repository's default branch — the install command's fallback ref. */
    readonly defaultBranch: string;
    readonly category: string;
    readonly categoryZh: string;
    readonly categoryEn: string;
}
/** One category filter, with how many of the kept rows fall under it. */
export interface MarketCategory {
    readonly key: string;
    readonly zh: string;
    readonly en: string;
    readonly count: number;
}
/** One editorial pick: a complete card plus the editor's one-line reason. */
export interface MarketFeaturedEntry {
    /**
     * The catalog row the pick names, or — for a pick the shortlist does not
     * carry — a card the Host synthesized from the pick's own `packages` block.
     */
    readonly item: MarketPlugin;
    readonly reason: string;
}
/** The feed's editorial picks, resolved on the Host in the publisher's order. */
export interface MarketFeatured {
    readonly titleZh: string;
    readonly titleEn: string;
    readonly updatedAt: string;
    /** The publisher's own count (`featured_count`), else how many picks resolved. */
    readonly count: number;
    readonly entries: readonly MarketFeaturedEntry[];
}
/** The reduced catalog the browser renders. */
export interface MarketCatalog {
    readonly items: readonly MarketPlugin[];
    readonly categories: readonly MarketCategory[];
    /**
     * Absent when the feed carries no picks (or none survived the wire pass),
     * and in every catalog cached before the feed had them.
     */
    readonly featured?: MarketFeatured;
    /** When the upstream crawl ran (the snapshot's own timestamp). */
    readonly fetchedAt: string;
    /** When this Host last read the snapshot. */
    readonly refreshedAt: string;
    /** How many repositories the crawl saw, before curation and the top cut. */
    readonly scanned: number;
}
/** A catalog read: the answer, plus whether it is the last good one. */
export interface MarketCatalogResult {
    readonly catalog: MarketCatalog | null;
    /** The catalog is a cached one; this read did not reach the snapshot. */
    readonly stale: boolean;
    /** Why the read did not reach the snapshot, when it did not. */
    readonly error: string;
}
/** One skill this deployment can currently resolve. */
export interface MarketSkill {
    readonly name: string;
    readonly description: string;
    readonly whenToUse: string;
    /** The provider that owns the skill body (`filesystem`, `runtime`, …). */
    readonly provider: string;
    /** Actual resource directory, relative to the workspace or home when possible. */
    readonly sourceDirectory?: string;
    /**
     * The same directory as an absolute Host path, for the folder action. The
     * Host's own path opener re-verifies it before handing it to the desktop.
     */
    readonly sourcePath?: string;
    /** Whether the model may invoke it on its own. */
    readonly modelInvocable: boolean;
    /** Whether the user may invoke it with `/name`. */
    readonly userInvocable: boolean;
}
/** Wire codec: one session identity (branded string on the wire). */
export declare const sessionIdSchema: z.ZodString;
/** A skills read: the answer, or the reason there is none. */
export interface MarketSkillsResult {
    readonly skills: readonly MarketSkill[];
    /** False when a provider failed or reported incomplete discovery. */
    readonly complete: boolean;
    readonly error: string;
}
/**
 * What the browser needs to name the install command. The profile is a
 * deployment fact (the Host is the only side that knows which profile it
 * boots), and the command is the official one — this plugin never runs it.
 */
export interface MarketEnvironment {
    /** The profile whose plugins an install would change. */
    readonly profile: string;
    /**
     * The market's own version, for the section header.
     *
     * The installed panel also carries a row for a marked in-box seat, so this
     * is no longer the only place the version can appear — but that row exists
     * only while the seat is listed, and it is one card among many. The header
     * states which market is running regardless. '' when the manifest could
     * not be read.
     */
    readonly version: string;
}
/** The marketplace's live configuration fields exposed to the browser. */
export interface SafeMarketSettings {
    /**
     * Whether the market is on. Default false: the tab explains itself and
     * asks first, because turning it on is what starts reaching GitHub.
     */
    readonly enabled: boolean;
}
/** One field update sent through the plugin-owned settings Remote. */
export type SafeMarketSettingsUpdate = {
    readonly field: 'enabled';
    readonly value: boolean;
};
/** Live state of one loader entry an installed bundle introduces. */
export interface MarketInstalledEntry {
    /** The patch-addressable entry id (no `include:` prefix). */
    readonly id: string;
    /** The module specifier the entry imports. */
    readonly name: string;
    /** Whether the entry exists in the live Loader tree. */
    readonly present: boolean;
    /** Effective enablement (a disabled ancestor group included). */
    readonly enabled: boolean;
    /** The entry's fiber phase, or null while no fiber exists. */
    readonly phase: 'pending' | 'loading' | 'active' | 'failed' | 'disposed' | 'unloading' | null;
}
/** One user-installed plugin package, with the live state of its entries. */
export interface MarketInstalledPackage {
    readonly packageName: string;
    readonly version: string;
    readonly description: string;
    /**
     * The `owner/name` this package's manifest points its `repository` field
     * at, when that field names a GitHub repository in a shape matching
     * {@link REPOSITORY_SLUG_PATTERN}; '' otherwise.
     *
     * This is what joins an installed package to a catalog row: the catalog is
     * keyed by repository (it is a crawl of GitHub) while an install is keyed by
     * package name, and the two are only sometimes spelled alike.
     */
    readonly repository: string;
    /** The market's own row: listed, but the panel must not disable it. */
    readonly self: boolean;
    /**
     * Seated by the desktop client rather than installed as a dependency: the
     * client copied it in and wrote its ownership marker. Listed so it can be
     * removed at all — the official CLI will not touch a name that is not a
     * dependency, and the client that seated it may be uninstalled by now.
     */
    readonly inBox: boolean;
    /**
     * In `dependencies` but not in `dsh.profile.bundles`: installed, not
     * loaded. Listed so Uninstall can reach it; Enable cannot put it on the
     * stack (that is `dsh plugin add`'s reconcile).
     */
    readonly unregistered: boolean;
    /** Package-level enablement: at least one of its entries is enabled. */
    readonly enabled: boolean;
    readonly entries: readonly MarketInstalledEntry[];
    /** Why the bundle could not be read (uninstall stays available); '' when read. */
    readonly error: string;
    /**
     * A same-session uninstall of this package left stop rows in the profile's
     * patch layer that are still holding its entries down: the sweep record is
     * consumed only at the next boot, and the package came back before that —
     * a mid-session reinstall. The panel explains the disabled state, and the
     * ordinary Enable verb clears the rows.
     */
    readonly heldDown: boolean;
}
/** The installed-panel read: the packages, or the reason the profile read failed. */
export interface MarketInstalledResult {
    readonly packages: readonly MarketInstalledPackage[];
    /** The profile the list describes (the panel names it in its explainer). */
    readonly profile: string;
    readonly error: string;
    /**
     * Fault details a verb wants the panel to wrap in localized copy. Absent
     * (or empty) means the default success line. The wrapping sentence is
     * chosen by {@link MarketInstalledResult.noticeKind}.
     */
    readonly notice?: string;
    /**
     * How the panel should phrase a non-empty {@link MarketInstalledResult.notice}.
     * `may-run` means the package is off the profile but may keep running until
     * the next restart; `faults` means it is off the profile and the details
     * are the leftover work that did not finish.
     */
    readonly noticeKind?: 'faults' | 'may-run';
}
/** One enable/disable request for an installed package. */
export interface SetInstalledEnabledUpdate {
    readonly packageName: string;
    readonly enabled: boolean;
}
/** One uninstall request for an installed package. */
export interface UninstallInstalledUpdate {
    readonly packageName: string;
}
/** Strict wire codec for one market row. */
export declare const marketPluginSchema: z.ZodReadonly<z.ZodObject<{
    installInfo: z.ZodOptional<z.ZodObject<{
        mode: z.ZodEnum<{
            command: "command";
            manual: "manual";
        }>;
        targets: z.ZodArray<z.ZodObject<{
            install: z.ZodString;
            profile: z.ZodString;
            note: z.ZodString;
        }, z.core.$strip>>;
        tasks: z.ZodArray<z.ZodString>;
        requirements: z.ZodArray<z.ZodString>;
        note: z.ZodString;
        manual: z.ZodString;
    }, z.core.$strip>>;
    fullName: z.ZodString;
    owner: z.ZodString;
    name: z.ZodString;
    url: z.ZodString;
    description: z.ZodString;
    stars: z.ZodNumber;
    language: z.ZodString;
    license: z.ZodString;
    pushedAt: z.ZodString;
    defaultBranch: z.ZodString;
    category: z.ZodString;
    categoryZh: z.ZodString;
    categoryEn: z.ZodString;
}, z.core.$strip>>;
/** Strict wire codec for one category filter. */
export declare const marketCategorySchema: z.ZodReadonly<z.ZodObject<{
    key: z.ZodString;
    zh: z.ZodString;
    en: z.ZodString;
    count: z.ZodNumber;
}, z.core.$strip>>;
/** Strict wire codec for the editorial picks. */
export declare const marketFeaturedSchema: z.ZodReadonly<z.ZodObject<{
    titleZh: z.ZodString;
    titleEn: z.ZodString;
    updatedAt: z.ZodString;
    count: z.ZodNumber;
    entries: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
        item: z.ZodReadonly<z.ZodObject<{
            installInfo: z.ZodOptional<z.ZodObject<{
                mode: z.ZodEnum<{
                    command: "command";
                    manual: "manual";
                }>;
                targets: z.ZodArray<z.ZodObject<{
                    install: z.ZodString;
                    profile: z.ZodString;
                    note: z.ZodString;
                }, z.core.$strip>>;
                tasks: z.ZodArray<z.ZodString>;
                requirements: z.ZodArray<z.ZodString>;
                note: z.ZodString;
                manual: z.ZodString;
            }, z.core.$strip>>;
            fullName: z.ZodString;
            owner: z.ZodString;
            name: z.ZodString;
            url: z.ZodString;
            description: z.ZodString;
            stars: z.ZodNumber;
            language: z.ZodString;
            license: z.ZodString;
            pushedAt: z.ZodString;
            defaultBranch: z.ZodString;
            category: z.ZodString;
            categoryZh: z.ZodString;
            categoryEn: z.ZodString;
        }, z.core.$strip>>;
        reason: z.ZodString;
    }, z.core.$strip>>>>;
}, z.core.$strip>>;
/** Strict wire codec for the reduced catalog. */
export declare const marketCatalogSchema: z.ZodReadonly<z.ZodObject<{
    items: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
        installInfo: z.ZodOptional<z.ZodObject<{
            mode: z.ZodEnum<{
                command: "command";
                manual: "manual";
            }>;
            targets: z.ZodArray<z.ZodObject<{
                install: z.ZodString;
                profile: z.ZodString;
                note: z.ZodString;
            }, z.core.$strip>>;
            tasks: z.ZodArray<z.ZodString>;
            requirements: z.ZodArray<z.ZodString>;
            note: z.ZodString;
            manual: z.ZodString;
        }, z.core.$strip>>;
        fullName: z.ZodString;
        owner: z.ZodString;
        name: z.ZodString;
        url: z.ZodString;
        description: z.ZodString;
        stars: z.ZodNumber;
        language: z.ZodString;
        license: z.ZodString;
        pushedAt: z.ZodString;
        defaultBranch: z.ZodString;
        category: z.ZodString;
        categoryZh: z.ZodString;
        categoryEn: z.ZodString;
    }, z.core.$strip>>>>;
    categories: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
        key: z.ZodString;
        zh: z.ZodString;
        en: z.ZodString;
        count: z.ZodNumber;
    }, z.core.$strip>>>>;
    featured: z.ZodOptional<z.ZodReadonly<z.ZodObject<{
        titleZh: z.ZodString;
        titleEn: z.ZodString;
        updatedAt: z.ZodString;
        count: z.ZodNumber;
        entries: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
            item: z.ZodReadonly<z.ZodObject<{
                installInfo: z.ZodOptional<z.ZodObject<{
                    mode: z.ZodEnum<{
                        command: "command";
                        manual: "manual";
                    }>;
                    targets: z.ZodArray<z.ZodObject<{
                        install: z.ZodString;
                        profile: z.ZodString;
                        note: z.ZodString;
                    }, z.core.$strip>>;
                    tasks: z.ZodArray<z.ZodString>;
                    requirements: z.ZodArray<z.ZodString>;
                    note: z.ZodString;
                    manual: z.ZodString;
                }, z.core.$strip>>;
                fullName: z.ZodString;
                owner: z.ZodString;
                name: z.ZodString;
                url: z.ZodString;
                description: z.ZodString;
                stars: z.ZodNumber;
                language: z.ZodString;
                license: z.ZodString;
                pushedAt: z.ZodString;
                defaultBranch: z.ZodString;
                category: z.ZodString;
                categoryZh: z.ZodString;
                categoryEn: z.ZodString;
            }, z.core.$strip>>;
            reason: z.ZodString;
        }, z.core.$strip>>>>;
    }, z.core.$strip>>>;
    fetchedAt: z.ZodString;
    refreshedAt: z.ZodString;
    scanned: z.ZodNumber;
}, z.core.$strip>>;
/** Strict wire codec for one catalog read. */
export declare const marketCatalogResultSchema: z.ZodReadonly<z.ZodObject<{
    catalog: z.ZodUnion<readonly [z.ZodReadonly<z.ZodObject<{
        items: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
            installInfo: z.ZodOptional<z.ZodObject<{
                mode: z.ZodEnum<{
                    command: "command";
                    manual: "manual";
                }>;
                targets: z.ZodArray<z.ZodObject<{
                    install: z.ZodString;
                    profile: z.ZodString;
                    note: z.ZodString;
                }, z.core.$strip>>;
                tasks: z.ZodArray<z.ZodString>;
                requirements: z.ZodArray<z.ZodString>;
                note: z.ZodString;
                manual: z.ZodString;
            }, z.core.$strip>>;
            fullName: z.ZodString;
            owner: z.ZodString;
            name: z.ZodString;
            url: z.ZodString;
            description: z.ZodString;
            stars: z.ZodNumber;
            language: z.ZodString;
            license: z.ZodString;
            pushedAt: z.ZodString;
            defaultBranch: z.ZodString;
            category: z.ZodString;
            categoryZh: z.ZodString;
            categoryEn: z.ZodString;
        }, z.core.$strip>>>>;
        categories: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
            key: z.ZodString;
            zh: z.ZodString;
            en: z.ZodString;
            count: z.ZodNumber;
        }, z.core.$strip>>>>;
        featured: z.ZodOptional<z.ZodReadonly<z.ZodObject<{
            titleZh: z.ZodString;
            titleEn: z.ZodString;
            updatedAt: z.ZodString;
            count: z.ZodNumber;
            entries: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
                item: z.ZodReadonly<z.ZodObject<{
                    installInfo: z.ZodOptional<z.ZodObject<{
                        mode: z.ZodEnum<{
                            command: "command";
                            manual: "manual";
                        }>;
                        targets: z.ZodArray<z.ZodObject<{
                            install: z.ZodString;
                            profile: z.ZodString;
                            note: z.ZodString;
                        }, z.core.$strip>>;
                        tasks: z.ZodArray<z.ZodString>;
                        requirements: z.ZodArray<z.ZodString>;
                        note: z.ZodString;
                        manual: z.ZodString;
                    }, z.core.$strip>>;
                    fullName: z.ZodString;
                    owner: z.ZodString;
                    name: z.ZodString;
                    url: z.ZodString;
                    description: z.ZodString;
                    stars: z.ZodNumber;
                    language: z.ZodString;
                    license: z.ZodString;
                    pushedAt: z.ZodString;
                    defaultBranch: z.ZodString;
                    category: z.ZodString;
                    categoryZh: z.ZodString;
                    categoryEn: z.ZodString;
                }, z.core.$strip>>;
                reason: z.ZodString;
            }, z.core.$strip>>>>;
        }, z.core.$strip>>>;
        fetchedAt: z.ZodString;
        refreshedAt: z.ZodString;
        scanned: z.ZodNumber;
    }, z.core.$strip>>, z.ZodNull]>;
    stale: z.ZodBoolean;
    error: z.ZodString;
}, z.core.$strip>>;
/** Strict wire codec for one resolvable skill. */
export declare const marketSkillSchema: z.ZodReadonly<z.ZodObject<{
    name: z.ZodString;
    description: z.ZodString;
    whenToUse: z.ZodString;
    provider: z.ZodString;
    sourceDirectory: z.ZodOptional<z.ZodString>;
    sourcePath: z.ZodOptional<z.ZodString>;
    modelInvocable: z.ZodBoolean;
    userInvocable: z.ZodBoolean;
}, z.core.$strip>>;
/** Strict wire codec for one skills read. */
export declare const marketSkillsResultSchema: z.ZodReadonly<z.ZodObject<{
    skills: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
        name: z.ZodString;
        description: z.ZodString;
        whenToUse: z.ZodString;
        provider: z.ZodString;
        sourceDirectory: z.ZodOptional<z.ZodString>;
        sourcePath: z.ZodOptional<z.ZodString>;
        modelInvocable: z.ZodBoolean;
        userInvocable: z.ZodBoolean;
    }, z.core.$strip>>>>;
    complete: z.ZodBoolean;
    error: z.ZodString;
}, z.core.$strip>>;
/** Strict wire codec for the deployment facts the browser needs. */
export declare const marketEnvironmentSchema: z.ZodReadonly<z.ZodObject<{
    profile: z.ZodString;
    version: z.ZodString;
}, z.core.$strip>>;
/** Strict wire codec for the resolved settings section. */
export declare const safeMarketSettingsSchema: z.ZodReadonly<z.ZodObject<{
    enabled: z.ZodBoolean;
}, z.core.$strip>>;
/** Strict wire codec for one field update. */
export declare const safeMarketSettingsUpdateSchema: z.ZodDiscriminatedUnion<[z.ZodReadonly<z.ZodObject<{
    field: z.ZodLiteral<"enabled">;
    value: z.ZodBoolean;
}, z.core.$strip>>], "field">;
/** Strict wire codec for an npm package name. */
export declare const packageNameSchema: z.ZodString;
/** Strict wire codec for one installed entry's live state. */
export declare const marketInstalledEntrySchema: z.ZodReadonly<z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    present: z.ZodBoolean;
    enabled: z.ZodBoolean;
    phase: z.ZodUnion<readonly [z.ZodEnum<{
        pending: "pending";
        loading: "loading";
        active: "active";
        failed: "failed";
        disposed: "disposed";
        unloading: "unloading";
    }>, z.ZodNull]>;
}, z.core.$strip>>;
/** Strict wire codec for one installed package. */
export declare const marketInstalledPackageSchema: z.ZodReadonly<z.ZodObject<{
    packageName: z.ZodString;
    version: z.ZodString;
    description: z.ZodString;
    repository: z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"">]>;
    self: z.ZodBoolean;
    inBox: z.ZodBoolean;
    unregistered: z.ZodBoolean;
    enabled: z.ZodBoolean;
    entries: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        present: z.ZodBoolean;
        enabled: z.ZodBoolean;
        phase: z.ZodUnion<readonly [z.ZodEnum<{
            pending: "pending";
            loading: "loading";
            active: "active";
            failed: "failed";
            disposed: "disposed";
            unloading: "unloading";
        }>, z.ZodNull]>;
    }, z.core.$strip>>>>;
    error: z.ZodString;
    heldDown: z.ZodBoolean;
}, z.core.$strip>>;
/** Strict wire codec for the installed-panel read. */
export declare const marketInstalledResultSchema: z.ZodReadonly<z.ZodObject<{
    packages: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
        packageName: z.ZodString;
        version: z.ZodString;
        description: z.ZodString;
        repository: z.ZodUnion<readonly [z.ZodString, z.ZodLiteral<"">]>;
        self: z.ZodBoolean;
        inBox: z.ZodBoolean;
        unregistered: z.ZodBoolean;
        enabled: z.ZodBoolean;
        entries: z.ZodReadonly<z.ZodArray<z.ZodReadonly<z.ZodObject<{
            id: z.ZodString;
            name: z.ZodString;
            present: z.ZodBoolean;
            enabled: z.ZodBoolean;
            phase: z.ZodUnion<readonly [z.ZodEnum<{
                pending: "pending";
                loading: "loading";
                active: "active";
                failed: "failed";
                disposed: "disposed";
                unloading: "unloading";
            }>, z.ZodNull]>;
        }, z.core.$strip>>>>;
        error: z.ZodString;
        heldDown: z.ZodBoolean;
    }, z.core.$strip>>>>;
    profile: z.ZodString;
    error: z.ZodString;
    notice: z.ZodOptional<z.ZodString>;
    noticeKind: z.ZodOptional<z.ZodEnum<{
        faults: "faults";
        "may-run": "may-run";
    }>>;
}, z.core.$strip>>;
/** Strict wire codec for one enable/disable request. */
export declare const setInstalledEnabledUpdateSchema: z.ZodReadonly<z.ZodObject<{
    packageName: z.ZodString;
    enabled: z.ZodBoolean;
}, z.core.$strip>>;
/** Strict wire codec for one uninstall request. */
export declare const uninstallInstalledUpdateSchema: z.ZodReadonly<z.ZodObject<{
    packageName: z.ZodString;
}, z.core.$strip>>;
/** The saferMarket Remote namespace's strict invocation descriptors. */
export declare const SAFE_MARKET_INVOCATIONS: readonly InvocationDescriptor[];
