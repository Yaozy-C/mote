import { Trash, X } from "@phosphor-icons/react";

export function ClearHistoryDialog({ busy, onCancel, onConfirm, t }) {
  return (
    <div className="confirm-backdrop" role="presentation" onMouseDown={(event) => !busy && event.target === event.currentTarget && onCancel()}>
      <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="clear-history-title" aria-describedby="clear-history-detail">
        {!busy && <button className="confirm-close" onClick={onCancel} aria-label={t("confirm.cancel")}><X size={16} /></button>}
        <span className="confirm-icon"><Trash size={24} weight="fill" /></span>
        <h2 id="clear-history-title">{t("confirm.clearTitle")}</h2>
        <p id="clear-history-detail">{t("confirm.clearDetail")}</p>
        <div className="confirm-actions">
          <button className="confirm-cancel" disabled={busy} onClick={onCancel}>{t("confirm.cancel")}</button>
          <button className="confirm-delete" disabled={busy} onClick={onConfirm}>{busy ? t("confirm.clearing") : t("confirm.clearAction")}</button>
        </div>
      </section>
    </div>
  );
}
