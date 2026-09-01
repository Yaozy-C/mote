import { useEffect, useMemo, useState } from "react";
import { IconArrowBackUp, IconChevronLeft, IconChevronRight, IconClipboard, IconColorPicker, IconFile, IconPinned, IconSearch, IconSparkles, IconStack2, IconScreenshot, IconX } from "@tabler/icons-react";
import { formatShortcut, primaryModifierLabel } from "../utils/shortcuts.js";

export function HelpDialog({ onClose, settings, permissionStatus, onOpenAccessibility, t, locale }) {
  const pages = useMemo(() => helpPages(settings, permissionStatus, onOpenAccessibility, t, locale), [settings, permissionStatus, onOpenAccessibility, t, locale]);
  const [index, setIndex] = useState(0);
  const page = pages[index];
  const move = (direction) => setIndex((current) => (current + direction + pages.length) % pages.length);
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); move(-1); }
      if (event.key === "ArrowRight") { event.preventDefault(); move(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages.length]);
  const PageIcon = page.icon;
  return <div className="help-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="tips-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <button className="help-close" onClick={onClose} aria-label={t("help.close")}><IconX size={18} stroke={1.75} /></button>
      <header className="tips-topbar"><img src="/assets/mote-logo.png" alt="" /><div><strong>{t("help.guide")}</strong><small>{t("help.guideSubtitle")}</small></div><span>{index + 1} / {pages.length}</span></header>
      <main className="tips-content" key={page.id}>
        <div className="tip-page-icon"><PageIcon size={30} stroke={1.6} /></div>
        <p className="tip-page-eyebrow">{page.eyebrow}</p>
        <h2 id="help-title">{page.title}</h2>
        <p className="tip-page-body">{page.body}</p>
        {page.shortcut && <kbd className="tip-page-shortcut">{page.shortcut}</kbd>}
        <div className="tip-page-example">{page.example}</div>
        {page.action}
      </main>
      <footer className="tips-navigation">
        <button onClick={() => move(-1)} aria-label={t("help.previous")}><IconChevronLeft size={20} stroke={1.8} /></button>
        <div className="tips-dots" aria-label={t("help.pages")}>{pages.map((item, itemIndex) => <button key={item.id} className={itemIndex === index ? "active" : ""} onClick={() => setIndex(itemIndex)} aria-label={`${itemIndex + 1}`} />)}</div>
        <button onClick={() => move(1)} aria-label={t("help.next")}><IconChevronRight size={20} stroke={1.8} /></button>
      </footer>
    </section>
  </div>;
}

function helpPages(settings, permissionStatus, onOpenAccessibility, t, locale) {
  const primary = "Meta";
  return [
    page("copy", IconClipboard, t("help.quickStart"), t("help.copyTitle"), t("help.copyBody"), formatShortcut(`${primary}+KeyC`, locale), <div className="example-clipping"><span>T</span><div><strong>{t("help.exampleText")}</strong><small>{t("help.exampleSaved")}</small></div></div>),
    page("find", IconSearch, t("help.quickStart"), t("help.findTitle"), t("help.findBody"), formatShortcut(settings.openShortcut, locale), <div className="example-search"><IconSearch size={17} /><span>{t("help.exampleSearch")}</span><kbd>{primaryModifierLabel()}K</kbd></div>),
    page("paste", IconClipboard, t("help.quickStart"), t("help.pasteTitle"), t("help.pasteBody"), "↵", <div className="example-button"><IconClipboard size={17} />{t("action.paste")}</div>),
    page("combined", IconStack2, t("help.contentEyebrow"), t("help.combinedTitle"), t("help.combinedBody"), null, <div className="example-combined"><img src="/assets/source-reference.png" alt="" /><div><strong>{t("help.exampleCombined")}</strong><small>{t("help.exampleOneRecord")}</small></div></div>),
    page("ocr", IconSparkles, t("help.contentEyebrow"), t("help.ocrTitle"), t("help.ocrBody"), null, <div className="example-ocr"><IconSparkles size={20} /><div><strong>Orange dahlia…</strong><small>{t("help.ocrDerived")}</small></div></div>),
    page("color", IconColorPicker, t("help.contentEyebrow"), t("help.colorsTitle"), t("help.colorsBody"), formatShortcut(settings.colorShortcut, locale), <div className="example-colors">{["#F08A63", "#E9B872", "#6E8C76", "#4A6078"].map((color) => <span key={color} style={{ background: color }} title={color} />)}</div>),
    page("actions", IconFile, t("help.contentEyebrow"), t("help.actionsTitle"), t("help.actionsBody"), null, <div className="example-actions"><span>{t("action.openLink")}</span><span>{t("action.showInFinder")}</span><span>{t("action.copyHex")}</span></div>),
    page("screenshot", IconScreenshot, t("screenshot.nativeEyebrow"), t("help.screenshotTitle"), t("help.screenshotBody"), formatShortcut(settings.screenshotShortcut, locale), <div className="example-screenshot"><IconScreenshot size={23} /><div><strong>{t("screenshot.ready")}</strong><small>{t("screenshot.startAuto")}</small></div><span>36</span></div>),
    page("multiple", IconStack2, t("multi.label"), t("help.multiSelectTitle"), t("help.multiBody", { shortcut: formatShortcut(settings.toggleBatchShortcut, locale) }), formatShortcut(settings.batchShortcut, locale), <div className="example-queue">{[1, 2, 3].map((number) => <span key={number}><b>{number}</b>{t(`help.queue${number}`)}</span>)}</div>),
    page("order", IconStack2, t("multi.label"), t("help.orderTitle"), t("help.orderBody"), `${formatShortcut("Alt+ArrowUp", locale)} / ${formatShortcut("Alt+ArrowDown", locale)}`, <div className="example-flow"><span>1</span><i>→</i><span>2</span><i>→</i><span>3</span></div>),
    page("pin", IconPinned, t("help.manageEyebrow"), t("help.pinTitle"), t("help.pinBody"), null, <div className="example-actions"><span><IconPinned size={16} />{t("action.pin")}</span></div>),
    page("undo", IconArrowBackUp, t("help.manageEyebrow"), t("help.undoTitle"), t("help.undoBody"), null, <div className="example-toast"><span>{t("undo.deletedOne")}</span><b><IconArrowBackUp size={15} />{t("undo.action")}</b></div>),
    page("missing", IconFile, t("help.manageEyebrow"), t("help.missingTitle"), t("help.missingBody"), null, <div className="example-missing"><IconFile size={18} /><span>project-final.pdf</span><b>{t("detail.fileMissing")}</b></div>),
    { ...page("permissions", IconClipboard, t("settings.permissions"), t("help.permissionTitle"), t("help.permissionIntro"), null, <div className="example-permissions"><StatusExample label={t("permission.capture")} ready={permissionStatus.clipboardCapture} needed={t("permission.captureOff")} t={t} /><StatusExample label={t("permission.autoPaste")} ready={permissionStatus.accessibility} needed={t("permission.accessibilityNeeded")} t={t} /></div>), action: !permissionStatus.accessibility && <button className="tip-action" onClick={onOpenAccessibility}>{t("permission.fix")}</button> },
    page("privacy", IconPinned, t("help.private"), t("help.private"), t("help.privateBody"), null, <div className="example-private"><span>●</span>{t("help.exampleLocal")}</div>),
  ];
}

function page(id, icon, eyebrow, title, body, shortcut, example) { return { id, icon, eyebrow, title, body, shortcut, example }; }

function StatusExample({ label, ready, needed, t }) {
  return <div className={`example-status ${ready ? "ready" : "needed"}`}><span /><strong>{label}</strong><small>{ready ? t("permission.ready") : needed}</small></div>;
}
