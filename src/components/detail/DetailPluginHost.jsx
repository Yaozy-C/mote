import { useMemo } from "react";
import { OcrPlugin } from "./OcrPlugin.jsx";
import { representationPlugins } from "./RepresentationPlugins.jsx";
import { formatCopiedAt, getRepresentations, pluginRepresentations } from "./detailUtils.js";

export function DetailPluginHost({ item, t, locale, onError }) {
  const representations = useMemo(() => getRepresentations(item), [item]);
  const visible = useMemo(() => pluginRepresentations(representations), [representations]);
  return <article className="detail-plugin-host">
    <header className="detail-host-header">
      <div><h2>{item.title}</h2><p>{t("detail.copied", { time: formatCopiedAt(item.createdAt, t, locale) })}</p></div>
      {item.sourceAppName && <span>{t("detail.sourceApp", { app: item.sourceAppName })}</span>}
    </header>
    <div className="detail-plugin-stack">{visible.map((representation, index) => {
      const plugin = representationPlugins.find(({ supports }) => supports({ item, representation }));
      const Component = plugin.Component;
      return <Component key={`${representation.itemIndex ?? 0}-${representation.format}-${index}`} item={item} representation={representation} t={t} onError={onError} />;
    })}</div>
    <OcrPlugin item={item} t={t} onError={onError} />
  </article>;
}
