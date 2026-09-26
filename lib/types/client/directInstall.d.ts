import type { Context } from '@deepseek-ai/cordis';
type Manager = Context['remote']['pluginManager'];
export type InstallHost = Pick<Manager, 'inspect' | 'installBundle' | 'cancelInstall' | 'waitForInstall'>;
export interface DirectState {
    phase: 'idle' | 'checking' | 'installing' | 'cancelling' | 'unknown' | 'done' | 'failed';
    spec: string;
    message: string;
    application?: string;
    pendingBuilds: string[];
}
export declare function createDirectInstaller(host: () => InstallHost | undefined): {
    getSnapshot: () => DirectState;
    subscribe: (fn: () => void) => () => void;
    start: (spec: string, builds?: string[]) => Promise<void>;
    reset(): void;
    approve: () => Promise<void>;
    cancel(): Promise<void>;
    recover(): Promise<void>;
};
export type DirectInstaller = ReturnType<typeof createDirectInstaller>;
export {};
