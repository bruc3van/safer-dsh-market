interface MenuOption<T extends string = string> {
    value: T;
    label: string;
    count?: number;
}
/**
 * Single-choice filter control: a host selector trigger opening the host
 * `Menu`, which owns keyboard walking, outside dismissal, viewport fitting
 * and the shared translucent menu material.
 */
export declare function MarketSelector<T extends string = string>({ value, onChange, label, options, className }: {
    value: T;
    onChange: (value: T) => void;
    label: string;
    options: readonly MenuOption<T>[];
    className: string;
}): import("react").JSX.Element;
export {};
