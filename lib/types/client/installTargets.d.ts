import type { InstallInfo } from '../installInfo.ts';
/** Source profiles do not change the destination: installation uses the current host. */
export declare function installChoices(targets: InstallInfo['targets']): InstallInfo['targets'];
/** Keep subpackage paths visible without making the full repository URL a control label. */
export declare function installLabel(spec: string): string;
