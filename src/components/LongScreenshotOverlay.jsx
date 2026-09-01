import { useEffect, useRef, useState } from "react";
import {
  IconCheck,
  IconChevronDown,
  IconPlayerPause,
  IconPlayerPlay,
  IconPhoto,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";

const articleSections = [
  ["把稍纵即逝的想法保存下来", "真正顺手的工具不会要求你先整理，再开始工作。它应该在内容出现的时候轻轻记住，等到你需要时，再把它放回手边。"],
  ["从一次复制开始", "文字、链接、图片和文件常常属于同一段思考。保持它们原来的顺序，比把内容拆散到不同工具里更重要。"],
  ["让历史记录重新成为上下文", "搜索并不只是寻找关键词。来源应用、内容类型和时间，也共同决定一条记录是不是你正在寻找的那一条。"],
  ["滚动，是阅读的一部分", "长文章不会因为屏幕高度而结束。长截图把连续阅读保留下来，也让分享、批注和归档不再需要手工拼图。"],
  ["安静，但随时可用", "好的桌面工具拥有清晰的边界：需要权限时解释原因，自动操作时允许随时暂停，完成后把控制权立即还给用户。"],
];

export function LongScreenshotOverlay({ onClose, onComplete, reduceMotion, t }) {
  const viewportRef = useRef(null);
  const [phase, setPhase] = useState("ready");
  const [progress, setProgress] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (phase !== "capturing") return undefined;
    const viewport = viewportRef.current;
    if (!viewport) return undefined;
    const timer = window.setInterval(() => {
      const maximum = Math.max(1, viewport.scrollHeight - viewport.clientHeight);
      const step = reduceMotion ? 38 : Math.max(10, Math.round(viewport.clientHeight * 0.035));
      viewport.scrollTop = Math.min(maximum, viewport.scrollTop + step);
      const nextProgress = Math.min(100, Math.round((viewport.scrollTop / maximum) * 100));
      setProgress(nextProgress);
      if (viewport.scrollTop >= maximum - 1) setPhase("review");
    }, reduceMotion ? 70 : 42);
    return () => window.clearInterval(timer);
  }, [phase, reduceMotion]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
      if (event.code === "Space" && ["capturing", "paused"].includes(phase)) {
        event.preventDefault();
        setPhase((current) => current === "capturing" ? "paused" : "capturing");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, phase]);

  const start = () => {
    viewportRef.current?.scrollTo({ top: 0 });
    setProgress(0);
    setPhase("capturing");
  };

  const finish = async () => {
    setSaving(true);
    try {
      const capture = await renderLongArticle();
      await onComplete(capture);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const status = phase === "ready"
    ? t("screenshot.ready")
    : phase === "capturing"
      ? t("screenshot.capturing", { progress })
      : phase === "paused"
        ? t("screenshot.paused")
        : t("screenshot.reachedEnd");

  return <div className="capture-overlay" role="dialog" aria-modal="true" aria-label={t("screenshot.title")}>
    <div className="capture-backdrop" />
    <section className="capture-target" aria-label={t("screenshot.recognizedWindow")}>
      <header className="capture-browser-bar">
        <span className="capture-traffic"><i /><i /><i /></span>
        <div className="capture-address"><span>mote.design</span>/journal/quiet-tools</div>
        <span className="capture-secure">Chrome</span>
      </header>
      <div className="capture-article-viewport" ref={viewportRef} onWheel={() => phase === "capturing" && setPhase("paused")}>
        <article className="capture-article">
          <nav><strong>MOTE JOURNAL</strong><span>DESIGN&nbsp;&nbsp;·&nbsp;&nbsp;WORKFLOW&nbsp;&nbsp;·&nbsp;&nbsp;CRAFT</span></nav>
          <div className="capture-article-lead">
            <p>PRODUCT NOTES · 8 MIN READ</p>
            <h1>让工具跟上思考的速度</h1>
            <p className="capture-deck">关于剪贴板、连续阅读，以及那些不应该打断注意力的细节。</p>
          </div>
          <img src="/assets/dahlia-preview.png" alt="暖色花朵" />
          <div className="capture-article-body">
            {articleSections.map(([heading, body], index) => <section key={heading}>
              <span>0{index + 1}</span><div><h2>{heading}</h2><p>{body}</p><p>{body} 当操作足够自然时，界面会退到背景，留下内容本身。</p></div>
            </section>)}
            <blockquote>工具最好的状态，是被需要时出现，完成后安静离开。</blockquote>
            <footer>© 2026 Mote Journal</footer>
          </div>
        </article>
      </div>
      <div className="capture-selection-label"><IconSparkles size={15} stroke={1.8} />{t("screenshot.recognizedWindow")}</div>
    </section>

    <aside className="capture-progress-rail" aria-label={status}>
      <div className="capture-miniature"><span style={{ height: `${Math.max(8, progress)}%` }} /></div>
      <strong>{progress}%</strong>
      <small>{t("screenshot.stitched")}</small>
    </aside>

    <div className="capture-toolbar">
      <span className={`capture-status phase-${phase}`}><i />{status}</span>
      <span className="capture-divider" />
      {phase === "ready" ? <button className="capture-primary" onClick={start}><IconChevronDown size={18} stroke={1.8} />{t("screenshot.startAuto")}</button> : <>
        {phase !== "review" && <button onClick={() => setPhase((current) => current === "capturing" ? "paused" : "capturing")}>
          {phase === "capturing" ? <IconPlayerPause size={18} stroke={1.8} /> : <IconPlayerPlay size={18} stroke={1.8} />}
          {phase === "capturing" ? t("screenshot.pause") : t("screenshot.resume")}
        </button>}
        <button className="capture-primary" disabled={saving} onClick={finish}>{phase === "review" ? <IconCheck size={18} stroke={2} /> : <IconPhoto size={18} stroke={1.8} />}{saving ? t("screenshot.saving") : t("screenshot.finish")}</button>
      </>}
      <button className="capture-close" onClick={onClose} aria-label={t("screenshot.cancel")}><IconX size={18} stroke={1.8} /></button>
    </div>
    <p className="capture-hint">{t("screenshot.hint")}</p>
  </div>;
}

async function renderLongArticle() {
  const width = 720;
  const height = 2200;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#fbfaf7";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#18181a";
  context.font = "700 17px -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText("MOTE JOURNAL", 58, 54);
  context.fillStyle = "#8a8987";
  context.font = "12px -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText("PRODUCT NOTES  ·  8 MIN READ", 58, 132);
  context.fillStyle = "#1d1d1f";
  context.font = "700 45px -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText("让工具跟上思考的速度", 58, 198);
  context.fillStyle = "#6f6e6b";
  context.font = "20px -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText("关于剪贴板、连续阅读，以及不应该打断注意力的细节。", 58, 242);
  try {
    const image = new Image();
    image.src = "/assets/dahlia-preview.png";
    await image.decode();
    context.drawImage(image, 58, 294, 604, 340);
  } catch {
    context.fillStyle = "#e8ddd3";
    context.fillRect(58, 294, 604, 340);
  }
  let y = 722;
  articleSections.forEach(([heading, body], index) => {
    context.fillStyle = "#0a84ff";
    context.font = "700 13px -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillText(`0${index + 1}`, 58, y);
    context.fillStyle = "#202024";
    context.font = "700 25px -apple-system, BlinkMacSystemFont, sans-serif";
    context.fillText(heading, 106, y);
    context.fillStyle = "#515154";
    context.font = "16px -apple-system, BlinkMacSystemFont, sans-serif";
    y = drawWrappedText(context, `${body} 当操作足够自然时，界面会退到背景，留下内容本身。`, 106, y + 39, 530, 29) + 58;
    context.fillStyle = "rgba(60,60,67,.12)";
    context.fillRect(106, y - 25, 530, 1);
  });
  context.fillStyle = "#f1eee8";
  context.fillRect(58, Math.min(y, 2030), 604, 110);
  context.fillStyle = "#3a3937";
  context.font = "600 19px -apple-system, BlinkMacSystemFont, sans-serif";
  context.fillText("工具最好的状态，是被需要时出现，完成后安静离开。", 86, Math.min(y + 60, 2090));
  return { dataUrl: canvas.toDataURL("image/png"), rgba: Array.from(context.getImageData(0, 0, width, height).data), width, height };
}

function drawWrappedText(context, text, x, y, maxWidth, lineHeight) {
  let line = "";
  for (const character of text) {
    const candidate = line + character;
    if (context.measureText(candidate).width > maxWidth && line) {
      context.fillText(line, x, y);
      line = character;
      y += lineHeight;
    } else line = candidate;
  }
  if (line) context.fillText(line, x, y);
  return y;
}
