"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Notice } from "../../_components/ui";
import { parseStockText } from "@/lib/stock-parse";
import type { Analysis } from "@/lib/ai-product";
import { analyzePhotosAction, createFromAiAction, parseStockAction, rewriteAction, type AnalyzeResult } from "./actions";

/* Quick add with AI: photos → identification → stock (voice/typing) → review & publish.
   Every step can be edited by hand; nothing goes live without pressing "פרסום". */

export type WizColor = { key: string; label: string; hex: string };
export type WizProduct = { id: number; name: string; image: string; price: number; category: string; heel: number | null; colors: string[] };

type Photo = { id: string; file: File; url: string };
type Step = "photos" | "details" | "stock" | "review";
const STEPS: { key: Step; label: string }[] = [
  { key: "photos", label: "צילום" },
  { key: "details", label: "זיהוי" },
  { key: "stock", label: "מלאי" },
  { key: "review", label: "אישור" },
];
const TONES = [
  { key: "short", label: "קצר יותר" },
  { key: "luxury", label: "יוקרתי" },
  { key: "young", label: "צעיר וקליל" },
  { key: "warm", label: "חם ואישי" },
];
const MAX_PHOTOS = 6;
const sh = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");

/** Shrink a photo in the browser (max 1600px JPEG) so uploads are fast on mobile data. */
async function shrink(file: File, max = 1600): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.86));
    if (!blob) return file;
    return new File([blob], (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
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
}: {
  colors: WizColor[];
  sizes: string[];
  categories: { key: string; name: string }[];
  products: WizProduct[];
  focus: WizProduct | null;
  aiReady: boolean;
  storageReady: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("photos");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);

  // results / editable draft
  const [urls, setUrls] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [color, setColor] = useState("");
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
  const [cost, setCost] = useState("");

  // stock
  const [grid, setGrid] = useState<Record<string, Record<string, string>>>({});
  const [stockText, setStockText] = useState("");
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(false);
  const recRef = useRef<any>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSpeechOk(typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
    return () => photos.forEach((p) => URL.revokeObjectURL(p.url));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const label = (k: string) => colors.find((c) => c.key === k)?.label || k;
  const hex = (k: string) => colors.find((c) => c.key === k)?.hex || "#ccc";
  const match = products.find((p) => p.id === matchId) || null;
  const stepIdx = STEPS.findIndex((s) => s.key === step);

  /* ---------------- photos ---------------- */

  function addFiles(list: FileList | null) {
    const files = Array.from((list || []) as ArrayLike<File>).filter((f) => f.type.startsWith("image/"));
    setPhotos((cur) => [...cur, ...files.map((f) => ({ id: Math.random().toString(36).slice(2), file: f, url: URL.createObjectURL(f) }))].slice(0, MAX_PHOTOS));
    setError(null);
  }

  async function analyze() {
    if (!photos.length) return setError("צלמי או בחרי לפחות תמונה אחת");
    setError(null);
    setBusy("מכינה את התמונות…");
    try {
      const fd = new FormData();
      for (const p of photos) fd.append("photos", await shrink(p.file));
      if (hint.trim()) fd.append("hint", hint.trim());
      if (focus) fd.append("focusProductId", String(focus.id));
      setBusy(aiReady ? "מעלה ומזהה את המוצר…" : "מעלה את התמונות…");
      const r: AnalyzeResult = await analyzePhotosAction(fd);
      if (!r.ok) {
        setError(r.error || "משהו השתבש");
        return;
      }
      setUrls(r.urls || []);
      setAiNote(r.aiError || null);
      const a = r.analysis || null;
      setAnalysis(a);
      if (a) {
        if (a.color) setColor(a.color);
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
        if (mId) {
          const m = products.find((p) => p.id === mId);
          if (m) setPrice(String(m.price));
        }
      }
      if (r.price?.price && !price) {
        setPrice(String(r.price.price));
        setPriceBasis(r.price.basis);
      } else if (r.price?.basis) setPriceBasis(r.price.basis);
      setStep("details");
    } catch (e) {
      console.error(e);
      setError("משהו השתבש בהעלאה. בדקי את החיבור ונסי שוב.");
    } finally {
      setBusy(null);
    }
  }

  /* ---------------- copy ---------------- */

  async function rewrite(tone: string) {
    setBusy("מנסחת מחדש…");
    const facts = [label(color), analysis?.productType, analysis?.material, analysis?.heelType, heel ? `עקב ${heel} ס״מ` : "", ...(analysis?.features || [])].filter(Boolean).join(", ");
    const r = await rewriteAction({ title: name, description, tone, facts }).catch(() => ({ error: "הניסוח נכשל" }) as any);
    setBusy(null);
    if (r.error) return setError(r.error);
    setName(r.title || name);
    setDescription(r.description || description);
  }

  /* ---------------- stock ---------------- */

  const colorRows = useMemo(() => {
    const keys = Array.from(new Set([color, ...Object.keys(grid)].filter(Boolean)));
    return keys;
  }, [color, grid]);
  const allSizes = useMemo(() => {
    const extra = new Set<string>();
    Object.values(grid).forEach((r) => Object.keys(r).forEach((s) => !sizes.includes(s) && extra.add(s)));
    return [...sizes, ...Array.from(extra).sort((a, b) => Number(a) - Number(b))];
  }, [grid, sizes]);
  const q = (c: string, s: string) => (/^\d+$/.test(grid[c]?.[s] || "") ? Number(grid[c][s]) : 0);
  const total = colorRows.reduce((a, c) => a + allSizes.reduce((x, s) => x + q(c, s), 0), 0);
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

  // instant preview of what the quick parser understands
  const preview = useMemo(() => (stockText.trim() ? parseStockText(stockText, colors, sizes, color || colors[0]?.key || "black") : null), [stockText, colors, sizes, color]);

  async function applyText(text = stockText) {
    if (!text.trim()) return;
    setBusy("מבינה את הכמויות…");
    const r = await parseStockAction({ text, defaultColor: color }).catch(() => ({ error: "לא הצלחתי להבין" }) as any);
    setBusy(null);
    if (r.error) return setError(r.error);
    setError(null);
    mergeStock(r.stock || {});
    setStockText("");
  }

  function toggleMic() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "he-IL";
    rec.interimResults = true;
    rec.continuous = true;
    let finalText = stockText ? stockText + " " : "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t + " ";
        else interim += t;
      }
      setStockText((finalText + interim).trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) applyText(finalText.trim());
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  /* ---------------- save ---------------- */

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
      cost: cost === "" ? null : Number(cost),
      publish,
    }).catch(() => ({ error: "השמירה נכשלה" }) as any);
    if (r.error || !r.id) {
      setBusy(null);
      return setError(r.error || "השמירה נכשלה");
    }
    router.push(`/admin/products/${r.id}?saved=1&ai=1`);
  }

  /* ---------------- UI ---------------- */

  const conf = analysis?.colorConfidence ?? 1;
  const unsure = !!analysis && (conf < 0.75 || analysis.colorAlternatives.length > 0);
  const canNext = step === "photos" ? photos.length > 0 : step === "details" ? !!color && (mode === "addColor" ? !!matchId : !!name.trim()) : true;
  const missingImages = colorRows.filter((c) => c !== color && allSizes.some((s) => q(c, s) > 0));

  return (
    <div className="max-w-[680px] w-full mx-auto flex flex-col gap-4 pb-28">
      {/* stepper */}
      <ol className="grid grid-cols-4 gap-2" aria-label="שלבים">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex flex-col gap-1.5">
            <span className={`h-1.5 rounded-full ${i < stepIdx ? "bg-[#6C1CF5]" : i === stepIdx ? "nx-grad" : "bg-adm-line"}`} />
            <span className={`text-[12px] ${i === stepIdx ? "font-bold text-adm-navy" : "text-adm-muted"}`} aria-current={i === stepIdx ? "step" : undefined}>
              {i + 1}. {s.label}
            </span>
          </li>
        ))}
      </ol>

      {!aiReady && (
        <Notice tone="amber">
          ה־AI עוד לא מחובר (חסר <b dir="ltr">ANTHROPIC_API_KEY</b> ב־Vercel). אפשר להשתמש באשף בלי זיהוי אוטומטי: מעלים תמונות, ממלאים פרטים, והמלאי מהטקסט עדיין מתפענח לבד.
        </Notice>
      )}
      {!storageReady && <Notice tone="red">אחסון התמונות לא מחובר, ולכן אי אפשר לשמור צילומים.</Notice>}
      {error && <div role="alert"><Notice tone="red">{error}</Notice></div>}

      {/* ---------- 1. photos ---------- */}
      {step === "photos" && (
        <section className="a-card flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-[18px] font-extrabold text-adm-navy">{focus ? `צבע חדש ל"${focus.name}"` : "צלמי את המוצר"}</h2>
            <p className="text-[14px] text-adm-muted leading-6">2–4 תמונות מזוויות שונות, באור טבעי. הרקע לא משנה. התמונה הראשונה תהיה הראשית.</p>
          </div>
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <input ref={galRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={() => camRef.current?.click()} disabled={photos.length >= MAX_PHOTOS} className="h-[120px] rounded-2xl nx-grad text-white flex flex-col items-center justify-center gap-2 font-bold text-[16px] shadow-[0_12px_28px_-12px_rgba(122,18,255,.7)] disabled:opacity-50">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" /></svg>
              צילום
            </button>
            <button type="button" onClick={() => galRef.current?.click()} disabled={photos.length >= MAX_PHOTOS} className="h-[120px] rounded-2xl border-2 border-dashed border-adm-field bg-adm-bg flex flex-col items-center justify-center gap-2 font-bold text-[16px] text-adm-navy disabled:opacity-50">
              <Icon name="image" size={28} />
              מהגלריה
            </button>
          </div>
          {photos.length > 0 && (
            <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((p, i) => (
                <li key={p.id} className={`relative rounded-xl overflow-hidden border-2 ${i === 0 ? "border-[#6C1CF5]" : "border-adm-line"}`}>
                  <img src={p.url} alt={`תמונה ${i + 1}`} className="w-full aspect-square object-cover" />
                  {i === 0 && <span className="absolute top-1.5 start-1.5 a-chip bg-[#6C1CF5] text-white">ראשית</span>}
                  <span className="absolute bottom-1 inset-x-1 flex gap-1">
                    {i !== 0 && (
                      <button type="button" onClick={() => setPhotos((a) => [a[i], ...a.filter((_, k) => k !== i)])} className="flex-1 h-8 rounded-lg bg-white/90 text-[12px] font-bold">ראשית</button>
                    )}
                    <button type="button" onClick={() => setPhotos((a) => a.filter((x) => x.id !== p.id))} aria-label={`הסרת תמונה ${i + 1}`} className="w-8 h-8 rounded-lg bg-white/90 flex items-center justify-center ms-auto"><Icon name="trash" size={15} /></button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <label className="a-field">
            משהו שה־AI צריך לדעת? <span className="font-normal text-adm-muted">(לא חובה)</span>
            <input value={hint} onChange={(e) => setHint(e.target.value)} maxLength={300} placeholder="למשל: עור אמיתי, דגם חדש מהקולקציה" className="a-input" />
          </label>
        </section>
      )}

      {/* ---------- 2. details ---------- */}
      {step === "details" && (
        <>
          {aiNote && <Notice tone="amber">{aiNote}</Notice>}
          {analysis && !analysis.isProduct && <Notice tone="amber">ה־AI לא בטוח שבתמונות יש נעל. בדקי את הפרטים לפני השמירה.</Notice>}
          {analysis?.photoNotes.length ? <Notice tone="blue">טיפ לצילום: {analysis.photoNotes.join(" · ")}</Notice> : null}

          <section className="a-card flex flex-col gap-3">
            <div className="flex gap-3 items-start">
              {urls[0] && <img src={urls[0]} alt="" className="w-24 h-24 rounded-xl object-cover bg-adm-bg shrink-0" />}
              <div className="flex flex-col gap-1.5 min-w-0">
                <b className="text-[16px] text-adm-navy">{analysis ? "ה־AI זיהה" : "פרטי המוצר"}</b>
                {analysis && (
                  <div className="flex flex-wrap gap-1.5">
                    {[analysis.productType, analysis.material, analysis.heelType, ...analysis.features].filter(Boolean).slice(0, 7).map((f) => (
                      <span key={f} className="a-chip bg-[#F1ECFF] text-[#5414D6]">{f}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-[14px] font-semibold pb-1.5">
                צבע {unsure && <span className="text-[#8A5A00] font-normal">· ה־AI לא בטוח, בחרי את הנכון</span>}
              </legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="צבע">
                {[...colors].sort((a, b) => Number(b.key === analysis?.color) - Number(a.key === analysis?.color) || Number(analysis?.colorAlternatives.includes(b.key)) - Number(analysis?.colorAlternatives.includes(a.key))).map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    role="radio"
                    aria-checked={color === c.key}
                    onClick={() => setColor(c.key)}
                    className={`flex items-center gap-2 h-10 px-3 rounded-full border-2 text-[14px] ${color === c.key ? "border-[#6C1CF5] bg-[#F4EFFF] font-bold" : "border-adm-line bg-white"}`}
                  >
                    <span className="w-5 h-5 rounded-full border border-adm-line" style={{ background: c.hex }} aria-hidden="true" />
                    {c.label}
                    {analysis?.color === c.key && <span className="text-[11px] text-[#5414D6]">AI {Math.round(conf * 100)}%</span>}
                  </button>
                ))}
              </div>
            </fieldset>
          </section>

          {/* existing model? */}
          {(match || analysis?.matchProductId) && (
            <section className="rounded-2xl p-4 border border-[#D9C9FF] bg-[linear-gradient(135deg,#F2F7FF,#F6EEFF_55%,#FFF0FA)] flex flex-col gap-3">
              <div className="flex gap-3 items-center">
                {match?.image ? <img src={match.image} alt="" className="w-14 h-14 rounded-xl object-cover" /> : <span className="w-14 h-14 rounded-xl bg-white" />}
                <span className="text-[14px] leading-6">
                  {focus ? "מוסיפה צבע לדגם" : "נראה כמו דגם שכבר קיים בחנות:"} <b>{match?.name}</b>
                  {match && <span className="text-adm-muted"> · קיים ב{match.colors.map(label).join(", ")}</span>}
                  {analysis?.matchReason && !focus && <span className="block text-[12px] text-adm-muted">{analysis.matchReason}</span>}
                </span>
              </div>
              <div role="radiogroup" aria-label="איך לשמור" className="grid grid-cols-2 gap-2">
                <button type="button" role="radio" aria-checked={mode === "addColor"} onClick={() => setMode("addColor")} className={`h-12 rounded-xl text-[14px] font-bold border-2 ${mode === "addColor" ? "bg-adm-navy text-white border-adm-navy" : "bg-white border-adm-line"}`}>
                  להוסיף כצבע {color ? label(color) : ""}
                </button>
                <button type="button" role="radio" aria-checked={mode === "new"} onClick={() => setMode("new")} className={`h-12 rounded-xl text-[14px] font-bold border-2 ${mode === "new" ? "bg-adm-navy text-white border-adm-navy" : "bg-white border-adm-line"}`}>
                  מוצר חדש
                </button>
              </div>
            </section>
          )}

          {mode === "new" && (
            <section className="a-card flex flex-col gap-3">
              <label className="a-field">
                שם המוצר
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={160} className="a-input" placeholder="למשל: מגפון בוקרים חום" />
              </label>
              <label className="a-field">
                תיאור
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className="a-input" />
              </label>
              {aiReady && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[12px] text-adm-muted">ניסוח אחר:</span>
                  {TONES.map((t) => (
                    <button key={t.key} type="button" onClick={() => rewrite(t.key)} disabled={!!busy || (!name && !description)} className="a-btn a-btn-sm !rounded-full">
                      <Icon name="sparkle" size={13} /> {t.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label className="a-field col-span-2">
                  קטגוריה
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className="a-input">
                    {categories.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                  </select>
                </label>
                <label className="a-field">
                  עקב (ס״מ)
                  <input value={heel} onChange={(e) => setHeel(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} inputMode="numeric" className="a-input" />
                </label>
                <label className="a-field">
                  מחיר (₪)
                  <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} inputMode="numeric" className="a-input" />
                </label>
              </div>
              {priceBasis && <span className="text-[12px] text-adm-muted -mt-1">מחיר מוצע: {priceBasis}. אפשר לשנות.</span>}
              <label className="a-field max-w-[200px]">
                עלות (₪) <span className="font-normal text-adm-muted">פנימי, לא חובה</span>
                <input value={cost} onChange={(e) => setCost(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))} inputMode="numeric" className="a-input" />
              </label>
            </section>
          )}
        </>
      )}

      {/* ---------- 3. stock ---------- */}
      {step === "stock" && (
        <section className="a-card flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-[18px] font-extrabold text-adm-navy">כמה יש במלאי?</h2>
            <p className="text-[14px] text-adm-muted leading-6">אמרי או כתבי חופשי, למשל: „{label(color) || "שחור"} 38 חמש, 40 שלוש. {colors.find((c) => c.key !== color)?.label || "חום"} 37 שתיים”.</p>
          </div>
          <div className="flex gap-2 items-stretch">
            {speechOk && (
              <button
                type="button"
                onClick={toggleMic}
                aria-pressed={listening}
                aria-label={listening ? "עצירת ההקלטה" : "הקלטה"}
                className={`w-14 shrink-0 rounded-2xl flex items-center justify-center text-white ${listening ? "bg-[#E0245E] animate-pulse" : "nx-grad"}`}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5a3 3 0 0 1 6 0v6a3 3 0 0 1-6 0zM5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
              </button>
            )}
            <label className="flex-1 flex flex-col gap-1">
              <span className="sr-only">מלאי בטקסט חופשי</span>
              <textarea
                value={stockText}
                onChange={(e) => setStockText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); applyText(); } }}
                rows={2}
                placeholder={listening ? "מקשיבה…" : "שחור 38 חמש, 40 שלוש"}
                className="a-input !h-auto min-h-[56px]"
              />
            </label>
          </div>
          {preview && preview.total > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-adm-muted">הבנתי:</span>
              {Object.entries(preview.stock).map(([c, row]) => (
                <span key={c} className="a-chip bg-adm-bg text-adm-text">
                  <span className="w-3 h-3 rounded-full border border-adm-line" style={{ background: hex(c) }} aria-hidden="true" />
                  {label(c)}: {Object.entries(row).map(([s, n]) => `${s}×${n}`).join(", ")}
                </span>
              ))}
              {preview.unknown.length > 0 && aiReady && <span className="text-adm-muted">(השאר ה־AI ישלים)</span>}
            </div>
          )}
          <button type="button" onClick={() => applyText()} disabled={!stockText.trim() || !!busy} className="a-btn a-btn-primary self-start">
            <Icon name="check" /> הכנסה לטבלה
          </button>

          <div className="overflow-x-auto -mx-1 px-1">
            <table className="border-separate border-spacing-1 min-w-full">
              <thead>
                <tr>
                  <th className="text-start text-[12px] text-adm-muted font-semibold">צבע</th>
                  {allSizes.map((s) => <th key={s} className="text-[13px] font-bold min-w-[46px]">{s}</th>)}
                </tr>
              </thead>
              <tbody>
                {colorRows.map((c) => (
                  <tr key={c}>
                    <th scope="row" className="text-start pe-2 whitespace-nowrap text-[14px]">
                      <span className="inline-flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded-full border border-adm-line" style={{ background: hex(c) }} aria-hidden="true" />{label(c)}</span>
                    </th>
                    {allSizes.map((s) => (
                      <td key={s}>
                        <input
                          inputMode="numeric"
                          value={grid[c]?.[s] ?? ""}
                          onChange={(e) => setCell(c, s, e.target.value)}
                          onFocus={(e) => e.currentTarget.select()}
                          placeholder="0"
                          aria-label={`${label(c)} מידה ${s}`}
                          className={`w-full h-10 rounded-lg border text-center text-[15px] font-semibold tabular-nums ${q(c, s) > 0 ? "bg-[#F1FAF6] border-[#C6EADB]" : "bg-[#F9F8FD] border-adm-line"}`}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value="" onChange={(e) => e.target.value && setGrid((g) => ({ ...g, [e.target.value]: g[e.target.value] || {} }))} className="a-input !h-10 !w-auto" aria-label="הוספת צבע לטבלה">
              <option value="">+ צבע נוסף</option>
              {colors.filter((c) => !colorRows.includes(c.key)).map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <span className="ms-auto text-[15px]">סה״כ <b className="tabular-nums">{total}</b> זוגות</span>
          </div>
          {missingImages.length > 0 && (
            <Notice tone="blue">ל{missingImages.map(label).join(", ")} אין עדיין תמונות. אחרי השמירה אפשר להוסיף אותן בעריכת המוצר, או לצלם עכשיו כ„צבע חדש מצילום”.</Notice>
          )}
        </section>
      )}

      {/* ---------- 4. review ---------- */}
      {step === "review" && (
        <section className="a-card flex flex-col gap-4">
          <h2 className="text-[18px] font-extrabold text-adm-navy">{mode === "addColor" ? "הוספת צבע לדגם קיים" : "הכל מוכן"}</h2>
          <div className="rounded-2xl overflow-hidden border border-adm-line bg-[#F7F5F0]">
            {urls[0] && <img src={urls[0]} alt="" className="w-full aspect-[4/3] object-contain bg-[#0E0E0E]" />}
            <div className="p-3.5 flex justify-between gap-3">
              <span className="flex flex-col">
                <b className="text-[16px] text-[#141414]">{mode === "addColor" ? match?.name : name || "ללא שם"}</b>
                <span className="text-[13px] text-[#5C5A55] flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full" style={{ background: hex(color) }} aria-hidden="true" /> {label(color)}
                  {heel ? ` · עקב ${heel} ס״מ` : ""}
                </span>
              </span>
              <b className="text-[18px] text-[#141414]">{price ? sh(Number(price)) : "—"}</b>
            </div>
          </div>
          <ul className="flex flex-col gap-2 text-[14px]">
            <li className="flex gap-2 items-center"><Icon name="check" className="text-[#0F7A57]" /> {urls.length} תמונות</li>
            {mode === "new" && <li className="flex gap-2 items-center"><Icon name="check" className="text-[#0F7A57]" /> שם ותיאור{seoTitle ? ", טקסט לגוגל" : ""}</li>}
            <li className="flex gap-2 items-center">
              <Icon name={total ? "check" : "alert"} className={total ? "text-[#0F7A57]" : "text-[#8A5A00]"} />
              {total ? `${total} זוגות ב־${colorRows.filter((c) => allSizes.some((s) => q(c, s) > 0)).length} צבעים${mode === "addColor" ? " (יתווספו למלאי הקיים)" : ""}` : "אין מלאי – המוצר יוצג כאזל"}
            </li>
            {mode === "addColor" && <li className="flex gap-2 items-center"><Icon name="check" className="text-[#0F7A57]" /> הצבע {label(color)} יתווסף לדגם, עם התמונות שלו</li>}
          </ul>
        </section>
      )}

      {/* busy overlay */}
      {busy && (
        <div className="fixed inset-0 z-50 bg-[#0B0820]/70 backdrop-blur-sm flex items-center justify-center p-6" role="status" aria-live="polite">
          <div className="bg-white rounded-2xl px-6 py-5 flex items-center gap-3 shadow-2xl max-w-[320px]">
            <span className="w-6 h-6 rounded-full border-[3px] border-[#E2D6FD] border-t-[#6C1CF5] animate-spin" aria-hidden="true" />
            <b className="text-[15px]">{busy}</b>
          </div>
        </div>
      )}

      {/* sticky actions */}
      <div className="fixed bottom-0 inset-x-0 lg:start-[248px] z-30 bg-white/95 backdrop-blur border-t border-adm-line px-4 py-3">
        <div className="max-w-[680px] mx-auto flex gap-2">
          {stepIdx > 0 ? (
            <button type="button" onClick={() => setStep(STEPS[stepIdx - 1].key)} className="a-btn h-12">
              <Icon name="arrowRight" /> חזרה
            </button>
          ) : (
            <Link href="/admin/products" className="a-btn h-12">ביטול</Link>
          )}
          {step === "photos" && (
            <button type="button" onClick={analyze} disabled={!photos.length || !!busy || !storageReady} className="a-btn a-btn-primary h-12 flex-1 text-[15px]">
              <Icon name="sparkle" /> {aiReady ? "זיהוי עם AI" : "המשך"}
            </button>
          )}
          {(step === "details" || step === "stock") && (
            <button type="button" onClick={() => setStep(STEPS[stepIdx + 1].key)} disabled={!canNext} className="a-btn a-btn-primary h-12 flex-1 text-[15px]">
              המשך <Icon name="arrowLeft" />
            </button>
          )}
          {step === "review" &&
            (mode === "addColor" ? (
              <button type="button" onClick={() => save(true)} disabled={!!busy} className="a-btn a-btn-primary h-12 flex-1 text-[15px]">
                <Icon name="zap" /> הוספה לדגם
              </button>
            ) : (
              <>
                <button type="button" onClick={() => save(false)} disabled={!!busy} className="a-btn h-12">טיוטה</button>
                <button type="button" onClick={() => save(true)} disabled={!!busy} className="a-btn a-btn-primary h-12 flex-1 text-[15px]">
                  <Icon name="zap" /> פרסום באתר
                </button>
              </>
            ))}
        </div>
      </div>
    </div>
  );
}
