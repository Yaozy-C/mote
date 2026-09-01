import { useEffect, useMemo, useState } from "react";
import { IconArrowBackUp, IconChevronLeft, IconChevronRight, IconClipboard, IconColorPicker, IconFile, IconPinned, IconSearch, IconSparkles, IconStack2, IconScreenshot, IconX } from "@tabler/icons-react";
import { formatShortcut, primaryModifierLabel } from "../utils/shortcuts.js";

export function HelpDialog({ onClose, settings, permissionStatus, onOpenAccessibility, t, locale }) {
  const pages = useMemo(() => helpTopics(helpPages(settings, permissionStatus, onOpenAccessibility, t, locale), t), [settings, permissionStatus, onOpenAccessibility, t, locale]);
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
  return <div className="help-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="tips-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <button className="help-close" onClick={onClose} aria-label={t("help.close")}><IconX size={18} stroke={1.75} /></button>
      <header className="tips-topbar"><strong>{t("help.guide")}</strong><span>{index + 1} / {pages.length}</span></header>
      <main className="tips-content" key={page.id}>
        <h2 id="help-title">{page.label}</h2>
        <div className="tip-feature-list">
          {page.features.map((feature) => <TipFeature key={feature.id} feature={feature} />)}
        </div>
      </main>
      <footer className="tips-navigation">
        <button onClick={() => move(-1)} aria-label={t("help.previous")}><IconChevronLeft size={20} stroke={1.8} /></button>
        <div className="tips-dots" aria-label={t("help.pages")}>{pages.map((item, itemIndex) => <button key={item.id} className={itemIndex === index ? "active" : ""} onClick={() => setIndex(itemIndex)} aria-label={`${itemIndex + 1}`} />)}</div>
        <button onClick={() => move(1)} aria-label={t("help.next")}><IconChevronRight size={20} stroke={1.8} /></button>
      </footer>
    </section>
  </div>;
}

function TipFeature({ feature }) {
  const FeatureIcon = feature.icon;
  return <article className="tip-feature">
    <span className="tip-feature-icon"><FeatureIcon size={19} stroke={1.65} /></span>
    <div className="tip-feature-copy"><strong>{feature.title}</strong><p>{feature.body}</p>{feature.shortcut && <kbd>{feature.shortcut}</kbd>}{feature.action}</div>
    <div className="tip-feature-example">{feature.example}</div>
  </article>;
}

function helpTopics(features, t) {
  return [
    { id: "start", label: t("help.topicStart"), features: features.slice(0, 3) },
    { id: "content", label: t("help.topicContent"), features: features.slice(3, 7) },
    { id: "capture", label: t("help.screenshotTitle"), features: features.slice(7, 8) },
    { id: "multiple", label: t("help.topicMultiple"), features: features.slice(8, 10) },
    { id: "manage", label: t("help.topicManage"), features: features.slice(10) },
  ];
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
