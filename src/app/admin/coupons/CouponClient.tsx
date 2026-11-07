"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Icon } from "../_components/ui";
import { saveCouponAction, type CouponFormState } from "./actions";
import { describeCoupon, fmtShekel } from "./lib";

/* ---------- copy code button ---------- */

export function CopyCode({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const t = document.createElement("textarea");
      t.value = code;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1600);
  }
  return (
    <button type="button" onClick={copy} className="a-btn a-btn-sm !h-9 !px-2.5 !gap-1 text-adm-muted" aria-label={done ? "הקוד הועתק" : `העתקת הקוד ${code}`}>
      <Icon name={done ? "check" : "copy"} size={15} className={done ? "text-[#0F7A57]" : ""} />
      {done && <span className="text-[12px] text-[#0F7A57]">הועתק</span>}
      <span className="sr-only" aria-live="polite">{done ? "הועתק" : ""}</span>
    </button>
  );
}

/* ---------- confirm-before-submit button (delete / disable) ---------- */

export function ConfirmButton({ action, id, message, label, ariaLabel, danger = true }: { action: (fd: FormData) => void; id: number; message: string; label?: string; ariaLabel: string; danger?: boolean }) {
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={`a-btn a-btn-sm !h-9 ${danger ? "a-btn-danger" : ""} ${label ? "" : "!px-2.5"}`} aria-label={ariaLabel} title={ariaLabel}>
        <Icon name="trash" size={15} />
        {label}
      </button>
    </form>
  );
}

/* ---------- create / edit drawer ---------- */

export type CouponFormValues = {
  id: number | null;
  code: string;
  description: string;
  type: "percent" | "fixed";
  value: string;
  min_total: string;
  max_discount: string;
  starts_at: string; // YYYY-MM-DD (Israel)
  ends_at: string;
  usage_limit: string;
  per_customer: string;
  active: boolean;
  used: number;
};

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L

function randomCode() {
  const a = new Uint32Array(4);
  crypto.getRandomValues(a);
  return "QUAL-" + Array.from(a, (n) => ALPHABET[n % ALPHABET.length]).join("");
}

function SaveButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="a-btn a-btn-primary flex-1 sm:flex-none">
      <Icon name="check" /> {pending ? "שומר…" : editing ? "שמירת שינויים" : "יצירת קופון"}
    </button>
  );
}

export function CouponDrawer({ initial }: { initial: CouponFormValues }) {
  const router = useRouter();
  const [state, action] = useFormState<CouponFormState, FormData>(saveCouponAction, null);
  const [v, setV] = useState(initial);
  const codeRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const editing = !!initial.id;
  const set = <K extends keyof CouponFormValues>(k: K, val: CouponFormValues[K]) => setV((s) => ({ ...s, [k]: val }));

  useEffect(() => {
    codeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") router.push("/admin/coupons"); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [router]);

  useEffect(() => {
    if (state?.field) panelRef.current?.querySelector<HTMLElement>(`[name="${state.field}"]`)?.focus();
  }, [state]);

  const num = (s: string) => (s.trim() === "" ? null : Number(s));
  const val = num(v.value);
  const parts = describeCoupon({
    code: v.code.trim().toUpperCase(),
    type: v.type,
    value: val,
    min_total: num(v.min_total),
    max_discount: v.type === "percent" ? num(v.max_discount) : null,
    starts_at: v.starts_at ? `${v.starts_at}T12:00:00Z` : null,
    ends_at: v.ends_at ? `${v.ends_at}T12:00:00Z` : null,
  });
  const sample = Math.max(num(v.min_total) || 0, 400);
  let sampleDiscount = 0;
  if (val && val > 0) {
    sampleDiscount = v.type === "percent" ? Math.round((sample * Math.min(100, val)) / 100) : val;
    const md = num(v.max_discount);
    if (v.type === "percent" && md) sampleDiscount = Math.min(sampleDiscount, md);
    sampleDiscount = Math.min(sampleDiscount, sample);
  }
  const err = (f: string) => (state?.field === f ? { "aria-invalid": true as const, "aria-describedby": "coupon-error" } : {});
  const errCls = (f: string) => (state?.field === f ? " !border-[#B03A3A]" : "");

  return (
    <div className="fixed inset-0 z-50 flex">
      <Link href="/admin/coupons" aria-label="סגירת החלונית" className="flex-1 bg-[#17243A]/40" tabIndex={-1} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="coupon-drawer-title" className="w-full max-w-[520px] h-full bg-adm-bg shadow-[0_0_40px_rgba(23,36,58,.25)] flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-white border-b border-adm-line">
          <div className="flex flex-col">
            <h2 id="coupon-drawer-title" className="text-[18px] font-extrabold text-adm-navy">{editing ? "עריכת קופון" : "קופון חדש"}</h2>
            {editing && <span className="text-[13px] text-adm-muted">נוצל {initial.used} פעמים עד כה</span>}
          </div>
          <Link href="/admin/coupons" className="a-btn a-btn-sm !px-2.5" aria-label="סגירה"><Icon name="close" /></Link>
        </div>

        <form action={action} className="flex-1 flex flex-col min-h-0" noValidate>
          {initial.id && <input type="hidden" name="id" value={initial.id} />}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            {/* live preview */}
            <section aria-label="תצוגה מקדימה" className="rounded-2xl bg-adm-navy text-white p-4 flex flex-col gap-2">
              <span className="text-[12px] font-bold text-[#9EC2FF]">כך הלקוחה תראה את הקופון</span>
              <p className="text-[15px] leading-7 font-semibold" aria-live="polite">
                {parts.map((p, i) => (
                  <span key={i}>{i > 0 && <span className="text-[#9AA6B8] mx-1.5" aria-hidden="true">·</span>}{i === 0 ? <>קופון <span dir="ltr" className="font-mono">{v.code.trim().toUpperCase() || "—"}</span></> : p}</span>
                ))}
              </p>
              {sampleDiscount > 0 && (
                <span className="text-[13px] text-[#D3DBE8]">לדוגמה: בסל של {fmtShekel(sample)} ההנחה היא {fmtShekel(sampleDiscount)} והסכום לתשלום {fmtShekel(sample - sampleDiscount)}</span>
              )}
            </section>

            {state?.error && <div id="coupon-error" role="alert" className="p-3 rounded-xl border bg-[#FDECEC] text-[#8A2626] border-[#F3D3D3] text-[14px]">{state.error}</div>}

            <div className="a-card flex flex-col gap-4">
              <label className="a-field">
                קוד הקופון
                <span className="flex gap-2">
                  <input ref={codeRef} name="code" value={v.code} onChange={(e) => set("code", e.target.value.toUpperCase().replace(/\s+/g, "-"))} required maxLength={32} dir="ltr" autoComplete="off" spellCheck={false} placeholder="WINTER15" className={"a-input font-mono tracking-wide uppercase text-left" + errCls("code")} {...err("code")} />
                  <button type="button" onClick={() => set("code", randomCode())} className="a-btn !h-[42px] shrink-0">יצירה אוטומטית</button>
                </span>
                <span className="text-[12px] font-normal text-adm-muted">אותיות באנגלית, ספרות ומקף. הלקוחה מקלידה את הקוד בקופה.</span>
              </label>
              <label className="a-field">
                תיאור פנימי (לא חובה)
                <input name="description" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={200} placeholder="למשל: מבצע חורף לחברות המועדון" className="a-input" />
              </label>
            </div>

            <div className="a-card flex flex-col gap-4">
              <fieldset className="flex flex-col gap-2">
                <legend className="text-[13px] font-semibold text-adm-text mb-2">סוג ההנחה</legend>
                <div className="grid grid-cols-2 gap-2.5">
                  {([
                    ["percent", "אחוז הנחה", "למשל 15% מכל הסל"],
                    ["fixed", "סכום קבוע", "למשל ₪50 הנחה"],
                  ] as const).map(([k, t, s]) => (
                    <label key={k} className={`rounded-xl border-[1.5px] p-3 flex gap-2.5 items-start cursor-pointer min-h-[64px] ${v.type === k ? "border-adm-blue bg-[#EEF4FF]" : "border-adm-line bg-white hover:bg-adm-bg"}`}>
                      <input type="radio" name="type" value={k} checked={v.type === k} onChange={() => set("type", k)} className="w-[18px] h-[18px] mt-0.5 accent-[#3478F6]" />
                      <span className="flex flex-col"><b className="text-[14px]">{t}</b><span className="text-[12px] text-adm-muted">{s}</span></span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="grid grid-cols-2 gap-3">
                <label className="a-field">
                  {v.type === "percent" ? "אחוז ההנחה" : "סכום ההנחה (₪)"}
                  <input name="value" type="number" inputMode="numeric" min={1} max={v.type === "percent" ? 100 : undefined} step={1} value={v.value} onChange={(e) => set("value", e.target.value)} required className={"a-input" + errCls("value")} {...err("value")} />
                </label>
                <label className="a-field">
                  מינימום לסל (₪)
                  <input name="min_total" type="number" inputMode="numeric" min={0} step={1} value={v.min_total} onChange={(e) => set("min_total", e.target.value)} placeholder="ללא" className={"a-input" + errCls("min_total")} {...err("min_total")} />
                </label>
                {v.type === "percent" && (
                  <label className="a-field col-span-2 sm:col-span-1">
                    הנחה מקסימלית (₪)
                    <input name="max_discount" type="number" inputMode="numeric" min={1} step={1} value={v.max_discount} onChange={(e) => set("max_discount", e.target.value)} placeholder="ללא הגבלה" className={"a-input" + errCls("max_discount")} {...err("max_discount")} />
                  </label>
                )}
              </div>
            </div>

            <div className="a-card flex flex-col gap-4">
              <h3 className="text-[14px] font-bold">תוקף ומגבלות</h3>
              <div className="grid grid-cols-2 gap-3">
                <label className="a-field">
                  מתאריך
                  <input name="starts_at" type="date" value={v.starts_at} onChange={(e) => set("starts_at", e.target.value)} className={"a-input" + errCls("starts_at")} {...err("starts_at")} />
                </label>
                <label className="a-field">
                  עד תאריך (כולל)
                  <input name="ends_at" type="date" value={v.ends_at} min={v.starts_at || undefined} onChange={(e) => set("ends_at", e.target.value)} className={"a-input" + errCls("ends_at")} {...err("ends_at")} />
                </label>
                <label className="a-field">
                  מגבלת שימושים כוללת
                  <input name="usage_limit" type="number" inputMode="numeric" min={1} step={1} value={v.usage_limit} onChange={(e) => set("usage_limit", e.target.value)} placeholder="ללא הגבלה" className={"a-input" + errCls("usage_limit")} {...err("usage_limit")} />
                </label>
                <label className="a-field">
                  שימושים לכל לקוחה
                  <input name="per_customer" type="number" inputMode="numeric" min={1} step={1} value={v.per_customer} onChange={(e) => set("per_customer", e.target.value)} placeholder="ללא הגבלה" className={"a-input" + errCls("per_customer")} {...err("per_customer")} />
                </label>
              </div>
              <span className="text-[12px] text-adm-muted -mt-1">התאריכים לפי שעון ישראל. ריק = ללא הגבלה. לקוחה מזוהה לפי מספר הטלפון.</span>
              <label className="flex items-center gap-2.5 min-h-[40px] text-[14px] font-semibold cursor-pointer">
                <input type="checkbox" name="active" checked={v.active} onChange={(e) => set("active", e.target.checked)} className="w-5 h-5 accent-[#3478F6]" />
                הקופון פעיל
                <span className="text-[12px] font-normal text-adm-muted">(קופון מושבת לא יתקבל בקופה)</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2 p-4 bg-white border-t border-adm-line">
            <SaveButton editing={editing} />
            <Link href="/admin/coupons" className="a-btn">ביטול</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
