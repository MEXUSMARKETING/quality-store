"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useCart } from "@/components/CartProvider";
import { placeOrder, type ActionResult } from "@/app/actions";
import { LockIcon, WhatsAppIcon } from "@/components/Icons";
import { STORE, shekel } from "@/lib/config";

function Radio({ name, value, current, onChange, title, sub, price }: { name: string; value: string; current: string; onChange: (v: string) => void; title: string; sub: string; price?: string }) {
  const on = current === value;
  return (
    <label className={`min-h-[64px] rounded-[14px] border-[1.5px] px-3.5 py-3 flex items-center gap-3 cursor-pointer ${on ? "border-ink bg-panel" : "border-line bg-white"}`}>
      <input type="radio" name={name} value={value} checked={on} onChange={() => onChange(value)} className="w-5 h-5 accent-ink" />
      <span className="flex-1 flex flex-col"><b className="text-[15px]">{title}</b><span className="text-[13px] text-muted">{sub}</span></span>
      {price && <b className="text-[15px]">{price}</b>}
    </label>
  );
}

function Submit({ total, cash }: { total: number; cash: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="h-[58px] rounded-[14px] bg-ink text-white text-lg font-bold disabled:opacity-60">
      {pending ? "שולחת את ההזמנה…" : cash ? `אישור הזמנה · ${shekel(total)}` : `שליחת הזמנה · ${shekel(total)}`}
    </button>
  );
}

export default function CheckoutPage() {
  const { items, subtotal, ready, clear } = useCart();
  const router = useRouter();
  const [shipping, setShipping] = useState("home");
  const [payment, setPayment] = useState("cash");
  const [state, action] = useFormState<ActionResult | null, FormData>(placeOrder, null);

  useEffect(() => {
    if (state?.ok && state.number) {
      clear();
      router.push(`/order/${state.number}`);
    }
  }, [state, clear, router]);

  if (!ready) return <div className="container-site py-20 text-center text-muted">טוען…</div>;

  if (state?.ok && !state.number && state.whatsapp) {
    return (
      <div className="container-site py-16 max-w-[560px] flex flex-col gap-4 text-center items-center">
        <h1 className="font-display font-bold text-[28px]">כמעט סיימנו!</h1>
        <p className="text-[#45443F]">לחצי על הכפתור כדי לשלוח לנו את פרטי ההזמנה בוואטסאפ, ונחזור אלייך לאישור ותיאום משלוח.</p>
        <a href={state.whatsapp} target="_blank" rel="noopener" onClick={() => clear()} className="btn h-14 px-8 bg-[#1F8A4C] text-white hover:text-white">
          <WhatsAppIcon size={20} /> שליחת ההזמנה בוואטסאפ
        </a>
      </div>
    );
  }

  if (!items.length && !state?.ok) {
    return (
      <div className="container-site py-20 flex flex-col items-center gap-4 text-center">
        <h1 className="font-display font-bold text-[28px]">הסל ריק</h1>
        <Link href="/shop" className="btn btn-dark">לקולקציה</Link>
      </div>
    );
  }

  return (
    <form action={action} className="container-site pt-6 pb-16 flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
      <input type="hidden" name="cart" value={JSON.stringify(items)} />
      <div className="flex-1 w-full flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display font-extrabold text-[26px] md:text-[36px]">השלמת הזמנה</h1>
          <span className="flex items-center gap-1.5 text-sm text-[#2F5A26] font-bold"><LockIcon size={16} strokeWidth={2} /> מאובטח</span>
        </div>

        <section className="p-5 md:p-6 rounded-[20px] bg-panel flex flex-col gap-4">
          <h2 className="font-display font-bold text-lg md:text-[22px]">1. הפרטים שלך</h2>
          <div className="grid sm:grid-cols-2 gap-3.5">
            <label className="field">שם מלא<input name="name" required autoComplete="name" className="input" /></label>
            <label className="field">טלפון נייד<input name="phone" required type="tel" autoComplete="tel" placeholder="050-0000000" dir="ltr" className="input text-right" /></label>
            <label className="field sm:col-span-2">מייל (לא חובה)<input name="email" type="email" autoComplete="email" dir="ltr" className="input text-right" /></label>
          </div>
        </section>

        <section className="p-5 md:p-6 rounded-[20px] bg-panel flex flex-col gap-3">
          <h2 className="font-display font-bold text-lg md:text-[22px]">2. איך לקבל את ההזמנה?</h2>
          <div className="grid sm:grid-cols-2 gap-2.5">
            <Radio name="shipping" value="home" current={shipping} onChange={setShipping} title="משלוח עד הבית" sub="השליח מתאם איתך מראש" price="חינם" />
            <Radio name="shipping" value="pickup" current={shipping} onChange={setShipping} title={`איסוף מהחנות ב${STORE.city}`} sub={STORE.address} price="חינם" />
          </div>
          {shipping === "home" && (
            <div className="grid sm:grid-cols-3 gap-3.5 pt-1">
              <label className="field">עיר / יישוב<input name="city" autoComplete="address-level2" className="input" /></label>
              <label className="field">רחוב ומספר<input name="street" autoComplete="address-line1" className="input" /></label>
              <label className="field">דירה / קומה<input name="apt" className="input" /></label>
            </div>
          )}
          <label className="field">הערות (לא חובה)<input name="notes" placeholder="קוד לבניין, שעות נוחות…" className="input" /></label>
        </section>

        <section className="p-5 md:p-6 rounded-[20px] bg-panel flex flex-col gap-3">
          <h2 className="font-display font-bold text-lg md:text-[22px]">3. אמצעי תשלום</h2>
          <div className="grid sm:grid-cols-3 gap-2.5">
            <Radio name="payment" value="cash" current={payment} onChange={setPayment} title="מזומן בעת המסירה" sub="משלמים לשליח" />
            <Radio name="payment" value="card" current={payment} onChange={setPayment} title="כרטיס אשראי" sub="נחזור אלייך לתשלום טלפוני" />
            <Radio name="payment" value="bit" current={payment} onChange={setPayment} title="Bit" sub="נשלח בקשת תשלום" />
          </div>
        </section>
      </div>

      <aside className="w-full lg:w-[400px] lg:sticky lg:top-24 p-5 md:p-6 rounded-[20px] bg-panel flex flex-col gap-4">
        <h2 className="font-display font-bold text-[22px]">ההזמנה שלך</h2>
        {items.map((it) => (
          <div key={it.productId + it.size} className="flex gap-3 items-center pb-3 border-b border-[#EEECE6]">
            <img src={it.image} alt="" className="w-16 h-16 rounded-xl object-cover bg-ink" />
            <span className="flex-1 text-sm"><b className="block text-[15px]">{it.name}</b>מידה {it.size} · ×{it.qty}</span>
            <b>{shekel(it.price * it.qty)}</b>
          </div>
        ))}
        <div className="flex justify-between text-[15px]"><span>משלוח</span><span>חינם</span></div>
        <div className="flex justify-between items-baseline"><b className="text-[17px]">סה״כ</b><b className="font-display text-[28px]">{shekel(subtotal)}</b></div>
        <label className="flex items-start gap-2.5 text-sm leading-normal">
          <input type="checkbox" name="terms" required className="w-5 h-5 mt-0.5 accent-ink shrink-0" />
          <span>קראתי ואני מסכימה ל<Link href="/info/terms" className="underline" target="_blank">תקנון האתר</Link></span>
        </label>
        {state?.error && <p role="alert" className="text-sm font-bold text-[#A13A0D]">{state.error}</p>}
        <Submit total={subtotal} cash={payment === "cash"} />
        <span className="text-[13px] text-muted text-center">שאלות? וואטסאפ <span dir="ltr">{STORE.phoneDisplay}</span></span>
      </aside>
    </form>
  );
}
