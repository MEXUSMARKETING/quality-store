"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

/* Colour selection shared by the product page's gallery and buy box. Picking a colour swaps the
   gallery images and the sizes in stock, and keeps ?color= in the address so the link can be
   shared. Simple products (one colour) render the same components without the colour picker. */

export type ColorOption = { key: string; label: string; hex: string; images: string[]; stock: Record<string, number> };

type Ctx = { colors: ColorOption[]; color: ColorOption | null; setColor: (key: string) => void; images: string[] };
const VariantCtx = createContext<Ctx | null>(null);

export function useVariant() {
  return useContext(VariantCtx);
}

export function VariantScope({ colors, initial, fallbackImages, children }: { colors: ColorOption[]; initial: string | null; fallbackImages: string[]; children: React.ReactNode }) {
  const [key, setKey] = useState<string | null>(initial);
  const color = colors.find((c) => c.key === key) || null;
  const images = color && color.images.length ? color.images : fallbackImages;

  const setColor = (k: string) => {
    setKey(k);
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("color", k);
      window.history.replaceState(null, "", u.toString());
    } catch {}
  };

  // warm the browser cache with every colour's main image so switching is instant
  useEffect(() => {
    colors.forEach((c) => {
      if (c.images[0]) {
        const img = new Image();
        img.src = c.images[0];
      }
    });
  }, [colors]);

  const value = useMemo(() => ({ colors, color, setColor, images }), [colors, color, images]); // eslint-disable-line react-hooks/exhaustive-deps
  return <VariantCtx.Provider value={value}>{children}</VariantCtx.Provider>;
}

/** Main image + thumbnails for the selected colour. `overlay` = badges rendered on the server. */
export function VariantGallery({ name, overlay }: { name: string; overlay?: React.ReactNode }) {
  const v = useVariant();
  const images = v?.images || [];
  const [active, setActive] = useState(0);
  useEffect(() => setActive(0), [v?.color?.key]);
  const main = images[active] || images[0];
  const label = v?.color ? `${name} – ${v.color.label}` : name;

  return (
    <div className="w-full lg:flex-1 flex flex-col gap-3">
      <div className="relative overflow-hidden bg-ink aspect-square">
        {main && <img key={main} src={main} alt={label} className="w-full h-full object-contain animate-[fadeIn_.25s_ease]" />}
        {overlay}
      </div>
      {images.length > 1 && (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5" role="list" aria-label="תמונות נוספות">
          {images.slice(0, 10).map((src, i) => (
            <button
              key={src}
              type="button"
              role="listitem"
              onClick={() => setActive(i)}
              aria-label={`תמונה ${i + 1}`}
              aria-current={i === active ? "true" : undefined}
              className={`aspect-square overflow-hidden bg-ink border-2 transition-colors ${i === active ? "border-gold" : "border-transparent hover:border-line"}`}
            >
              <img src={src} alt="" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Colour swatches (variant products only). */
export function ColorPicker() {
  const v = useVariant();
  if (!v || v.colors.length === 0) return null;
  const total = (c: ColorOption) => Object.values(c.stock).reduce((a, b) => a + (Number(b) || 0), 0);
  return (
    <div className="flex flex-col gap-2.5">
      <span className="text-[15px]">
        <b>צבע:</b> {v.color ? v.color.label : "לא נבחר"}
      </span>
      <div role="radiogroup" aria-label="בחירת צבע" className="flex flex-wrap gap-2.5">
        {v.colors.map((c) => {
          const on = v.color?.key === c.key;
          const out = total(c) === 0;
          return (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${c.label}${out ? " – אזל" : ""}`}
              title={c.label}
              onClick={() => v.setColor(c.key)}
              className={`group relative flex items-center gap-2 h-[46px] ps-1.5 pe-3.5 rounded-full border-2 bg-white transition-colors ${on ? "border-ink" : "border-line hover:border-[#B9B6AD]"} ${out ? "opacity-60" : ""}`}
            >
              {c.images[0] ? (
                <img src={c.images[0]} alt="" className="w-[34px] h-[34px] rounded-full object-cover bg-ink" />
              ) : (
                <span className="w-[34px] h-[34px] rounded-full border border-line" style={{ background: c.hex }} aria-hidden="true" />
              )}
              <span className={`text-[14px] ${on ? "font-bold" : ""} ${out ? "line-through" : ""}`}>{c.label}</span>
              {!c.images[0] ? null : <span className="absolute bottom-1 start-7 w-3 h-3 rounded-full border border-white" style={{ background: c.hex }} aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
