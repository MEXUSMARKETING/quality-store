import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getOrderById } from "@/lib/store";
import { ORDER_STATUS, PAYMENT, SHIPPING, shekel, waLink } from "@/lib/config";
import { setOrderStatusAction } from "../../actions";
import StatusBadge from "../../StatusBadge";

export const dynamic = "force-dynamic";

function intlPhone(p: string) {
  const d = p.replace(/\D/g, "");
  return d.startsWith("0") ? "972" + d.slice(1) : d;
}

export default async function OrderDetail({ params }: { params: { id: string } }) {
  if (!isAdmin()) return null;
  const o = await getOrderById(Number(params.id));
  if (!o) notFound();

  return (
    <div className="flex flex-col gap-5 max-w-[960px]">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/orders" className="text-sm underline">← הזמנות</Link>
        <h1 className="font-display font-bold text-[28px]">הזמנה <span dir="ltr">{o.number}</span></h1>
        <StatusBadge status={o.status} />
      </div>

      <div className="grid md:grid-cols-[1.4fr_1fr] gap-5 items-start">
        <section className="bg-white rounded-2xl p-5 flex flex-col gap-3">
          <h2 className="font-bold text-lg">פריטים</h2>
          {o.items.map((it) => (
            <div key={it.productId + it.size} className="flex gap-3 items-center py-2 border-b border-[#EEECE6]">
              {it.image && <img src={it.image} alt="" className="w-14 h-14 rounded-xl object-cover bg-ink" />}
              <span className="flex-1 text-sm"><b className="block text-[15px]">{it.name}</b>מידה <b>{it.size}</b> · כמות {it.qty} · {shekel(it.price)} ליחידה</span>
              <b>{shekel(it.price * it.qty)}</b>
            </div>
          ))}
          <div className="flex justify-between"><span>משלוח</span><span>חינם</span></div>
          <div className="flex justify-between items-baseline"><b>סה״כ</b><b className="font-display text-2xl">{shekel(o.total)}</b></div>
        </section>

        <div className="flex flex-col gap-5">
          <section className="bg-white rounded-2xl p-5 flex flex-col gap-2 text-[15px]">
            <h2 className="font-bold text-lg pb-1">לקוחה</h2>
            <span><b>{o.customer_name}</b></span>
            <a href={`tel:${o.phone}`} dir="ltr" className="text-right underline">{o.phone}</a>
            {o.email && <span dir="ltr" className="text-right">{o.email}</span>}
            <span className="pt-2"><b>משלוח:</b> {SHIPPING[o.shipping_method]}</span>
            {o.shipping_method === "home" && <span>{o.street}{o.apt ? `, ${o.apt}` : ""}, {o.city}</span>}
            <span><b>תשלום:</b> {PAYMENT[o.payment_method]}</span>
            {o.notes && <span><b>הערות:</b> {o.notes}</span>}
            <span className="text-sm text-muted pt-1">{new Date(o.created_at).toLocaleString("he-IL")}</span>
            <a href={waLink(`שלום ${o.customer_name}, כאן Quality טמרה לגבי הזמנה ${o.number}`, intlPhone(o.phone))} target="_blank" rel="noopener" className="btn bg-[#1F8A4C] text-white h-11 mt-2 hover:text-white">
              וואטסאפ ללקוחה
            </a>
          </section>

          <section className="bg-white rounded-2xl p-5 flex flex-col gap-3">
            <h2 className="font-bold text-lg">עדכון סטטוס</h2>
            <form action={setOrderStatusAction} className="flex flex-wrap gap-2">
              <input type="hidden" name="id" value={o.id} />
              {Object.entries(ORDER_STATUS).map(([k, v]) => (
                <button key={k} name="status" value={k} className={`h-10 px-4 rounded-full text-sm font-bold border ${o.status === k ? "text-white" : "bg-white"}`} style={o.status === k ? { background: v.color, borderColor: v.color } : { borderColor: v.color, color: v.color }}>
                  {v.label}
                </button>
              ))}
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
