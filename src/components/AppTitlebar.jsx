import { GearSix, MagnifyingGlass, Question, X } from "@phosphor-icons/react";
import { IconColorPicker, IconKeyboard, IconPinned } from "@tabler/icons-react";
import { formatShortcut, primaryModifierLabel } from "../utils/shortcuts.js";

export function AppTitlebar({ history, locale, t, searchRef, settingsButtonRef, onPickColor, onPin, onOpenShortcuts, onOpenHelp, onToggleSettings }) {
  return <header className="titlebar" data-tauri-drag-region>
    <div className="search-shell">
      <MagnifyingGlass size={18} weight="regular" />
      <input ref={searchRef} value={history.query} onChange={(event) => history.setQuery(event.target.value)} placeholder={t("search.placeholder")} aria-label={t("search.label")} />
      {history.query && <button className="clear-search" onClick={() => history.setQuery("")} aria-label={t("search.clear")}><X size={14} weight="bold" /></button>}
      <span className="search-shortcut">{primaryModifierLabel()}K</span>
    </div>
    <div className="title-actions">
      <button className="color-picker-action" aria-label={`${t("app.pickColor")} ${formatShortcut(history.settings.colorShortcut, locale)}`} title={`${t("app.pickColor")} · ${formatShortcut(history.settings.colorShortcut, locale)}`} onClick={onPickColor}><IconColorPicker size={18} stroke={1.75} /></button>
      <button aria-label={t("app.pinSelected")} disabled={history.batchMode} onClick={onPin} className={history.selected?.pinned ? "active" : ""}><IconPinned size={18} stroke={1.75} /></button>
      <button aria-label={t("app.openShortcuts")} title={t("app.openShortcuts")} onClick={onOpenShortcuts}><IconKeyboard size={18} stroke={1.75} /></button>
      <button aria-label={t("app.openHelp")} onClick={onOpenHelp}><Question size={20} /></button>
      <button ref={settingsButtonRef} aria-label={t("app.openSettings")} onClick={onToggleSettings}><GearSix size={20} /></button>
    </div>
  </header>;
}
