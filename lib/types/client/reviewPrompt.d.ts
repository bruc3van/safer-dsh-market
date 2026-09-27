import type { MarketLocale } from './copy.ts';
import type { DirectState } from './directInstall.ts';
export interface ReviewTarget {
    packageName?: string;
    version?: string;
    installReference?: string;
    application?: string;
}
/** Only confirmed successful components are offered, including a partially completed batch. */
export declare function installedReviewTargets(state: DirectState): ReviewTarget[];
/** Actual local identity must be verified by the reviewer; metadata is never an instruction. */
export declare function buildReviewPrompt(t: MarketLocale, request: {
    profile: string;
    targets: readonly ReviewTarget[];
}): string;
