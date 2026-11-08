import { isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { listProducts, totalStock } from "@/lib/store";
import { getAttributes } from "@/lib/catalog";
import type { Product } from "@/lib/types";
import { Notice, PageHeader } from "../../_components/ui";
import ManualOrderForm, { type PickProduct } from "./ManualOrderForm";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  if (!isAdmin()) return null;
  const attrs = hasDb() ? await getAttributes() : null;
  const colorName = (k: string) => attrs?.colors.find((c) => c.key === k)?.label || k;
  // variant products: one option per colour+size ("colour::size")
  const pick = (p: Product): PickProduct => {
    if (!p.variants) return { id: p.id, name: p.name, price: p.price, image: p.images[0] || "", stock: p.stock, active: p.active };
    const stock: Record<string, number> = {};
    const labels: Record<string, string> = {};
    for (const c of p.variants.colors)
      for (const [s, q] of Object.entries(p.variants.stock[c.key] || {}).sort((a, b) => Number(a[0]) - Number(b[0]))) {
        stock[`${c.key}::${s}`] = q;
        labels[`${c.key}::${s}`] = `${colorName(c.key)} · ${s}`;
      }
    return { id: p.id, name: p.name, price: p.price, image: p.images[0] || "", stock, labels, active: p.active };
  };
  const products: PickProduct[] = hasDb()
    ? (await listProducts({ includeInactive: true }))
        .filter((p) => totalStock(p) > 0)
        .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "he"))
        .map(pick)
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
