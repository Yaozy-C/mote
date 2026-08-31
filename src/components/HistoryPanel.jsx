import { CheckSquare, MagnifyingGlass, PushPin, WarningCircle, X } from "@phosphor-icons/react";
import { TypeBadge } from "./TypeBadge.jsx";
import { localizedItemDetail } from "../i18n.js";

export function HistoryPanel({ items, selectedId, onSelect, loading, error, batchMode = false, batchSelectedIds = [], onStartBatch, onCancelBatch, onToggleBatch, toggleShortcut, t, locale }) {
  if (loading) return <aside className="history-panel" aria-label={t("history.label")}><div className="empty-state"><strong>{t("history.loading")}</strong></div></aside>;
  if (error) return <aside className="history-panel" aria-label={t("history.label")}><div className="empty-state"><strong>{t("history.unavailable")}</strong><span>{error}</span></div></aside>;
  const queueOrder = batchSelectedIds;

  return (
    <aside className="history-panel" aria-label={t("history.label")}>
      <div className="history-toolbar">
        <span>{batchMode ? t("history.selectedCount", { count: batchSelectedIds.length }) : t("history.label")}</span>
        <button className={batchMode ? "active" : ""} onClick={batchMode ? onCancelBatch : onStartBatch}>{batchMode ? <X size={15} /> : <CheckSquare size={16} />}{batchMode ? t("action.cancel") : t("history.select")}<kbd>{toggleShortcut}</kbd></button>
      </div>
      {["today", "earlier"].map((group) => {
        const groupItems = items.filter((item) => itemGroup(item) === group);
        if (!groupItems.length) return null;
        return <div className="history-group" key={group}><h2>{t(`history.${group}`)}</h2>{groupItems.map((item, itemIndex) => (
          <button style={{ "--item-order": itemIndex }} data-item-id={item.id} aria-pressed={batchMode ? batchSelectedIds.includes(item.id) : undefined} className={`history-item ${item.kind === "image" ? "image-item" : ""} ${batchMode ? "batch-mode" : ""} ${batchMode && selectedId === item.id ? "batch-current" : ""} ${batchMode ? batchSelectedIds.includes(item.id) ? "batch-selected" : "" : selectedId === item.id ? "selected" : ""}`} key={item.id} onClick={() => batchMode ? onToggleBatch(item.id) : onSelect(item.id)}>
            {batchMode && <span className="batch-check">{batchSelectedIds.includes(item.id) && queueOrder.indexOf(item.id) + 1}</span>}
            <TypeBadge item={item} />
            <span className="item-copy"><strong>{item.title}</strong><span className={item.missingFiles ? "missing-detail" : ""}>{item.missingFiles && <WarningCircle size={13} weight="fill" />}{item.missingFiles ? t("detail.fileMissing") : localizedItemDetail(item, t)}{item.sourceAppName ? ` · ${item.sourceAppName}` : ""}</span>{itemGroup(item) === "today" && <span>{itemTime(item, t, locale)}</span>}</span>
            {item.pinned && <PushPin className="pin-indicator" size={14} weight="fill" />}
            {itemGroup(item) === "earlier" && <time>{itemTime(item, t, locale)}</time>}
          </button>
        ))}</div>;
      })}
      {!items.length && <div className="empty-state"><MagnifyingGlass size={28} /><strong>{t("history.noMatches")}</strong><span>{t("history.tryDifferent")}</span></div>}
    </aside>
  );
}

function itemGroup(item) {
  return new Date(item.createdAt).toDateString() === new Date().toDateString() ? "today" : "earlier";
}

function itemTime(item, t, locale) {
  const value = new Date(item.createdAt);
  if (itemGroup(item) === "today") return new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(value);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return value.toDateString() === yesterday.toDateString() ? t("history.yesterday") : value.toLocaleDateString(locale, { month: "short", day: "numeric" });
}
