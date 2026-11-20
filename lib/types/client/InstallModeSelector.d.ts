interface MenuOption<T extends string = string> {
    value: T;
    label: string;
    count?: number;
}
/** Shared theme-aware single-choice menu for marketplace controls. */
export declare function MarketSelector<T extends string = string>({ value, onChange, label, options, className }: {
    value: T;
    onChange: (value: T) => void;
    label: string;
    options: readonly MenuOption<T>[];
    className: string;
}): import("react").JSX.Element;
export {};
