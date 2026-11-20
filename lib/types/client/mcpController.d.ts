/**
 * The MCP page's I/O: one store over the three official Remotes and this
 * market's own Host read.
 *
 * - `remote.mcpManager.watch` streams the live server list; `restart` and
 *   `probe` are its recovery verbs. It has no write method by design.
 * - `remote.settings` reads and writes the manager's `servers` namespace —
 *   the only write path, validated by the manager and revision-checked.
 * - `remote.credentials` describes and stores `${credential:REF}` values;
 *   no read path ever returns a value.
 * - `remote.dshMarketPro.inspectMcp` names the manager's namespace and lists
 *   static rows and live tools the manager cannot see.
 *
 * The stream runs only while a page is attached, so a closed market holds no
 * Host stream open.
 * @module dsh-market-pro/client/mcpController
 */
import type { McpAdoptResult, McpHostContext } from '../contract.ts';
import { type McpCredentialInfo, type McpDraft, type McpRow, type McpServerView, type McpSettingsOp, type McpSettingsView } from './mcpModel.ts';
type Reply<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: {
        code: string;
        message: string;
    };
};
/** The probe outcome, as `mcpManager.probe` returns it. */
export type McpProbeResult = {
    readonly ok: true;
    readonly serverInfo?: {
        readonly name: string;
        readonly version: string;
    };
    readonly toolNames: readonly string[];
    readonly truncated: boolean;
    readonly durationMs: number;
    readonly closeConfirmed: boolean;
    readonly cleanupError?: string;
} | {
    readonly ok: false;
    readonly stage: 'connect' | 'list';
    readonly message: string;
    readonly durationMs: number;
    readonly closeConfirmed: boolean;
    readonly cleanupError?: string;
};
/** `ctx.remote.mcpManager`, structurally. */
export interface McpManagerFace {
    watch(signal?: AbortSignal): AsyncIterable<readonly McpServerView[]> & {
        dispose?(): void;
    };
    restart(name: string): Promise<Reply<void>>;
    probe(name: string, signal?: AbortSignal): Promise<Reply<McpProbeResult>>;
}
/** `ctx.remote.settings`, structurally (the subset this page uses). */
export interface McpSettingsFace {
    describe(): Promise<Reply<{
        writable: boolean;
        hasDocument?: boolean;
        namespaces: readonly McpSettingsView[];
    }>>;
    mutate(ns: string, ops: McpSettingsOp[], expectedRevision?: number): Promise<Reply<McpSettingsView>>;
    /** Open the provider-held Settings document in the Host's native text editor. */
    openSettingsDocument?(signal?: AbortSignal): Promise<Reply<{
        opened: true;
    }>>;
}
/** `ctx.remote.credentials`, structurally. */
export interface McpCredentialsFace {
    describe(refs: string[]): Promise<Reply<Record<string, McpCredentialInfo>>>;
    set(ref: string, value: string): Promise<Reply<void>>;
    /** Remove a stored value; an environment fallback then applies again. */
    unset?(ref: string): Promise<Reply<void>>;
}
/** One row of the official plugin manager's `listPlugins` (the subset this page reads). */
export interface McpPluginRow {
    readonly entryId: string;
    readonly moduleName: string;
    readonly enabled: boolean;
    readonly readOnlyReason?: 'management-required' | 'unaddressable';
}
/** The official plugin manager's entry-level outcome (the subset this page reads). */
export interface McpPluginChange {
    readonly changed: boolean;
    readonly application: 'failed' | 'cancelled' | 'applied' | 'restart-required' | 'overridden';
    readonly error?: {
        readonly code: string;
        readonly diagnostic?: string;
    };
}
/**
 * `ctx.remote.pluginManager`, structurally: the official way to switch one
 * profile Loader entry. It owns the patch-layer rules (edit the last matching
 * override, drop an override equal to the composition) and the live reload,
 * so this page never writes the profile itself.
 */
export interface McpPluginsFace {
    listPlugins(): Promise<Reply<readonly McpPluginRow[]>>;
    setPluginEnabled(id: string, enabled: boolean): Promise<Reply<McpPluginChange>>;
}
/** Where the controller finds each Remote; every getter may answer undefined. */
export interface McpHosts {
    manager(): McpManagerFace | undefined;
    settings(): McpSettingsFace | undefined;
    credentials(): McpCredentialsFace | undefined;
    plugins?(): McpPluginsFace | undefined;
    inspect(): Promise<McpHostContext>;
    /** This market's Host adoption verb (`dshMarketPro.adoptMcp`); throws on refusal. */
    adopt?(loaderId: string): Promise<McpAdoptResult>;
}
/** Whether, and why not, one static row can be switched through the plugin manager. */
export type McpStaticToggle = {
    readonly available: true;
} | {
    readonly available: false;
    readonly reason: 'management-required' | 'unaddressable' | 'unlisted';
};
/** One card's in-flight probe. */
export type McpProbeState = {
    readonly status: 'running';
} | {
    readonly status: 'done';
    readonly result: McpProbeResult;
} | {
    readonly status: 'error';
    readonly message: string;
};
/**
 * What the page can do here.
 * - `full`: manager present, Settings writable.
 * - `readonly`: manager present, writes refused (a non-owner peer, a read-only profile, no Settings namespace).
 * - `legacy`: this runtime has no manager; only static rows can be shown.
 * - `error`: the Host read itself failed — not a verdict on the runtime's version.
 */
export type McpMode = 'loading' | 'error' | 'full' | 'readonly' | 'legacy';
/** The page's whole state. */
export interface McpSnapshot {
    readonly mode: McpMode;
    readonly host: McpHostContext | null;
    readonly hostError: string;
    readonly views: readonly McpServerView[] | null;
    readonly watchError: string;
    readonly settings: McpSettingsView | null;
    readonly settingsError: string;
    /** Whether Settings reports a local document the Host can open. */
    readonly hasSettingsDocument: boolean;
    readonly rows: readonly McpRow[];
    readonly credentials: Readonly<Record<string, McpCredentialInfo>>;
    /** Row name → the verb in flight. */
    readonly busy: Readonly<Record<string, string>>;
    /** Row name → the last verb's failure. */
    readonly errors: Readonly<Record<string, string>>;
    readonly probes: Readonly<Record<string, McpProbeState>>;
    /** Row key → a non-failure outcome worth saying (`restart-required`). */
    readonly notices: Readonly<Record<string, string>>;
    /**
     * Static row Loader id → its plugin-manager switch; null while unread or
     * when this Host exposes no plugin manager.
     */
    readonly staticToggles: Readonly<Record<string, McpStaticToggle>> | null;
    /** Managed row name → what moving it from a static row did, until the page reloads. */
    readonly adopted: Readonly<Record<string, McpAdoptNote>>;
}
/**
 * The outcome of one adoption, as its managed card reports it.
 * - `enabled`: the static row stopped and the managed entry took over.
 * - `kept-off`: the static row was already off, so the entry stays off too.
 * - `restart`: the static row stops only after a DSH restart; enable the entry then.
 * - `disable-failed` / `enable-failed`: the entry exists, switched off; `error` says why.
 */
export interface McpAdoptNote {
    readonly state: 'enabled' | 'kept-off' | 'restart' | 'disable-failed' | 'enable-failed';
    readonly stored: readonly string[];
    readonly reused: readonly string[];
    readonly dropped: readonly string[];
    readonly error?: string;
}
/** What a save reports back to the editor. */
export type McpSaveOutcome = {
    readonly ok: true;
} | {
    readonly ok: false;
    readonly message: string;
    readonly conflict: boolean;
};
/** The controller's face. */
export interface McpController {
    getSnapshot(): McpSnapshot;
    subscribe(listener: () => void): () => void;
    /** Start the stream and the reads for one visible page; the disposer stops them when the last page leaves. */
    attach(): () => void;
    refresh(): Promise<void>;
    /** Restart the stream after a carrier reset. */
    reset(): void;
    setEnabled(name: string, enabled: boolean): Promise<void>;
    /** Drop the user-layer entry: removes a user server, restores an inherited one. */
    remove(name: string): Promise<void>;
    restart(name: string): Promise<void>;
    probe(name: string): Promise<void>;
    save(draft: McpDraft, original: string | undefined): Promise<McpSaveOutcome>;
    /** Store one credential value; resolves to an error message, or '' on success. */
    setCredential(ref: string, value: string): Promise<string>;
    /** Remove one stored credential; resolves to an error message, or '' on success. */
    clearCredential(ref: string): Promise<string>;
    /** Switch one static `dsh-mcp-client` row through the official plugin manager. */
    setStaticEnabled(loaderId: string, enabled: boolean): Promise<void>;
    /**
     * Move one static row under the manager: the Host stores its secrets and
     * writes the entry switched off, the static row is switched off through
     * the plugin manager, and the entry is switched on once it has stopped.
     */
    adopt(loaderId: string): Promise<void>;
    /** Open the Host's Settings document in its native editor; resolves to an error message, or ''. */
    openSettingsDocument(): Promise<string>;
    /** Which optional Host verbs this runtime offers. */
    supports(feature: 'adopt' | 'unsetCredential' | 'openDocument'): boolean;
    /** Re-read the Host facts after a plugin change elsewhere; a no-op while no page is attached. */
    invalidate(): void;
    /** A Settings document changed elsewhere (`settings/document-updated`). */
    settingsChanged(): void;
    /** A credential reference changed (`credentials/reference-updated`). */
    credentialsChanged(): void;
}
/** The busy/error/notice key of one static row. */
export declare const staticKey: (loaderId: string) => string;
/** Optional timer seams, for tests. */
export interface McpControllerOptions {
    readonly wait?: (ms: number) => Promise<void>;
    readonly debounceMs?: number;
}
/** Create the controller over the given Remotes. */
export declare function createMcpController(hosts: McpHosts, options?: McpControllerOptions): McpController;
export {};
