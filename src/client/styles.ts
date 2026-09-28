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
export const STYLE_ID = 'safer-dsh-market-style'

/** The market tab's injected stylesheet text. */
export const cssText = `
.dsh_market_modeControl { position: relative; display: inline-flex; max-width: 100%; }
.dsh_market_modeTrigger {
  box-sizing: border-box; text-align: left;
  height: 32px; padding: 0 34px 0 10px; border-radius: 8px;
  font-size: 13px; line-height: normal; cursor: pointer;
  transition: background-color .15s ease, border-color .15s ease;
}
.dsh_market_modeTrigger:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh_market_modeTrigger:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px;
}
.dsh_market_modeChevron {
  position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
  color: var(--dsw-alias-label-secondary); pointer-events: none;
}
.dsh_market_modeTrigger {
  font: inherit; color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-3);
  border: 1px solid var(--dsw-alias-border-l2); max-width: 100%;
}
.dsh_market_modeMenu {
  position: absolute; right: 0; top: calc(100% + 6px); z-index: 10;
  min-width: 100%; width: max-content; max-width: min(320px, calc(100vw - 48px));
  box-sizing: border-box; padding: 5px; border-radius: 12px;
  background: var(--dsw-alias-bg-layer-3); border: 1px solid var(--dsw-alias-border-l2);
  box-shadow: 0 6px 20px rgba(0, 0, 0, .12);
}
.dsh_market_modeMenu button {
  display: flex; justify-content: space-between; align-items: center; gap: 20px;
  width: 100%; padding: 9px 10px; border: 0; border-radius: 8px;
  background: none; color: var(--dsw-alias-label-primary); font: inherit; text-align: left; cursor: pointer;
}
.dsh_market_modeMenu button:hover, .dsh_market_modeMenu button:focus-visible {
  background: var(--dsw-alias-interactive-bg-hover); outline: none;
}

.dsh_market_directPanel {
  color: var(--dsw-alias-label-primary); background: var(--dsw-alias-bg-layer-3);
  border: 1px solid var(--dsw-alias-border-l2); border-radius: 20px; padding: 24px;
  box-sizing: border-box; width: min(480px, calc(100vw - 32px)); max-height: 80vh; overflow-y: auto; overflow-x: hidden; overflow-wrap: anywhere;
}
.dsh_market_directPanel::backdrop { background: rgba(0, 0, 0, .3); }
.dsh_market_directHead { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
.dsh_market_installHeading { min-width: 0; }
.dsh_market_installHeading > span { font-size: 12px; color: var(--dsw-alias-label-tertiary); }
.dsh_market_installHeading h3 { margin: 6px 0 0; font-size: 18px; line-height: 1.4; font-weight: 600; overflow-wrap: anywhere; }
.dsh_market_installStatus { margin-top: 22px; padding: 16px; border-radius: 12px; background: var(--dsw-alias-interactive-bg-hover); }
.dsh_market_installStatus > strong { font-size: 14px; font-weight: 500; }
.dsh_market_directPanel .dsh_market_installStatus p { margin: 8px 0 12px; color: var(--dsw-alias-label-secondary); }
.dsh_market_buildList { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 6px; }
.dsh_market_buildList li { padding: 4px 8px; background: var(--dsw-alias-bg-layer-3); border: 1px solid var(--dsw-alias-border-l2); border-radius: 6px; font-size: 12px; overflow-wrap: anywhere; }
.dsh_market_installDiagnostic { margin-top: 12px; font-size: 12px; color: var(--dsw-alias-label-secondary); }
.dsh_market_installDiagnostic summary { cursor: pointer; }
.dsh_market_installFooter {
  border: 0; padding: 0; margin: 0; min-width: 0; display: flex; justify-content: flex-end; align-items: center; flex-wrap: wrap; gap: 10px; padding-top: 18px; border-top: 1px solid var(--dsw-alias-border-l2); }
.dsh_market_installFooter .dsh_market_primary, .dsh_market_installFooter .dsh_market_ghost { min-height: 36px; padding: 7px 16px; font-size: 13px; }

.dsh_market_directClose {
  display: inline-flex; align-items: center; justify-content: center; flex: none;
  width: 32px; height: 32px; border: 0; border-radius: 8px; background: none;
  color: var(--dsw-alias-label-tertiary); cursor: pointer;
}
.dsh_market_directClose:hover { background: var(--dsw-alias-interactive-bg-hover); }
.dsh_market_directClose:focus-visible, .dsh_market_installDetails summary:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px;
}
.dsh_market_installChoices { min-width: 0; margin: 20px 0 0; padding: 0; border: 0; }
.dsh_market_installChoices legend { margin-bottom: 10px; padding: 0; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.dsh_market_directPanel .dsh_market_installChoice { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 10px 12px; margin: 6px 0; border: 1px solid var(--dsw-alias-border-l2); border-radius: 10px; font-size: 13px; cursor: pointer; }
.dsh_market_installChoice:has(input:checked) { background: var(--dsw-alias-interactive-bg-hover); border-color: var(--dsw-alias-label-secondary); }
.dsh_market_installChoice input { flex: none; margin: 0; accent-color: var(--dsw-alias-label-primary); }
.dsh_market_installQueue { list-style: none; padding: 0; margin: 16px 0; }
.dsh_market_installQueue li { padding: 10px 0; border-bottom: 1px solid var(--dsw-alias-border-l2); overflow-wrap: anywhere; }
.dsh_market_installQueue small { display: block; margin-top: 4px; color: var(--dsw-alias-label-secondary); }
.dsh_market_installChoices p { font-size: 12px; color: var(--dsw-alias-label-secondary); }
.dsh_market_installChoice span { min-width: 0; overflow-wrap: anywhere; }
.dsh_market_installDetails { margin: 20px 0; font-size: 13px; color: var(--dsw-alias-label-secondary); }
.dsh_market_installDetails summary { cursor: pointer; width: fit-content; }
.dsh_market_installDetails[open] summary { margin-bottom: 14px; }


.dsh_market_directPanel p { margin: 12px 0; font-size: 13px; line-height: 1.6; }
.dsh_market_directPanel label { display: grid; gap: 8px; }
.dsh_market_directPanel code { display: block; min-width: 0; max-width: 100%; margin: 8px 0; white-space: pre-wrap; overflow-wrap: anywhere; word-break: break-word; }
.dsh_market_directMessage { white-space: pre-wrap; max-height: 200px; overflow: auto; font-size: 12px; }

.dsh_market_main {
  height: 100%;
  min-height: 0;
  overflow: hidden;
  box-sizing: border-box;
  padding: 24px;
}
.dsh_market_main > .dsh_market_section { margin: 0 auto; }
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
  max-width: 760px;
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
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 50%;
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
}
.dsh_market_backToTop:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
.dsh_market_backToTop:focus-visible { outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px; }
.dsh_market_skillSource { overflow-wrap: anywhere; }
.dsh_market_subtitle,
.dsh_market_skillsTitle {
  margin: 0;
  font-size: 13px;
  font-weight: 400;
  line-height: 20px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_headingRow {
  padding-right: 148px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  min-width: 0;
}
.dsh_market_refreshMarket {
  position: absolute;
  top: 0;
  right: 36px;
  z-index: 2;
}
.dsh_market_more { position: absolute; top: 0; right: 0; z-index: 5; }
.dsh_market_moreTrigger { list-style: none; justify-content: center; width: 28px; }
.dsh_market_moreTrigger::-webkit-details-marker { display: none; }
.dsh_market_morePanel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  display: flex;
  flex-direction: column;
  min-width: 180px;
  padding: 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-3);
}
.dsh_market_morePanel > .dsh_market_headerAction { height: 34px; padding: 6px 10px; }
.dsh_market_more:not([open]) > .dsh_market_morePanel { display: none; }
.dsh_market_headerAction {
  box-sizing: border-box;
  height: 26px;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex: none;
  padding: 2px 4px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
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
.dsh_market_headerAction:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dsh_market_headerAction:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
}
.dsh_market_headerAction:disabled {
  cursor: default;
  opacity: .55;
}
.dsh_market_heading {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  font-size: 18px;
  font-weight: 600;
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
  flex-wrap: wrap; gap: 8px 20px;
  border-bottom: 1px solid var(--dsw-alias-border-l2);
}
.dsh_market_filterBar {
  display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px;
}
.dsh_market_scope {
  display: inline-flex; flex: none; gap: 2px; padding: 3px; border-radius: 9px;
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh_market_scopeButton {
  display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px;
  border: 0; border-radius: 6px; background: none; cursor: pointer;
  font: inherit; font-size: 12px; line-height: 20px; color: var(--dsw-alias-label-secondary);
}
.dsh_market_scopeButton[aria-pressed="true"] {
  background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary);
}
.dsh_market_scopeButton span { opacity: .65; font-variant-numeric: tabular-nums; }
.dsh_market_category {
  display: flex; align-items: center; gap: 8px; min-width: 0; max-width: 100%;
  font-size: 12px; color: var(--dsw-alias-label-secondary);
}
.dsh_market_category > span { flex: none; }
.dsh_market_category .dsh_market_modeControl { min-width: 0; }
.dsh_market_category .dsh_market_modeTrigger { height: 34px; width: 200px; }
.dsh_market_selectLabel { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dsh_market_modeMenu { max-height: min(320px, 45vh); overflow-y: auto; overscroll-behavior: contain; }
.dsh_market_modeMenu button { gap: 10px; }
.dsh_market_optionLabel { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.dsh_market_optionCount { color: var(--dsw-alias-label-tertiary); font-variant-numeric: tabular-nums; }
.dsh_market_optionCheck { flex: none; }
.dsh_market_modeMenu button[aria-checked="true"] { background: var(--dsw-alias-interactive-bg-hover); }
.dsh_market_clearFilters {
  border: 0; background: none; padding: 2px 0; font: inherit;
  color: var(--dsw-alias-label-secondary); cursor: pointer; text-decoration: underline; text-underline-offset: 3px;
}
.dsh_market_scopeButton:focus-visible, .dsh_market_clearFilters:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary); outline-offset: 2px;
}
/* The section's own page strip, in the official tab language. */
.dsh_market_tabs {
  min-height: 38px;
  box-sizing: border-box;
  display: flex;
  align-items: flex-end;
  gap: 22px;
  margin-top: 2px;
}
.dsh_market_tab {
  position: relative;
  padding: 7px 1px 9px;
  border: 0;
  background: none;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
}
.dsh_market_tab:hover,
.dsh_market_tab[data-active="true"] {
  color: var(--dsw-alias-label-primary);
}
.dsh_market_tab[data-active="true"]::after,
.dsh_market_tab:focus-visible::after {
  content: "";
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 2px;
  border-radius: 2px 2px 0 0;
  background: var(--dsw-alias-label-primary, CanvasText);
}
.dsh_market_tab:focus-visible {
  border-radius: 2px;
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 2px;
  color: var(--dsw-alias-label-primary);
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
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-3);
}
.dsh_market_introTitle {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
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
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
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
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  outline: none;
}
.dsh_market_search::placeholder {
  color: var(--dsw-alias-label-tertiary);
}
.dsh_market_search:focus-visible {
  border-color: var(--dsw-alias-state-business-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 18%, transparent);
}

.dsh_market_ghost {
  flex: none;
  white-space: nowrap;
  padding: 7px 16px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 28px;
  background: none;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: background-color .15s ease;
}
.dsh_market_ghost:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh_market_ghost:disabled {
  cursor: default;
  opacity: .55;
}

.dsh_market_primary {
  flex: none;
  white-space: nowrap;
  padding: 7px 16px;
  border: 1px solid var(--dsw-alias-label-primary);
  border-radius: 28px;
  background: var(--dsw-alias-label-primary, CanvasText);
  color: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-layer-3, Canvas));
  font: inherit;
  font-size: 13px;
  cursor: pointer;
  transition: opacity .15s ease;
}
.dsh_market_primary:hover:not(:disabled) {
  opacity: .88;
}
.dsh_market_primary:disabled {
  cursor: default;
  opacity: .55;
}

.dsh_market_chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dsh_market_chip {
  padding: 3px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  background: none;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
}
.dsh_market_chip:hover {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh_market_chip[data-on="true"] {
  border-color: var(--dsw-alias-label-primary);
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
.dsh_market_card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  padding: 12px 14px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-3);
}
.dsh_market_head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.dsh_market_name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-size: 13px;
  font-weight: 600;
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
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-state-business-primary);
}
/* Two cards to a row leaves about 250px of text width, which is not enough
   for category, owner, language, licence and date on one line — so this line
   wraps rather than ending in an ellipsis that hides the licence. */
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
.dsh_market_repoIcon:hover,
.dsh_market_repoIcon:focus-visible {
  color: var(--dsw-alias-label-primary);
}
.dsh_market_desc {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
  font-size: 13px;
  line-height: 19px;
  color: var(--dsw-alias-label-secondary);
}
.dsh_market_foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  margin-top: auto;
  padding-top: 2px;
}
/* The disable verb reuses the section's ghost button, which is sized for the
   page chrome (enable/refresh). In this row it must match the uninstall
   control beside it — same padding, type size, and line box. */
.dsh_market_foot .dsh_market_ghost {
  padding: 4px 12px;
  font-size: 12px;
  line-height: 18px;
  border-radius: 999px;
}
.dsh_market_link {
  flex: none;
  padding: 4px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  text-decoration: none;
}
.dsh_market_link:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}
.dsh_market_install {
  flex: none;
  padding: 4px 12px;
  border: 1px solid var(--dsw-alias-label-primary);
  border-radius: 999px;
  background: var(--dsw-alias-label-primary, CanvasText);
  color: var(--dsw-alias-bg-layer-1, var(--dsw-alias-bg-layer-3, Canvas));
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: opacity .15s ease;
}
.dsh_market_install:hover:not(:disabled) {
  opacity: .88;
}
.dsh_market_install:disabled {
  cursor: default;
  opacity: .55;
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
/* The desktop-seat hint: an inline ⓘ whose explanation pops on hover or
   keyboard focus. A tooltip rather than a standing paragraph because the
   text answers a question most viewings never ask. */
.dsh_market_hint {
  position: relative;
  display: inline-flex;
  margin-left: 5px;
  vertical-align: -2px;
  color: var(--dsw-alias-label-tertiary);
  cursor: help;
  outline: none;
}
.dsh_market_hint svg {
  width: 13px;
  height: 13px;
}
.dsh_market_hint:hover,
.dsh_market_hint:focus-visible {
  color: var(--dsw-alias-label-secondary);
}
.dsh_market_hintTip {
  position: absolute;
  bottom: calc(100% + 8px);
  /* Anchored to the icon's RIGHT edge, growing leftward. Centering reads
     nicer but overflows the dialog whenever the icon sits in a right-column
     card — which the seat card usually does, listed after the dependency
     installs. Leftward growth stays inside: the meta line guarantees more
     room on that side than the tip is wide. */
  right: -8px;
  z-index: 30;
  width: 264px;
  padding: 8px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-3);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.14);
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  text-align: left;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.12s;
}
.dsh_market_hint:hover .dsh_market_hintTip,
.dsh_market_hint:focus-visible .dsh_market_hintTip {
  opacity: 1;
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

/* The uninstall verb: outlined in the error color so the destructive action
   reads as such without filling the row. */
.dsh_market_danger {
  flex: none;
  white-space: nowrap;
  padding: 4px 12px;
  border: 1px solid var(--dsw-alias-state-error-primary);
  border-radius: 999px;
  background: none;
  color: var(--dsw-alias-state-error-primary);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  cursor: pointer;
  transition: background-color .15s ease;
}
.dsh_market_danger:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, transparent);
}
.dsh_market_danger:disabled {
  cursor: default;
  opacity: .55;
}
@container (max-width: 440px) {
  .dsh_market_cards { grid-template-columns: minmax(0, 1fr); }
}
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
    tag.setAttribute('data-plugin', 'safer-dsh-market')
    document.head.appendChild(tag)
  } else {
    // Also repair an existing tag left by a previous client module version.
    tag.setAttribute('data-plugin', 'safer-dsh-market')
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
