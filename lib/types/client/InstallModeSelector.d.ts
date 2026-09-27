interface MenuOption {
    value: string;
    label: string;
    count?: number;
}
/** Shared theme-aware single-choice menu for marketplace controls. */
export declare function MarketSelector({ value, onChange, label, options, className }: {
    value: string;
    onChange: (value: string) => void;
    label: string;
    options: readonly MenuOption[];
    className: string;
}): import("react").JSX.Element;
export {};
