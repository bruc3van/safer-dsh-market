import { type RefObject } from 'react';
/** Minimal DOM surface used to resolve and reset the active scroll container. */
export interface ScrollHost {
    scrollTop: number;
    clientHeight?: number;
    scrollTo: (options?: ScrollToOptions) => void;
    closest: (selector: string) => ScrollHost | null;
    querySelector?: (selector: string) => ScrollHost | null;
}
/**
 * Resolve the active scroll container for `BackToTop`.
 *
 * Inside `.dsh_market_pluginTab`, the plugin hands vertical scrolling to the
 * host's `[data-plugin-body]`; standalone surfaces keep scrolling inside the
 * active panel's `.dsh_market_results`.
 */
export declare function resolveBackToTopScroller<T extends ScrollHost>(root: T | null): T | null;
/**
 * Reset a results list to the top, falling back to `[data-plugin-body]` only
 * when the list is visible inside `.dsh_market_pluginTab`.
 */
export declare function scrollResultsContainerToTop(list: ScrollHost | null, behavior?: ScrollBehavior): void;
/** Return the active list to its start without scrolling the surrounding app. */
export declare function BackToTop({ root, page, label }: {
    root: RefObject<HTMLDivElement>;
    page: string;
    label: string;
}): import("react").JSX.Element | null;
