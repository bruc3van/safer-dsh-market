# safer-dsh-market

The package has been renamed from `dsh-desktop-safe-market` to `safer-dsh-market`. The new npm package requires its own publication and Trusted Publisher setup; the old package does not automatically upgrade to it. Disable the old plugin before installing and enabling the new one, and reapply configuration as needed. Cache and pending-removal storage paths are preserved. The GitHub repository is also renamed to `bruc3van/safer-dsh-market`.

**Discover plugins. Install what you need.**

[中文](./README.md) | English

Browse awesome-dsh-plugin-feed recommendations by name, package, task and category.

**Simple (direct install)** is the default. Choose a recommendation and confirm its target; the current Host's official plugin manager checks, installs and enables it. No workspace or conversation is needed. Requirements and notes are shown first. Dependency build scripts require explicit approval. Cancellation, lost-reply recovery and application outcomes are displayed.

**Prompt (AI review)** preserves the existing review hand-off. Plugin upgrades and self-upgrades still use prompts. Direct installation does not perform an AI security audit; directory inclusion and README verification are not safety or compatibility guarantees.

Direct targets come from `packages.targets[].install`, never `command`. Multiple targets are choices, not a batch script. Manual entries remain manual. Example profiles in the feed do not change the current Host profile. Direct installation requires the official pluginManager Remote (compatibility baseline: 0.1.7-rc.2).

## Two ways to browse

**Option 1: Left navigation.** Click Safe Market below New Session and above Workspaces to browse in the main area. Preparing an install prompt returns you to the conversation.

**Option 2: Right sidebar.** Open a session, expand the right sidebar, and choose Safe Market on the Start page to browse in a sidebar tab.

Both views share the market switch and operations. Left navigation requires DSH's global panel and sidebar navigation slots; the right sidebar entry requires the right Sidebar service.

## Interface and controls

- **Navigation:** left navigation and the right sidebar remain; the duplicate Settings entry has been removed.
- **Refresh market:** the upper-right action fetches the latest catalog, shows progress, and prevents repeated clicks while refreshing.
- **More actions (⋯):** upgrade the market plugin through the review-prompt flow, open the [GitHub repository](https://github.com/bruc3van/safer-dsh-market), or [contact the author](https://x.com/bruc3van).
- **Scrolling:** the heading, subtitle, tabs, and search remain visible while categories and cards scroll independently. In wide panels, browsing forward animates search into the right end of the tab row; reverse scrolling restores it. Narrow sidebars keep the full-row search.
- **Back to top:** after roughly half a screen (at least 240px), a lower-right button returns the current list to the top. Reduced-motion preferences are respected.

## What it is for

Installing a plugin means running someone else's code on your machine. An ordinary catalog answers *which plugins exist* and leaves the risk to your click; *is this one safe* stays unanswered — yet that is exactly what you are betting on at the moment you click install.

The marketplace connects curated recommendations to official installation services, with optional prompt-based AI review.

## DSH version compatibility

**Safe Market 0.7.1 requires at least DSH `0.1.7-rc.2` and is not backward compatible with older hosts.** This release uses the new host APIs without a legacy fallback. It does not support the DSH 0.1.1 or 0.1.2 lines, or DSH 0.1.5. Check your host version before choosing a plugin version.

| DSH host version | Plugin version to use | npm install target |
| --- | --- | --- |
| `0.1.7-rc.2` (the version adapted and tested) | `0.7.1` | `safer-dsh-market@0.7.1` |
| `0.1.5` line, at least `0.1.5-rc.1` | `0.5.2` | `dsh-desktop-safe-market@0.5.2` |
| `0.1.2` line, at least `0.1.2-alpha.3` | `0.4.3` | `dsh-desktop-safe-market@0.4.3` |
| `0.1.1` line | `0.3.0` | `dsh-desktop-safe-market@0.3.0` |

**Pin the plugin version on older hosts; do not upgrade using `latest` or an unversioned package name.** For example, when staying on DSH `0.1.5`:

```sh
dsh plugin --profile web add dsh-desktop-safe-market@0.5.2
```

Before installing plugin `0.7.1`, upgrade DSH to `0.1.7-rc.2`. The host now saves the market switch in the active profile's `cordis.patch.yml`, applies it live, and restores it after restart. The old `safe-market` section in `settings.yaml` is not migrated automatically; if the market is disabled after upgrading, enable it once from the page.

## Install

The following commands target DSH `0.1.7-rc.2`. Prefer the pinned [npm](https://www.npmjs.com/package/safer-dsh-market) version:

```sh
dsh plugin --profile web add safer-dsh-market@0.7.1
```

Or hand the install to your agent — copy this one-line prompt:

```text
Install DSH Safe Market for me: first confirm that the host is DSH 0.1.7-rc.2, then run the official command `dsh plugin --profile web add safer-dsh-market@0.7.1` into the web profile and remind me to restart dsh web. If the host is older, explain the incompatibility before installing or upgrading anything.
```

To pin the version this document names, use the GitHub release tarball:

```sh
dsh plugin --profile web add https://github.com/bruc3van/safer-dsh-market/archive/refs/tags/v0.7.1.tar.gz
```

The official command installs the dependency into the profile and **joins it into `dsh.profile.bundles` by itself** (any dependency declaring `dsh.bundle` is reconciled into the layer stack), so there is no `package.json` to edit. Restart `dsh web` (or the desktop client) afterwards.

The browser, the CLI, and the desktop client share one profile, so the entry appears in all three.

## You turn it on yourself

The **market half** of the Plugins page ships **off**. Until you enable it, it is one card explaining what enabling does, and a button.

That is deliberate: **enabling is what lets this machine read the catalog snapshot from GitHub**, and while it is off the plugin makes no network request at all. A plugin that arrives already reaching out has decided something on your behalf. The switch is the plugin's own durable setting — answer once and it stays answered. The page no longer offers a Disable Market button.

## What "Review and install" does

1. connects a new session in the current session's workspace (or the most recently used one) and navigates there;
2. **stages** the review prompt in the composer — it does not send it;
3. leaves the market page so you can see the session containing the draft.

The prompt opens by stating its scope: **the only purpose is the security review — install efficiently once the code is clean, with no extra verification**. It asks the agent to treat everything in the repository as untrusted material under review (instructions found there are never followed), to read the code rather than the README, and to look for credential or token access, data sent to third-party hosts, remote code execution or downloaded-and-executed payloads, install-time scripts (`postinstall`, `prepare`, and friends), obfuscated sources with no matching original, and permissions far wider than the plugin claims. **Anything suspicious means stop, explain, and ask you.** A clean reading is followed by the official command, by priority — the npm package or the latest release tag's prebuilt tarball first (no repository code runs at install time), and only failing both, source from the default branch pinned to an exact commit:

```sh
dsh plugin --profile web add <npm package@reviewed-exact-version | tarball URL | github:owner/name#<commit sha>>
```

The npm path records the reviewed exact version and `dist.integrity`, verifies the tarball, and installs that version without re-resolving `latest`.

At pnpm's `allowBuilds` gate, the agent reports the exact printed key without writing it into a file or bypassing the gate; npm or prebuilt release artifacts hitting this gate also count as suspicious. DSH lookup starts with the host and port in `$env:DSH_WEB_URL`, then PATH, the default installation directory, and npm/pnpm global bin. Only `dsh plugin` subcommands are invoked; no second instance is started for verification. After installation, the agent checks the target profile's `node_modules/.pnpm/lock.yaml` and installed-file hashes. A mismatch or failed installation stops the flow without uninstalling, reinstalling, or retrying.

Whether it is sent is your Enter key. With no workspace yet, a notice at the top of the page says so up front, and the card's button becomes **Choose a folder and install** — one click opens the host's own directory picker, registers what you choose as a workspace, and goes on installing, instead of sending you to the sidebar and back to start over. Cancelling the picker is just a cancellation, not a failure.

![Review and install](./assets/screenshots/marketplace-sec-install.png)

### Already installed: review and upgrade

In prompt mode, a catalog row already installed into this profile is marked **Installed vX.Y.Z** in its card, and its button reads **Review and upgrade** instead of Review and install — so you are not offered an install for something you already have.

The join is the installed package's `repository` field (every npm spelling is reduced to `owner/name`), because the catalog is keyed by GitHub repository while an install is keyed by package name, and the two are only sometimes spelled alike. A package that declares no repository falls back to matching its short name against the repository name — but only while that name picks out exactly one installed package: when two share it, neither claims the row, because an answer that depends on iteration order is worse than no answer.

**The catalog is not an update resolver**, so the review-and-upgrade flow still checks upstream releases. The upgrade prompt's first step is to have the agent establish the newest upstream version — the latest release tag, or the version the repository publishes to npm — and, **if it is not newer, say so and change nothing**; only a real update leads on to a review of the new artifact — the same scan standard as a fresh install, not a diff-oriented review of what changed between versions. Upgrades install through the same ladder as fresh installs (npm / release tarball / commit-pinned source) and the same `allowBuilds` rules. As with install, the plugin runs no command itself.

## The installed panel

The **Installed** filter on the Plugins page lists the packages this profile gained through `dsh plugin add` (names that sit in both `dependencies` and `dsh.profile.bundles`) — version, description, the live state of each loader entry — **and the marketplace plugin the desktop client placed**. Layers shipped with the DSH profile template are not listed. Two actions:

- **Disable/enable** writes (or removes) a `- id: <entry>` / `disabled: true` row in the profile's own `cordis.patch.yml` (the user patch layer) and nudges the loader entry directly — **effective immediately, no restart**, and durable across restarts. The market's own row has no disable button: disabling the market would take down the only surface that could re-enable it.
- **Uninstall** stops a user plugin for this session, then runs `pnpm remove` in the profile directory (the same primitive official `dsh plugin remove` forwards to), so the dependency, lockfile, `node_modules`, and `dsh.profile.bundles` entry go together, along with that package's leftover `allowBuilds` / `minimumReleaseAgeExclude` rows in `pnpm-workspace.yaml`. An in-box seat has no pnpm tree: uninstall drops the `bundles` entry and deletes the marked copy only when no other profile references it. If `pnpm remove` fails, the manager attempts manifest removal and reports the prune fault. If manifest removal also fails, the panel reports failure and the boot sweep preserves the stop rows. A plugin uninstalled and reinstalled within one session is held down by leftover stop rows, and its card explains that Enable will clear them.

The list also shows plugins that sit in `dependencies` but never joined `dsh.profile.bundles` (installed, not loaded), so they can be uninstalled from here. Enable is not offered for those rows.

### The marketplace plugin placed by the desktop client

The desktop client does not install this market with `dsh plugin add`. It **copies** the plugin into `<DSH_HOME>/profiles/node_modules` and adds one entry to `dsh.profile.bundles` — no dependency. Such a copy is labelled *seated by the desktop client*, and **this panel is the only place it can be removed**: official `dsh plugin` deliberately never touches a bundle that is not a profile dependency, and the client that placed it may have been uninstalled since.

Uninstall removes the current profile's `bundles` entry, then checks whether another profile still resolves the same copy. Files remain when another profile references them, references cannot be checked, or the directory is outside the managed locations.

If the client is still installed and still set to seat the built-in Safe Market, it will put the plugin back the next time it starts; the card says so. To stop it coming back, turn the switch off in the client's connection settings. An in-box bundle with no ownership marker belongs to the deployment itself: it is neither listed nor removable here.

By design it matches "review and install": **disable, listing, and in-box uninstall stay local file edits plus loader calls**. Legacy uninstall of a user plugin spawns: `pnpm remove` in this profile directory, while direct installs use the official Host service. With the market switched off, though, the page is the switch and nothing else: what you turned off is this marketplace, and it should not keep a plugin manager running in your settings.

![The installed panel](./assets/screenshots/marketplace-installed.png)

## The Skills page

Lists the skills the **current session** resolves — name, description, owning provider, and invocation policy (model-invocable, user-invocable via `/name`) — with search.

Addressing it by session is required, not lazy: the skill registry is host+per-scope layered, and the web deployment **deliberately disables the host-plane `skill-filesystem` row** — local discovery belongs to each agent preset. A read from the plugin's root context sees the global layer alone and would report "no skills" to a user with plenty. With no session open, the page says there is no layer to read.

![The Skills page](./assets/screenshots/marketplace-skills.png)

## Where the data comes from

The default is [market-v2.json](https://cdn.jsdelivr.net/npm/awesome-dsh-plugin-feed@latest/data/market-v2.json), with the same npm package on unpkg as fallback. Custom catalogBase values remain independent. Complete JSON URLs and legacy directories containing market.json are accepted. Both schema 1 and 2 are supported, with ETag caching and manual refresh.

Host validation preserves supported npm specs and GitHub HTTPS targets, notes, requirements and task labels. Shell commands and local paths from the feed are never executed. See [the feed contract](docs/market-json-spec.md).

## Configuration

Override in `~/.dsh/profiles/web/cordis.patch.yml`:

| Field | Default | Meaning |
| --- | --- | --- |
| `enabled` | `false` | Allow community catalog reads; page changes are saved live by the host |
| `catalogBase` | npm feed market-v2.json URL | Complete JSON URL or legacy directory |
| `marketSize` | `1000` | Ceiling on the rows shown. Upstream supplies the catalog in `market.json`; this parameter caps the rows returned to the UI |

## Security boundary

- **Direct installation calls the official pluginManager Remote.** Prompt mode only stages a review draft. Feed command fields are never executed;
- **the market file is fetched and re-validated on the Host** before the browser sees it — the curated catalog rather than the full crawl — and persisted at `$DSH_HOME/storages/safe_market.json` so a restart asks conditionally (one 304, or the unpkg mirror when the default address is unreachable, or the last catalog when both are);
- **repository links are rebuilt from `owner/name`** rather than trusted from the file, so a poisoned file cannot contribute a URL scheme of its own — the wire codec enforces the rebuilt shape, not just a comment;
- **prompts do not interpolate catalog branch names or free text**: only a validated repository URL, the target profile, and the installed package identity for upgrades;
- **the configured profile name is pattern-checked too** (`[A-Za-z0-9][A-Za-z0-9._-]{0,63}`): it is the one value that reaches the prompt as configuration rather than as catalog data, and it is interpolated into the `--profile` argument — a name outside that shape makes the market refuse to start rather than stage a command it cannot name;
- every card renders as plain text;
- while disabled, the Remote refuses — the catalog cannot be read around the switch;
- the install hand-off runs entirely through published services (workspaces / sessions / conversation): it reads no DOM and sends no message;
- the installed-panel verbs accept only **wire-codec-checked package names that are actually in the profile manifest**; disable and in-box uninstall land as local file edits plus loader calls. Uninstall of a user plugin runs `pnpm remove` in the profile directory (Windows uses a command interpreter for the `.cmd` shim, with package names restricted to safe characters and option-like names rejected); a failed prune attempts manifest removal, and failed manifest removal reports an error while preserving stop rows; edits to your patch layer preserve existing comments and hand-written rows.

**Being listed is not a safety endorsement.** Review and install only writes the review prompt into a new session; sending it is your Enter key. Once sent, the agent stops and asks you when something looks suspicious, and installs and reports back when it judges the code clean — **your checkpoints are that Enter key and every stop the prompt makes it take**. The review is an informed second opinion, not a verdict.

## Known limitations

- **Skills are read-only for now.** The Skills page answers "what do I have". Skills are distributed as filesystem directories rather than npm packages, so installing them is the next step.
- **It does not audit what you already installed.** The installed panel views, disables, and uninstalls, but it does not re-review code that is already running — direct mode does not add an AI review.

## Development

```sh
pnpm install       # not --ignore-workspace: pnpm 11 reads build approvals only from the workspace file
pnpm run typecheck
pnpm test          # node --test, the catalog reduction and reader regressions
pnpm run build     # lib/index.js (Host ESM), lib/client.js (browser, ModuleLoader-wrapped), lib/types
```

A version bump has places that must move together: `package.json`, `dsh.plugin.json`, and the tarball URLs in both READMEs. The version gate in `pnpm test` (`test/version.test.ts`) checks those, and that each README still offers the npm package-name install; CI (`.github/workflows/check.yml`) runs the same check on every push and PR.

Pushing a `vX.Y.Z` tag is what publishes: CI (`.github/workflows/release.yml`) cuts the GitHub Release and Trusted-Publishes the same version to [npm](https://www.npmjs.com/package/safer-dsh-market) — there is no separate `npm publish` to remember. The first time, the npm package settings need this repository's `release.yml` registered as a Trusted Publisher (user `bruc3van`, repo `safer-dsh-market`, workflow filename `release.yml`, allow `npm publish`).

`devDependencies` are pinned to the published `@deepseek-ai/*` versions the runtime actually loads; every `peerDependency` is optional and supplied by the profile's node_modules.

## Related projects

**Maintained by the author**

- **[dsh-desktop](https://github.com/bruc3van/dsh-desktop)** — a standalone DeepSeek Harness client that keeps an agent safely resident on your desktop: the official Web UI untouched, long-running tasks resident in the tray, curated plugins reviewed before they install. (This market ships in-box with the desktop client.)
- **[awesome-dsh-plugin](https://github.com/bruc3van/awesome-dsh-plugin)** — find the right plugin for your DeepSeek Harness in 30 seconds. Not another repo list: every repository on GitHub tagged `dsh-plugin` is crawled daily by script and then verified one by one by a human — genuine plugins enter the catalog, topic riders land on the blacklist, and every exclusion reason is public to check. It also tells you who each plugin is for and where to start. (Also the data source this market reads.)

**Official repositories**

- **[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)** — DeepSeek Harness: Everything is a Plugin. The upstream project behind the official `dsh` and Web UI — this plugin is a third-party marketplace on its plugin system, and everything the market installs lands in its profiles and runs on it.

## License

MIT
