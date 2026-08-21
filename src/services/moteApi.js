import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { defaultSettings, demoItems } from "../data/demoItems.js";

const ITEMS_KEY = "mote.demo.items.v2";
const SETTINGS_KEY = "mote.demo.settings.v1";

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
      .filter((item) => !normalized || `${item.title} ${item.content} ${item.detail}`.toLowerCase().includes(normalized))
      .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
  },

  async copyItem(item) {
    if (isDesktopRuntime()) {
      return invoke("copy_clipboard_item", { id: item.id });
    }
    await navigator.clipboard.writeText(item.kind === "image" ? item.title : item.content);
  },

  async pasteItem(item) {
    if (isDesktopRuntime()) {
      return invoke("paste_clipboard_item", { id: item.id });
    }
    await navigator.clipboard.writeText(item.kind === "image" ? item.title : item.content);
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
    const items = loadDemoItems().filter((item) => item.id !== id);
    saveDemoItems(items);
    return true;
  },

  async clearUnpinned() {
    if (isDesktopRuntime()) return invoke("clear_unpinned_items");
    const remaining = loadDemoItems().filter((item) => item.pinned);
    saveDemoItems(remaining);
    return remaining.length;
  },

  async hideWindow() {
    if (isDesktopRuntime()) return invoke("hide_main_window");
  },

  async openAccessibilitySettings() {
    if (isDesktopRuntime()) return invoke("open_accessibility_settings");
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

  async onOpenBatch(callback) {
    if (!isDesktopRuntime()) return () => {};
    return listen("mote://open-batch", callback);
  },
};
