import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { listOrders } from "@/lib/store";
import { ORDER_STATUS, PAYMENT, SHIPPING, shekel } from "@/lib/config";
import StatusBadge from "../StatusBadge";

export const dynamic = "force-dynamic";

export default async function OrdersAdmin({ searchParams }: { searchParams: { status?: string } }) {
  if (!isAdmin()) return null;
  const status = searchParams.status && ORDER_STATUS[searchParams.status] ? searchParams.status : "";
  const all = await listOrders();
  const list = status ? all.filter((o) => o.status === status) : all;
  const count = (s: string) => all.filter((o) => o.status === s).length;

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-display font-bold text-[28px]">הזמנות <span className="text-muted text-lg">({list.length})</span></h1>
      <div className="flex gap-2 flex-wrap">
        <Link href="/admin/orders" className={`h-9 px-4 rounded-full text-sm flex items-center ${!status ? "bg-ink text-white hover:text-white" : "bg-white"}`}>הכל ({all.length})</Link>
        {Object.entries(ORDER_STATUS).map(([k, v]) => (
          <Link key={k} href={`/admin/orders?status=${k}`} className={`h-9 px-4 rounded-full text-sm flex items-center ${status === k ? "bg-ink text-white hover:text-white" : "bg-white"}`}>
            {v.label} ({count(k)})
          </Link>
        ))}
      </div>
      <div className="bg-white rounded-2xl overflow-x-auto">
        {list.length ? (
          <table className="admin-table w-full min-w-[820px]">
            <thead><tr><th>מס׳</th><th>תאריך</th><th>לקוחה</th><th>טלפון</th><th>פריטים</th><th>סכום</th><th>משלוח / תשלום</th><th>סטטוס</th></tr></thead>
            <tbody>
              {list.map((o) => (
                <tr key={o.id}>
                  <td><Link href={`/admin/orders/${o.id}`} className="font-bold underline" dir="ltr">{o.number}</Link></td>
                  <td className="whitespace-nowrap text-muted">{new Date(o.created_at).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{o.customer_name}</td>
                  <td dir="ltr" className="text-right whitespace-nowrap">{o.phone}</td>
                  <td className="text-sm">{o.items.reduce((a, i) => a + i.qty, 0)}</td>
                  <td className="font-bold">{shekel(o.total)}</td>
                  <td className="text-xs text-muted">{SHIPPING[o.shipping_method]}<br />{PAYMENT[o.payment_method]}</td>
                  <td><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted text-sm p-10 text-center">אין הזמנות להצגה</p>
        )}
      </div>
    </div>
  );
}
