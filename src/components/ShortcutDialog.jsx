import { useState } from "react";
import { IconCommand, IconX } from "@tabler/icons-react";
import { formatShortcut, shortcutFromEvent } from "../utils/shortcuts.js";

export function ShortcutDialog({ settings, onChange, onClose, t, locale }) {
  const update = (patch) => onChange({ ...settings, ...patch });
  return <div className="help-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="shortcut-dialog" role="dialog" aria-modal="true" aria-labelledby="shortcut-title">
      <button className="help-close" onClick={onClose} aria-label={t("shortcut.close")}><IconX size={18} stroke={1.75} /></button>
      <header><span><IconCommand size={22} stroke={1.7} /></span><div><p>{t("settings.shortcuts")}</p><h2 id="shortcut-title">{t("shortcut.title")}</h2><small>{t("shortcut.intro")}</small></div></header>
      <div className="shortcut-list">
        <ShortcutRow title={t("settings.openMote")} detail={t("settings.openMoteDetail")} value={settings.openShortcut} pressKeys={t("settings.pressKeys")} locale={locale} onChange={(value) => update({ openShortcut: value })} />
        <ShortcutRow title={t("settings.openMultiple")} detail={t("settings.openMultipleDetail")} value={settings.batchShortcut} pressKeys={t("settings.pressKeys")} locale={locale} onChange={(value) => update({ batchShortcut: value })} />
        <ShortcutRow title={t("settings.pickColor")} detail={t("settings.pickColorDetail")} value={settings.colorShortcut} pressKeys={t("settings.pressKeys")} locale={locale} onChange={(value) => update({ colorShortcut: value })} />
        <ShortcutRow title={t("settings.toggleMultiple")} detail={t("settings.toggleMultipleDetail")} value={settings.toggleBatchShortcut} pressKeys={t("settings.pressKeys")} locale={locale} onChange={(value) => update({ toggleBatchShortcut: value })} />
      </div>
      <p className="shortcut-hint">{t("shortcut.hint")}</p>
      <button className="shortcut-done" onClick={onClose}>{t("help.done")}</button>
    </section>
  </div>;
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
  return <div className="shortcut-dialog-row"><span><strong>{title}</strong><small>{detail}</small></span><button className={recording ? "recording" : ""} onClick={() => setRecording(true)} onBlur={() => setRecording(false)} onKeyDown={recording ? capture : undefined}>{recording ? pressKeys : formatShortcut(value, locale)}</button></div>;
}
