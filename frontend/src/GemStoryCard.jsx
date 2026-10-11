import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion as Motion } from "framer-motion";
import { toPng } from "html-to-image";
import { Check, ChevronUp, Download, Share2, X as XIcon } from "lucide-react";
import { useBackLayer } from "./backStack.js";
import "@fontsource/playfair-display/500.css";
import "@fontsource/playfair-display/600.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./GemStoryCard.css";

const W = 1080;
const H = 1920;

const STYLES = [
  { id: "noir", label: "Noir", swatch: "linear-gradient(135deg,#f2c48d,#1a1410)" },
  { id: "aurora", label: "Aurora", swatch: "linear-gradient(135deg,#8B5CF6,#22D3EE)" },
  { id: "sunset", label: "Sunset", swatch: "linear-gradient(135deg,#fb923c,#e11d48)" },
  { id: "ocean", label: "Ocean", swatch: "linear-gradient(135deg,#22d3ee,#1d4ed8)" },
  { id: "forest", label: "Forest", swatch: "linear-gradient(135deg,#86efac,#047857)" },
  { id: "rose", label: "Rose", swatch: "linear-gradient(135deg,#fda4af,#7c3aed)" },
  { id: "mono", label: "Mono", swatch: "linear-gradient(135deg,#ffffff,#111111)" },
  { id: "vintage", label: "Vintage", swatch: "linear-gradient(135deg,#e7c9a0,#6b4423)" },
  { id: "neon", label: "Neon", swatch: "linear-gradient(135deg,#e879f9,#22d3ee)" },
];

function quoteSize(len) {
  if (len < 60) return 92;
  if (len < 110) return 80;
  if (len < 180) return 68;
  if (len < 260) return 58;
  return 50;
}

export default function GemStoryCard({ gem, author, onClose }) {
  const cardRef = useRef(null);
  const [styleId, setStyleId] = useState("noir");
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [scale, setScale] = useState(0.3);
  const [failedImage, setFailedImage] = useState("");
  useBackLayer(menuOpen, () => setMenuOpen(false));
  const currentStyle = STYLES.find((style) => style.id === styleId) || STYLES[0];
  const quote = String(gem?.quote || "").trim();
  const image = gem?.sketch && typeof gem.sketch === "object" ? gem.sketch.dataUrl : null;
  const imageFailed = Boolean(image && failedImage === image);
  const hasChapter = Number.isFinite(Number(gem?.chapterNumber));
  const savedAt = new Date(gem?.createdAt || "");
  const savedAtLabel = Number.isNaN(savedAt.getTime())
    ? ""
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(savedAt);
  const fileName = `${(gem?.bookTitle || "gem").replace(/\s+/g, "-").toLowerCase()}-story.png`;
  useEffect(() => {
    const fit = () => {
      const w = window.innerWidth - 32;
      const h = window.innerHeight - 150;
      setScale(Math.max(0.1, Math.min(w / W, h / H)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  function flash(text) {
    setMsg(text);
    window.setTimeout(() => setMsg(""), 2200);
  }

  async function render() {
    await document.fonts.load('500 80px "Playfair Display"');
    await document.fonts.load('600 26px "Inter"');
    await document.fonts.ready;
    const base = { width: W, height: H, cacheBust: true, backgroundColor: "#07070b" };
    let lastError;
    for (const pixelRatio of [2, 1]) {
      try {
        const options = { ...base, pixelRatio };
        await toPng(cardRef.current, options);
        return await toPng(cardRef.current, options);
      } catch (error) { lastError = error; }
    }
    throw lastError;
  }

  function saveFile(url) {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
  }

  async function download() {
    setBusy(true);
    try { saveFile(await render()); flash("Saved to your device"); }
    catch { flash("Could not create the image"); }
    finally { setBusy(false); }
  }

  async function share() {
    setBusy(true);
    try {
      const url = await render();
      const blob = await (await fetch(url)).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({
        files: [file],
        title: gem?.bookTitle || "Reading Companion",
        text: `${gem?.bookTitle || "A saved gem"}${author && author !== "Author unknown" ? ` by ${author}` : ""} · Reading Companion ${window.location.origin}`,
      });
      else { saveFile(url); flash("Sharing not supported here - saved instead"); }
    } catch (error) {
      if (error?.name !== "AbortError") flash("Could not create the image");
    } finally { setBusy(false); }
  }

  return createPortal(
    <Motion.div className="gsc-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
      <div className="gsc-stage" style={{ width: W * scale, height: H * scale }}>
        <div className="gsc-scale" style={{ transform: `scale(${scale})` }}>
          <div className={`gsc-card ${styleId}`} ref={cardRef}>
            {image && !imageFailed ? <img className="gsc-img" src={image} alt="" onError={() => setFailedImage(image)} /> : <div className="gsc-img gsc-fallback" />}
            <div className="gsc-shade" />
            <div className="gsc-mesh" />
            <div className="gsc-frame" />
            <div className="gsc-content">
              <header className="gsc-top">
                <div className="gsc-kicker"><span className="gsc-dot" />Reading Companion</div>
                <h2>{gem?.bookTitle || "A saved gem"}</h2>
                {author && author !== "Author unknown" && <p>{author}</p>}
              </header>
              <footer className="gsc-bottom">
                <div className="gsc-mark">“</div>
                <blockquote style={{ fontSize: quoteSize(quote.length) }}>{quote}</blockquote>
                <div className="gsc-rule" />
                <div className="gsc-by">
                  {hasChapter && <span>Chapter {gem.chapterNumber}</span>}
                  <span>Saved gem</span>
                </div>
                {savedAtLabel && <div className="gsc-date">{savedAtLabel}</div>}
              </footer>
            </div>
          </div>
        </div>
      </div>

      {msg && <div className="gsc-toast" role="status">{msg}</div>}

      <Motion.div className="gsc-dock" initial={{ y: 90, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 24, delay: 0.15 }}>
        <div className="gsc-menu-wrap">
          <AnimatePresence>
            {menuOpen && (
              <Motion.div className="gsc-menu" initial={{ opacity: 0, y: 12, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.96 }} transition={{ duration: 0.18 }}>
                {STYLES.map((style) => (
                  <button key={style.id} className={`gsc-opt${style.id === styleId ? " on" : ""}`} onClick={() => { setStyleId(style.id); setMenuOpen(false); }}>
                    <span className="gsc-swatch" style={{ background: style.swatch }} />
                    <span className="gsc-opt-label">{style.label}</span>
                    {style.id === styleId && <Check size={15} />}
                  </button>
                ))}
              </Motion.div>
            )}
          </AnimatePresence>
          <button className="gsc-btn" onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-label="Choose color effect">
            <span className="gsc-swatch" style={{ background: currentStyle.swatch }} />
            <span>{currentStyle.label}</span>
            <ChevronUp size={15} style={{ transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
          </button>
        </div>
        <button className="gsc-btn icon" onClick={share} disabled={busy} aria-label="Share"><Share2 size={18} /></button>
        <button className="gsc-btn primary" onClick={download} disabled={busy}>
          <Download size={18} /><span>{busy ? "Saving…" : "Download"}</span>
        </button>
        <button className="gsc-btn icon" onClick={onClose} aria-label="Close"><XIcon size={18} /></button>
      </Motion.div>
    </Motion.div>,
    document.body,
  );
}
