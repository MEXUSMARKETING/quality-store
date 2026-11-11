"use client";

import { useEffect, useId, useRef, useState } from "react";
import { THEMES, hasForm, type PopupConfig } from "@/lib/popups-shared";

export type SubmitResult = { ok: boolean; error?: string; coupon?: string };
export type LeadData = { name: string; phone: string; email: string; message: string; consent: boolean };

type Props = {
  config: PopupConfig;
  /** Absolute instead of fixed positioning – for the admin preview frame. */
  contained?: boolean;
  /** Mobile layout (preview device toggle, or a narrow screen). */
  compact?: boolean;
  /** Coupon that is already known on the client (always-mode, or the admin preview). */
  coupon?: string;
  onClose: () => void;
  onCta?: () => void;
  onSubmit?: (d: LeadData) => Promise<SubmitResult>;
  /** Admin preview: jump straight to the success screen. */
  forceDone?: boolean;
};

/* ---------------- small pieces ---------------- */

function Countdown({ to, color, box }: { to: string; color: string; box: string }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!Number.isFinite(target)) return null;
  const left = Math.max(0, target - now);
  if (left <= 0) return null;
  const parts = [
    { v: Math.floor(left / 86400000), l: "ימים" },
    { v: Math.floor((left / 3600000) % 24), l: "שעות" },
    { v: Math.floor((left / 60000) % 60), l: "דקות" },
    { v: Math.floor((left / 1000) % 60), l: "שניות" },
  ];
  return (
    <div className="flex gap-2 justify-center" dir="rtl" aria-label="הזמן שנותר למבצע" role="timer">
      {parts.map((p) => (
        <span key={p.l} className="w-[58px] py-2 rounded-xl flex flex-col items-center" style={{ background: box, color }}>
          <b className="font-display text-[22px] leading-none tabular-nums">{String(p.v).padStart(2, "0")}</b>
          <span className="text-[11px] opacity-80 pt-1">{p.l}</span>
        </span>
      ))}
    </div>
  );
}

function CouponBox({ code, fg, border, bg }: { code: string; fg: string; border: string; bg: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      /* clipboard can be blocked; the code is still visible */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };
  return (
    <div className="flex items-stretch rounded-2xl overflow-hidden border-2 border-dashed" style={{ borderColor: border, background: bg }}>
      <span dir="ltr" className="flex-1 flex items-center justify-center font-display font-extrabold text-[24px] tracking-[4px] py-3 px-3 select-all" style={{ color: fg }}>
        {code}
      </span>
      <button type="button" onClick={copy} className="px-4 text-[14px] font-bold border-s-2 border-dashed" style={{ borderColor: border, color: fg }} aria-live="polite">
        {copied ? "הועתק ✓" : "העתקה"}
      </button>
    </div>
  );
}

/* ---------------- main ---------------- */

export default function PopupView({ config: c, contained, compact, coupon, onClose, onCta, onSubmit, forceDone }: Props) {
  const t = THEMES[c.theme];
  const titleId = useId();
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [revealed, setRevealed] = useState("");
  const [consent, setConsent] = useState(true);
  const firstRef = useRef<HTMLElement | null>(null);

  const isDone = forceDone || done;
  const shownCoupon = revealed || coupon || c.coupon;
  const form = hasForm(c);
  const overlay = c.layout === "center" || c.layout === "split" || c.layout === "fullscreen";
  const pos = contained ? "absolute" : "fixed";

  useEffect(() => {
    if (!contained) firstRef.current?.focus({ preventScroll: true });
  }, [contained]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const fd = new FormData(e.currentTarget);
    const d: LeadData = {
      name: String(fd.get("name") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      message: String(fd.get("message") || "").trim(),
      consent: c.consent ? consent : false,
    };
    if (c.fields.phone && d.phone.replace(/\D/g, "").length < 9) return setError("נא להזין מספר טלפון תקין");
    if (c.fields.email && d.email && !/^\S+@\S+\.\S+$/.test(d.email)) return setError("כתובת המייל לא תקינה");
    if (c.fields.name && !d.name) return setError("נא להזין שם");
    setError("");
    setPending(true);
    try {
      const r = onSubmit ? await onSubmit(d) : { ok: true };
      if (!r.ok) setError(r.error || "משהו השתבש, נסי שוב");
      else {
        if (r.coupon) setRevealed(r.coupon);
        setDone(true);
      }
    } catch {
      setError("משהו השתבש, נסי שוב");
    } finally {
      setPending(false);
    }
  };

  const field = { background: t.field, borderColor: t.fieldBorder, color: t.fg };
  const inputCls = "h-12 rounded-xl border px-4 text-[15px] w-full min-w-0 outline-none focus:ring-2 focus:ring-offset-0 placeholder:opacity-60";
  const btnStyle = { background: t.accent, color: t.accentFg };
  const center = c.layout === "center" || (compact && c.layout !== "bar") || c.layout === "fullscreen";

  const cta = c.ctaText && c.ctaHref ? (
    <a
      href={c.ctaHref}
      onClick={() => { onCta?.(); }}
      className="h-12 px-7 rounded-full font-bold text-[15px] inline-flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
      style={btnStyle}
    >
      {c.ctaText}
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
    </a>
  ) : null;

  const body = (
    <div className={`flex flex-col gap-3.5 ${center ? "items-center text-center" : "items-start text-right"}`}>
      {!isDone ? (
        <>
          {c.kicker && <span className="text-[12px] font-bold tracking-[2.5px] uppercase" style={{ color: t.kicker }}>{c.kicker}</span>}
          {c.title && (
            <h2 id={titleId} className={`font-display font-extrabold leading-[1.05] whitespace-pre-line ${c.layout === "fullscreen" && !compact ? "text-[54px]" : compact ? "text-[28px]" : "text-[34px]"}`}>
              {c.title}
            </h2>
          )}
          {c.text && <p className="text-[15px] leading-relaxed max-w-[420px]" style={{ color: t.muted }}>{c.text}</p>}
          {c.countdown && <Countdown to={c.countdown} color={t.fg} box={c.theme === "light" ? "#F6F5F2" : "rgba(255,255,255,.12)"} />}
          {c.couponMode === "always" && shownCoupon && <div className="w-full max-w-[340px]"><CouponBox code={shownCoupon} fg={t.fg} border={t.kicker} bg={t.field} /></div>}
          {form ? (
            <form onSubmit={submit} noValidate className="w-full max-w-[380px] flex flex-col gap-2.5 pt-1">
              {c.fields.name && (
                <label className="flex flex-col gap-1">
                  <span className="sr-only">שם</span>
                  <input ref={(el) => { if (el && !firstRef.current) firstRef.current = el; }} name="name" autoComplete="name" placeholder="השם שלך" className={inputCls} style={field} />
                </label>
              )}
              {c.fields.phone && (
                <label className="flex flex-col gap-1">
                  <span className="sr-only">טלפון</span>
                  <input ref={(el) => { if (el && !firstRef.current) firstRef.current = el; }} name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="מספר טלפון" dir="ltr" className={inputCls + " text-right"} style={field} />
                </label>
              )}
              {c.fields.email && (
                <label className="flex flex-col gap-1">
                  <span className="sr-only">מייל</span>
                  <input name="email" type="email" autoComplete="email" placeholder="כתובת מייל" dir="ltr" className={inputCls + " text-right"} style={field} />
                </label>
              )}
              {c.fields.message && (
                <label className="flex flex-col gap-1">
                  <span className="sr-only">הודעה</span>
                  <textarea name="message" rows={3} placeholder="במה נוכל לעזור?" className={inputCls + " h-auto py-3 resize-none"} style={field} />
                </label>
              )}
              {c.consent && (
                <label className="flex items-center gap-2 text-[12.5px] text-right" style={{ color: t.muted }}>
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="w-4 h-4 shrink-0" style={{ accentColor: t.accent }} />
                  אני מאשרת קבלת עדכונים ומבצעים ב־SMS ובמייל
                </label>
              )}
              {error && <p role="alert" className="text-[13px] font-bold" style={{ color: c.theme === "red" ? "#FFF" : "#C0392B" }}>{error}</p>}
              <button type="submit" disabled={pending} className="h-12 rounded-xl font-bold text-[15px] disabled:opacity-60 hover:opacity-90 transition-opacity" style={btnStyle}>
                {pending ? "שולחת…" : c.submitText}
              </button>
            </form>
          ) : (
            cta
          )}
        </>
      ) : (
        <>
          <span className="w-14 h-14 rounded-full flex items-center justify-center text-[26px]" style={{ background: t.field, color: t.kicker }} aria-hidden="true">✓</span>
          <h2 id={titleId} className="font-display font-extrabold text-[30px] leading-tight">{c.successTitle}</h2>
          {c.successText && <p className="text-[15px] leading-relaxed max-w-[380px]" style={{ color: t.muted }}>{c.successText}</p>}
          {c.couponMode === "after" && shownCoupon && <div className="w-full max-w-[340px]"><CouponBox code={shownCoupon} fg={t.fg} border={t.kicker} bg={t.field} /></div>}
          {cta}
        </>
      )}
      {overlay && !isDone && (
        <button type="button" onClick={onClose} className="text-[13px] underline underline-offset-4 opacity-75 hover:opacity-100 pt-0.5" style={{ color: t.muted }}>
          לא תודה
        </button>
      )}
    </div>
  );

  const closeBtn = (
    <button
      type="button"
      ref={(el) => { if (el && !firstRef.current && !form) firstRef.current = el; }}
      onClick={onClose}
      aria-label="סגירה"
      className="absolute top-3 left-3 z-10 w-9 h-9 rounded-full flex items-center justify-center hover:scale-105 transition-transform"
      style={{ background: c.theme === "light" || c.theme === "gold" ? "rgba(20,20,20,.08)" : "rgba(255,255,255,.14)", color: t.fg }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
    </button>
  );

  const shadow = "shadow-[0_30px_80px_-20px_rgba(0,0,0,.5)]";
  const card = { background: t.bg, color: t.fg };

  /* ---------- non-blocking layouts ---------- */
  if (c.layout === "bar") {
    return (
      <div role="dialog" aria-labelledby={titleId} className={`${pos} inset-x-0 bottom-0 z-[60] pp-slide ${shadow}`} style={card}>
        <div className={`relative mx-auto max-w-[1320px] ${compact ? "px-4 py-3.5 pe-12 flex flex-col gap-2 items-start" : "px-8 py-3.5 pe-14 flex items-center gap-5"}`}>
          {closeBtn}
          <div className={`flex-1 min-w-0 flex ${compact ? "flex-col" : "items-baseline gap-3"}`}>
            <b id={titleId} className="font-display text-[17px]">{c.title}</b>
            {c.text && <span className="text-[14px]" style={{ color: t.muted }}>{c.text}</span>}
          </div>
          {c.couponMode === "always" && shownCoupon && <span dir="ltr" className="font-display font-extrabold tracking-[3px] px-3 py-1.5 rounded-lg border-2 border-dashed" style={{ borderColor: t.kicker }}>{shownCoupon}</span>}
          {c.ctaText && c.ctaHref && (
            <a href={c.ctaHref} onClick={() => onCta?.()} className="h-10 px-5 rounded-full font-bold text-[14px] inline-flex items-center shrink-0 hover:opacity-90" style={btnStyle}>
              {c.ctaText}
            </a>
          )}
        </div>
      </div>
    );
  }

  if (c.layout === "corner") {
    return (
      <div role="dialog" aria-labelledby={titleId} className={`${pos} z-[60] pp-up rounded-[20px] overflow-hidden ${shadow} ${compact ? "inset-x-3 bottom-3" : "bottom-5 right-5 w-[350px]"}`} style={card}>
        {closeBtn}
        {c.image && !isDone && <img src={c.image} alt="" className="w-full h-32 object-cover" />}
        <div className="p-6 pt-7">{body}</div>
      </div>
    );
  }

  /* ---------- modal layouts ---------- */
  let inner: React.ReactNode;
  if (c.layout === "split" && !compact) {
    inner = (
      <div className={`relative w-full max-w-[800px] grid grid-cols-2 rounded-[24px] overflow-hidden pp-up ${shadow}`} style={card}>
        {closeBtn}
        <div className="p-10 flex flex-col justify-center">{body}</div>
        <div className="relative min-h-[460px] bg-black/10">{c.image && <img src={c.image} alt="" className="absolute inset-0 w-full h-full object-cover" />}</div>
      </div>
    );
  } else if (c.layout === "fullscreen") {
    inner = (
      <div className={`relative w-full max-w-[940px] rounded-[24px] overflow-hidden pp-up ${shadow} ${compact ? "" : "min-h-[480px] flex items-center justify-center"}`} style={card}>
        {closeBtn}
        {c.image && (
          compact ? (
            <img src={c.image} alt="" className="w-full h-40 object-cover" />
          ) : (
            <>
              <img src={c.image} alt="" className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${t.bg}CC 0%, ${t.bg}EE 55%, ${t.bg} 100%)` }} aria-hidden="true" />
            </>
          )
        )}
        <div className={`relative ${compact ? "p-6" : "p-12"}`}>{body}</div>
      </div>
    );
  } else {
    inner = (
      <div className={`relative w-full ${compact ? "max-w-[360px]" : "max-w-[460px]"} rounded-[24px] overflow-hidden pp-up ${shadow}`} style={card}>
        {closeBtn}
        {c.image && !isDone && <img src={c.image} alt="" className={`w-full object-cover ${compact ? "h-36" : "h-48"}`} />}
        <div className={compact ? "p-6" : "p-8"}>{body}</div>
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal={!contained}
      aria-labelledby={titleId}
      className={`${pos} inset-0 z-[60] flex items-center justify-center p-4 bg-black/55 backdrop-blur-[3px] pp-fade overflow-y-auto`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {inner}
    </div>
  );
}
