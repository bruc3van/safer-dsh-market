import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type SafeMarketLocaleKey } from './locales.ts';
export type { ChooseWorkspaceOutcome, InstallOutcome, MarketSectionInjected, MarketSectionProps, WorkspaceReadiness, } from './MarketSection.tsx';
export type { SafeMarketLocaleKey } from './locales.ts';
export { NO_SESSION, SESSIONS_PENDING } from './SkillsView.tsx';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The safe plugin marketplace's copy. */
        'settings.saferMarket': SafeMarketLocaleKey;
    }
}
/** Dictionary namespace owned by this plugin. */
export declare const NS = "settings.saferMarket";
/** Required DSH services: locale, Remote, split Controllers, navigation, and conversation. */
export declare const inject: string[];
/**
 * Compose the marketplace surface.
 * @param ctx - client root context.
 */
export declare function apply(ctx: ClientContext): void;
