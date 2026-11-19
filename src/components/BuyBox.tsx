"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "./CartProvider";
import { ColorPicker, useVariant } from "./ProductVariants";
import { HeartIcon, WhatsAppIcon } from "./Icons";
import { SIZES, waLink } from "@/lib/config";

type Props = {
  product: { id: number; slug: string; name: string; image: string; price: number; stock: Record<string, number> };
  /** Store sizes in display order (admin → מידות וצבעים); defaults to the config list. */
  sizes?: string[];
};

export default function BuyBox({ product, sizes }: Props) {
  const { add } = useCart();
  const v = useVariant();
  const variant = v && v.colors.length ? v.color : null;
  // variant products: sizes and stock of the selected colour
  const stock: Record<string, number> = v && v.colors.length ? variant?.stock || {} : product.stock || {};
  const image = v?.images[0] || product.image;
  const [size, setSize] = useState<string | null>(null);
  const [need, setNeed] = useState(false);
  const [added, setAdded] = useState(false);
  const [fav, setFav] = useState(false);
  /** the real add-to-cart row, and the size grid we send the shopper back to */
  const ctaRef = useRef<HTMLDivElement>(null);
  const sizesRef = useRef<HTMLDivElement>(null);
  const [ctaGone, setCtaGone] = useState(false);

  const base = sizes && sizes.length ? sizes : SIZES;
  // configured order first; sizes with stock that are not in the list are appended in numeric order
  const extra = Object.keys(stock).filter((s) => !base.includes(s) && Number(stock[s]) > 0).sort((a, b) => Number(a) - Number(b));
  const allSizes = [...base, ...extra];
  const avail = allSizes.filter((s) => Number(stock[s] || 0) > 0);
  const soldOut = avail.length === 0;
  const left = size ? Number(stock[size] || 0) : 0;

  // switching colour: keep the size only if that colour has it
  useEffect(() => {
    setAdded(false);
    setSize((s) => (s && Number(stock[s] || 0) > 0 ? s : null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant?.key]);

  // the sticky mobile bar appears only once the real button has scrolled out of view
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setCtaGone(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const barOn = ctaGone && !soldOut;

  // the body class lifts the floating WhatsApp button clear of the bar and keeps the
  // last of the page reachable; it is removed again when the bar goes away
  useEffect(() => {
    if (!barOn) return;
    document.body.classList.add("has-buybar");
    return () => document.body.classList.remove("has-buybar");
  }, [barOn]);

  const onAdd = () => {
    if (!size) {
      setNeed(true);
      return;
    }
    add({ productId: product.id, slug: product.slug, name: product.name, image, size, ...(variant ? { color: variant.key, colorName: variant.label } : {}), qty: 1, price: product.price });
    setAdded(true);
  };

  const onBarAdd = () => {
    if (!size) {
      setNeed(true);
      sizesRef.current?.scrollIntoView({ block: "center" });
      return;
    }
    onAdd();
  };

  return (
    <div className="flex flex-col gap-4">
      <ColorPicker />
      <div className="flex flex-col gap-2.5">
        <div className="flex justify-between items-baseline">
          <span className="text-[15px]"><b>מידה:</b> {size || "לא נבחרה"}</span>
          <Link href="/info/sizes" className="text-sm underline">מדריך מידות</Link>
        </div>
        <div ref={sizesRef} className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-4 xl:grid-cols-8 gap-2">
          {allSizes.map((s) => {
            const out = Number(stock[s] || 0) <= 0;
            const on = size === s;
            return (
              <button
                key={s}
                type="button"
                disabled={out}
                aria-pressed={on}
                onClick={() => { setSize(s); setNeed(false); setAdded(false); }}
                className={`h-[52px] rounded-xl border text-base transition-colors ${on ? "bg-ink text-white border-ink" : out ? "bg-[#EEECE6] text-[#8C8A84] border-line line-through" : "bg-white border-line hover:border-ink"}`}
              >
                {s}
              </button>
            );
          })}
        </div>
        {!soldOut && <span className="text-sm text-muted">{variant ? `ב${variant.label}: ` : ""}זמין במידות {avail.join(", ")}{avail.length <= 3 ? " — מלאי מוגבל" : ""}</span>}
        {soldOut && variant && <span className="text-sm text-[#A13A0D] font-bold">הצבע {variant.label} אזל כרגע. אפשר לבחור צבע אחר או לכתוב לנו בוואטסאפ.</span>}
        {size && left > 0 && left <= 2 && <span className="text-sm text-[#A13A0D] font-bold">נשארו {left === 1 ? "זוג אחרון" : `${left} זוגות אחרונים`} במידה הזו</span>}
        {need && <span role="alert" className="text-sm text-[#A13A0D] font-bold">יש לבחור מידה לפני ההוספה לסל</span>}
      </div>

      <div ref={ctaRef} className="flex gap-2.5">
        <button type="button" onClick={onAdd} disabled={soldOut} className="flex-1 h-[58px] rounded-[14px] bg-ink text-white text-[17px] font-bold disabled:opacity-50">
          {soldOut ? (variant ? `${variant.label} אזל` : "אזל מהמלאי") : `הוספה לסל · ₪${product.price}`}
        </button>
        <button type="button" aria-label="הוספה למועדפים" aria-pressed={fav} onClick={() => setFav(!fav)} className="w-[58px] h-[58px] rounded-[14px] border border-line bg-white flex items-center justify-center">
          <HeartIcon size={22} stroke={fav ? "#C0392B" : "#141414"} />
        </button>
      </div>

      {added && (
        <div role="status" className="px-4 py-3 rounded-[14px] bg-[#E2EADF] flex items-center justify-between text-[15px]">
          <b>נוסף לסל — {variant ? `${variant.label}, ` : ""}מידה {size}</b>
          <Link href="/cart" className="font-bold underline">לסל ולתשלום</Link>
        </div>
      )}

      <a
        href={waLink(`שלום, אשמח להזמין: ${product.name}${variant ? ` בצבע ${variant.label}` : ""}${size ? ` במידה ${size}` : ""} (₪${product.price})`)}
        target="_blank"
        rel="noopener"
        className="h-[52px] rounded-[14px] border-[1.5px] border-[#1F8A4C] text-[#1F6B3B] text-base font-bold flex items-center justify-center gap-2 hover:text-[#1F6B3B]"
      >
        <WhatsAppIcon size={20} /> הזמנה מהירה בוואטסאפ
      </a>

      {barOn && (
        <div className="buybar md:hidden" role="group" aria-label="הוספה לסל">
          <div className="flex items-center gap-3">
            <div className="flex flex-col shrink-0">
              <span className="font-display font-bold text-[19px] leading-tight">₪{product.price}</span>
              <span className="text-[12px] text-muted leading-tight">{size ? `מידה ${size}` : "בחרי מידה"}</span>
            </div>
            {added ? (
              <Link href="/cart" className="flex-1 h-[52px] rounded-[14px] bg-ink text-white text-[16px] font-bold flex items-center justify-center hover:text-white">
                נוסף לסל · לסל ולתשלום
              </Link>
            ) : (
              <button type="button" onClick={onBarAdd} className="flex-1 h-[52px] rounded-[14px] bg-ink text-white text-[16px] font-bold">
                הוספה לסל
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
