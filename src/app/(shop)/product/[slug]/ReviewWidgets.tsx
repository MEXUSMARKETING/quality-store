"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { reportReview, submitReview, type ReviewFormState } from "./review-actions";

const STAR = "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z";

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="flex text-gold" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg key={s} width={size} height={size} viewBox="0 0 24 24">
          <path d={STAR} fill={s <= Math.round(value) ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  );
}

function Send() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-dark disabled:opacity-60">
      {pending ? "שולחת…" : "שליחת הביקורת"}
    </button>
  );
}

export function ReviewForm({ productId }: { productId: number }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useFormState<ReviewFormState, FormData>(submitReview, null);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const errRef = useRef<HTMLParagraphElement>(null);
  const okRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state?.error) errRef.current?.focus();
    if (state?.ok) okRef.current?.focus();
  }, [state]);

  if (state?.ok) {
    return (
      <div ref={okRef} tabIndex={-1} role="status" className="p-5 rounded-[18px] bg-[#E2EADF] flex flex-col gap-1 text-[15px]">
        <b>תודה רבה על הביקורת!</b>
        <span>הביקורת תפורסם אחרי אישור.</span>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" className="btn btn-outline self-start" onClick={() => setOpen(true)} aria-expanded={false}>
        כתבי ביקורת
      </button>
    );
  }

  const shown = hover || rating;
  return (
    <form action={action} className="p-5 md:p-6 rounded-[18px] bg-panel border border-line flex flex-col gap-4" aria-label="כתיבת ביקורת">
      <input type="hidden" name="product_id" value={productId} />
      <input type="hidden" name="rating" value={rating || ""} />
      {/* honeypot */}
      <label className="sr-only" aria-hidden="true">
        אתר
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>
      <b className="text-lg">כתבי ביקורת</b>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-[14px] font-medium pb-1.5">הדירוג שלך <span className="text-[#A13A0D]">*</span></legend>
        <div className="flex gap-1" role="radiogroup" aria-label="דירוג" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={rating === s}
              aria-label={`${s} כוכבים`}
              onMouseEnter={() => setHover(s)}
              onFocus={() => setHover(s)}
              onBlur={() => setHover(0)}
              onClick={() => setRating(s)}
              className="w-11 h-11 flex items-center justify-center text-gold"
            >
              <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
                <path d={STAR} fill={s <= shown ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid sm:grid-cols-2 gap-3">
        <label className="field">
          <span>שם <span className="text-[#A13A0D]">*</span></span>
          <input name="name" required maxLength={60} autoComplete="given-name" className="input" />
        </label>
        <label className="field">
          <span>טלפון <span className="text-muted font-normal">(לא חובה – לסימון &quot;רכישה מאומתת&quot;, לא יוצג)</span></span>
          <input name="phone" type="tel" inputMode="tel" dir="ltr" maxLength={20} autoComplete="tel" className="input" />
        </label>
      </div>
      <label className="field">
        כותרת
        <input name="title" maxLength={120} className="input" placeholder="למשל: נוחות מטורפת" />
      </label>
      <label className="field">
        <span>הביקורת <span className="text-[#A13A0D]">*</span></span>
        <textarea name="body" required minLength={3} maxLength={2000} rows={4} className="input !h-auto py-3 leading-7" placeholder="איך המידה, הנוחות, האיכות?" />
      </label>

      {state?.error && <p ref={errRef} tabIndex={-1} role="alert" className="text-[15px] text-[#A13A0D] font-bold">{state.error}</p>}
      <div className="flex flex-wrap gap-2.5 items-center">
        <Send />
        <button type="button" className="h-[50px] px-4 text-[15px] underline" onClick={() => setOpen(false)}>ביטול</button>
        <span className="text-[13px] text-muted">הביקורת תפורסם אחרי אישור החנות.</span>
      </div>
    </form>
  );
}

export function ReportButton({ id }: { id: number }) {
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (done) return <span role="status" className="text-[13px] text-muted">תודה, נבדוק את זה</span>;
  return (
    <button
      type="button"
      disabled={busy}
      className="text-[13px] text-muted underline min-h-[36px] px-1"
      onClick={async () => {
        if (!window.confirm("לדווח על הביקורת הזו לחנות?")) return;
        setBusy(true);
        try {
          await reportReview(id);
        } finally {
          setDone(true);
          setBusy(false);
        }
      }}
    >
      דיווח
    </button>
  );
}
