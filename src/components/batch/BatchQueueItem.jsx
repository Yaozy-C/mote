import { imageSource } from "../../services/moteApi.js";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";

export function BatchQueueItem({ item, order, isFirst, isLast, onMoveUp, onMoveDown, t }) {
  const preview = previewModel(item);
  return (
    <li className={`batch-queue-item batch-kind-${preview.kind}`}>
      <span className="batch-order">{order}</span>
      <article className="batch-item-content">
        {preview.image && <ImageContent src={preview.image} />}
        {preview.color && <ColorContent value={preview.color} />}
        {preview.text && <TextContent text={preview.text} code={preview.kind === "code"} />}
      </article>
      <span className="batch-reorder" aria-label={t("multi.reorder")}>
        <button disabled={isFirst} onClick={onMoveUp} aria-label={t("multi.moveUp")} title={t("multi.moveUp")}><IconChevronUp size={16} stroke={1.75} /></button>
        <button disabled={isLast} onClick={onMoveDown} aria-label={t("multi.moveDown")} title={t("multi.moveDown")}><IconChevronDown size={16} stroke={1.75} /></button>
      </span>
    </li>
  );
}

export function batchPreviewKind(item) {
  return previewModel(item).kind;
}

function ImageContent({ src }) {
  return <img className="batch-content-image" src={imageSource(src)} alt="" />;
}

function ColorContent({ value }) {
  return <span className="batch-content-color" style={{ backgroundColor: value }} aria-hidden="true" />;
}

function TextContent({ text, code }) {
  return code ? <pre className="batch-content-code">{text}</pre> : <p className="batch-content-text">{text}</p>;
}

function previewModel(item) {
  const representations = item.representations?.length ? item.representations : [{ format: item.kind, content: item.content }];
  const image = representations.find((representation) => representation.format === "image")?.content;
  const textRepresentation = representations.find((representation) => ["text", "url", "files", "html"].includes(representation.format));
  const format = textRepresentation?.format ?? item.kind;
  const text = readableContent(textRepresentation?.content ?? (item.kind === "image" ? "" : item.content), format);
  const color = item.kind === "color" ? item.content : null;
  const kind = image && text ? "compound" : image ? "image" : color ? "color" : item.kind === "code" ? "code" : format === "files" ? "files" : "text";
  return { kind, image, color, text };
}

function readableContent(content, format) {
  if (!content) return "";
  if (format === "files") {
    try {
      return JSON.parse(content).map(fileName).join("\n");
    } catch {
      return fileName(content);
    }
  }
  if (format === "html") {
    const document = new DOMParser().parseFromString(content, "text/html");
    return document.body.textContent?.replace(/\s+/g, " ").trim() || content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return String(content).trim();
}

function fileName(path) {
  return decodeURI(String(path).replace(/^file:\/\//, "")).split("/").pop();
}
