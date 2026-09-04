import { useEffect, useState } from "react";
import { ArrowClockwise, CheckCircle, Trash, WarningCircle } from "@phosphor-icons/react";

function ToggleRow({ title, detail, checked, onChange }) {
  return (
    <label className="setting-row setting-toggle-row">
      <span className="setting-copy"><strong>{title}</strong>{detail && <small>{detail}</small>}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="toggle-control" aria-hidden="true"><span /></span>
    </label>
  );
}

function SelectRow({ title, detail, value, onChange, children }) {
  return (
    <label className="setting-row">
      <span className="setting-copy"><strong>{title}</strong>{detail && <small>{detail}</small>}</span>
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

export function SettingsPopover({ popoverRef, settings, onChange, onClear, updater, permissionStatus, onRefreshPermissions, onOpenAccessibility, onRequestScreenCapture, onRepairPermissions, t }) {
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
  const repairPermissions = async () => {
    setPermissionCheck("checking");
    try {
      await onRepairPermissions();
    } catch {
      // The parent shows the native repair error.
    } finally {
      setPermissionCheck("needed");
    }
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
        <strong>{t("settings.title")}</strong>
      </header>

      <nav className="settings-tabs" aria-label={t("settings.categories")}>
        {["general", "privacy", "appearance", "update"].map((value) => <button className={section === value ? "active" : ""} key={value} onClick={() => setSection(value)}>{t(`settings.category.${value}`)}</button>)}
      </nav>

      {section === "general" && <>
      <section className="settings-section permission-section">
        <div className="permission-summary">
          <strong>{t("settings.permissions")}</strong>
          <div className="permission-pills">
            <PermissionPill label={t("permission.capture")} ready={permissionStatus.clipboardCapture} />
            <PermissionPill label={t("permission.autoPaste")} ready={permissionStatus.accessibility} />
            <PermissionPill label={t("permission.screenCapture")} ready={permissionStatus.screenCapture} />
          </div>
          <button className={`permission-refresh ${permissionCheck}`} disabled={permissionCheck === "checking"} onClick={checkPermissions} aria-label={permissionCheckLabel} title={permissionCheckLabel} aria-live="polite">
            {permissionCheck === "ready" ? <CheckCircle size={14} weight="fill" /> : <ArrowClockwise className={permissionCheck === "checking" ? "update-spinner" : ""} size={14} />}
          </button>
        </div>
        {!permissionStatus.clipboardCapture && <PermissionIssue title={t("permission.capture")} detail={t("permission.captureOff")} />}
        {!permissionStatus.accessibility && <PermissionIssue title={t("permission.autoPaste")} detail={t("permission.accessibilityNeeded")} action={<button onClick={onOpenAccessibility}>{t("permission.fix")}</button>} />}
        {!permissionStatus.screenCapture && <PermissionIssue title={t("permission.screenCapture")} detail={t("permission.screenCaptureNeeded")} action={<button onClick={onRequestScreenCapture}>{t("permission.allow")}</button>} />}
        {permissionCheck === "needed" && <div className="permission-repair"><small>{t("permission.staleGrantHint")}</small><button onClick={repairPermissions}>{t("permission.repair")}</button></div>}
      </section>

      <section className="settings-section">
        <div className="settings-card">
          <SelectRow title={t("settings.language")} value={settings.language} onChange={(value) => update({ language: value })}>
            <option value="auto">{t("settings.auto")}</option><option value="en">{t("settings.english")}</option><option value="zh-CN">{t("settings.chinese")}</option>
          </SelectRow>
          <ToggleRow title={t("settings.capture")} checked={settings.captureEnabled} onChange={(value) => update({ captureEnabled: value })} />
          <ToggleRow title={t("settings.directPaste")} checked={settings.directPaste} onChange={(value) => update({ directPaste: value })} />
          <ToggleRow title={t("settings.launch")} checked={settings.launchAtLogin} onChange={(value) => update({ launchAtLogin: value })} />
        </div>
      </section>

      </>}

      {section === "privacy" && <>
      <section className="settings-section">
        <div className="settings-card">
          <ToggleRow title={t("settings.ignorePasswords")} checked={settings.excludeSensitiveApps} onChange={(value) => update({ excludeSensitiveApps: value })} />
          <SelectRow title={t("settings.historyLimit")} value={settings.historyLimit} onChange={(value) => update({ historyLimit: Number(value) })}>
            <option value="100">100</option><option value="500">500</option><option value="1000">1,000</option><option value="5000">5,000</option>
          </SelectRow>
          <SelectRow title={t("settings.keepHistory")} value={settings.retentionDays} onChange={(value) => update({ retentionDays: Number(value) })}>
            <option value="7">{t("settings.days", { count: 7 })}</option><option value="30">{t("settings.days", { count: 30 })}</option><option value="90">{t("settings.days", { count: 90 })}</option><option value="0">{t("settings.forever")}</option>
          </SelectRow>
        </div>
      </section>
      <button className="clear-history" onClick={onClear}><Trash size={16} /> {t("settings.clear")}</button>
      </>}

      {section === "appearance" &&
      <section className="settings-section">
        <div className="settings-card">
          <ToggleRow title={t("settings.reduceMotion")} checked={settings.reduceMotion} onChange={(value) => update({ reduceMotion: value })} />
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

function PermissionPill({ label, ready }) {
  return <span className={ready ? "ready" : "needed"} title={label}>{ready ? <CheckCircle size={12} weight="fill" /> : <WarningCircle size={12} weight="fill" />}<span>{label}</span></span>;
}

function PermissionIssue({ title, detail, action }) {
  return <div className="permission-issue"><WarningCircle size={15} weight="fill" /><span><strong>{title}</strong><small>{detail}</small></span>{action}</div>;
}
