import { headers } from "next/headers";
import { adminPasswordSet, currentAdmin } from "@/lib/auth";
import { can, moduleForPath, ROLES } from "@/lib/permissions";
import { hasDb } from "@/lib/db";
import { getStoreInfo } from "@/lib/site";
import { listOrders, listProducts, totalStock } from "@/lib/store";
import LoginForm from "./LoginForm";
import { logout } from "./actions";
import Shell, { type Alert } from "./_components/Shell";
import { DbMissing } from "./_components/ui";

export const dynamic = "force-dynamic";
export const maxDuration = 30;
export const metadata = {
  title: { absolute: "NEXSHOP · ניהול החנות", template: "%s · NEXSHOP" },
  robots: { index: false, follow: false },
  icons: { icon: "/brand/nexshop-icon-v2.png", apple: "/brand/nexshop-mark-v2.png" },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await currentAdmin();
  const storeName = await getStoreInfo().then((x) => x.name).catch(() => "");
  if (!me) return <LoginForm configured={adminPasswordSet()} storeName={storeName} />;
  const path = headers().get("x-admin-path") || "/admin";
  const mod = moduleForPath(path);
  const allowed = !mod || can(me.perms, mod, "view");

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
    <Shell newOrders={newOrders} alerts={can(me.perms, "orders") || can(me.perms, "products") ? alerts.slice(0, 8) : []} logoutAction={logout} storeName={storeName} perms={me.perms} userName={me.name} roleLabel={ROLES[me.role]?.label || me.role}>
      {!hasDb() && <DbMissing />}
      {allowed ? (
        children
      ) : (
        <div className="a-card text-center py-14 flex flex-col items-center gap-2">
          <b className="text-[18px]">אין לך הרשאה לעמוד הזה</b>
          <p className="text-[14px] text-adm-muted">אפשר לבקש מהמנהל הראשי להוסיף הרשאה בעמוד &quot;משתמשים והרשאות&quot;.</p>
        </div>
      )}
    </Shell>
  );
}
