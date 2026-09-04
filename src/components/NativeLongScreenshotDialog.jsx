import { useEffect, useState } from "react";
import {
  IconArrowDown,
  IconCheck,
  IconDeviceDesktop,
  IconLockAccess,
  IconMouse,
  IconX,
} from "@tabler/icons-react";
import { moteApi } from "../services/moteApi.js";

export function NativeLongScreenshotDialog({ permissionStatus, onClose, onCapture, onOpenAccessibility, onRefreshPermissions, onRepairPermissions, t }) {
  const [target, setTarget] = useState(null);
  const [targetError, setTargetError] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [maxSteps, setMaxSteps] = useState(36);
  const [permissionRequested, setPermissionRequested] = useState(false);
  const [repairing, setRepairing] = useState(false);

  useEffect(() => {
    moteApi.getLongScreenshotTarget().then(setTarget).catch((error) => setTargetError(String(error).replace(/^clipboard error:\s*/i, "")));
  }, []);

  const start = async () => {
    setCapturing(true);
    try {
      await onCapture(maxSteps);
      onClose();
    } catch {
      // The parent presents the native error while keeping this dialog available to retry.
    } finally {
      setCapturing(false);
    }
  };

  const requestScreen = async () => {
    await moteApi.requestScreenCaptureAccess();
    setPermissionRequested(true);
    await onRefreshPermissions();
  };

  const requestAccessibility = async () => {
    await onOpenAccessibility();
    setPermissionRequested(true);
  };

  const repairPermissions = async () => {
    setRepairing(true);
    try {
      await onRepairPermissions();
    } catch {
      // The parent shows the native repair error.
    } finally {
      setRepairing(false);
    }
  };

  const ready = permissionStatus.accessibility && permissionStatus.screenCapture && target && !targetError;
  return <div className="native-capture-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !capturing && onClose()}>
    <section className="native-capture-dialog" role="dialog" aria-modal="true" aria-labelledby="native-capture-title">
      <button className="native-capture-close" disabled={capturing} onClick={onClose} aria-label={t("screenshot.cancel")}><IconX size={18} stroke={1.8} /></button>
      <header>
        <span><IconArrowDown size={24} stroke={1.7} /></span>
        <div><p>{t("screenshot.nativeEyebrow")}</p><h2 id="native-capture-title">{t("screenshot.nativeTitle")}</h2><small>{t("screenshot.nativeIntro")}</small></div>
      </header>

      <div className="native-target-card">
        <span><IconDeviceDesktop size={23} stroke={1.6} /></span>
        <div><small>{t("screenshot.targetWindow")}</small><strong>{target?.name || (targetError ? t("screenshot.noTarget") : t("screenshot.findingTarget"))}</strong><p>{targetError || target?.bundleId}</p></div>
        {target && <IconCheck className="native-ready-check" size={19} stroke={2} />}
      </div>

      <div className="native-capture-permissions">
        <PermissionLine icon={<IconMouse size={18} stroke={1.7} />} title={t("permission.accessibilityCapture")} ready={permissionStatus.accessibility} action={!permissionStatus.accessibility && <button onClick={requestAccessibility}>{t("permission.fix")}</button>} t={t} />
        <PermissionLine icon={<IconLockAccess size={18} stroke={1.7} />} title={t("permission.screenCapture")} ready={permissionStatus.screenCapture} action={!permissionStatus.screenCapture && <button onClick={requestScreen}>{t("permission.allow")}</button>} t={t} />
      </div>
      {permissionRequested && (!permissionStatus.accessibility || !permissionStatus.screenCapture) && <div className="native-permission-repair"><span>{t("permission.staleGrantHint")}</span><button disabled={repairing} onClick={repairPermissions}>{repairing ? t("permission.checking") : t("permission.repair")}</button></div>}

      <label className="native-capture-length"><span><strong>{t("screenshot.maxLength")}</strong><small>{t("screenshot.maxLengthDetail")}</small></span><select value={maxSteps} onChange={(event) => setMaxSteps(Number(event.target.value))}><option value="18">{t("screenshot.lengthShort")}</option><option value="36">{t("screenshot.lengthStandard")}</option><option value="64">{t("screenshot.lengthLong")}</option></select></label>
      <p className="native-capture-note">{t("screenshot.nativeHint")}</p>
      <footer><button disabled={capturing} onClick={onClose}>{t("action.cancel")}</button><button className="native-capture-start" disabled={!ready || capturing} onClick={start}>{capturing ? t("screenshot.nativeCapturing") : t("screenshot.startReal")}</button></footer>
    </section>
  </div>;
}

function PermissionLine({ icon, title, ready, action, t }) {
  return <div><span>{icon}</span><strong>{title}</strong><small className={ready ? "ready" : "needed"}>{ready ? t("permission.ready") : t("permission.required")}</small>{action}</div>;
}
