/** The market switch is a volatile Config field persisted by DSH Settings. */
import type { Context } from '@deepseek-ai/cordis';
import type { Config } from './index.ts';
import type { SafeMarketSettings } from './contract.ts';
/** Bind the custom market page to its actual Loader entry and live Config. */
export declare function registerSafeMarketSettings(ctx: Context, config: Config): {
    get(): SafeMarketSettings;
    update(patch: SafeMarketSettings): Promise<void>;
};
