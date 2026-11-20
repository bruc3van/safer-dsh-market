/**
 * The market tab's stylesheet, hand-written as a template string and injected
 * once by the plugin body: the web server serves exactly one file per client
 * plugin, so no separate CSS artifact may exist. Every hue comes from the
 * shared `--dsw-alias-*` design platform, so the tab follows the appearance
 * setting with the rest of Settings; the single literal is a neutral
 * alpha-black drop shadow, which reads the same under either appearance.
 * Class names carry the `dsh_market` prefix to stay unique in the assembled
 * shell. Both rules are enforced by test/client.test.ts.
 */

/** Stable `<style>` element id (idempotent injection across HMR re-runs). */
export const STYLE_ID = 'dsh-market-pro-style'

/** The market tab's injected stylesheet text. */
export const cssText = `
/* Host Button carries fixed heights (28px/36px) without nowrap or flex-shrink guard;
   keep market buttons single-line inside flex rows. */
.dsh_market_button { flex: none; white-space: nowrap; }

/* Filter selector trigger: the host settings selector (module-platform fill, no stroke)
   at the 36px toolbar height it shares with the search field. */
.dsh_market_modeTrigger {
  box-sizing: border-box; display: inline-flex; align-items: center; gap: 8px; max-width: 100%;
  height: 36px; padding: 0 14px; border: 0; border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-label-primary);
  font: inherit; font-size: 13px; line-height: 20px; text-align: left; cursor: pointer;
}
@media (hover: hover) {
  .dsh_market_modeTrigger:hover { background: var(--dsw-alias-interactive-bg-hover); }
}
.dsh_market_modeTrigger:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px;
}
.dsh_market_modeChevron { flex: none; margin-left: auto; }

/* Market dialogs render inside the host Modal (headless): the card, mask, radius,
   elevation, focus trap and Escape belong to it. The attribute selector outranks the
   Modal's own single-class width so the market can widen its sheets. */
[role="dialog"].dsh_market_modal { width: min(520px, 100%); max-height: 100%; padding: 0; gap: 0; }
[role="dialog"].dsh_market_modalWide { width: min(600px, 100%); }
.dsh_market_directPanel {
  container-type: inline-size;
  box-sizing: border-box; flex: 1 1 auto; width: 100%; min-height: 0; padding: 22px 24px 24px;
  overflow-y: auto; overflow-x: hidden; overflow-wrap: anywhere;
  color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px;
  --dsh-scrollbar-thumb: var(--dsw-alias-scrollbar-bg-l2);
  --dsh-scrollbar-thumb-hover: var(--dsw-alias-scrollbar-hover-l2);
}
.dsh_market_directPanel p { margin: 12px 0; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }
.dsh_market_directHead { display: flex; gap: 14px; align-items: flex-start; }
.dsh_market_directHead > .dsh_market_logo { width: 48px; height: 48px; border-radius: var(--dsw-radius-lg); }
.dsh_market_installHeading { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.dsh_market_installHeading > span { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.dsh_market_installHeading h3 { margin: 0; font-size: 16px; line-height: 24px; font-weight: 500; overflow-wrap: anywhere; }
.dsh_market_installHeading small {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary);
}
/* The host Modal's close control: 28px, compact radius, secondary ink. */
.dsh_market_directClose {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  width: 28px; height: 28px; padding: 0; border: 0; border-radius: var(--dsw-radius-sm); background: transparent;
  color: var(--dsw-alias-label-secondary); cursor: pointer;
}
@media (hover: hover) {
  .dsh_market_directClose:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
}
.dsh_market_directClose:disabled { opacity: .4; cursor: not-allowed; }
.dsh_market_directClose:focus-visible, .dsh_market_installDetails summary:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px;
}
.dsh_market_directPanel .dsh_market_installSummary {
  display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
  margin: 16px 0 0;
}

/* Grey panels: the state of an install, or why there is nothing to install. */
.dsh_market_installStatus, .dsh_market_installUnavailable {
  margin-top: 18px; padding: 14px 16px; border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh_market_installStatus > strong { display: block; font-size: 14px; line-height: 20px; font-weight: 500; }
.dsh_market_directPanel .dsh_market_installStatus p { margin: 6px 0 10px; }
.dsh_market_installStatus > button { margin-top: 4px; align-self: flex-start; }
.dsh_market_directPanel .dsh_market_installUnavailable p { margin: 0; }
.dsh_market_directPanel .dsh_market_installUnavailable p + p { margin-top: 8px; }
.dsh_market_buildList { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.dsh_market_buildList li {
  padding: 2px 8px; background: var(--dsw-alias-bg-layer-3); border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-sm); font-size: 12px; line-height: 18px; overflow-wrap: anywhere;
}
.dsh_market_installDiagnostic { margin-top: 10px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.dsh_market_installDiagnostic summary { cursor: pointer; width: fit-content; }
.dsh_market_directMessage {
  margin: 8px 0 0; padding: 10px 12px; max-height: 200px; overflow: auto; white-space: pre-wrap;
  border-radius: var(--dsw-radius-sm); background: var(--dsw-alias-bg-layer-1);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 17px;
}

/* Batch progress: one row per component, its state in the tertiary voice. */
.dsh_market_installQueue {
  list-style: none; padding: 0 14px; margin: 14px 0 0;
  border: 0.5px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md);
}
.dsh_market_installQueue li { padding: 10px 0; overflow-wrap: anywhere; }
.dsh_market_installQueue li + li { border-top: 0.5px solid var(--dsw-alias-border-l2); }
.dsh_market_installQueue small { display: block; margin-top: 2px; font-size: 12px; color: var(--dsw-alias-label-tertiary); }

/* Component and version pickers: bordered rows, the checked one filled. */
.dsh_market_installChoices { min-width: 0; margin: 18px 0 0; padding: 0; border: 0; }
.dsh_market_installChoices legend { margin-bottom: 4px; padding: 0; font-size: 13px; font-weight: 500; color: var(--dsw-alias-label-primary); }
.dsh_market_directPanel .dsh_market_installChoices p { margin: 0 0 10px; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.dsh_market_directPanel .dsh_market_installChoice {
  display: flex; align-items: center; gap: 10px; min-width: 0; padding: 10px 12px; margin: 6px 0 0;
  border: 0.5px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-md); font-size: 13px; cursor: pointer;
  transition: background-color var(--ds-transition-duration) var(--ds-ease-in-out), border-color var(--ds-transition-duration) var(--ds-ease-in-out);
}
@media (hover: hover) {
  .dsh_market_directPanel .dsh_market_installChoice:hover { background: var(--dsw-alias-interactive-bg-hover); }
}
.dsh_market_installChoice:has(input:checked) { background: var(--dsw-alias-interactive-bg-hover); border-color: var(--dsw-alias-label-secondary); }
.dsh_market_installChoice input { flex: none; margin: 0; accent-color: var(--dsw-alias-label-primary); }
.dsh_market_installChoice span { min-width: 0; overflow-wrap: anywhere; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
.dsh_market_directPanel .dsh_market_installChoice span p { margin: 2px 0 0; font-family: inherit; }

/* "Installation details": a disclosure with a rotating chevron over the
   exact command, in a monospace well. */
.dsh_market_installDetails { margin: 18px 0 0; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.dsh_market_installDetails summary {
  display: inline-flex; align-items: center; gap: 4px; width: fit-content;
  list-style: none; cursor: pointer; font-weight: 500; color: var(--dsw-alias-label-primary); border-radius: var(--dsw-radius-xs);
}
.dsh_market_installDetails summary::-webkit-details-marker { display: none; }
.dsh_market_installDetails summary svg {
  fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round;
  color: var(--dsw-alias-label-tertiary); transition: transform var(--ds-transition-duration) var(--ds-ease-in-out);
}
.dsh_market_installDetails[open] summary svg { transform: rotate(90deg); }
.dsh_market_installDetailsBody { display: flex; flex-direction: column; gap: 8px; margin-top: 10px; }
.dsh_market_installTarget p, .dsh_market_installDetailsBody > p { margin: 6px 0 0; font-size: 12px; line-height: 18px; }
.dsh_market_directPanel code {
  display: block; min-width: 0; max-width: 100%; box-sizing: border-box; margin: 0; padding: 10px 12px;
  border: 0.5px solid var(--dsw-alias-border-l2); border-radius: var(--dsw-radius-sm); background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 18px;
  white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word;
}
.dsh_market_installRequirements { margin: 0; padding-left: 18px; font-size: 12px; line-height: 18px; }
.dsh_market_installRequirements li + li { margin-top: 4px; }

/* Footer verbs, right-aligned: the dismiss verb first, the primary last. */
.dsh_market_installFooter, .dsh_market_updateActions {
  min-width: 0; display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: 8px;
  margin: 22px 0 0; padding: 0; border: 0;
}
.dsh_market_installFooter .dsh_market_link { height: 36px; padding: 0 14px; border-radius: var(--dsw-radius-md); font-size: 14px; line-height: 22px; }

.dsh_market_main {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
  /* The official Plugins page's insets: 28px above the head row, and an
     inline inset that grows with the window up to 48px. */
  padding: 28px clamp(24px, 4vw, 48px) 16px;
}
@media (max-width: 767px) { .dsh_market_main { padding-inline: 20px; } }
.dsh_market_main > .dsh_market_section { margin: 0 auto; }
.dsh_market_pluginTab {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
}
.dsh_market_pluginTab > .dsh_market_section {
  height: auto;
  max-width: none;
}
.dsh_market_pluginTab .dsh_market_scroll,
.dsh_market_pluginTab .dsh_market_scroll:has(> .dsh_market_fixedPage),
.dsh_market_pluginTab .dsh_market_fixedPage {
  height: auto;
  overflow: visible;
  scrollbar-gutter: auto;
  padding-right: 0;
}
.dsh_market_pluginTab .dsh_market_controls {
  max-height: none;
  overflow: visible;
}
.dsh_market_pluginTab .dsh_market_results {
  overflow: visible;
  scrollbar-gutter: auto;
  padding-right: 0;
  padding-bottom: 0;
}
.dsh_market_pluginTab .dsh_market_pagination {
  margin-right: 0;
}
.dsh_market_pluginTab .dsh_market_backToTop {
  position: sticky;
  right: auto;
  bottom: 16px;
  align-self: flex-end;
  margin-top: -48px;
  margin-right: 12px;
}
.dsh_market_sidebar {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
  padding: 16px;
}
.dsh_market_section {
  container-type: inline-size;
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 12px;
  /* Matches the official Plugins page column, so switching tabs keeps the
     content edge in place. */
  max-width: 960px;
  color: var(--dsw-alias-label-primary);
}
.dsh_market_section > :not(.dsh_market_scroll) { flex-shrink: 0; }
/* Only the selected panel scrolls; the shared heading and tabs stay visible. */
.dsh_market_scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
  padding-right: 4px;
}
/* The inner results own the only scrollbar gutter in a fixed page. */
.dsh_market_scroll:has(> .dsh_market_fixedPage) {
  overflow: hidden;
  scrollbar-gutter: auto;
  padding-right: 0;
}
.dsh_market_fixedPage {
  height: 100%;
  min-height: 0;
  box-sizing: border-box;
  overflow: hidden;
}
.dsh_market_controls,
.dsh_market_results {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dsh_market_controls { flex: none; max-height: 60%; overflow: auto; }
.dsh_market_controls:has(> .dsh_market_dockable), .dsh_market_controls:has(> .dsh_market_filterBar) { overflow: visible; }
.dsh_market_dockable { box-sizing: border-box; transform-origin: top left; }
.dsh_market_section[data-search-compact="true"] > .dsh_market_tabToolbar { padding-right: min(360px, 60%); }
.dsh_market_section[data-search-compact="true"] [role="tabpanel"]:not([hidden]) .dsh_market_dockable {
  position: absolute;
  z-index: 2;
  right: 0;
  width: min(360px, 60%);
}
/* Docked, the box shrinks to sit inside the tab row (the search-dock hook's
   DOCKED_HEIGHT, which centres it on the tab labels). */
.dsh_market_section[data-search-compact="true"] [role="tabpanel"]:not([hidden]) .dsh_market_dockable .dsh_market_search {
  height: 30px;
}
.dsh_market_results {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
  padding-right: 12px;
  padding-bottom: 56px;
  overflow: auto;
  scrollbar-gutter: stable;
}
.dsh_market_backToTop {
  position: absolute;
  right: 24px;
  bottom: 12px;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  /* A floating button: elevation carries its hairline, so no border. */
  border: 0;
  border-radius: 50%; corner-shape: round;
  background: var(--dsw-alias-bg-layer-2);
  box-shadow: var(--dsw-elevation-panel);
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
@media (hover: hover) {
  .dsh_market_backToTop:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
}
.dsh_market_backToTop:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px; }
.dsh_market_skillSource { overflow-wrap: anywhere; }
/* Hide the host composer on the Skills tab while keeping pending reviews visible. */
[data-conversation-scroll]:has(.dsh_market_projectSkills) > [data-composer-seat]:not(:has([data-approval-key], [data-plan-review-key])) {
  display: none;
}
.dsh_market_projectSkills {
  container-type: inline-size;
  width: 100%;
  padding: 20px 28px 24px 20px;
  box-sizing: border-box;
  color: var(--dsw-alias-label-primary);
}
.dsh_market_projectSkills .dsh_market_cards.dsh_market_skillCards {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
}
.dsh_market_projectSkills .dsh_market_search.dsh_market_skillSearch {
  flex: 0 1 260px;
}
.dsh_market_projectSkillsResults { margin-top: 18px; }
.dsh_market_skillsControls { max-height: none; overflow: visible; }
.dsh_market_skillsHeading {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px 10px;
}
.dsh_market_headingActions {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-left: auto;
}
.dsh_market_skillsHeading h2 {
  margin: 0; font-size: 14px; font-weight: 500; line-height: 22px;
}
.dsh_market_skillsNotice { max-width: 560px; gap: 12px; }
.dsh_market_skillsNotice h3 { margin: 0 0 4px; font-size: 14px; line-height: 20px; }
.dsh_market_skillsNotice .dsh_market_installDetails { margin: 0; max-width: 100%; }
.dsh_market_scope.dsh_market_skillsOrigins { flex-wrap: wrap; max-width: 100%; box-sizing: border-box; }
.dsh_market_skillsOrigins .dsh_market_scopeButton:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 1px;
}
.dsh_market_search.dsh_market_skillSearch {
  flex: 0 1 220px; min-width: min(100%, 180px); margin-left: auto;
}
.dsh_market_skillGroup { margin: 0 0 12px; }
.dsh_market_skillGroup h3 {
  margin: 0 0 8px;
  font-size: 13px; font-weight: 500; color: var(--dsw-alias-label-secondary);
}
.dsh_market_cards.dsh_market_skillCards { align-items: stretch; }
.dsh_market_card.dsh_market_skillCard { overflow-wrap: anywhere; }
.dsh_market_skillCard .dsh_market_name { white-space: normal; }
.dsh_market_foot.dsh_market_skillFooter { flex-wrap: nowrap; justify-content: space-between; }
.dsh_market_skillFooter .dsh_market_folderButton {
  flex: none; align-items: center; justify-content: center; width: 28px; height: 28px;
}
.dsh_market_skillBadges { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
/* Sits on the path's own line, in its tone, like the repository icon beside
   an installed version. */
.dsh_market_folderButton {
  display: inline-flex; margin-left: 5px; padding: 0; vertical-align: -2px;
  border: 0; background: none; color: inherit; cursor: pointer;
}
.dsh_market_folderButton svg {
  width: 14px; height: 14px;
  fill: none; stroke: currentColor; stroke-width: 1.6; stroke-linejoin: round;
}
@media (hover: hover) {
  .dsh_market_folderButton:hover { color: var(--dsw-alias-label-primary); }
}
.dsh_market_folderButton:focus-visible {
  color: var(--dsw-alias-label-primary);
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px; border-radius: var(--dsw-radius-xs);
}
.dsh_market_subtitle {
  margin: 0;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_headingRow {
  padding-right: 176px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.dsh_market_refreshMarket {
  position: absolute;
  top: 0;
  right: 40px;
  z-index: 2;
}
.dsh_market_more { position: absolute; top: 0; right: 0; z-index: 5; }
/* Icon-only header control: the host's 32px toolbar square. */
.dsh_market_iconButton {
  box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center;
  width: 32px; height: 32px; padding: 0; border: 0; border-radius: var(--dsw-radius-md);
  background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer;
}
.dsh_market_iconButton svg { fill: currentColor; }
@media (hover: hover) {
  .dsh_market_iconButton:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
}
.dsh_market_iconButton[aria-expanded="true"], .dsh_market_iconButton:active { background: var(--dsw-alias-interactive-bg-active); }
.dsh_market_iconButton:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px;
}
.dsh_market_headerAction {
  box-sizing: border-box;
  height: 32px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex: none;
  padding: 0 12px;
  border: 0;
  border-radius: var(--dsw-radius-md);
  box-shadow: inset 0 0 0 0.5px var(--dsw-alias-border-l3);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
}
.dsh_market_headerAction > svg {
  display: block;
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}
@media (hover: hover) {
  .dsh_market_headerAction:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); }
}
.dsh_market_headerAction:active:not(:disabled) { background: var(--dsw-alias-interactive-bg-active); }
.dsh_market_headerAction:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
.dsh_market_headerAction:disabled {
  cursor: not-allowed;
  opacity: .4;
}
.dsh_market_heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  font-weight: 500;
}
/* The market's own version, beside its name: a fact about the deployment,
   so it reads at the weight of one rather than of the title. */
.dsh_market_selfVersion {
  font-size: 12px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_tabToolbar {
  display: flex; align-items: flex-end; justify-content: space-between;
  flex-wrap: wrap; gap: 8px 16px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}
.dsh_market_filterBar {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
}
.dsh_market_filterActions {
  display: flex; align-items: center; justify-content: flex-end; flex-wrap: wrap;
  flex: 1 1 220px; gap: 8px; min-width: 0; margin-left: auto;
}
.dsh_market_search.dsh_market_filterSearch,
.dsh_market_search.dsh_market_skillSearch,
.dsh_market_category .dsh_market_modeTrigger,
.dsh_market_sort .dsh_market_modeTrigger { height: 36px; }
.dsh_market_scope {
  /* The host SegmentedControl's track: hover-fill track, 4px inset, R12 outside, R8 segments. */
  display: inline-flex; flex: none; gap: 2px; padding: 4px; border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh_market_scopeButton {
  box-sizing: border-box; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 12px;
  border: 0; border-radius: var(--dsw-radius-sm); background: transparent; cursor: pointer;
  font: inherit; font-size: 13px; line-height: 20px; font-weight: 500; white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
}
@media (hover: hover) {
  .dsh_market_scopeButton:hover { color: var(--dsw-alias-label-primary); }
}
.dsh_market_scopeButton[aria-pressed="true"], .dsh_market_scopeButton[aria-checked="true"] {
  background: var(--dsw-alias-bg-layer-1); box-shadow: var(--dsw-elevation-soft); color: var(--dsw-alias-label-primary);
}
.dsh_market_scopeButton span { color: var(--dsw-alias-label-tertiary); font-weight: 400; font-variant-numeric: tabular-nums; }
.dsh_market_category,
.dsh_market_sort {
  display: flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%;
  font-size: 12px; color: var(--dsw-alias-label-secondary);
}
.dsh_market_category .dsh_market_modeTrigger { width: 180px; }
.dsh_market_sort .dsh_market_modeTrigger { min-width: 112px; max-width: 170px; }
.dsh_market_selectLabel { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh_market_optionRow { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; }
.dsh_market_optionLabel { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.dsh_market_optionCount { flex: none; color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }
.dsh_market_clearFilters {
  border: 0; background: none; padding: 2px 0; font: inherit;
  color: var(--dsw-alias-label-secondary); cursor: pointer; text-decoration: underline; text-underline-offset: 3px;
}
/* Empty state: a calm, centred focal card that explains the active scope
   and offers one-click recovery (switching to All or clearing filters). */
@keyframes dsh_market_emptyIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
.dsh_market_empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 10px;
  padding: 40px 24px 36px;
  animation: dsh_market_emptyIn var(--ds-transition-duration) var(--ds-ease-in-out);
}
.dsh_market_emptyIcon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-bottom: 2px;
  border-radius: var(--dsw-radius-lg);
  border: 0.5px solid var(--dsw-alias-border-l3);
  color: var(--dsw-alias-label-secondary);
}
.dsh_market_emptyIcon svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.65;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.dsh_market_emptyBadge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 1px 8px;
  border-radius: 999px; corner-shape: round;
  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent);
  color: var(--dsw-alias-state-business-primary);
  font-size: 11px;
  font-weight: 500;
  line-height: 17px;
  font-variant-numeric: tabular-nums;
}
.dsh_market_emptyBadge::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 50%; corner-shape: round;
  background: currentColor;
}
.dsh_market_emptyTitle {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  color: var(--dsw-alias-label-primary);
}
.dsh_market_emptyDesc {
  margin: 0;
  max-width: 440px;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
  text-wrap: balance;
}
.dsh_market_emptyActions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 8px;
}
.dsh_market_emptyAction svg {
  width: 14px;
  height: 14px;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform var(--ds-transition-duration) var(--ds-ease-in-out);
}
@media (hover: hover) {
  .dsh_market_emptyAction:hover:not(:disabled) svg {
  transform: translateX(2px);
}
}
.dsh_market_emptyCount {
  display: inline-flex;
  align-items: center;
  padding: 1px 7px;
  border-radius: 999px; corner-shape: round;
  background: color-mix(in srgb, currentColor 16%, transparent);
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}
/* First load: the host list treatment — skeleton cards under one stage line. */
.dsh_market_loading { display: flex; flex-direction: column; gap: 12px; }
.dsh_market_loadingLine {
  display: flex; align-items: center; flex-wrap: wrap; gap: 8px;
  font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-tertiary);
}
.dsh_market_loadingAction { margin-left: auto; gap: 6px; }
.dsh_market_skeletonCard { pointer-events: none; }
.dsh_market_skeleton { display: block; border-radius: var(--dsw-radius-xs); background: var(--dsw-alias-bg-skeleton); }
.dsh_market_skeletonLogo { width: 40px; height: 40px; flex: none; border-radius: 10px; }
.dsh_market_skeletonTitle { width: min(144px, 60%); height: 12px; margin: 4px 0; }
.dsh_market_skeletonSub { width: min(96px, 40%); height: 10px; }
.dsh_market_skeletonText { width: min(280px, 85%); height: 12px; }
.dsh_market_skeletonTextShort { width: min(180px, 55%); height: 12px; }
.dsh_market_progressStage {
  min-width: 0;
  overflow-wrap: anywhere;
}
.dsh_market_progressPercent {
  flex: none;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-secondary);
}
@media (prefers-reduced-motion: reduce) {
  .dsh_market_empty { animation: none; }
  .dsh_market_emptyAction svg { transition: none; }
  .dsh_market_tab { transition: none; }
}
/* A quiet footer under the list: the range on the left, a compact pager on
   the right — the same hairline-and-tertiary voice as the tab strip. */
.dsh_market_pagination {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap;
  gap: 8px 16px; margin-right: 12px; padding: 10px 0 0;
  border-top: 0.5px solid var(--dsw-alias-border-l2);
  font-size: 12px; line-height: 18px;
  color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums;
}
.dsh_market_pager { display: inline-flex; align-items: center; gap: 4px; }
.dsh_market_pageNumber { min-width: 56px; text-align: center; color: var(--dsw-alias-label-secondary); }
.dsh_market_pageButton {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  width: 28px; height: 28px; padding: 0; border: 0; border-radius: var(--dsw-radius-sm);
  background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer;
  transition: background-color var(--ds-transition-duration) var(--ds-ease-in-out), color var(--ds-transition-duration) var(--ds-ease-in-out);
}
.dsh_market_pageButton svg { fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
@media (hover: hover) {
  .dsh_market_pageButton:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
}
.dsh_market_pageButton:disabled { cursor: not-allowed; opacity: .4; }
.dsh_market_pageButton:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px; }
/* The back-to-top control floats above the pager rather than over it. */
.dsh_market_section:has([role="tabpanel"]:not([hidden]) .dsh_market_pagination) .dsh_market_backToTop { bottom: 56px; }
.dsh_market_scopeButton:focus-visible, .dsh_market_clearFilters:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px;
}
/* The section's own page strip follows the host Conversation view tabs:
   underline tabs over a 0.5px rule with a business-blue active indicator,
   keeping a clear visual hierarchy above the segmented sub-filters below. */
.dsh_market_tabs {
  position: relative;
  z-index: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 4px 24px;
  min-height: 36px;
  box-sizing: border-box;
}
.dsh_market_tab {
  position: relative;
  padding: 8px 2px 9px;
  border: 0;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
  transition: color var(--ds-transition-duration-fast) var(--ds-ease-in-out);
}
.dsh_market_tab::after {
  content: "";
  position: absolute;
  right: 0;
  bottom: -0.5px;
  left: 0;
  height: 2px;
  border-radius: var(--dsw-radius-xs);
  background: transparent;
}
@media (hover: hover) {
  .dsh_market_tab:hover:not([data-active="true"]) {
    color: var(--dsw-alias-label-primary);
  }
}
.dsh_market_tab[data-active="true"] {
  color: var(--dsw-alias-state-business-primary);
}
.dsh_market_tab[data-active="true"]::after {
  background: var(--dsw-alias-state-business-primary);
}
.dsh_market_tab:focus-visible {
  border-radius: var(--dsw-radius-xs);
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
.dsh_market_page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding-top: 12px;
}

.dsh_market_page.dsh_market_fixedPage { padding-top: 0; }

/* The off state: one card that explains itself and asks. */
.dsh_market_intro {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-layer-3);
}
.dsh_market_introTitle {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
}
.dsh_market_introBody,
.dsh_market_disclaimer {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}
.dsh_market_disclaimer {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
/* The standing "no workspace yet" notice: the intro card's shape, but it
   states a prerequisite rather than asking a question, so it stays quiet. */
.dsh_market_notice {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 16px;
  border: 0.5px solid var(--dsw-alias-border-l2);
  border-radius: var(--dsw-radius-lg);
  background: var(--dsw-alias-bg-layer-2);
}
.dsh_market_noticeBody {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}

.dsh_market_introActions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.dsh_market_bar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh_market_search {
  /* The host Input: 32px, R12, l4 hairline on the layer-1 surface; toolbars raise it to 36px. */
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  height: 32px;
  padding: 0 12px;
  border: 0.5px solid var(--dsw-alias-border-l4);
  border-radius: var(--dsw-radius-md);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  outline: none;
}
.dsh_market_search::placeholder {
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_search:focus {
  border-color: var(--dsw-alias-state-business-primary);
}
@media (pointer: coarse) {
  .dsh_market_search { font-size: 16px; }
}
/* The engine's own clear control is drawn in its accent blue; this redraws
   it as a neutral cross that follows the theme. */
.dsh_market_search::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  margin-left: 8px;
  cursor: pointer;
  background-color: var(--dsw-alias-label-tertiary);
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www%2Ew3%2Eorg/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 6 12 12M18 6 6 18'/%3E%3C/svg%3E") center / contain no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www%2Ew3%2Eorg/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round'%3E%3Cpath d='m6 6 12 12M18 6 6 18'/%3E%3C/svg%3E") center / contain no-repeat;
}
@media (hover: hover) {
  .dsh_market_search::-webkit-search-cancel-button:hover {
  background-color: var(--dsw-alias-label-primary);
}
}

.dsh_market_chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dsh_market_chip {
  /* An inline row action: the host outline Button at its sm size. */
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  box-shadow: inset 0 0 0 0.5px var(--dsw-alias-border-l3);
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
}
@media (hover: hover) {
  .dsh_market_chip:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
}
.dsh_market_chip[data-on="true"] {
  box-shadow: inset 0 0 0 0.5px var(--dsw-alias-label-primary);
  background: var(--dsw-alias-label-primary, CanvasText);
  color: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-layer-3, Canvas));
}

.dsh_market_status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_status[data-error="true"] {
  color: var(--dsw-alias-state-error-primary);
}
.dsh_market_status[aria-busy="true"] {
  color: var(--dsw-alias-label-secondary);
}

.dsh_market_cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: start;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* Every card grid gives each card the tallest card's height: equal rows read
   as one list, the verbs line up along each card's bottom edge, and a short
   description leaves space rather than a ragged edge. */
.dsh_market_cardsUniform {
  grid-auto-rows: 1fr;
  align-items: stretch;
}
.dsh_market_card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 12px 14px;
  /* The host settings-card material: R20, settings stroke and fill. */
  border: 0.5px solid var(--dsw-alias-settings-card-stroke, var(--dsw-alias-border-l2));
  border-radius: var(--dsw-radius-xl);
  background: var(--dsw-alias-settings-card-fill, var(--dsw-alias-bg-layer-3));
}
.dsh_market_head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.dsh_market_logo {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  /* 40px icon tile: R10 is the host's registered exception for 40px card tiles. */
  width: 40px; height: 40px; overflow: hidden; border-radius: 10px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  background: var(--dsw-alias-bg-layer-1); color: var(--dsw-alias-label-secondary);
}
.dsh_market_logo img { display: block; width: 100%; height: 100%; object-fit: contain; }
.dsh_market_logoPlaceholder { font-size: 18px; line-height: 1; font-weight: 500; }
/* Owner avatar fallback: round, so it reads as the author rather than the plugin's own logo. */
.dsh_market_logo img.dsh_market_logoAvatar { border-radius: 50%; corner-shape: round; }
.dsh_market_identity { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.dsh_market_catalogCard { gap: 12px; padding: 16px; }
.dsh_market_catalogCard .dsh_market_head { align-items: center; gap: 10px; }
.dsh_market_catalogCard .dsh_market_name {
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  white-space: normal; overflow-wrap: anywhere; font-size: 14px; line-height: 20px;
}
.dsh_market_packageName {
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  color: var(--dsw-alias-label-tertiary); font-size: 11px; line-height: 16px;
}
.dsh_market_catalogCard .dsh_market_meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.dsh_market_categoryTag {
  /* The host Tag, neutral tone. */
  display: inline-flex; align-items: center; padding: 1px 8px; border-radius: 999px; corner-shape: round;
  font-size: 11px; line-height: 17px; font-weight: 500; white-space: nowrap;
  background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-label-secondary);
}
.dsh_market_name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
}
.dsh_market_stars {
  flex: none;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-tertiary);
}
/* "You already have this": carried in the accent the rest of the section uses
   for its own state lines, so a card the user owns is distinguishable from a
   card they do not at a glance across the grid. */
.dsh_market_owned {
  flex: none;
  max-width: 45%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  /* The host Tag, success tone: an owned card reads as such without the brand-blue accent. */
  padding: 1px 8px;
  border-radius: 999px; corner-shape: round;
  font-size: 11px;
  line-height: 17px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent);
  color: var(--dsw-alias-state-success-primary);
}
/* Two cards to a row leaves about 250px of text width, which a long category
   and owner can still outgrow — so this line wraps rather than ending in an
   ellipsis that hides the date. */
.dsh_market_meta {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_repoIcon {
  display: inline-flex;
  margin-left: 5px;
  vertical-align: -2px;
  color: inherit;
}
.dsh_market_repoIcon svg {
  width: 14px;
  height: 14px;
}
.dsh_market_repoIcon:focus-visible {
  color: var(--dsw-alias-label-primary);
}
@media (hover: hover) {
  .dsh_market_repoIcon:hover {
  color: var(--dsw-alias-label-primary);
}
}
.dsh_market_desc {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
  font-size: 13px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
  padding-top: 2px;
}
.dsh_market_link {
  flex: none;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 28px;
  padding: 0 10px;
  border-radius: var(--dsw-radius-sm);
  box-shadow: inset 0 0 0 0.5px var(--dsw-alias-border-l3);
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  line-height: 18px;
  text-decoration: none;
}
@media (hover: hover) {
  .dsh_market_link:hover { background: var(--dsw-alias-interactive-bg-hover); }
}
.dsh_market_link:active { background: var(--dsw-alias-interactive-bg-active); }
.dsh_market_link:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 2px;
}
/* The confirmation replaces the row's actions, so the card reports what
   happened where the button that caused it was. */
.dsh_market_staged {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-top: auto;
  padding-top: 6px;
  font-size: 12px;
  line-height: 18px;
}
.dsh_market_stagedTitle {
  color: var(--dsw-alias-state-business-primary);
}
.dsh_market_stagedHint,
.dsh_market_cardError {
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_cardError {
  color: var(--dsw-alias-state-error-primary);
}
/* A missing workspace is a prerequisite, not a failure — the card says it in
   the ordinary secondary voice and keeps its action next to it. */
.dsh_market_cardNotice {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}

.dsh_market_note {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_note a {
  color: inherit;
  text-decoration: underline;
  cursor: pointer;
}

/* The installed set renders in the same card as the catalog rows, so it needs
   no layout of its own — only the few marks a shopfront card has no use for:
   the explanatory line above the grid, and the live state badge in each
   card's head. */
.dsh_market_installedBody {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_installedNotice {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-state-business-primary);
}
/* The desktop-seat hint: an inline info glyph; its explanation is the host Tooltip. */
.dsh_market_hint {
  display: inline-flex;
  margin-left: 5px;
  vertical-align: -2px;
  color: var(--dsw-alias-label-tertiary);
  cursor: help;
  border-radius: var(--dsw-radius-xs);
}
@media (hover: hover) {
  .dsh_market_hint:hover { color: var(--dsw-alias-label-secondary); }
}
.dsh_market_hint:focus-visible {
  color: var(--dsw-alias-label-secondary);
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 1px;
}
.dsh_market_installedState {
  flex: none;
  margin-left: auto;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_installedState[data-state="running"] {
  color: var(--dsw-alias-state-success-primary, var(--dsw-alias-state-business-primary));
}
.dsh_market_installedState[data-state="disabled"],
.dsh_market_installedState[data-state="unregistered"] {
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_installedState[data-state="failed"],
.dsh_market_installedState[data-state="readFailed"] {
  color: var(--dsw-alias-state-error-primary);
}

/* Destructive verbs ride the host outline Button; only their ink and hover fill take the error color. */
button.dsh_market_dangerButton { color: var(--dsw-alias-state-error-primary); }
@media (hover: hover) {
  button.dsh_market_dangerButton:hover:not(:disabled) { background: var(--dsw-alias-interactive-bg-hover-danger); }
}
@container (max-width: 440px) {
  .dsh_market_cards { grid-template-columns: minmax(0, 1fr); }
  .dsh_market_search.dsh_market_skillSearch { flex-basis: 100%; }
  .dsh_market_empty { padding: 28px 16px 24px; }
  .dsh_market_emptyActions { width: 100%; }
  .dsh_market_emptyActions > button { flex: 1 1 auto; }
}

/* The MCP page: the installed cards' shape, plus a monospace target line,
   a status voice per bucket, and the editor sheet's stacked fields. */
.dsh_market_skillsHeading .dsh_market_mcpAdd {
  height: 32px; padding: 0 12px; border-radius: var(--dsw-radius-md); font-size: 13px; line-height: 20px;
}
.dsh_market_mcpCard .dsh_market_cardError, .dsh_market_mcpCard .dsh_market_cardNotice,
.dsh_market_mcpEditor .dsh_market_cardError, .dsh_market_mcpEditor .dsh_market_cardNotice {
  margin: 0; font-size: 12px; line-height: 18px; overflow-wrap: anywhere;
}
.dsh_market_mcpState {
  flex: none; margin-left: auto; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary);
}
.dsh_market_mcpState[data-kind="connected"] { color: var(--dsw-alias-state-success-primary, var(--dsw-alias-state-business-primary)); }
.dsh_market_mcpState[data-kind="issue"],
.dsh_market_mcpState[data-kind="locked"] { color: var(--dsw-alias-state-error-primary); }
.dsh_market_mcpState[data-kind="disabled"],
.dsh_market_mcpState[data-kind="unknown"] { color: var(--dsw-alias-label-tertiary); }
.dsh_market_mcpCode {
  margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 17px;
  color: var(--dsw-alias-label-secondary);
}
.dsh_market_mcpProbe .dsh_market_mcpCode { white-space: normal; overflow-wrap: anywhere; }
.dsh_market_cardNotice[data-warning="true"] { color: var(--dsw-alias-state-warn-primary); }
.dsh_market_mcpProbe {
  display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: var(--dsw-radius-sm);
  background: var(--dsw-alias-bg-layer-1); font-size: 12px; line-height: 18px;
}
.dsh_market_mcpProbe p { margin: 0; }
.dsh_market_mcpCreds code, .dsh_market_mcpSecrets code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; overflow-wrap: anywhere;
}
/* Every MCP card has one fixed height so the grid reads as an even list;
   the variable middle (notices, credentials, probe result) scrolls inside
   the card, and the tool count sits at the right end of the badge row. */
.dsh_market_card.dsh_market_mcpCard { height: 208px; box-sizing: border-box; overflow: hidden; }
.dsh_market_card.dsh_market_mcpCard[data-confirming="true"] { height: auto; min-height: 208px; }
.dsh_market_mcpCard > .dsh_market_head, .dsh_market_mcpCard > .dsh_market_skillBadges,
.dsh_market_mcpCard > .dsh_market_mcpCode, .dsh_market_mcpCard > .dsh_market_foot { flex: none; }
.dsh_market_mcpBody {
  flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; gap: 6px;
  overflow-y: auto; overscroll-behavior: contain; scrollbar-width: thin;
}
.dsh_market_mcpBody > p { margin: 0; }
.dsh_market_skillBadges .dsh_market_mcpToolsButton { margin-left: auto; padding: 2px 10px; }
/* The tools sheet: a fixed-size dialog whose list alone scrolls. */
.dsh_market_modal:has(.dsh_market_mcpToolsDialog) { width: min(640px, 100%); height: min(600px, 100%); }
.dsh_market_directPanel.dsh_market_mcpToolsDialog { display: flex; flex-direction: column; padding: 0; overflow: hidden; }
.dsh_market_mcpToolsDialog .dsh_market_directHead { flex: none; padding: 22px 24px 12px; }
.dsh_market_mcpToolList:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: -2px; }
.dsh_market_mcpToolsDialog .dsh_market_mcpToolsFilter { flex: none; height: 34px; margin: 0 24px 12px; width: auto; }
.dsh_market_mcpToolsDialog .dsh_market_mcpToolsEmpty { margin: 0; padding: 24px; text-align: center; color: var(--dsw-alias-label-tertiary); }
.dsh_market_mcpToolList {
  flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain;
  list-style: none; margin: 0; padding: 4px 12px 16px; counter-reset: mcp-tool;
  border-top: 0.5px solid var(--dsw-alias-border-l2);
}
.dsh_market_mcpToolList li {
  counter-increment: mcp-tool;
  display: grid; grid-template-columns: 28px minmax(0, 1fr); column-gap: 4px; row-gap: 2px;
  padding: 10px 12px; border-radius: var(--dsw-radius-sm);
}
.dsh_market_mcpToolList li + li { box-shadow: inset 0 0.5px 0 var(--dsw-alias-border-l2); }
@media (hover: hover) {
  .dsh_market_mcpToolList li:hover { background: var(--dsw-alias-interactive-bg-hover); box-shadow: none; }
  .dsh_market_mcpToolList li:hover + li { box-shadow: none; }
}
.dsh_market_mcpToolList li::before {
  content: counter(mcp-tool, decimal-leading-zero); grid-row: 1 / span 2;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; line-height: 20px;
  color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums;
}
.dsh_market_mcpToolName {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 20px; font-weight: 500;
  color: var(--dsw-alias-label-primary); overflow-wrap: anywhere;
}
.dsh_market_mcpToolDesc {
  font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary);
  white-space: pre-line; overflow-wrap: anywhere;
}
.dsh_market_mcpToolDesc[data-empty="true"] { color: var(--dsw-alias-label-tertiary); font-style: italic; }
.dsh_market_mcpCreds { display: flex; flex-direction: column; gap: 4px; }
.dsh_market_mcpCreds ul, .dsh_market_mcpSecrets ul, .dsh_market_mcpPending {
  list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px;
}
.dsh_market_mcpCreds li, .dsh_market_mcpSecrets li {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 12px; line-height: 18px;
}
.dsh_market_mcpCredState { color: var(--dsw-alias-state-error-primary); }
.dsh_market_mcpCredState[data-configured="true"] { color: var(--dsw-alias-label-tertiary); }
.dsh_market_mcpCredForm { display: flex; flex-wrap: wrap; gap: 6px; width: 100%; }
.dsh_market_mcpCredForm input { flex: 1 1 160px; }
.dsh_market_mcpFieldRow { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: end; gap: 10px; }
@container (max-width: 440px) { .dsh_market_mcpFieldRow { grid-template-columns: minmax(0, 1fr); } }
.dsh_market_mcpFieldRow input:disabled { opacity: .5; }
.dsh_market_chip.dsh_market_mcpCredDanger { color: var(--dsw-alias-state-error-primary); }
.dsh_market_mcpForm { display: flex; flex-direction: column; gap: 12px; margin-top: 16px; }
.dsh_market_mcpField {
  display: flex; flex-direction: column; gap: 4px; margin: 0; padding: 0; border: 0; min-width: 0;
  font-size: 13px; line-height: 20px;
}
.dsh_market_mcpField > span, .dsh_market_mcpField > legend { font-weight: 500; padding: 0; margin-bottom: 2px; }
.dsh_market_mcpField input, .dsh_market_mcpField textarea, .dsh_market_mcpCredForm input {
  box-sizing: border-box; width: 100%; min-width: 0; padding: 6px 10px; border-radius: var(--dsw-radius-sm);
  border: 0.5px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary); font: inherit; font-size: 13px;
}
.dsh_market_mcpField textarea { resize: vertical; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
@media (pointer: coarse) {
  .dsh_market_mcpField input, .dsh_market_mcpField textarea, .dsh_market_mcpCredForm input { font-size: 16px; }
}
.dsh_market_mcpField input:disabled { opacity: .6; }
.dsh_market_mcpField input:focus-visible, .dsh_market_mcpField textarea:focus-visible, .dsh_market_mcpCredForm input:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 1px;
}
.dsh_market_mcpField > .dsh_market_chip { align-self: flex-start; }
.dsh_market_mcpPair { display: flex; align-items: center; gap: 6px; min-width: 0; }
.dsh_market_mcpPair input { flex: 1 1 0; }
.dsh_market_mcpPair .dsh_market_chip { flex: none; }
.dsh_market_mcpSecrets, .dsh_market_mcpRisk {
  display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border-radius: var(--dsw-radius-sm);
  border: 0.5px solid var(--dsw-alias-border-l2); background: var(--dsw-alias-bg-layer-2);
  font-size: 12px; line-height: 18px;
}
.dsh_market_mcpSecrets p, .dsh_market_mcpRisk p { margin: 0; }
.dsh_market_mcpRisk .dsh_market_directMessage { margin: 0; }
.dsh_market_mcpCheck { flex: none; display: inline-flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer; }

/* Settings page: host settings rows aligned with the section column. */
.dsh_market_settingsPage { gap: 0; padding-bottom: 24px; }
.dsh_market_settingsIntro { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.dsh_market_settingsTitle { margin: 0; font-size: 14px; font-weight: 500; line-height: 22px; color: var(--dsw-alias-label-primary); }
.dsh_market_settingsDesc { margin: 0; font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }
/* One host settings row: title and description beside the control, a hairline below. */
.dsh_market_settingRow {
  display: flex; flex-direction: column; gap: 12px; padding: 16px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2);
}
.dsh_market_settingRow:last-child { border-bottom: none; }
.dsh_market_settingHead { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.dsh_market_settingCopy { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; padding-right: 48px; }
@media (max-width: 767px) { .dsh_market_settingCopy { padding-right: 16px; } }
.dsh_market_settingName { margin: 0; font-size: 14px; font-weight: 400; line-height: 22px; color: var(--dsw-alias-label-primary); }
.dsh_market_settingBody { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-tertiary); }
.dsh_market_settingWarn { margin: 0; font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-warn-primary); }
.dsh_market_settingActions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.dsh_market_aiPick { margin-bottom: 5px; }
.dsh_market_aiPick svg { fill: currentColor; }
`

/**
 * Ownership lives on the shared DOM node, not in module state. HMR can overlap
 * two separately evaluated copies of this module; a module-local counter would
 * give each copy its own `1`, letting the old copy remove the new one's sheet.
 */
const STYLE_OWNERS = '__dshSafeMarketStyleOwners'
type OwnedStyleElement = HTMLStyleElement & { [STYLE_OWNERS]?: number }

/**
 * Inject the stylesheet, and hand back a disposer that removes it only once
 * the last adopter is gone. Idempotent across HMR re-runs and multiple
 * instances: the node is created once and reference-counted, so a re-applied
 * plugin reuses the existing tag rather than stacking a second one.
 */
export function adoptStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  let tag = document.getElementById(STYLE_ID) as OwnedStyleElement | null
  if (tag === null) {
    tag = document.createElement('style') as OwnedStyleElement
    tag.id = STYLE_ID
    tag.textContent = cssText
    // The host claims every untagged stylesheet for the next materialized
    // plugin, then deletes its claimed sheets on uninstall. Mark ownership
    // before insertion so another plugin cannot claim the market's CSS.
    tag.setAttribute('data-plugin', 'dsh-market-pro')
    document.head.appendChild(tag)
  } else {
    // Also repair an existing tag left by a previous client module version.
    tag.setAttribute('data-plugin', 'dsh-market-pro')
  }
  tag[STYLE_OWNERS] = (tag[STYLE_OWNERS] ?? 0) + 1
  // Guard against a disposer that fires twice: it must not double-decrement
  // and strand the count above zero (the sheet would then never come off).
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    const owners = Math.max(0, (tag[STYLE_OWNERS] ?? 1) - 1)
    tag[STYLE_OWNERS] = owners
    // A later module may have replaced the node under this id. An old
    // disposer must never remove that replacement.
    if (owners === 0 && document.getElementById(STYLE_ID) === tag) tag.remove()
  }
}
