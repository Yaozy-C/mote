import { useEffect, useState } from "react";
import { moteApi } from "../../services/moteApi.js";

export function ImagePalette({ src, t, onError }) {
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
  return <div className="image-palette"><span>{t("detail.extractedColors")}</span><div>{colors.map((color) => <button key={color} onClick={() => copy(color)} title={t("action.copyColor", { color })}>
    <i style={{ background: color }} /><small>{copied === color ? t("action.copied") : color}</small>
  </button>)}</div></div>;
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
          if (picked.every((value) => Math.hypot(...rgb.map((channel, i) => channel - value[i])) > 58)) picked.push(rgb);
          return picked.length === 5;
        });
        resolve(picked.map((rgb) => `#${rgb.map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase()));
      } catch (error) { reject(error); }
    };
    image.onerror = reject;
    image.src = src;
  });
}
