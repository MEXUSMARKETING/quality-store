"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { CATEGORIES, COLORS, SIZES as DEFAULT_SIZES, shekel } from "@/lib/config";
import type { Product } from "@/lib/types";
import { Icon, Notice } from "../_components/ui";
import { saveProductAction, type SaveState } from "./actions";
import { slugify } from "./shared";
import AiDescribeButton from "../ai/AiDescribeButton";

const TABS = [
  { key: "general", label: "פרטים כלליים" },
  { key: "price", label: "מחיר ורווח" },
  { key: "images", label: "תמונות" },
  { key: "stock", label: "מידות ומלאי" },
  { key: "seo", label: "SEO" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

/** digits-only integer from an input string; null when empty */
const toInt = (s: string): number | null => {
  const t = String(s ?? "").trim();
  if (!t || !/^[0-9]+$/.test(t)) return null;
  return Number(t);
};

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={disabled || pending} className="a-btn a-btn-primary min-w-[128px]" aria-live="polite">
      {pending ? (
        <>
          <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" /> שומרת…
        </>
      ) : (
        <>
          <Icon name="check" /> שמירה
        </>
      )}
    </button>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="a-card flex flex-col gap-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[16px] font-bold text-adm-navy">{title}</h2>
        {sub && <p className="text-[13px] text-adm-muted leading-5">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function Toggle({ name, checked, onChange, label, hint }: { name: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none py-1">
      <input type="checkbox" name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={`relative mt-0.5 w-11 h-6 rounded-full shrink-0 transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-adm-blue peer-focus-visible:outline-offset-2 ${checked ? "bg-adm-blue" : "bg-[#C5CDD9]"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? "start-[22px]" : "start-0.5"}`} />
      </span>
      <span className="flex flex-col">
        <span className="text-[14px] font-semibold text-adm-navy">{label}</span>
        {hint && <span className="text-[12px] text-adm-muted leading-5">{hint}</span>}
      </span>
    </label>
  );
}

function Counter({ n, max }: { n: number; max: number }) {
  return (
    <span className={`text-[12px] font-semibold tabular-nums ${n > max ? "text-[#B03A3A]" : "text-adm-muted"}`} dir="ltr">
      {n}/{max}
    </span>
  );
}

export default function ProductEditor({
  product,
  canEdit,
  blobReady,
  siteHost,
  categories,
  sizes,
  colors,
}: {
  product: Product | null;
  canEdit: boolean;
  blobReady: boolean;
  siteHost: string;
  /** From the server (src/lib/catalog.ts); fall back to config when not passed */
  categories?: { key: string; name: string; parent?: string | null; active?: boolean }[];
  sizes?: string[];
  colors?: { key: string; label: string; hex: string }[];
}) {
  // size matrix: the configured sizes plus any size this product still has stock in
  const SIZES = Array.from(new Set([...(sizes && sizes.length ? sizes : DEFAULT_SIZES), ...Object.keys(product?.stock || {}).filter((k) => Number(product?.stock?.[k]) > 0)]));
  const catOptions = categories && categories.length ? categories : Object.entries(CATEGORIES).map(([key, name]) => ({ key, name, parent: null as string | null, active: true }));
  const colorOptions = colors && colors.length ? colors : Object.entries(COLORS).map(([key, c]) => ({ key, label: c.label, hex: c.hex }));
  const catDepth = (c: { parent?: string | null }) => { let d = 0, p = c.parent; while (p && d < 6) { d++; p = catOptions.find((x) => x.key === p)?.parent || null; } return d; };
  const [state, action] = useFormState<SaveState, FormData>(saveProductAction, null);
  const [tab, setTab] = useState<TabKey>("general");
  const errRef = useRef<HTMLDivElement>(null);

  // general
  const [name, setName] = useState(product?.name || "");
  const [slug, setSlug] = useState(product?.slug || "");
  const [slugTouched, setSlugTouched] = useState(!!product);
  const [description, setDescription] = useState(product?.description || "");
  const [active, setActive] = useState(product ? product.active : true);
  const [featured, setFeatured] = useState(product?.featured || false);

  // price
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [oldPrice, setOldPrice] = useState(product?.old_price ? String(product.old_price) : "");
  const [cost, setCost] = useState(product?.cost !== null && product?.cost !== undefined ? String(product.cost) : "");

  // images
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [pasted, setPasted] = useState("");
  const [picked, setPicked] = useState<{ name: string; url: string }[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // stock
  const [stock, setStock] = useState<Record<string, string>>(() => Object.fromEntries(SIZES.map((s) => [s, product?.stock?.[s] ? String(product.stock[s]) : ""])));
  const [lowStock, setLowStock] = useState(String(product?.low_stock ?? 2));

  // seo
  const [seoTitle, setSeoTitle] = useState(product?.seo_title || "");
  const [seoDesc, setSeoDesc] = useState(product?.seo_description || "");

  const effectiveSlug = slugTouched ? slug : slugify(name);

  // jump to the tab that has the problem and announce the error
  useEffect(() => {
    if (state?.error) {
      if (state.tab && TABS.some((t) => t.key === state.tab)) setTab(state.tab as TabKey);
      errRef.current?.focus();
    }
  }, [state]);

  // release object URLs for file previews
  useEffect(() => () => picked.forEach((p) => URL.revokeObjectURL(p.url)), [picked]);

  /* ---- derived numbers (all integers) ---- */
  const p = toInt(price);
  const op = toInt(oldPrice);
  const c = toInt(cost);
  const profit = p !== null && c !== null ? p - c : null;
  const margin = profit !== null && p ? Math.round((profit * 100) / p) : null;
  const discount = p !== null && op && op > p ? Math.round(((op - p) * 100) / op) : null;
  const qty = (s: string) => toInt(stock[s]) || 0;
  const total = SIZES.reduce((a, s) => a + qty(s), 0);
  const low = toInt(lowStock) ?? 2;

  const levelCls = (n: number) => (n === 0 ? "border-[#E5EAF2] bg-[#F8FAFD]" : n <= 1 ? "border-[#F5DFB3] bg-[#FFF8EB]" : "border-[#C6EADB] bg-[#F1FAF6]");

  const moveImage = (i: number, d: -1 | 1) =>
    setImages((arr) => {
      const j = i + d;
      if (j < 0 || j >= arr.length) return arr;
      const a = [...arr];
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });
  const makeMain = (i: number) => setImages((arr) => [arr[i], ...arr.filter((_, k) => k !== i)]);

  function addPasted() {
    const u = pasted.trim();
    if (!u) return;
    if (!/^(https?:\/\/|\/)/.test(u)) return;
    setImages((arr) => (arr.includes(u) ? arr : [...arr, u]));
    setPasted("");
  }

  const previewTitle = (seoTitle.trim() || `${name.trim() || "שם המוצר"} · Quality`).slice(0, 70);
  const previewDesc = (seoDesc.trim() || description.trim() || "תיאור המוצר יופיע כאן.").replace(/\s+/g, " ");
  const previewDescShort = previewDesc.length > 160 ? previewDesc.slice(0, 157) + "…" : previewDesc;

  return (
    <form
      action={action}
      className="flex flex-col gap-5"
      noValidate={false}
      onInvalidCapture={(e: any) => {
        // a hidden tab holds an invalid field: show that tab so the browser can focus it
        const panel = (e.target as HTMLElement)?.closest?.("[data-tab]") as HTMLElement | null;
        const k = panel?.dataset.tab as TabKey | undefined;
        if (k && k !== tab) setTab(k);
      }}
    >
      {product && <input type="hidden" name="id" value={product.id} />}

      {!canEdit && (
        <Notice tone="amber">
          <b>העריכה כבויה כי מסד הנתונים לא מחובר.</b> אפשר לעיין בפרטי המוצר, אבל שינויים לא יישמרו. כדי לערוך: Vercel ← Storage ← חיבור{" "}
          <b dir="ltr">Neon Postgres</b> לפרויקט, ואז פריסה מחדש.
        </Notice>
      )}

      {state?.error && (
        <div ref={errRef} tabIndex={-1} role="alert" className="outline-none">
          <Notice tone="red"><b>לא נשמר:</b> {state.error}</Notice>
        </div>
      )}

      <div role="tablist" aria-label="חלקי עריכת המוצר" className="flex gap-1 border-b border-adm-line overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`tab-${t.key}`}
            aria-controls={`panel-${t.key}`}
            aria-selected={tab === t.key}
            tabIndex={tab === t.key ? 0 : -1}
            onClick={() => setTab(t.key)}
            onKeyDown={(e: React.KeyboardEvent<HTMLButtonElement>) => {
              const i = TABS.findIndex((x) => x.key === tab);
              // RTL: ArrowLeft moves forward
              const next = e.key === "ArrowLeft" ? i + 1 : e.key === "ArrowRight" ? i - 1 : null;
              if (next === null) return;
              e.preventDefault();
              const k = TABS[(next + TABS.length) % TABS.length].key;
              setTab(k);
              document.getElementById(`tab-${k}`)?.focus();
            }}
            className="a-tab"
          >
            {t.label}
            {t.key === "images" && <span className="a-count">{images.length}</span>}
            {t.key === "stock" && <span className="a-count">{total}</span>}
          </button>
        ))}
      </div>

      <fieldset disabled={!canEdit} className="contents">
        {/* ---------------- general ---------------- */}
        <div role="tabpanel" id="panel-general" aria-labelledby="tab-general" data-tab="general" className={tab === "general" ? "flex flex-col gap-5" : "hidden"}>
          <Section title="פרטי המוצר" sub="כל מוצר הוא צבע אחד. לצבע נוסף של אותו דגם – שכפלי את המוצר.">
            <label className="a-field">
              שם המוצר *
              <input name="name" required maxLength={160} value={name} onChange={(e) => setName(e.target.value)} className="a-input" placeholder="למשל: מגפון עור שחור עם עקב בלוק" />
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="a-field">
                כתובת בדף (slug)
                <input
                  name="slug"
                  dir="ltr"
                  value={effectiveSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                  className="a-input"
                  placeholder="נוצרת אוטומטית מהשם"
                  aria-describedby="slug-hint"
                />
                <span id="slug-hint" className="text-[12px] font-normal text-adm-muted">
                  {slugTouched && !product ? (
                    <button type="button" className="text-adm-link underline" onClick={() => setSlugTouched(false)}>חזרה לכתובת אוטומטית</button>
                  ) : product ? "שינוי הכתובת ישבור קישורים ישנים למוצר" : "מתעדכנת לפי השם עד שתשני אותה"}
                </span>
              </label>
              <label className="a-field">
                מק״ט (SKU)
                <input name="sku" dir="ltr" maxLength={60} defaultValue={product?.sku || ""} className="a-input" placeholder="לא חובה" />
              </label>
            </div>
            <label className="a-field">
              תיאור
              <textarea name="description" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} className="a-input" placeholder="חומר, נוחות, התאמה למידה, טיפים לשילוב…" />
            </label>
            <AiDescribeButton productId={product?.id} name={name} current={description} price={price} onInsert={setDescription} />
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <label className="a-field">
                קטגוריה
                <select name="category" defaultValue={product?.category || "boots"} className="a-input">
                  {catOptions.map((c) => <option key={c.key} value={c.key}>{"\u00A0\u00A0".repeat(catDepth(c))}{c.name}{c.active === false ? " (מוסתרת)" : ""}</option>)}
                  {product?.category && !catOptions.some((c) => c.key === product.category) && <option value={product.category}>{product.category}</option>}
                </select>
              </label>
              <label className="a-field">
                צבע
                <select name="color" defaultValue={product?.color || "black"} className="a-input">
                  {colorOptions.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                  {product?.color && !colorOptions.some((c) => c.key === product.color) && <option value={product.color}>{product.color}</option>}
                </select>
              </label>
              <label className="a-field">
                גובה עקב (ס״מ)
                <input name="heel" type="number" inputMode="numeric" min={0} max={30} step={1} defaultValue={product?.heel ?? ""} className="a-input" />
              </label>
              <label className="a-field">
                סדר תצוגה
                <input name="sort" type="number" inputMode="numeric" step={1} defaultValue={product?.sort ?? 100} className="a-input" aria-describedby="sort-hint" />
                <span id="sort-hint" className="text-[12px] font-normal text-adm-muted">מספר קטן = מוצג קודם</span>
              </label>
            </div>
          </Section>
          <Section title="הצגה באתר">
            <Toggle name="active" checked={active} onChange={setActive} label="מוצג באתר" hint={active ? "הלקוחות רואות את המוצר וקונות אותו" : "המוצר מוסתר – לא מופיע בחנות ובחיפוש"} />
            <Toggle name="featured" checked={featured} onChange={setFeatured} label="מוצר מומלץ" hint="מופיע ראשון בדף הבית" />
          </Section>
        </div>

        {/* ---------------- price ---------------- */}
        <div role="tabpanel" id="panel-price" aria-labelledby="tab-price" data-tab="price" className={tab === "price" ? "grid lg:grid-cols-[1.3fr_1fr] gap-5 items-start" : "hidden"}>
          <Section title="מחיר" sub="בשקלים שלמים, כולל מע״מ.">
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="a-field">
                מחיר מכירה (₪) *
                <input name="price" type="number" inputMode="numeric" min={0} step={1} required value={price} onChange={(e) => setPrice(e.target.value)} className="a-input" />
              </label>
              <label className="a-field">
                מחיר לפני הנחה (₪)
                <input name="old_price" type="number" inputMode="numeric" min={0} step={1} value={oldPrice} onChange={(e) => setOldPrice(e.target.value)} className="a-input" aria-describedby="old-hint" />
                <span id="old-hint" className="text-[12px] font-normal text-adm-muted">יוצג מחוק ליד המחיר</span>
              </label>
              <label className="a-field">
                עלות (₪)
                <input name="cost" type="number" inputMode="numeric" min={0} step={1} value={cost} onChange={(e) => setCost(e.target.value)} className="a-input" aria-describedby="cost-hint" />
                <span id="cost-hint" className="text-[12px] font-normal text-adm-muted">פנימי בלבד – לא מוצג באתר</span>
              </label>
            </div>
            {op !== null && op > 0 && p !== null && op <= p && (
              <Notice tone="amber">המחיר לפני הנחה ({shekel(op)}) לא גבוה מהמחיר הנוכחי ({shekel(p)}), ולכן לא תוצג הנחה באתר.</Notice>
            )}
          </Section>
          <section className="a-card flex flex-col gap-3" aria-live="polite">
            <h2 className="text-[16px] font-bold text-adm-navy">רווח למוצר</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-adm-bg p-3.5 flex flex-col gap-1">
                <span className="text-[12px] text-adm-muted font-semibold">רווח לזוג</span>
                <b className={`text-[22px] font-extrabold tabular-nums ${profit !== null && profit < 0 ? "text-[#B03A3A]" : "text-adm-navy"}`}>{profit === null ? "—" : (profit < 0 ? "−" : "") + shekel(Math.abs(profit))}</b>
              </div>
              <div className="rounded-xl bg-adm-bg p-3.5 flex flex-col gap-1">
                <span className="text-[12px] text-adm-muted font-semibold">אחוז רווח</span>
                <b className={`text-[22px] font-extrabold tabular-nums ${margin !== null && margin < 0 ? "text-[#B03A3A]" : "text-adm-navy"}`} dir="ltr">{margin === null ? "—" : `${margin}%`}</b>
              </div>
            </div>
            <p className="text-[13px] text-adm-muted leading-5">
              {c === null ? "הזיני עלות כדי לראות רווח ואחוז רווח." : profit !== null && profit < 0 ? "המחיר נמוך מהעלות – המוצר נמכר בהפסד." : `מחושב לפי מחיר ${shekel(p || 0)} ועלות ${shekel(c)}.`}
              {discount !== null && <> הלקוחות יראו הנחה של <b>{discount}%</b>.</>}
            </p>
          </section>
        </div>

        {/* ---------------- images ---------------- */}
        <div role="tabpanel" id="panel-images" aria-labelledby="tab-images" data-tab="images" className={tab === "images" ? "flex flex-col gap-5" : "hidden"}>
          <Section title="תמונות המוצר" sub="התמונה הראשונה היא התמונה הראשית בחנות. אפשר לשנות סדר, לבחור ראשית ולהסיר.">
            {images.map((src) => <input key={src} type="hidden" name="image" value={src} />)}
            {images.length ? (
              <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
                {images.map((src, i) => (
                  <li key={src} className={`rounded-xl border-2 overflow-hidden bg-white flex flex-col ${i === 0 ? "border-adm-blue" : "border-adm-line"}`}>
                    <div className="relative">
                      <img src={src} alt={`תמונה ${i + 1}`} className="w-full aspect-square object-cover bg-adm-bg" />
                      {i === 0 && <span className="absolute top-2 start-2 a-chip bg-adm-blue text-white">ראשית</span>}
                    </div>
                    <div className="flex items-center gap-1 p-1.5 border-t border-adm-line">
                      <button type="button" onClick={() => moveImage(i, -1)} disabled={i === 0} className="a-btn a-btn-sm !px-2" aria-label={`הזזת תמונה ${i + 1} ימינה (מוקדם יותר)`}><Icon name="arrowRight" size={16} /></button>
                      <button type="button" onClick={() => moveImage(i, 1)} disabled={i === images.length - 1} className="a-btn a-btn-sm !px-2" aria-label={`הזזת תמונה ${i + 1} שמאלה (מאוחר יותר)`}><Icon name="arrowLeft" size={16} /></button>
                      {i !== 0 && <button type="button" onClick={() => makeMain(i)} className="a-btn a-btn-sm !px-2 flex-1 text-[12px]">ראשית</button>}
                      <button type="button" onClick={() => setImages((a) => a.filter((x) => x !== src))} className="a-btn a-btn-sm a-btn-danger !px-2 ms-auto" aria-label={`הסרת תמונה ${i + 1}`}><Icon name="trash" size={16} /></button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-adm-muted bg-adm-bg rounded-xl p-5 text-center">עדיין אין תמונות. מוצר בלי תמונה יוצג באתר עם רקע ריק.</p>
            )}
          </Section>

          <div className="grid lg:grid-cols-2 gap-5">
            <Section title="העלאת קבצים" sub="התמונות יעלו בלחיצה על שמירה.">
              {blobReady ? (
                <>
                  <label className="a-field">
                    בחירת תמונות
                    <input
                      ref={fileRef}
                      name="files"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        const list = Array.from((e.target.files || []) as ArrayLike<File>);
                        setPicked(list.map((f) => ({ name: f.name, url: URL.createObjectURL(f) })));
                      }}
                      className="text-[14px] font-normal file:me-3 file:h-10 file:px-4 file:rounded-[10px] file:border-0 file:bg-adm-navy file:text-white file:font-semibold file:cursor-pointer"
                    />
                  </label>
                  {picked.length > 0 && (
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2 flex-wrap">
                        {picked.map((f) => (
                          <img key={f.url} src={f.url} alt={f.name} title={f.name} className="w-16 h-16 rounded-lg object-cover border border-adm-line" />
                        ))}
                      </div>
                      <div className="flex items-center gap-2 text-[13px] text-adm-muted">
                        {picked.length} קבצים ממתינים לשמירה
                        <button
                          type="button"
                          className="text-adm-link underline"
                          onClick={() => {
                            if (fileRef.current) fileRef.current.value = "";
                            setPicked([]);
                          }}
                        >
                          ניקוי
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <Notice tone="amber">
                  העלאת קבצים דורשת חיבור <b dir="ltr">Supabase</b> לפרויקט (מסד הנתונים ואחסון התמונות). עד אז אפשר להדביק קישור לתמונה.
                </Notice>
              )}
            </Section>
            <Section title="הוספה מקישור" sub="קישור ישיר לקובץ תמונה (https://…).">
              <div className="flex gap-2 items-end">
                <label className="a-field flex-1">
                  קישור לתמונה
                  <input
                    name="imageUrl"
                    type="url"
                    dir="ltr"
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addPasted();
                      }
                    }}
                    placeholder="https://…"
                    className="a-input"
                  />
                </label>
                <button type="button" onClick={addPasted} disabled={!/^(https?:\/\/|\/)/.test(pasted.trim())} className="a-btn">
                  <Icon name="plus" /> הוספה
                </button>
              </div>
            </Section>
          </div>
        </div>

        {/* ---------------- stock ---------------- */}
        <div role="tabpanel" id="panel-stock" aria-labelledby="tab-stock" data-tab="stock" className={tab === "stock" ? "flex flex-col gap-5" : "hidden"}>
          <Section title="מלאי לפי מידה" sub="כמה זוגות יש מכל מידה. מידה עם 0 לא תוצג כזמינה באתר. המלאי יורד אוטומטית בכל הזמנה.">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {SIZES.map((s) => {
                const n = qty(s);
                return (
                  <label key={s} className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 ${levelCls(n)}`}>
                    <span className="text-[13px] font-bold text-adm-navy">מידה {s}</span>
                    <input
                      name={`stock_${s}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={9999}
                      step={1}
                      value={stock[s]}
                      onChange={(e) => setStock((st) => ({ ...st, [s]: e.target.value }))}
                      placeholder="0"
                      className="a-input text-center !px-1 !h-11 text-[16px] font-semibold tabular-nums"
                      aria-label={`כמות במידה ${s}`}
                    />
                    <span className={`text-[11px] font-semibold ${n === 0 ? "text-adm-muted" : n <= 1 ? "text-[#8A5A00]" : "text-[#0F7A57]"}`}>{n === 0 ? "אין" : n <= 1 ? "אחרון" : "במלאי"}</span>
                  </label>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className="a-btn a-btn-sm" onClick={() => setStock((st) => Object.fromEntries(SIZES.map((s) => [s, String((toInt(st[s]) || 0) + 1)])))}>
                <Icon name="plus" size={15} /> <span dir="ltr">+1</span> לכל המידות
              </button>
              <button type="button" className="a-btn a-btn-sm" onClick={() => { if (window.confirm("לאפס את המלאי בכל המידות?")) setStock(Object.fromEntries(SIZES.map((s) => [s, ""]))); }}>
                איפוס
              </button>
              <span className="ms-auto text-[14px]" aria-live="polite">
                סה״כ: <b className={`tabular-nums ${total === 0 ? "text-[#B03A3A]" : total <= low ? "text-[#8A5A00]" : "text-adm-navy"}`}>{total} זוגות</b>
                {total === 0 ? " · אזל" : total <= low ? " · מלאי נמוך" : ""}
              </span>
            </div>
          </Section>
          <Section title="התראת מלאי נמוך" sub="כשסך הזוגות יורד לסף הזה (או פחות), המוצר יסומן ב„מלאי נמוך” ותופיע התראה.">
            <label className="a-field max-w-[200px]">
              סף מלאי נמוך (זוגות)
              <input name="low_stock" type="number" inputMode="numeric" min={0} step={1} value={lowStock} onChange={(e) => setLowStock(e.target.value)} className="a-input" />
            </label>
          </Section>
        </div>

        {/* ---------------- seo ---------------- */}
        <div role="tabpanel" id="panel-seo" aria-labelledby="tab-seo" data-tab="seo" className={tab === "seo" ? "grid lg:grid-cols-2 gap-5 items-start" : "hidden"}>
          <Section title="מנועי חיפוש" sub="לא חובה. כשהשדות ריקים משתמשים בשם ובתיאור המוצר.">
            <label className="a-field">
              <span className="flex justify-between">כותרת לגוגל <Counter n={seoTitle.length} max={60} /></span>
              <input name="seo_title" maxLength={120} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className="a-input" placeholder={`${name || "שם המוצר"} · Quality`} />
            </label>
            <label className="a-field">
              <span className="flex justify-between">תיאור לגוגל <Counter n={seoDesc.length} max={160} /></span>
              <textarea name="seo_description" rows={3} maxLength={320} value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} className="a-input" placeholder={description ? description.slice(0, 160) : "משפט או שניים שמזמינים להיכנס לדף"} />
            </label>
            <label className="a-field">
              כתובת הדף
              <span className="flex items-center rounded-[10px] border border-[#D5DCE8] overflow-hidden focus-within:outline focus-within:outline-2 focus-within:outline-adm-blue" dir="ltr">
                <span className="px-3 h-[42px] flex items-center bg-adm-bg text-adm-muted text-[13px] font-normal border-e border-[#D5DCE8] whitespace-nowrap">/product/</span>
                <input
                  value={effectiveSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                  className="h-[42px] px-3 text-[14px] flex-1 min-w-0 outline-none font-normal"
                  aria-label="כתובת הדף (slug)"
                />
              </span>
            </label>
          </Section>
          <section className="a-card flex flex-col gap-2" aria-label="תצוגה מקדימה בגוגל">
            <h2 className="text-[16px] font-bold text-adm-navy pb-1">תצוגה מקדימה בגוגל</h2>
            <div className="rounded-xl border border-adm-line p-4 flex flex-col gap-1 bg-white">
              <span className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-full bg-adm-bg border border-adm-line flex items-center justify-center text-[11px] font-bold text-adm-navy" aria-hidden="true">Q</span>
                <span className="flex flex-col leading-4">
                  <span className="text-[14px] text-[#202124]">Quality</span>
                  <span className="text-[12px] text-[#4D5156] truncate" dir="ltr">{siteHost} › product › {slugify(effectiveSlug) || "…"}</span>
                </span>
              </span>
              <span className="text-[19px] leading-7 text-[#1A0DAB] pt-1 break-words">{previewTitle}</span>
              <span className="text-[14px] leading-[22px] text-[#4D5156] break-words">{previewDescShort}</span>
            </div>
            <p className="text-[12px] text-adm-muted">התצוגה משוערת – גוגל עשוי להציג טקסט אחר.</p>
          </section>
        </div>
      </fieldset>

      {/* ---------------- sticky save bar ---------------- */}
      <div className="sticky bottom-0 z-10 -mx-4 md:-mx-7 px-4 md:px-7 py-3 bg-white/95 backdrop-blur border-t border-adm-line flex flex-wrap items-center gap-2 adm-noprint">
        <SaveButton disabled={!canEdit} />
        {product && (
          <Link href={`/product/${product.slug}`} target="_blank" rel="noopener" className="a-btn">
            <Icon name="external" /> צפייה באתר
          </Link>
        )}
        <Link href="/admin/products" className="a-btn !bg-transparent !border-transparent text-adm-muted">ביטול</Link>
        <span className="ms-auto text-[13px] text-adm-muted hidden sm:inline">
          {canEdit ? "השמירה כוללת את כל הלשוניות" : "לא ניתן לשמור – מסד הנתונים לא מחובר"}
        </span>
      </div>
    </form>
  );
}
