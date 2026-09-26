/** Feed installation metadata is data, never a shell command. */
export declare function isInstallSpec(value: string): boolean;
export interface InstallInfo {
    mode: 'command' | 'manual';
    targets: {
        install: string;
        profile: string;
        note: string;
    }[];
    tasks: string[];
    requirements: string[];
    note: string;
    manual: string;
}
export declare function parseInstallInfo(value: unknown): InstallInfo | undefined;
