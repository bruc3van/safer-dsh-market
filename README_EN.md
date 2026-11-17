# DSH Market Pro

<img src="./assets/logo.svg" alt="DSH Market Pro logo: a shield, plugin modules, and a review checkmark" width="96" height="96" />

**Curated plugins, complete management: browse, install, update, and review with AI.**

[中文](./README.md) | English

A third-party plugin marketplace for DeepSeek Harness (DSH), built on the maintainer-reviewed community catalog [awesome-dsh-plugin-pro](https://github.com/bruc3van/awesome-dsh-plugin-pro). Curated picks, browsing, installation, updates, and optional post-install AI review in one interface.

## Why Pro?

A `dsh-plugin` topic is a discovery signal, not an admission ticket. We verify that a repository is a DSH plugin, exclude unrelated projects and repositories using the topic for exposure, and connect discovery with everyday management:

- **Curated picks**: the complete catalog is reviewed by maintainers. Subscription picks undergo additional checks of install targets, bundle declarations, and host version ranges, with a public [index generation and exclusions report](https://bruc3van.com/markets/dsh/audit.json).
- **Practical browsing**: Featured, All, and Installed views, with categories, keyword and package search, plugin icons, pagination, and an offline cache.
- **Managed installation**: the host's official plugin manager inspects, installs, and enables plugins, with multiple selections, component choices, permission requests, and visible outcomes.
- **Managed updates**: check installed plugins for newer versions, inspect compatibility, and confirm an update while retaining enabled state and seeing progress, restart requirements, and restoration results.
- **Evidence-based AI review**: optionally ask an Agent to review the actual installed version and local artifacts in the current profile, reporting risks and verification gaps for you to act on.

Pro means care in catalog quality and a complete workflow. Inclusion is not a security endorsement; AI review takes place after installation and cannot prevent or undo code that has already run.

## Subscribe in DSH Discover

**Required version: DSH V0.2.1-rc.2 or later.** This requirement is for third-party subscriptions in the official Discover tab; individual plugins still have their own host compatibility requirements.

Browse first in the [DSH Plugin Directory](https://bruc3van.com/dsh-plugins/). When configuring DSH, use the **JSON subscription URL** below, not the directory webpage URL.

**Subscription URL: [https://bruc3van.com/dsh-plugins/index.json](https://bruc3van.com/dsh-plugins/index.json)**

```text
https://bruc3van.com/dsh-plugins/index.json
```

The previous URL, `https://bruc3van.com/markets/dsh/index.json`, remains supported. Existing subscriptions need no changes; both URLs provide the same Bruce's Plugin Picks feed, so add only one.

1. **Check the version:** upgrade DSH to **V0.2.1-rc.2 or later**.
2. **Enable custom markets:** open **Plugins** in the left sidebar, click **More** beside **Experimental plugins**, and switch on **Custom plugin markets**. The Plugins page then shows the **Installed / Discover** tabs.
3. **Open source settings:** select **Discover**. For the first source, click **Add index source**. If a market is already configured, open the market-name dropdown at the top left and select **Manage index sources…**.
4. **Add the subscription:** paste the `index.json` URL above into **Index URL** and click **Add**. Confirm that it appears in the added sources list, then close the dialog. Sources are saved in the active profile.
5. **Browse and install:** select **Bruce's Plugin Picks** in the market dropdown. Use **Refresh** to reload its data when needed. Search by category, keyword, or npm/Git label, and check each plugin's version requirements before installing.

If Discover is missing, check that you are running DSH V0.2.1-rc.2 or later and that Custom plugin markets is enabled. Enabling the feature does not add this subscription automatically; you still need to add its URL.

Subscribing in the official Discover tab **does not require `dsh-market-pro`**. Install this plugin separately for its standalone interface, multiple-target installation, and optional post-install AI review. Custom plugin markets and this plugin's Enable DSH Market Pro switch are separate controls.

[awesome-dsh-plugin-pro](https://github.com/bruc3van/awesome-dsh-plugin-pro) generates the index automatically; `bruc3van.com` serves JSON through Cloudflare without redirects. The index verifies npm metadata and Git bundles pinned to full commits, including bundle declarations, timestamps, and explicit host compatibility ranges. Up to 2000 verified plugins are selected by Star count, with categories, featured labels, and npm weekly-download sorting. This is a subset of the repository catalog, and inclusion is not a security audit or proof of runtime compatibility.

[DSH Plugin Directory and subscription guide](https://bruc3van.com/dsh-plugins/#subscribe) · [Index generation and exclusions report](https://bruc3van.com/markets/dsh/audit.json) · [Latest market plugin](https://www.npmjs.com/package/dsh-market-pro)

> [!IMPORTANT]
> **Starting with 1.0.0, the plugin is DSH Market Pro and its package is `dsh-market-pro`**, with repository links pointing to [`bruc3van/dsh-market-pro`](https://github.com/bruc3van/dsh-market-pro). Previous package names were `safer-dsh-market` and, before that, `dsh-desktop-safe-market`; neither upgrades to the new package automatically. To migrate: disable the old plugin → install and enable `dsh-market-pro@1.0.0` → reapply your configuration as needed. Cache and pending-removal records retain their original storage identifiers.

![DSH Market Pro](./assets/screenshots/marketplace.png)

## Features

- **Plugin market**: opens on the editor's picks; browse, search, and filter curated plugins by category, with manual data refresh and an offline cache.
- **Direct installation with optional review**: install through the official `pluginManager`, then stage a read-only audit from the result or an Installed card.
- **Installed panel**: see this profile's plugins, check for updates, disable/enable them instantly, or uninstall.
- **Skills page**: list the skills the current session can use, with their source and invocation policy, and open a skill's folder in one click.
- **Catalog access is opt-in**: the community catalog is not fetched before you enable the market. This does not control networking by the host or other plugins.

## DSH version compatibility

### Official Plugins page integration and development baseline

The subscription instructions above target **DSH V0.2.1-rc.2 or later**. The current source uses DSH `0.2.2-rc.3` as its development baseline, with DSH dependencies pinned to that version and the matching Cordis `4.1.0` / Loader `1.1.0`. Type checking, builds, and settings and plugin toggle persistence across restarts under the real Loader have passed; Electron UI interactions have not been tested. The commands below install plugin version `1.0.0`; its declared compatibility range is listed separately below.

- Adds a DSH Market Pro tab to the official Plugins page, preserving standalone navigation and the right sidebar. Older hosts without `plugins.tab` do not register the tab.
- Reads new installation rejection `requirements` and legacy `peers`; skill discovery follows the host's committed working directory.
- Declares `engines.dsh` and removes the retired `dsh-invariants` development dependency, keeping only an optional companion export for older profiles.
- The data-source repository `awesome-dsh-plugin-pro` owns generation and auditing of the official Discover format-1 index; `bruc3van.com` serves it. See [host market integration](docs/host-market.md). It does not publish files or add index sources automatically.

**1.0.0 supports DSH `0.1.7-rc.2` and `0.2.x`, requires at least `0.1.7-rc.2`, and is not backward compatible with older hosts.** This release moved to the new host APIs without a legacy fallback: it does not support the DSH 0.1.1 or 0.1.2 lines, nor the 0.1.5 line. Check your host version before choosing a plugin version.

| DSH host version | Plugin version | npm install target |
| --- | --- | --- |
| `0.2.x`, `0.1.7-rc.2` (currently supported) | `1.0.0` | `dsh-market-pro@1.0.0` |
| `0.1.5` line, at least `0.1.5-rc.1` | `0.5.2` | `dsh-desktop-safe-market@0.5.2` |
| `0.1.2` line, at least `0.1.2-alpha.3` | `0.4.3` | `dsh-desktop-safe-market@0.4.3` |
| `0.1.1` line | `0.3.0` | `dsh-desktop-safe-market@0.3.0` |

**Pin the plugin version on older hosts**; do not install `latest` or upgrade with an unversioned package name. For example, when staying on DSH `0.1.5`:

```sh
dsh plugin --profile <profile> add dsh-desktop-safe-market@0.5.2
```

When upgrading to `1.0.0` from an older release:

- upgrade DSH to `0.1.7-rc.2` or `0.2.x` first;
- the market switch is now saved by the host in the active profile's `cordis.patch.yml`, applied live, and kept across restarts;
- the old `safe-market` section in `settings.yaml` is **not** migrated; if the market is off after upgrading, enable it once from the page.

## Install

The CLI examples below target DSH `0.1.7-rc.2` and **do not apply to Electron’s `desktop` profile**. Replace `<profile>` with a verified CLI-managed profile. For desktop, use the current session’s official `plugin_manager` or Electron’s official plugin management UI. Use the pinned [npm](https://www.npmjs.com/package/dsh-market-pro) version:

```sh
dsh plugin --profile <profile> add dsh-market-pro@1.0.0
```

Or hand the install to your agent — copy this prompt:

```text
Install DSH Market Pro 1.0.0: confirm compatibility with DSH 0.1.7-rc.2 or 0.2.x and identify the current instance’s profile. Prefer the official plugin_manager tool with install_bundle and target dsh-market-pro@1.0.0. Never use CLI for desktop; if the tool is absent, hand off to me in Electron’s official plugin manager. Other profiles may use CLI with explicit --profile only if the tool is absent and ownership of the same instance is verified. Do not change the target profile. Report whether the official result requires restart.
```

To lock to the exact version this document describes, use the GitHub release tarball:

```sh
dsh plugin --profile <profile> add https://github.com/bruc3van/dsh-market-pro/archive/refs/tags/v1.0.0.tar.gz
```

The official manager installs the dependency and registers the bundle; do not edit package.json yourself. Follow the returned outcome: applied means active, while restart-required means installed pending a restart of the current instance. Failure or overridden configuration must not be reported as active.

The browser and the desktop client see the same market data when connected to the same profile; the CLI installs and manages plugins but shows no UI entry.

## Getting started

### 1. Enable the market

The market ships **off**: the page shows one explanatory card and an **Enable DSH Market Pro** button.

Enabling the market allows community catalog requests. The host saves the setting across restarts. The page has no Disable button; use the host’s supported configuration controls to set enabled to false if you want to stop catalog access.

### 2. Open the market

| Entry | Where | Requires |
| --- | --- | --- |
| Left navigation | **DSH Market Pro**, below New Session and above Workspaces; browse in the main area | DSH global panel and sidebar navigation slots |
| Right sidebar | Open a session → expand the right sidebar → choose **DSH Market Pro** on the Start page | The right Sidebar service |

Both entries share the switch and all operations; Settings no longer carries a duplicate entry.

![Right sidebar](./assets/screenshots/marketplace-sidebar.png)

### 3. Browse and search

- **Find plugins**: Featured / Installed / All switches between subscription picks, local management, and the complete reviewed repository catalog. Both Featured and All support category filtering and full-result search by name, package, task, keyword, and category. Search stays in the selected scope. Lists show 50 results per page; counts follow upstream releases automatically.
- **Subscription picks**: every plugin in the published awesome-dsh-plugin-pro subscription, in its published order, with the same localized names, descriptions, categories, and keywords. Package identities keep monorepo plugins distinct. Installation uses the first published version pinned to an npm version or Git commit and subdirectory, subject to Host inspection.
- **Plugin logos**: display each subscription plugin's own image and reuse it on associated repository cards. Images load lazily and fall back to initials. Titles, package identities, and categories have separate visual hierarchy.
- **Plugin cards**: show category, author, and last update date; cards in a list share one height with their buttons aligned along the bottom. An installed plugin is marked **Installed vX** and its button reads **Manage**, which opens the Installed view.
- **Refresh data**: the upper-right action fetches the latest catalog and blocks repeat clicks while it runs.
- **More actions (⋯)**: [GitHub repository](https://github.com/bruc3van/dsh-market-pro), [contact the author](https://x.com/bruc3van).
- **Scrolling**: the heading, tabs, search, and filters stay fixed while cards scroll. In panels at least 440px wide, scrolling down on the Plugins or Skills page docks the search box beside the tabs; scrolling back up or reaching the top restores it.
- **Back to top**: after roughly half a screen (at least 240px) a button appears in the lower right; reduced-motion preferences are respected.

## Installing plugins

Installation uses the current host's official manager, independently of the session's Standard / Creator mode.

### Direct install

Click **Install** on a card, choose components in the dialog, and confirm. The current host's official plugin manager checks, installs, and enables it. No workspace is needed and no prompt is sent.

A plugin without a usable install target (the catalog gives no install data, or only manual instructions) shows **Install instructions**. Its dialog says it is not a standard plugin and has no installation target, points to the instructions on GitHub, and includes any manual instructions from upstream plus a GitHub link.

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

![AI review draft](./assets/screenshots/marketplace-sec-check.png)

The audit verifies the current instance, profile, actual local package, exact version, source, and files. A requested install reference is not the resolved version. Never substitute latest or upstream main; locate the actual monorepo subpackage. Review network access, credentials, file operations, subprocesses, scripts, dependencies, permissions, prompt injection, and host changes, reporting evidence and verification gaps.

**Plugins may already have executed. This is a post-install check, not pre-install protection, and cannot undo prior execution.** The audit does not execute reviewed code, install, update, disable, uninstall, or edit configuration. It recommends actions for you to take through the UI.

### Updates

An installed catalog card shows **Manage**, which opens Installed. Select **Check for updates**, choose a version, and confirm. Updates use the official host APIs; see [Check and update installed plugins](#check-and-update-installed-plugins) for supported installations, version selection, and failure handling. **AI review** checks the currently installed version without updating it.

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

This compatibility path applies only to market copies placed by third-party [DSH Desktop](https://github.com/bruc3van/dsh-desktop-pro) with ownership markers. It does not describe the official Electron installer. Recognized copies are labelled Included with the client and can be removed here; packages installed normally through the official manager remain ordinary installed plugins.

Uninstall removes the current profile's `bundles` entry, then checks whether another profile still resolves the same copy. Files stay when another profile references them, when references cannot be checked, or when the directory is outside the managed locations.

If the client is still installed and still set to seat the built-in Safe Market, it will seat the plugin again on next start. To remove it for good, turn that switch off in the client's connection settings. An in-box bundle with no ownership marker belongs to the deployment itself and is neither listed nor removable here.

With the market off, the Plugins page shows the enable notice instead of installed-plugin management. The Skills page remains independently available.

## Skills page

Lists the skills the **current session** resolves — name, description, source directory, and invocation policy (available to AI / available through `/name`) — with search.

Skills are read from the current session’s agent scope and refreshed when the session changes. With no open session, the page asks you to open one; partial source failures are reported as an incomplete list. Source directories may be workspace-relative, home-relative, or absolute.

The folder icon after the source directory opens that skill's own directory in the system file manager through the host's official path opener (hover to see the full path). The host first verifies the path exists on this machine; the icon is hidden when the host has no desktop, such as a headless or remote deployment.

![Skills page](./assets/screenshots/marketplace-skills.png)

## Check and update installed plugins

Select **Check for updates** on an Installed card, choose a target version, then **Confirm update**. Checking is read-only. The Host must provide `listVersions` / `updateBundle` (currently adapted to DSH `0.2.2-rc.3`); unsupported hosts or installation types show an explanation.

- **npm**: the official manager lists newer versions and compatibility. A compatible, non-deprecated stable version is selected by default; prereleases and deprecated versions require explicit selection. Incompatible versions and non-bundles cannot be selected.
- **Pinned Git**: checks indexes already configured in the official Discover page, matching the exact package name and accepting only versions the Host marks as updates of the same repository directory. Branches and bare community URLs do not determine updates. Missing subscriptions or candidates have distinct messages; source failures are never reported as up to date.
- The official `updateBundle` preserves enabled state. The dialog shows progress, restart requirements, and restoration of the previous version after failure. If the connection is lost, inspect the official Plugins page before retrying; the market never automatically repeats an update. Build-script approvals or other additional actions can be handled in the official Plugins page after reading the details.

## Data source

The default is [market-catalog.json](https://cdn.jsdelivr.net/npm/awesome-dsh-plugin-feed@latest/data/market-catalog.json), falling back to the same npm package on unpkg. ETag caching, a local cache, and manual refresh are supported.

- Schema 3 delivers the complete reviewed repository catalog and the published official subscription together. All counts repositories; Featured counts subscription packages. Counts are never hardcoded.
- Category labels follow the subscription. Picks retain plugin-level categories and keywords; repository searches also include associated subscription package names, titles, and keywords.
- Archived and disabled repositories remain visible with status labels. Entries without install mappings offer details and repository links.
- Previous built-in `market-v2.json` URLs migrate automatically. Old parsed caches are invalidated once. Custom schema-2 feeds remain supported.
- Install targets accept supported npm specs and GitHub / Gitee HTTPS URLs, excluding commands, environment variables, local paths, and shell fragments.
- A custom `catalogBase` must be a complete schema-3 or schema-2 JSON URL; query parameters are preserved and no filename is appended.
See [docs/market-json-spec.md](docs/market-json-spec.md) for the contract.

## Configuration

The market prefers the name and actual directory supplied by the host’s profileContext and never defaults to web. An explicit profile setting is used only without host context; without either, startup stops to avoid the wrong target. Replace `<profile>` in CLI examples only with a CLI-managed name, never Electron desktop.

Use the host’s supported configuration controls. A standard CLI profile uses `<DSH_HOME>/profiles/<profile>/cordis.patch.yml`; application-owned directories come from the host. Do not edit files to bypass installation restrictions.

| Field | Default | Meaning |
| --- | --- | --- |
| `enabled` | `false` | Allow community catalog reads; page changes are saved live by the host |
| `catalogBase` | Complete URL of the npm feed's `market-catalog.json` | A complete schema-3 or compatible schema-2 JSON URL |
| `marketSize` | `1000` | Legacy schema-2 row limit; schema 3 retains the full catalog and paginates the UI |
| `profile` | `""` (auto-detect) | Explicit fallback only without host profileContext; cannot override the active instance |

## Security boundary

**Being listed is not a safety endorsement.** Direct install performs no security review; an AI review is an informed second opinion, not a verdict.

**Installation**

- Installation only calls the official `pluginManager` Remote; optional post-install review only stages a read-only draft;
- the catalog's `command` field is never executed;
- review begins when you send the draft; findings recommend actions for you to take through the UI;
- the review hand-off uses only published services (workspaces / sessions / conversation): it reads no DOM and sends no message on your behalf.

**Catalog data**

- The market file is fetched and re-validated on the Host before the browser sees it (the complete reviewed catalog and subscription picks, excluding unreviewed crawl entries), and persisted through the host’s safe_market storage domain, whose path is host-managed; stale caches and manual refreshes use ETag conditional requests, falls back to the unpkg mirror if the default is unreachable, and uses the last catalog only if both are;
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
- **Updates require host support**: the host must provide `listVersions` / `updateBundle`; built-in, local, or unpinned Git installations may require their original installer.
- **Review requires readable evidence**: if the session cannot read the installed files, it must report verification gaps. AI review is not a safety guarantee.

## Development

```sh
pnpm install         # not --ignore-workspace: pnpm 11 reads build approvals only from the workspace file
pnpm run check      # typecheck, build, then tests; some tests read the built artifacts
```

`devDependencies` are pinned to the published `@deepseek-ai/*` versions the runtime loads; every `peerDependency` is optional and supplied by the profile's `node_modules`.

### Releasing

1. Bump the version together in `package.json`, `dsh.plugin.json`, and the install commands and tarball URLs in both READMEs. The version gate in `pnpm test` (`test/version.test.ts`) checks these, and CI (`.github/workflows/check.yml`) runs the same checks on every push and PR.
2. Push a `vX.Y.Z` tag. CI (`.github/workflows/release.yml`) creates the GitHub Release and publishes to [npm](https://www.npmjs.com/package/dsh-market-pro) via Trusted Publishing — no manual `npm publish`.

The first publication of a new package requires a maintainer login and `npm publish --access public` before its Trusted Publisher can be configured (user `bruc3van`, repo `dsh-market-pro`, workflow filename `release.yml`, allow `npm publish`). The old package's configuration does not carry over. The tag workflow skips an existing version only when its package integrity exactly matches the current pack; different contents fail the release. Subsequent new versions publish through the workflow. After verifying that the new package is installable, update external directory references and the old package's migration notice.

## Related projects

**Maintained by the author**

- **[DSH Desktop Pro](https://github.com/bruc3van/dsh-desktop-pro)**: a standalone DeepSeek Harness client that keeps an agent safely resident on your desktop — the official Web UI untouched, long-running tasks in the tray, community plugin management. The client offers a preset curated subscription; since 0.6.0 this standalone market is installed on demand.
- **[awesome-dsh-plugin-pro](https://github.com/bruc3van/awesome-dsh-plugin-pro)**: find the right plugin for your DeepSeek Harness in 30 seconds. Every GitHub repository tagged `dsh-plugin` is crawled daily and then verified by hand — genuine plugins enter the catalog, topic riders land on the blacklist, and every exclusion reason is public. It is also this market's data source.

**Official repositories**

- **[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)**: DeepSeek Harness: Everything is a Plugin. The upstream project behind the official `dsh` and Web UI. This plugin is a third-party marketplace on its plugin system; everything the market installs lands in its profiles and runs on it.

## License

[MIT](./LICENSE)
