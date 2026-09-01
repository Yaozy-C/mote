import { useEffect, useRef, useState } from "react";
import { AppTitlebar } from "./components/AppTitlebar.jsx";
import { PreviewPanel } from "./components/PreviewPanel.jsx";
import { ClearHistoryDialog } from "./components/ClearHistoryDialog.jsx";
import { ErrorDialog } from "./components/ErrorDialog.jsx";
import { HelpDialog } from "./components/HelpDialog.jsx";
import { HistoryPanel } from "./components/HistoryPanel.jsx";
import { LongScreenshotOverlay } from "./components/LongScreenshotOverlay.jsx";
import { NativeLongScreenshotDialog } from "./components/NativeLongScreenshotDialog.jsx";
import { ParticleField } from "./components/ParticleField.jsx";
import { SettingsPopover } from "./components/SettingsPopover.jsx";
import { ShortcutDialog } from "./components/ShortcutDialog.jsx";
import { UpdateDialog } from "./components/UpdateDialog.jsx";
import { UndoToast } from "./components/UndoToast.jsx";
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
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const [screenshotOpen, setScreenshotOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [actionError, setActionError] = useState("");
  const [permissionStatus, setPermissionStatus] = useState({ clipboardCapture: history.settings.captureEnabled, accessibility: false, screenCapture: false });
  const [undoState, setUndoState] = useState(null);
  const searchRef = useRef(null);
  const settingsButtonRef = useRef(null);
  const settingsPopoverRef = useRef(null);
  const undoTimer = useRef(null);
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

  const handlePlainText = () => runAction(async () => {
    if (history.settings.directPaste) await history.pasteItemPlainText();
    else await history.copyItemPlainText();
    setActionDone({ type: history.settings.directPaste ? "pasted" : "copied" });
    window.setTimeout(() => setActionDone(null), 1500);
  });

  const handlePickColor = () => runAction(async () => {
    setSettingsOpen(false);
    setHelpOpen(false);
    const item = await moteApi.pickColor();
    if (item) await history.selectNewItem(item);
  });

  const handleOpenScreenshot = () => {
    setSettingsOpen(false);
    setHelpOpen(false);
    setShortcutOpen(false);
    setScreenshotOpen(true);
  };

  const handleScreenshotComplete = async (capture) => {
    const item = await moteApi.saveCapturedImage(capture);
    if (item) await history.selectNewItem(item);
    setActionDone({ type: "copied" });
    window.setTimeout(() => setActionDone(null), 1500);
  };

  const handleNativeScreenshot = async (maxSteps) => {
    try {
      setActionError("");
      await moteApi.startNativeLongScreenshot(maxSteps);
      setActionDone({ type: "copied" });
      window.setTimeout(() => setActionDone(null), 1500);
    } catch (cause) {
      setActionError(String(cause));
      throw cause;
    }
  };

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (matchesShortcut(event, history.settings.colorShortcut)) {
        event.preventDefault();
        handlePickColor();
        return;
      }
      if (matchesShortcut(event, history.settings.screenshotShortcut)) {
        event.preventDefault();
        handleOpenScreenshot();
        return;
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
        if (screenshotOpen) {
          setScreenshotOpen(false);
          return;
        }
        if (actionError || settingsOpen || helpOpen || shortcutOpen || clearConfirmOpen) {
          setActionError("");
          setSettingsOpen(false);
          setHelpOpen(false);
          setShortcutOpen(false);
          if (!clearingHistory) setClearConfirmOpen(false);
        } else if (history.batchMode) {
          history.cancelBatchSelection();
        } else {
          moteApi.hideWindow();
        }
        searchRef.current?.blur();
      }
      if (actionError || helpOpen || settingsOpen || shortcutOpen || clearConfirmOpen) return;
      if (history.batchMode) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          searchRef.current?.blur();
          if (event.altKey && history.batchSelectedIds.includes(history.selectedId)) {
            history.moveBatchItem(history.selectedId, event.key === "ArrowDown" ? 1 : -1);
          } else {
            history.selectOffset(event.key === "ArrowDown" ? 1 : -1);
          }
        } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "a") {
          event.preventDefault();
          history.selectAllBatch();
        } else if (event.code === "Space" && !["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) {
          event.preventDefault();
          if (history.selectedId != null) history.toggleBatchSelection(history.selectedId);
        }
        if (event.key === "Enter" && !event.metaKey && !event.ctrlKey && !event.altKey && !["TEXTAREA", "BUTTON"].includes(event.target.tagName)) {
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
  }, [actionError, clearConfirmOpen, clearingHistory, helpOpen, screenshotOpen, shortcutOpen, settingsOpen, history]);

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
    let dispose = () => {};
    moteApi.onOpenColorPicker(() => handlePickColor()).then((unlisten) => { dispose = unlisten; });
    return () => dispose();
  }, [history.selectNewItem]);

  useEffect(() => {
    let dispose = () => {};
    moteApi.onOpenScreenshot(handleOpenScreenshot).then((unlisten) => { dispose = unlisten; });
    return () => dispose();
  }, []);

  useEffect(() => {
    let disposePicked = () => {};
    let disposeError = () => {};
    moteApi.onColorPicked((item) => history.selectNewItem(item)).then((unlisten) => { disposePicked = unlisten; });
    moteApi.onColorPickerError((message) => setActionError(String(message))).then((unlisten) => { disposeError = unlisten; });
    return () => { disposePicked(); disposeError(); };
  }, [history.selectNewItem]);

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

  const handleClearHistory = async () => {
    setClearingHistory(true);
    try {
      setActionError("");
      const ids = await history.clearUnpinned();
      if (ids?.length) offerUndo(ids);
      setClearConfirmOpen(false);
    } catch (cause) {
      setClearConfirmOpen(false);
      setActionError(String(cause));
    } finally {
      setClearingHistory(false);
    }
  };

  const refreshPermissions = async () => {
    try {
      const status = await moteApi.getPermissionStatus();
      setPermissionStatus(status);
      return status;
    } catch (cause) {
      setActionError(String(cause));
      return null;
    }
  };

  const requestAccessibility = async () => {
    await moteApi.requestAccessibilityAccess();
    window.setTimeout(refreshPermissions, 500);
  };

  const offerUndo = (ids) => {
    window.clearTimeout(undoTimer.current);
    setUndoState({ ids, count: ids.length });
    undoTimer.current = window.setTimeout(() => setUndoState(null), 7000);
  };

  const handleDelete = () => runAction(async () => {
    const ids = await history.deleteItem();
    if (ids?.length) offerUndo(ids);
  });

  const handleUndo = () => runAction(async () => {
    if (!undoState) return;
    await history.restoreItems(undoState.ids);
    window.clearTimeout(undoTimer.current);
    setUndoState(null);
  });

  useEffect(() => {
    refreshPermissions();
    const refresh = () => refreshPermissions();
    let disposeNativeFocus = () => {};
    moteApi.onWindowFocused(refresh).then((unlisten) => { disposeNativeFocus = unlisten; });
    window.addEventListener("focus", refresh);
    return () => { disposeNativeFocus(); window.removeEventListener("focus", refresh); window.clearTimeout(undoTimer.current); };
  }, [history.settings.captureEnabled]);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    refreshPermissions();
    const permissionTimer = window.setInterval(refreshPermissions, 1200);
    return () => window.clearInterval(permissionTimer);
  }, [settingsOpen, history.settings.captureEnabled]);

  useEffect(() => {
    if (!settingsOpen) return undefined;
    const closeOnOutsidePointer = (event) => {
      const path = event.composedPath?.() ?? [];
      if (path.includes(settingsPopoverRef.current) || path.includes(settingsButtonRef.current)) return;
      setSettingsOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [settingsOpen]);

  return (
    <main className={`desktop-stage platform-macos ${isDesktopRuntime() ? "native-runtime" : ""} ${history.settings.reduceMotion ? "reduce-motion" : ""}`}>
      <img className="ambient-background" src="/assets/mote-ambient-bg.png" alt="" />
      <ParticleField disabled={history.settings.reduceMotion} />
      <section className="mote-window" aria-label={`Mote ${t("history.label")}`}>
        <AppTitlebar history={history} locale={locale} t={t} searchRef={searchRef} settingsButtonRef={settingsButtonRef} onPickColor={handlePickColor} onScreenshot={handleOpenScreenshot} onPin={() => runAction(history.togglePin)} onOpenShortcuts={() => { setSettingsOpen(false); setHelpOpen(false); setShortcutOpen(true); }} onOpenHelp={() => { setSettingsOpen(false); setHelpOpen(true); }} onToggleSettings={() => setSettingsOpen((value) => !value)} />

        <div className="workspace">
          <HistoryPanel items={history.items} selectedId={history.selectedId} onSelect={history.setSelectedId} loading={history.loading} error={history.error} batchMode={history.batchMode} batchSelectedIds={history.batchSelectedIds} onStartBatch={history.startBatchSelection} onCancelBatch={history.cancelBatchSelection} onToggleBatch={(id) => { history.setSelectedId(id); history.toggleBatchSelection(id); }} toggleShortcut={formatShortcut(history.settings.toggleBatchShortcut, locale)} t={t} locale={locale} />
          <PreviewPanel history={history} actionDone={actionDone} t={t} locale={locale} onError={setActionError} onPaste={handlePaste} onCopy={handleCopy} onPlainText={handlePlainText} onPin={() => runAction(history.togglePin)} onDelete={handleDelete} />
        </div>

        {settingsOpen && <SettingsPopover popoverRef={settingsPopoverRef} settings={history.settings} updater={updater} permissionStatus={permissionStatus} onRefreshPermissions={refreshPermissions} onOpenAccessibility={requestAccessibility} onRequestScreenCapture={async () => { await moteApi.requestScreenCaptureAccess(); await refreshPermissions(); }} t={t} onChange={(settings) => runAction(() => history.saveSettings(settings))} onClear={() => {
          setSettingsOpen(false);
          setClearConfirmOpen(true);
        }} />}
        {helpOpen && <HelpDialog onClose={closeHelp} settings={history.settings} permissionStatus={permissionStatus} onOpenAccessibility={requestAccessibility} t={t} locale={locale} />}
        {shortcutOpen && <ShortcutDialog settings={history.settings} onChange={(settings) => runAction(() => history.saveSettings(settings))} onClose={() => setShortcutOpen(false)} t={t} locale={locale} />}
        {clearConfirmOpen && <ClearHistoryDialog busy={clearingHistory} onCancel={() => setClearConfirmOpen(false)} onConfirm={handleClearHistory} t={t} />}
        {(updater.status === "available" || updater.status === "downloading" || updater.status === "restarting" || updater.status === "error") && <UpdateDialog updater={updater} t={t} />}
        {actionError && <ErrorDialog message={actionError} t={t} onClose={() => setActionError("")} onOpenSettings={() => moteApi.openAccessibilitySettings()} />}
        {undoState && <UndoToast count={undoState.count} onUndo={handleUndo} t={t} />}
      </section>
      {screenshotOpen && (isDesktopRuntime()
        ? <NativeLongScreenshotDialog permissionStatus={permissionStatus} t={t} onClose={() => setScreenshotOpen(false)} onCapture={handleNativeScreenshot} onOpenAccessibility={requestAccessibility} onRefreshPermissions={refreshPermissions} />
        : <LongScreenshotOverlay reduceMotion={history.settings.reduceMotion} t={t} onClose={() => setScreenshotOpen(false)} onComplete={(capture) => runAction(() => handleScreenshotComplete(capture))} />)}
    </main>
  );
}
