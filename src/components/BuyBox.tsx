"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "./CartProvider";
import { HeartIcon, WhatsAppIcon } from "./Icons";
import { SIZES, waLink } from "@/lib/config";

type Props = {
  product: { id: number; slug: string; name: string; image: string; price: number; stock: Record<string, number> };
};

export default function BuyBox({ product }: Props) {
  const { add } = useCart();
  const [size, setSize] = useState<string | null>(null);
  const [need, setNeed] = useState(false);
  const [added, setAdded] = useState(false);
  const [fav, setFav] = useState(false);

  const allSizes = Array.from(new Set([...SIZES, ...Object.keys(product.stock || {})])).sort((a, b) => Number(a) - Number(b));
  const avail = allSizes.filter((s) => Number(product.stock?.[s] || 0) > 0);
  const soldOut = avail.length === 0;
  const left = size ? Number(product.stock?.[size] || 0) : 0;

  const onAdd = () => {
    if (!size) {
      setNeed(true);
      return;
    }
    add({ productId: product.id, slug: product.slug, name: product.name, image: product.image, size, qty: 1, price: product.price });
    setAdded(true);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2.5">
        <div className="flex justify-between items-baseline">
          <span className="text-[15px]"><b>מידה:</b> {size || "לא נבחרה"}</span>
          <Link href="/info/sizes" className="text-sm underline">מדריך מידות</Link>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-4 xl:grid-cols-8 gap-2">
          {allSizes.map((s) => {
            const out = Number(product.stock?.[s] || 0) <= 0;
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
        {!soldOut && <span className="text-sm text-muted">זמין במידות {avail.join(", ")}{avail.length <= 3 ? " — מלאי מוגבל" : ""}</span>}
        {size && left > 0 && left <= 2 && <span className="text-sm text-[#A13A0D] font-bold">נשארו {left === 1 ? "זוג אחרון" : `${left} זוגות אחרונים`} במידה הזו</span>}
        {need && <span role="alert" className="text-sm text-[#A13A0D] font-bold">יש לבחור מידה לפני ההוספה לסל</span>}
      </div>

      <div className="flex gap-2.5">
        <button type="button" onClick={onAdd} disabled={soldOut} className="flex-1 h-[58px] rounded-[14px] bg-ink text-white text-[17px] font-bold disabled:opacity-50">
          {soldOut ? "אזל מהמלאי" : `הוספה לסל · ₪${product.price}`}
        </button>
        <button type="button" aria-label="הוספה למועדפים" aria-pressed={fav} onClick={() => setFav(!fav)} className="w-[58px] h-[58px] rounded-[14px] border border-line bg-white flex items-center justify-center">
          <HeartIcon size={22} stroke={fav ? "#C0392B" : "#141414"} />
        </button>
      </div>

      {added && (
        <div role="status" className="px-4 py-3 rounded-[14px] bg-[#E2EADF] flex items-center justify-between text-[15px]">
          <b>נוסף לסל — מידה {size}</b>
          <Link href="/cart" className="font-bold underline">לסל ולתשלום</Link>
        </div>
      )}

      <a
        href={waLink(`שלום, אשמח להזמין: ${product.name}${size ? ` במידה ${size}` : ""} (₪${product.price})`)}
        target="_blank"
        rel="noopener"
        className="h-[52px] rounded-[14px] border-[1.5px] border-[#1F8A4C] text-[#1F6B3B] text-base font-bold flex items-center justify-center gap-2 hover:text-[#1F6B3B]"
      >
        <WhatsAppIcon size={20} /> הזמנה מהירה בוואטסאפ
      </a>
    </div>
  );
}
