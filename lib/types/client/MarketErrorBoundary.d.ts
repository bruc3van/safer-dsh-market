import { Component, type ErrorInfo, type ReactNode } from 'react';
import type { MarketLocale } from './copy.ts';
interface BoundaryProps {
    readonly t: MarketLocale;
    /** Which entry crashed, so a pasted report names the surface. */
    readonly surface: string;
    readonly children: ReactNode;
}
interface BoundaryState {
    readonly crash: {
        readonly error: unknown;
        readonly componentStack: string;
    } | null;
    /** Bumped by Retry so the subtree remounts from scratch. */
    readonly attempt: number;
}
/** Plain-text report a user can paste into an issue; nothing here is secret. */
export declare function describeCrash(surface: string, error: unknown, componentStack: string): string;
/**
 * The Host's own slot boundary renders an empty anchor when an entry throws
 * and logs to a console that mobile WebViews never expose, so the page goes
 * blank with nothing to report. This boundary sits inside the entry and keeps
 * a crash visible, retryable and copyable.
 */
export declare class MarketErrorBoundary extends Component<BoundaryProps, BoundaryState> {
    state: BoundaryState;
    static getDerivedStateFromError(error: unknown): Partial<BoundaryState>;
    componentDidCatch(error: unknown, info: ErrorInfo): void;
    private readonly retry;
    render(): ReactNode;
}
export {};
