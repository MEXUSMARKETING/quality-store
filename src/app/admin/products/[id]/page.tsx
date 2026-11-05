import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { getProductById } from "@/lib/store";
import ProductForm from "../ProductForm";
import { deleteProductAction } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditProduct({ params, searchParams }: { params: { id: string }; searchParams: { saved?: string } }) {
  if (!isAdmin()) return null;
  const p = await getProductById(Number(params.id));
  if (!p) notFound();
  const canEdit = hasDb();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin/products" className="text-sm underline">← מוצרים</Link>
          <h1 className="font-display font-bold text-[26px]">{p.name}</h1>
        </div>
        <Link href={`/product/${p.slug}`} target="_blank" className="text-sm underline">צפייה באתר ↗</Link>
      </div>
      {searchParams.saved && <div role="status" className="p-3 rounded-xl bg-[#E2EADF] text-[#2F5A26] font-bold text-sm">המוצר נשמר ✓</div>}
      <ProductForm key={p.id + (searchParams.saved || "")} product={p} canEdit={canEdit} />
      {canEdit && (
        <details className="bg-white rounded-2xl p-5 max-w-[520px]">
          <summary className="cursor-pointer text-sm font-bold text-[#A13A0D]">מחיקת המוצר</summary>
          <form action={deleteProductAction} className="pt-3 flex items-center gap-3 flex-wrap">
            <input type="hidden" name="id" value={p.id} />
            <span className="text-sm">המחיקה סופית. אפשר במקום זה להסתיר את המוצר.</span>
            <button className="h-10 px-5 rounded-full bg-[#A13A0D] text-white text-sm font-bold">מחיקה סופית</button>
          </form>
        </details>
      )}
    </div>
  );
}
