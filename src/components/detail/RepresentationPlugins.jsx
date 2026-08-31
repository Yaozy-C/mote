import { useEffect, useState } from "react";
import { File } from "@phosphor-icons/react";
import { IconAlertTriangle, IconCode, IconCopy, IconExternalLink, IconFile, IconFolderOpen, IconLink, IconPhoto, IconTypography } from "@tabler/icons-react";
import { imageSource, moteApi } from "../../services/moteApi.js";
import { ContextButton, PluginSection } from "./PluginSection.jsx";
import { ImagePalette } from "./ImagePalette.jsx";
import { filePaths, hexToRgb, sanitizeClipboardHtml } from "./detailUtils.js";

function ImagePlugin({ item, representation, t, onError }) {
  const src = imageSource(representation.content);
  return <PluginSection icon={IconPhoto} title={t("type.image")} meta={representation.byteSize} className="image-plugin">
    <img src={src} alt={item.title} />
    <ImagePalette src={src} t={t} onError={onError} />
  </PluginSection>;
}

function HtmlPlugin({ representation, t }) {
  return <PluginSection icon={IconTypography} title={t("type.html")} className="html-plugin"><div className="rendered-html" dangerouslySetInnerHTML={{ __html: sanitizeClipboardHtml(representation.content) }} /></PluginSection>;
}

function TextPlugin({ item, representation, t }) {
  const isCode = item.kind === "code";
  return <PluginSection icon={isCode ? IconCode : IconTypography} title={t(isCode ? "type.code" : "type.text")} className={isCode ? "code-plugin" : "text-plugin"}><pre>{representation.content}</pre></PluginSection>;
}

function LinkPlugin({ representation, t, onError }) {
  const actions = <ContextButton compact icon={IconExternalLink} label={t("action.openLink")} onClick={() => moteApi.openExternal(representation.content)} onError={onError} />;
  return <PluginSection icon={IconLink} title={t("type.url")} actions={actions} className="link-plugin"><pre>{representation.content}</pre></PluginSection>;
}

function ColorPlugin({ representation, t, onError }) {
  const rgb = hexToRgb(representation.content);
  return <PluginSection title={t("type.color")} className="color-plugin">
    <span className="color-plugin-swatch" style={{ background: representation.content }} />
    <div><strong>{representation.content}</strong><small>{rgb}</small></div>
    <div className="context-actions"><ContextButton icon={IconCopy} label={t("action.copyHex")} onClick={() => moteApi.copyText(representation.content.toUpperCase())} onError={onError} />{rgb && <ContextButton icon={IconCopy} label={t("action.copyRgb")} onClick={() => moteApi.copyText(rgb)} onError={onError} />}</div>
  </PluginSection>;
}

function FilesPlugin({ representation, t, onError }) {
  const paths = filePaths(representation.content);
  const [exists, setExists] = useState(() => paths.map(() => true));
  useEffect(() => {
    let active = true;
    moteApi.checkFilePaths(paths).then((status) => active && setExists(status)).catch(() => active && setExists(paths.map(() => false)));
    return () => { active = false; };
  }, [representation.content]);
  return <PluginSection icon={IconFile} title={t("type.files")} meta={`${paths.length}`} className="files-plugin"><div className="file-list">{paths.map((path, index) => <div className={`file-row ${exists[index] ? "" : "missing"}`} key={path}>
    <div><File size={20} /><span><strong>{path.split("/").pop() || path}</strong><small>{path}</small></span></div>
    {exists[index] ? <ContextButton compact icon={IconFolderOpen} label={t("action.showInFinder")} onClick={() => moteApi.revealFile(path)} onError={onError} /> : <span className="missing-file-label"><IconAlertTriangle size={16} />{t("detail.fileMissing")}</span>}
  </div>)}</div></PluginSection>;
}

function BinaryPlugin({ representation }) {
  return <PluginSection icon={IconFile} title={representation.format.toUpperCase()} meta={representation.byteSize}><div className="binary-content"><File size={22} /></div></PluginSection>;
}

export const representationPlugins = [
  { id: "image", supports: ({ representation }) => representation.format === "image", Component: ImagePlugin },
  { id: "files", supports: ({ representation }) => representation.format === "files", Component: FilesPlugin },
  { id: "color", supports: ({ item, representation }) => item.kind === "color" && representation.format === "text", Component: ColorPlugin },
  { id: "link", supports: ({ item, representation }) => representation.format === "url" || item.kind === "url", Component: LinkPlugin },
  { id: "html", supports: ({ representation }) => representation.format === "html", Component: HtmlPlugin },
  { id: "binary", supports: ({ representation }) => representation.binary, Component: BinaryPlugin },
  { id: "text", supports: () => true, Component: TextPlugin },
];
