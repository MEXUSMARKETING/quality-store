"use client";

import Link from "next/link";
import { useCart } from "@/components/CartProvider";
import { TrashIcon, TruckIcon } from "@/components/Icons";
import { shekel } from "@/lib/config";
import { usePromoPricing } from "@/components/usePromoPricing";
import { lineKey } from "@/lib/variants";
import { PromoHints, PromoRows } from "@/components/PromoSummary";

export default function CartPage() {
  const { items, subtotal, count, setQty, remove, ready } = useCart();
  const promo = usePromoPricing(items, ready);

  if (!ready) return <div className="container-site py-20 text-center text-muted">טוען…</div>;

  if (!items.length) {
    return (
      <div className="container-site py-20 flex flex-col items-center gap-4 text-center">
        <h1 className="font-display font-bold text-[28px]">הסל ריק כרגע</h1>
        <p className="text-muted">הקולקציה החדשה מחכה לך</p>
        <Link href="/shop" className="btn btn-dark">לקולקציה</Link>
      </div>
    );
  }

  return (
    <div className="container-site pt-6 pb-16 flex flex-col lg:flex-row gap-8 items-start">
      <div className="flex-1 w-full">
        <h1 className="font-display font-extrabold text-[28px] md:text-[40px] pb-4">סל הקניות ({count})</h1>
        <div className="p-4 rounded-2xl bg-ink text-white flex items-center gap-3 mb-2">
          <TruckIcon size={26} stroke="#C9A24A" strokeWidth={1.6} />
          <span className="flex flex-col text-sm"><b>המשלוח עלינו</b><span className="text-soft">ומשלמים רק כשהנעל אצלך</span></span>
        </div>
        <div>
          {items.map((it) => (
            <div key={lineKey(it.productId, it.size, it.color)} className="flex gap-3.5 md:gap-5 py-4 border-b border-line">
              <Link href={`/product/${it.slug}`} className="shrink-0">
                <img src={it.image} alt={it.name} className="w-[96px] h-[96px] md:w-[120px] md:h-[120px] object-cover bg-ink" />
              </Link>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex justify-between items-start gap-2">
                  <Link href={`/product/${it.slug}`} className="font-bold text-base md:text-lg">{it.name}</Link>
                  <button onClick={() => remove(it.productId, it.size, it.color)} aria-label="הסרה מהסל" className="w-11 h-11 -mt-2.5 -ml-2.5 flex items-center justify-center text-muted">
                    <TrashIcon />
                  </button>
                </div>
                <span className="text-[13px] text-muted">{it.colorName ? `${it.colorName} · ` : ""}מידה {it.size}</span>
                <div className="flex justify-between items-center mt-auto">
                  <div className="h-10 rounded-[10px] border border-line bg-white flex items-center">
                    <button onClick={() => setQty(it.productId, it.size, it.qty + 1, it.color)} aria-label="הוספת כמות" className="w-10 h-[38px] text-lg">+</button>
                    <span className="w-5 text-center font-bold">{it.qty}</span>
                    <button onClick={() => setQty(it.productId, it.size, it.qty - 1, it.color)} aria-label="הפחתת כמות" className="w-10 h-[38px] text-lg">−</button>
                  </div>
                  {promo.lines[lineKey(it.productId, it.size, it.color)] ? (
                    <span className="flex flex-col items-end leading-tight">
                      <s className="text-[13px] text-muted">{shekel(it.price * it.qty)}</s>
                      <b className="text-[17px] text-[#2F5A26]">{shekel(it.price * it.qty - promo.lines[lineKey(it.productId, it.size, it.color)])}</b>
                    </span>
                  ) : (
                    <b className="text-[17px]">{shekel(it.price * it.qty)}</b>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <aside className="w-full lg:w-[380px] lg:sticky lg:top-24 p-5 md:p-6 rounded-[20px] bg-panel flex flex-col gap-3 text-[15px]">
        <h2 className="font-display font-bold text-[22px]">סיכום</h2>
        <PromoHints hints={promo.hints} />
        <div className="flex justify-between"><span>סכום ביניים</span><span>{shekel(subtotal)}</span></div>
        <PromoRows applied={promo.applied} />
        <div className="flex justify-between"><span>משלוח</span><span>חינם</span></div>
        <div className="h-px bg-line my-1" />
        <div className="flex justify-between items-baseline"><b className="text-[17px]">סה״כ לתשלום</b><b className="font-display text-[26px]">{shekel(promo.afterPromo)}</b></div>
        {promo.discount > 0 && <span className="text-[14px] font-bold text-[#2F5A26]">חסכת {shekel(promo.discount)} במבצעים</span>}
        <span className="text-[13px] text-muted">כולל מע״מ · מזומן בעת המסירה, אשראי או Bit</span>
        <Link href="/checkout" className="btn btn-dark h-14 text-[17px] mt-2">להשלמת ההזמנה</Link>
        <Link href="/shop" className="text-center underline py-2">המשך קנייה</Link>
      </aside>
    </div>
  );
}
