import { useCallback, useEffect, useMemo, useState } from "react";
import { defaultSettings } from "../data/demoItems.js";
import { moteApi } from "../services/moteApi.js";

export function useClipboardHistory() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async (nextQuery = query) => {
    try {
      setError("");
      const nextItems = await moteApi.listItems(nextQuery);
      setItems(nextItems);
      setSelectedId((current) => nextItems.some((item) => item.id === current) ? current : nextItems[0]?.id ?? null);
      setBatchSelectedIds((current) => current.filter((id) => nextItems.some((item) => item.id === id)));
    } catch (cause) {
      setError(String(cause));
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = window.setTimeout(() => refresh(query), query ? 120 : 0);
    return () => window.clearTimeout(timer);
  }, [query, refresh]);

  useEffect(() => {
    moteApi.getSettings().then(setSettings).catch((cause) => setError(String(cause)));
    let dispose = () => {};
    moteApi.onClipboardChanged(() => refresh(query)).then((unlisten) => { dispose = unlisten; });
    return () => dispose();
  }, [query, refresh]);

  const selected = useMemo(
    () => items.find((item) => item.id === selectedId) ?? items[0] ?? null,
    [items, selectedId],
  );

  const copyItem = useCallback(async () => {
    if (!selected) return;
    await moteApi.copyItem(selected);
  }, [selected]);

  const copyItemPlainText = useCallback(async () => {
    if (!selected) return;
    await moteApi.copyItemPlainText(selected);
  }, [selected]);

  const pasteItem = useCallback(async () => {
    if (!selected) return;
    await moteApi.pasteItem(selected);
  }, [selected]);

  const pasteItemPlainText = useCallback(async () => {
    if (!selected) return;
    await moteApi.pasteItemPlainText(selected);
  }, [selected]);

  const batchSelectedItems = useMemo(
    () => items.filter((item) => batchSelectedIds.includes(item.id)).sort((a, b) => a.createdAt - b.createdAt),
    [batchSelectedIds, items],
  );

  const startBatchSelection = useCallback(() => {
    setBatchMode(true);
    setBatchSelectedIds(selectedId == null ? [] : [selectedId]);
  }, [selectedId]);

  const cancelBatchSelection = useCallback(() => {
    setBatchMode(false);
    setBatchSelectedIds([]);
  }, []);

  const toggleBatchSelection = useCallback((id) => {
    setBatchSelectedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }, []);

  const selectAllBatch = useCallback(() => {
    setBatchSelectedIds(items.map((item) => item.id));
  }, [items]);

  const pasteBatch = useCallback(async () => {
    if (!batchSelectedItems.length) return;
    await moteApi.pasteItems(batchSelectedItems);
    cancelBatchSelection();
  }, [batchSelectedItems, cancelBatchSelection]);

  const pasteBatchMerged = useCallback(async () => {
    if (!batchSelectedItems.length) return;
    await moteApi.pasteItemsMerged(batchSelectedItems);
    cancelBatchSelection();
  }, [batchSelectedItems, cancelBatchSelection]);

  const selectOffset = useCallback((offset) => {
    if (!items.length) return;
    const current = Math.max(0, items.findIndex((item) => item.id === selectedId));
    const next = Math.min(items.length - 1, Math.max(0, current + offset));
    setSelectedId(items[next].id);
  }, [items, selectedId]);

  const togglePin = useCallback(async () => {
    if (!selected) return;
    await moteApi.togglePin(selected.id);
    await refresh(query);
  }, [query, refresh, selected]);

  const deleteItem = useCallback(async () => {
    if (!selected) return [];
    const ids = await moteApi.deleteItem(selected.id);
    await refresh(query);
    return ids;
  }, [query, refresh, selected]);

  const saveSettings = useCallback(async (nextSettings) => {
    const saved = await moteApi.updateSettings(nextSettings);
    setSettings(saved);
  }, []);

  const clearUnpinned = useCallback(async () => {
    const ids = await moteApi.clearUnpinned();
    await refresh(query);
    return ids;
  }, [query, refresh]);

  const restoreItems = useCallback(async (ids) => {
    await moteApi.restoreItems(ids);
    await refresh(query);
  }, [query, refresh]);

  const selectNewItem = useCallback(async (item) => {
    setQuery("");
    await refresh("");
    if (item?.id != null) setSelectedId(item.id);
  }, [refresh]);

  return {
    items,
    selected,
    selectedId,
    setSelectedId,
    batchMode,
    batchSelectedIds,
    batchSelectedItems,
    startBatchSelection,
    cancelBatchSelection,
    toggleBatchSelection,
    selectAllBatch,
    pasteBatch,
    pasteBatchMerged,
    query,
    setQuery,
    settings,
    saveSettings,
    copyItem,
    copyItemPlainText,
    pasteItem,
    pasteItemPlainText,
    selectOffset,
    togglePin,
    deleteItem,
    clearUnpinned,
    restoreItems,
    selectNewItem,
    loading,
    error,
  };
}
