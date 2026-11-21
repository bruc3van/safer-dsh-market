import { type ReactElement } from 'react';
import type { MarketLocale } from './copy.ts';
import type { HeaderRefreshAction } from './MarketSection.tsx';
import { type McpController } from './mcpController.ts';
/** The MCP page. */
export declare function McpView({ t, controller, onBrowsePlugins, onRegisterRefresh }: {
    t: MarketLocale;
    controller: McpController;
    onBrowsePlugins?: () => void;
    onRegisterRefresh?: (action: HeaderRefreshAction | null) => void;
}): ReactElement;
