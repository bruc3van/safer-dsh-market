import { type ReactElement } from 'react';
import type { MarketLocale } from './copy.ts';
import { type PluginUpdater, type UpdateState } from './pluginUpdates.ts';
/** Three-stage sequential batch updater: confirm list -> run with skip-on-failure -> summary. */
export declare function BatchUpdatePanel({ open, state, updater, t, onClose }: {
    open: boolean;
    state: UpdateState;
    updater: PluginUpdater;
    t: MarketLocale;
    onClose: () => void;
}): ReactElement;
