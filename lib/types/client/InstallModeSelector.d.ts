import type { MarketLocale } from './copy.ts';
type Mode = 'direct' | 'prompt';
/** Theme-aware menu, retaining keyboard selection and dismissal. */
export declare function InstallModeSelector({ value, onChange, t }: {
    value: Mode;
    onChange: (mode: Mode) => void;
    t: MarketLocale;
}): import("react").JSX.Element;
export {};
