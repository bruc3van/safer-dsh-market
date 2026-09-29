/**
 * The market's durable domain: the reduced catalog and the ETags that let the
 * next read ask conditionally.
 *
 * Caching the parsed catalog rather than the published file is the point. The
 * published market is small and moves at most once a day; what the browser
 * needs is its own cut of it. Keeping that cut on disk means a Host restart
 * costs one 304 instead of a download, and a Host that cannot reach GitHub at
 * all still opens the market with the last catalog it saw.
 */
import { z } from 'zod';
/** One uninstall whose stop rows are still in the user's patch file. */
export declare const pendingUninstallState: z.ZodObject<{
    packageName: z.ZodString;
    entryIds: z.ZodArray<z.ZodString>;
    at: z.ZodString;
}, z.core.$strip>;
/** The durable state: one catalog, plus what it was fetched with. */
export declare const safeMarketDomainState: z.ZodObject<{
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
    marketEtag: z.ZodDefault<z.ZodString>;
    activeBase: z.ZodDefault<z.ZodString>;
    marketSize: z.ZodNumber;
    catalogBase: z.ZodString;
    pendingUninstall: z.ZodDefault<z.ZodArray<z.ZodObject<{
        packageName: z.ZodString;
        entryIds: z.ZodArray<z.ZodString>;
        at: z.ZodString;
    }, z.core.$strip>>>;
}, z.core.$strip>;
/** Durable market state inferred from {@link safeMarketDomainState}. */
export type SafeMarketDomainState = z.infer<typeof safeMarketDomainState>;
/**
 * The empty state a first run opens with. It satisfies the domain schema
 * (`marketSize` is at least 1) even though nothing here is ever persisted:
 * the initial state is only the memory answer before the first read, and a
 * value the schema rejects would break any future path that validates it.
 */
export declare const initialDomainState: SafeMarketDomainState;
/**
 * The `safe_market` domain spec: one global singleton, no tables. The plugin
 * opens this through `ctx.storageDomain`; the spec object is the single
 * source of the domain's identity, version, and schema.
 */
export declare const safeMarketDomainSpec: {
    name: string;
    version: number;
    global: {
        schema: z.ZodObject<{
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
            marketEtag: z.ZodDefault<z.ZodString>;
            activeBase: z.ZodDefault<z.ZodString>;
            marketSize: z.ZodNumber;
            catalogBase: z.ZodString;
            pendingUninstall: z.ZodDefault<z.ZodArray<z.ZodObject<{
                packageName: z.ZodString;
                entryIds: z.ZodArray<z.ZodString>;
                at: z.ZodString;
            }, z.core.$strip>>>;
        }, z.core.$strip>;
        initial: {
            catalog: Readonly<{
                items: readonly Readonly<{
                    fullName: string;
                    owner: string;
                    name: string;
                    url: string;
                    description: string;
                    stars: number;
                    language: string;
                    license: string;
                    pushedAt: string;
                    defaultBranch: string;
                    category: string;
                    categoryZh: string;
                    categoryEn: string;
                    installInfo?: {
                        mode: "command" | "manual";
                        targets: {
                            install: string;
                            profile: string;
                            note: string;
                        }[];
                        tasks: string[];
                        requirements: string[];
                        note: string;
                        manual: string;
                    } | undefined;
                }>[];
                categories: readonly Readonly<{
                    key: string;
                    zh: string;
                    en: string;
                    count: number;
                }>[];
                fetchedAt: string;
                refreshedAt: string;
                scanned: number;
                featured?: Readonly<{
                    titleZh: string;
                    titleEn: string;
                    updatedAt: string;
                    count: number;
                    entries: readonly Readonly<{
                        item: Readonly<{
                            fullName: string;
                            owner: string;
                            name: string;
                            url: string;
                            description: string;
                            stars: number;
                            language: string;
                            license: string;
                            pushedAt: string;
                            defaultBranch: string;
                            category: string;
                            categoryZh: string;
                            categoryEn: string;
                            installInfo?: {
                                mode: "command" | "manual";
                                targets: {
                                    install: string;
                                    profile: string;
                                    note: string;
                                }[];
                                tasks: string[];
                                requirements: string[];
                                note: string;
                                manual: string;
                            } | undefined;
                        }>;
                        reason: string;
                    }>[];
                }> | undefined;
            }> | null;
            marketEtag: string;
            activeBase: string;
            marketSize: number;
            catalogBase: string;
            pendingUninstall: {
                packageName: string;
                entryIds: string[];
                at: string;
            }[];
        };
    };
    tables: {};
};
/**
 * Adopt the durable state when the domain opens, as one pure step so the
 * merge has regression tests: the pending-uninstall record always follows the
 * disk, and a memory catalog that landed while the domain was opening keeps
 * precedence over the disk (it is newer). Otherwise the stored catalog is
 * adopted WHOLE — the cut and the base it was cut under included, because the
 * cache gate re-checks `marketSize`/`catalogBase` against the live config on
 * every read: adopting the rows without the numbers they were reduced under
 * would leave the cache permanently unusable (a full re-download every boot,
 * and an empty market when GitHub is unreachable).
 * @param current - the in-memory state built before the domain opened.
 * @param stored - the domain's durable state as read from disk.
 * @param isUsable - whether a candidate state answers the current config.
 * @returns the merged state the plugin runs with.
 */
export declare function adoptDomainState(current: SafeMarketDomainState, stored: SafeMarketDomainState, isUsable: (candidate: SafeMarketDomainState) => boolean): SafeMarketDomainState;
