# DSH Market Pro

<img src="./assets/logo.svg" alt="DSH Market Pro logo" width="96" height="96" />

**An agent-native plugin & MCP marketplace for DSH: built-in AI discovery skills & tools, 33 curated MCP servers, plus plugins, skills, managed MCPs, and security review in one place.**

[中文](./README.md) | English

An AI-native third-party plugin marketplace for DeepSeek Harness (DSH), powered by the verified community catalog [awesome-dsh-plugin-pro](https://github.com/bruc3van/awesome-dsh-plugin-pro) and a built-in curated MCP catalog. In addition to visual browsing, one-click installation, version updates, skills inspection, curated MCP discovery, managed MCP configuration, and post-install AI security review, it equips your **DSH Agent to search the catalog, compare options, inspect installed capabilities, and safely install plugins & MCP servers right inside chat** — no manual sifting required.

![Marketplace main view](./assets/screenshots/marketplace.png)

## Key Features

- **Agent-Native AI Discovery, Batch Updates & Safe MCP Setup (Bundled Skills + Tools)**:
  - Enabled by default as soon as `dsh-market-pro` is installed: automatically registers two bundled skills (**`dsh-market-pro`** for plugin discovery & batch updates, and **`dsh-mcp-pro`** for MCP servers) along with the **`dsh_market_pro`** and **`dsh_mcp_pro`** tools, and cleans them up automatically when disabled or uninstalled.
  - **Discover plugins, batch-update, and configure MCPs in conversation**: describe what you need in natural language, invoke **`/dsh-market-pro`** or **`/dsh-mcp-pro`** directly, or click **Ask AI to pick plugins** (Plugins tab) / **Ask AI to pick MCP** (MCP tab) in the toolbar.
  - **High-precision search & environment awareness**: supports CJK 2-gram fallback, bilingual multi-synonym queries, installed/configured filtering, and batch detail lookups across locally cached editor's picks, 28,000+ community repositories, and 33 built-in curated MCP servers — while checking installed plugins and live MCP servers to avoid duplicates.
  - **Defense-in-depth anti-injection, native approval & zero plaintext secrets**: discovery and update checks are strictly read-only, scrubbing invisible Unicode payloads, neutralizing angle brackets, and wrapping output inside `<untrusted_market_data>` / `<untrusted_mcp_data>` envelopes. Plugin installs go through official `plugin_manager` approval; batch plugin updates (`update_plugins`) pin exact user-confirmed package/version pairs and fail closed through DSH's native approval prompt listing every item; MCP mutations (`install_featured` / `install_custom` / `set_enabled`) likewise fail closed through native approval while rejecting plaintext secrets and auto-binding `${credential:REF}` templates.
  - **Instant toggle, zero-token friendly**: turn **AI Discovery Assistant (Plugins & MCP)** off anytime in **DSH Market Pro → Settings** to withdraw all bundled skills and tools immediately with zero standing token overhead, or toggle online catalog access per profile.
- **Curated & Full Catalog**: Filters out unrelated projects and topic riders. Opens on editor's picks while offering the full verified catalog with category filters, keyword/package search, **Active & popular / Most stars / Recently updated** sorting in **All**, and guided cross-scope switching when a narrower view has no matches.
- **One-Click Install**: Install and enable plugins directly from their cards; for repositories without direct install metadata, generate a prompt draft so your AI agent can verify and install them for you.
- **Manage, Filter & Batch-Update Installed Plugins**: View all installed plugins in one place, filter by **All installed / Updates available**, toggle enable/disable states live without restarting, uninstall, pick from scrollable version lists per plugin, or run **Update all** (confirm checklist → sequential updates with skip-on-failure & retry failed → summary, automatically ordering `dsh-market-pro` last). When `dsh-market-pro` itself has an update, a quick update button also appears next to Refresh in the header.
- **Post-Install AI Review**: Prepare a review draft in your conversation input box (sent only when you confirm) to have your AI agent inspect installed plugin files for network calls, credential access, scripts, and other potential risks.
- **Skills Browser**: Search and filter skills available in the active conversation using the unified search box and source selector (Project, User, Bundled — including both bundled `dsh-market-pro` and `dsh-mcp-pro` skills) and see how each skill can be invoked.
- **Curated MCP Catalog & Management**: Built on DSH's official MCP manager (DSH ≥ 0.2.2-rc.2) with **Featured** and **Configured** sub-tabs to discover and manage every MCP server in one view:
  - **33 built-in curated MCP servers** across 8 categories (Docs, Search, Browser, Dev, Office & Docs, Visual & Creative, Travel & Life, Memory — including Context7, DeepWiki, Playwright, Chrome DevTools, GitHub, Exa, Filesystem, Fetch, Amap, Baidu Maps, 12306, Feishu/Lark, DingTalk, Yuque, Notion, AntV Chart, Next AI Draw.io, MiniMax, Figma, and more), with category filtering, search, automatic configured-status detection, and one-click add/setup (secrets stored automatically in the credential store, plus handoff to Advanced edit);
  - **Live status & Tools dialog**: filter configured servers by status, monitor live connections, and browse or search each server's exposed tools in a dedicated **Tools dialog**;
  - **Full lifecycle & credential safety**: add, edit, enable/disable, probe, and restart servers, including **auto-reconnect** and **close-timeout** settings; see credential sources (credential store / environment), move plaintext secrets to credentials, update or **clear** stored values, and **open the native settings file** in one click;
  - **One-click static MCP adoption**: static `dsh-mcp-client` rows written straight into the profile show risk notices, toggle controls, and one-click **Manage** adoption (moving plaintext secrets to credentials on the Host and disabling the static row safely).

## How It Compares

Compared with other common discovery and management approaches, DSH Market Pro unifies a **verified catalog**, **curated MCP directory**, **all-in-one management UI**, and **toggleable agent-native discovery** in a single plugin:

| Dimension | DSH Market Pro (This Plugin) | Official DSH Discover (`dsh-plugin-market`) | Typical UI-Only / Broad Community Markets | Standalone Discovery Skill / MCP Server |
|---|---|---|---|---|
| **Catalog Quality & Curation** | **Verified real plugins + curated MCPs**: daily checks filter out topic riders, empty repos, and non-plugins; combines **editor's picks + 28,000+ full catalog + 33 curated MCPs** with local cache & mirror failover | Reads user-configured format-1 index URLs only; does not ship a built-in community directory | Many aggregate broadly by GitHub topic, often mixing non-plugins or uninstallable repos that require manual filtering | Relies on external registry APIs or CLIs with limited DSH manifest & install-target coverage |
| **In-Chat AI Discovery & Setup** | **Enabled by default in Standard & Creator modes**: bundled `dsh-market-pro` + `dsh-mcp-pro` skills and `dsh_market_pro` + `dsh_mcp_pro` tools for plugin search, approval-gated batch plugin updates, and safe MCP install/toggle | Exposes `plugin_market` tool, but **enabled only in Creator preset by default** with no companion discovery skill or MCP installer | Mostly click-to-browse UIs without autonomous in-chat catalog search | Supports chat discovery, but usually requires an extra MCP subprocess or CLI and provides no management UI |
| **Environment Awareness** | Jointly inspects active profile **installed plugins + managed/static MCPs & live tool groups**, skips duplicates, and recommends complementary capabilities | Annotates listing install status without MCP/skills cross-checking | Typically limited to per-card installed badges rather than conversation-level planning | Generally lacks direct visibility into the active DSH profile's installed plugins and managed MCPs |
| **Management Scope** | **Plugins + Skills + Curated & Managed MCPs + Settings** in one place (live toggle, updates-available filter & one-click batch updates, one-click curated MCP add, adoption, credentials, tools dialog) | Focused on plugin discovery and installation; no Skills tab or MCP manager UI | Focused on browsing, ratings, or discussions; managing MCP/skills usually requires separate plugins | Single-purpose (skills-only or MCP-only), without host plugin lifecycle management |
| **Security & Anti-Injection** | **Defense-in-depth** (invisible Unicode scrubbing + angle-bracket neutralization + untrusted-data envelopes) + official `plugin_manager` / native approval + **zero plaintext secrets** + **post-install AI review** | Notes untrusted text in tool description; installs via official `plugin_manager` approval | Varies by project; mostly UI notices or install-time checks | Primarily relies on prompt-level confirmation reminders, rarely enforcing protocol isolation or zero-plaintext-secret checks |
| **Token Overhead Control** | Compact single-language output & batch lookups; **one-click toggle in Settings** immediately withdraws all skills & tools for **zero standing token cost** | Schema cost applies in presets where the tool is enabled | Passive UI with zero standing conversation overhead | Separate MCP process continuously injects tool schemas into sessions |

> This comparison reflects public implementations and typical designs. Each approach has its own focus (for example, UI-focused markets work well if you prioritize community comments or screenshot galleries). DSH Market Pro is built for users who want a **verified plugin dataset, built-in curated MCP catalog, unified plugin/skill/MCP management**, and an **out-of-the-box yet instantly toggleable agent-native discovery loop**.

## Installation

1. Open the **Plugins** page from the left navigation bar in DSH.
2. Enter **`dsh-market-pro`** in the official plugin installation interface to install and enable it.
3. Once installed, open **DSH Market Pro** anytime from the left navigation bar, the Plugins page tab, or the right sidebar inside a conversation — or simply ask DSH in chat / run **`/dsh-market-pro`** or **`/dsh-mcp-pro`** to let your agent pick plugins and configure MCP servers for you.

## Chat-Native AI Discovery & Setup Examples

The screenshots use a local demo model for the conversations. DSH runs the tools and generates the approval cards shown.

### 1. Discover Plugins (`/dsh-market-pro`)

With the AI assistant enabled by default, just ask in any DSH conversation:

```text
Check which plugins I already have installed, then recommend active DSH plugins for diagramming and Word/PDF document export.
```

Or invoke the bundled skill explicitly:

```text
/dsh-market-pro Recommend a practical plugin and MCP setup for frontend engineering and API debugging
```

Your agent uses `dsh_market_pro` to:

1. **Inspect your environment** (`environment`) to see installed plugins and MCP servers and avoid duplicates.
2. **Search curated & full catalogs** (`featured` / `search` / `detail`) to verify install targets, activity, and prerequisites.
3. **Compare and install safely** — presenting 2–4 tailored options and invoking the official `plugin_manager` only after your confirmation, followed by an optional read-only security review.

![Chat-native AI plugin discovery](./assets/screenshots/marketplace-ai-chat.png)

### 2. Check & Batch-Update Installed Plugins (`/dsh-market-pro`)

Ask in any conversation:

```text
/dsh-market-pro Check my installed plugins for updates and batch-update them to the latest compatible versions after I confirm.
```

Your agent uses `dsh_market_pro` to run a safe end-to-end update loop:

1. **Read-only update check** (`check_updates`): checks both npm registries and configured Git subscription indexes, listing each updatable plugin's current and latest compatible stable versions.
2. **Pinned scope + native approval** (`update_plugins`): after you confirm, submits only the exact confirmed `{ packageName, version }` pairs through DSH's native approval prompt listing every plugin, orders `dsh-market-pro` last automatically, skips failures with rollback diagnostics, and reports applied, restart-required, and failed outcomes clearly.

### 3. Discover & Safely Install MCP Servers (`/dsh-mcp-pro`)

Run `/dsh-mcp-pro` in chat or click **Ask AI to pick MCP** in the MCP tab toolbar:

```text
/dsh-mcp-pro Inspect my currently configured MCP servers first, then recommend curated MCPs for up-to-date docs and diagramming, and install them safely after my confirmation.
```

Your agent uses `dsh_mcp_pro` to complete a safe end-to-end flow:

1. **Read-only audit & search** (`list_configured` / `search_featured` / `detail`): skips capabilities already covered by configured MCPs and compares transport (`HTTP` / `npx` / `uvx`) and credential prerequisites.
2. **Native approval-gated writes** (`install_featured` / `install_custom` / `set_enabled`): after you confirm in chat, every mutation triggers DSH's native approval prompt displaying the exact command/URL, working directory, env vars, and headers — failing closed if declined.
3. **Zero plaintext secrets**: servers requiring API keys automatically bind `${credential:REF}` templates without ever asking you to paste secrets into chat; after saving, your agent directs you to **DSH Market Pro → MCP → Configured** to click **Set** and store credentials securely.

![Chat-native AI MCP discovery and approval-gated installation](./assets/screenshots/marketplace-ai-mcp-chat.png)

> To turn this capability off or back on anytime, open **DSH Market Pro → Settings** and toggle **AI Discovery Assistant (Plugins & MCP)**.

## Interface Preview

### Marketplace Settings (AI Assistant & Catalog Switches)

Toggle **AI Discovery Assistant (Plugins & MCP)** and **Community Plugin Catalog** from the **Settings** tab with immediate effect and per-profile persistence, or jump straight into chat to try AI discovery.

![Marketplace settings view](./assets/screenshots/marketplace-settings.png)

### Full Catalog & Sorting

Switch to **All** to explore the full verified catalog with category filters and **Active & popular**, **Most stars**, or **Recently updated** sorting.

![Full catalog and sorting](./assets/screenshots/marketplace-all.png)

### Curated MCP Catalog, Management & Tools Dialog

Browse the 33 built-in curated MCP servers under **MCP → Featured** (with category filters, search, configured-status badges, and one-click setup), then switch to **Configured** to manage both managed and static MCP servers: filter by status, inspect and clear credentials, open the settings file, convert static rows to managed servers, and search exposed tools in a dedicated dialog.

![Curated MCP catalog](./assets/screenshots/marketplace-mcp-featured.png)

![MCP configured servers management view](./assets/screenshots/marketplace-mcp.png)

![MCP tools dialog](./assets/screenshots/marketplace-mcp-tools.png)

### Right Sidebar Shortcut

In addition to the main navigation bar, you can open **DSH Market Pro** directly from the right sidebar inside any session.

![Right sidebar entry](./assets/screenshots/marketplace-sidebar.png)

### Installed Plugins, Filtering & Batch Updates

Manage your installed plugins under the **Installed** tab: filter by **All installed / Updates available**, toggle enable/disable states live, uninstall, pick from scrollable version lists per plugin, or click **Update all** to confirm and sequentially upgrade plugins (skipping failures with one-click retry). When `dsh-market-pro` itself has an update, a quick update button also appears in the top-right header.

![Installed panel](./assets/screenshots/marketplace-installed.png)

![Batch update confirmation](./assets/screenshots/marketplace-batch-update.png)

### Post-Install AI Review

Click **AI review** after installation or on any installed plugin card to prepare a read-only security review prompt in your conversation input box.

![AI review draft](./assets/screenshots/marketplace-sec-check.png)

### Skills Page

Check the skills available to your current session from the **Skills** tab in the market or below the conversation title — featuring search, source selector, bundled `dsh-market-pro` and `dsh-mcp-pro` skills, and invocation labels.

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
