import { GearSix, MagnifyingGlass, Question, X } from "@phosphor-icons/react";
import { IconColorPicker, IconKeyboard, IconPinned, IconScreenshot } from "@tabler/icons-react";
import { formatShortcut, primaryModifierLabel } from "../utils/shortcuts.js";

export function AppTitlebar({ history, locale, t, searchRef, settingsButtonRef, settingsOpen, helpOpen, shortcutOpen, onPickColor, onScreenshot, onPin, onOpenShortcuts, onOpenHelp, onToggleSettings }) {
  const colorTooltip = `${t("app.pickColor")} · ${formatShortcut(history.settings.colorShortcut, locale)}`;
  const screenshotTooltip = `${t("app.longScreenshot")} · ${formatShortcut(history.settings.screenshotShortcut, locale)}`;
  const pinTooltip = history.batchMode
    ? t("app.pinUnavailableMultiple")
    : history.selected?.pinned ? t("app.unpinSelected") : t("app.pinSelected");
  return <header className="titlebar" data-tauri-drag-region>
    <div className="search-shell">
      <MagnifyingGlass size={18} weight="regular" />
      <input ref={searchRef} value={history.query} onChange={(event) => history.setQuery(event.target.value)} placeholder={t("search.placeholder")} aria-label={t("search.label")} />
      {history.query && <button className="clear-search" onClick={() => history.setQuery("")} aria-label={t("search.clear")}><X size={14} weight="bold" /></button>}
      <span className="search-shortcut">{primaryModifierLabel()}K</span>
    </div>
    <div className="title-actions">
      <TitleAction label={colorTooltip}><button className="color-picker-action" aria-label={colorTooltip} onClick={onPickColor}><IconColorPicker size={18} stroke={1.75} /></button></TitleAction>
      <TitleAction label={screenshotTooltip}><button aria-label={screenshotTooltip} onClick={onScreenshot}><IconScreenshot size={18} stroke={1.75} /></button></TitleAction>
      <TitleAction label={pinTooltip}><button aria-label={pinTooltip} aria-pressed={history.selected?.pinned} disabled={history.batchMode} onClick={onPin} className={history.selected?.pinned ? "active" : ""}><IconPinned size={18} stroke={1.75} /></button></TitleAction>
      <TitleAction label={t("app.openShortcuts")} active={shortcutOpen}><button aria-label={t("app.openShortcuts")} aria-pressed={shortcutOpen} onClick={onOpenShortcuts}><IconKeyboard size={18} stroke={1.75} /></button></TitleAction>
      <TitleAction label={t("app.openHelp")} active={helpOpen}><button aria-label={t("app.openHelp")} aria-pressed={helpOpen} onClick={onOpenHelp}><Question size={20} /></button></TitleAction>
      <TitleAction label={t("app.openSettings")} active={settingsOpen}><button ref={settingsButtonRef} aria-label={t("app.openSettings")} aria-pressed={settingsOpen} onClick={onToggleSettings}><GearSix size={20} /></button></TitleAction>
    </div>
  </header>;
}

function TitleAction({ label, active = false, children }) {
  return <span className={`title-action-slot${active ? " active" : ""}`}>{children}<span className="title-action-tooltip" aria-hidden="true">{label}</span></span>;
}
