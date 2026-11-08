"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseStockText } from "@/lib/stock-parse";
import type { Analysis } from "@/lib/ai-product";
import { BACKGROUNDS, PROMO_FORMATS, compose, cutOut, makePromo, preloadCutout, type BgId, type Cutout, type PromoFormat } from "@/lib/bg-remove";
import { analyzePhotosAction, createFromAiAction, parseStockAction, rewriteAction, uploadPhotosAction, type AnalyzeResult } from "./actions";

/* Quick add with AI – full-screen, mobile-first, 5 steps exactly like the NEXSHOP mockup:
   צילום → זיהוי → רקע → מלאי → אישור. Everything is editable; nothing goes live without "פרסום באתר". */

export type WizColor = { key: string; label: string; hex: string };
export type WizProduct = { id: number; name: string; image: string; price: number; category: string; heel: number | null; colors: string[] };

type Photo = { id: string; file: File; url: string };
type Step = 0 | 1 | 2 | 3 | 4;
const STEP_NAMES = ["צילום", "זיהוי", "תמונות", "מלאי", "אישור"];
const STEP_DONE = ["#006AFF", "#3B3DFF", "#5A28FF", "#9A0EE8", "#FF01BB"];
const STEP_NOW = [
  "linear-gradient(90deg,#006AFF,#7A12FF)",
  "linear-gradient(90deg,#3B3DFF,#7A12FF)",
  "linear-gradient(90deg,#5A28FF,#7A12FF)",
  "linear-gradient(90deg,#7A12FF,#B30BD8)",
  "linear-gradient(90deg,#C412A6,#FF01BB)",
];
const TONES = [
  { key: "short", label: "קצר יותר" },
  { key: "luxury", label: "יוקרתי" },
  { key: "young", label: "צעיר וקליל" },
  { key: "warm", label: "חם ואישי" },
];
const MAX_PHOTOS = 6;
const LOW = 3;
const GRAD = "linear-gradient(110deg,#006AFF,#7A12FF 55%,#C412A6)";
const sh = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");

/* ---------- small icons ---------- */
const I = {
  close: "M6 6l12 12M18 6L6 18",
  back: "M9 6l6 6-6 6",
  next: "M15 6l-6 6 6 6",
  plus: "M12 5v14M5 12h14",
  gallery: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6",
  mic: "M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0M12 18v3",
  check: "M5 12l5 5 9-10",
  alert: "M12 8v5M12 17h.01",
  zap: "M13 3L4 14h7l-1 7 9-11h-7z",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  keyboard: "M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M7 14h10",
};
function Ico({ d, size = 20, sw = 2, className = "" }: { d: string; size?: number; sw?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={d} />
    </svg>
  );
}

/** Shrink a photo in the browser (JPEG) so uploads are fast on mobile data. */
async function shrink(file: Blob, max = 1600, name = "photo"): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.86));
    if (!blob) throw new Error("encode");
    return new File([blob], name + ".jpg", { type: "image/jpeg" });
  } catch {
    return file instanceof File ? file : new File([file], name + ".jpg", { type: file.type || "image/jpeg" });
  }
}

export default function AiWizard({
  colors,
  sizes,
  categories,
  products,
  focus,
  aiReady,
  storageReady,
  storeName = "",
}: {
  colors: WizColor[];
  sizes: string[];
  categories: { key: string; name: string }[];
  products: WizProduct[];
  focus: WizProduct | null;
  aiReady: boolean;
  storageReady: boolean;
  storeName?: string;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);

  // draft
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [color, setColor] = useState("");
  const [colorOpen, setColorOpen] = useState(false);
  const [mode, setMode] = useState<"new" | "addColor">(focus ? "addColor" : "new");
  const [matchId, setMatchId] = useState<number | null>(focus?.id ?? null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [category, setCategory] = useState(focus?.category || categories[0]?.key || "boots");
  const [heel, setHeel] = useState<string>(focus?.heel != null ? String(focus.heel) : "");
  const [price, setPrice] = useState<string>(focus ? String(focus.price) : "");
  const [priceBasis, setPriceBasis] = useState("");
  const [urls, setUrls] = useState<string[]>([]);

  // background
  const [bg, setBg] = useState<BgId>("quality");
  const [applyAll, setApplyAll] = useState(true);
  const [cut, setCut] = useState<Record<string, Cutout | "error">>({});
  const [bgPreview, setBgPreview] = useState<string | null>(null);
  const [improve, setImprove] = useState(true);
  const [split, setSplit] = useState(55);
  const [mainFile, setMainFile] = useState<File | null>(null);
  // marketing
  const [headline, setHeadline] = useState("חדש בחנות");
  const [promos, setPromos] = useState<{ id: PromoFormat; name: string; url: string; file: File }[]>([]);
  const [cutting, setCutting] = useState(false);

  // stock
  const [grid, setGrid] = useState<Record<string, Record<string, string>>>({});
  const [stockText, setStockText] = useState("");
  const [heard, setHeard] = useState("");
  const [understood, setUnderstood] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(false);
  const recRef = useRef<any>(null);

  // camera
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camState, setCamState] = useState<"off" | "on" | "denied">("off");
  const [flash, setFlash] = useState(false);
  const camInput = useRef<HTMLInputElement>(null);
  const galInput = useRef<HTMLInputElement>(null);

  const label = (k: string) => colors.find((c) => c.key === k)?.label || k;
  const hex = (k: string) => colors.find((c) => c.key === k)?.hex || "#ccc";
  const match = products.find((p) => p.id === matchId) || null;
  const catName = (k: string) => categories.find((c) => c.key === k)?.name || k;

  useEffect(() => {
    setSpeechOk(typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = "";
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /* ================= 1. camera ================= */

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamState((s) => (s === "on" ? "off" : s));
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setCamState("denied");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCamState("on");
    } catch {
      setCamState("denied");
    }
  }, []);

  useEffect(() => {
    if (step === 0 && camState === "off") startCamera();
    if (step !== 0) stopCamera();
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  function addFiles(list: FileList | File[] | null) {
    const files = Array.from((list || []) as ArrayLike<File>).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setPhotos((cur) => [...cur, ...files.map((f) => ({ id: Math.random().toString(36).slice(2), file: f, url: URL.createObjectURL(f) }))].slice(0, MAX_PHOTOS));
    setError(null);
  }

  async function shoot() {
    if (photos.length >= MAX_PHOTOS) return setError(`עד ${MAX_PHOTOS} תמונות`);
    const v = videoRef.current;
    if (camState !== "on" || !v || !v.videoWidth) return camInput.current?.click();
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const blob: Blob | null = await new Promise((res) => c.toBlob(res, "image/jpeg", 0.92));
    if (!blob) return;
    setFlash(true);
    setTimeout(() => setFlash(false), 160);
    addFiles([new File([blob], `shot-${Date.now()}.jpg`, { type: "image/jpeg" })]);
  }

  async function analyze() {
    if (!photos.length) return setError("צלמי או בחרי לפחות תמונה אחת");
    setError(null);
    setBusy(aiReady ? "ה־AI מזהה את המוצר…" : "מכינה…");
    preloadCutout().catch(() => {});
    try {
      const fd = new FormData();
      for (const p of photos.slice(0, 4)) fd.append("photos", await shrink(p.file, 1280));
      if (focus) fd.append("focusProductId", String(focus.id));
      const r: AnalyzeResult = await analyzePhotosAction(fd);
      if (!r.ok) return setError(r.error || "משהו השתבש");
      setAiNote(r.aiError || null);
      const a = r.analysis || null;
      setAnalysis(a);
      if (a) {
        if (a.color) setColor(a.color);
        setBg(a.background || "quality");
        if (!focus) {
          setName(a.title);
          setDescription(a.description);
          setSeoTitle(a.seoTitle);
          setSeoDescription(a.seoDescription);
          setCategory(a.category);
          if (a.heelCm != null) setHeel(String(a.heelCm));
        }
        const mId = focus?.id ?? (a.matchProductId && a.matchConfidence >= 0.5 ? a.matchProductId : null);
        setMatchId(mId);
        setMode(mId ? "addColor" : "new");
        const m = mId ? products.find((p) => p.id === mId) : null;
        if (m) setPrice(String(m.price));
      }
      if (r.price?.price && !price) setPrice(String(r.price.price));
      if (r.price?.basis) setPriceBasis(r.price.basis);
      setStep(1);
    } catch (e) {
      console.error(e);
      setError("משהו השתבש. בדקי את החיבור ונסי שוב.");
    } finally {
      setBusy(null);
    }
  }

  /* ================= 2. copy ================= */

  async function rewrite(tone: string) {
    setBusy("מנסחת מחדש…");
    const facts = [label(color), analysis?.productType, analysis?.material, analysis?.heelType, heel ? `עקב ${heel} ס״מ` : "", ...(analysis?.features || [])].filter(Boolean).join(", ");
    const r = await rewriteAction({ title: name, description, tone, facts }).catch(() => ({ error: "הניסוח נכשל" }) as any);
    setBusy(null);
    if (r.error) return setError(r.error);
    setError(null);
    setName(r.title || name);
    setDescription(r.description || description);
  }

  /* ================= 3. background ================= */

  const main = photos[0];
  // cut out the main photo when the step opens
  useEffect(() => {
    if (step !== 2 || !main || cut[main.id]) return;
    let alive = true;
    setCutting(true);
    cutOut(main.file)
      .then((c) => alive && setCut((m) => ({ ...m, [main.id]: c })))
      .catch((e) => {
        console.error(e);
        if (alive) setCut((m) => ({ ...m, [main.id]: "error" }));
      })
      .finally(() => alive && setCutting(false));
    return () => {
      alive = false;
    };
  }, [step, main?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // live preview on the chosen background
  useEffect(() => {
    if (step !== 2 || !main) return;
    const c = cut[main.id];
    if ((bg === "original" && !improve) || !c || c === "error") {
      setBgPreview(null);
      return;
    }
    let alive = true;
    let made: string | null = null;
    compose(c, bg, 900, "preview", improve).then(({ url }) => {
      made = url;
      if (alive) setBgPreview(url);
      else URL.revokeObjectURL(url);
    });
    return () => {
      alive = false;
      if (made) setTimeout(() => URL.revokeObjectURL(made!), 2000);
    };
  }, [step, bg, improve, cut, main?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const mainCutFailed = main && cut[main.id] === "error";

  async function finishBackground() {
    if (!storageReady) return setError("אחסון התמונות לא מחובר, ולכן אי אפשר לשמור צילומים.");
    setError(null);
    setBusy(mainCutFailed || (bg === "original" && !improve) ? "שומרת את התמונות…" : "מכינה תמונות ברמת סטודיו…");
    try {
      const fd = new FormData();
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const wantsBg = (bg !== "original" || improve) && (applyAll || i === 0);
        let file: File | null = null;
        if (wantsBg) {
          try {
            let c = cut[p.id];
            if (!c) {
              c = await cutOut(p.file).catch(() => "error" as const);
              setCut((m) => ({ ...m, [p.id]: c! }));
            }
            if (c && c !== "error") file = (await compose(c, bg, 1600, `p${i + 1}`, improve)).file;
          } catch (e) {
            console.error(e);
          }
        }
        const final = file || (await shrink(p.file, 1600, `p${i + 1}`));
        if (i === 0) setMainFile(final);
        fd.append("photos", final);
      }
      setBusy("שומרת את התמונות…");
      const r = await uploadPhotosAction(fd);
      if (r.error || !r.urls) return setError(r.error || "העלאת התמונות נכשלה");
      setUrls(r.urls);
      setStep(3);
    } finally {
      setBusy(null);
    }
  }

  async function makePromos() {
    const src = mainFile || main?.file;
    if (!src) return;
    setBusy("מכינה תמונות שיווק…");
    try {
      promos.forEach((p) => URL.revokeObjectURL(p.url));
      const title = mode === "addColor" ? match?.name || name : name;
      const out: { id: PromoFormat; name: string; url: string; file: File }[] = [];
      for (const f of PROMO_FORMATS) {
        const r = await makePromo(src, f.id, { headline: headline.trim(), name: title || "", price: Number(price) > 0 ? sh(Number(price)) : "", store: storeName, cta: "לקנייה באתר" });
        out.push({ id: f.id, name: f.name, url: r.url, file: r.file });
      }
      setPromos(out);
    } catch (e) {
      console.error(e);
      setError("לא הצלחתי להכין את תמונות השיווק");
    } finally {
      setBusy(null);
    }
  }

  async function sharePromo(file: File) {
    try {
      if ((navigator as any).canShare?.({ files: [file] })) await (navigator as any).share({ files: [file] });
    } catch {}
  }

  /* ================= 4. stock ================= */

  const colorRows = useMemo(() => Array.from(new Set([color, ...Object.keys(grid)].filter(Boolean))), [color, grid]);
  const allSizes = useMemo(() => {
    const extra = new Set<string>();
    Object.values(grid).forEach((r) => Object.keys(r).forEach((s) => !sizes.includes(s) && extra.add(s)));
    return [...sizes, ...Array.from(extra).sort((a, b) => Number(a) - Number(b))];
  }, [grid, sizes]);
  const q = (c: string, s: string) => (/^\d+$/.test(grid[c]?.[s] || "") ? Number(grid[c][s]) : 0);
  const total = colorRows.reduce((a, c) => a + allSizes.reduce((x, s) => x + q(c, s), 0), 0);
  const stockedColors = colorRows.filter((c) => allSizes.some((s) => q(c, s) > 0));
  const stockedSizes = allSizes.filter((s) => colorRows.some((c) => q(c, s) > 0));
  const setCell = (c: string, s: string, v: string) => setGrid((g) => ({ ...g, [c]: { ...(g[c] || {}), [s]: v.replace(/[^0-9]/g, "").slice(0, 4) } }));
  const mergeStock = (st: Record<string, Record<string, number>>) =>
    setGrid((g) => {
      const out = { ...g };
      for (const [c, row] of Object.entries(st)) {
        out[c] = { ...(out[c] || {}) };
        for (const [s, n] of Object.entries(row)) out[c][s] = String(n);
      }
      return out;
    });
  const preview = useMemo(() => (stockText.trim() ? parseStockText(stockText, colors, sizes, color || colors[0]?.key || "black") : null), [stockText, colors, sizes, color]);

  async function applyText(text = stockText) {
    if (!text.trim()) return;
    setBusy("מבינה את הכמויות…");
    const r = await parseStockAction({ text, defaultColor: color }).catch(() => ({ error: "לא הצלחתי להבין" }) as any);
    setBusy(null);
    if (r.error) return setError(r.error);
    setError(null);
    mergeStock(r.stock || {});
    setHeard(text.trim());
    setUnderstood(true);
    setStockText("");
  }

  function toggleMic() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) return recRef.current?.stop();
    const rec = new SR();
    rec.lang = "he-IL";
    rec.interimResults = true;
    rec.continuous = true;
    let finalText = "";
    setHeard("");
    setUnderstood(false);
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t + " ";
        else interim += t;
      }
      setHeard((finalText + interim).trim());
    };
    rec.onerror = (e: any) => {
      setListening(false);
      if (e?.error === "not-allowed") setError("אין הרשאה למיקרופון. אפשר להקליד במקום.");
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) applyText(finalText.trim());
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  /* ================= 5. save ================= */

  async function save(publish: boolean) {
    setError(null);
    if (!color) return setError("בחרי צבע");
    if (mode === "new" && !name.trim()) return setError("חסר שם למוצר");
    if (mode === "new" && !(Number(price) > 0)) return setError("חסר מחיר");
    setBusy(publish ? "מפרסמת…" : "שומרת…");
    const stock: Record<string, Record<string, number>> = {};
    for (const c of colorRows) for (const s of allSizes) if (q(c, s) > 0) (stock[c] = stock[c] || {})[s] = q(c, s);
    const r = await createFromAiAction({
      mode,
      matchId,
      color,
      images: urls,
      stock,
      name,
      description,
      seoTitle,
      seoDescription,
      category,
      heel: heel === "" ? null : Number(heel),
      price: Number(price),
      cost: null,
      publish,
    }).catch(() => ({ error: "השמירה נכשלה" }) as any);
    if (r.error || !r.id) {
      setBusy(null);
      return setError(r.error || "השמירה נכשלה");
    }
    router.push(`/admin/products/${r.id}?saved=1&ai=1`);
  }

  /* ================= navigation ================= */

  const go = (s: Step) => {
    setError(null);
    setStep(s);
  };
  const back = () => (step > 0 ? go((step - 1) as Step) : router.push(focus ? `/admin/products/${focus.id}` : "/admin/products"));
  const canIdentifyNext = !!color && (mode === "addColor" ? !!matchId : !!name.trim());

  const conf = analysis?.colorConfidence ?? 1;
  const unsure = !!analysis && !!analysis.color && (conf < 0.75 || analysis.colorAlternatives.length > 0);
  const colorChoices = unsure ? Array.from(new Set([analysis!.color, ...analysis!.colorAlternatives])) : [];
  const recommended: BgId = analysis?.background || "quality";
  const bgName = (id: BgId) => BACKGROUNDS.find((b) => b.id === id)?.name || "";
  const lowCells = colorRows.flatMap((c) => allSizes.filter((s) => q(c, s) > 0 && q(c, s) <= LOW).map((s) => ({ c, s, n: q(c, s) })));

  const TITLES = [focus ? `צבע חדש ל"${focus.name}"` : "מוצר חדש עם AI", analysis ? "ה־AI זיהה את המוצר" : "פרטי המוצר", "תמונות למוצר", "כמה יש במלאי?", "הכל מוכן לפרסום"];

  /* ================= UI ================= */

  const field = "rounded-[14px] border border-white/15 bg-white/[.06] text-white px-3.5 text-[15px] placeholder:text-[#8F89B3] focus:outline-none focus:border-[#A07CFF] focus:ring-2 focus:ring-[#7A12FF]/40";

  return (
    <div className="fixed inset-0 z-[80] bg-[#07051A] text-white [color-scheme:dark]" dir="rtl" style={{ fontFamily: "Heebo, system-ui, sans-serif" }}>
      <div className="mx-auto h-[100dvh] max-w-[480px] flex flex-col">
        {/* header */}
        <header className="flex items-center justify-between gap-3 px-[18px] pt-[max(18px,env(safe-area-inset-top))] pb-2.5">
          <button type="button" onClick={back} aria-label={step === 0 ? "סגירה" : "חזרה"} className="w-11 h-11 rounded-[14px] border border-white/15 bg-white/[.06] flex items-center justify-center hover:bg-white/10">
            <Ico d={step === 0 ? I.close : I.back} />
          </button>
          <div className="flex flex-col items-center gap-0.5 min-w-0">
            <b className="text-[17px] truncate max-w-[240px]">{TITLES[step]}</b>
            <span className="text-[12px] text-[#B4AED6]">שלב {step + 1} מתוך 5 · {STEP_NAMES[step]}</span>
          </div>
          <img src="/brand/nexshop-mark-v2.png" alt="NEXSHOP" className="w-11 h-11 object-contain" />
        </header>
        <div className="grid grid-cols-5 gap-1.5 px-[18px] pb-3.5" role="progressbar" aria-valuemin={1} aria-valuemax={5} aria-valuenow={step + 1} aria-label="התקדמות">
          {STEP_NAMES.map((_, i) => (
            <span key={i} className="h-1 rounded" style={{ background: i < step ? STEP_DONE[i] : i === step ? STEP_NOW[i] : "rgba(255,255,255,.14)" }} />
          ))}
        </div>

        {error && (
          <div role="alert" className="mx-4 mb-2 px-3.5 py-2.5 rounded-[14px] bg-[#FF4D7A]/15 border border-[#FF4D7A]/45 text-[14px] text-[#FFD0DC]">
            {error}
          </div>
        )}

        {/* ---------------- 1. photos ---------------- */}
        {step === 0 && (
          <>
            <input ref={camInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <input ref={galInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            <div className="relative mx-3.5 flex-1 min-h-0 rounded-[26px] overflow-hidden bg-[linear-gradient(180deg,#5E4636_0%,#3B2B22_58%,#2A1E18_100%)]">
              <video ref={videoRef} playsInline muted className={`absolute inset-0 w-full h-full object-cover ${camState === "on" ? "" : "hidden"}`} />
              {camState !== "on" && photos[0] && <img src={photos[0].url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />}
              {camState !== "on" && !photos[0] && (
                <button type="button" onClick={() => camInput.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-[#EDE6DF]">
                  <span className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>
                  </span>
                  <b className="text-[15px]">{camState === "denied" ? "פתיחת המצלמה" : "מפעילה מצלמה…"}</b>
                </button>
              )}
              {flash && <span className="absolute inset-0 bg-white/80" aria-hidden="true" />}
              {/* corners */}
              <span className="pointer-events-none absolute top-[18px] right-[18px] w-[34px] h-[34px] border-t-[3px] border-r-[3px] border-white rounded-tr-[10px]" />
              <span className="pointer-events-none absolute top-[18px] left-[18px] w-[34px] h-[34px] border-t-[3px] border-l-[3px] border-white rounded-tl-[10px]" />
              <span className="pointer-events-none absolute bottom-[18px] right-[18px] w-[34px] h-[34px] border-b-[3px] border-r-[3px] border-white rounded-br-[10px]" />
              <span className="pointer-events-none absolute bottom-[18px] left-[18px] w-[34px] h-[34px] border-b-[3px] border-l-[3px] border-white rounded-bl-[10px]" />
              <div className="pointer-events-none absolute top-[26px] left-1/2 -translate-x-1/2 flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#07051A]/70 border border-white/15 whitespace-nowrap text-[14px]">
                <span className="w-[9px] h-[9px] rounded-full bg-[#FF01BB] nx-pulse" />
                {photos.length ? (
                  <>ה־AI יזהה: <b>{photos.length} תמונות מוכנות</b></>
                ) : (
                  <>כוונו את המצלמה <b>למוצר</b></>
                )}
              </div>
              <div className="pointer-events-none absolute bottom-[30px] inset-x-0 text-center text-[13px] text-[#EDE6DF] px-6 [text-shadow:0_1px_6px_rgba(0,0,0,.6)]">
                צלמו כל מוצר, באור טבעי. הרקע לא משנה.
              </div>
            </div>

            <div className="flex gap-2 px-[18px] pt-3.5 pb-1 items-center overflow-x-auto">
              <span className="text-[13px] text-[#B4AED6] me-1 whitespace-nowrap">{photos.length} תמונות</span>
              {photos.map((p, i) => (
                <span key={p.id} className="relative shrink-0">
                  <button type="button" onClick={() => setPhotos((a) => [a[i], ...a.filter((_, k) => k !== i)])} aria-label={i === 0 ? "תמונה ראשית" : `לקבוע את תמונה ${i + 1} כראשית`} className={`block w-[54px] h-[54px] rounded-xl overflow-hidden ${i === 0 ? "border-2 border-[#8F5BFF]" : "border border-white/10"}`}>
                    <img src={p.url} alt="" className="w-full h-full object-cover" />
                  </button>
                  <button type="button" onClick={() => setPhotos((a) => a.filter((x) => x.id !== p.id))} aria-label={`הסרת תמונה ${i + 1}`} className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full bg-[#07051A] border border-white/25 flex items-center justify-center">
                    <Ico d={I.close} size={12} sw={2.4} />
                  </button>
                </span>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button type="button" onClick={() => galInput.current?.click()} aria-label="הוספת תמונה" className="shrink-0 w-[54px] h-[54px] rounded-xl border-[1.5px] border-dashed border-white/30 flex items-center justify-center text-[#B4AED6]">
                  <Ico d={I.plus} />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between px-[26px] pt-3.5 pb-[max(30px,env(safe-area-inset-bottom))]">
              <button type="button" onClick={() => galInput.current?.click()} className="h-12 px-4 rounded-[14px] border border-white/15 bg-white/[.06] text-[14px] font-semibold flex items-center gap-2">
                <Ico d={I.gallery} size={18} sw={1.8} /> גלריה
              </button>
              <button type="button" onClick={shoot} aria-label="צילום" className="w-[78px] h-[78px] rounded-full p-1 bg-[linear-gradient(135deg,#006AFF,#7A12FF_55%,#FF01BB)] active:scale-95 transition-transform">
                <span className="block w-full h-full rounded-full bg-white border-4 border-[#07051A]" />
              </button>
              <button type="button" onClick={analyze} disabled={!photos.length || !!busy} className="h-12 px-4 rounded-[14px] bg-white text-[#07051A] text-[14px] font-bold flex items-center gap-1.5 disabled:opacity-40">
                המשך <Ico d={I.next} size={16} sw={2.2} />
              </button>
            </div>
          </>
        )}

        {/* ---------------- 2. identify ---------------- */}
        {step === 1 && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 flex flex-col gap-3">
              {aiNote && <div className="px-3.5 py-2.5 rounded-[14px] bg-[#FFD27A]/10 border border-[#FFD27A]/35 text-[13px] text-[#FFE3A8]">{aiNote}</div>}
              {analysis && !analysis.isProduct && <div className="px-3.5 py-2.5 rounded-[14px] bg-[#FFD27A]/10 border border-[#FFD27A]/35 text-[13px] text-[#FFE3A8]">ה־AI לא בטוח שבתמונות יש מוצר. בדקי את הפרטים.</div>}

              <div className="flex gap-3 items-center">
                <div className="w-[104px] h-[104px] shrink-0 rounded-[18px] bg-[#F4F2EE] overflow-hidden flex items-center justify-center">
                  {main && <img src={main.url} alt="" className="w-full h-full object-cover" />}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {analysis?.productType && <span className="px-2.5 py-1.5 rounded-full bg-white/[.08] text-[13px]">סוג: <b>{analysis.productType}</b></span>}
                  {analysis?.material && <span className="px-2.5 py-1.5 rounded-full bg-white/[.08] text-[13px]">חומר: <b>{analysis.material}</b></span>}
                  {(analysis?.heelType || heel) && (
                    <span className="px-2.5 py-1.5 rounded-full bg-white/[.08] text-[13px]">
                      עקב: <b>{[analysis?.heelType, heel ? `כ־${heel} ס״מ` : ""].filter(Boolean).join(" · ")}</b>
                    </span>
                  )}
                  <span className="px-2.5 py-1.5 rounded-full bg-white/[.08] text-[13px]">קטגוריה: <b>{catName(category)}</b></span>
                  {!analysis && <span className="text-[13px] text-[#B4AED6]">ממלאים ידנית: צבע, שם ותיאור.</span>}
                </div>
              </div>

              {/* colour */}
              {unsure && !colorOpen ? (
                <div className="px-3.5 py-3 rounded-2xl bg-[#FFD27A]/10 border border-[#FFD27A]/35 flex flex-col gap-2">
                  <span className="text-[14px] text-[#FFE3A8]">
                    <b>שאלה קטנה:</b> הצבע הוא {colorChoices.map(label).join(" או ")}?
                  </span>
                  <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="צבע">
                    {colorChoices.map((k) => (
                      <button key={k} type="button" role="radio" aria-checked={color === k} onClick={() => setColor(k)} className={`h-10 px-3.5 rounded-xl text-[14px] flex items-center gap-2 ${color === k ? "border-2 border-white bg-white/10 font-bold" : "border border-white/20"}`}>
                        <span className="w-4 h-4 rounded-full border border-white/30" style={{ background: hex(k) }} />
                        {label(k)}
                      </button>
                    ))}
                    <button type="button" onClick={() => setColorOpen(true)} className="h-10 px-3 rounded-xl text-[13px] text-[#E3D6FF] border border-white/15">צבע אחר</button>
                  </div>
                </div>
              ) : !color || colorOpen ? (
                <fieldset className="px-3.5 py-3 rounded-2xl bg-white/[.05] border border-white/[.12] flex flex-col gap-2">
                  <legend className="sr-only">צבע</legend>
                  <span className="text-[14px] font-semibold text-[#DDD8F5]">באיזה צבע?</span>
                  <div className="flex gap-2 flex-wrap" role="radiogroup" aria-label="צבע">
                    {colors.map((c) => (
                      <button key={c.key} type="button" role="radio" aria-checked={color === c.key} onClick={() => { setColor(c.key); setColorOpen(false); }} className={`h-10 px-3 rounded-xl text-[14px] flex items-center gap-2 ${color === c.key ? "border-2 border-white bg-white/10 font-bold" : "border border-white/20"}`}>
                        <span className="w-4 h-4 rounded-full border border-white/30" style={{ background: c.hex }} />
                        {c.label}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-white/[.05] border border-white/[.12] text-[14px]">
                  <span className="w-5 h-5 rounded-full border border-white/30" style={{ background: hex(color) }} />
                  צבע: <b>{label(color)}</b>
                  {analysis?.color === color && <span className="text-[12px] text-[#C7B4FF]">AI {Math.round(conf * 100)}%</span>}
                  <button type="button" onClick={() => setColorOpen(true)} className="ms-auto text-[13px] text-[#C7B4FF] underline underline-offset-2">שינוי</button>
                </div>
              )}

              {/* existing model */}
              {match && (
                <div className="p-3.5 rounded-[18px] border border-[#A078FF]/45 bg-[linear-gradient(135deg,rgba(0,106,255,.18),rgba(122,18,255,.22)_60%,rgba(255,1,187,.16))] flex flex-col gap-2.5">
                  <div className="flex gap-2.5 items-center">
                    {match.image ? <img src={match.image} alt="" className="w-[38px] h-[38px] rounded-xl object-cover" /> : (
                      <span className="w-[38px] h-[38px] rounded-xl bg-white/10 flex items-center justify-center text-[#E3D6FF]"><Ico d={I.sparkle} sw={1.8} /></span>
                    )}
                    <span className="text-[14px] leading-[1.45]">
                      {focus ? <>מוסיפה צבע לדגם <b>{match.name}</b></> : <>נראה כמו <b>{match.name}</b> שכבר קיים בחנות{match.colors.length ? <> <b>ב{match.colors.map(label).join(", ")}</b></> : null}.</>}
                    </span>
                  </div>
                  <div className="flex gap-2" role="radiogroup" aria-label="איך לשמור">
                    <button type="button" role="radio" aria-checked={mode === "addColor"} onClick={() => setMode("addColor")} className={`flex-1 h-11 rounded-xl text-[14px] font-bold ${mode === "addColor" ? "bg-white text-[#07051A]" : "border border-white/25"}`}>
                      להוסיף כצבע {color ? label(color) : ""}
                    </button>
                    <button type="button" role="radio" aria-checked={mode === "new"} onClick={() => setMode("new")} className={`h-11 px-3.5 rounded-xl text-[14px] ${mode === "new" ? "bg-white text-[#07051A] font-bold" : "border border-white/25"}`}>
                      מוצר חדש
                    </button>
                  </div>
                </div>
              )}

              {mode === "new" && (
                <>
                  <label className="flex flex-col gap-1.5 text-[13px] text-[#DDD8F5] font-semibold">
                    שם המוצר
                    <input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} placeholder="למשל: תיק צד מעור בצבע שמנת" className={`${field} h-12 font-medium`} />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] text-[#DDD8F5] font-semibold">
                    תיאור
                    <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className={`${field} py-2.5 text-[14px] leading-[1.55] resize-none font-normal`} />
                  </label>
                  {aiReady && (
                    <div className="flex gap-1.5 flex-wrap items-center">
                      <span className="text-[12px] text-[#B4AED6]">ניסוח אחר:</span>
                      {TONES.map((t) => (
                        <button key={t.key} type="button" onClick={() => rewrite(t.key)} disabled={!!busy || (!name && !description)} className="h-[34px] px-3 rounded-full border border-white/20 text-[13px] text-[#E3D6FF] disabled:opacity-40 hover:bg-white/10">
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-[1fr_110px] gap-2.5">
                    <label className="flex flex-col gap-1.5 text-[13px] text-[#DDD8F5] font-semibold">
                      קטגוריה
                      <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${field} h-12`}>
                        {categories.map((c) => <option key={c.key} value={c.key} className="bg-[#07051A]">{c.name}</option>)}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1.5 text-[13px] text-[#DDD8F5] font-semibold">
                      עקב (ס״מ, לנעליים)
                      <input value={heel} onChange={(e) => setHeel(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} inputMode="numeric" className={`${field} h-12 text-center`} />
                    </label>
                  </div>
                </>
              )}
              {analysis?.photoNotes.length ? <p className="text-[12px] text-[#B4AED6]">טיפ לצילום: {analysis.photoNotes.join(" · ")}</p> : null}
            </div>
            <footer className="px-4 pt-3 pb-[max(26px,env(safe-area-inset-bottom))]">
              <button type="button" onClick={() => go(2)} disabled={!canIdentifyNext} className="w-full h-[54px] rounded-2xl text-white text-[16px] font-bold flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: GRAD }}>
                המשך לבחירת רקע <Ico d={I.next} size={18} sw={2.2} />
              </button>
            </footer>
          </>
        )}

        {/* ---------------- 3. photos (studio quality) ---------------- */}
        {step === 2 && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto pb-3">
              <div role="tablist" aria-label="סוג תמונה" className="mx-4 grid grid-cols-2 gap-1 p-1 rounded-[14px] bg-white/[.07]">
                <button type="button" role="tab" aria-selected="true" className="h-10 rounded-[11px] bg-white text-[#07051A] text-[14px] font-bold">תמונה אמיתית</button>
                <button type="button" role="tab" aria-selected="false" aria-disabled="true" title="יתאפשר אחרי חיבור ספק תמונות" className="h-10 rounded-[11px] text-[14px] font-semibold text-[#8F89B3] flex items-center justify-center gap-1.5 cursor-not-allowed">
                  הדמיה על דוגמנית <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-bold text-[#C7B4FF]">בקרוב</span>
                </button>
              </div>

              <div className="relative mx-4 mt-3 h-[300px] max-h-[40vh] rounded-3xl overflow-hidden bg-[#1A1730] select-none">
                {main && <img src={main.url} alt="הצילום המקורי" className="absolute inset-0 w-full h-full object-cover" />}
                {bgPreview && !mainCutFailed && (
                  <img
                    src={bgPreview}
                    alt="אחרי: תמונה ברמת סטודיו"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ clipPath: `inset(0 0 0 ${100 - split}%)` }}
                  />
                )}
                {bgPreview && !mainCutFailed && (
                  <>
                    <span className="absolute inset-y-0 w-0.5 bg-white -translate-x-px pointer-events-none" style={{ left: `${100 - split}%` }} />
                    <span className="absolute top-1/2 w-9 h-9 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white text-[#07051A] flex items-center justify-center shadow-[0_6px_16px_rgba(0,0,0,.35)] pointer-events-none" style={{ left: `${100 - split}%` }}>
                      <Ico d="M9 7l-5 5 5 5M15 7l5 5-5 5" size={18} sw={2.2} />
                    </span>
                    <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-[#07051A]/70 text-[12px] font-bold">לפני</span>
                    <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-white text-[#07051A] text-[12px] font-extrabold">אחרי · {bgName(bg)}</span>
                    <span className="absolute bottom-3 inset-x-3 flex justify-center pointer-events-none">
                      <span className="px-3 py-1.5 rounded-full bg-[#07051A]/80 text-[12px] flex items-center gap-1.5">
                        <Ico d={I.check} size={14} sw={2.6} className="text-[#7CF3B5]" /> המוצר מקורי מהצילום, לא נוצר ב־AI
                      </span>
                    </span>
                  </>
                )}
                {cutting && (
                  <div className="absolute inset-0 bg-[#07051A]/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-3" role="status" aria-live="polite">
                    <span className="w-8 h-8 rounded-full border-[3px] border-white/25 border-t-white animate-spin" aria-hidden="true" />
                    <b className="text-[14px]">מכינה תמונה ברמת סטודיו…</b>
                    <span className="text-[12px] text-[#B4AED6]">בפעם הראשונה זה לוקח כמה שניות</span>
                  </div>
                )}
              </div>

              {bgPreview && !mainCutFailed && (
                <label className="mx-4 mt-2.5 flex items-center gap-2.5 text-[12px] text-[#B4AED6]">
                  השוואה
                  <input type="range" min={5} max={95} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="flex-1 accent-[#8F5BFF]" aria-label="השוואה בין לפני לאחרי" />
                </label>
              )}

              {mainCutFailed ? (
                <p className="mx-[18px] mt-3 text-[13px] text-[#FFE3A8] leading-normal">לא הצלחתי לעבד את התמונה הזו (אולי חסר חיבור, או שהמוצר לא ברור). אפשר להמשיך עם התמונה המקורית.</p>
              ) : (
                <ul className="mx-4 mt-3 px-3.5 py-3 rounded-2xl bg-white/[.05] border border-white/[.12] flex flex-col gap-2 text-[13px]">
                  {[
                    ["גזירה מדויקת", "שוליים נקיים, בלי שאריות רקע"],
                    ["תיקון אור ואיזון לבן", "מסיר את הגוון של התאורה בחנות"],
                    ["חידוד", "פרטים ותפרים חדים יותר"],
                    ["סגנון Quality", "אותו גודל, מיקום וצל בכל הקטלוג"],
                  ].map(([t, sub], k) => (
                    <li key={t} className={`flex items-center gap-2.5 ${k > 0 && !improve && k < 3 ? "opacity-40" : ""}`}>
                      <span className="w-[22px] h-[22px] rounded-[7px] bg-[#7CF3B5]/15 text-[#7CF3B5] flex items-center justify-center shrink-0">
                        <Ico d={I.check} size={13} sw={2.8} />
                      </span>
                      <span><b>{t}</b> <span className="text-[#B4AED6]">{sub}</span></span>
                    </li>
                  ))}
                  <li className="pt-1.5 mt-0.5 border-t border-white/10">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <span className="flex-1"><b>שיפור אוטומטי</b> <span className="text-[#B4AED6]">אור, צבע וחדות</span></span>
                      <button type="button" role="switch" aria-checked={improve} aria-label="שיפור אוטומטי" onClick={() => setImprove((v) => !v)} className={`w-[50px] h-[30px] rounded-full p-[3px] flex ${improve ? "justify-start bg-[linear-gradient(90deg,#7A12FF,#C412A6)]" : "justify-end bg-white/20"}`}>
                        <span className="w-6 h-6 rounded-full bg-white block" />
                      </button>
                    </label>
                  </li>
                </ul>
              )}

              <div className="grid grid-cols-3 gap-2.5 px-4 pt-3.5" role="radiogroup" aria-label="רקע">
                {BACKGROUNDS.map((o) => {
                  const on = o.id === bg;
                  const ai = o.id === recommended && !!analysis;
                  return (
                    <button key={o.id} type="button" role="radio" aria-checked={on} onClick={() => setBg(o.id)} disabled={o.id !== "original" && !!mainCutFailed} className="relative flex flex-col gap-1.5 text-[12px] font-medium text-center disabled:opacity-35">
                      <span className={`h-[64px] rounded-[14px] box-border ${on ? "border-[3px] border-white" : "border border-white/20"}`} style={{ background: o.id === "original" && main ? `center/cover url(${main.url})` : o.swatch }} />
                      <span>{o.name}</span>
                      {ai && <span className="absolute top-1.5 left-1.5 px-[7px] py-0.5 rounded-full bg-[#FF01BB] text-[10px] font-extrabold">AI</span>}
                    </button>
                  );
                })}
              </div>

              <div className="mx-4 mt-3 px-3 py-2.5 rounded-[14px] bg-[#7A12FF]/15 border border-[#A078FF]/40 text-[13px] flex gap-2 items-center">
                <Ico d={I.sparkle} size={18} sw={1.8} className="text-[#E3D6FF] shrink-0" />
                <span>
                  {analysis ? <>מומלץ למוצר הזה: <b>{bgName(recommended)}</b> · </> : null}לשמור על אחידות בחנות: <b>רקע Quality</b>
                </span>
              </div>
            </div>
            <footer className="px-4 pt-3 pb-[max(26px,env(safe-area-inset-bottom))] flex gap-2">
              {photos.length > 1 && (bg !== "original" || improve) && (
                <button type="button" onClick={() => setApplyAll((v) => !v)} aria-pressed={applyAll} className={`h-[54px] px-3.5 rounded-2xl text-[14px] font-semibold flex items-center gap-1.5 ${applyAll ? "border border-white bg-white/10" : "border border-white/20"}`}>
                  {applyAll && <Ico d={I.check} size={16} sw={2.6} className="text-[#7CF3B5]" />}
                  לכל התמונות
                </button>
              )}
              <button type="button" onClick={finishBackground} disabled={!!busy || cutting} className="flex-1 h-[54px] rounded-2xl text-white text-[16px] font-bold flex items-center justify-center gap-2 disabled:opacity-40" style={{ background: GRAD }}>
                המשך למלאי <Ico d={I.next} size={18} sw={2.2} />
              </button>
            </footer>
          </>
        )}

        {/* ---------------- 4. stock ---------------- */}
        {step === 3 && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto pb-3">
              {speechOk ? (
                <div className="flex flex-col items-center gap-3 px-[18px] pt-1.5">
                  <button type="button" onClick={toggleMic} aria-pressed={listening} aria-label={listening ? "עצירת ההקלטה" : "הקלטה"} className={`w-24 h-24 rounded-full text-white flex items-center justify-center shadow-[0_18px_40px_-12px_rgba(255,1,187,.6)] transition-transform active:scale-95 ${listening ? "nx-mic-on" : ""}`} style={{ background: "linear-gradient(135deg,#006AFF,#7A12FF 55%,#FF01BB)" }}>
                    <Ico d={listening ? "M8 8h8v8H8z" : I.mic} size={36} sw={1.8} />
                  </button>
                  <div className="flex items-center gap-1 h-7" aria-hidden="true">
                    {[0, 1, 2, 3, 4, 5].map((i) => (
                      <span key={i} className={`w-1 rounded-sm bg-[#C7B4FF] ${listening ? "nx-wave" : ""}`} style={{ height: listening ? 24 : 6, animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                  <span className="text-[13px] text-[#B4AED6] text-center" aria-live="polite">
                    {listening ? "מקליטה… דברי חופשי, כמו שהיית אומרת לעובדת" : "לחצי על המיקרופון ותגידי את המלאי"}
                  </span>
                </div>
              ) : (
                <p className="mx-[18px] text-[13px] text-[#B4AED6]">הדפדפן הזה לא תומך בהקלטה. אפשר להקליד למטה, באותה צורה.</p>
              )}

              {heard && (
                <div className="mx-4 mt-3.5 px-4 py-3.5 rounded-[18px_18px_18px_6px] bg-white/[.08] text-[16px] leading-[1.6]">„{heard}”</div>
              )}

              <div className="flex items-center gap-2 mx-[18px] mt-3.5 mb-2 text-[14px]">
                {understood && total > 0 ? (
                  <>
                    <Ico d={I.check} size={18} sw={2.2} className="text-[#7CF3B5]" />
                    <b>ה־AI הבין ומילא את הטבלה</b>
                  </>
                ) : (
                  <b className="text-[#DDD8F5]">טבלת מלאי</b>
                )}
                <span className="ms-auto text-[#B4AED6]">{total} יחידות</span>
              </div>

              <div className="mx-4 p-3 rounded-[18px] bg-white/[.05] border border-white/[.12] overflow-x-auto">
                <table className="border-separate border-spacing-[5px] text-[13px] text-center">
                  <thead>
                    <tr>
                      <th className="w-[62px]" />
                      {allSizes.map((s) => <th key={s} scope="col" className="font-bold text-[#B4AED6] min-w-[42px]">{s}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {colorRows.map((c) => (
                      <tr key={c}>
                        <th scope="row" className="text-start font-bold whitespace-nowrap pe-1">
                          <span className="inline-flex items-center gap-1.5"><span className="w-3 h-3 rounded-full border border-white/30" style={{ background: hex(c) }} />{label(c)}</span>
                        </th>
                        {allSizes.map((s) => {
                          const n = q(c, s);
                          const tone = n === 0 ? "bg-white/[.04] border-transparent text-[#6F6994]" : n <= LOW ? "bg-[#FFD27A]/15 border-[#FFD27A]/55 text-white" : "bg-[#7CF3B5]/15 border-[#7CF3B5]/50 text-white";
                          return (
                            <td key={s}>
                              <input
                                inputMode="numeric"
                                value={grid[c]?.[s] ?? ""}
                                onChange={(e) => setCell(c, s, e.target.value)}
                                onFocus={(e) => e.currentTarget.select()}
                                placeholder="0"
                                aria-label={`${label(c)} מידה ${s}`}
                                className={`w-full min-w-[42px] h-[38px] rounded-[10px] border text-center font-extrabold tabular-nums placeholder:text-[#6F6994] focus:outline-none focus:ring-2 focus:ring-[#7A12FF] ${tone}`}
                              />
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <select value="" onChange={(e) => e.target.value && setGrid((g) => ({ ...g, [e.target.value]: g[e.target.value] || {} }))} aria-label="הוספת צבע לטבלה" className="mt-2 h-9 px-2 rounded-[10px] bg-transparent border border-white/15 text-[13px] text-[#C7B4FF]">
                  <option value="" className="bg-[#07051A]">+ צבע נוסף</option>
                  {colors.filter((c) => !colorRows.includes(c.key)).map((c) => <option key={c.key} value={c.key} className="bg-[#07051A]">{c.label}</option>)}
                </select>
              </div>

              <label className="flex flex-col gap-1.5 mx-4 mt-3.5 text-[13px] text-[#DDD8F5] font-semibold">
                או להקליד
                <span className="flex gap-2">
                  <input
                    value={stockText}
                    onChange={(e) => setStockText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyText(); } }}
                    placeholder={`למשל: ${label(color) || "לבן"} 37 ארבע, 39 שתיים`}
                    className={`${field} h-12 flex-1 font-normal`}
                  />
                  <button type="button" onClick={() => applyText()} disabled={!stockText.trim() || !!busy} aria-label="הכנסה לטבלה" className="w-12 h-12 rounded-[14px] bg-white text-[#07051A] flex items-center justify-center disabled:opacity-30">
                    <Ico d={I.check} sw={2.6} />
                  </button>
                </span>
              </label>
              {preview && preview.total > 0 && (
                <p className="mx-4 mt-2 text-[12px] text-[#B4AED6]">
                  הבנתי: {Object.entries(preview.stock).map(([c, row]) => `${label(c)} ${Object.entries(row).map(([s, n]) => `${s}×${n}`).join(", ")}`).join(" · ")}
                </p>
              )}
              {colorRows.some((c) => c !== color && allSizes.some((s) => q(c, s) > 0)) && (
                <p className="mx-4 mt-2 text-[12px] text-[#B4AED6]">לצבעים הנוספים אין עדיין תמונות. אפשר להוסיף אחר כך ב„הוספת צבע מצילום”.</p>
              )}
            </div>
            <footer className="px-4 pt-3 pb-[max(26px,env(safe-area-inset-bottom))]">
              <button type="button" onClick={() => go(4)} className="w-full h-[54px] rounded-2xl text-white text-[16px] font-bold flex items-center justify-center gap-2" style={{ background: GRAD }}>
                לסיכום ולפרסום <Ico d={I.next} size={18} sw={2.2} />
              </button>
            </footer>
          </>
        )}

        {/* ---------------- 5. review ---------------- */}
        {step === 4 && (
          <>
            <div className="flex-1 min-h-0 overflow-y-auto pb-3">
              <div className="mx-4 rounded-[22px] overflow-hidden bg-[#F7F5F0] text-[#141414]">
                <div className="relative h-[230px] bg-[radial-gradient(circle_at_50%_30%,#2A2925,#0E0E0E_70%)]">
                  {urls[0] && <img src={urls[0]} alt="" className="w-full h-full object-cover" />}
                  <span className="absolute top-3 right-3 px-[11px] py-[5px] rounded-full bg-[#C9A24A] text-[#141414] text-[12px] font-extrabold">{mode === "addColor" ? "צבע חדש" : "חדש"}</span>
                  {stockedColors.length > 0 && (
                    <span className="absolute bottom-3 left-3 flex gap-1.5">
                      {Array.from(new Set([color, ...stockedColors, ...(mode === "addColor" && match ? match.colors : [])])).slice(0, 6).map((c) => (
                        <span key={c} className="w-[18px] h-[18px] rounded-full border-2 border-white" style={{ background: hex(c) }} title={label(c)} />
                      ))}
                    </span>
                  )}
                </div>
                <div className="px-3.5 py-3 flex justify-between items-start gap-2.5">
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <b className="text-[16px]">{mode === "addColor" ? match?.name : name || "ללא שם"}</b>
                    <span className="text-[13px] text-[#5C5A55]">
                      {[label(color), heel ? `עקב ${heel} ס״מ` : "", stockedSizes.length ? `מידות ${stockedSizes.join(", ")}` : ""].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <b className="text-[19px] whitespace-nowrap">{Number(price) > 0 ? sh(Number(price)) : "—"}</b>
                </div>
              </div>

              {mode === "new" && (
                <label className="mx-4 mt-3 px-3.5 py-2.5 rounded-[14px] bg-white/[.06] border border-white/[.12] flex items-center gap-2.5">
                  <span className="flex-1 text-[13px] text-[#DDD8F5] leading-[1.45]">{priceBasis ? `מחיר מוצע: ${priceBasis}. אפשר לשנות.` : "מחיר המוצר"}</span>
                  <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} inputMode="numeric" aria-label="מחיר בשקלים" className="w-[84px] h-[42px] rounded-xl border border-white/20 bg-white/[.08] text-center text-[16px] font-bold focus:outline-none focus:ring-2 focus:ring-[#7A12FF]" />
                </label>
              )}

              <ul className="mx-4 mt-3.5 flex flex-col gap-[9px] text-[14px]">
                {[
                  { ok: urls.length > 0, text: <>{urls.length} תמונות{bg !== "original" && !mainCutFailed ? <> על רקע <b>{bgName(bg)}</b></> : ""}</> },
                  mode === "addColor" && match ? { ok: true, text: <>נוסף כצבע <b>{label(color)}</b> לדגם „{match.name}”</> } : null,
                  { ok: total > 0, text: total > 0 ? <>{total} יחידות {stockedColors.length > 1 ? `ב־${stockedColors.length} צבעים` : `ב${label(stockedColors[0] || color)}`}{mode === "addColor" ? " (נוספים למלאי הקיים)" : ""}</> : "אין מלאי – המוצר יוצג כאזל" },
                  mode === "new" ? { ok: !!name.trim(), text: <>שם, תיאור{seoTitle ? " וטקסט לגוגל" : ""}</> } : null,
                  ...lowCells.slice(0, 2).map((l) => ({ ok: false, text: <>במידה {l.s} ב{label(l.c)} נשארו {l.n} בלבד</> })),
                ]
                  .filter(Boolean)
                  .map((it, k) => (
                    <li key={k} className="flex gap-2.5 items-center">
                      <span className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${it!.ok ? "bg-[#7CF3B5]/15 text-[#7CF3B5]" : "bg-[#FFD27A]/15 text-[#FFD27A]"}`}>
                        <Ico d={it!.ok ? I.check : I.alert} size={15} sw={2.6} />
                      </span>
                      <span>{it!.text}</span>
                    </li>
                  ))}
              </ul>

              {/* marketing images */}
              <section aria-labelledby="promo-title" className="mx-4 mt-4 p-3.5 rounded-[18px] bg-white/[.05] border border-white/[.12] flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Ico d={I.sparkle} size={18} sw={1.8} className="text-[#E3D6FF]" />
                  <b id="promo-title" className="text-[15px]">תמונות שיווק</b>
                  <span className="text-[12px] text-[#B4AED6]">פוסט, סטורי ומודעה</span>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {["חדש בחנות", "קולקציה חדשה", "מהדורה מוגבלת"].map((t) => (
                    <button key={t} type="button" aria-pressed={headline === t} onClick={() => setHeadline(t)} className={`h-[34px] px-3 rounded-full text-[13px] font-semibold ${headline === t ? "bg-white text-[#07051A]" : "border border-white/20 text-[#E3D6FF]"}`}>
                      {t}
                    </button>
                  ))}
                </div>
                <label className="flex flex-col gap-1.5 text-[12px] text-[#B4AED6]">
                  כותרת על התמונה
                  <input value={headline} onChange={(e) => setHeadline(e.target.value.slice(0, 40))} className={`${field} h-11`} />
                </label>
                <button type="button" onClick={makePromos} disabled={!!busy || !(mainFile || main)} className="h-11 rounded-[14px] bg-white text-[#07051A] text-[14px] font-bold disabled:opacity-40">
                  {promos.length ? "עדכון תמונות השיווק" : "יצירת תמונות שיווק"}
                </button>
                {promos.length > 0 && (
                  <div className="flex gap-2.5 items-start overflow-x-auto pb-1">
                    {promos.map((p) => (
                      <figure key={p.id} className="shrink-0 w-[104px] flex flex-col gap-1.5 m-0">
                        <img src={p.url} alt={`תמונת שיווק – ${p.name}`} className="w-full rounded-xl border border-white/10" />
                        <figcaption className="text-[11px] text-[#B4AED6] text-center">{p.name}</figcaption>
                        <a href={p.url} download={`${(name || "product").replace(/[\\/:*?"<>|]+/g, "")}-${p.id}.jpg`} className="h-8 rounded-lg border border-white/20 text-[12px] font-semibold flex items-center justify-center gap-1 text-white hover:bg-white/10">
                          <Ico d="M12 4v11M7 10l5 5 5-5M5 20h14" size={14} sw={2} /> הורדה
                        </a>
                        {typeof navigator !== "undefined" && "share" in navigator && (
                          <button type="button" onClick={() => sharePromo(p.file)} className="h-8 rounded-lg border border-white/20 text-[12px] font-semibold text-white hover:bg-white/10">שיתוף</button>
                        )}
                      </figure>
                    ))}
                  </div>
                )}
              </section>
            </div>
            <footer className="px-4 pt-3 pb-[max(26px,env(safe-area-inset-bottom))] flex flex-col gap-2">
              <button type="button" onClick={() => save(true)} disabled={!!busy} className="h-14 rounded-2xl text-white text-[17px] font-extrabold flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: GRAD }}>
                <Ico d={I.zap} sw={2} /> {mode === "addColor" ? "הוספה לדגם באתר" : "פרסום באתר"}
              </button>
              {mode === "new" && (
                <button type="button" onClick={() => save(false)} disabled={!!busy} className="h-12 rounded-[14px] border border-white/20 text-[15px] font-semibold disabled:opacity-50">
                  שמירה כטיוטה
                </button>
              )}
              <span className="text-center text-[12px] text-[#8F89B3]">כל ההעלאה נרשמת ביומן הפעילות · אפשר לערוך הכל אחר כך</span>
            </footer>
          </>
        )}

        {!aiReady && step === 0 && (
          <p className="absolute top-[86px] inset-x-4 mx-auto max-w-[448px] px-3 py-2 rounded-xl bg-[#FFD27A]/[.12] border border-[#FFD27A]/35 text-[12px] text-[#FFE3A8] text-center">
            ה־AI לא מחובר: הזיהוי והניסוח יהיו ידניים. הרקע והמלאי עובדים.
          </p>
        )}
      </div>

      {/* busy overlay */}
      {busy && (
        <div className="fixed inset-0 z-[90] bg-[#07051A]/75 backdrop-blur-sm flex items-center justify-center p-6" role="status" aria-live="polite">
          <div className="rounded-2xl px-6 py-5 flex items-center gap-3 bg-[#151233] border border-white/[.12] shadow-2xl max-w-[320px]">
            <span className="w-6 h-6 rounded-full border-[3px] border-white/20 border-t-[#C7B4FF] animate-spin" aria-hidden="true" />
            <b className="text-[15px]">{busy}</b>
          </div>
        </div>
      )}
      {focus && step === 0 && <Link href={`/admin/products/${focus.id}`} className="sr-only">חזרה למוצר</Link>}
    </div>
  );
}
