import { IconArrowBackUp } from "@tabler/icons-react";

export function UndoToast({ count, onUndo, t }) {
  return <div className="undo-toast" role="status">
    <span>{t(count === 1 ? "undo.deletedOne" : "undo.deletedMany", { count })}</span>
    <button onClick={onUndo}><IconArrowBackUp size={16} stroke={1.75} />{t("undo.action")}</button>
  </div>;
}
