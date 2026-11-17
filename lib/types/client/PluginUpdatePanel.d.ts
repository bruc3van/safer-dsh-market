import type { MarketLocale } from './copy.ts';
import type { PluginUpdater, UpdateState } from './pluginUpdates.ts';
/** Checking is read-only; only the version confirmation invokes updateBundle. */
export declare function PluginUpdatePanel({ open, state, updater, t, onClose }: {
    open: boolean;
    state: UpdateState;
    updater: PluginUpdater;
    t: MarketLocale;
    onClose: () => void;
}): import("react").JSX.Element;
