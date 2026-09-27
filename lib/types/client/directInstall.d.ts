type Reply<T> = {
    ok: true;
    value: T;
} | {
    ok: false;
    error: {
        message: string;
    };
};
interface InstallResult {
    application: 'applied' | 'restart-required' | 'overridden' | 'failed' | 'cancelled';
    pendingBuilds?: string[];
    warnings?: string[];
    error?: {
        code: string;
        diagnostic?: string;
        incompatible?: {
            name: string;
            version: string;
            peers: Record<string, string>;
        }[];
    };
    packageResult?: {
        output?: string;
    };
}
export interface InstallHost {
    inspect(spec: string, options: {
        registry?: string | null;
    }): Promise<Reply<{
        status: 'accepted';
        registry: string | null;
    } | {
        status: 'refused';
        problem: string;
        reason: string;
    }>>;
    installBundle(spec: string, options?: {
        requestId?: string;
        registry?: string | null;
        enabled?: boolean;
        approvedBuilds?: string[];
    }): Promise<Reply<InstallResult>>;
    cancelInstall(requestId: string): Promise<Reply<{
        status: string;
    }>>;
    waitForInstall(requestId: string): Promise<Reply<InstallResult | null>>;
}
export interface DirectState {
    phase: 'idle' | 'checking' | 'installing' | 'cancelling' | 'unknown' | 'done' | 'failed';
    spec: string;
    message: string;
    application?: string;
    pendingBuilds: string[];
    queue: {
        spec: string;
        phase: DirectState['phase'];
        application?: string;
        message: string;
    }[];
}
export declare function createDirectInstaller(host: () => InstallHost | undefined): {
    getSnapshot: () => DirectState;
    subscribe: (fn: () => void) => () => void;
    start(input: string | string[]): Promise<void>;
    retry(): Promise<void>;
    reset(): void;
    approve: () => Promise<void>;
    cancel(): Promise<void>;
    recover(): Promise<void>;
};
export type DirectInstaller = ReturnType<typeof createDirectInstaller>;
export {};
