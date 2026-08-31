export function getRepresentations(item) {
  return item.representations?.length ? item.representations : [{
    itemIndex: 0,
    format: item.kind === "image" ? "image" : item.kind === "html" ? "html" : "text",
    content: item.content,
    byteSize: item.byteSize,
  }];
}

export function pluginRepresentations(representations) {
  const groups = Object.values(representations.reduce((result, representation) => {
    const key = representation.itemIndex ?? 0;
    (result[key] ??= []).push(representation);
    return result;
  }, {}));
  return groups.flatMap((group) => {
    const image = group.find(({ format }) => format === "image");
    const richText = group.find(({ format }) => format === "html");
    const fallback = group.find(({ format }) => ["text", "url", "files"].includes(format));
    return [image, richText ?? fallback].filter(Boolean);
  });
}

export function filePaths(content) {
  try { return JSON.parse(content).map(normalizeFilePath); }
  catch { return [normalizeFilePath(content)]; }
}

function normalizeFilePath(value) {
  try { return decodeURI(String(value).replace(/^file:\/\//, "")); }
  catch { return String(value).replace(/^file:\/\//, ""); }
}

export function sanitizeClipboardHtml(html) {
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

export function hexToRgb(value) {
  const match = String(value).trim().match(/^#([\da-f]{6})$/i);
  if (!match) return null;
  const number = Number.parseInt(match[1], 16);
  return `rgb(${number >> 16}, ${(number >> 8) & 255}, ${number & 255})`;
}

export function formatCopiedAt(timestamp, t, locale) {
  const value = new Date(timestamp);
  const now = new Date();
  const time = new Intl.DateTimeFormat(locale, { hour: "numeric", minute: "2-digit" }).format(value);
  return value.toDateString() === now.toDateString() ? t("detail.todayAt", { time }) : value.toLocaleDateString(locale);
}
