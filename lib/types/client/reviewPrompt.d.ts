import type { MarketLocale } from './copy.ts';
/** Every AI install/update entry uses the same localized policy and target. */
export declare function buildReviewPrompt(t: MarketLocale, request: {
    profile: string;
    url: string;
    installed?: string;
}): string;
