import { hasPermission } from "@/lib/auth";
import { listProducts } from "@/lib/store";
import { categoryNames, colorMap, getAttributes, getCategoriesAll } from "@/lib/catalog";
import { stockTotal } from "../shared";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  if (!(await hasPermission("products", "view"))) return new Response("Unauthorized", { status: 401 });
  const [rows, cats, attrs] = await Promise.all([listProducts({ includeInactive: true }), getCategoriesAll(), getAttributes()]);
  const CATEGORIES = categoryNames(cats);
  const COLORS = colorMap(attrs);
  const SIZES = Array.from(new Set([...attrs.sizes, ...rows.flatMap((p) => Object.keys(p.stock || {}).filter((k) => Number(p.stock[k]) > 0))]));
  const header = ["id", "sku", "name", "category", "color", "price", "old_price", "cost", "total_stock", ...SIZES.map((s) => `size_${s}`), "active"];
  const lines = rows.map((p) =>
    [
      p.id,
      p.sku || "",
      p.name,
      CATEGORIES[p.category] || p.category,
      COLORS[p.color]?.label || p.color,
      p.price,
      p.old_price ?? "",
      p.cost ?? "",
      stockTotal(p.stock),
      ...SIZES.map((s) => Number(p.stock?.[s]) || 0),
      p.active ? "yes" : "no",
    ]
      .map(esc)
      .join(",")
  );
  const csv = "﻿" + [header.join(","), ...lines].join("\r\n") + "\r\n";
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quality-products-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
