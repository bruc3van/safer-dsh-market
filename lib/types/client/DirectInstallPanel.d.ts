import type { MarketPlugin } from '../contract.ts';
import type { MarketLocale } from './copy.ts';
import type { DirectInstaller } from './directInstall.ts';
import { type ReviewTarget } from './reviewPrompt.ts';
/** One shared installation remains observable if the recommendation page remounts. */
export declare function DirectInstallPanel({ item, installer, t, onClose, onInstalled, onReview, reviewBusy, reviewAvailable, reviewMessage }: {
    item: MarketPlugin | null;
    installer: DirectInstaller;
    t: MarketLocale;
    onClose: () => void;
    onInstalled: () => void;
    onReview: (targets: ReviewTarget[]) => Promise<boolean>;
    reviewBusy: boolean;
    reviewAvailable: boolean;
    reviewMessage: string;
}): import("react").JSX.Element;
