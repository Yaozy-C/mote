import { useMemo, useState } from "react";
import { IconArrowBackUp, IconClipboard, IconColorPicker, IconFile, IconPinned, IconSearch, IconSparkles, IconStack2, IconX } from "@tabler/icons-react";
import { formatShortcut, isWindowsPlatform, primaryModifierLabel } from "../utils/shortcuts.js";

export function HelpDialog({ onClose, settings, permissionStatus, onOpenAccessibility, t, locale }) {
  const topics = useMemo(() => helpTopics(settings, permissionStatus, onOpenAccessibility, t, locale), [settings, permissionStatus, onOpenAccessibility, t, locale]);
  const [selected, setSelected] = useState("start");
  const topic = topics.find((value) => value.id === selected) ?? topics[0];
  return <div className="help-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className="tips-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
      <button className="help-close" onClick={onClose} aria-label={t("help.close")}><IconX size={18} stroke={1.75} /></button>
      <aside className="tips-sidebar">
        <header><img src="/assets/mote-logo.png" alt="" /><div><strong>{t("help.guide")}</strong><small>{t("help.guideSubtitle")}</small></div></header>
        <nav>{topics.map(({ id, icon: Icon, label }) => <button className={selected === id ? "active" : ""} key={id} onClick={() => setSelected(id)}><Icon size={17} stroke={1.7} />{label}</button>)}</nav>
        <p>{t("help.privateBody")}</p>
      </aside>
      <main className="tips-content">
        <header className="tips-heading"><p>{topic.eyebrow}</p><h2 id="help-title">{topic.title}</h2><span>{topic.intro}</span></header>
        <div className="tips-grid">{topic.tips.map((tip) => <TipCard key={tip.title} {...tip} />)}</div>
      </main>
    </section>
  </div>;
}

function TipCard({ icon: Icon, title, body, shortcut, example, action }) {
  return <article className="tip-card"><div className="tip-card-title"><span><Icon size={19} stroke={1.7} /></span>{shortcut && <kbd>{shortcut}</kbd>}</div><h3>{title}</h3><p>{body}</p><div className="tip-example">{example}</div>{action}</article>;
}

function helpTopics(settings, permissionStatus, onOpenAccessibility, t, locale) {
  return [
    { id: "start", icon: IconClipboard, label: t("help.topicStart"), eyebrow: t("help.quickStart"), title: t("help.startTitle"), intro: t("help.startIntro"), tips: [
      { icon: IconClipboard, title: t("help.copyTitle"), body: t("help.copyBody"), shortcut: `${primaryModifierLabel()}${isWindowsPlatform() ? "+" : " "}C`, example: <div className="example-clipping"><span>T</span><div><strong>{t("help.exampleText")}</strong><small>{t("help.exampleSaved")}</small></div></div> },
      { icon: IconSearch, title: t("help.findTitle"), body: t("help.findBody"), shortcut: formatShortcut(settings.openShortcut, locale), example: <div className="example-search"><IconSearch size={15} /><span>{t("help.exampleSearch")}</span><kbd>{primaryModifierLabel()}K</kbd></div> },
      { icon: IconClipboard, title: t("help.pasteTitle"), body: t("help.pasteBody"), shortcut: "↵", example: <div className="example-button"><IconClipboard size={15} />{t("action.paste")}</div> },
    ]},
    { id: "content", icon: IconColorPicker, label: t("help.topicContent"), eyebrow: t("help.contentEyebrow"), title: t("help.contentTitle"), intro: t("help.contentIntro"), tips: [
      { icon: IconStack2, title: t("help.combinedTitle"), body: t("help.combinedBody"), example: <div className="example-combined"><img src="/assets/source-reference.png" alt="" /><div><strong>{t("help.exampleCombined")}</strong><small>{t("help.exampleOneRecord")}</small></div></div> },
      { icon: IconSparkles, title: t("help.ocrTitle"), body: t("help.ocrBody"), example: <div className="example-ocr"><IconSparkles size={16} /><div><strong>Orange dahlia…</strong><small>{t("help.ocrDerived")}</small></div></div> },
      { icon: IconColorPicker, title: t("help.colorsTitle"), body: t("help.colorsBody"), example: <div className="example-colors">{["#F08A63", "#E9B872", "#6E8C76", "#4A6078"].map((color) => <span key={color} style={{ background: color }} title={color} />)}</div> },
    ]},
    { id: "multiple", icon: IconStack2, label: t("help.topicMultiple"), eyebrow: t("multi.label"), title: t("help.multiTitle"), intro: t("help.multiIntro"), tips: [
      { icon: IconStack2, title: t("help.multiSelectTitle"), body: t("help.multiBody", { shortcut: formatShortcut(settings.toggleBatchShortcut, locale) }), shortcut: formatShortcut(settings.batchShortcut, locale), example: <div className="example-queue">{[1, 2, 3].map((number) => <span key={number}><b>{number}</b>{t(`help.queue${number}`)}</span>)}</div> },
      { icon: IconClipboard, title: t("help.orderTitle"), body: t("help.orderBody"), example: <div className="example-flow"><span>1</span><i>→</i><span>2</span><i>→</i><span>3</span></div> },
      { icon: IconStack2, title: t("help.nativePasteTitle"), body: t("help.nativePasteBody"), example: <div className="example-actions"><span><IconClipboard size={14} />{t("type.text")}</span><span><IconFile size={14} />{t("type.files")}</span><span><IconStack2 size={14} />{t("type.image")}</span></div> },
    ]},
    { id: "manage", icon: IconPinned, label: t("help.topicManage"), eyebrow: t("help.manageEyebrow"), title: t("help.manageTitle"), intro: t("help.manageIntro"), tips: [
      { icon: IconPinned, title: t("help.pinTitle"), body: t("help.pinBody"), example: <div className="example-actions"><span><IconPinned size={14} />{t("action.pin")}</span></div> },
      { icon: IconArrowBackUp, title: t("help.undoTitle"), body: t("help.undoBody"), example: <div className="example-toast"><span>{t("undo.deletedOne")}</span><b><IconArrowBackUp size={14} />{t("undo.action")}</b></div> },
      { icon: IconFile, title: t("help.missingTitle"), body: t("help.missingBody"), example: <div className="example-missing"><IconFile size={16} /><span>project-final.pdf</span><b>{t("detail.fileMissing")}</b></div> },
    ]},
    { id: "permissions", icon: IconClipboard, label: t("help.topicPermissions"), eyebrow: t("settings.permissions"), title: t("help.permissionTitle"), intro: t("help.permissionIntro"), tips: [
      { icon: IconClipboard, title: t("permission.capture"), body: t("help.captureBody"), example: <StatusExample ready={permissionStatus.clipboardCapture} t={t} /> },
      { icon: IconClipboard, title: t("permission.autoPaste"), body: t(isWindowsPlatform() ? "permission.windowsPasteBody" : "permission.helpBody"), example: <StatusExample ready={permissionStatus.accessibility} t={t} />, action: !permissionStatus.accessibility && <button className="tip-action" onClick={onOpenAccessibility}>{t("permission.fix")}</button> },
    ]},
  ];
}

function StatusExample({ ready, t }) {
  return <div className={`example-status ${ready ? "ready" : "needed"}`}><span />{ready ? t("permission.ready") : t("permission.accessibilityNeeded")}</div>;
}
