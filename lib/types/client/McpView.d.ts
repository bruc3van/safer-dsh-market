import { type ReactElement } from 'react';
import type { MarketLocale } from './copy.ts';
import { type McpController } from './mcpController.ts';
/** The MCP page. */
export declare function McpView({ t, controller, onBrowsePlugins }: {
    t: MarketLocale;
    controller: McpController;
    onBrowsePlugins?: () => void;
}): ReactElement;
