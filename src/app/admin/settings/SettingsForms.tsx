"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { StoreInfo } from "@/lib/site";
import { Icon } from "../_components/ui";
import { saveSeoAction, saveStoreAction, saveTrackingAction, type SettingsState } from "./actions";
import { TRACKING_FORMATS, type SeoSettings, type TrackingSettings } from "./defaults";

function SaveBtn({ dirty }: { dirty: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || !dirty} className="a-btn a-btn-primary">
      <Icon name="check" /> {pending ? "שומר…" : "שמירת שינויים"}
    </button>
  );
}

/** Form wrapper: tracks dirty state, shows a sticky save bar, warns before leaving with unsaved changes. */
function SettingsForm({ action, canEdit, children, encType }: { action: (s: SettingsState, fd: FormData) => Promise<SettingsState>; canEdit: boolean; children: React.ReactNode; encType?: string }) {
  const [state, formAction] = useFormState<SettingsState, FormData>(action, null);
  const [dirty, setDirty] = useState(false);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) setDirty(false);
    if (state?.field) ref.current?.querySelector<HTMLElement>(`[name="${state.field}"]`)?.focus();
  }, [state]);

  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);

  return (
    <form ref={ref} action={formAction} encType={encType} onInput={() => setDirty(true)} onChange={() => setDirty(true)} className="flex flex-col gap-4" noValidate>
      <fieldset disabled={!canEdit} className="flex flex-col gap-4 min-w-0">{children}</fieldset>
      {state?.error && <div role="alert" className="p-3 rounded-xl border bg-[#FDECEC] text-[#8A2626] border-[#F3D3D3] text-[14px]">{state.error}</div>}
      {canEdit ? (
        <div className="sticky bottom-0 z-10 -mx-1 px-4 py-3 rounded-xl bg-white border border-adm-line shadow-[0_-6px_18px_rgba(23,36,58,.06)] flex flex-wrap items-center justify-between gap-3">
          <span className="text-[13px]" role="status" aria-live="polite">
            {dirty ? <b className="text-[#8A5A00]">יש שינויים שלא נשמרו</b> : state?.ok ? <b className="text-[#0B5E43]">השינויים נשמרו ✓</b> : <span className="text-adm-muted">אין שינויים</span>}
          </span>
          <span className="flex gap-2">
            {dirty && <button type="button" className="a-btn" onClick={() => { ref.current?.reset(); setDirty(false); }}>ביטול שינויים</button>}
            <SaveBtn dirty={dirty} />
          </span>
        </div>
      ) : (
        <p className="text-[13px] text-adm-muted">יש לך הרשאת צפייה בלבד בהגדרות.</p>
      )}
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="a-field">
      {label}
      {children}
      {hint && <span className="text-[12px] font-normal text-adm-muted">{hint}</span>}
    </label>
  );
}

/* ---------------- store ---------------- */

export function StoreForm({ v, canEdit }: { v: StoreInfo; canEdit: boolean }) {
  return (
    <SettingsForm action={saveStoreAction} canEdit={canEdit}>
      <div className="a-card flex flex-col gap-4">
        <h2 className="text-[16px] font-bold text-adm-navy">פרטי העסק</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="שם החנות"><input name="name" defaultValue={v.name} required maxLength={80} className="a-input" /></Field>
          <Field label="עיר"><input name="city" defaultValue={v.city} maxLength={60} className="a-input" /></Field>
        </div>
        <Field label="כתובת" hint="מוצגת בפוטר ובעמוד יצירת קשר"><input name="address" defaultValue={v.address} maxLength={160} className="a-input" /></Field>
        <Field label="שעות פתיחה" hint="למשל: א׳–ה׳ 10:00–20:00, ו׳ 10:00–14:00"><textarea name="hours" defaultValue={v.hours} rows={2} maxLength={300} className="a-input" /></Field>
      </div>
      <div className="a-card flex flex-col gap-4">
        <h2 className="text-[16px] font-bold text-adm-navy">יצירת קשר</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="טלפון לתצוגה"><input name="phoneDisplay" defaultValue={v.phoneDisplay} dir="ltr" maxLength={30} className="a-input text-left" placeholder="054-2910333" /></Field>
          <Field label="וואטסאפ (פורמט בינלאומי)" hint="972 ואחריו המספר בלי ה־0 הראשון. כל כפתורי הוואטסאפ באתר משתמשים בו.">
            <input name="whatsapp" defaultValue={v.whatsapp} dir="ltr" inputMode="numeric" required maxLength={15} className="a-input text-left font-mono" placeholder="972542910333" />
          </Field>
        </div>
        <Field label="אימייל"><input name="email" type="email" defaultValue={v.email} dir="ltr" maxLength={160} className="a-input text-left" /></Field>
      </div>
      <div className="a-card flex flex-col gap-4">
        <h2 className="text-[16px] font-bold text-adm-navy">רשתות חברתיות</h2>
        <Field label="אינסטגרם"><input name="instagram" defaultValue={v.instagram} dir="ltr" maxLength={300} className="a-input text-left" placeholder="https://instagram.com/…" /></Field>
        <Field label="פייסבוק"><input name="facebook" defaultValue={v.facebook} dir="ltr" maxLength={300} className="a-input text-left" placeholder="https://facebook.com/…" /></Field>
        <Field label="טיקטוק"><input name="tiktok" defaultValue={v.tiktok} dir="ltr" maxLength={300} className="a-input text-left" placeholder="https://tiktok.com/@…" /></Field>
      </div>
    </SettingsForm>
  );
}

/* ---------------- SEO ---------------- */

export function SeoForm({ v, canEdit, storageReady, host }: { v: SeoSettings; canEdit: boolean; storageReady: boolean; host: string }) {
  const [title, setTitle] = useState(v.defaultTitle);
  const [tpl, setTpl] = useState(v.titleTemplate);
  const [desc, setDesc] = useState(v.description);
  const [robots, setRobots] = useState(v.robotsAllow);
  const sample = (tpl.includes("%s") ? tpl : "%s").replace("%s", "מגפון שחור עם עקב");
  return (
    <SettingsForm action={saveSeoAction} canEdit={canEdit}>
      <div className="a-card flex flex-col gap-4">
        <h2 className="text-[16px] font-bold text-adm-navy">כותרות ותיאור</h2>
        <Field label="כותרת ברירת מחדל (דף הבית)" hint={`${title.length}/60 תווים מומלץ`}>
          <input name="defaultTitle" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} className="a-input" />
        </Field>
        <Field label="תבנית כותרת לעמודים" hint="%s יוחלף בשם העמוד או המוצר">
          <input name="titleTemplate" value={tpl} onChange={(e) => setTpl(e.target.value)} maxLength={80} dir="auto" className="a-input" />
        </Field>
        <Field label="תיאור ברירת מחדל" hint={`${desc.length}/155 תווים מומלץ`}>
          <textarea name="description" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} maxLength={320} className="a-input" />
        </Field>
        <section aria-label="תצוגה מקדימה בגוגל" className="rounded-xl border border-adm-line p-3.5 flex flex-col gap-1">
          <span className="text-[12px] text-adm-muted">כך זה ייראה בגוגל (עמוד מוצר לדוגמה)</span>
          <span dir="ltr" className="text-[12px] text-[#3B475C] text-right">{host}</span>
          <span className="text-[17px] text-[#1A0DAB] leading-6">{sample}</span>
          <span className="text-[13px] text-[#3B475C] leading-5">{desc.slice(0, 160) || "—"}</span>
        </section>
      </div>
      <div className="a-card flex flex-col gap-4">
        <h2 className="text-[16px] font-bold text-adm-navy">תמונת שיתוף</h2>
        <p className="text-[13px] text-adm-muted -mt-2">מופיעה כשמשתפים קישור לאתר בוואטסאפ, פייסבוק וכו׳. מומלץ 1200×630.</p>
        {v.shareImage && (
          <div className="flex gap-3 items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={v.shareImage} alt="תמונת השיתוף הנוכחית" className="w-[180px] aspect-[1200/630] object-cover rounded-lg border border-adm-line" />
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" name="removeImage" className="w-4 h-4 accent-[#B03A3A]" /> הסרת התמונה</label>
          </div>
        )}
        <Field label="קישור לתמונה"><input name="shareImage" defaultValue={v.shareImage} dir="ltr" maxLength={500} className="a-input text-left" placeholder="https://…" /></Field>
        {storageReady ? (
          <Field label="או העלאת קובץ" hint="JPG / PNG / WEBP עד 8MB"><input name="shareFile" type="file" accept="image/*" className="text-[14px]" /></Field>
        ) : (
          <p className="text-[12px] text-adm-muted">העלאת קבצים תהיה זמינה אחרי חיבור אחסון תמונות (ראו &quot;אינטגרציות&quot;).</p>
        )}
      </div>
      <div className="a-card flex flex-col gap-3">
        <h2 className="text-[16px] font-bold text-adm-navy">מנועי חיפוש</h2>
        <label className="flex items-start gap-3 min-h-[36px] cursor-pointer">
          <input type="checkbox" name="robotsAllow" checked={robots} onChange={(e) => setRobots(e.target.checked)} className="w-[18px] h-[18px] mt-0.5 accent-[#3478F6]" />
          <span className="flex flex-col">
            <b className="text-[14px]">לאפשר לגוגל ולמנועי חיפוש לאנדקס את האתר</b>
            <span className="text-[12px] text-adm-muted">כיבוי יוסיף לכל העמודים הוראת noindex. מתאים רק לזמן בנייה או תחזוקה.</span>
          </span>
        </label>
        {!robots && <p className="text-[13px] font-bold text-[#8A2626]">שימו לב: כשהאפשרות כבויה, האתר ייעלם בהדרגה מתוצאות החיפוש.</p>}
      </div>
    </SettingsForm>
  );
}

/* ---------------- tracking ---------------- */

export function TrackingForm({ v, canEdit }: { v: TrackingSettings; canEdit: boolean }) {
  const help: Record<keyof TrackingSettings, string> = {
    ga4: "Google Analytics → Admin → Data streams → Measurement ID",
    gtm: "Tag Manager → מזהה המאגר בראש המסך. אם GA4 מוגדר בתוך GTM – אל תמלאו גם את GA4 כדי לא לספור כפול.",
    metaPixel: "Meta Events Manager → Data sources → מזהה הפיקסל (ספרות בלבד)",
    tiktokPixel: "TikTok Ads Manager → Assets → Events → Web events → Pixel ID",
  };
  return (
    <SettingsForm action={saveTrackingAction} canEdit={canEdit}>
      <div className="a-card flex flex-col gap-4">
        <h2 className="text-[16px] font-bold text-adm-navy">קודי מעקב ופיקסלים</h2>
        <p className="text-[13px] text-adm-muted -mt-2">הסקריפטים נטענים בכל עמודי האתר (לא במערכת הניהול) רק כשמוזן מזהה. השאירו ריק כדי לכבות.</p>
        {(Object.keys(TRACKING_FORMATS) as (keyof TrackingSettings)[]).map((k) => (
          <Field key={k} label={TRACKING_FORMATS[k].label} hint={help[k]}>
            <span className="flex gap-2 items-center">
              <input name={k} defaultValue={v[k]} dir="ltr" maxLength={40} autoComplete="off" spellCheck={false} className="a-input text-left font-mono" placeholder={TRACKING_FORMATS[k].example} />
              {v[k] ? <span className="a-chip bg-[#E6F6F0] text-[#0F7A57] shrink-0">פעיל</span> : <span className="a-chip bg-[#EEF1F6] text-[#3B475C] shrink-0">כבוי</span>}
            </span>
          </Field>
        ))}
      </div>
    </SettingsForm>
  );
}
