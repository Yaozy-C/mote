import { BracketsCurly, FileHtml, LinkSimple, Stack, TextT } from "@phosphor-icons/react";
import { imageSource } from "../services/moteApi.js";

export function TypeBadge({ item }) {
  if (item.kind === "image") return <img className="item-thumb" src={imageSource(item.content)} alt={item.title} />;
  if (item.kind === "color") return <span className="type-badge color-swatch" style={{ backgroundColor: item.content }} />;
  const Icon = item.kind === "mixed" ? Stack : item.kind === "url" ? LinkSimple : item.kind === "code" ? BracketsCurly : item.kind === "html" ? FileHtml : TextT;
  return <span className={`type-badge type-${item.kind}`}><Icon size={30} weight={item.kind === "url" ? "bold" : "regular"} /></span>;
}
