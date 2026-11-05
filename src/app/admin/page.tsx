import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { listOrders, listProducts, totalStock, listClubMembers } from "@/lib/store";
import { ORDER_STATUS, shekel } from "@/lib/config";
import StatusBadge from "./StatusBadge";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  if (!isAdmin()) return null;
  const [orders, products, club] = await Promise.all([listOrders(), listProducts({ includeInactive: true }), listClubMembers()]);
  const live = orders.filter((o) => o.status !== "cancelled");
  const revenue = live.reduce((a, o) => a + o.total, 0);
  const newOrders = orders.filter((o) => o.status === "new").length;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthRevenue = live.filter((o) => new Date(o.created_at) >= monthStart).reduce((a, o) => a + o.total, 0);
  const lowStock = products.filter((p) => p.active && totalStock(p) <= 2);

  const stats = [
    { label: "הזמנות חדשות", value: String(newOrders), href: "/admin/orders?status=new" },
    { label: "הכנסות החודש", value: shekel(monthRevenue), href: "/admin/orders" },
    { label: "סה״כ הכנסות", value: shekel(revenue), href: "/admin/orders" },
    { label: "חברות מועדון", value: String(club.length), href: "/admin/club" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display font-bold text-[28px]">לוח בקרה</h1>
        <Link href="/admin/products/new" className="btn btn-dark h-11">+ מוצר חדש</Link>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="bg-white rounded-2xl p-5 flex flex-col gap-1">
            <span className="text-sm text-muted">{s.label}</span>
            <b className="font-display text-[28px]">{s.value}</b>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.6fr_1fr] gap-5 items-start">
        <section className="bg-white rounded-2xl p-5">
          <div className="flex justify-between items-baseline pb-3">
            <h2 className="font-bold text-lg">הזמנות אחרונות</h2>
            <Link href="/admin/orders" className="text-sm underline">לכל ההזמנות</Link>
          </div>
          {orders.length ? (
            <div className="overflow-x-auto">
              <table className="admin-table w-full">
                <thead><tr><th>מס׳</th><th>לקוחה</th><th>סכום</th><th>סטטוס</th><th>תאריך</th></tr></thead>
                <tbody>
                  {orders.slice(0, 8).map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`/admin/orders/${o.id}`} className="font-bold underline" dir="ltr">{o.number}</Link></td>
                      <td>{o.customer_name}</td>
                      <td>{shekel(o.total)}</td>
                      <td><StatusBadge status={o.status} /></td>
                      <td className="text-muted whitespace-nowrap">{new Date(o.created_at).toLocaleDateString("he-IL")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted text-sm py-6 text-center">עדיין אין הזמנות</p>
          )}
        </section>

        <section className="bg-white rounded-2xl p-5">
          <div className="flex justify-between items-baseline pb-3">
            <h2 className="font-bold text-lg">מלאי נמוך</h2>
            <Link href="/admin/products" className="text-sm underline">לכל המוצרים</Link>
          </div>
          {lowStock.length ? (
            <ul className="flex flex-col">
              {lowStock.map((p) => (
                <li key={p.id} className="flex items-center gap-3 py-2.5 border-b border-[#EEECE6] last:border-0">
                  {p.images[0] && <img src={p.images[0]} alt="" className="w-11 h-11 rounded-lg object-cover bg-ink" />}
                  <Link href={`/admin/products/${p.id}`} className="flex-1 text-sm font-bold">{p.name}</Link>
                  <span className={`text-sm font-bold ${totalStock(p) === 0 ? "text-[#A13A0D]" : "text-golddark"}`}>{totalStock(p) === 0 ? "אזל" : `${totalStock(p)} זוגות`}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-sm py-6 text-center">המלאי תקין</p>
          )}
        </section>
      </div>
    </div>
  );
}
