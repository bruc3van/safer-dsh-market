import { type ReactElement } from 'react';
import type { SafeMarketSettings, SafeMarketSettingsUpdate } from '../contract.ts';
import type { MarketLocale } from './copy.ts';
export interface SettingsViewProps {
    readonly t: MarketLocale;
    readonly settings: SafeMarketSettings;
    readonly settingsReady: boolean;
    readonly updateSettings?: (update: SafeMarketSettingsUpdate) => Promise<SafeMarketSettings>;
    readonly onTryAssistant?: () => void;
    readonly tryBusy?: boolean;
    readonly tryMessage?: string;
}
/** Built-in settings tab for toggling the AI assistant and online catalog access. */
export declare function SettingsView({ t, settings, settingsReady, updateSettings, onTryAssistant, tryBusy, tryMessage, }: SettingsViewProps): ReactElement;
