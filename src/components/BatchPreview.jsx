import { Stack } from "@phosphor-icons/react";
import { BatchQueueItem, batchPreviewKind } from "./batch/BatchQueueItem.jsx";

export function BatchPreview({ items, onMoveItem, t }) {
  const visualItems = items.filter((item) => ["image", "compound", "color"].includes(batchPreviewKind(item))).length;
  const layout = items.length <= 8 && visualItems >= Math.ceil(items.length / 2) ? "visual" : items.length <= 4 ? "comfortable" : "list";
  return (
    <section className={`batch-preview batch-layout-${layout}`} aria-live="polite">
      <header className="batch-preview-header">
        <span className="batch-preview-icon"><Stack size={24} weight="duotone" /></span>
        <div>
          <p className="preview-type">{t("multi.label")}</p>
          <h2>{items.length ? t(items.length === 1 ? "multi.countTitle" : "multi.countTitlePlural", { count: items.length }) : t("multi.emptyTitle")}</h2>
          <p className="batch-preview-intro">{t("multi.explainer")}</p>
        </div>
      </header>
      {items.length > 0 && <ol className="batch-preview-content">{items.map((item, index) => (
        <BatchQueueItem item={item} order={index + 1} isFirst={index === 0} isLast={index === items.length - 1} onMoveUp={() => onMoveItem(item.id, -1)} onMoveDown={() => onMoveItem(item.id, 1)} t={t} key={item.id} />
      ))}</ol>}
      <div className="batch-shortcuts"><span><kbd>⌥ ↑ ↓</kbd> {t("multi.reorder")}</span><span><kbd>{t("key.space")}</kbd> {t("multi.addRemove")}</span><span><kbd>↵</kbd> {t("multi.paste")}</span></div>
    </section>
  );
}
