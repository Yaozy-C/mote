import { ArrowBendDownLeft, Copy, MagnifyingGlass, ShieldCheck, Stack, X } from "@phosphor-icons/react";
import { formatShortcut } from "../utils/shortcuts.js";

const helpSteps = (settings, t, locale) => [
  { icon: Copy, title: t("help.copyTitle"), body: t("help.copyBody"), shortcut: "⌘ C" },
  { icon: MagnifyingGlass, title: t("help.findTitle"), body: t("help.findBody"), shortcut: formatShortcut(settings.openShortcut, locale) },
  { icon: ArrowBendDownLeft, title: t("help.pasteTitle"), body: t("help.pasteBody"), shortcut: "↵" },
  { icon: Stack, title: t("help.multiTitle"), body: t("help.multiBody", { shortcut: formatShortcut(settings.toggleBatchShortcut, locale) }), shortcut: formatShortcut(settings.batchShortcut, locale) },
];

export function HelpDialog({ onClose, settings, t, locale }) {
  return (
    <div className="help-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="help-dialog" role="dialog" aria-modal="true" aria-labelledby="help-title">
        <button className="help-close" onClick={onClose} aria-label={t("help.close")}><X size={18} /></button>
        <header className="help-hero">
          <img className="help-mark" src="/assets/mote-logo.png" alt="" />
          <div>
            <p className="help-eyebrow">{t("help.quickStart")}</p>
            <h2 id="help-title">{t("help.title")}</h2>
            <p className="help-intro">{t("help.intro")}</p>
          </div>
        </header>
        <div className="help-steps">
          {helpSteps(settings, t, locale).map(({ icon: Icon, title, body, shortcut }) => (
            <article className="help-step" key={title}>
              <div className="help-step-top"><span><Icon size={19} /></span><kbd>{shortcut}</kbd></div>
              <strong>{title}</strong>
              <p>{body}</p>
            </article>
          ))}
        </div>
        <footer className="help-footer">
          <div className="privacy-note"><ShieldCheck size={19} weight="fill" /><span><strong>{t("help.private")}</strong><small>{t("help.privateBody")}</small></span></div>
          <button className="help-done" onClick={onClose}>{t("help.done")}</button>
        </footer>
      </section>
    </div>
  );
}
