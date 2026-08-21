import { useState } from "react";
import { Keyboard, Trash } from "@phosphor-icons/react";
import { formatShortcut, shortcutFromEvent } from "../utils/shortcuts.js";

function ToggleRow({ title, detail, checked, onChange }) {
  return (
    <label className="setting-row setting-toggle-row">
      <span className="setting-copy"><strong>{title}</strong><small>{detail}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle-control" aria-hidden="true"><span /></span>
    </label>
  );
}

function SelectRow({ title, detail, value, onChange, children }) {
  return (
    <label className="setting-row">
      <span className="setting-copy"><strong>{title}</strong><small>{detail}</small></span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>{children}</select>
    </label>
  );
}

function ShortcutRow({ title, detail, value, onChange, pressKeys, locale }) {
  const [recording, setRecording] = useState(false);
  const capture = (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      setRecording(false);
      return;
    }
    const shortcut = shortcutFromEvent(event);
    if (!shortcut) return;
    setRecording(false);
    onChange(shortcut);
  };
  return (
    <div className="setting-row shortcut-row">
      <span className="setting-copy"><strong>{title}</strong><small>{detail}</small></span>
      <button className={recording ? "recording" : ""} aria-label={title} onClick={() => setRecording(true)} onBlur={() => setRecording(false)} onKeyDown={recording ? capture : undefined}>{recording ? pressKeys : formatShortcut(value, locale)}</button>
    </div>
  );
}

export function SettingsPopover({ settings, onChange, onClear, t, locale }) {
  const update = (patch) => onChange({ ...settings, ...patch });
  return (
    <aside className="settings-popover" role="dialog" aria-label={`Mote ${t("settings.title")}`}>
      <header className="settings-header">
        <img src="/assets/mote-logo.png" alt="" />
        <span><strong>{t("settings.title")}</strong><small>{t("settings.subtitle")}</small></span>
      </header>

      <section className="settings-section">
        <p>{t("settings.general")}</p>
        <div className="settings-card">
          <SelectRow title={t("settings.language")} detail={t("settings.languageDetail")} value={settings.language} onChange={(value) => update({ language: value })}>
            <option value="auto">{t("settings.auto")}</option><option value="en">{t("settings.english")}</option><option value="zh-CN">{t("settings.chinese")}</option>
          </SelectRow>
          <ToggleRow title={t("settings.capture")} detail={t("settings.captureDetail")} checked={settings.captureEnabled} onChange={(value) => update({ captureEnabled: value })} />
          <ToggleRow title={t("settings.directPaste")} detail={t("settings.directPasteDetail")} checked={settings.directPaste} onChange={(value) => update({ directPaste: value })} />
          <ToggleRow title={t("settings.launch")} detail={t("settings.launchDetail")} checked={settings.launchAtLogin} onChange={(value) => update({ launchAtLogin: value })} />
        </div>
      </section>

      <section className="settings-section">
        <p><Keyboard size={11} /> {t("settings.shortcuts")}</p>
        <div className="settings-card">
          <ShortcutRow title={t("settings.openMote")} detail={t("settings.openMoteDetail")} value={settings.openShortcut} pressKeys={t("settings.pressKeys")} locale={locale} onChange={(value) => update({ openShortcut: value })} />
          <ShortcutRow title={t("settings.openMultiple")} detail={t("settings.openMultipleDetail")} value={settings.batchShortcut} pressKeys={t("settings.pressKeys")} locale={locale} onChange={(value) => update({ batchShortcut: value })} />
          <ShortcutRow title={t("settings.toggleMultiple")} detail={t("settings.toggleMultipleDetail")} value={settings.toggleBatchShortcut} pressKeys={t("settings.pressKeys")} locale={locale} onChange={(value) => update({ toggleBatchShortcut: value })} />
        </div>
      </section>

      <section className="settings-section">
        <p>{t("settings.privacy")}</p>
        <div className="settings-card">
          <ToggleRow title={t("settings.ignorePasswords")} detail={t("settings.ignorePasswordsDetail")} checked={settings.excludeSensitiveApps} onChange={(value) => update({ excludeSensitiveApps: value })} />
          <SelectRow title={t("settings.historyLimit")} detail={t("settings.historyLimitDetail")} value={settings.historyLimit} onChange={(value) => update({ historyLimit: Number(value) })}>
            <option value="100">100</option><option value="500">500</option><option value="1000">1,000</option><option value="5000">5,000</option>
          </SelectRow>
          <SelectRow title={t("settings.keepHistory")} detail={t("settings.keepHistoryDetail")} value={settings.retentionDays} onChange={(value) => update({ retentionDays: Number(value) })}>
            <option value="7">{t("settings.days", { count: 7 })}</option><option value="30">{t("settings.days", { count: 30 })}</option><option value="90">{t("settings.days", { count: 90 })}</option><option value="0">{t("settings.forever")}</option>
          </SelectRow>
        </div>
      </section>

      <section className="settings-section">
        <p>{t("settings.accessibility")}</p>
        <div className="settings-card">
          <ToggleRow title={t("settings.reduceMotion")} detail={t("settings.reduceMotionDetail")} checked={settings.reduceMotion} onChange={(value) => update({ reduceMotion: value })} />
        </div>
      </section>

      <button className="clear-history" onClick={onClear}><Trash size={16} /> {t("settings.clear")}</button>
    </aside>
  );
}
