import { useMemo, useState } from "react";
import { IconCommand, IconSearch, IconStack2, IconX } from "@tabler/icons-react";
import { formatShortcut, shortcutFromEvent } from "../utils/shortcuts.js";

export function ShortcutDialog({ settings, onChange, onClose, t, locale }) {
  const [category, setCategory] = useState("global");
  const update = (patch) => onChange({ ...settings, ...patch });
  const categories = useMemo(() => shortcutCategories(settings, update, t), [settings, t]);
  const active = categories.find((item) => item.id === category) ?? categories[0];
  return <div className="help-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcut-title">
      <button className="help-close" onClick={onClose} aria-label={t("shortcut.close")}><IconX size={18} stroke={1.75} /></button>
      <header><h2 id="shortcut-title">{t("shortcut.title")}</h2></header>
      <div className="shortcut-layout">
        <nav className="shortcut-categories" aria-label={t("shortcut.categories")}>
          {categories.map(({ id, icon: Icon, label }) => <button key={id} className={active.id === id ? "active" : ""} onClick={() => setCategory(id)}><Icon size={17} stroke={1.7} /><span>{label}</span></button>)}
        </nav>
        <div className="shortcut-category-panel">
          <div className="shortcut-category-heading"><small>{active.detail}</small></div>
          <div className="shortcut-list">
            {active.rows.map((row) => row.editable
              ? <ShortcutRow key={row.title} {...row} pressKeys={t("settings.pressKeys")} locale={locale} />
              : <FixedShortcutRow key={row.title} {...row} locale={locale} />)}
          </div>
        </div>
      </div>
      <p className="shortcut-hint">{t("shortcut.hint")}</p>
    </section>
  </div>;
}

function shortcutCategories(settings, update, t) {
  const primary = "Meta";
  const editable = (title, detail, value, key) => ({ title, detail, value, editable: true, onChange: (next) => update({ [key]: next }) });
  const fixed = (title, detail, value) => ({ title, detail, value, editable: false });
  return [
    { id: "global", icon: IconCommand, label: t("shortcut.category.global"), detail: t("shortcut.category.globalDetail"), rows: [
      editable(t("settings.openMote"), t("settings.openMoteDetail"), settings.openShortcut, "openShortcut"),
      editable(t("settings.openMultiple"), t("settings.openMultipleDetail"), settings.batchShortcut, "batchShortcut"),
      editable(t("settings.pickColor"), t("settings.pickColorDetail"), settings.colorShortcut, "colorShortcut"),
      editable(t("settings.longScreenshot"), t("settings.longScreenshotDetail"), settings.screenshotShortcut, "screenshotShortcut"),
    ] },
    { id: "browse", icon: IconSearch, label: t("shortcut.category.browse"), detail: t("shortcut.category.browseDetail"), rows: [
      fixed(t("shortcut.search"), t("shortcut.searchDetail"), `${primary}+KeyK`),
      fixed(t("shortcut.navigate"), t("shortcut.navigateDetail"), ["ArrowUp", "ArrowDown"]),
      fixed(t("shortcut.copy"), t("shortcut.copyDetail"), `${primary}+Enter`),
      fixed(t("shortcut.paste"), t("shortcut.pasteDetail"), "Enter"),
      fixed(t("shortcut.dismiss"), t("shortcut.dismissDetail"), "Escape"),
    ] },
    { id: "multiple", icon: IconStack2, label: t("shortcut.category.multiple"), detail: t("shortcut.category.multipleDetail"), rows: [
      editable(t("settings.toggleMultiple"), t("settings.toggleMultipleDetail"), settings.toggleBatchShortcut, "toggleBatchShortcut"),
      fixed(t("shortcut.select"), t("shortcut.selectDetail"), "Space"),
      fixed(t("shortcut.selectAll"), t("shortcut.selectAllDetail"), `${primary}+KeyA`),
      fixed(t("shortcut.reorder"), t("shortcut.reorderDetail"), ["Alt+ArrowUp", "Alt+ArrowDown"]),
      fixed(t("shortcut.pasteCombined"), t("shortcut.pasteCombinedDetail"), "Enter"),
    ] },
  ];
}

function FixedShortcutRow({ title, detail, value, locale }) {
  const values = Array.isArray(value) ? value : [value];
  return <div className="shortcut-dialog-row"><span><strong>{title}</strong></span><div className="shortcut-fixed">{values.map((item) => <kbd key={item}>{item === "Escape" ? "Esc" : formatShortcut(item, locale)}</kbd>)}</div></div>;
}

function ShortcutRow({ title, detail, value, onChange, pressKeys, locale }) {
  const [recording, setRecording] = useState(false);
  const capture = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") return setRecording(false);
    const shortcut = shortcutFromEvent(event);
    if (!shortcut) return;
    setRecording(false);
    onChange(shortcut);
  };
  return <div className="shortcut-dialog-row"><span><strong>{title}</strong></span><button className={recording ? "recording" : ""} onClick={() => setRecording(true)} onBlur={() => setRecording(false)} onKeyDown={recording ? capture : undefined}>{recording ? pressKeys : formatShortcut(value, locale)}</button></div>;
}
