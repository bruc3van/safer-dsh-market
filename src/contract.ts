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
import { z } from 'zod'
import { isInstallSpec, type InstallInfo } from './installInfo.ts'
import type { InvocationDescriptor } from '@deepseek-ai/dsh-typert-protocol'
// The dependency-free shapes live in their own module so `./index.ts` and
// `./catalog.ts` can reach them without evaluating every codec below.
import { isSafeBranchName, PACKAGE_NAME_PATTERN, REPOSITORY_SLUG_PATTERN } from './shapes.ts'

/** One row of the market: a community plugin the catalog kept. */
export interface MarketPlugin {
  readonly installInfo?: InstallInfo
  /** `owner/name`, the catalog's identity for the entry. */
  readonly fullName: string
  readonly owner: string
  readonly name: string
  /** Rebuilt from fullName on the Host — never the snapshot's own href. */
  readonly url: string
  readonly description: string
  readonly stars: number
  readonly language: string
  readonly license: string
  /** ISO date of the last push, for the "still maintained" read. */
  readonly pushedAt: string
  /** The repository's default branch — the install command's fallback ref. */
  readonly defaultBranch: string
  readonly category: string
  readonly categoryZh: string
  readonly categoryEn: string
}

/** One category filter, with how many of the kept rows fall under it. */
export interface MarketCategory {
  readonly key: string
  readonly zh: string
  readonly en: string
  readonly count: number
}

/** The reduced catalog the browser renders. */
export interface MarketCatalog {
  readonly items: readonly MarketPlugin[]
  readonly categories: readonly MarketCategory[]
  /** When the upstream crawl ran (the snapshot's own timestamp). */
  readonly fetchedAt: string
  /** When this Host last read the snapshot. */
  readonly refreshedAt: string
  /** How many repositories the crawl saw, before curation and the top cut. */
  readonly scanned: number
}

/** A catalog read: the answer, plus whether it is the last good one. */
export interface MarketCatalogResult {
  readonly catalog: MarketCatalog | null
  /** The catalog is a cached one; this read did not reach the snapshot. */
  readonly stale: boolean
  /** Why the read did not reach the snapshot, when it did not. */
  readonly error: string
}

/** One skill this deployment can currently resolve. */
export interface MarketSkill {
  readonly name: string
  readonly description: string
  readonly whenToUse: string
  /** The provider that owns the skill body (`filesystem`, `runtime`, …). */
  readonly provider: string
  /** Actual resource directory, relative to the workspace or home when possible. */
  readonly sourceDirectory?: string
  /** Whether the model may invoke it on its own. */
  readonly modelInvocable: boolean
  /** Whether the user may invoke it with `/name`. */
  readonly userInvocable: boolean
}

/** Wire codec: one session identity (branded string on the wire). */
export const sessionIdSchema = z.string().min(1)

/** A skills read: the answer, or the reason there is none. */
export interface MarketSkillsResult {
  readonly skills: readonly MarketSkill[]
  /** False when a provider failed or reported incomplete discovery. */
  readonly complete: boolean
  readonly error: string
}

/**
 * What the browser needs to name the install command. The profile is a
 * deployment fact (the Host is the only side that knows which profile it
 * boots), and the command is the official one — this plugin never runs it.
 */
export interface MarketEnvironment {
  /** The profile whose plugins an install would change. */
  readonly profile: string
  /**
   * The market's own version, for the section header.
   *
   * The installed panel also carries a row for a marked in-box seat, so this
   * is no longer the only place the version can appear — but that row exists
   * only while the seat is listed, and it is one card among many. The header
   * states which market is running regardless. '' when the manifest could
   * not be read.
   */
  readonly version: string
}

/** The marketplace's live configuration fields exposed to the browser. */
export interface SafeMarketSettings {
  /**
   * Whether the market is on. Default false: the tab explains itself and
   * asks first, because turning it on is what starts reaching GitHub.
   */
  readonly enabled: boolean
}

/** One field update sent through the plugin-owned settings Remote. */
export type SafeMarketSettingsUpdate = { readonly field: 'enabled'; readonly value: boolean }

/** Live state of one loader entry an installed bundle introduces. */
export interface MarketInstalledEntry {
  /** The patch-addressable entry id (no `include:` prefix). */
  readonly id: string
  /** The module specifier the entry imports. */
  readonly name: string
  /** Whether the entry exists in the live Loader tree. */
  readonly present: boolean
  /** Effective enablement (a disabled ancestor group included). */
  readonly enabled: boolean
  /** The entry's fiber phase, or null while no fiber exists. */
  readonly phase: 'pending' | 'loading' | 'active' | 'failed' | 'disposed' | 'unloading' | null
}

/** One user-installed plugin package, with the live state of its entries. */
export interface MarketInstalledPackage {
  readonly packageName: string
  readonly version: string
  readonly description: string
  /**
   * The `owner/name` this package's manifest points its `repository` field
   * at, when that field names a GitHub repository in a shape matching
   * {@link REPOSITORY_SLUG_PATTERN}; '' otherwise.
   *
   * This is what joins an installed package to a catalog row: the catalog is
   * keyed by repository (it is a crawl of GitHub) while an install is keyed by
   * package name, and the two are only sometimes spelled alike.
   */
  readonly repository: string
  /** The market's own row: listed, but the panel must not disable it. */
  readonly self: boolean
  /**
   * Seated by the desktop client rather than installed as a dependency: the
   * client copied it in and wrote its ownership marker. Listed so it can be
   * removed at all — the official CLI will not touch a name that is not a
   * dependency, and the client that seated it may be uninstalled by now.
   */
  readonly inBox: boolean
  /**
   * In `dependencies` but not in `dsh.profile.bundles`: installed, not
   * loaded. Listed so Uninstall can reach it; Enable cannot put it on the
   * stack (that is `dsh plugin add`'s reconcile).
   */
  readonly unregistered: boolean
  /** Package-level enablement: at least one of its entries is enabled. */
  readonly enabled: boolean
  readonly entries: readonly MarketInstalledEntry[]
  /** Why the bundle could not be read (uninstall stays available); '' when read. */
  readonly error: string
  /**
   * A same-session uninstall of this package left stop rows in the profile's
   * patch layer that are still holding its entries down: the sweep record is
   * consumed only at the next boot, and the package came back before that —
   * a mid-session reinstall. The panel explains the disabled state, and the
   * ordinary Enable verb clears the rows.
   */
  readonly heldDown: boolean
}

/** The installed-panel read: the packages, or the reason the profile read failed. */
export interface MarketInstalledResult {
  readonly packages: readonly MarketInstalledPackage[]
  /** The profile the list describes (the panel names it in its explainer). */
  readonly profile: string
  readonly error: string
  /**
   * Fault details a verb wants the panel to wrap in localized copy. Absent
   * (or empty) means the default success line. The wrapping sentence is
   * chosen by {@link MarketInstalledResult.noticeKind}.
   */
  readonly notice?: string
  /**
   * How the panel should phrase a non-empty {@link MarketInstalledResult.notice}.
   * `may-run` means the package is off the profile but may keep running until
   * the next restart; `faults` means it is off the profile and the details
   * are the leftover work that did not finish.
   */
  readonly noticeKind?: 'faults' | 'may-run'
}

/** One enable/disable request for an installed package. */
export interface SetInstalledEnabledUpdate {
  readonly packageName: string
  readonly enabled: boolean
}

/** One uninstall request for an installed package. */
export interface UninstallInstalledUpdate {
  readonly packageName: string
}

const installInfoSchema = z.object({
  mode: z.enum(['command', 'manual']),
  targets: z.array(z.object({ install: z.string().refine(isInstallSpec), profile: z.string().max(2000), note: z.string().max(2000) })).max(30),
  tasks: z.array(z.string().max(2000)).max(30),
  requirements: z.array(z.string().max(2000)).max(30),
  note: z.string().max(2000), manual: z.string().max(2000),
})

/** Strict wire codec for one market row. */
export const marketPluginSchema = z.object({
  installInfo: installInfoSchema.optional(),
  fullName: z.string().regex(REPOSITORY_SLUG_PATTERN),
  owner: z.string().min(1),
  name: z.string().min(1),
  // The Host rebuilds this from fullName; the codec makes the invariant
  // machine-checked, so no renderer needs to trust a caller's href.
  url: z.string().regex(/^https:\/\/github\.com\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/),
  description: z.string(),
  stars: z.number().int().min(0),
  language: z.string(),
  license: z.string(),
  pushedAt: z.string(),
  defaultBranch: z.string().refine(isSafeBranchName),
  category: z.string().min(1),
  categoryZh: z.string(),
  categoryEn: z.string(),
}).readonly()

/** Strict wire codec for one category filter. */
export const marketCategorySchema = z.object({
  key: z.string().min(1),
  zh: z.string(),
  en: z.string(),
  count: z.number().int().min(0),
}).readonly()

/** Strict wire codec for the reduced catalog. */
export const marketCatalogSchema = z.object({
  items: z.array(marketPluginSchema).readonly(),
  categories: z.array(marketCategorySchema).readonly(),
  fetchedAt: z.string(),
  refreshedAt: z.string(),
  scanned: z.number().int().min(0),
}).readonly()

/** Strict wire codec for one catalog read. */
export const marketCatalogResultSchema = z.object({
  catalog: z.union([marketCatalogSchema, z.null()]),
  stale: z.boolean(),
  error: z.string(),
}).readonly()

/** Strict wire codec for one resolvable skill. */
export const marketSkillSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  whenToUse: z.string(),
  provider: z.string(),
  sourceDirectory: z.string().optional(),
  modelInvocable: z.boolean(),
  userInvocable: z.boolean(),
}).readonly()

/** Strict wire codec for one skills read. */
export const marketSkillsResultSchema = z.object({
  skills: z.array(marketSkillSchema).readonly(),
  complete: z.boolean(),
  error: z.string(),
}).readonly()

/** Strict wire codec for the deployment facts the browser needs. */
export const marketEnvironmentSchema = z.object({
  profile: z.string(),
  version: z.string(),
}).readonly()

/** Strict wire codec for the resolved settings section. */
export const safeMarketSettingsSchema = z.object({
  enabled: z.boolean(),
}).readonly()

/** Strict wire codec for one field update. */
export const safeMarketSettingsUpdateSchema = z.discriminatedUnion('field', [
  z.object({ field: z.literal('enabled'), value: z.boolean() }).readonly(),
])

/** Strict wire codec for an npm package name. */
export const packageNameSchema = z.string().regex(PACKAGE_NAME_PATTERN)

/** Strict wire codec for one installed entry's live state. */
export const marketInstalledEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  present: z.boolean(),
  enabled: z.boolean(),
  phase: z.union([
    z.enum(['pending', 'loading', 'active', 'failed', 'disposed', 'unloading']),
    z.null(),
  ]),
}).readonly()

/** Strict wire codec for one installed package. */
export const marketInstalledPackageSchema = z.object({
  packageName: packageNameSchema,
  version: z.string(),
  description: z.string(),
  // Either a slug the Host already shape-checked, or nothing. A manifest
  // pointing somewhere unparseable must not fail the whole panel read, so the
  // Host reduces it to '' rather than passing the raw field on.
  repository: z.union([z.string().regex(REPOSITORY_SLUG_PATTERN), z.literal('')]),
  self: z.boolean(),
  inBox: z.boolean(),
  unregistered: z.boolean(),
  enabled: z.boolean(),
  entries: z.array(marketInstalledEntrySchema).readonly(),
  error: z.string(),
  heldDown: z.boolean(),
}).readonly()

/** Strict wire codec for the installed-panel read. */
export const marketInstalledResultSchema = z.object({
  packages: z.array(marketInstalledPackageSchema).readonly(),
  profile: z.string(),
  error: z.string(),
  notice: z.string().optional(),
  noticeKind: z.enum(['faults', 'may-run']).optional(),
}).readonly()

/** Strict wire codec for one enable/disable request. */
export const setInstalledEnabledUpdateSchema = z.object({
  packageName: packageNameSchema,
  enabled: z.boolean(),
}).readonly()

/** Strict wire codec for one uninstall request. */
export const uninstallInstalledUpdateSchema = z.object({
  packageName: packageNameSchema,
}).readonly()

/** The saferMarket Remote namespace's strict invocation descriptors. */
export const SAFE_MARKET_INVOCATIONS: readonly InvocationDescriptor[] = [
  {
    id: 'safer-dsh-market#saferMarket/getCatalog',
    service: 'saferMarket',
    namespace: 'saferMarket',
    method: 'getCatalog',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'force',
        wire: 'force',
        source: 'json',
        codec: {
          mode: 'strict',
          typeSymbol: 'safer-dsh-market#ForceRefresh',
          create: () => z.boolean(),
        },
      },
    ],
    cancellation: { parameter: 'signal' },
    result: {
      mode: 'strict',
      typeSymbol: 'safer-dsh-market#MarketCatalogResult',
      create: () => marketCatalogResultSchema,
    },
  },
  {
    id: 'safer-dsh-market#saferMarket/listSkills',
    service: 'saferMarket',
    namespace: 'saferMarket',
    method: 'listSkills',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'agent',
        wire: 'agentId',
        source: 'lookup',
        lookup: 'agent',
        // The type symbol must equal the agent lookup provider's wire identity
        // exactly — the gateway's strict path rejects a mismatched symbol.
        codec: { mode: 'strict', typeSymbol: '@deepseek-ai/dsh-session/types#SessionId', create: () => sessionIdSchema },
      },
    ],
    cancellation: { parameter: 'signal' },
    result: {
      mode: 'strict',
      typeSymbol: 'safer-dsh-market#MarketSkillsResult',
      create: () => marketSkillsResultSchema,
    },
  },
  {
    id: 'safer-dsh-market#saferMarket/describe',
    service: 'saferMarket',
    namespace: 'saferMarket',
    method: 'describe',
    invocation: { kind: 'direct' },
    parameters: [],
    result: {
      mode: 'strict',
      typeSymbol: 'safer-dsh-market#MarketEnvironment',
      create: () => marketEnvironmentSchema,
    },
  },
  {
    id: 'safer-dsh-market#saferMarket/getSettings',
    service: 'saferMarket',
    namespace: 'saferMarket',
    method: 'getSettings',
    invocation: { kind: 'direct' },
    parameters: [],
    result: {
      mode: 'strict',
      typeSymbol: 'safer-dsh-market#SafeMarketSettings',
      create: () => safeMarketSettingsSchema,
    },
  },
  {
    id: 'safer-dsh-market#saferMarket/updateSettings',
    service: 'saferMarket',
    namespace: 'saferMarket',
    method: 'updateSettings',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'update',
        wire: 'update',
        source: 'json',
        codec: {
          mode: 'strict',
          typeSymbol: 'safer-dsh-market#SafeMarketSettingsUpdate',
          create: () => safeMarketSettingsUpdateSchema,
        },
      },
    ],
    result: {
      mode: 'strict',
      typeSymbol: 'safer-dsh-market#SafeMarketSettings',
      create: () => safeMarketSettingsSchema,
    },
  },
  {
    id: 'safer-dsh-market#saferMarket/listInstalled',
    service: 'saferMarket',
    namespace: 'saferMarket',
    method: 'listInstalled',
    invocation: { kind: 'direct' },
    parameters: [],
    result: {
      mode: 'strict',
      typeSymbol: 'safer-dsh-market#MarketInstalledResult',
      create: () => marketInstalledResultSchema,
    },
  },
  {
    id: 'safer-dsh-market#saferMarket/setInstalledEnabled',
    service: 'saferMarket',
    namespace: 'saferMarket',
    method: 'setInstalledEnabled',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'update',
        wire: 'update',
        source: 'json',
        codec: {
          mode: 'strict',
          typeSymbol: 'safer-dsh-market#SetInstalledEnabledUpdate',
          create: () => setInstalledEnabledUpdateSchema,
        },
      },
    ],
    result: {
      mode: 'strict',
      typeSymbol: 'safer-dsh-market#MarketInstalledResult',
      create: () => marketInstalledResultSchema,
    },
  },
  {
    id: 'safer-dsh-market#saferMarket/uninstallInstalled',
    service: 'saferMarket',
    namespace: 'saferMarket',
    method: 'uninstallInstalled',
    invocation: { kind: 'direct' },
    parameters: [
      {
        name: 'update',
        wire: 'update',
        source: 'json',
        codec: {
          mode: 'strict',
          typeSymbol: 'safer-dsh-market#UninstallInstalledUpdate',
          create: () => uninstallInstalledUpdateSchema,
        },
      },
    ],
    result: {
      mode: 'strict',
      typeSymbol: 'safer-dsh-market#MarketInstalledResult',
      create: () => marketInstalledResultSchema,
    },
  },
]
