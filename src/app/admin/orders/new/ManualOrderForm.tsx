"use client";

import { useFormState } from "react-dom";
import { useState } from "react";
import { PAYMENT, PAYMENT_STATUS, SHIPPING, shekel } from "@/lib/config";
import { createManualOrderAction } from "../actions";
import { Result, Submit } from "../_components/forms";

/** `stock` keys are sizes, or "colour::size" for variant products (labels in `labels`) */
export type PickProduct = { id: number; name: string; price: number; image: string; stock: Record<string, number>; labels?: Record<string, string>; active: boolean };
type Line = { key: number; productId: string; size: string; qty: number };

let seq = 1;
const blank = (): Line => ({ key: seq++, productId: "", size: "", qty: 1 });

export default function ManualOrderForm({ products }: { products: PickProduct[] }) {
  const [state, action] = useFormState(createManualOrderAction, null);
  const [lines, setLines] = useState<Line[]>([blank()]);
  const [shipping, setShipping] = useState("pickup");
  const byId = new Map(products.map((p) => [String(p.id), p]));

  const update = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const sizesOf = (p?: PickProduct) =>
    p ? Object.entries(p.stock).filter(([, q]) => Number(q) > 0).sort((a, b) => (p.labels ? 0 : Number(a[0]) - Number(b[0]))) : [];

  // what is already taken by other lines (same product + size)
  const used = (l: Line) => lines.filter((x) => x.key !== l.key && x.productId === l.productId && x.size === l.size).reduce((a, x) => a + x.qty, 0);

  const subtotal = lines.reduce((a, l) => a + (byId.get(l.productId)?.price || 0) * (l.productId ? l.qty : 0), 0);
  const pairs = lines.reduce((a, l) => a + (l.productId ? l.qty : 0), 0);

  return (
    <form action={action} className="grid gap-4 lg:grid-cols-[1.5fr_1fr] items-start">
      <div className="flex flex-col gap-4 min-w-0">
        <section className="a-card flex flex-col gap-3" aria-labelledby="mo-items">
          <h2 id="mo-items" className="text-[16px] font-bold">פריטים</h2>
          {products.length === 0 && <p className="text-[14px] text-adm-muted">אין מוצרים עם מלאי זמין.</p>}
          <ul className="flex flex-col gap-3">
            {lines.map((l, idx) => {
              const p = byId.get(l.productId);
              const sizes = sizesOf(p);
              const max = p && l.size ? Math.max(0, Number(p.stock[l.size] || 0) - used(l)) : 0;
              const over = !!p && !!l.size && l.qty > max;
              return (
                <li key={l.key} className="flex flex-wrap gap-2.5 items-end p-3 rounded-xl border border-adm-line bg-[#FBFAFE]">
                  {p?.image ? <img src={p.image} alt="" className="w-[42px] h-[42px] rounded-lg object-cover bg-adm-bg" /> : <span className="w-[42px] h-[42px] rounded-lg bg-adm-bg" aria-hidden="true" />}
                  <label className="a-field flex-[3_1_200px]">
                    מוצר {idx + 1}
                    <select
                      name="productId"
                      className="a-input"
                      value={l.productId}
                      required
                      onChange={(e: any) => update(l.key, { productId: e.target.value, size: "", qty: 1 })}
                    >
                      <option value="">בחירת מוצר…</option>
                      {products.map((pp) => (
                        <option key={pp.id} value={pp.id}>{pp.name} · {shekel(pp.price)}{pp.active ? "" : " (מוסתר באתר)"}</option>
                      ))}
                    </select>
                  </label>
                  <label className="a-field flex-[1_1_100px]">
                    {p?.labels ? "צבע ומידה" : "מידה"}
                    <select name="size" className="a-input" value={l.size} required onChange={(e: any) => update(l.key, { size: e.target.value, qty: 1 })}>
                      <option value="">—</option>
                      {sizes.map(([s, q]) => <option key={s} value={s}>{p?.labels?.[s] || s} (נשארו {q})</option>)}
                    </select>
                  </label>
                  <label className="a-field w-[86px]">
                    כמות
                    <input
                      name="qty"
                      type="number"
                      min={1}
                      max={Math.max(1, max)}
                      value={l.qty}
                      onChange={(e: any) => update(l.key, { qty: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                      className="a-input"
                      aria-invalid={over || undefined}
                    />
                  </label>
                  <span className="min-w-[70px] h-[42px] flex items-center font-bold">{p ? shekel(p.price * l.qty) : "—"}</span>
                  <button
                    type="button"
                    className="a-btn a-btn-sm a-btn-danger h-[42px]"
                    aria-label={`הסרת שורה ${idx + 1}`}
                    disabled={lines.length === 1}
                    onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                  >
                    הסרה
                  </button>
                  {over && <p role="alert" className="basis-full text-[13px] font-semibold text-[#B03A3A]">נשארו במלאי {max} בלבד במידה זו</p>}
                </li>
              );
            })}
          </ul>
          <button type="button" className="a-btn a-btn-sm self-start" onClick={() => setLines((ls) => [...ls, blank()])}>
            + הוספת פריט
          </button>
        </section>

        <section className="a-card flex flex-col gap-3" aria-labelledby="mo-cust">
          <h2 id="mo-cust" className="text-[16px] font-bold">פרטי הלקוחה</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="a-field">שם מלא *<input name="customer_name" required maxLength={120} className="a-input" autoComplete="off" /></label>
            <label className="a-field">
              טלפון נייד *
              <input name="phone" required inputMode="tel" dir="ltr" className="a-input text-left" placeholder="05X-XXXXXXX" />
            </label>
            <label className="a-field sm:col-span-2">מייל<input name="email" type="email" dir="ltr" className="a-input text-left" maxLength={160} /></label>
          </div>
          <fieldset className="flex flex-col gap-2">
            <legend className="text-[13px] font-semibold pb-1.5">משלוח</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(SHIPPING).map(([k, v]) => (
                <label key={k} className={`flex items-center gap-2 min-h-[42px] px-3.5 rounded-[10px] border text-[14px] cursor-pointer ${shipping === k ? "border-adm-blue bg-[#F1ECFF] font-semibold" : "border-adm-line bg-white"}`}>
                  <input type="radio" name="shipping_method" value={k} checked={shipping === k} onChange={() => setShipping(k)} className="accent-adm-blue" />
                  {v}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="a-field">עיר{shipping === "home" ? " *" : ""}<input name="city" required={shipping === "home"} maxLength={80} className="a-input" /></label>
            {shipping === "home" && (
              <>
                <label className="a-field">רחוב ומספר *<input name="street" required maxLength={160} className="a-input" /></label>
                <label className="a-field">דירה / קומה<input name="apt" maxLength={60} className="a-input" /></label>
              </>
            )}
          </div>
          <label className="a-field">הערה להזמנה<textarea name="notes" rows={2} maxLength={1000} className="a-input" placeholder="למשל: נמכר בוואטסאפ, לאסוף ביום חמישי" /></label>
        </section>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-[84px]">
        <section className="a-card flex flex-col gap-3" aria-labelledby="mo-pay">
          <h2 id="mo-pay" className="text-[16px] font-bold">תשלום וסיכום</h2>
          <label className="a-field">
            אמצעי תשלום
            <select name="payment_method" className="a-input" defaultValue="cash">
              {Object.entries(PAYMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="a-field">
            סטטוס תשלום
            <select name="payment_status" className="a-input" defaultValue="pending">
              {Object.entries(PAYMENT_STATUS).filter(([k]) => k === "pending" || k === "paid").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <div className="flex flex-col gap-2 text-[14px] pt-2 border-t border-adm-line">
            <div className="flex justify-between"><span className="text-adm-mid">זוגות</span><span>{pairs}</span></div>
            <div className="flex justify-between"><span className="text-adm-mid">משלוח</span><span>חינם</span></div>
            <div className="flex justify-between text-[18px] font-extrabold text-adm-navy"><span>סה״כ</span><span>{shekel(subtotal)}</span></div>
            <p className="text-[12px] text-adm-muted">המחירים נלקחים מהמוצרים בזמן השמירה. המלאי יורד אוטומטית.</p>
          </div>
          <Submit pendingText="יוצר הזמנה…">יצירת הזמנה</Submit>
          <Result state={state} />
        </section>
      </aside>
    </form>
  );
}
