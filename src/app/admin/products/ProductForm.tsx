"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { saveProductAction } from "../actions";
import { CATEGORIES, COLORS, SIZES } from "@/lib/config";
import type { Product } from "@/lib/types";

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="btn btn-dark h-12 px-8 disabled:opacity-60">
      {pending ? "שומרת…" : "שמירת מוצר"}
    </button>
  );
}

export default function ProductForm({ product, canEdit }: { product: Product | null; canEdit: boolean }) {
  const [state, action] = useFormState(saveProductAction, null);
  const [images, setImages] = useState<string[]>(product?.images || []);
  const [main, setMain] = useState<string>(product?.images?.[0] || "");

  const box = "bg-white rounded-2xl p-5 flex flex-col gap-4";

  return (
    <form action={action} className="grid lg:grid-cols-[1.4fr_1fr] gap-5 items-start">
      {product && <input type="hidden" name="id" value={product.id} />}
      <fieldset disabled={!canEdit} className="contents">
        <div className="flex flex-col gap-5">
          <section className={box}>
            <h2 className="font-bold text-lg">פרטי המוצר</h2>
            <label className="field">שם המוצר *<input name="name" required defaultValue={product?.name} className="input" /></label>
            <label className="field">תיאור<textarea name="description" rows={4} defaultValue={product?.description} className="input" /></label>
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="field">מחיר (₪) *<input name="price" type="number" min="0" required defaultValue={product?.price} className="input" /></label>
              <label className="field">מחיר לפני הנחה<input name="old_price" type="number" min="0" defaultValue={product?.old_price ?? ""} className="input" /></label>
              <label className="field">גובה עקב (ס״מ)<input name="heel" type="number" min="0" defaultValue={product?.heel ?? ""} className="input" /></label>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <label className="field">קטגוריה
                <select name="category" defaultValue={product?.category || "boots"} className="input">
                  {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              <label className="field">צבע
                <select name="color" defaultValue={product?.color || "black"} className="input">
                  {Object.entries(COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
            </div>
          </section>

          <section className={box}>
            <div>
              <h2 className="font-bold text-lg">מלאי לפי מידה</h2>
              <p className="text-sm text-muted">כמה זוגות יש מכל מידה. מידה עם 0 לא תוצג כזמינה. המלאי יורד אוטומטית בכל הזמנה.</p>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {SIZES.map((s) => (
                <label key={s} className="flex flex-col items-center gap-1 text-sm font-bold">
                  {s}
                  <input name={`stock_${s}`} type="number" min="0" defaultValue={product?.stock?.[s] ?? ""} placeholder="0" className="input text-center px-1 h-12" />
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-5">
          <section className={box}>
            <h2 className="font-bold text-lg">תמונות</h2>
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {images.map((src) => (
                  <div key={src} className={`relative rounded-xl overflow-hidden border-2 ${main === src ? "border-gold" : "border-transparent"}`}>
                    <input type="hidden" name="keepImage" value={src} />
                    <img src={src} alt="" className="w-full aspect-square object-cover bg-ink" />
                    <div className="absolute bottom-1 inset-x-1 flex gap-1">
                      <button type="button" onClick={() => setMain(src)} className="flex-1 h-7 rounded-md bg-white/90 text-[11px] font-bold">{main === src ? "ראשית ★" : "ראשית"}</button>
                      <button type="button" onClick={() => setImages(images.filter((x) => x !== src))} aria-label="הסרת תמונה" className="w-7 h-7 rounded-md bg-white/90 text-[13px]">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <input type="hidden" name="mainImage" value={main} />
            <label className="field">העלאת תמונות
              <input name="files" type="file" accept="image/*" multiple className="text-sm file:me-3 file:h-10 file:px-4 file:rounded-full file:border-0 file:bg-ink file:text-white" />
            </label>
            <label className="field">או קישור לתמונה<input name="imageUrl" type="url" dir="ltr" placeholder="https://…" className="input" /></label>
          </section>

          <section className={box}>
            <h2 className="font-bold text-lg">הצגה באתר</h2>
            <label className="flex items-center gap-2.5"><input type="checkbox" name="active" defaultChecked={product ? product.active : true} className="w-5 h-5 accent-ink" /> מוצג באתר</label>
            <label className="flex items-center gap-2.5"><input type="checkbox" name="featured" defaultChecked={product?.featured} className="w-5 h-5 accent-ink" /> מוצר מומלץ (מופיע ראשון בדף הבית)</label>
            <div className="grid grid-cols-2 gap-3">
              <label className="field">סדר הופעה<input name="sort" type="number" defaultValue={product?.sort ?? 100} className="input" /></label>
              <label className="field">כתובת (slug)<input name="slug" dir="ltr" defaultValue={product?.slug} placeholder="אוטומטי" className="input" /></label>
            </div>
          </section>

          {state?.error && <p role="alert" className="text-sm font-bold text-[#A13A0D] bg-[#FBEDE6] rounded-xl p-3">{state.error}</p>}
          {canEdit && <SaveBtn />}
        </div>
      </fieldset>
    </form>
  );
}
