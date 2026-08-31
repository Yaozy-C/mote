import { useEffect, useMemo, useState } from "react";
import { File } from "@phosphor-icons/react";
import { IconAlertTriangle, IconClipboardText, IconCopy, IconExternalLink, IconFolderOpen, IconSparkles } from "@tabler/icons-react";
import { imageSource, moteApi } from "../services/moteApi.js";
import { localizedItemDetail } from "../i18n.js";

export function DetailPreview({ item, t, locale, onError }) {
  const representations = useMemo(() => item.representations?.length
    ? item.representations
    : [{ itemIndex: 0, format: item.kind === "image" ? "image" : item.kind === "html" ? "html" : "text", content: item.content, byteSize: item.byteSize }], [item]);
  const visibleRepresentations = useMemo(() => representations.filter((representation) => ["text", "html", "image", "files", "url"].includes(representation.format)), [representations]);
  const groups = useMemo(() => Object.values(representations.reduce((result, representation) => {
    const key = representation.itemIndex ?? 0;
    (result[key] ??= []).push(representation);
    return result;
  }, {})), [representations]);
  const displayRepresentations = useMemo(() => groups.flatMap((group) => {
    const image = group.find((representation) => representation.format === "image");
    const richText = group.find((representation) => representation.format === "html");
    const fallback = group.find((representation) => ["text", "url", "files"].includes(representation.format));
    return [image, richText ?? fallback].filter(Boolean);
  }), [groups]);

  const representation = preferredRepresentation(visibleRepresentations) ?? representations[0];
  if (displayRepresentations.length > 1 || groups.length > 1) {
    return <div className="compound-preview unified-preview">
      <header><h2>{item.title}</h2><p>{t("detail.copied", { time: formatCopiedAt(item.createdAt, t, locale) })}</p><SourceMeta item={item} t={t} /></header>
      <div className="compound-items">{displayRepresentations.map((visible, index) => {
        return <section className="compound-item" key={`${visible.itemIndex ?? 0}-${visible.format}-${index}`}>
          <RepresentationBlock item={item} representation={visible} t={t} onError={onError} />
        </section>;
      })}</div>
      <OcrPanel item={item} t={t} onError={onError} />
    </div>;
  }

  return <RepresentationPreview item={item} representation={representation} t={t} locale={locale} onError={onError} />;
}

function preferredRepresentation(group) {
  return ["html", "image", "text", "url", "files", "pdf", "rtfd", "rtf"]
    .map((format) => group.find((representation) => representation.format === format))
    .find(Boolean) ?? group[0];
}

function RepresentationBlock({ item, representation, t, onError }) {
  if (!representation) return null;
  if (representation.format === "image") return <><img className="compound-image" src={imageSource(representation.content)} alt={item.title} /><ImagePalette src={imageSource(representation.content)} t={t} onError={onError} compact /></>;
  if (representation.format === "html") return <div className="compound-html" dangerouslySetInnerHTML={{ __html: sanitizeClipboardHtml(representation.content) }} />;
  if (representation.format === "files") return <FilesBlock paths={filePaths(representation.content)} t={t} onError={onError} />;
  if (representation.format === "url") return <><pre>{representation.content}</pre><ContextButton icon={IconExternalLink} label={t("action.openLink")} onClick={() => moteApi.openExternal(representation.content)} onError={onError} /></>;
  if (representation.binary) return <div className="binary-content"><File size={22} /><span>{representation.format.toUpperCase()} · {representation.byteSize ?? t("detail.item", { count: "" })}</span></div>;
  return <pre>{representation.content}</pre>;
}

function displayFileContent(content) {
  try { return JSON.parse(content).join("\n"); } catch { return decodeURI(content.replace(/^file:\/\//, "")); }
}

function filePaths(content) {
  try { return JSON.parse(content).map(normalizeFilePath); } catch { return [normalizeFilePath(content)]; }
}

function normalizeFilePath(value) {
  try { return decodeURI(String(value).replace(/^file:\/\//, "")); } catch { return String(value).replace(/^file:\/\//, ""); }
}

function sanitizeClipboardHtml(html) {
  const document = new DOMParser().parseFromString(html, "text/html");
  document.querySelectorAll("script, iframe, object, embed, link, meta, style").forEach((element) => element.remove());
  document.querySelectorAll("img:not([src])").forEach((element) => element.remove());
  document.querySelectorAll("*").forEach((element) => {
    [...element.attributes].forEach((attribute) => {
      if (attribute.name.toLowerCase().startsWith("on")) element.removeAttribute(attribute.name);
      if (["src", "href"].includes(attribute.name.toLowerCase()) && /^javascript:/i.test(attribute.value.trim())) element.removeAttribute(attribute.name);
    });
  });
  return document.body.innerHTML;
}

function RepresentationPreview({ item, representation, t, locale, onError }) {
  if (representation.format === "image") {
    const src = imageSource(representation.content);
    return <><img className="hero-image" src={src} alt={item.title} /><div className="preview-copy"><h2>{item.title}</h2><p>{localizedItemDetail(item, t)}{representation.byteSize ? ` · ${representation.byteSize}` : ""}</p><p>{t("detail.copied", { time: formatCopiedAt(item.createdAt, t, locale) })}</p><SourceMeta item={item} t={t} /><ImagePalette src={src} t={t} onError={onError} /><OcrPanel item={item} t={t} onError={onError} /></div></>;
  }
  if (representation.format === "files") {
    const paths = filePaths(representation.content);
    return <div className="content-preview files-preview"><span className="preview-type">{t("type.files")} · {paths.length}</span><h2>{item.title}</h2><FilesBlock paths={paths} t={t} onError={onError} /></div>;
  }
  if (representation.format === "html") {
    return <div className="content-preview rich-preview"><h2>{item.title}</h2><div className="rendered-html" dangerouslySetInnerHTML={{ __html: sanitizeClipboardHtml(representation.content) }} /></div>;
  }
  if (item.kind === "color" && representation.format === "text") {
    const rgb = hexToRgb(representation.content);
    return <div className="content-preview color-preview"><span style={{ backgroundColor: representation.content }} /><strong>{representation.content}</strong><p>{t("detail.color")}</p><div className="context-actions"><ContextButton icon={IconCopy} label={t("action.copyHex")} onClick={() => moteApi.copyText(representation.content.toUpperCase())} onError={onError} />{rgb && <ContextButton icon={IconCopy} label={t("action.copyRgb")} onClick={() => moteApi.copyText(rgb)} onError={onError} />}</div></div>;
  }
  if (representation.format === "url" || item.kind === "url") return <div className="content-preview"><span className="preview-type">{t("type.url")}</span><h2>{item.title}</h2><pre>{representation.content}</pre><div className="context-actions"><ContextButton icon={IconExternalLink} label={t("action.openLink")} onClick={() => moteApi.openExternal(representation.content)} onError={onError} /></div></div>;
  const isCode = item.kind === "code";
  return <div className={`content-preview ${isCode ? "code-preview" : ""}`}><span className="preview-type">{localizedItemDetail(item, t)}</span><h2>{item.title}</h2><pre>{representation.content}</pre></div>;
}

function SourceMeta({ item, t }) {
  if (!item.sourceAppName) return null;
  return <p className="source-app">{t("detail.sourceApp", { app: item.sourceAppName })}</p>;
}

function OcrPanel({ item, t, onError }) {
  const status = item.ocrStatus;
  if (!status || !item.representations?.some((value) => value.format === "image")) return null;
  if (["pending", "processing"].includes(status)) {
    return <section className="ocr-panel ocr-loading"><IconSparkles size={16} stroke={1.75} /><span>{t(status === "processing" ? "ocr.processing" : "ocr.pending")}</span></section>;
  }
  if (status === "empty") return <section className="ocr-panel ocr-empty"><IconSparkles size={16} stroke={1.75} /><span>{t("ocr.empty")}</span></section>;
  if (status !== "ready" || !item.ocrText) return null;
  const confidence = Number.isFinite(item.ocrConfidence) ? Math.round(item.ocrConfidence * 100) : null;
  return <details className="ocr-panel">
    <summary><span><IconSparkles size={16} stroke={1.75} />{t("ocr.title")}</span><small>{t("ocr.derived")}{confidence ? ` · ${confidence}%` : ""}</small></summary>
    <div className="ocr-content">
      <pre>{item.ocrText}</pre>
      {item.ocrHasFormula && <p className="ocr-warning"><IconAlertTriangle size={15} stroke={1.75} />{t("ocr.formulaWarning")}</p>}
      <div className="context-actions">
        <ContextButton icon={IconCopy} label={t("ocr.copyText")} onClick={() => moteApi.copyItemPlainText(item)} onError={onError} />
        <ContextButton icon={IconClipboardText} label={t("ocr.pasteText")} onClick={() => moteApi.pasteItemPlainText(item)} onError={onError} />
      </div>
      <small className="ocr-engine">{item.ocrEngine}</small>
    </div>
  </details>;
}

function FilesBlock({ paths, t, onError }) {
  const [exists, setExists] = useState(() => paths.map(() => true));
  useEffect(() => {
    let active = true;
    moteApi.checkFilePaths(paths).then((status) => active && setExists(status)).catch(() => active && setExists(paths.map(() => false)));
    return () => { active = false; };
  }, [paths.join("\n")]);
  return <div className="file-list">{paths.map((path, index) => <div className={`file-row ${exists[index] ? "" : "missing"}`} key={path}>
    <div><File size={20} /><span><strong>{path.split("/").pop() || path}</strong><small>{path}</small></span></div>
    {exists[index] ? <ContextButton icon={IconFolderOpen} label={t("action.showInFinder")} onClick={() => moteApi.revealFile(path)} onError={onError} /> : <span className="missing-file-label"><IconAlertTriangle size={16} />{t("detail.fileMissing")}</span>}
  </div>)}</div>;
}

function ContextButton({ icon: Icon, label, onClick, onError }) {
  const run = async () => {
    try { await onClick(); } catch (cause) { onError?.(String(cause)); }
  };
  return <button className="context-action" onClick={run}><Icon size={16} stroke={1.75} />{label}</button>;
}

function ImagePalette({ src, t, onError, compact = false }) {
  const [colors, setColors] = useState([]);
  const [copied, setCopied] = useState("");
  useEffect(() => {
    let active = true;
    extractPalette(src).then((values) => active && setColors(values)).catch(() => active && setColors([]));
    return () => { active = false; };
  }, [src]);
  if (!colors.length) return null;
  const copy = async (color) => {
    try {
      await moteApi.copyText(color);
      setCopied(color);
      window.setTimeout(() => setCopied(""), 1200);
    } catch (cause) { onError?.(String(cause)); }
  };
  return <section className={`image-palette ${compact ? "compact" : ""}`}><p>{t("detail.extractedColors")}</p><div>{colors.map((color) => <button key={color} onClick={() => copy(color)} title={t("action.copyColor", { color })}><span style={{ background: color }} />{!compact && <small>{copied === color ? t("action.copied") : color}</small>}</button>)}</div></section>;
}

function extractPalette(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 64; canvas.height = 64;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        context.drawImage(image, 0, 0, 64, 64);
        const data = context.getImageData(0, 0, 64, 64).data;
        const buckets = new Map();
        for (let index = 0; index < data.length; index += 16) {
          if (data[index + 3] < 180) continue;
          const rgb = [data[index], data[index + 1], data[index + 2]].map((value) => Math.min(255, Math.round(value / 32) * 32));
          const lightness = Math.max(...rgb) + Math.min(...rgb);
          if (lightness < 45 || lightness > 490) continue;
          const key = rgb.join(",");
          buckets.set(key, (buckets.get(key) || 0) + 1);
        }
        const picked = [];
        [...buckets.entries()].sort((a, b) => b[1] - a[1]).some(([key]) => {
          const rgb = key.split(",").map(Number);
          if (picked.every((value) => colorDistance(rgb, value) > 58)) picked.push(rgb);
          return picked.length === 5;
        });
        resolve(picked.map(rgbToHex));
      } catch (error) { reject(error); }
    };
    image.onerror = reject;
    image.src = src;
  });
}

function colorDistance(a, b) { return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); }
function rgbToHex(rgb) { return `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase(); }
function hexToRgb(value) {
  const match = String(value).trim().match(/^#([\da-f]{6})$/i);
  if (!match) return null;
  const number = Number.parseInt(match[1], 16);
  return `rgb(${number >> 16}, ${(number >> 8) & 255}, ${number & 255})`;
}

function formatCopiedAt(timestamp, t, locale) {
  const value = new Date(timestamp);
  const now = new Date();
  const sameDay = value.toDateString() === now.toDateString();
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(value);
  return sameDay ? t("detail.todayAt", { time }) : value.toLocaleDateString(locale);
}
