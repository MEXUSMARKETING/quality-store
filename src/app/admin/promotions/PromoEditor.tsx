"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Icon } from "../_components/ui";
import {
  applyPromotions,
  autoBadge,
  describePromo,
  DEFAULT_CONFIG,
  EMPTY_SCOPE,
  inScope,
  productInPromo,
  TYPE_META,
  type PromoConfig,
  type PromoScope,
  type PromoType,
  type Promotion,
} from "@/lib/promotions-shared";
import { savePromotionAction, type PromoSaveState } from "./actions";

export type EditorProduct = { id: number; name: string; price: number; cost: number | null; image: string; category: string; cats: string[]; onSale: boolean; active: boolean };
export type EditorCategory = { key: string; name: string; depth: number; active: boolean };
export type PromoFormValues = {
  id: number | null;
  name: string;
  type: PromoType;
  badge: string;
  scope: PromoScope;
  config: PromoConfig;
  starts_at: string; // YYYY-MM-DD (Israel)
  ends_at: string;
  active: boolean;
  allow_coupon: boolean;
};

const sh = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");
const TYPES: PromoType[] = ["bxgy", "bundle", "tiers", "percent", "spend"];
const TYPE_ICON: Record<PromoType, string> = { bxgy: "1+1", bundle: "2=₪", tiers: "↗%", percent: "%", spend: "₪+" };

function Save({ isNew }: { isNew: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="a-btn a-btn-primary h-12 w-full text-[15px] disabled:opacity-60">
      <Icon name="check" /> {pending ? "שומרת…" : isNew ? "יצירת המבצע" : "שמירת שינויים"}
    </button>
  );
}

function Num({ label, value, onChange, min = 1, max = 100000, suffix, help, id }: { label: string; value: number | null; onChange: (n: number | null) => void; min?: number; max?: number; suffix?: string; help?: string; id: string }) {
  return (
    <label className="a-field" htmlFor={id}>
      {label}
      <span className="flex items-center gap-2">
        <input id={id} type="number" inputMode="numeric" min={min} max={max} value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Math.max(min, Math.min(max, Math.round(Number(e.target.value)))))} className="a-input h-11 w-[120px]" />
        {suffix && <span className="text-[14px] text-adm-muted">{suffix}</span>}
      </span>
      {help && <span className="text-[12px] font-normal text-adm-muted">{help}</span>}
    </label>
  );
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-wrap gap-1 p-1 rounded-[11px] bg-adm-bg border border-adm-line">
      {options.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} onClick={() => onChange(o.v)} className={`min-h-[36px] px-3 rounded-lg text-[14px] font-semibold ${value === o.v ? "bg-white shadow text-adm-navy" : "text-adm-muted"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- scope picker (all / categories / products, exclusions) ---------- */

function ScopePicker({ scope, onChange, categories, products, title, allowAll = true }: { scope: PromoScope; onChange: (s: PromoScope) => void; categories: EditorCategory[]; products: EditorProduct[]; title: string; allowAll?: boolean }) {
  const [q, setQ] = useState("");
  const [showEx, setShowEx] = useState(scope.exclude.length > 0);
  const set = (patch: Partial<PromoScope>) => onChange({ ...scope, ...patch });
  const toggle = (arr: any[], v: any) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const filtered = products.filter((p) => !q.trim() || p.name.includes(q.trim()));
  const matching = products.filter((p) => p.active && inScope(scope, { productId: p.id, cats: p.cats, onSale: p.onSale }));

  const productList = (selected: number[], onToggle: (id: number) => void, label: string) => (
    <div className="flex flex-col gap-2">
      <label className="flex items-center gap-2.5 h-11 px-3 border border-adm-line rounded-[11px] bg-adm-bg">
        <Icon name="search" className="text-adm-muted" />
        <span className="sr-only">חיפוש מוצר</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש מוצר…" className="flex-1 bg-transparent outline-none text-[14px]" />
      </label>
      <ul aria-label={label} className="max-h-[300px] overflow-y-auto rounded-xl border border-adm-line divide-y divide-[#EEF1F6]">
        {filtered.map((p) => (
          <li key={p.id}>
            <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-adm-bg">
              <input type="checkbox" checked={selected.includes(p.id)} onChange={() => onToggle(p.id)} className="w-[18px] h-[18px] accent-[#3478F6]" />
              {p.image ? <img src={p.image} alt="" className="w-10 h-10 rounded-lg object-cover bg-adm-bg" /> : <span className="w-10 h-10 rounded-lg bg-adm-bg" />}
              <span className="flex-1 min-w-0">
                <span className="block text-[14px] font-semibold truncate">{p.name}{!p.active && <span className="text-adm-muted font-normal"> (מוסתר)</span>}</span>
                <span className="text-[12px] text-adm-muted">{sh(p.price)}{p.onSale ? " · כבר בהנחה" : ""}</span>
              </span>
            </label>
          </li>
        ))}
        {!filtered.length && <li className="px-3 py-4 text-[14px] text-adm-muted">לא נמצאו מוצרים</li>}
      </ul>
    </div>
  );

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-[15px] font-bold pb-2">{title}</legend>
      <Seg
        label={title}
        value={scope.mode}
        onChange={(mode) => set({ mode })}
        options={[...(allowAll ? [{ v: "all" as const, label: "כל החנות" }] : []), { v: "categories" as const, label: "קטגוריות" }, { v: "products" as const, label: "מוצרים נבחרים" }]}
      />
      {scope.mode === "categories" && (
        <div className="grid gap-1 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
          {categories.map((c) => (
            <label key={c.key} className="flex items-center gap-2.5 min-h-[40px] px-2.5 rounded-lg hover:bg-adm-bg cursor-pointer" style={{ paddingInlineStart: 10 + c.depth * 18 }}>
              <input type="checkbox" checked={scope.categories.includes(c.key)} onChange={() => set({ categories: toggle(scope.categories, c.key) })} className="w-[18px] h-[18px] accent-[#3478F6]" />
              <span className="text-[14px]">{c.name}{!c.active && <span className="text-adm-muted"> (מוסתרת)</span>}</span>
            </label>
          ))}
          <p className="text-[12px] text-adm-muted col-span-full">קטגוריית אב כוללת גם את תתי־הקטגוריות שלה.</p>
        </div>
      )}
      {scope.mode === "products" && productList(scope.products, (id) => set({ products: toggle(scope.products, id) }), "מוצרים במבצע")}

      <div className="flex flex-col gap-2 pt-1">
        <label className="flex items-center gap-2.5 text-[14px] cursor-pointer min-h-[36px]">
          <input type="checkbox" checked={scope.excludeSale} onChange={(e) => set({ excludeSale: e.target.checked })} className="w-[18px] h-[18px] accent-[#3478F6]" />
          לא לכלול מוצרים שכבר מוצגים במחיר מוזל
        </label>
        {scope.mode !== "products" && (
          <>
            <button type="button" onClick={() => setShowEx((x) => !x)} aria-expanded={showEx} className="self-start text-[14px] font-semibold text-adm-link underline underline-offset-2 min-h-[36px]">
              {showEx ? "הסתרת החרגות" : `החרגת מוצרים ספציפיים${scope.exclude.length ? ` (${scope.exclude.length})` : ""}`}
            </button>
            {showEx && productList(scope.exclude, (id) => set({ exclude: toggle(scope.exclude, id) }), "מוצרים שלא משתתפים")}
          </>
        )}
        <p className="text-[13px] text-adm-muted"><b className="text-adm-text">{matching.length}</b> מוצרים פעילים משתתפים</p>
      </div>
    </fieldset>
  );
}

/* ---------- the editor ---------- */

export default function PromoEditor({ initial, categories, products, others }: { initial: PromoFormValues; categories: EditorCategory[]; products: EditorProduct[]; others: Promotion[] }) {
  const router = useRouter();
  const [v, setV] = useState<PromoFormValues>(initial);
  const [state, action] = useFormState<PromoSaveState, FormData>(savePromotionAction, null);
  const set = (patch: Partial<PromoFormValues>) => setV((x) => ({ ...x, ...patch }));
  const setC = (patch: Partial<PromoConfig>) => setV((x) => ({ ...x, config: { ...x.config, ...patch } }));
  const c = v.config;
  const isNew = !v.id;

  useEffect(() => {
    if (state?.ok && state.id) router.push(`/admin/promotions/${state.id}?saved=1`);
  }, [state, router]);

  const asPromo: Promotion = { id: v.id || 0, name: v.name || "מבצע", type: v.type, scope: v.scope, config: v.type === "bxgy" ? c : { ...c, target: null }, starts_at: null, ends_at: null, active: true, allow_coupon: v.allow_coupon, badge: v.badge };
  const badge = v.badge.trim() || autoBadge(v.type, c);
  const sentence = describePromo(v.type, asPromo.config);

  const active = products.filter((p) => p.active);
  const unit = (p: EditorProduct) => ({ productId: p.id, cats: p.cats, onSale: p.onSale });
  const eligible = active.filter((p) => inScope(v.scope, unit(p)));
  const targets = v.type === "bxgy" && c.target ? active.filter((p) => inScope(c.target!, unit(p))) : [];

  /* simulator: a sensible example basket, adjustable */
  const exampleQty = useMemo(() => {
    const q: Record<number, number> = {};
    const top = [...eligible].sort((a, b) => b.price - a.price);
    if (!top.length) return q;
    if (v.type === "bxgy" && c.target) { q[top[0].id] = c.buy; const t = [...targets].sort((a, b) => a.price - b.price).find((x) => x.id !== top[0].id) || targets[0]; if (t) q[t.id] = (q[t.id] || 0) + c.get; }
    else if (v.type === "bxgy") distribute(top, c.buy + c.get, q);
    else if (v.type === "bundle") distribute(top, c.qty, q);
    else if (v.type === "tiers") distribute(top, c.tiers[c.tiers.length - 1]?.qty || 2, q);
    else if (v.type === "spend") { let sum = 0, i = 0; while (sum < c.min && i < 12) { const p = top[i % top.length]; q[p.id] = (q[p.id] || 0) + 1; sum += p.price; i++; } }
    else q[top[0].id] = 1;
    return q;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.type, JSON.stringify(v.scope), JSON.stringify(c), products.length]);
  const [simQty, setSimQty] = useState<Record<number, number> | null>(null);
  useEffect(() => setSimQty(null), [exampleQty]);
  const qty = simQty || exampleQty;
  const simProducts = Array.from(new Set([...eligible.slice(0, 6), ...targets.slice(0, 4), ...active.filter((p) => qty[p.id])])).slice(0, 10);
  const sim = applyPromotions(
    simProducts.filter((p) => qty[p.id]).map((p) => ({ key: String(p.id), productId: p.id, price: p.price, qty: qty[p.id], cats: p.cats, onSale: p.onSale })),
    [asPromo]
  );
  const costKnown = simProducts.filter((p) => qty[p.id]).every((p) => p.cost !== null && p.cost !== undefined);
  const cost = simProducts.reduce((a, p) => a + (qty[p.id] ? (p.cost || 0) * qty[p.id] : 0), 0);
  const profit = sim.total - cost;

  /* smart checks */
  const warnings: { tone: "red" | "amber" | "blue"; text: string }[] = [];
  if (!eligible.length) warnings.push({ tone: "amber", text: "אין כרגע מוצרים פעילים שמשתתפים במבצע." });
  if (v.type === "bxgy" && c.target && !targets.length) warnings.push({ tone: "amber", text: "אין מוצרים פעילים בקבוצת הפריטים המוזלים." });
  if (sim.subtotal && sim.discount === 0 && Object.keys(qty).length) warnings.push({ tone: "amber", text: "בסל לדוגמה המבצע לא נותן הנחה. בדקו את התנאים או את המוצרים." });
  if (v.type === "bundle" && eligible.length) {
    const asc = [...eligible].sort((a, b) => a.price - b.price);
    const cheapest = Array.from({ length: c.qty }, (_, i) => asc[Math.min(i, asc.length - 1)].price).reduce((a, b) => a + b, 0);
    if (c.price >= cheapest) warnings.push({ tone: "amber", text: `מחיר החבילה (${sh(c.price)}) לא נמוך ממחיר ${c.qty} הפריטים הזולים במבצע (${sh(cheapest)}), אז חלק מהלקוחות לא יקבלו הנחה.` });
  }
  if (sim.subtotal && sim.discount / sim.subtotal > 0.5) warnings.push({ tone: "amber", text: `בסל לדוגמה ההנחה היא ${Math.round((sim.discount / sim.subtotal) * 100)}% מהסכום. ודאו שזה מכוון.` });
  if (costKnown && sim.subtotal && profit < 0) warnings.push({ tone: "red", text: `בסל לדוגמה המכירה בהפסד של ${sh(-profit)} לפי מחירי העלות של המוצרים.` });
  if (v.ends_at && v.ends_at < new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" })) warnings.push({ tone: "amber", text: "תאריך הסיום כבר עבר, המבצע לא יופעל." });
  const overlapping = others.filter((o) => o.id !== v.id && active.some((p) => productInPromo(o, unit(p)) && productInPromo(asPromo, unit(p))));
  if (overlapping.length) warnings.push({ tone: "blue", text: `חלק מהמוצרים משתתפים גם ב: ${overlapping.map((o) => `"${o.name}"`).join(", ")}. בסל המערכת תבחר לבד את ההנחה המשתלמת יותר ללקוחה, ופריט לא יקבל שתי הנחות.` });

  const tierSet = (i: number, patch: Partial<{ qty: number; percent: number }>) => setC({ tiers: c.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  return (
    <form action={action} className="flex flex-col lg:flex-row gap-5 items-start">
      <input type="hidden" name="payload" value={JSON.stringify(v)} />
      <div className="flex-1 min-w-0 w-full flex flex-col gap-5">
        {/* 1. type */}
        <section className="a-card flex flex-col gap-3" aria-labelledby="s-type">
          <h2 id="s-type" className="text-[17px] font-bold text-adm-navy">1. סוג המבצע</h2>
          <div role="radiogroup" aria-labelledby="s-type" className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(170px,1fr))]">
            {TYPES.map((t) => (
              <button key={t} type="button" role="radio" aria-checked={v.type === t} onClick={() => set({ type: t, config: { ...c } })} className={`text-start rounded-xl border-2 p-3 flex flex-col gap-1 transition-colors ${v.type === t ? "border-adm-blue bg-[#F2F7FF]" : "border-adm-line hover:border-[#C9D3E3]"}`}>
                <span className={`w-10 h-10 rounded-lg flex items-center justify-center font-extrabold text-[14px] ${v.type === t ? "bg-adm-blue text-white" : "bg-adm-bg text-adm-navy"}`} dir="ltr">{TYPE_ICON[t]}</span>
                <b className="text-[14px]">{TYPE_META[t].label}</b>
                <span className="text-[12px] text-adm-muted leading-5">{TYPE_META[t].help}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 2. rules */}
        <section className="a-card flex flex-col gap-4" aria-labelledby="s-rule">
          <h2 id="s-rule" className="text-[17px] font-bold text-adm-navy">2. התנאים</h2>
          {v.type === "bxgy" && (
            <>
              <div className="flex flex-wrap gap-2">
                {[
                  { l: "1+1", b: 1, g: 1, p: 100 },
                  { l: "2+1", b: 2, g: 1, p: 100 },
                  { l: "3+1", b: 3, g: 1, p: 100 },
                  { l: "השני ב-50%", b: 1, g: 1, p: 50 },
                  { l: "השלישי ב-50%", b: 2, g: 1, p: 50 },
                ].map((x) => (
                  <button key={x.l} type="button" onClick={() => setC({ buy: x.b, get: x.g, getPercent: x.p })} aria-pressed={c.buy === x.b && c.get === x.g && c.getPercent === x.p} className={`a-btn a-btn-sm ${c.buy === x.b && c.get === x.g && c.getPercent === x.p ? "!border-adm-blue !text-adm-blue" : ""}`}>{x.l}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-4">
                <Num id="buy" label="קונה" value={c.buy} onChange={(n) => setC({ buy: n || 1 })} max={10} suffix="פריטים" />
                <Num id="get" label="ומקבלת עוד" value={c.get} onChange={(n) => setC({ get: n || 1 })} max={10} suffix="פריטים" />
                <Num id="gp" label="בהנחה של" value={c.getPercent} onChange={(n) => setC({ getPercent: n || 100 })} max={100} suffix="% (100 = חינם)" />
              </div>
              <fieldset className="flex flex-col gap-2">
                <legend className="text-[14px] font-semibold pb-1.5">הפריט המוזל</legend>
                <Seg
                  label="הפריט המוזל"
                  value={c.target ? "other" : "same"}
                  onChange={(x) => setC({ target: x === "same" ? null : c.target || { ...EMPTY_SCOPE, mode: "categories" } })}
                  options={[{ v: "same", label: "מאותם מוצרים (הזול מביניהם)" }, { v: "other", label: "מקבוצה אחרת" }]}
                />
              </fieldset>
              <Num id="max" label="מקסימום פעמים בהזמנה" value={c.maxTimes} onChange={(n) => setC({ maxTimes: n })} max={50} help="ריק = ללא הגבלה. למשל 1 = רק זוג אחד בחינם בכל הזמנה" />
            </>
          )}
          {v.type === "percent" && (
            <div className="flex flex-col gap-3">
              <Seg label="סוג ההנחה" value={c.mode} onChange={(mode) => setC({ mode })} options={[{ v: "percent", label: "אחוז" }, { v: "amount", label: "סכום בשקלים" }]} />
              {c.mode === "percent" ? <Num id="pct" label="אחוז הנחה על כל פריט" value={c.percent} onChange={(n) => setC({ percent: n || 1 })} max={90} suffix="%" /> : <Num id="amt" label="הנחה על כל פריט" value={c.amount} onChange={(n) => setC({ amount: n || 1 })} suffix="₪" />}
            </div>
          )}
          {v.type === "tiers" && (
            <div className="flex flex-col gap-2.5">
              {c.tiers.map((t, i) => (
                <div key={i} className="flex flex-wrap items-end gap-3">
                  <Num id={`tq${i}`} label={`מדרגה ${i + 1}: מ־`} value={t.qty} onChange={(n) => tierSet(i, { qty: n || 2 })} min={2} max={20} suffix="פריטים" />
                  <Num id={`tp${i}`} label="הנחה" value={t.percent} onChange={(n) => tierSet(i, { percent: n || 1 })} max={90} suffix="%" />
                  {c.tiers.length > 1 && <button type="button" onClick={() => setC({ tiers: c.tiers.filter((_, j) => j !== i) })} className="a-btn a-btn-sm !h-11" aria-label={`הסרת מדרגה ${i + 1}`}><Icon name="trash" size={15} /></button>}
                </div>
              ))}
              {c.tiers.length < 6 && (
                <button type="button" onClick={() => { const last = c.tiers[c.tiers.length - 1]; setC({ tiers: [...c.tiers, { qty: (last?.qty || 1) + 1, percent: Math.min(90, (last?.percent || 5) + 5) }] }); }} className="a-btn a-btn-sm self-start"><Icon name="plus" size={15} /> מדרגה נוספת</button>
              )}
              <p className="text-[12px] text-adm-muted">ההנחה של המדרגה הגבוהה שהלקוחה הגיעה אליה חלה על כל הפריטים במבצע.</p>
            </div>
          )}
          {v.type === "bundle" && (
            <div className="flex flex-wrap gap-4">
              <Num id="bq" label="כמות פריטים" value={c.qty} onChange={(n) => setC({ qty: n || 2 })} min={2} max={20} />
              <Num id="bp" label="במחיר" value={c.price} onChange={(n) => setC({ price: n || 1 })} suffix="₪" />
              <Num id="bm" label="מקסימום חבילות בהזמנה" value={c.maxTimes} onChange={(n) => setC({ maxTimes: n })} max={50} help="ריק = ללא הגבלה" />
            </div>
          )}
          {v.type === "spend" && (
            <div className="flex flex-col gap-3">
              <Num id="smin" label="כשסכום הפריטים במבצע מגיע ל־" value={c.min} onChange={(n) => setC({ min: n || 1 })} suffix="₪" />
              <Seg label="סוג ההנחה" value={c.mode} onChange={(mode) => setC({ mode })} options={[{ v: "amount", label: "סכום בשקלים" }, { v: "percent", label: "אחוז" }]} />
              {c.mode === "percent" ? <Num id="spct" label="הנחה" value={c.percent} onChange={(n) => setC({ percent: n || 1 })} max={90} suffix="%" /> : <Num id="samt" label="הנחה" value={c.amount} onChange={(n) => setC({ amount: n || 1 })} suffix="₪" />}
            </div>
          )}
        </section>

        {/* 3. products */}
        <section className="a-card flex flex-col gap-5" aria-label="מוצרים">
          <ScopePicker title={v.type === "bxgy" && c.target ? "3. על מה קונים" : "3. על אילו מוצרים"} scope={v.scope} onChange={(scope) => set({ scope })} categories={categories} products={products} />
          {v.type === "bxgy" && c.target && (
            <div className="pt-4 border-t border-adm-line">
              <ScopePicker title="והפריט המוזל מתוך" scope={c.target} onChange={(target) => setC({ target })} categories={categories} products={products} allowAll={false} />
            </div>
          )}
        </section>

        {/* 4. details */}
        <section className="a-card flex flex-col gap-4" aria-labelledby="s-det">
          <h2 id="s-det" className="text-[17px] font-bold text-adm-navy">4. שם, תאריכים והגדרות</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="a-field">שם המבצע<span className="text-[12px] font-normal text-adm-muted">מופיע ללקוחות בסל ובקופה</span>
              <input value={v.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} required placeholder="למשל: 1+1 על כל המגפונים" className="a-input h-11" />
            </label>
            <label className="a-field">תגית על המוצרים<span className="text-[12px] font-normal text-adm-muted">ריק = אוטומטי ({autoBadge(v.type, c)})</span>
              <input value={v.badge} onChange={(e) => set({ badge: e.target.value })} maxLength={24} placeholder={autoBadge(v.type, c)} className="a-input h-11" />
            </label>
            <label className="a-field">מתחיל ב־<span className="text-[12px] font-normal text-adm-muted">ריק = מיד</span>
              <input type="date" value={v.starts_at} onChange={(e) => set({ starts_at: e.target.value })} className="a-input h-11" />
            </label>
            <label className="a-field">מסתיים ב־<span className="text-[12px] font-normal text-adm-muted">ריק = ללא הגבלה (כולל היום האחרון)</span>
              <input type="date" value={v.ends_at} min={v.starts_at || undefined} onChange={(e) => set({ ends_at: e.target.value })} className="a-input h-11" />
            </label>
          </div>
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2.5 text-[14px] cursor-pointer min-h-[40px]">
              <input type="checkbox" checked={v.active} onChange={(e) => set({ active: e.target.checked })} className="w-[18px] h-[18px] accent-[#3478F6]" />
              המבצע פעיל (אפשר להשהות בכל רגע)
            </label>
            <label className="flex items-center gap-2.5 text-[14px] cursor-pointer min-h-[40px]">
              <input type="checkbox" checked={v.allow_coupon} onChange={(e) => set({ allow_coupon: e.target.checked })} className="w-[18px] h-[18px] accent-[#3478F6]" />
              מצטבר עם קופונים (הקופון מחושב אחרי המבצע)
            </label>
          </div>
        </section>
      </div>

      {/* live preview */}
      <aside className="w-full lg:w-[380px] lg:sticky lg:top-[88px] flex flex-col gap-4">
        <section className="a-card flex flex-col gap-3" aria-labelledby="pv">
          <h2 id="pv" className="text-[16px] font-bold text-adm-navy">כך הלקוחה תראה</h2>
          <div className="rounded-xl bg-[#0E0E0E] p-4 flex flex-col gap-3">
            <div className="relative aspect-[4/3] rounded-lg overflow-hidden bg-[#1C1C1C]">
              {eligible[0]?.image && <img src={eligible[0].image} alt="" className="w-full h-full object-contain" />}
              <span className="absolute top-3 right-3 text-[13px] font-bold px-3 py-1.5 rounded-full bg-[#C9A24A] text-[#0E0E0E]">{badge}</span>
            </div>
            <div className="rounded-lg border-[1.5px] border-dashed border-[#C9A24A] px-3 py-2.5 text-[14px] text-white leading-6">
              <b>{v.name || "שם המבצע"}</b>
              <div className="text-[#D9D4C7]">{sentence}</div>
            </div>
          </div>
        </section>

        <section className="a-card flex flex-col gap-3" aria-labelledby="sim">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="sim" className="text-[16px] font-bold text-adm-navy">סימולטור סל</h2>
            {simQty && <button type="button" onClick={() => setSimQty(null)} className="text-[13px] text-adm-link underline">איפוס</button>}
          </div>
          {simProducts.length ? (
            <ul className="flex flex-col gap-2">
              {simProducts.map((p) => (
                <li key={p.id} className="flex items-center gap-2.5">
                  {p.image ? <img src={p.image} alt="" className="w-9 h-9 rounded-md object-cover bg-adm-bg" /> : <span className="w-9 h-9 rounded-md bg-adm-bg" />}
                  <span className="flex-1 min-w-0 text-[13px]"><span className="block truncate font-semibold">{p.name}</span><span className="text-adm-muted">{sh(p.price)}</span></span>
                  <span className="flex items-center border border-adm-line rounded-lg">
                    <button type="button" aria-label={`הפחתת ${p.name}`} onClick={() => setSimQty({ ...qty, [p.id]: Math.max(0, (qty[p.id] || 0) - 1) })} className="w-8 h-8">−</button>
                    <span className="w-5 text-center text-[14px] font-bold tabular-nums">{qty[p.id] || 0}</span>
                    <button type="button" aria-label={`הוספת ${p.name}`} onClick={() => setSimQty({ ...qty, [p.id]: Math.min(9, (qty[p.id] || 0) + 1) })} className="w-8 h-8">+</button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-adm-muted">בחרו מוצרים למבצע כדי לראות דוגמה.</p>
          )}
          <div className="flex flex-col gap-1.5 pt-2 border-t border-adm-line text-[14px]">
            <div className="flex justify-between"><span>מחיר רגיל</span><span>{sh(sim.subtotal)}</span></div>
            <div className="flex justify-between text-[#0F7A57] font-bold"><span>הנחת המבצע</span><span dir="ltr">-{sh(sim.discount)}</span></div>
            <div className="flex justify-between text-[16px] font-extrabold text-adm-navy"><span>הלקוחה משלמת</span><span>{sh(sim.total)}</span></div>
            {costKnown && sim.subtotal > 0 && <div className={`flex justify-between ${profit < 0 ? "text-[#B03A3A] font-bold" : "text-adm-muted"}`}><span>רווח משוער (לפי עלות)</span><span dir="ltr">{profit < 0 ? "-" : ""}{sh(Math.abs(profit))}</span></div>}
            {sim.hints[0] && <p className="text-[12px] text-adm-muted pt-1">בסל הלקוחה תראה: “{sim.hints[0]}”</p>}
          </div>
        </section>

        {warnings.length > 0 && (
          <section aria-label="בדיקות חכמות" className="flex flex-col gap-2">
            {warnings.map((w, i) => (
              <p key={i} className={`p-3 rounded-xl border text-[13px] leading-5 ${w.tone === "red" ? "bg-[#FDECEC] text-[#8A2626] border-[#F3D3D3]" : w.tone === "amber" ? "bg-[#FFF4E0] text-[#6B4600] border-[#F5DFB3]" : "bg-[#EEF4FF] text-[#1F3F7A] border-[#D6E4FD]"}`}>{w.text}</p>
            ))}
          </section>
        )}

        {state?.error && <p role="alert" className="p-3 rounded-xl bg-[#FDECEC] text-[#8A2626] text-[14px] font-semibold">{state.error}</p>}
        <Save isNew={isNew} />
        <Link href="/admin/promotions" className="a-btn h-11 w-full">ביטול</Link>
      </aside>
    </form>
  );
}

/** Spread n units over the most expensive products, round robin (example basket). */
function distribute(top: EditorProduct[], n: number, q: Record<number, number>) {
  const k = Math.min(top.length, Math.max(1, n));
  for (let i = 0; i < n; i++) { const p = top[i % k]; q[p.id] = (q[p.id] || 0) + 1; }
}

export const NEW_DEFAULTS: Omit<PromoFormValues, "id"> = {
  name: "",
  type: "bxgy",
  badge: "",
  scope: EMPTY_SCOPE,
  config: DEFAULT_CONFIG,
  starts_at: "",
  ends_at: "",
  active: true,
  allow_coupon: true,
};
