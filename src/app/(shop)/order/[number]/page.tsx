import Link from "next/link";
import { getOrderByNumber } from "@/lib/store";
import { PAYMENT, SHIPPING, STORE, shekel, waLink } from "@/lib/config";
import { WhatsAppIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "ההזמנה התקבלה" };

export default async function OrderPage({ params }: { params: { number: string } }) {
  const o = await getOrderByNumber(params.number);

  return (
    <div className="container-site py-12 md:py-16 max-w-[640px]">
      <div className="p-6 md:p-8 rounded-[24px] bg-white flex flex-col gap-4">
        <span className="w-14 h-14 rounded-full bg-[#E2EADF] flex items-center justify-center text-[#2F5A26] text-2xl" aria-hidden="true">✓</span>
        <h1 className="font-display font-extrabold text-[28px] md:text-[36px]">תודה, ההזמנה התקבלה!</h1>
        <p className="text-[#45443F]">
          מספר הזמנה <b dir="ltr">{params.number}</b>. ניצור איתך קשר בקרוב לאישור ותיאום {o?.shipping_method === "pickup" ? "האיסוף" : "המשלוח"}.
        </p>
        {o && (
          <div className="flex flex-col gap-3 pt-2">
            {o.items.map((it) => (
              <div key={it.productId + it.size} className="flex gap-3 items-center">
                <img src={it.image} alt="" className="w-14 h-14 rounded-xl object-cover bg-ink" />
                <span className="flex-1 text-sm"><b className="block">{it.name}</b>מידה {it.size} · ×{it.qty}</span>
                <b>{shekel(it.price * it.qty)}</b>
              </div>
            ))}
            <div className="h-px bg-line" />
            <div className="flex justify-between"><span>משלוח</span><span>{SHIPPING[o.shipping_method]} · חינם</span></div>
            <div className="flex justify-between"><span>תשלום</span><span>{PAYMENT[o.payment_method]}</span></div>
            <div className="flex justify-between items-baseline"><b>סה״כ</b><b className="font-display text-2xl">{shekel(o.total)}</b></div>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 pt-3">
          <a href={waLink(`שלום, ביצעתי הזמנה מספר ${params.number}`)} target="_blank" rel="noopener" className="btn bg-[#1F8A4C] text-white hover:text-white">
            <WhatsAppIcon size={20} /> וואטסאפ <span dir="ltr">{STORE.phoneDisplay}</span>
          </a>
          <Link href="/shop" className="btn btn-outline">המשך קנייה</Link>
        </div>
      </div>
    </div>
  );
}
