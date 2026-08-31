import { useEffect, useState } from "react";
import { ArrowsClockwise, CheckCircle, DownloadSimple, WarningCircle } from "@phosphor-icons/react";
import { useAppUpdater } from "../hooks/useAppUpdater.js";
import { createI18n } from "../i18n.js";
import { moteApi } from "../services/moteApi.js";

export function AboutWindow() {
  const updater = useAppUpdater();
  const [language, setLanguage] = useState("auto");
  const { t } = createI18n(language);

  useEffect(() => {
    moteApi.getSettings().then((settings) => setLanguage(settings.language ?? "auto")).catch(() => {});
  }, []);

  const checking = updater.status === "checking";
  const downloading = updater.status === "downloading";
  const restarting = updater.status === "restarting";
  const available = updater.status === "available";
  const failed = updater.status === "error";
  const busy = checking || downloading || restarting;

  const statusText = failed
    ? t("about.checkFailed")
    : available
      ? t("about.available", { version: updater.nextVersion })
      : downloading
        ? t("about.downloading", { progress: updater.progress })
        : restarting
          ? t("about.restarting")
          : checking
            ? t("about.checking")
            : t("about.upToDate");

  const actionText = available
    ? t("about.install")
    : failed
      ? t("about.retry")
      : checking
        ? t("about.checkingAction")
        : downloading
          ? t("about.downloading", { progress: updater.progress })
          : restarting
            ? t("about.restarting")
            : t("about.check");

  const handleAction = () => {
    if (available) return updater.installUpdate();
    if (!busy) return updater.checkForUpdates();
    return undefined;
  };

  return (
    <main className="about-stage">
      <div className="about-drag-region" data-tauri-drag-region />
      <section className="about-content" aria-labelledby="about-title">
        <div className="about-identity">
          <img src="/assets/mote-logo.png" alt="" />
          <h1 id="about-title">Mote</h1>
        </div>
        <p className="about-tagline">{t("about.tagline")}</p>
        <div className="about-divider" />
        <div className="about-version">
          <strong>{t("about.version", { version: updater.currentVersion })}</strong>
          <span className={failed ? "failed" : available ? "available" : ""}>
            {failed ? <WarningCircle size={17} weight="regular" /> : available ? <DownloadSimple size={17} weight="regular" /> : busy ? <ArrowsClockwise className="about-spinner" size={17} /> : <CheckCircle size={17} weight="regular" />}
            {statusText}
          </span>
        </div>
        <button className="about-update-action" type="button" disabled={busy} onClick={handleAction}>
          {actionText}
        </button>
        <small>{t("about.copyright")}</small>
      </section>
    </main>
  );
}
