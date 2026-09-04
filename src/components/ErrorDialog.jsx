import { GearSix, WarningCircle } from "@phosphor-icons/react";

export function ErrorDialog({ message, onClose, onOpenAccessibility, onOpenScreenCapture, t }) {
  const isAccessibilityError = message.toLowerCase().includes("accessibility");
  const isScreenCaptureError = /screen (recording|capture)/i.test(message);
  const rawDetail = message.replace(/^clipboard error:\s*/i, "");
  const detail = isAccessibilityError ? t("error.accessibilityDetail")
    : /different shortcuts|different key combination/i.test(message) ? t("error.shortcutDifferent")
    : /could not register/i.test(message) ? t("error.shortcutRegister")
    : /invalid .* shortcut/i.test(message) ? t("error.shortcutInvalid")
    : rawDetail;

  return (
    <div className="error-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="error-dialog" role="alertdialog" aria-modal="true" aria-labelledby="error-title" aria-describedby="error-detail">
        <span className="error-icon"><WarningCircle size={20} weight="fill" /></span>
        <div>
          <h2 id="error-title">{isAccessibilityError ? t("error.pasteTitle") : t("error.genericTitle")}</h2>
          <p id="error-detail" className="error-detail">{detail}</p>
        </div>
        <div className="error-actions">
          {(isAccessibilityError || isScreenCaptureError) && <button className="error-settings" onClick={isScreenCaptureError ? onOpenScreenCapture : onOpenAccessibility}><GearSix size={18} /> {t("error.openSettings")}</button>}
          <button className="error-dismiss" onClick={onClose}>{t("error.dismiss")}</button>
        </div>
      </section>
    </div>
  );
}
