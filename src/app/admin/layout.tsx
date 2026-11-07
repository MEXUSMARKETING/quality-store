import { adminPasswordSet, isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { listOrders, listProducts, totalStock } from "@/lib/store";
import LoginForm from "./LoginForm";
import { logout } from "./actions";
import Shell, { type Alert } from "./_components/Shell";
import { DbMissing } from "./_components/ui";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const metadata = { title: "ניהול", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isAdmin()) return <LoginForm configured={adminPasswordSet()} />;

  let newOrders = 0;
  const alerts: Alert[] = [];
  try {
    const [orders, products] = await Promise.all([listOrders("new"), listProducts({ includeInactive: true })]);
    newOrders = orders.length;
    if (newOrders) alerts.push({ href: "/admin/orders?status=new", title: `${newOrders} הזמנות חדשות ממתינות לטיפול`, meta: "הזמנות", tone: "blue" });
    const unpaidOld = orders.filter((o) => Date.now() - new Date(o.created_at).getTime() > 24 * 3600 * 1000).length;
    if (unpaidOld) alerts.push({ href: "/admin/orders?status=new", title: `${unpaidOld} הזמנות חדשות מחכות יותר מ־24 שעות`, meta: "כדאי לאשר או לעדכן את הלקוחה", tone: "amber" });
    for (const p of products.filter((p) => p.active)) {
      const t = totalStock(p);
      if (t === 0) alerts.push({ href: `/admin/products/${p.id}`, title: `${p.name} אזל מהמלאי`, meta: "המוצר עדיין מוצג באתר", tone: "red" });
      else if (t <= (p.low_stock ?? 2)) alerts.push({ href: `/admin/products/${p.id}`, title: `${p.name} – נשארו ${t} זוגות`, meta: "מלאי נמוך", tone: "amber" });
    }
  } catch (e) {
    console.error(e);
  }

  return (
    <Shell newOrders={newOrders} alerts={alerts.slice(0, 8)} logoutAction={logout}>
      {!hasDb() && <DbMissing />}
      {children}
    </Shell>
  );
}
