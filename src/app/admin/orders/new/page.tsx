import { isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { listProducts, totalStock } from "@/lib/store";
import { Notice, PageHeader } from "../../_components/ui";
import ManualOrderForm, { type PickProduct } from "./ManualOrderForm";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  if (!isAdmin()) return null;
  const products: PickProduct[] = hasDb()
    ? (await listProducts({ includeInactive: true }))
        .filter((p) => totalStock(p) > 0)
        .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "he"))
        .map((p) => ({ id: p.id, name: p.name, price: p.price, image: p.images[0] || "", stock: p.stock, active: p.active }))
    : [];

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin", label: "ראשי" }, { href: "/admin/orders", label: "הזמנות" }, { label: "הזמנה ידנית" }]}
        title="הזמנה ידנית"
        sub="למכירות בטלפון, בוואטסאפ או בחנות. ההזמנה נשמרת כמו הזמנה מהאתר: מקבלת מספר, מורידה מלאי ומעדכנת את כרטיס הלקוחה."
      />
      {!hasDb() ? <Notice tone="amber">צריך לחבר מסד נתונים כדי ליצור הזמנות.</Notice> : <ManualOrderForm products={products} />}
    </>
  );
}
