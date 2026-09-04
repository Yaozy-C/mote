import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { defaultSettings, demoItems } from "../data/demoItems.js";

const ITEMS_KEY = "mote.demo.items.v2";
const SETTINGS_KEY = "mote.demo.settings.v1";
const TRASH_KEY = "mote.demo.trash.v1";

export const isDesktopRuntime = () => Boolean(window.__TAURI_INTERNALS__);
export const imageSource = (value) => isDesktopRuntime() && value.startsWith("/") && !value.startsWith("/assets/") ? convertFileSrc(value) : value;

function loadDemoItems() {
  try {
    const saved = JSON.parse(localStorage.getItem(ITEMS_KEY));
    return (Array.isArray(saved) && saved.length ? saved : demoItems).map(normalizeItem);
  } catch {
    return demoItems.map(normalizeItem);
  }
}

function normalizeItem(item) {
  if (item.representations?.length) return item;
  const format = item.kind === "image" ? "image" : item.kind === "html" ? "html" : "text";
  return { ...item, formats: [format], representations: [{ itemIndex: 0, format, content: item.content, byteSize: item.byteSize ?? null, nativeType: null, binary: item.kind === "image" }] };
}

function saveDemoItems(items) {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(items));
}

function loadDemoSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) };
  } catch {
    return defaultSettings;
  }
}

export const moteApi = {
  async listItems(query = "") {
    if (isDesktopRuntime()) {
      return invoke("list_clipboard_items", { query: query || null });
    }
    const normalized = query.trim().toLowerCase();
    return loadDemoItems()
      .filter((item) => !normalized || `${item.title} ${item.content} ${item.detail} ${item.sourceAppName ?? ""} ${item.ocrText ?? ""}`.toLowerCase().includes(normalized))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
  },

  async copyItem(item) {
    if (isDesktopRuntime()) {
      return invoke("copy_clipboard_item", { id: item.id });
    }
    await navigator.clipboard.writeText(item.kind === "image" ? item.title : item.content);
  },

  async copyItemPlainText(item) {
    if (isDesktopRuntime()) return invoke("copy_clipboard_item_plain_text", { id: item.id });
    await navigator.clipboard.writeText(plainTextValue(item));
  },

  async pasteItem(item) {
    if (isDesktopRuntime()) {
      return invoke("paste_clipboard_item", { id: item.id });
    }
    await navigator.clipboard.writeText(item.kind === "image" ? item.title : item.content);
  },

  async pasteItemPlainText(item) {
    if (isDesktopRuntime()) return invoke("paste_clipboard_item_plain_text", { id: item.id });
    await navigator.clipboard.writeText(plainTextValue(item));
  },

  async pasteItems(items) {
    if (isDesktopRuntime()) {
      return invoke("paste_clipboard_items", { ids: items.map((item) => item.id) });
    }
    await navigator.clipboard.writeText(items.map((item) => item.kind === "image" ? item.title : item.content).join("\n"));
  },

  async togglePin(id) {
    if (isDesktopRuntime()) {
      return invoke("toggle_clipboard_pin", { id });
    }
    const items = loadDemoItems().map((item) => item.id === id ? { ...item, pinned: !item.pinned } : item);
    saveDemoItems(items);
    return items.find((item) => item.id === id);
  },

  async deleteItem(id) {
    if (isDesktopRuntime()) {
      return invoke("delete_clipboard_item", { id });
    }
    const current = loadDemoItems();
    const removed = current.filter((item) => item.id === id);
    localStorage.setItem(TRASH_KEY, JSON.stringify(removed));
    const items = current.filter((item) => item.id !== id);
    saveDemoItems(items);
    return removed.map((item) => item.id);
  },

  async clearUnpinned() {
    if (isDesktopRuntime()) return invoke("clear_unpinned_items");
    const current = loadDemoItems();
    const removed = current.filter((item) => !item.pinned);
    localStorage.setItem(TRASH_KEY, JSON.stringify(removed));
    const remaining = current.filter((item) => item.pinned);
    saveDemoItems(remaining);
    return removed.map((item) => item.id);
  },

  async restoreItems(ids) {
    if (isDesktopRuntime()) return invoke("restore_clipboard_items", { ids });
    const trashed = JSON.parse(localStorage.getItem(TRASH_KEY) || "[]");
    const restored = trashed.filter((item) => ids.includes(item.id));
    saveDemoItems([...loadDemoItems(), ...restored].filter((item, index, values) => values.findIndex((candidate) => candidate.id === item.id) === index));
    return restored.length;
  },

  async hideWindow() {
    if (isDesktopRuntime()) return invoke("hide_main_window");
  },

  async openAccessibilitySettings() {
    if (isDesktopRuntime()) return invoke("open_accessibility_settings");
  },

  async requestAccessibilityAccess() {
    if (isDesktopRuntime()) return invoke("request_accessibility_access");
    return true;
  },

  async getPermissionStatus() {
    if (isDesktopRuntime()) return invoke("get_permission_status");
    return { clipboardCapture: loadDemoSettings().captureEnabled, accessibility: true, screenCapture: true };
  },

  async requestScreenCaptureAccess() {
    if (isDesktopRuntime()) return invoke("request_screen_capture_access");
    return true;
  },

  async repairPermissionAccess() {
    if (isDesktopRuntime()) return invoke("repair_permission_access");
  },

  async getLongScreenshotTarget() {
    if (isDesktopRuntime()) return invoke("get_long_screenshot_target");
    return { bundleId: "com.google.Chrome", name: "Chrome" };
  },

  async startNativeScreenshot() {
    if (!isDesktopRuntime()) throw new Error("Native screenshot selection is only available in the desktop app.");
    return invoke("start_native_screenshot");
  },

  async startNativeLongScreenshot(maxSteps = 36) {
    if (!isDesktopRuntime()) throw new Error("Native scrolling capture is only available in the desktop app.");
    return invoke("start_native_long_screenshot", { maxSteps });
  },

  async openExternal(value) {
    if (isDesktopRuntime()) return invoke("open_external", { value });
    window.open(value, "_blank", "noopener,noreferrer");
  },

  async revealFile(path) {
    if (isDesktopRuntime()) return invoke("reveal_file", { path });
  },

  async checkFilePaths(paths) {
    if (isDesktopRuntime()) return invoke("check_file_paths", { paths });
    return paths.map(() => true);
  },

  async copyText(value) {
    if (isDesktopRuntime()) return invoke("copy_text_value", { value });
    return navigator.clipboard.writeText(value);
  },

  async copyOcrText(item) {
    if (!item.ocrText?.trim()) throw new Error("Recognized text is not available for this image yet.");
    if (isDesktopRuntime()) return invoke("copy_text_value", { value: item.ocrText });
    return navigator.clipboard.writeText(item.ocrText);
  },

  async pasteOcrText(item) {
    if (!item.ocrText?.trim()) throw new Error("Recognized text is not available for this image yet.");
    if (isDesktopRuntime()) return invoke("paste_text_value", { value: item.ocrText });
    return navigator.clipboard.writeText(item.ocrText);
  },

  async pickColor() {
    if (isDesktopRuntime()) return invoke("start_color_picker");
    if (!window.EyeDropper) throw new Error("The system color picker is unavailable in this browser.");
    let result;
    try {
      result = await new window.EyeDropper().open();
    } catch (error) {
      if (error?.name === "AbortError") return null;
      throw error;
    }
    const { sRGBHex } = result;
    const color = sRGBHex.toUpperCase();
    const items = loadDemoItems();
    const existing = items.find((item) => item.kind === "color" && item.content.toUpperCase() === color);
    const item = normalizeItem({
      id: existing?.id ?? Math.max(0, ...items.map((candidate) => Number(candidate.id))) + 1,
      kind: "color",
      title: color,
      content: color,
      detail: "Picked color",
      byteSize: null,
      createdAt: Date.now(),
      pinned: existing?.pinned ?? false,
    });
    saveDemoItems([item, ...items.filter((candidate) => candidate.id !== item.id)]);
    await navigator.clipboard.writeText(color);
    return item;
  },

  async saveCapturedImage(capture) {
    if (isDesktopRuntime()) {
      await invoke("write_captured_image", { rgba: capture.rgba, width: capture.width, height: capture.height });
      return null;
    }
    const items = loadDemoItems();
    const item = normalizeItem({
      id: Math.max(0, ...items.map((candidate) => Number(candidate.id))) + 1,
      kind: "image",
      title: "长截图 · Mote Journal",
      content: capture.dataUrl,
      detail: `Image · ${capture.width} × ${capture.height}`,
      byteSize: null,
      createdAt: Date.now(),
      pinned: false,
      sourceAppId: "com.google.Chrome",
      sourceAppName: "Chrome",
      ocrText: "让工具跟上思考的速度\n关于剪贴板、连续阅读，以及不应该打断注意力的细节。",
      ocrStatus: "ready",
    });
    saveDemoItems([item, ...items]);
    try {
      const blob = await (await fetch(capture.dataUrl)).blob();
      if (navigator.clipboard?.write && window.ClipboardItem) await navigator.clipboard.write([new window.ClipboardItem({ "image/png": blob })]);
    } catch {
      // Browser preview may not grant image clipboard access; the history result remains available.
    }
    return item;
  },

  async getSettings() {
    return isDesktopRuntime() ? invoke("get_settings") : loadDemoSettings();
  },

  async updateSettings(settings) {
    if (isDesktopRuntime()) {
      return invoke("update_settings", { settings });
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return settings;
  },

  async onClipboardChanged(callback) {
    if (!isDesktopRuntime()) return () => {};
    return listen("mote://clipboard-changed", (event) => callback(event.payload));
  },

  async onFocusSearch(callback) {
    if (!isDesktopRuntime()) return () => {};
    return listen("mote://focus-search", callback);
  },

  async onWindowFocused(callback) {
    if (!isDesktopRuntime()) return () => {};
    return listen("mote://window-focused", callback);
  },

  async onOpenBatch(callback) {
    if (!isDesktopRuntime()) return () => {};
    return listen("mote://open-batch", callback);
  },

  async onOpenColorPicker(callback) {
    if (!isDesktopRuntime()) return () => {};
    return listen("mote://open-color-picker", callback);
  },

  async onOpenScreenshot(callback) {
    if (!isDesktopRuntime()) return () => {};
    return listen("mote://open-screenshot", callback);
  },

  async onLongScreenshotComplete(callback) {
    if (!isDesktopRuntime()) return () => {};
    return listen("mote://long-screenshot-complete", callback);
  },

  async onColorPicked(callback) {
    if (!isDesktopRuntime()) return () => {};
    return listen("mote://color-picked", (event) => callback(event.payload));
  },

  async onColorPickerError(callback) {
    if (!isDesktopRuntime()) return () => {};
    return listen("mote://color-picker-error", (event) => callback(event.payload));
  },
};

function plainTextValue(item) {
  if (item.kind === "image") {
    if (!item.ocrText?.trim()) throw new Error("Recognized text is not available for this image yet.");
    return item.ocrText;
  }
  const representation = item.representations?.find((value) => ["text", "url"].includes(value.format));
  return representation?.content ?? item.content;
}
