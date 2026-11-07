import { headers } from "next/headers";
import { isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { Chip, PageHeader } from "../../_components/ui";
import ProductEditor from "../ProductEditor";

export const dynamic = "force-dynamic";

export default function NewProduct() {
  if (!isAdmin()) return null;
  const host = headers().get("host") || "quality-store";
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin/products", label: "מוצרים ומלאי" }, { label: "מוצר חדש" }]}
        title="מוצר חדש"
        sub={<span className="flex items-center gap-2"><Chip tone="blue">טיוטה</Chip> המוצר יישמר רק בלחיצה על „שמירה”</span>}
      />
      <ProductEditor product={null} canEdit={hasDb()} blobReady={!!process.env.BLOB_READ_WRITE_TOKEN} siteHost={host} />
    </>
  );
}
