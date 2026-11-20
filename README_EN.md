# DSH Market Pro

<img src="./assets/logo.svg" alt="DSH Market Pro logo" width="96" height="96" />

**An agent-native plugin marketplace for DSH: built-in AI discovery skill & read-only search tool, plus plugins, skills, MCP servers, and security review in one place.**

[中文](./README.md) | English

An AI-native third-party plugin marketplace for DeepSeek Harness (DSH), powered by the verified community catalog [awesome-dsh-plugin-pro](https://github.com/bruc3van/awesome-dsh-plugin-pro). In addition to visual browsing, one-click installation, version updates, skills inspection, managed MCP configuration, and post-install AI security review, it equips your **DSH Agent to search the catalog, compare options, inspect installed capabilities, and guide safe installation right inside chat** — no manual sifting required.

![Marketplace main view](./assets/screenshots/marketplace.png)

## Key Features

- **Agent-Native AI Plugin Discovery (Built-in Skill + Read-Only Tool)**:
  - Enabled by default as soon as `dsh-market-pro` is installed: automatically registers the built-in **`dsh-market-pro`** skill and read-only **`dsh_market_pro`** search tool into DSH sessions, and cleans them up automatically when disabled or uninstalled.
  - **Discover plugins in conversation**: describe what you need in natural language, invoke **`/dsh-market-pro`** directly, or click **Ask AI to pick** in the marketplace toolbar.
  - **High-precision search & environment awareness**: supports CJK 2-gram fallback, bilingual multi-synonym queries, installed-plugin filtering, and batch detail lookups over locally cached editor's picks and 28,000+ community repositories — while checking installed plugins and MCP tool groups to avoid duplicates.
  - **Defense-in-depth anti-injection & safe installation**: the tool is strictly read-only and scrubs invisible Unicode payloads, neutralizes angle brackets, and wraps all output inside an `<untrusted_market_data>` envelope so third-party metadata cannot hijack the skill. After you confirm, the agent hands verified targets to the official `plugin_manager` (preserving native approval prompts) and can follow up with a read-only security review.
  - **Instant toggle, zero-token friendly**: turn the AI assistant off anytime in **DSH Market Pro → Settings** to withdraw the skill and tool immediately with zero standing token overhead, or toggle online catalog access per profile.
- **Curated & Full Catalog**: Filters out unrelated projects and topic riders. Opens on editor's picks while offering the full verified catalog with category filters, keyword/package search, **Active & popular / Most stars / Recently updated** sorting in **All**, and guided cross-scope switching when a narrower view has no matches.
- **One-Click Install**: Install and enable plugins directly from their cards; for repositories without direct install metadata, generate a prompt draft so your AI agent can verify and install them for you.
- **Manage & Update Installed Plugins**: View all installed plugins in one place, enable or disable them instantly without restarting, uninstall, or check for and install newer versions.
- **Post-Install AI Review**: Prepare a review draft in your conversation input box (sent only when you confirm) to have your AI agent inspect installed plugin files for network calls, credential access, scripts, and other potential risks.
- **Skills Browser**: Browse and search skills available in the active conversation by source (Project, User, Bundled — including the built-in `dsh-market-pro` skill) and see how each skill can be invoked.
- **MCP Management**: Built on DSH's official MCP manager (DSH ≥ 0.2.2-rc.2) to manage every MCP server in one view:
  - Inspect live connection states and browse or search each server's exposed tools in a dedicated **Tools dialog**;
  - Add, edit, enable/disable, probe, and restart servers, including **auto-reconnect** and **close-timeout** settings;
  - See credential sources (credential store / environment), move plaintext secrets to credentials, update or **clear** stored values, and **open the native settings file** in one click;
  - Static `dsh-mcp-client` rows written straight into the profile show risk notices, toggle controls, and one-click **Manage** adoption (moving plaintext secrets to credentials on the Host and disabling the static row safely).

## How It Compares

Compared with other common discovery and management approaches, DSH Market Pro unifies a **verified catalog**, **all-in-one management UI**, and **toggleable agent-native discovery** in a single plugin:

| Dimension | DSH Market Pro (This Plugin) | Official DSH Discover (`dsh-plugin-market`) | Typical UI-Only / Broad Community Markets | Standalone Discovery Skill / MCP Server |
|---|---|---|---|---|
| **Catalog Quality & Curation** | **Verified real plugins**: daily checks filter out topic riders, empty repos, and non-plugins; combines **editor's picks + 28,000+ full catalog** with local cache & mirror failover | Reads user-configured format-1 index URLs only; does not ship a built-in community directory | Many aggregate broadly by GitHub topic, often mixing non-plugins or uninstallable repos that require manual filtering | Relies on external registry APIs or CLIs with limited DSH manifest & install-target coverage |
| **In-Chat AI Discovery** | **Enabled by default in Standard & Creator modes**: bundled `dsh-market-pro` skill + in-process read-only `dsh_market_pro` tool (CJK fallback, multi-synonym queries, batch details) | Exposes `plugin_market` tool, but **enabled only in Creator preset by default** and has no companion discovery skill | Mostly click-to-browse UIs without autonomous in-chat catalog search | Supports chat discovery, but usually requires an extra MCP subprocess or CLI and provides no management UI |
| **Environment Awareness** | Jointly inspects active profile **installed plugins + live MCP tool groups**, skips duplicates, and recommends complementary capabilities | Annotates listing install status without MCP/skills cross-checking | Typically limited to per-card installed badges rather than conversation-level planning | Generally lacks direct visibility into the active DSH profile's installed plugins and managed MCPs |
| **Management Scope** | **Plugins + Skills + MCP Servers + Settings** in one place (live toggle, updates, MCP management/adoption, credentials, tools dialog) | Focused on plugin discovery and installation; no Skills tab or MCP manager UI | Focused on browsing, ratings, or discussions; managing MCP/skills usually requires separate plugins | Single-purpose (skills-only or MCP-only), without host plugin lifecycle management |
| **Security & Anti-Injection** | **Defense-in-depth** (invisible Unicode scrubbing + angle-bracket neutralization + `<untrusted_market_data>` envelope) + official `plugin_manager` approval + **post-install AI review** | Notes untrusted text in tool description; installs via official `plugin_manager` approval | Varies by project; mostly UI notices or install-time checks | Primarily relies on prompt-level confirmation reminders, rarely isolating untrusted payloads at the protocol boundary |
| **Token Overhead Control** | Compact single-language output & batch lookups; **one-click toggle in Settings** immediately withdraws the skill & tool for **zero standing token cost** | Schema cost applies in presets where the tool is enabled | Passive UI with zero standing conversation overhead | Separate MCP process continuously injects tool schemas into sessions |

> This comparison reflects public implementations and typical designs. Each approach has its own focus (for example, UI-focused markets work well if you prioritize community comments or screenshot galleries). DSH Market Pro is built for users who want a **verified plugin dataset, unified plugin/skill/MCP management**, and an **out-of-the-box yet instantly toggleable agent-native discovery loop**.

## Installation

1. Open the **Plugins** page from the left navigation bar in DSH.
2. Enter **`dsh-market-pro`** in the official plugin installation interface to install and enable it.
3. Once installed, open **DSH Market Pro** anytime from the left navigation bar, the Plugins page tab, or the right sidebar inside a conversation — or simply ask DSH in chat / run **`/dsh-market-pro`** to let your agent pick plugins for you.

## Chat-Native AI Discovery Examples

With the AI assistant enabled by default, just ask in any DSH conversation:

```text
Check which plugins I already have installed, then recommend active DSH plugins for diagramming and Word/PDF document export.
```

Or invoke the bundled skill explicitly:

```text
/dsh-market-pro Recommend a practical plugin and MCP setup for frontend engineering and API debugging
```

Your agent uses the read-only `dsh_market_pro` tool to:

1. **Inspect your environment** (`environment`) to see installed plugins and MCP servers and avoid duplicates.
2. **Search curated & full catalogs** (`featured` / `search` / `detail`) to verify install targets, activity, and prerequisites.
3. **Compare and install safely** — presenting 2–4 tailored options and invoking the official `plugin_manager` only after your confirmation, followed by an optional read-only security review.

![Chat-native AI plugin discovery](./assets/screenshots/marketplace-ai-chat.png)

> To turn this capability off or back on anytime, open **DSH Market Pro → Settings** and toggle **AI Plugin Discovery Assistant (Agent-Native)**.

## Interface Preview

### Marketplace Settings (AI Assistant & Catalog Switches)

Toggle **AI Plugin Discovery Assistant (Agent-Native)** and **Online Community Catalog** from the **Settings** tab with immediate effect and per-profile persistence, or jump straight into chat to try AI discovery.

![Marketplace settings view](./assets/screenshots/marketplace-settings.png)

### Full Catalog & Sorting

Switch to **All** to explore the full verified catalog with category filters and **Active & popular**, **Most stars**, or **Recently updated** sorting.

![Full catalog and sorting](./assets/screenshots/marketplace-all.png)

### MCP Server Management & Tools Dialog

Manage both managed and static MCP servers under the **MCP** tab: monitor live status, inspect and clear credentials, open the settings file, convert static rows to managed servers, and search exposed tools in a dedicated dialog.

![MCP management view](./assets/screenshots/marketplace-mcp.png)

![MCP tools dialog](./assets/screenshots/marketplace-mcp-tools.png)

### Right Sidebar Shortcut

In addition to the main navigation bar, you can open **DSH Market Pro** directly from the right sidebar inside any session.

![Right sidebar entry](./assets/screenshots/marketplace-sidebar.png)

### Installed Plugins & Updates

Manage your installed plugins under the **Installed** tab: toggle enable/disable states live, check for updates, or uninstall.

![Installed panel](./assets/screenshots/marketplace-installed.png)

### Post-Install AI Review

Click **AI review** after installation or on any installed plugin card to prepare a read-only security review prompt in your conversation input box.

![AI review draft](./assets/screenshots/marketplace-sec-check.png)

### Skills Page

Check the skills available to your current session from the **Skills** tab in the market or below the conversation title, complete with source filters and invocation labels.

![Global Skills page](./assets/screenshots/marketplace-skills.png)

![Conversation Skills tab](./assets/screenshots/conversation-skills.png)

## Usage Notes

- **Security reminder**: Catalog inclusion verifies that a project is a DSH plugin, not that it is safe. Always review a plugin's source and requested permissions before installing.
- **About AI review**: AI review is an optional post-install check on local plugin files to help you assess risk; it cannot prevent or undo code that has already executed during installation.

## Related Projects

- **[DSH Desktop Pro](https://github.com/bruc3van/dsh-desktop-pro)**: Standalone DeepSeek Harness desktop client.
- **[awesome-dsh-plugin-pro](https://github.com/bruc3van/awesome-dsh-plugin-pro)**: Verified DSH community plugin catalog and data source for this market.
- **[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness)**: Official DeepSeek Harness repository.

## License

[MIT](./LICENSE)
