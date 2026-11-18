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
/**
 * The install hand-off for a catalog repository with no recorded install
 * target: the agent verifies the repository, resolves a package or
 * subdirectory, and installs through the official manager. The prompt is
 * staged as a draft — the user still decides to send it.
 */
export declare function buildInstallPrompt(t: MarketLocale, request: {
    profile: string;
    repo: string;
    name: string;
}): string;
