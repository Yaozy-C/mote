import { ArrowsClockwise, CheckCircle, DownloadSimple } from "@phosphor-icons/react";

export function UpdateDialog({ updater, t }) {
  const busy = updater.status === "downloading" || updater.status === "restarting";
  const failed = updater.status === "error";
  if (!updater.nextVersion && !failed) return null;

  return (
    <div className="update-backdrop" role="presentation">
      <section className="update-dialog" role="dialog" aria-modal="true" aria-labelledby="update-title">
        <div className="update-heading">
          <div className={`update-icon ${failed ? "failed" : ""}`}>
            {updater.status === "restarting" ? <CheckCircle size={19} weight="fill" /> : <DownloadSimple size={18} weight="regular" />}
          </div>
          <h2 id="update-title">{failed ? t("update.failedTitle") : t("update.title", { version: updater.nextVersion })}</h2>
        </div>
        <p className="update-detail">
          {failed ? t("update.failedDetail") : updater.status === "restarting" ? t("update.restarting") : updater.notes || t("update.detail")}
        </p>
        {busy && <div className="update-progress" aria-label={t("update.progress", { progress: updater.progress })}><span style={{ width: `${updater.progress || 4}%` }} /></div>}
        <div className="update-actions">
          {!busy && <button className="update-later" onClick={updater.dismiss}>{t("update.later")}</button>}
          <button className="update-install" disabled={busy && updater.status === "restarting"} onClick={failed ? () => updater.checkForUpdates() : updater.installUpdate}>
            {busy ? <ArrowsClockwise className="update-spinner" size={16} /> : <DownloadSimple size={16} />}
            {failed ? t("update.retry") : updater.status === "downloading" ? t("update.downloading", { progress: updater.progress }) : updater.status === "restarting" ? t("update.restartingShort") : t("update.install")}
          </button>
        </div>
      </section>
    </div>
  );
}
