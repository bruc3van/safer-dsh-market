import type { DirectInstaller } from './directInstall.ts';
import type { SkillsSessionSource } from './skillsSubscription.ts';
/**
 * The shared Marketplace surface, with Plugins and Skills pages.
 *
 * **Plugins** is the community shortlist. While the market is off it is one
 * card that says what turning it on will do and asks; the switch is the
 * plugin's own durable setting, so the answer survives a restart. While it is
 * on, cards use official Host installation, with optional read-only review
 * of installed artifacts.
 *
 * **Skills** is what this deployment can already resolve. It needs neither the
 * switch nor the network.
 *
 * Each host supplies a close callback to reveal the conversation after staging.
 */
import { type ReactElement } from 'react';
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store';
import type { MarketCatalog, MarketInstalledResult, MarketSkillsResult, SafeMarketSettings } from '../contract.ts';
/** The live snapshot the section renders from: the switch plus the deployment facts. */
export interface SafeMarketSnapshot {
    readonly value: SafeMarketSettings;
    /** Current instance profile; reviews stay disabled until the Host confirms it. */
    readonly profile: string | null;
    /** The market's own version, from the same `describe`; '' until it answers. */
    readonly version: string;
}
export type SafeMarketSource = ObservableSnapshot<SafeMarketSnapshot>;
/** What the review hand-off reports back to the card that asked for it. */
export type InstallOutcome = {
    readonly ok: true;
} | {
    readonly ok: false;
    readonly reason: 'not-ready';
} | {
    readonly ok: false;
    readonly reason: 'no-workspace';
} | {
    readonly ok: false;
    readonly reason: 'cancelled';
} | {
    readonly ok: false;
    readonly reason: 'failed';
    readonly message: string;
};
/** What registering a directory as a Workspace reports back. */
export type ChooseWorkspaceOutcome = {
    readonly ok: true;
    readonly path: string;
} | {
    readonly ok: false;
    readonly reason: 'cancelled';
} | {
    readonly ok: false;
    readonly reason: 'failed';
    readonly message: string;
};
/**
 * Whether this deployment has a Workspace for an AI review.
 *
 * `pending` is its own answer rather than a flavour of `none`: for the first
 * moments of a boot the list mirror is legitimately empty, and telling someone
 * with a dozen workspaces that they have none is worse than saying nothing.
 */
export type WorkspaceReadiness = 'pending' | 'none' | 'present';
/** Injected business face: the live source and the section's verbs. */
export interface MarketSectionInjected {
    directInstaller?: DirectInstaller;
    hooks: {
        scope: SafeMarketSource;
    };
    /** Turn the market on or off (durable). */
    setEnabled: (enabled: boolean) => Promise<void>;
    /** Read the reduced catalog; `force` bypasses the refresh interval. */
    loadCatalog: (force: boolean) => Promise<{
        catalog: MarketCatalog | null;
        stale: boolean;
        error: string;
    }>;
    /** Read the skills this deployment resolves. */
    listSkills: () => Promise<MarketSkillsResult>;
    skillsSession: SkillsSessionSource;
    /** Open a session in the current or most recent workspace and stage the given prompt. */
    install: (prompt: string) => Promise<InstallOutcome>;
    /**
     * The same hand-off for someone who has no workspace yet: pick a directory
     * through the Host's own picker, register it, then stage the prompt in it.
     */
    installIntoNewWorkspace: (prompt: string) => Promise<InstallOutcome>;
    /** Pick a directory and register it as a Workspace, installing nothing. */
    chooseWorkspace: () => Promise<ChooseWorkspaceOutcome>;
    /** Live answer to "is there a workspace for review?". */
    workspaceReadiness: {
        getSnapshot: () => WorkspaceReadiness;
        subscribe: (fn: () => void) => () => void;
    };
    /** Read the plugins installed into this profile, with live enable state. */
    listInstalled: () => Promise<MarketInstalledResult>;
    /** Enable or disable one installed package (durable and immediate). */
    setInstalledEnabled: (packageName: string, enabled: boolean) => Promise<MarketInstalledResult>;
    /** Uninstall one installed package (stops now, finishes on restart). */
    uninstallInstalled: (packageName: string) => Promise<MarketInstalledResult>;
}
/** Full section props: runtime share + injected face + locale seat. */
export type MarketSectionProps = {
    close: () => void;
} & InjectFace<MarketSectionInjected> & PropsLocale<'settings.saferMarket'>;
/** The Marketplace section. */
export declare function MarketSection({ useScope, setEnabled, loadCatalog, listSkills, skillsSession, install, installIntoNewWorkspace, chooseWorkspace, workspaceReadiness, listInstalled, setInstalledEnabled, uninstallInstalled, directInstaller, close, t, }: MarketSectionProps): ReactElement;
