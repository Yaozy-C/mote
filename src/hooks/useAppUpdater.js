import { useCallback, useEffect, useRef, useState } from "react";
import { isDesktopRuntime } from "../services/moteApi.js";

export function useAppUpdater() {
  const updateRef = useRef(null);
  const [state, setState] = useState({
    status: "idle",
    currentVersion: "0.1.0",
    nextVersion: "",
    notes: "",
    progress: 0,
    error: "",
  });

  useEffect(() => {
    if (!isDesktopRuntime()) return;
    import("@tauri-apps/api/app")
      .then(({ getVersion }) => getVersion())
      .then((currentVersion) => setState((value) => ({ ...value, currentVersion })))
      .catch(() => {});
  }, []);

  const checkForUpdates = useCallback(async ({ silent = false } = {}) => {
    if (!isDesktopRuntime()) {
      setState((value) => ({ ...value, status: "current", error: "" }));
      return null;
    }

    setState((value) => ({ ...value, status: "checking", error: "" }));
    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();
      updateRef.current = update;
      if (!update) {
        setState((value) => ({ ...value, status: "current", nextVersion: "", notes: "" }));
        return null;
      }
      setState((value) => ({
        ...value,
        status: "available",
        nextVersion: update.version,
        notes: update.body || "",
      }));
      return update;
    } catch (cause) {
      setState((value) => ({
        ...value,
        status: silent ? "idle" : "error",
        error: silent ? "" : String(cause),
      }));
      return null;
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => checkForUpdates({ silent: true }), 1800);
    return () => window.clearTimeout(timer);
  }, [checkForUpdates]);

  const installUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;
    let downloaded = 0;
    let total = 0;
    setState((value) => ({ ...value, status: "downloading", progress: 0, error: "" }));
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength || 0;
        if (event.event === "Progress") downloaded += event.data.chunkLength;
        const progress = total ? Math.min(100, Math.round((downloaded / total) * 100)) : 0;
        setState((value) => ({ ...value, progress }));
      });
      setState((value) => ({ ...value, status: "restarting", progress: 100 }));
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (cause) {
      setState((value) => ({ ...value, status: "error", error: String(cause) }));
    }
  }, []);

  const dismiss = useCallback(() => {
    if (state.status === "downloading" || state.status === "restarting") return;
    setState((value) => ({ ...value, status: "idle", error: "" }));
  }, [state.status]);

  return { ...state, checkForUpdates, installUpdate, dismiss };
}
