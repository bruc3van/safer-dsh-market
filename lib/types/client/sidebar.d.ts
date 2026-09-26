import type { Context } from '@deepseek-ai/cordis';
import type { PropsRuntime, PropsLocale, InjectFace } from '@deepseek-ai/dsh-client-ui-slots';
import { type MarketSectionInjected } from './MarketSection.tsx';
export declare const MARKET_TAB_ID = "safer-dsh-market";
declare const NS = "settings.safeMarket";
type MarketSidebarProps = PropsRuntime<'sidebar.right.pane.tab'> & InjectFace<MarketSectionInjected> & PropsLocale<typeof NS>;
/** Reuse the market face; the tab owns dismissal after a successful hand-off. */
export declare function MarketSidebar({ useTabInfo, ...props }: MarketSidebarProps): import("react").JSX.Element;
type MarketMainProps = PropsRuntime<'main'> & InjectFace<MarketSectionInjected & {
    close: () => void;
}> & PropsLocale<typeof NS>;
/** The global page shares the shared install hand-off. */
export declare function MarketMain(props: MarketMainProps): import("react").JSX.Element;
/** Publish the navigation row only while its destination slot is available. */
export declare function registerMarketNavigation(ctx: Context, injectMarket: () => MarketSectionInjected): void;
/** An optional child fiber keeps left navigation available without the right Sidebar. */
export declare function registerMarketSidebar(ctx: Context, injectMarket: () => MarketSectionInjected): void;
export {};
