import { type ReactNode } from 'react';
/** One external destination offered from the header's More menu. */
export interface MarketMoreLink {
    id: string;
    label: string;
    href: string;
    icon?: ReactNode;
}
/**
 * The header's overflow control: an icon-only trigger opening the host `Menu`,
 * whose rows open their destination in a new browsing context.
 */
export declare function MarketMoreActions({ label, links }: {
    label: string;
    links: readonly MarketMoreLink[];
}): import("react").JSX.Element;
