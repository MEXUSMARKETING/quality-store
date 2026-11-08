"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Icon } from "../_components/ui";
import type { BlockType, PageBlock, PageStatus } from "@/lib/content-shared";
import { savePageAction, uploadPageImageAction, type PageFormState } from "./actions";
import { slugify } from "./lib";

export type PageFormValues = {
  id: number | null;
  slug: string;
  title: string;
  type: "page" | "blog";
  blocks: PageBlock[];
  status: PageStatus;
  publish_at: string; // YYYY-MM-DDTHH:mm Israel
  seo_title: string;
  seo_description: string;
  share_image: string;
};

const BLOCKS: { type: BlockType; label: string }[] = [
  { type: "heading", label: "כותרת" },
  { type: "paragraph", label: "פסקה" },
  { type: "image", label: "תמונה" },
  { type: "button", label: "כפתור" },
  { type: "faq", label: "שאלה ותשובה" },
  { type: "divider", label: "קו מפריד" },
];
const LABEL = Object.fromEntries(BLOCKS.map((b) => [b.type, b.label])) as Record<BlockType, string>;

const bid = () => "b" + Math.random().toString(36).slice(2, 9);

function blank(type: BlockType): PageBlock {
  const id = bid();
  switch (type) {
    case "heading": return { id, type, text: "", level: 2 };
    case "paragraph": return { id, type, text: "" };
    case "image": return { id, type, url: "", alt: "", caption: "" };
    case "button": return { id, type, text: "", href: "/shop" };
    case "faq": return { id, type, q: "", a: "" };
    case "divider": return { id, type };
  }
}

function SaveButton({ disabled, status }: { disabled: boolean; status: PageStatus }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className="a-btn a-btn-primary">
      <Icon name="check" /> {pending ? "שומר…" : status === "published" ? "שמירה ופרסום" : status === "scheduled" ? "שמירה ותזמון" : "שמירת טיוטה"}
    </button>
  );
}

function Counter({ n, max, warn }: { n: number; max: number; warn: number }) {
  const tone = n > max ? "text-[#B03A3A]" : n > warn ? "text-[#8A5A00]" : "text-adm-muted";
  return <span className={`text-[12px] font-normal ${tone}`} aria-live="polite">{n}/{max}</span>;
}

export default function PageEditor({ initial, storageReady, canSave }: { initial: PageFormValues; storageReady: boolean; canSave: boolean }) {
  const [state, action] = useFormState<PageFormState, FormData>(savePageAction, null);
  const [v, setV] = useState<PageFormValues>(initial);
  const [slugTouched, setSlugTouched] = useState(!!initial.slug);
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const set = <K extends keyof PageFormValues>(k: K, val: PageFormValues[K]) => { setV((s) => ({ ...s, [k]: val })); setDirty(true); };

  useEffect(() => {
    if (state?.ok) setDirty(false);
    if (state?.field) formRef.current?.querySelector<HTMLElement>(`[name="${state.field}"]`)?.focus();
  }, [state]);

  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);

  const setBlock = (id: string, patch: Partial<PageBlock>) => set("blocks", v.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as PageBlock) : b)));
  const moveBlock = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= v.blocks.length) return;
    const n = [...v.blocks];
    [n[i], n[j]] = [n[j], n[i]];
    set("blocks", n);
  };
  const removeBlock = (i: number) => {
    const b = v.blocks[i];
    const empty = Object.entries(b).every(([k, val]) => k === "id" || k === "type" || k === "level" || (k === "href" && val === "/shop") || !String(val ?? "").trim());
    if (!empty && !window.confirm(`למחוק את הבלוק "${LABEL[b.type]}"?`)) return;
    set("blocks", v.blocks.filter((_, k) => k !== i));
  };
  const addBlock = (t: BlockType, at?: number) => {
    const b = blank(t);
    const i = at ?? v.blocks.length;
    set("blocks", [...v.blocks.slice(0, i), b, ...v.blocks.slice(i)]);
    setTimeout(() => document.getElementById(`blk-${b.id}`)?.querySelector<HTMLElement>("input,textarea")?.focus(), 30);
  };

  const seoTitle = v.seo_title || v.title;
  const firstPara = (v.blocks.find((b) => b.type === "paragraph") as { text?: string } | undefined)?.text || "";
  const seoDesc = v.seo_description || firstPara.replace(/\s+/g, " ").slice(0, 160);
  const err = (f: string) => (state?.field === f ? { "aria-invalid": true as const, "aria-describedby": "page-error" } : {});
  const errCls = (f: string) => (state?.field === f ? " !border-[#B03A3A]" : "");
  const listHref = `/admin/pages${v.type === "blog" ? "?tab=blog" : ""}`;

  return (
    <form ref={formRef} action={action} className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] items-start" noValidate>
      {v.id && <input type="hidden" name="id" value={v.id} />}
      <input type="hidden" name="blocks" value={JSON.stringify(v.blocks)} />
      <input type="hidden" name="type" value={v.type} />

      {/* ---------- main column ---------- */}
      <div className="flex flex-col gap-4 min-w-0">
        {state?.error && <div id="page-error" role="alert" className="p-3 rounded-xl border bg-[#FDECEC] text-[#8A2626] border-[#F3D3D3] text-[14px]">{state.error}</div>}
        {state?.ok && !dirty && <div role="status" className="p-3 rounded-xl border bg-[#E6F6F0] text-[#0B5E43] border-[#C6EADB] text-[14px]">נשמר.{v.status === "published" ? " הדף מעודכן באתר." : ""}</div>}

        <div className="a-card flex flex-col gap-4">
          <label className="a-field">
            כותרת
            <input
              name="title"
              value={v.title}
              onChange={(e) => {
                const t = e.target.value;
                setV((s) => ({ ...s, title: t, slug: slugTouched ? s.slug : slugify(t) }));
                setDirty(true);
              }}
              maxLength={160}
              required
              placeholder={v.type === "blog" ? "למשל: איך בוחרים מידה במגפונים" : "למשל: משלוחים והחזרות"}
              className={"a-input !h-12 !text-[17px] font-semibold" + errCls("title")}
              {...err("title")}
            />
          </label>
          <label className="a-field">
            כתובת הדף
            <span className="flex items-center gap-0 rounded-[10px] border border-[#D8D3EA] bg-adm-bg overflow-hidden focus-within:outline focus-within:outline-2 focus-within:outline-[#6C1CF5]" dir="ltr">
              <span className="px-3 text-[13px] text-adm-muted font-normal whitespace-nowrap">/info/</span>
              <input
                name="slug"
                value={v.slug}
                onChange={(e) => { setSlugTouched(true); set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-{2,}/g, "-")); }}
                maxLength={80}
                required
                spellCheck={false}
                placeholder="shipping"
                className={"a-input !border-0 !rounded-none !outline-none font-mono text-left" + errCls("slug")}
                {...err("slug")}
              />
            </span>
            <span className="text-[12px] font-normal text-adm-muted">אותיות באנגלית קטנות, ספרות ומקפים. שינוי כתובת של דף קיים ישבור קישורים ישנים אליו (גם בתפריטים).</span>
          </label>
        </div>

        {/* blocks */}
        <section aria-label="תוכן הדף" className="flex flex-col gap-3">
          {v.blocks.length === 0 && <div className="a-card text-center text-[14px] text-adm-muted py-8">הדף ריק. הוסיפו בלוק מהכפתורים למטה.</div>}
          {v.blocks.map((b, i) => (
            <div key={b.id} id={`blk-${b.id}`} className="a-card !p-3 flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[12px] font-bold text-adm-muted bg-adm-bg rounded-md px-2 py-1">{LABEL[b.type]}</span>
                {b.type === "heading" && (
                  <select value={b.level} onChange={(e) => setBlock(b.id, { level: Number(e.target.value) === 3 ? 3 : 2 } as any)} aria-label="גודל הכותרת" className="a-input !h-8 !w-auto !text-[12px]">
                    <option value={2}>כותרת ראשית (H2)</option>
                    <option value={3}>כותרת משנה (H3)</option>
                  </select>
                )}
                <div className="ms-auto flex gap-1">
                  <button type="button" onClick={() => moveBlock(i, -1)} disabled={i === 0} className="a-btn a-btn-sm !h-9 !px-2" aria-label={`הזזת בלוק ${i + 1} למעלה`}><Icon name="up" size={15} /></button>
                  <button type="button" onClick={() => moveBlock(i, 1)} disabled={i === v.blocks.length - 1} className="a-btn a-btn-sm !h-9 !px-2" aria-label={`הזזת בלוק ${i + 1} למטה`}><Icon name="down" size={15} /></button>
                  <button type="button" onClick={() => removeBlock(i)} className="a-btn a-btn-sm a-btn-danger !h-9 !px-2" aria-label={`מחיקת בלוק ${i + 1}`}><Icon name="trash" size={15} /></button>
                </div>
              </div>
              <BlockFields b={b} onChange={(p) => setBlock(b.id, p)} storageReady={storageReady} />
            </div>
          ))}
          <div className="a-card !p-3 flex flex-wrap gap-2 items-center" role="group" aria-label="הוספת בלוק">
            <span className="text-[13px] font-semibold text-adm-muted">הוספה:</span>
            {BLOCKS.map((t) => (
              <button key={t.type} type="button" onClick={() => addBlock(t.type)} className="a-btn a-btn-sm"><Icon name="plus" size={14} /> {t.label}</button>
            ))}
          </div>
        </section>
      </div>

      {/* ---------- side column ---------- */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-[80px]">
        <div className="a-card flex flex-col gap-3">
          <h2 className="text-[15px] font-bold">פרסום</h2>
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">סטטוס</legend>
            {([
              ["draft", "טיוטה", "לא מוצג באתר"],
              ["published", "מפורסם", "מוצג באתר עכשיו"],
              ["scheduled", "מתוזמן", "יתפרסם לבד בתאריך שנבחר"],
            ] as const).map(([k, t, s]) => (
              <label key={k} className={`rounded-xl border-[1.5px] p-2.5 flex gap-2.5 items-start cursor-pointer ${v.status === k ? "border-adm-blue bg-[#F1ECFF]" : "border-adm-line bg-white hover:bg-adm-bg"}`}>
                <input type="radio" name="status" value={k} checked={v.status === k} onChange={() => set("status", k)} className="w-[18px] h-[18px] mt-0.5 accent-[#6C1CF5]" />
                <span className="flex flex-col"><b className="text-[14px]">{t}</b><span className="text-[12px] text-adm-muted">{s}</span></span>
              </label>
            ))}
          </fieldset>
          {v.status === "scheduled" && (
            <label className="a-field">
              תאריך ושעת פרסום (שעון ישראל)
              <input type="datetime-local" name="publish_at" value={v.publish_at} onChange={(e) => set("publish_at", e.target.value)} className={"a-input" + errCls("publish_at")} {...err("publish_at")} />
            </label>
          )}
          <div className="flex gap-2 pt-1">
            <SaveButton disabled={!canSave} status={v.status} />
            <Link href={listHref} className="a-btn">חזרה</Link>
          </div>
          {dirty && <span className="text-[12px] text-[#8A5A00]">יש שינויים שלא נשמרו</span>}
          {v.type === "blog" && <span className="text-[12px] text-adm-muted">פוסט בבלוג מוצג בכתובת /info/{v.slug || "…"} עם תאריך הפרסום.</span>}
        </div>

        <div className="a-card flex flex-col gap-3">
          <h2 className="text-[15px] font-bold">SEO ושיתוף</h2>
          <label className="a-field">
            <span className="flex justify-between">כותרת לגוגל <Counter n={v.seo_title.length} max={60} warn={55} /></span>
            <input name="seo_title" value={v.seo_title} onChange={(e) => set("seo_title", e.target.value)} maxLength={120} placeholder={v.title || "ברירת מחדל: כותרת הדף"} className="a-input" />
          </label>
          <label className="a-field">
            <span className="flex justify-between">תיאור לגוגל <Counter n={v.seo_description.length} max={160} warn={150} /></span>
            <textarea name="seo_description" value={v.seo_description} onChange={(e) => set("seo_description", e.target.value)} rows={3} maxLength={320} placeholder="ברירת מחדל: תחילת הפסקה הראשונה" className="a-input" />
          </label>
          <div className="rounded-xl border border-adm-line p-3 flex flex-col gap-0.5" aria-label="תצוגה בגוגל">
            <span className="text-[11px] text-adm-muted">כך זה ייראה בגוגל</span>
            <span dir="ltr" className="text-[12px] text-[#3D3858] text-right truncate">quality.co.il › info › {v.slug || "…"}</span>
            <span className="text-[16px] text-[#1A0DAB] leading-snug truncate">{(seoTitle || "כותרת הדף") + " · Quality"}</span>
            <span className="text-[13px] text-[#4D5156] leading-5 line-clamp-2">{seoDesc || "תיאור הדף יופיע כאן."}</span>
          </div>
          <ImageInput label="תמונת שיתוף (וואטסאפ / פייסבוק)" name="share_image" value={v.share_image} onChange={(u) => set("share_image", u)} storageReady={storageReady} invalid={state?.field === "share_image"} />
        </div>
      </aside>
    </form>
  );
}

/* ------------------------------------------------------------------ */

function BlockFields({ b, onChange, storageReady }: { b: PageBlock; onChange: (p: Partial<PageBlock>) => void; storageReady: boolean }) {
  switch (b.type) {
    case "heading":
      return <input value={b.text} onChange={(e) => onChange({ text: e.target.value } as any)} maxLength={200} aria-label="טקסט הכותרת" placeholder="כותרת" className={`a-input font-bold ${b.level === 2 ? "!text-[18px]" : "!text-[16px]"}`} />;
    case "paragraph":
      return <textarea value={b.text} onChange={(e) => onChange({ text: e.target.value } as any)} rows={Math.min(14, Math.max(3, b.text.split("\n").length + 1))} maxLength={8000} aria-label="טקסט הפסקה" placeholder="כתבו כאן… (שורה ריקה = פסקה חדשה)" className="a-input" />;
    case "image":
      return (
        <div className="flex flex-col gap-2">
          <ImageInput label="תמונה" value={b.url} onChange={(u) => onChange({ url: u } as any)} storageReady={storageReady} />
          <div className="grid sm:grid-cols-2 gap-2">
            <label className="a-field">טקסט חלופי (לנגישות)<input value={b.alt} onChange={(e) => onChange({ alt: e.target.value } as any)} maxLength={200} placeholder="מה רואים בתמונה" className="a-input" /></label>
            <label className="a-field">כיתוב (לא חובה)<input value={b.caption} onChange={(e) => onChange({ caption: e.target.value } as any)} maxLength={300} className="a-input" /></label>
          </div>
        </div>
      );
    case "button": {
      const ok = !b.href || /^\/(?!\/)/.test(b.href) || /^https?:\/\/\S+$/i.test(b.href) || /^(mailto|tel|wa):/i.test(b.href);
      return (
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="a-field">טקסט הכפתור<input value={b.text} onChange={(e) => onChange({ text: e.target.value } as any)} maxLength={60} placeholder="לכל המגפונים" className="a-input" /></label>
          <label className="a-field">
            קישור
            <input value={b.href} onChange={(e) => onChange({ href: e.target.value.trim() } as any)} dir="ltr" placeholder="/shop" aria-invalid={!ok || undefined} className={"a-input text-left" + (ok ? "" : " !border-[#B03A3A]")} />
            <span className={`text-[12px] font-normal ${ok ? "text-adm-muted" : "text-[#B03A3A]"}`}>/ לעמוד באתר, https:// לאתר חיצוני, או wa:הודעה לוואטסאפ של החנות</span>
          </label>
        </div>
      );
    }
    case "faq":
      return (
        <div className="flex flex-col gap-2">
          <input value={b.q} onChange={(e) => onChange({ q: e.target.value } as any)} maxLength={300} aria-label="שאלה" placeholder="שאלה" className="a-input font-semibold" />
          <textarea value={b.a} onChange={(e) => onChange({ a: e.target.value } as any)} rows={3} maxLength={4000} aria-label="תשובה" placeholder="תשובה" className="a-input" />
        </div>
      );
    case "divider":
      return <hr className="border-adm-line" />;
  }
}

function ImageInput({ label, value, onChange, storageReady, name, invalid }: { label: string; value: string; onChange: (u: string) => void; storageReady: boolean; name?: string; invalid?: boolean }) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = (f: File) =>
    start(async () => {
      setErr("");
      const fd = new FormData();
      fd.append("file", f);
      try {
        const r = await uploadPageImageAction(fd);
        if (r.error) setErr(r.error);
        else if (r.url) onChange(r.url);
      } catch {
        setErr("העלאת התמונה נכשלה. נסו שוב, או הדביקו קישור לתמונה.");
      }
      if (fileRef.current) fileRef.current.value = "";
    });
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      {value && <img src={value} alt="" className="w-full max-h-[220px] object-cover rounded-lg border border-adm-line bg-adm-bg" />}
      <input name={name} value={value} onChange={(e) => onChange(e.target.value.trim())} dir="ltr" placeholder="https://…" aria-label={`${label} – קישור`} aria-invalid={invalid || undefined} className={"a-input text-left" + (invalid ? " !border-[#B03A3A]" : "")} />
      <div className="flex gap-2 items-center flex-wrap">
        <label className={`a-btn a-btn-sm ${busy ? "opacity-55 pointer-events-none" : ""}`}>
          <Icon name="image" size={15} /> {busy ? "מעלה…" : "העלאת תמונה"}
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
        </label>
        {value && <button type="button" onClick={() => onChange("")} className="a-btn a-btn-sm">הסרה</button>}
        {!storageReady && <span className="text-[12px] text-adm-muted">אחסון תמונות לא מחובר – אפשר להדביק קישור.</span>}
      </div>
      {err && <span role="alert" className="text-[12px] text-[#B03A3A]">{err}</span>}
    </div>
  );
}
