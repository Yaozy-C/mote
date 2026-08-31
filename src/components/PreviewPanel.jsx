import { IconCheck, IconClipboard, IconClipboardText, IconCopy, IconPinned, IconStack2, IconTrash } from "@tabler/icons-react";
import { BatchPreview } from "./BatchPreview.jsx";
import { DetailPreview } from "./DetailPreview.jsx";
import { isWindowsPlatform, primaryModifierLabel } from "../utils/shortcuts.js";

export function PreviewPanel({ history, actionDone, t, locale, onError, onPaste, onCopy, onPlainText, onPin, onDelete }) {
  const primaryLabel = actionDone
    ? actionDone.type === "copied" ? t("action.copied") : actionDone.count > 1 ? t("action.pastedCount", { count: actionDone.count }) : t("action.pasted")
    : history.settings.directPaste ? t("action.paste") : t("action.copy");
  return <section className="preview-panel" aria-live="polite">
    <div className="preview-scroll"><div className="preview-transition" key={history.batchMode ? `batch-${history.batchSelectedIds.join("-")}` : history.selectedId ?? "empty"}>
      {history.batchMode ? <BatchPreview items={history.batchSelectedItems} onMoveItem={history.moveBatchItem} t={t} /> : history.selected ? <DetailPreview item={history.selected} t={t} locale={locale} onError={onError} /> : <div className="empty-state"><strong>{t("empty.clipboard")}</strong></div>}
    </div></div>
    {history.batchMode ? <footer className="preview-actions batch-actions">
      <button className="primary-action" disabled={!history.batchSelectedItems.length} onClick={onPaste}><IconStack2 size={18} stroke={1.75} /> {t("multi.pasteCount", { count: history.batchSelectedItems.length || "" })}<kbd>↵</kbd></button>
      <button onClick={history.selectAllBatch}>{t("action.selectAll")}</button>
      <button onClick={history.cancelBatchSelection}>{t("action.cancel")}</button>
    </footer> : history.selected && <footer className="preview-actions">
      <button className={`primary-action ${actionDone ? "copied" : ""}`} onClick={history.settings.directPaste ? onPaste : onCopy}>
        {actionDone ? <IconCheck size={18} stroke={2} /> : history.settings.directPaste ? <IconClipboard size={18} stroke={1.75} /> : <IconCopy size={18} stroke={1.75} />}{primaryLabel}
        <kbd>{history.settings.directPaste ? (isWindowsPlatform() ? "Enter" : "↵") : `${primaryModifierLabel()} ${isWindowsPlatform() ? "Enter" : "↵"}`}</kbd>
      </button>
      <button disabled={history.selected.kind === "image" && !history.selected.ocrText} onClick={onPlainText} title={history.selected.kind === "image" ? t("ocr.derived") : t("action.plainTextHint")}><IconClipboardText size={18} stroke={1.75} />{history.selected.kind === "image" ? (history.settings.directPaste ? t("ocr.pasteText") : t("ocr.copyText")) : history.settings.directPaste ? t("action.pastePlainText") : t("action.copyPlainText")}</button>
      <button onClick={onPin} className={history.selected.pinned ? "active" : ""}><IconPinned size={18} stroke={1.75} />{history.selected.pinned ? t("action.pinned") : t("action.pin")}</button>
      <button className="delete-action" onClick={onDelete}><IconTrash size={18} stroke={1.75} /> {t("action.delete")}</button>
    </footer>}
  </section>;
}
