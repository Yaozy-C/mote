import { useMemo } from "react";
import { File } from "@phosphor-icons/react";
import { imageSource } from "../services/moteApi.js";
import { localizedItemDetail } from "../i18n.js";

export function DetailPreview({ item, t, locale }) {
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
      <header><h2>{item.title}</h2><p>{t("detail.copied", { time: formatCopiedAt(item.createdAt, t, locale) })}</p></header>
      <div className="compound-items">{displayRepresentations.map((visible, index) => {
        return <section className="compound-item" key={`${visible.itemIndex ?? 0}-${visible.format}-${index}`}>
          <RepresentationBlock item={item} representation={visible} t={t} />
        </section>;
      })}</div>
    </div>;
  }

  return <RepresentationPreview item={item} representation={representation} t={t} locale={locale} />;
}

function preferredRepresentation(group) {
  return ["html", "image", "text", "url", "files", "pdf", "rtfd", "rtf"]
    .map((format) => group.find((representation) => representation.format === format))
    .find(Boolean) ?? group[0];
}

function RepresentationBlock({ item, representation, t }) {
  if (!representation) return null;
  if (representation.format === "image") return <img className="compound-image" src={imageSource(representation.content)} alt={item.title} />;
  if (representation.format === "html") return <div className="compound-html" dangerouslySetInnerHTML={{ __html: sanitizeClipboardHtml(representation.content) }} />;
  if (representation.format === "files") return <pre>{displayFileContent(representation.content)}</pre>;
  if (representation.binary) return <div className="binary-content"><File size={22} /><span>{representation.format.toUpperCase()} · {representation.byteSize ?? t("detail.item", { count: "" })}</span></div>;
  return <pre>{representation.content}</pre>;
}

function displayFileContent(content) {
  try { return JSON.parse(content).join("\n"); } catch { return decodeURI(content.replace(/^file:\/\//, "")); }
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

function RepresentationPreview({ item, representation, t, locale }) {
  if (representation.format === "image") {
    return <><img className="hero-image" src={imageSource(representation.content)} alt={item.title} /><div className="preview-copy"><h2>{item.title}</h2><p>{localizedItemDetail(item, t)}{representation.byteSize ? ` · ${representation.byteSize}` : ""}</p><p>{t("detail.copied", { time: formatCopiedAt(item.createdAt, t, locale) })}</p></div></>;
  }
  if (representation.format === "files") {
    let paths = [];
    try { paths = JSON.parse(representation.content); } catch { paths = [displayFileContent(representation.content)]; }
    return <div className="content-preview files-preview"><span className="preview-type">{t("type.files")} · {paths.length}</span><h2>{item.title}</h2>{paths.map((path) => <pre key={path}>{path}</pre>)}</div>;
  }
  if (representation.format === "html") {
    return <div className="content-preview rich-preview"><h2>{item.title}</h2><div className="rendered-html" dangerouslySetInnerHTML={{ __html: sanitizeClipboardHtml(representation.content) }} /></div>;
  }
  if (item.kind === "color" && representation.format === "text") {
    return <div className="content-preview color-preview"><span style={{ backgroundColor: representation.content }} /><strong>{representation.content}</strong><p>{t("detail.color")}</p></div>;
  }
  const isCode = item.kind === "code";
  return <div className={`content-preview ${isCode ? "code-preview" : ""}`}><span className="preview-type">{localizedItemDetail(item, t)}</span><h2>{item.title}</h2><pre>{representation.content}</pre></div>;
}

function formatCopiedAt(timestamp, t, locale) {
  const value = new Date(timestamp);
  const now = new Date();
  const sameDay = value.toDateString() === now.toDateString();
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(value);
  return sameDay ? t("detail.todayAt", { time }) : value.toLocaleDateString(locale);
}
