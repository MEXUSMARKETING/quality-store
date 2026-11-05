import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { listProducts, totalStock, availableSizes } from "@/lib/store";
import { CATEGORIES, shekel } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function ProductsAdmin({ searchParams }: { searchParams: { category?: string } }) {
  if (!isAdmin()) return null;
  const cat = searchParams.category || "";
  const all = await listProducts({ includeInactive: true });
  const list = cat ? all.filter((p) => p.category === cat) : all;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display font-bold text-[28px]">מוצרים ומלאי <span className="text-muted text-lg">({list.length})</span></h1>
        <Link href="/admin/products/new" className="btn btn-dark h-11">+ מוצר חדש</Link>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Link href="/admin/products" className={`h-9 px-4 rounded-full text-sm flex items-center ${!cat ? "bg-ink text-white hover:text-white" : "bg-white"}`}>הכל</Link>
        {Object.entries(CATEGORIES).map(([k, v]) => (
          <Link key={k} href={`/admin/products?category=${k}`} className={`h-9 px-4 rounded-full text-sm flex items-center ${cat === k ? "bg-ink text-white hover:text-white" : "bg-white"}`}>{v}</Link>
        ))}
      </div>
      <div className="bg-white rounded-2xl overflow-x-auto">
        <table className="admin-table w-full min-w-[720px]">
          <thead>
            <tr><th></th><th>מוצר</th><th>מחיר</th><th>מידות במלאי</th><th>סה״כ זוגות</th><th>סטטוס</th><th></th></tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const t = totalStock(p);
              return (
                <tr key={p.id}>
                  <td className="w-[64px]">{p.images[0] ? <img src={p.images[0]} alt="" className="w-12 h-12 rounded-lg object-cover bg-ink" /> : <span className="block w-12 h-12 rounded-lg bg-line" />}</td>
                  <td><Link href={`/admin/products/${p.id}`} className="font-bold">{p.name}</Link><div className="text-xs text-muted">{CATEGORIES[p.category]}{p.heel ? ` · עקב ${p.heel}` : ""}</div></td>
                  <td className="whitespace-nowrap"><b>{shekel(p.price)}</b>{p.old_price ? <span className="text-xs text-muted line-through ms-1.5">{shekel(p.old_price)}</span> : null}</td>
                  <td className="text-sm">{availableSizes(p).join(", ") || "—"}</td>
                  <td><span className={`font-bold ${t === 0 ? "text-[#A13A0D]" : t <= 2 ? "text-golddark" : ""}`}>{t}</span></td>
                  <td>{p.active ? <span className="text-[#2F7A3A] text-sm font-bold">פעיל</span> : <span className="text-muted text-sm">מוסתר</span>}{p.featured && <span className="text-golddark text-xs ms-1.5">★ מומלץ</span>}</td>
                  <td><Link href={`/admin/products/${p.id}`} className="text-sm underline">עריכה</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
