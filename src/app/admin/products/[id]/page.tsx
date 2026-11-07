import { imageStorageReady } from "@/lib/storage";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { getProductById } from "@/lib/store";
import { getAttributes, getCategoriesAll } from "@/lib/catalog";
import { Chip, Icon, Notice, PageHeader, fmtDateTime } from "../../_components/ui";
import ProductEditor from "../ProductEditor";
import ConfirmButton from "../ConfirmButton";
import { deleteProductAction, duplicateProductAction } from "../actions";
import { stockLevel, stockTotal } from "../shared";

export const dynamic = "force-dynamic";

export default async function EditProduct({ params, searchParams }: { params: { id: string }; searchParams: { saved?: string; duplicated?: string } }) {
  if (!isAdmin()) return null;
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const p = await getProductById(id);
  if (!p) notFound();
  const [cats, attrs] = await Promise.all([getCategoriesAll(), getAttributes()]);
  const canEdit = hasDb();
  const host = headers().get("host") || "quality-store";
  const lvl = stockLevel(p);

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin/products", label: "מוצרים ומלאי" }, { label: p.name }]}
        title={p.name}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {p.active ? <Chip tone="green">מוצג באתר</Chip> : <Chip tone="gray">מוסתר</Chip>}
            {p.featured && <Chip tone="purple">מומלץ</Chip>}
            {lvl === "out" ? <Chip tone="red">אזל מהמלאי</Chip> : lvl === "low" ? <Chip tone="amber">מלאי נמוך · {stockTotal(p.stock)}</Chip> : null}
            <span>{p.updated_at ? `עודכן לאחרונה ${fmtDateTime(p.updated_at)}` : `נוצר ${fmtDateTime(p.created_at)}`}</span>
          </span>
        }
      >
        {canEdit && (
          <>
            <form action={duplicateProductAction}>
              <input type="hidden" name="id" value={p.id} />
              <button className="a-btn"><Icon name="copy" /> שכפול</button>
            </form>
            <form action={deleteProductAction}>
              <input type="hidden" name="id" value={p.id} />
              <ConfirmButton message={`למחוק את "${p.name}" לצמיתות? אי אפשר לבטל. (אפשר במקום זה להסתיר אותו מהאתר)`} className="a-btn a-btn-danger">
                <Icon name="trash" /> מחיקה
              </ConfirmButton>
            </form>
          </>
        )}
      </PageHeader>

      {searchParams.saved && (
        <div role="status">
          <Notice tone="green"><b>המוצר נשמר.</b> השינויים כבר מופיעים באתר.{" "}
            <Link href={`/product/${p.slug}`} target="_blank" className="underline font-semibold">לצפייה בדף המוצר</Link>
          </Notice>
        </div>
      )}
      {searchParams.duplicated && (
        <div role="status">
          <Notice tone="blue"><b>נוצר עותק מוסתר.</b> עדכני שם, צבע, תמונות ומלאי – ואז הפעילי „מוצג באתר” ושמרי.</Notice>
        </div>
      )}

      <ProductEditor key={`${p.id}-${p.updated_at || ""}`} product={p} canEdit={canEdit} blobReady={imageStorageReady()} siteHost={host} categories={cats.map((c) => ({ key: c.key, name: c.name, parent: c.parent, active: c.active }))} sizes={attrs.sizes} colors={attrs.colors} />
    </>
  );
}
