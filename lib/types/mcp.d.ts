import type { Context } from '@deepseek-ai/cordis';
import type { McpAdoptBlocker, McpAdoptResult, McpHostContext, McpProbeResult, McpToolGroup, McpUnmanagedServer } from './contract.ts';
/** The Loader entry fields this scan reads, structurally. */
export interface McpLoaderEntry {
    readonly id: string;
    readonly disabled: boolean;
    readonly options: {
        readonly id: string;
        readonly name: string;
        readonly config?: unknown;
    };
    readonly fiber?: {
        readonly state: number;
    };
}
/** Reduce one static `dsh-mcp-client` row to its masked, wire-safe view. */
export declare function unmanagedOf(entry: McpLoaderEntry): McpUnmanagedServer;
/** One plaintext value the adoption moves into the credential store. */
export interface McpAdoptSecret {
    /** What the credential reference is named after (`api-key`, `GITHUB_TOKEN`, …). */
    readonly label: string;
    readonly value: string;
}
/** A static row, translated into a manager entry whose secrets await their references. */
export interface McpAdoptPlan {
    readonly name: string;
    readonly secrets: readonly McpAdoptSecret[];
    /** Fields the manager does not accept, by config path; they are left behind. */
    readonly dropped: readonly string[];
    /** The entry, with secret `i` replaced by the template of `refs[i]`. */
    build(refs: readonly string[]): Record<string, unknown>;
}
/**
 * Translate one static `dsh-mcp-client` config into a manager entry.
 *
 * Every plaintext secret the scan would mask becomes a credential slot; a
 * `process.env.NAME` expression becomes `${credential:NAME}`; any other
 * expression, an unknown transport or an illegal server name blocks it.
 */
export declare function adoptionPlan(config: unknown): McpAdoptPlan | {
    readonly blocker: Exclude<McpAdoptBlocker, ''>;
};
/** Why one static config cannot be adopted, or `''`. */
export declare function adoptBlockerOf(config: unknown): McpAdoptBlocker;
/** Probe through the official manager with the entry's startup budget, capped at two minutes. */
export declare function probeManagedMcp(ctx: Context, entries: Iterable<McpLoaderEntry>, name: string, signal: AbortSignal): Promise<McpProbeResult>;
/**
 * Move one static row under the manager.
 *
 * Secrets go to the credential store first — each under a fresh reference,
 * or an existing one that already holds the same value — then the templated
 * entry is written switched off, so it never races the static row for its
 * server name; the browser turns it on once the static row has stopped. A
 * failure before the write leaves Settings untouched.
 * @param loaderId - the static row's full Loader identity.
 * @throws Error when the row is unknown or blocked, the name is taken, or a store refuses.
 */
export declare function adoptMcp(ctx: Context, entries: Iterable<McpLoaderEntry>, loaderId: string): Promise<McpAdoptResult>;
/**
 * Group `mcp__<server>__<tool>` names under their server. A known server name
 * wins by longest prefix (server names may themselves contain `__`); anything
 * else splits at the first separator.
 */
export declare function groupTools(definitions: readonly {
    readonly name: string;
    readonly description?: unknown;
}[], known: readonly string[]): McpToolGroup[];
/**
 * Read the MCP facts this Host holds.
 * @param ctx - the plugin context (the tool registry is reached optionally).
 * @param entries - the live Loader entries.
 */
export declare function inspectMcpContext(ctx: Context, entries: Iterable<McpLoaderEntry>): McpHostContext;
/** Host-reported lifecycle facts, excluding free-form remote diagnostics. */
interface ManagedMcpConnection {
    readonly state: string;
    readonly toolCount: number;
    readonly attempt?: number;
    readonly reason?: string;
}
/** One managed MCP server summary exposed safely to Host-side Agent tools (no secret values). */
export interface ManagedMcpSummary extends ManagedMcpConnection {
    readonly name: string;
    readonly transport: 'stdio' | 'streamable-http' | 'unknown';
    readonly target: string;
    readonly enabled: boolean;
    readonly credentialRefs: readonly string[];
    readonly identityKey: string;
    readonly registeredOnly?: boolean;
    readonly retained?: boolean;
}
/** Complete masked inventory of managed and static MCP servers in this profile. */
export interface ManagedMcpInspection {
    readonly managerEntry: string | null;
    readonly managerActive: boolean;
    readonly settingsWritable: boolean;
    readonly settingsRevision?: number;
    readonly managed: readonly ManagedMcpSummary[];
    readonly unmanaged: readonly McpUnmanagedServer[];
    readonly tools: readonly McpToolGroup[];
    readonly takenNames: readonly string[];
}
/** Input for installing a curated MCP server into the official DSH manager. */
export interface FeaturedMcpInstallInput {
    readonly kind: 'featured';
    readonly featuredId: string;
    readonly name?: string;
    /** Non-secret input values (e.g. `dir` for filesystem). Plaintext secrets are rejected. */
    readonly inputs?: Readonly<Record<string, string>>;
    /** Optional explicit credential reference names for secret inputs. */
    readonly credentialRefs?: Readonly<Record<string, string>>;
    readonly enabled?: boolean;
}
/** Input for installing a custom MCP server into the official DSH manager. */
export interface CustomMcpInstallInput {
    readonly kind: 'custom';
    readonly name: string;
    readonly transport: 'stdio' | 'streamable-http';
    readonly command?: string;
    readonly args?: readonly string[];
    readonly env?: Readonly<Record<string, string>>;
    readonly cwd?: string;
    readonly url?: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly enabled?: boolean;
}
export type ManagedMcpInstallInput = FeaturedMcpInstallInput | CustomMcpInstallInput;
/** Validated, secret-free installation plan ready for user approval and Settings write. */
export interface ManagedMcpInstallPlan {
    readonly name: string;
    readonly source: 'featured' | 'custom';
    readonly featuredId?: string;
    readonly featuredTitle?: string;
    readonly transport: 'stdio' | 'streamable-http';
    readonly entry: Readonly<Record<string, unknown>>;
    readonly preview: string;
    readonly enabled: boolean;
    readonly credentialRefs: readonly string[];
    readonly risks: readonly ('fetch' | 'shell')[];
}
/** Outcome of writing a managed MCP server to Settings. */
export interface ManagedMcpInstallResult {
    readonly name: string;
    readonly source: 'featured' | 'custom';
    readonly featuredId?: string;
    readonly transport: 'stdio' | 'streamable-http';
    readonly preview: string;
    readonly enabled: boolean;
    readonly connection: ManagedMcpConnection;
    readonly credentialRefs: readonly string[];
    readonly configuredCredentials: readonly string[];
    readonly missingCredentials: readonly string[];
}
/**
 * Inspect both managed and static MCP servers on the Host without exposing any
 * secret values. Used by Agent-facing MCP discovery and install tools.
 */
export declare function inspectManagedMcp(ctx: Context, entries: Iterable<McpLoaderEntry>): ManagedMcpInspection;
/**
 * Validate and build a secret-free installation plan before asking the user for
 * approval. Plaintext secrets are refused everywhere: credentials must be
 * passed as `${credential:REF}` templates so secret values never traverse the
 * model context or Settings file.
 */
export declare function buildManagedMcpInstallPlan(input: ManagedMcpInstallInput, takenNames: ReadonlySet<string>, takenRefs?: ReadonlySet<string>): ManagedMcpInstallPlan;
/**
 * Commit a validated install plan to the official `dsh-mcp-manager` Settings
 * namespace using revision-checked `settings.mutate`, then inspect referenced
 * credentials so the caller can guide the user if any secret still needs to be
 * filled in the UI.
 */
export declare function installManagedMcp(ctx: Context, entries: Iterable<McpLoaderEntry>, plan: ManagedMcpInstallPlan): Promise<ManagedMcpInstallResult>;
/** Find a default featured retry by its full launch configuration, including credential references. */
export declare function findExistingFeaturedMcp(ctx: Context, input: FeaturedMcpInstallInput, inspection: ManagedMcpInspection): ManagedMcpSummary | undefined;
/** Settings snapshot covered by native approval. */
export interface ManagedMcpRevision {
    readonly namespace: string;
    /** `undefined` only on a Host whose Settings descriptors carry no revision. */
    readonly revision: number | undefined;
}
/** Toggle one managed MCP server on or off through revision-checked Settings mutation. */
export declare function setManagedMcpEnabled(ctx: Context, entries: Iterable<McpLoaderEntry>, name: string, enabled: boolean, approved: ManagedMcpRevision): Promise<{
    readonly name: string;
    readonly enabled: boolean;
}>;
export {};
