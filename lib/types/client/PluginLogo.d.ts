/**
 * A plugin's own artwork, else its owner's GitHub avatar, else a letter
 * placeholder. Each failed request (offline, blocked by the host's CSP) moves
 * one step down, so the layout never shows a broken image.
 */
export declare function PluginLogo({ src, name, fullName }: {
    src?: string;
    name: string;
    fullName?: string;
}): import("react").JSX.Element;
