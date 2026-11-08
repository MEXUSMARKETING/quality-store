"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { login } from "./actions";

/* NEXSHOP sign-in: dark aurora background in the logo's colours, glass card, username + password,
   show/hide password, Caps Lock warning, shake on error, loading state. Keyboard and screen-reader
   friendly; animations switch off with prefers-reduced-motion. */

function Ico({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
const I = {
  user: "M20 21v-1a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  lock: "M6 11h12v10H6zM8 11V7a4 4 0 0 1 8 0v4",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  eyeOff: "M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1.1M9.9 9.9a3 3 0 0 0 4.2 4.2",
  arrow: "M15 6l-6 6 6 6",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  bolt: "M13 3L4 14h7l-1 7 9-11h-7z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6",
  alert: "M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="nx-btn w-full flex items-center justify-center gap-2.5">
      {pending ? (
        <>
          <span className="nx-spin" aria-hidden="true" /> מתחברים…
        </>
      ) : (
        <>
          כניסה למערכת <Ico d={I.arrow} size={18} />
        </>
      )}
    </button>
  );
}

const FEATURES = [
  { icon: I.chart, title: "הכל במקום אחד", text: "הזמנות, מלאי, לקוחות ודוחות בזמן אמת" },
  { icon: I.bolt, title: "מבצעים ואוטומציות", text: "1+1, חבילות ומדרגות שמופעלים לבד בסל" },
  { icon: I.sparkle, title: "עוזר AI מובנה", text: "תיאורי מוצרים ותובנות בלחיצה" },
];

export default function LoginForm({ configured, storeName = "" }: { configured: boolean; storeName?: string }) {
  const [state, action] = useFormState(login, null);
  const [show, setShow] = useState(false);
  const [caps, setCaps] = useState(false);
  const [shake, setShake] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state?.error) {
      setShake(true);
      passRef.current?.select();
      passRef.current?.focus();
    }
  }, [state]);
  useEffect(() => userRef.current?.focus(), []);

  const capsCheck = (e: React.KeyboardEvent<HTMLInputElement>) => setCaps(!!e.getModifierState?.("CapsLock"));

  return (
    <div className="nx-login relative min-h-screen overflow-hidden flex font-sans" dir="rtl">
      {/* background */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none">
        <div className="nx-blob nx-blob-1" />
        <div className="nx-blob nx-blob-2" />
        <div className="nx-blob nx-blob-3" />
        <div className="absolute inset-0 nx-grid" />
      </div>

      <div className="relative z-10 w-full max-w-[1200px] mx-auto px-4 sm:px-8 py-8 lg:py-0 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-16 items-center min-h-screen">
        {/* brand side */}
        <section className="nx-rise min-w-0 flex flex-col gap-8 items-center lg:items-start text-center lg:text-start" aria-label="NEXSHOP">
          <img src="/brand/nexshop-logo-full.png" alt="NEXSHOP – הדור הבא של החנויות הדיגיטליות" width={1100} height={309} className="w-[260px] sm:w-[340px] lg:w-[460px] h-auto drop-shadow-[0_10px_40px_rgba(122,18,255,.35)]" />
          <div className="hidden lg:flex flex-col gap-4 max-w-[440px]">
            <h1 className="text-[34px] font-extrabold leading-tight tracking-tight">
              החנות שלך, <span className="nx-grad-text">בניהול חכם</span>
            </h1>
            <ul className="flex flex-col gap-3 pt-2">
              {FEATURES.map((f) => (
                <li key={f.title} className="flex items-center gap-3.5">
                  <span className="w-11 h-11 shrink-0 rounded-[13px] flex items-center justify-center bg-white/[.07] border border-white/10 text-[#C7B4FF]">
                    <Ico d={f.icon} />
                  </span>
                  <span className="flex flex-col">
                    <b className="text-[15px]">{f.title}</b>
                    <span className="text-[14px] text-[#B4AED6]">{f.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* form side */}
        <section className="nx-rise w-full max-w-[440px] mx-auto lg:mx-0 lg:justify-self-end" style={{ animationDelay: "120ms" }}>
          <form action={action} onAnimationEnd={() => setShake(false)} className={`nx-glass rounded-[26px] p-6 sm:p-9 flex flex-col gap-5 ${shake ? "nx-shake" : ""}`}>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-[26px] font-extrabold">ברוכים השבים</h2>
              <p className="text-[15px] text-[#B4AED6]">
                התחברו לניהול {storeName ? <b className="text-white">{storeName}</b> : "החנות"}
              </p>
            </div>

            {!configured ? (
              <p className="text-[14px] leading-6 rounded-2xl p-4 bg-[#FF01BB]/10 border border-[#FF01BB]/30 text-[#FFD3F1]">
                עדיין לא הוגדרה סיסמת ניהול. יש להוסיף ב־Vercel משתנה סביבה בשם <b dir="ltr">ADMIN_PASSWORD</b> ולפרוס מחדש.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <label htmlFor="nx-user" className="text-[14px] font-semibold text-[#DDD8F5]">שם משתמש</label>
                  <div className="nx-field">
                    <span className="ps-4 text-[#9E98C2]"><Ico d={I.user} /></span>
                    <input ref={userRef} id="nx-user" name="username" type="text" dir="ltr" autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="admin או אימייל" className="text-left" aria-describedby="nx-user-help" />
                  </div>
                  <span id="nx-user-help" className="text-[12px] text-[#9E98C2]">מנהל ראשי: admin · חברי צוות: כתובת האימייל</span>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="nx-pass" className="text-[14px] font-semibold text-[#DDD8F5]">סיסמה</label>
                  <div className="nx-field">
                    <span className="ps-4 text-[#9E98C2]"><Ico d={I.lock} /></span>
                    <input ref={passRef} id="nx-pass" name="password" type={show ? "text" : "password"} dir="ltr" required autoComplete="current-password" placeholder="••••••••" className="text-left" onKeyUp={capsCheck} onKeyDown={capsCheck} aria-invalid={!!state?.error} aria-describedby={state?.error ? "nx-err" : caps ? "nx-caps" : undefined} />
                    <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "הסתרת הסיסמה" : "הצגת הסיסמה"} aria-pressed={show} className="nx-link w-12 h-12 me-1 rounded-xl flex items-center justify-center text-[#B4AED6] hover:text-white hover:bg-white/10">
                      <Ico d={show ? I.eyeOff : I.eye} />
                    </button>
                  </div>
                  {caps && (
                    <span id="nx-caps" className="text-[13px] text-[#FFD27A] flex items-center gap-1.5">
                      <Ico d={I.alert} size={15} /> Caps Lock פעיל
                    </span>
                  )}
                </div>

                {state?.error && (
                  <p id="nx-err" role="alert" className="flex items-start gap-2 text-[14px] font-semibold rounded-xl px-3.5 py-3 bg-[#FF3B6B]/[.12] border border-[#FF3B6B]/[.35] text-[#FFC2D1]">
                    <span className="shrink-0 pt-0.5"><Ico d={I.alert} size={17} /></span>
                    {state.error}
                  </p>
                )}

                <Submit />
              </>
            )}

            <div className="flex items-center justify-center gap-2 pt-1 text-[12px] text-[#8F89B3]">
              <Ico d={I.shield} size={15} /> חיבור מוצפן ומאובטח · ניסיונות כניסה נרשמים
            </div>
          </form>

          <p className="text-center text-[12px] text-[#6F6994] pt-6" dir="ltr">
            © {new Date().getFullYear()} NEXSHOP
          </p>
        </section>
      </div>
    </div>
  );
}
