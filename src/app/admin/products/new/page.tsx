import { imageStorageReady } from "@/lib/storage";
import { headers } from "next/headers";
import { isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { Chip, PageHeader } from "../../_components/ui";
import { getAttributes, getCategoriesAll } from "@/lib/catalog";
import ProductEditor from "../ProductEditor";

export const dynamic = "force-dynamic";

export default async function NewProduct() {
  if (!isAdmin()) return null;
  const [cats, attrs] = await Promise.all([getCategoriesAll(), getAttributes()]);
  const host = headers().get("host") || "quality-store";
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin/products", label: "מוצרים ומלאי" }, { label: "מוצר חדש" }]}
        title="מוצר חדש"
        sub={<span className="flex items-center gap-2"><Chip tone="blue">טיוטה</Chip> המוצר יישמר רק בלחיצה על „שמירה”</span>}
      />
      <ProductEditor product={null} canEdit={hasDb()} blobReady={imageStorageReady()} siteHost={host} categories={cats.map((c) => ({ key: c.key, name: c.name, parent: c.parent, active: c.active }))} sizes={attrs.sizes} colors={attrs.colors} />
    </>
  );
}
