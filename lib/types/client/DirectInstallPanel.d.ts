import type { MarketPlugin } from '../contract.ts';
import type { MarketLocale } from './copy.ts';
import type { DirectInstaller } from './directInstall.ts';
/** One shared installation remains observable if the recommendation page remounts. */
export declare function DirectInstallPanel({ item, installer, t, onClose, onInstalled }: {
    item: MarketPlugin | null;
    installer: DirectInstaller;
    t: MarketLocale;
    onClose: () => void;
    onInstalled: () => void;
}): import("react").JSX.Element;
