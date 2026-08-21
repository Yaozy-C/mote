import { useEffect, useRef, useState } from "react";
import { GearSix, MagnifyingGlass, Question, X } from "@phosphor-icons/react";
import { IconCheck, IconClipboard, IconCopy, IconPinned, IconTrash } from "@tabler/icons-react";
import { DetailPreview } from "./components/DetailPreview.jsx";
import { BatchPreview } from "./components/BatchPreview.jsx";
import { ErrorDialog } from "./components/ErrorDialog.jsx";
import { HelpDialog } from "./components/HelpDialog.jsx";
import { HistoryPanel } from "./components/HistoryPanel.jsx";
import { ParticleField } from "./components/ParticleField.jsx";
import { SettingsPopover } from "./components/SettingsPopover.jsx";
import { UpdateDialog } from "./components/UpdateDialog.jsx";
import { useAppUpdater } from "./hooks/useAppUpdater.js";
import { useClipboardHistory } from "./hooks/useClipboardHistory.js";
import { isDesktopRuntime, moteApi } from "./services/moteApi.js";
import { formatShortcut, matchesShortcut } from "./utils/shortcuts.js";
import { createI18n } from "./i18n.js";

export function App() {
  const history = useClipboardHistory();
  const updater = useAppUpdater();
  const { locale, t } = createI18n(history.settings.language);
  const [actionDone, setActionDone] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [actionError, setActionError] = useState("");
  const searchRef = useRef(null);
  const didOfferHelp = useRef(false);

  const runAction = async (action) => {
    try {
      setActionError("");
      await action();
    } catch (cause) {
      setActionError(String(cause));
    }
  };

  const handleCopy = () => runAction(async () => {
    await history.copyItem();
    setActionDone({ type: "copied" });
    window.setTimeout(() => setActionDone(null), 1500);
  });

  const handlePaste = () => {
    if (history.batchMode && !history.batchSelectedItems.length) return;
    return runAction(async () => {
    const count = history.batchMode ? history.batchSelectedItems.length : 1;
    await (history.batchMode ? history.pasteBatch() : history.pasteItem());
    setActionDone({ type: "pasted", count });
    window.setTimeout(() => setActionDone(null), 1500);
    });
  };

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (matchesShortcut(event, history.settings.toggleBatchShortcut)) {
        event.preventDefault();
        setSettingsOpen(false);
        setHelpOpen(false);
        history.batchMode ? history.cancelBatchSelection() : history.startBatchSelection();
        searchRef.current?.blur();
        return;
      }
      if (event.key === "Escape") {
        if (actionError || settingsOpen || helpOpen) {
          setActionError("");
          setSettingsOpen(false);
          setHelpOpen(false);
        } else if (history.batchMode) {
          history.cancelBatchSelection();
        } else {
          moteApi.hideWindow();
        }
        searchRef.current?.blur();
      }
      if (actionError || helpOpen || settingsOpen) return;
      if (history.batchMode) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          searchRef.current?.blur();
          history.selectOffset(event.key === "ArrowDown" ? 1 : -1);
        } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
          event.preventDefault();
          history.selectAllBatch();
        } else if (event.code === "Space" && !["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) {
          event.preventDefault();
          if (history.selectedId != null) history.toggleBatchSelection(history.selectedId);
        }
        if (event.key === "Enter" && !event.metaKey && !event.ctrlKey && !event.altKey) {
          event.preventDefault();
          handlePaste();
        }
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        history.selectOffset(event.key === "ArrowDown" ? 1 : -1);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        handleCopy();
      } else if (event.key === "Enter" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        history.settings.directPaste ? handlePaste() : handleCopy();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actionError, helpOpen, settingsOpen, history]);

  useEffect(() => {
    let dispose = () => {};
    moteApi.onFocusSearch(() => {
      window.setTimeout(() => {
        searchRef.current?.focus();
        searchRef.current?.select();
      }, 30);
    }).then((unlisten) => { dispose = unlisten; });
    return () => dispose();
  }, []);

  useEffect(() => {
    let dispose = () => {};
    moteApi.onOpenBatch(() => {
      setSettingsOpen(false);
      setHelpOpen(false);
      history.startBatchSelection();
      window.setTimeout(() => searchRef.current?.blur(), 40);
    }).then((unlisten) => { dispose = unlisten; });
    return () => dispose();
  }, [history.startBatchSelection]);

  useEffect(() => {
    document.querySelector(`[data-item-id="${history.selectedId}"]`)?.scrollIntoView({ block: "nearest" });
  }, [history.selectedId]);

  useEffect(() => {
    if (!history.loading && !history.settings.hasSeenHelp && !didOfferHelp.current) {
      didOfferHelp.current = true;
      setHelpOpen(true);
    }
  }, [history.loading, history.settings.hasSeenHelp]);

  const closeHelp = () => {
    setHelpOpen(false);
    if (!history.settings.hasSeenHelp) {
      runAction(() => history.saveSettings({ ...history.settings, hasSeenHelp: true }));
    }
  };

  return (
    <main className={`desktop-stage ${isDesktopRuntime() ? "native-runtime" : ""} ${history.settings.reduceMotion ? "reduce-motion" : ""}`}>
      <img className="ambient-background" src="/assets/mote-ambient-bg.png" alt="" />
      <ParticleField disabled={history.settings.reduceMotion} />
      <section className="mote-window" aria-label={`Mote ${t("history.label")}`}>
        <header className="titlebar" data-tauri-drag-region>
          <div className="search-shell">
            <MagnifyingGlass size={18} weight="regular" />
            <input ref={searchRef} value={history.query} onChange={(event) => history.setQuery(event.target.value)} placeholder={t("search.placeholder")} aria-label={t("search.label")} />
            {history.query && <button className="clear-search" onClick={() => history.setQuery("")} aria-label={t("search.clear")}><X size={14} weight="bold" /></button>}
            <span className="search-shortcut">⌘K</span>
          </div>
          <div className="title-actions">
            <button aria-label={t("app.pinSelected")} disabled={history.batchMode} onClick={() => runAction(history.togglePin)} className={history.selected?.pinned ? "active" : ""}><IconPinned size={18} stroke={1.75} aria-hidden="true" /></button>
            <button aria-label={t("app.openHelp")} onClick={() => { setSettingsOpen(false); setHelpOpen(true); }}><Question size={20} /></button>
            <button aria-label={t("app.openSettings")} onClick={() => setSettingsOpen((value) => !value)}><GearSix size={20} /></button>
          </div>
        </header>

        <div className="workspace">
          <HistoryPanel items={history.items} selectedId={history.selectedId} onSelect={history.setSelectedId} loading={history.loading} error={history.error} batchMode={history.batchMode} batchSelectedIds={history.batchSelectedIds} onStartBatch={history.startBatchSelection} onCancelBatch={history.cancelBatchSelection} onToggleBatch={(id) => { history.setSelectedId(id); history.toggleBatchSelection(id); }} toggleShortcut={formatShortcut(history.settings.toggleBatchShortcut, locale)} t={t} locale={locale} />
          <section className="preview-panel" aria-live="polite">
            <div className="preview-scroll">
              <div className="preview-transition" key={history.batchMode ? `batch-${history.batchSelectedIds.join("-")}` : history.selectedId ?? "empty"}>
                {history.batchMode ? <BatchPreview items={history.batchSelectedItems} t={t} /> : history.selected ? <DetailPreview item={history.selected} t={t} locale={locale} /> : <div className="empty-state"><strong>{t("empty.clipboard")}</strong></div>}
              </div>
            </div>
            {history.batchMode ? <footer className="preview-actions batch-actions">
              <button className="primary-action" disabled={!history.batchSelectedItems.length} onClick={handlePaste}><IconClipboard size={18} stroke={1.75} aria-hidden="true" /> {t("multi.pasteCount", { count: history.batchSelectedItems.length || "" })}<kbd>↵</kbd></button>
              <button onClick={history.selectAllBatch}>{t("action.selectAll")}</button>
              <button onClick={history.cancelBatchSelection}>{t("action.cancel")}</button>
            </footer> : history.selected && <footer className="preview-actions">
              <button className={`primary-action ${actionDone ? "copied" : ""}`} onClick={history.settings.directPaste ? handlePaste : handleCopy}>{actionDone ? <IconCheck size={18} stroke={2} aria-hidden="true" /> : history.settings.directPaste ? <IconClipboard size={18} stroke={1.75} aria-hidden="true" /> : <IconCopy size={18} stroke={1.75} aria-hidden="true" />} {actionDone ? actionDone.type === "copied" ? t("action.copied") : actionDone.count > 1 ? t("action.pastedCount", { count: actionDone.count }) : t("action.pasted") : history.settings.directPaste ? t("action.paste") : t("action.copy")}<kbd>{history.settings.directPaste ? "↵" : "⌘ ↵"}</kbd></button>
              <button onClick={() => runAction(history.togglePin)} className={history.selected.pinned ? "active" : ""}><IconPinned size={18} stroke={1.75} aria-hidden="true" />{history.selected.pinned ? t("action.pinned") : t("action.pin")}</button>
              <button className="delete-action" onClick={() => runAction(history.deleteItem)}><IconTrash size={18} stroke={1.75} aria-hidden="true" /> {t("action.delete")}</button>
            </footer>}
          </section>
        </div>

        {settingsOpen && <SettingsPopover settings={history.settings} updater={updater} t={t} locale={locale} onChange={(settings) => runAction(() => history.saveSettings(settings))} onClear={() => {
          if (window.confirm(t("confirm.clear"))) runAction(history.clearUnpinned);
        }} />}
        {helpOpen && <HelpDialog onClose={closeHelp} settings={history.settings} t={t} locale={locale} />}
        {(updater.status === "available" || updater.status === "downloading" || updater.status === "restarting" || updater.status === "error") && <UpdateDialog updater={updater} t={t} />}
        {actionError && <ErrorDialog message={actionError} t={t} onClose={() => setActionError("")} onOpenSettings={() => moteApi.openAccessibilitySettings()} />}
      </section>
    </main>
  );
}
