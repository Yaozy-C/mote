import { IconAlertTriangle, IconClipboardText, IconCopy, IconSparkles } from "@tabler/icons-react";
import { moteApi } from "../../services/moteApi.js";
import { ContextButton, PluginSection } from "./PluginSection.jsx";

export function OcrPlugin({ item, t, onError }) {
  const status = item.ocrStatus;
  if (!status || !item.representations?.some(({ format }) => format === "image")) return null;
  if (["pending", "processing"].includes(status)) return <PluginSection icon={IconSparkles} title={t("ocr.title")} className="ocr-plugin is-loading"><span>{t(status === "processing" ? "ocr.processing" : "ocr.pending")}</span></PluginSection>;
  if (status === "empty") return <PluginSection icon={IconSparkles} title={t("ocr.title")} className="ocr-plugin is-empty"><span>{t("ocr.empty")}</span></PluginSection>;
  if (status !== "ready" || !item.ocrText) return null;
  const confidence = Number.isFinite(item.ocrConfidence) ? Math.round(item.ocrConfidence * 100) : null;
  const actions = <><ContextButton compact icon={IconCopy} label={t("ocr.copyText")} onClick={() => moteApi.copyOcrText(item)} onError={onError} /><ContextButton compact icon={IconClipboardText} label={t("ocr.pasteText")} onClick={() => moteApi.pasteOcrText(item)} onError={onError} /></>;
  return <PluginSection icon={IconSparkles} title={t("ocr.title")} meta={`${t("ocr.derived")}${confidence ? ` · ${confidence}%` : ""}`} actions={actions} className="ocr-plugin">
    <pre>{item.ocrText}</pre>
    {item.ocrHasFormula && <p className="ocr-warning"><IconAlertTriangle size={15} stroke={1.75} />{t("ocr.formulaWarning")}</p>}
  </PluginSection>;
}
