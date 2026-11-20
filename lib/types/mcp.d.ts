/**
 * The Host half of the MCP page: the facts the official `mcpManager` and
 * Settings Remotes cannot answer.
 *
 * - **Which entry the manager is.** Settings names a namespace after the
 *   Loader entry id, so the browser learns that id here instead of guessing.
 * - **Unmanaged servers.** A `dsh-mcp-client` row composed straight into the
 *   profile (a bundle, a tool that edits `cordis.patch.yml`) is invisible to
 *   the manager; listing it here keeps the page from reading "no servers"
 *   on a machine that runs several.
 * - **Live tools.** The global tool view, grouped by server namespace.
 *
 * Read-only by construction: nothing here writes the profile or the Loader.
 * Static rows are masked before they leave the Host — only env and header
 * NAMES travel, and a secret-looking argument or URL query value is replaced.
 * @module dsh-market-pro/mcp
 */
import type { Context } from '@deepseek-ai/cordis';
import type { McpHostContext, McpToolGroup, McpUnmanagedServer } from './contract.ts';
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
