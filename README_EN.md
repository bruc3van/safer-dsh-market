# safer-dsh-market

**Discover plugins. Install what you need.**

[中文](./README.md) | English

A third-party plugin marketplace for DeepSeek Harness (DSH). It reads the community catalog [awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin), searchable by name, package, task label, and category. Install through the host's official plugin manager, then optionally ask AI to **review the installed version**.

> [!IMPORTANT]
> **The package has been renamed from `dsh-desktop-safe-market` to `safer-dsh-market`**, and the GitHub repository is now [`bruc3van/safer-dsh-market`](https://github.com/bruc3van/safer-dsh-market). The old package does not upgrade to the new one automatically. To migrate: disable the old plugin → install and enable the new one → reapply your configuration as needed. Cache and pending-removal records keep their original storage paths; nothing needs migrating.

> Screenshots below show an earlier version; current controls and labels are described in the text.

![Safe Market](./assets/screenshots/marketplace.png)

## Why it exists

Installing a plugin means running someone else's code on your machine. An ordinary catalog answers *which plugins exist*; *is this one safe* — the thing you are actually betting on when you click install — stays unanswered.

This plugin connects curated community data to the official installation services: find plugins by what they do and install them directly, then optionally review the installed artifacts with AI. A later review cannot prevent execution at installation time.

## Features

- **Plugin market**: opens on the editor's picks; browse, search, and filter curated plugins by category, with manual refresh and an offline cache.
- **Direct installation with optional review**: install through the official `pluginManager`, then stage a read-only audit from the result or an Installed card.
- **Installed panel**: see this profile's plugins, disable/enable them instantly, or uninstall.
- **Skills page**: list the skills the current session can use, with their source and invocation policy.
- **Catalog access is opt-in**: the community catalog is not fetched before you enable the market. This does not control networking by the host or other plugins.

## DSH version compatibility

**0.9.0 supports DSH `0.1.7-rc.2` and `0.2.x`, requires at least `0.1.7-rc.2`, and is not backward compatible with older hosts.** This release moved to the new host APIs without a legacy fallback: it does not support the DSH 0.1.1 or 0.1.2 lines, nor the 0.1.5 line. Check your host version before choosing a plugin version.

| DSH host version | Plugin version | npm install target |
| --- | --- | --- |
| `0.2.x`, `0.1.7-rc.2` (currently supported) | `0.9.0` | `safer-dsh-market@0.9.0` |
| `0.1.5` line, at least `0.1.5-rc.1` | `0.5.2` | `dsh-desktop-safe-market@0.5.2` |
| `0.1.2` line, at least `0.1.2-alpha.3` | `0.4.3` | `dsh-desktop-safe-market@0.4.3` |
| `0.1.1` line | `0.3.0` | `dsh-desktop-safe-market@0.3.0` |

**Pin the plugin version on older hosts**; do not install `latest` or upgrade with an unversioned package name. For example, when staying on DSH `0.1.5`:

```sh
dsh plugin --profile <profile> add dsh-desktop-safe-market@0.5.2
```

When upgrading to `0.9.0` from an older release:

- upgrade DSH to `0.1.7-rc.2` or `0.2.x` first;
- the market switch is now saved by the host in the active profile's `cordis.patch.yml`, applied live, and kept across restarts;
- the old `safe-market` section in `settings.yaml` is **not** migrated; if the market is off after upgrading, enable it once from the page.

## Install

The CLI examples below target DSH `0.1.7-rc.2` and **do not apply to Electron’s `desktop` profile**. Replace `<profile>` with a verified CLI-managed profile. For desktop, use the current session’s official `plugin_manager` or Electron’s official plugin management UI. Use the pinned [npm](https://www.npmjs.com/package/safer-dsh-market) version:

```sh
dsh plugin --profile <profile> add safer-dsh-market@0.9.0
```

Or hand the install to your agent — copy this prompt:

```text
Install DSH Safe Market 0.9.0: confirm compatibility with DSH 0.1.7-rc.2 or 0.2.x and identify the current instance’s profile. Prefer the official plugin_manager tool with install_bundle and target safer-dsh-market@0.9.0. Never use CLI for desktop; if the tool is absent, hand off to me in Electron’s official plugin manager. Other profiles may use CLI with explicit --profile only if the tool is absent and ownership of the same instance is verified. Do not change the target profile. Report whether the official result requires restart.
```

To lock to the exact version this document describes, use the GitHub release tarball:

```sh
dsh plugin --profile <profile> add https://github.com/bruc3van/safer-dsh-market/archive/refs/tags/v0.9.0.tar.gz
```

The official manager installs the dependency and registers the bundle; do not edit package.json yourself. Follow the returned outcome: applied means active, while restart-required means installed pending a restart of the current instance. Failure or overridden configuration must not be reported as active.

The browser and the desktop client see the same market data when connected to the same profile; the CLI installs and manages plugins but shows no UI entry.

## Getting started

### 1. Enable the market

The market ships **off**: the page shows one explanatory card and an **Enable Safe Market** button.

Enabling the market allows community catalog requests. The host saves the setting across restarts. The page has no Disable button; use the host’s supported configuration controls to set enabled to false if you want to stop catalog access.

### 2. Open the market

| Entry | Where | Requires |
| --- | --- | --- |
| Left navigation | **Safe Market**, below New Session and above Workspaces; browse in the main area | DSH global panel and sidebar navigation slots |
| Right sidebar | Open a session → expand the right sidebar → choose **Safe Market** on the Start page | The right Sidebar service |

Both entries share the switch and all operations; Settings no longer carries a duplicate entry.

![Right sidebar](./assets/screenshots/marketplace-sidebar.png)

### 3. Browse and search

- **Find plugins**: Featured / Installed / All switches between the editor's picks, local management, and the full catalog; the market opens on Featured, shown in the editor's order with the count the upstream catalog declares. Search by name, package, task, or category; typing in Featured switches to All and searches the full catalog. Under All, categories use a dropdown. Clear filters restores the unfiltered catalog.
- **Refresh data**: the upper-right action fetches the latest catalog and blocks repeat clicks while it runs.
- **More actions (⋯)**: **Update market**, [GitHub repository](https://github.com/bruc3van/safer-dsh-market), [contact the author](https://x.com/bruc3van).
- **Scrolling**: the plugin heading, tabs, search, and filters stay fixed while cards scroll. Categories use a theme-aware menu. The Skills page can still dock search beside the tabs in wider panels.
- **Back to top**: after roughly half a screen (at least 240px) a button appears in the lower right; reduced-motion preferences are respected.

## Installing plugins

Installation uses the current host's official manager, independently of the session's Standard / Creator mode.

### Direct install

Click **Install** on a card, choose components in the dialog, and confirm. The current host's official plugin manager checks, installs, and enables it. No workspace is needed and no prompt is sent.

- **Before installing**: expand Installation details to see the reference, requirements, and notes. Component selection appears only for multiple targets.
- **Multiple targets**: select multiple components to install them sequentially. Only the first is selected by default; choose what you need and avoid selecting alternative sources of the same plugin. Profiles named in the feed are only examples — the install always targets the current host profile.
- **Dependency scripts**: if a dependency needs to run install scripts, you are asked separately and the install continues only after you allow it.
- **Cancel and recover**: failures and script authorization pause the queue; retries handle only the current component. After a lost connection, **Check installation result** before continuing. Cancelling stops subsequent components, while completed installations are kept without automatic rollback. An overridden result stops the queue for inspection in the official Plugins page.
- **Outcomes**: applied, restart required, overridden by other configuration, failed, or cancelled.

Notes:

- only `packages.targets[].install` is used as an install target; the `command` field is **never executed**;
- `manual` entries, and entries without a valid target, show instructions only — no install address is guessed;
- requires the host's `pluginManager` Remote (compatibility baseline `0.1.7-rc.2`);
- **direct install performs no AI security review.** Catalog inclusion and README verification are not safety or compatibility guarantees.

### Optional AI review after installation

Choose **AI review installed version** after installation, or **AI review** on an Installed card. Only applied or restart-required components are offered; successful components remain reviewable in a partially failed batch. Failed, cancelled, overridden, and unknown outcomes do not count as successful installations.

The market opens a session in the current or most recent workspace and stages a draft **without sending it**. With no workspace, choose a folder first. Cancellation or navigation failure allows retry. Standard mode can use read-only file tools; neither `plugin_manager` nor Creator mode is required.

The audit verifies the current instance, profile, actual local package, exact version, source, and files. A requested install reference is not the resolved version. Never substitute latest or upstream main; locate the actual monorepo subpackage. Review network access, credentials, file operations, subprocesses, scripts, dependencies, permissions, prompt injection, and host changes, reporting evidence and verification gaps.

**Plugins may already have executed. This is a post-install check, not pre-install protection, and cannot undo prior execution.** The audit does not execute reviewed code, install, update, disable, uninstall, or edit configuration. It recommends actions for you to take through the UI.

### Updates

Catalog installation buttons can call the official manager again with the selected reference. **⋯ → Update market** uses the market's npm package name through the same confirmation panel. This does not promise latest-version detection or preservation of custom sources; inspect installation details first. An Installed card's **AI review** checks the current version without updating it.

## Installed panel

Existing installed-plugin management still includes backend manifest edits and pnpm remove; it has not been fully migrated to the official pluginManager. Installation uses the official manager; AI review is read-only and performs none of these management actions.

Choose **Installed** on the Plugins page to see:

- plugins installed into this profile through the official manager or CLI (listed in both `dependencies` and `dsh.profile.bundles`), with version, description, and current state;
- the market plugin placed by the desktop client;
- plugins in `dependencies` that never joined `dsh.profile.bundles` (installed but not loaded) — these can be uninstalled but not enabled.

Plugins shipped with the DSH profile template are not listed.

![Installed panel](./assets/screenshots/marketplace-installed.png)

### Disable / enable

Writes or removes a `- id: <entry>` / `disabled: true` row in the profile's `cordis.patch.yml` (the user patch layer) and drives the loader entry directly — **effective immediately, no restart**, and kept across restarts. Existing comments and hand-written rows in the file are preserved.

The market itself has no Disable button, to avoid shutting down the current management surface.

### Uninstall

- **User plugins**: the market backend stops them for this session first (self-uninstall skips immediate stopping to avoid interrupting the operation), then `pnpm remove` runs in the profile directory (the same primitive official `dsh plugin remove` uses), removing the dependency, lockfile entry, `node_modules`, and `dsh.profile.bundles` entry together, plus the package's `allowBuilds` / `minimumReleaseAgeExclude` rows in `pnpm-workspace.yaml`.
- **On failure**: if `pnpm remove` fails, the manifest is edited instead and the unpruned disk is reported; if that also fails, the panel reports the uninstall as failed and the boot sweep keeps the stop rows.
- **Reinstalling in the same session**: a plugin just uninstalled is held down by leftover stop rows; its card explains that **Enable** clears them.

### Legacy copies placed by third-party DSH Desktop

This compatibility path applies only to market copies placed by third-party [DSH Desktop](https://github.com/bruc3van/dsh-desktop) with ownership markers. It does not describe the official Electron installer. Recognized copies are labelled Included with the client and can be removed here; packages installed normally through the official manager remain ordinary installed plugins.

Uninstall removes the current profile's `bundles` entry, then checks whether another profile still resolves the same copy. Files stay when another profile references them, when references cannot be checked, or when the directory is outside the managed locations.

If the client is still installed and still set to seat the built-in Safe Market, it will seat the plugin again on next start. To remove it for good, turn that switch off in the client's connection settings. An in-box bundle with no ownership marker belongs to the deployment itself and is neither listed nor removable here.

With the market off, the Plugins page shows the enable notice instead of installed-plugin management. The Skills page remains independently available.

## Skills page

Lists the skills the **current session** resolves — name, description, source directory, and invocation policy (available to AI / available through `/name`) — with search.

Skills are read from the current session’s agent scope and refreshed when the session changes. With no open session, the page asks you to open one; partial source failures are reported as an incomplete list. Source directories may be workspace-relative, home-relative, or absolute.

![Skills page](./assets/screenshots/marketplace-skills.png)

## Data source

The default is [market-v2.json](https://cdn.jsdelivr.net/npm/awesome-dsh-plugin-feed@latest/data/market-v2.json), falling back to the same npm package on unpkg. ETag caching, a local cache, and manual refresh are supported.

- Schema 1 and 2 are supported. v2 adds `packages` install data, which reaches the client only after Host validation; task labels are searchable too;
- install targets are limited to supported npm specs and GitHub HTTPS URLs — no commands, environment variables, paths, or shell fragments;
- a custom `catalogBase` is never replaced; it may be a complete JSON URL or a legacy directory (`/market.json` is appended).

See [docs/market-json-spec.md](docs/market-json-spec.md) for the contract.

## Configuration

The market prefers the name and actual directory supplied by the host’s profileContext and never defaults to web. An explicit profile setting is used only without host context; without either, startup stops to avoid the wrong target. Replace `<profile>` in CLI examples only with a CLI-managed name, never Electron desktop.

Use the host’s supported configuration controls. A standard CLI profile uses `<DSH_HOME>/profiles/<profile>/cordis.patch.yml`; application-owned directories come from the host. Do not edit files to bypass installation restrictions.

| Field | Default | Meaning |
| --- | --- | --- |
| `enabled` | `false` | Allow community catalog reads; page changes are saved live by the host |
| `catalogBase` | Complete URL of the npm feed's `market-v2.json` | A JSON URL, or a directory containing `market.json` |
| `marketSize` | `1000` | Maximum rows returned to the UI (the actual count comes from the upstream catalog) |
| `profile` | `""` (auto-detect) | Explicit fallback only without host profileContext; cannot override the active instance |

## Security boundary

**Being listed is not a safety endorsement.** Direct install performs no security review; an AI review is an informed second opinion, not a verdict.

**Installation**

- Installation only calls the official `pluginManager` Remote; optional post-install review only stages a read-only draft;
- the catalog's `command` field is never executed;
- review begins when you send the draft; findings recommend actions for you to take through the UI;
- the review hand-off uses only published services (workspaces / sessions / conversation): it reads no DOM and sends no message on your behalf.

**Catalog data**

- The market file is fetched and re-validated on the Host before the browser sees it (the curated catalog, not the full crawl), and persisted through the host’s safe_market storage domain, whose path is host-managed; stale caches and manual refreshes use ETag conditional requests, falls back to the unpkg mirror if the default is unreachable, and uses the last catalog only if both are;
- repository links are rebuilt from `owner/name` rather than trusted from the file, so a poisoned file cannot contribute its own URL scheme — the wire codec enforces that shape;
- every card renders as plain text;
- while the market is off, the Remote refuses, so the catalog cannot be read around the switch.

**Prompts**

- No catalog descriptions or other free text are interpolated: only the profile and JSON locator data (installed package/version or successful installation references and application state). Locator data is not instructions; the actual artifact must still be verified;
- the profile name must match `[A-Za-z0-9][A-Za-z0-9._-]{0,63}`: it is taken from the host’s active profile context when available, to scope the review, and an invalid name makes the plugin refuse to start.

**Installed panel**

- Actions accept only package names that pass the wire codec and actually appear in the profile manifest;
- disabling and uninstalling desktop-client copies are local file edits plus loader calls only;
- uninstalling a user plugin runs `pnpm remove` in the profile directory (Windows launches the `.cmd` shim through a command interpreter), with package names restricted to safe characters and option-like names rejected.

## Known limitations

- **Skills are read-only for now**: the market currently provides no skill installation action.
- **Review requires readable evidence**: if the session cannot read the installed files, it must report verification gaps. AI review is not a safety guarantee.

## Development

```sh
pnpm install         # not --ignore-workspace: pnpm 11 reads build approvals only from the workspace file
pnpm run check      # typecheck, build, then tests; some tests read the built artifacts
```

`devDependencies` are pinned to the published `@deepseek-ai/*` versions the runtime loads; every `peerDependency` is optional and supplied by the profile's `node_modules`.

### Releasing

Remove the pending-release notice before publishing. Keep the old-screenshot notice until the screenshots have been replaced.

1. Bump the version together in `package.json`, `dsh.plugin.json`, and the install commands and tarball URLs in both READMEs. The version gate in `pnpm test` (`test/version.test.ts`) checks these, and CI (`.github/workflows/check.yml`) runs the same checks on every push and PR.
2. Push a `vX.Y.Z` tag. CI (`.github/workflows/release.yml`) creates the GitHub Release and publishes to [npm](https://www.npmjs.com/package/safer-dsh-market) via Trusted Publishing — no manual `npm publish`.

Before the first release, register this repository's `release.yml` as a Trusted Publisher in the npm package settings (user `bruc3van`, repo `safer-dsh-market`, workflow filename `release.yml`, allow `npm publish`). Because of the rename, `safer-dsh-market` needs this set up on its own.

## Related projects

**Maintained by the author**

- **[dsh-desktop](https://github.com/bruc3van/dsh-desktop)**: a standalone DeepSeek Harness client that keeps an agent safely resident on your desktop — the official Web UI untouched, long-running tasks in the tray, community plugin management. This market ships in-box with it.
- **[awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin)**: find the right plugin for your DeepSeek Harness in 30 seconds. Every GitHub repository tagged `dsh-plugin` is crawled daily and then verified by hand — genuine plugins enter the catalog, topic riders land on the blacklist, and every exclusion reason is public. It is also this market's data source.

**Official repositories**

- **[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)**: DeepSeek Harness: Everything is a Plugin. The upstream project behind the official `dsh` and Web UI. This plugin is a third-party marketplace on its plugin system; everything the market installs lands in its profiles and runs on it.

## License

[MIT](./LICENSE)
