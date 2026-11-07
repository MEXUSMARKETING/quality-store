"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Icon, Notice } from "../_components/ui";
import type { Category } from "@/lib/catalog";
import { deleteCategoryAction, saveCategoryAction, type CatState } from "./actions";

type Lite = { key: string; name: string; parent: string | null; count: number };

function Submit({ children, className, disabled = false }: { children: React.ReactNode; className: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={disabled || pending}>
      {pending ? <span className="w-4 h-4 rounded-full border-2 border-current/40 border-t-current animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

function Counter({ n, max, ideal }: { n: number; max: number; ideal: [number, number] }) {
  const tone = n === 0 ? "text-adm-muted" : n > max ? "text-[#B03A3A]" : n >= ideal[0] && n <= ideal[1] ? "text-[#0F7A57]" : "text-[#8A5A00]";
  return <span className={`text-[12px] font-semibold tabular-nums ${tone}`} aria-live="polite">{n}/{max}</span>;
}

function ImageField({ label, name, value, onChange, storageReady, wide }: { label: string; name: string; value: string; onChange: (v: string) => void; storageReady: boolean; wide?: boolean }) {
  const [preview, setPreview] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const src = preview || value;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-[13px] font-semibold pb-1.5">{label}</legend>
      <div className={`rounded-xl border border-adm-line bg-adm-bg overflow-hidden flex items-center justify-center ${wide ? "aspect-[3/1]" : "w-28 aspect-square"}`}>
        {src ? <img src={src} alt="" className="w-full h-full object-cover" /> : <Icon name="image" size={22} className="text-adm-muted" />}
      </div>
      <label className="a-field">
        <span className="sr-only">{label} – קישור</span>
        <input name={name} dir="ltr" value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://… (קישור לתמונה)" className="a-input" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <label className={`a-btn a-btn-sm ${storageReady ? "" : "opacity-55 cursor-not-allowed"}`}>
          <Icon name="download" size={15} className="rotate-180" /> העלאת קובץ
          <input
            type="file"
            name={`${name}_file`}
            accept="image/*"
            disabled={!storageReady}
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              setPreview(f ? URL.createObjectURL(f) : "");
            }}
          />
        </label>
        {preview && <span className="text-[12px] text-adm-muted">הקובץ יועלה בשמירה</span>}
        {value && !preview && <button type="button" className="text-[12px] text-adm-link underline" onClick={() => onChange("")}>הסרה</button>}
        {!storageReady && <span className="text-[12px] text-adm-muted">אחסון תמונות לא מחובר – אפשר להדביק קישור</span>}
      </div>
    </fieldset>
  );
}

export default function CategoryPanel({ cat, all, canEdit, storageReady, closeHref, view }: { cat: Category | null; all: Lite[]; canEdit: boolean; storageReady: boolean; closeHref: string; view: string }) {
  const [state, action] = useFormState<CatState, FormData>(saveCategoryAction, null);
  const [delState, delAction] = useFormState<CatState, FormData>(deleteCategoryAction, null);
  const [name, setName] = useState(cat?.name || "");
  const [key, setKey] = useState(cat?.key || "");
  const [keyTouched, setKeyTouched] = useState(!!cat);
  const [image, setImage] = useState(cat?.image || "");
  const [banner, setBanner] = useState(cat?.banner || "");
  const [seoTitle, setSeoTitle] = useState(cat?.seo_title || "");
  const [seoDesc, setSeoDesc] = useState(cat?.seo_description || "");
  const [confirmDel, setConfirmDel] = useState(false);
  const errRef = useRef<HTMLDivElement>(null);
  const isDefault = cat?.key === "boots";

  useEffect(() => { if (state?.error || delState?.error) errRef.current?.focus(); }, [state, delState]);

  const autoKey = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const effKey = keyTouched ? key : autoKey;
  const me = cat ? all.find((c) => c.key === cat.key) : undefined;
  const count = me?.count || 0;

  // parents a category may not choose: itself and its descendants
  const banned = new Set<string>();
  if (cat) {
    banned.add(cat.key);
    for (let grew = true; grew; ) {
      grew = false;
      for (const c of all) if (c.parent && banned.has(c.parent) && !banned.has(c.key)) { banned.add(c.key); grew = true; }
    }
  }
  const depthOf = (c: Lite) => { let d = 0, p = c.parent; while (p && d < 6) { d++; p = all.find((x) => x.key === p)?.parent || null; } return d; };
  const others = all.filter((c) => c.key !== cat?.key);

  return (
    <aside className="a-card !p-0 xl:sticky xl:top-4 flex flex-col max-h-none xl:max-h-[calc(100vh-32px)] overflow-hidden" aria-label={cat ? `עריכת קטגוריה ${cat.name}` : "קטגוריה חדשה"}>
      <div className="px-5 py-4 border-b border-adm-line flex items-center justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <h2 className="text-[17px] font-bold text-adm-navy truncate">{cat ? cat.name : "קטגוריה חדשה"}</h2>
          {cat && <span className="text-[12px] text-adm-muted">{count} מוצרים · <a href={`/shop?category=${cat.key}`} target="_blank" rel="noopener" className="underline">צפייה באתר</a></span>}
        </div>
        <Link href={closeHref} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-adm-bg text-adm-mid" aria-label="סגירת הפאנל"><Icon name="close" /></Link>
      </div>

      <form action={action} className="flex flex-col gap-4 p-5 overflow-y-auto">
        <input type="hidden" name="orig" value={cat?.key || ""} />
        <input type="hidden" name="view" value={view} />
        {(state?.error) && <div ref={errRef} tabIndex={-1} role="alert"><Notice tone="red">{state.error}</Notice></div>}

        <label className="a-field">
          שם הקטגוריה
          <input name="name" required maxLength={80} value={name} onChange={(e) => setName(e.target.value)} className="a-input" placeholder="למשל: מגפוני קרסול" />
        </label>

        <label className="a-field">
          מפתח / כתובת (slug)
          <input
            name="key"
            dir="ltr"
            maxLength={40}
            value={effKey}
            disabled={isDefault}
            onChange={(e) => { setKeyTouched(true); setKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); }}
            className="a-input"
            placeholder="ankle-boots"
            aria-describedby="key-hint"
          />
          {isDefault && <input type="hidden" name="key" value="boots" />}
          <span id="key-hint" className="text-[12px] font-normal text-adm-muted leading-5">
            אותיות לטיניות קטנות, ספרות ומקפים. הכתובת באתר: <span dir="ltr">/shop?category={effKey || "…"}</span>
            {isDefault ? " · זו קטגוריית ברירת המחדל של החנות, ולכן המפתח קבוע." : cat && effKey !== cat.key ? ` · שינוי המפתח יעדכן גם ${count} מוצרים, וקישורים ישנים יפסיקו לעבוד.` : ""}
          </span>
        </label>

        <label className="a-field">
          קטגוריית אב
          <select name="parent" defaultValue={cat?.parent || ""} className="a-input">
            <option value="">— רמה ראשית —</option>
            {all.filter((c) => !banned.has(c.key)).map((c) => (
              <option key={c.key} value={c.key}>{"  ".repeat(depthOf(c))}{c.name}</option>
            ))}
          </select>
        </label>

        <label className="a-field">
          תיאור
          <textarea name="description" rows={3} maxLength={2000} defaultValue={cat?.description || ""} className="a-input !h-auto py-2.5" placeholder="טקסט קצר שמופיע בראש עמוד הקטגוריה" />
        </label>

        <div className="flex flex-col gap-2.5">
          <label className="flex items-center gap-2.5 min-h-[36px] text-[14px]">
            <input type="checkbox" name="active" defaultChecked={cat ? cat.active : true} disabled={isDefault && cat?.active} className="w-5 h-5 accent-[#3478F6]" />
            {isDefault && cat?.active && <input type="hidden" name="active" value="on" />}
            <span><b>פעילה באתר</b> <span className="text-adm-muted">– מוסתרת לא מופיעה בחנות (גם תתי־הקטגוריות שלה)</span></span>
          </label>
          <label className="flex items-center gap-2.5 min-h-[36px] text-[14px]">
            <input type="checkbox" name="featured" defaultChecked={cat?.featured || false} className="w-5 h-5 accent-[#3478F6]" />
            <span><b>קטגוריה מומלצת</b> <span className="text-adm-muted">– לשימוש בדף הבית ובתפריטים</span></span>
          </label>
        </div>

        <ImageField label="תמונת קטגוריה (ריבועית)" name="image" value={image} onChange={setImage} storageReady={storageReady} />
        <ImageField label="באנר לראש העמוד (רחב)" name="banner" value={banner} onChange={setBanner} storageReady={storageReady} wide />

        <fieldset className="flex flex-col gap-3 pt-1">
          <legend className="text-[15px] font-bold text-adm-navy pb-2">SEO</legend>
          <label className="a-field">
            <span className="flex justify-between">כותרת לגוגל <Counter n={seoTitle.length} max={60} ideal={[30, 60]} /></span>
            <input name="seo_title" maxLength={120} value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} className="a-input" placeholder={name ? `${name} | Quality טמרה` : ""} />
          </label>
          <label className="a-field">
            <span className="flex justify-between">תיאור לגוגל <Counter n={seoDesc.length} max={160} ideal={[70, 160]} /></span>
            <textarea name="seo_description" rows={3} maxLength={320} value={seoDesc} onChange={(e) => setSeoDesc(e.target.value)} className="a-input !h-auto py-2.5" />
          </label>
          <div className="rounded-xl border border-adm-line p-3 flex flex-col gap-0.5" aria-label="תצוגה מקדימה בגוגל">
            <span className="text-[12px] text-[#4D5156]" dir="ltr">… › shop › {effKey || "…"}</span>
            <span className="text-[16px] text-[#1A0DAB] leading-6 line-clamp-1">{seoTitle || name || "כותרת הקטגוריה"}</span>
            <span className="text-[13px] text-[#4D5156] leading-5 line-clamp-2">{seoDesc || "תיאור הקטגוריה יופיע כאן."}</span>
          </div>
        </fieldset>

        <div className="flex gap-2 pt-1 sticky bottom-0 bg-white pb-1">
          <Submit className="a-btn a-btn-primary flex-1" disabled={!canEdit}><Icon name="check" /> {cat ? "שמירת שינויים" : "יצירת קטגוריה"}</Submit>
          <Link href={closeHref} className="a-btn">ביטול</Link>
        </div>
        {!canEdit && <p className="text-[12px] text-adm-muted">אין הרשאת עריכה או שמסד הנתונים לא מחובר – צפייה בלבד.</p>}
      </form>

      {cat && canEdit && !isDefault && (
        <div className="border-t border-adm-line p-5 flex flex-col gap-3">
          {delState?.error && <div role="alert"><Notice tone="red">{delState.error}</Notice></div>}
          {!confirmDel ? (
            <button type="button" className="a-btn a-btn-danger self-start" onClick={() => setConfirmDel(true)}><Icon name="trash" /> מחיקת הקטגוריה</button>
          ) : (
            <form action={delAction} className="flex flex-col gap-3 p-3.5 rounded-xl border border-[#F3D3D3] bg-[#FFF8F8]">
              <input type="hidden" name="key" value={cat.key} />
              <b className="text-[14px] text-[#8A2626]">למחוק את &quot;{cat.name}&quot;?</b>
              {count > 0 ? (
                <label className="a-field">
                  יש {count} מוצרים בקטגוריה. להעביר אותם אל:
                  <select name="move_to" required defaultValue="" className="a-input">
                    <option value="" disabled>בחרי קטגוריה…</option>
                    {others.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
                  </select>
                </label>
              ) : (
                <span className="text-[13px] text-adm-mid">אין מוצרים בקטגוריה.</span>
              )}
              {all.some((c) => c.parent === cat.key) && <span className="text-[13px] text-adm-mid">תתי־הקטגוריות יעלו רמה אחת למעלה.</span>}
              <div className="flex gap-2">
                <Submit className="a-btn a-btn-danger">{count > 0 ? "העברת המוצרים ומחיקה" : "מחיקה לצמיתות"}</Submit>
                <button type="button" className="a-btn" onClick={() => setConfirmDel(false)}>ביטול</button>
              </div>
            </form>
          )}
        </div>
      )}
    </aside>
  );
}
