/** Launcher-owned identity wins over legacy plugin configuration. */
export declare function resolveActiveProfile(context: {
    name: string;
    dir: string;
    home: string;
} | undefined, configured: string): {
    name: string;
    dir?: string;
    home?: string;
};
