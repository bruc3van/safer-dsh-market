/**
 * The MCP page's pure rules: how the three official reads — the manager's
 * `watch` stream, the manager's Settings namespace, and the credential
 * descriptions — fold into one card per server, and how an editor draft turns
 * back into a path-addressed Settings write.
 *
 * Kept free of React and of any Remote so `node --test` can pin them; the
 * controller in ./mcpController.ts owns the I/O.
 * @module dsh-market-pro/client/mcpModel
 */
import { credentialTemplate, suggestRef } from '../mcpShapes.ts';
export { credentialTemplate, suggestRef };
/** One server's runtime status, as `mcpManager.watch` reports it. */
export type McpStatus = {
    readonly state: 'closed';
    readonly result: {
        readonly closeConfirmed: boolean;
        readonly cleanupError?: string;
    };
} | {
    readonly state: 'waiting-credentials';
    readonly lastError: string;
} | {
    readonly state: 'connecting';
    readonly attempt: number;
} | {
    readonly state: 'connected';
    readonly toolCount: number;
    readonly connectedAt: number;
} | {
    readonly state: 'reconnecting';
    readonly attempt: number;
    readonly maxAttempts: number;
    readonly nextRetryAtMs: number;
    readonly lastError: string;
} | {
    readonly state: 'failed';
    readonly reason: 'gave-up' | 'reconnect-disabled' | 'unclosed-generation';
    readonly lastError?: string;
} | {
    readonly state: 'disabled';
} | {
    readonly state: 'failed';
    readonly reason: 'load';
    readonly lastError: string;
} | {
    readonly state: 'failed';
    readonly reason: 'cleanup';
    readonly result: {
        readonly closeConfirmed: boolean;
        readonly cleanupError?: string;
    };
};
/** One row of the manager's list. */
export interface McpServerView {
    readonly name: string;
    readonly configured: boolean;
    readonly status: McpStatus;
}
/** One `servers.<name>` entry as Settings returns it (defaults resolved in `value`). */
export interface McpEntry {
    readonly transport?: string;
    readonly command?: string;
    readonly args?: readonly string[];
    readonly env?: Readonly<Record<string, string>>;
    readonly cwd?: string;
    readonly url?: string;
    readonly headers?: Readonly<Record<string, string>>;
    readonly enabled?: boolean;
    readonly startupTimeoutMs?: number;
    readonly toolCallTimeoutMs?: number;
    readonly closeTimeoutMs?: number;
    readonly reconnect?: Readonly<Record<string, unknown>>;
}
/** One Settings namespace view (the subset this page reads). */
export interface McpSettingsView {
    readonly ns: string;
    readonly value: unknown;
    readonly base?: unknown;
    readonly user?: unknown;
    readonly revision: number;
}
/** One path-addressed Settings edit. */
export type McpSettingsOp = {
    readonly op: 'set';
    readonly path: readonly string[];
    readonly value: unknown;
} | {
    readonly op: 'unset';
    readonly path: readonly string[];
};
/** One credential reference's described state. */
export interface McpCredentialInfo {
    readonly configured: boolean;
    readonly source?: string;
    readonly writable: boolean;
    readonly masked?: string;
}
/**
 * Where a server comes from, which decides what the page may do with it.
 * - `user`: added in this profile's Settings layer — editable and removable.
 * - `inherited`: from the composition base — editable as an override, never removable.
 * - `overridden`: inherited, with a user-layer override — "restore default" drops it.
 * - `registered`: an installed plugin registered it — read-only, lives with the plugin.
 * - `retained`: removed, but its cleanup failed — only a Host restart clears it.
 */
export type McpSource = 'user' | 'inherited' | 'overridden' | 'registered' | 'retained';
/** One card's facts. */
export interface McpRow {
    readonly name: string;
    readonly source: McpSource;
    /** Resolved entry; absent for registered and retained rows (Settings does not carry them). */
    readonly entry?: McpEntry;
    readonly status?: McpStatus;
    /** Config paths holding a secret in the clear. */
    readonly plaintext: readonly string[];
    /** Credential references the entry names. */
    readonly refs: readonly string[];
}
/** The `servers` map of one Settings layer, or `{}`. */
export declare function serversOf(layer: unknown): Record<string, McpEntry>;
/** Every string of an entry that may carry a template or a secret, with its config path. */
export declare function entryStrings(entry: McpEntry): [string, string][];
/** The credential references an entry names, deduplicated in order. */
export declare function entryRefs(entry: McpEntry): string[];
/** Config paths of an entry that hold a secret in the clear. */
export declare function plaintextSecrets(entry: McpEntry): string[];
/**
 * Fold the manager list and the Settings namespace into cards: configured
 * entries in document order, then plugin registrations, then retained
 * cleanup failures.
 */
export declare function buildRows(views: readonly McpServerView[] | null, settings: McpSettingsView | null): McpRow[];
/** The coarse buckets the status filter and the colour use. */
export type McpStatusKind = 'connected' | 'pending' | 'issue' | 'disabled' | 'locked' | 'unknown';
/** Classify one status; `locked` is cleanup the Host can only clear by restarting. */
export declare function statusKind(status: McpStatus | undefined): McpStatusKind;
/** The status's diagnostic text, when it carries one. */
export declare function statusError(status: McpStatus | undefined): string;
/** Whether the manager's restart verb applies (a fresh reconnect budget). */
export declare function canRestart(row: McpRow): boolean;
/** Whether a one-off probe applies; a disabled entry may be probed before it is turned on. */
export declare function canProbe(row: McpRow): boolean;
/** Whether Settings may edit this row at all. */
export declare function isConfigured(row: McpRow): boolean;
/** Whether the entry is switched on in Settings. */
export declare function isEnabled(row: McpRow): boolean;
/** The transport label a card shows. */
export declare function transportOf(entry: McpEntry | undefined): 'stdio' | 'streamable-http' | 'unknown';
/** Render one command line for display, secrets masked. */
export declare function commandLine(command: string, args: readonly string[]): string;
/** One-line target summary for a card: the masked command line or endpoint. */
export declare function targetOf(entry: McpEntry | undefined): string;
/** Split a pasted command line into words, honouring single and double quotes. */
export declare function splitCommandLine(line: string): string[];
/** Risk notes for a stdio command: dynamic package fetches and shell wrappers. */
export type McpCommandRisk = 'fetch' | 'shell';
/** Which risk notes a command earns. */
export declare function commandRisks(command: string, args: readonly string[]): McpCommandRisk[];
/** One key/value row of the editor (env or headers). */
export interface McpPair {
    readonly key: string;
    readonly value: string;
}
/** A credential the editor will store before it writes the entry. */
export interface McpPendingSecret {
    readonly ref: string;
    readonly value: string;
}
/** The editor's working copy of one entry. */
export interface McpDraft {
    readonly name: string;
    readonly transport: 'stdio' | 'streamable-http';
    readonly command: string;
    readonly args: readonly string[];
    readonly cwd: string;
    readonly env: readonly McpPair[];
    readonly url: string;
    readonly headers: readonly McpPair[];
    readonly enabled: boolean;
    /** Text fields, so a half-typed number is not coerced away. */
    readonly startupTimeoutMs: string;
    readonly toolCallTimeoutMs: string;
    readonly closeTimeoutMs: string;
    /** Reconnect policy; an empty number means the client's default. */
    readonly reconnectEnabled: boolean;
    readonly initialDelayMs: string;
    readonly maxDelayMs: string;
    readonly maxAttempts: string;
    /** Fields this editor does not render, carried through untouched. */
    readonly extra: Readonly<Record<string, unknown>>;
    /** Plaintext values the user chose to move into the credential store. */
    readonly pending: readonly McpPendingSecret[];
}
/** A fresh draft. New servers start switched off, so they can be probed first. */
export declare function emptyDraft(): McpDraft;
/** `dsh-mcp-client`'s close-timeout default. */
export declare const DEFAULT_CLOSE_MS = 5000;
/** `dsh-mcp-client`'s reconnect defaults; Settings resolves them into every entry. */
export declare const RECONNECT_DEFAULTS: {
    readonly initialDelayMs: 500;
    readonly maxDelayMs: 30000;
    readonly maxAttempts: 10;
};
/** A draft over an existing entry. */
export declare function draftFromEntry(name: string, entry: McpEntry): McpDraft;
/** What a field-level validation failure names. */
export type McpDraftError = {
    readonly field: 'name';
    readonly code: 'required' | 'pattern' | 'taken';
} | {
    readonly field: 'command';
    readonly code: 'required';
} | {
    readonly field: 'url';
    readonly code: 'required' | 'scheme';
} | {
    readonly field: 'env' | 'headers';
    readonly code: 'key' | 'duplicate';
} | {
    readonly field: 'template';
    readonly code: 'malformed';
    readonly where: string;
} | {
    readonly field: McpNumberField;
    readonly code: 'number';
} | {
    readonly field: 'maxDelayMs';
    readonly code: 'order';
};
/** The editor's numeric fields, all positive integers. */
export type McpNumberField = 'startupTimeoutMs' | 'toolCallTimeoutMs' | 'closeTimeoutMs' | 'initialDelayMs' | 'maxDelayMs' | 'maxAttempts';
/**
 * The same rules the manager enforces at write time, checked before the
 * round trip so the form can point at the field rather than a Host message.
 * @param taken - every name already in use (managed, registered or static), minus the one being edited.
 */
export declare function validateDraft(draft: McpDraft, taken: ReadonlySet<string>): McpDraftError[];
/** The entry a draft writes: only the fields its transport uses, plus carried extras. */
export declare function entryFromDraft(draft: McpDraft): Record<string, unknown>;
/** The credentials a save must store first: pending ones whose template the draft still names. */
export declare function pendingToStore(draft: McpDraft): McpPendingSecret[];
/**
 * The Settings edits one save performs. A rename of a user-layer entry drops
 * the old key in the same write, so the document never holds both.
 */
export declare function saveOps(draft: McpDraft, original: string | undefined): McpSettingsOp[];
/**
 * Move one plaintext value into the pending credential list and put its
 * template in its place. A `Bearer <token>` header keeps its scheme word.
 * @param where - `args[3]`, `env.NAME`, `headers.NAME` or `url`.
 */
export declare function convertToCredential(draft: McpDraft, where: string, ref: string): McpDraft;
/** The plaintext secrets a draft still carries, by config path. */
export declare function draftPlaintext(draft: McpDraft): string[];
/** Summary counts for the page header. */
export declare function summarize(rows: readonly McpRow[], unmanaged: number): {
    servers: number;
    connected: number;
    tools: number;
};
