import { useEffect, useState } from "react";
import { ArrowClockwise, CheckCircle, Trash, WarningCircle } from "@phosphor-icons/react";

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

function UpdateRow({ updater, t }) {
  const checking = updater.status === "checking";
  const current = updater.status === "current";
  const status = updater.status === "checking"
    ? t("update.checking")
    : updater.status === "current"
      ? t("update.current")
      : updater.status === "error"
        ? t("update.checkFailed")
        : t("update.version", { version: updater.currentVersion });
  return (
    <div className="setting-row update-setting-row">
      <span className="setting-copy"><strong>{t("update.settingsTitle")}</strong><small>{status}</small></span>
      <button className={current ? "is-current" : ""} disabled={checking} onClick={() => updater.checkForUpdates()} aria-live="polite">
        {current ? <CheckCircle size={14} weight="fill" /> : <ArrowClockwise className={checking ? "update-spinner" : ""} size={14} />}
        {checking ? t("update.checkingAction") : current ? t("update.checkedAction") : t("update.check")}
      </button>
    </div>
  );
}

export function SettingsPopover({ popoverRef, settings, onChange, onClear, updater, permissionStatus, onRefreshPermissions, onOpenAccessibility, onRequestScreenCapture, t }) {
  const [section, setSection] = useState("general");
  const [permissionCheck, setPermissionCheck] = useState("idle");
  useEffect(() => {
    if (permissionStatus.accessibility && permissionStatus.screenCapture) setPermissionCheck("ready");
  }, [permissionStatus.accessibility, permissionStatus.screenCapture]);
  const update = (patch) => onChange({ ...settings, ...patch });
  const checkPermissions = async () => {
    setPermissionCheck("checking");
    const status = await onRefreshPermissions();
    setPermissionCheck(status?.accessibility && status?.screenCapture ? "ready" : "needed");
  };
  const permissionCheckLabel = permissionCheck === "checking"
    ? t("permission.checking")
    : permissionCheck === "ready"
      ? t("permission.checkedReady")
      : permissionCheck === "needed"
        ? t("permission.stillNeeded")
        : t("permission.checkAgain");
  return (
    <aside ref={popoverRef} className="settings-popover" role="dialog" aria-label={`Mote ${t("settings.title")}`}>
      <header className="settings-header">
        <img src="/assets/mote-logo.png" alt="" />
        <span><strong>{t("settings.title")}</strong><small>{t("settings.subtitle")}</small></span>
      </header>

      <nav className="settings-tabs" aria-label={t("settings.categories")}>
        {["general", "privacy", "appearance", "update"].map((value) => <button className={section === value ? "active" : ""} key={value} onClick={() => setSection(value)}>{t(`settings.category.${value}`)}</button>)}
      </nav>

      {section === "general" && <>
      <section className="settings-section">
        <p>{t("settings.permissions")}</p>
        <div className="settings-card permission-card">
          <PermissionRow title={t("permission.capture")} detail={permissionStatus.clipboardCapture ? t("permission.ready") : t("permission.captureOff")} ready={permissionStatus.clipboardCapture} />
          <PermissionRow title={t("permission.autoPaste")} detail={permissionStatus.accessibility ? t("permission.ready") : t("permission.accessibilityNeeded")} ready={permissionStatus.accessibility} action={!permissionStatus.accessibility && <button onClick={onOpenAccessibility}>{t("permission.fix")}</button>} />
          <PermissionRow title={t("permission.screenCapture")} detail={permissionStatus.screenCapture ? t("permission.ready") : t("permission.screenCaptureNeeded")} ready={permissionStatus.screenCapture} action={!permissionStatus.screenCapture && <button onClick={onRequestScreenCapture}>{t("permission.allow")}</button>} />
          <button className={`permission-refresh ${permissionCheck}`} disabled={permissionCheck === "checking"} onClick={checkPermissions} aria-live="polite">{permissionCheck === "ready" ? <CheckCircle size={13} weight="fill" /> : <ArrowClockwise className={permissionCheck === "checking" ? "update-spinner" : ""} size={13} />}{permissionCheckLabel}</button>
        </div>
        {permissionCheck === "needed" && <small className="permission-check-note">{t("permission.restartHint")}</small>}
      </section>

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

      </>}

      {section === "privacy" && <>
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
      <button className="clear-history" onClick={onClear}><Trash size={16} /> {t("settings.clear")}</button>
      </>}

      {section === "appearance" &&
      <section className="settings-section">
        <p>{t("settings.accessibility")}</p>
        <div className="settings-card">
          <ToggleRow title={t("settings.reduceMotion")} detail={t("settings.reduceMotionDetail")} checked={settings.reduceMotion} onChange={(value) => update({ reduceMotion: value })} />
        </div>
      </section>}

      {section === "update" &&
      <section className="settings-section">
        <p>{t("update.section")}</p>
        <div className="settings-card"><UpdateRow updater={updater} t={t} /></div>
      </section>}
    </aside>
  );
}

function PermissionRow({ title, detail, ready, action }) {
  return <div className="setting-row permission-row"><span className="setting-copy"><strong>{title}</strong><small>{detail}</small></span><span className={`permission-state ${ready ? "ready" : "needed"}`}>{ready ? <CheckCircle size={16} weight="fill" /> : <WarningCircle size={16} weight="fill" />}{action}</span></div>;
}
