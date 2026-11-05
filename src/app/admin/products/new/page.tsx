import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import ProductForm from "../ProductForm";

export const dynamic = "force-dynamic";

export default function NewProduct() {
  if (!isAdmin()) return null;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/products" className="text-sm underline">← מוצרים</Link>
        <h1 className="font-display font-bold text-[28px]">מוצר חדש</h1>
      </div>
      <ProductForm product={null} canEdit={hasDb()} />
    </div>
  );
}
