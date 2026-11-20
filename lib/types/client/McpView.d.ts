/**
 * The MCP page: every MCP server this Host runs, one card each.
 *
 * Managed servers come from the official `dsh-mcp-manager` (status streamed
 * live, configuration written through Settings, secrets kept in the
 * credential store). Static `dsh-mcp-client` rows the manager cannot govern
 * are listed below them, read-only, so the page never claims "no servers" on
 * a machine that runs several. All state and I/O live in ./mcpController.ts;
 * the rules this view renders from live in ./mcpModel.ts.
 */
import { type ReactElement } from 'react';
import type { MarketLocale } from './copy.ts';
import { type McpController } from './mcpController.ts';
/** The MCP page. */
export declare function McpView({ t, controller, onBrowsePlugins }: {
    t: MarketLocale;
    controller: McpController;
    onBrowsePlugins?: () => void;
}): ReactElement;
