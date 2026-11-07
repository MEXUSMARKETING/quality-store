import { SIZES } from "@/lib/config";
import type { Product } from "@/lib/types";

/* Pure helpers shared by the products list, editor, server actions and CSV export.
   (No "use server"/"use client" here, so both sides can import it.) */

export function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9֐-׿\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export const stockTotal = (stock: Record<string, number> | undefined) =>
  Object.values(stock || {}).reduce((a, b) => a + (Number(b) || 0), 0);

export const lowOf = (p: Pick<Product, "low_stock">) => (p.low_stock === undefined || p.low_stock === null ? 2 : p.low_stock);

export type StockLevel = "out" | "low" | "ok";
export function stockLevel(p: Pick<Product, "stock" | "low_stock">): StockLevel {
  const t = stockTotal(p.stock);
  if (t === 0) return "out";
  if (t <= lowOf(p)) return "low";
  return "ok";
}

/* ---------------- list filters (URL search params) ---------------- */

export const TABS = {
  all: "הכל",
  active: "מוצגים באתר",
  hidden: "מוסתרים",
  low: "מלאי נמוך",
  out: "אזלו",
} as const;
export type TabKey = keyof typeof TABS;

export const SORTS = {
  sort: "סדר תצוגה",
  new: "חדשים",
  price_asc: "מחיר עולה",
  price_desc: "מחיר יורד",
  stock: "מלאי נמוך",
} as const;
export type SortKey = keyof typeof SORTS;

export type ProductFilters = { tab: TabKey; q: string; category: string; color: string; sort: SortKey };

export function readFilters(sp: Record<string, string | string[] | undefined>): ProductFilters {
  const one = (k: string) => {
    const v = sp[k];
    return String(Array.isArray(v) ? v[0] : v ?? "").trim();
  };
  // `?stock=low|out` is used by links from the dashboard
  const rawTab = one("tab") || one("stock");
  const tab = (rawTab in TABS ? rawTab : "all") as TabKey;
  const sort = (one("sort") in SORTS ? one("sort") : "sort") as SortKey;
  // keys are managed in the admin (categories / attributes), so accept any well-formed key
  const key = (v: string) => (/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v) ? v : "");
  const category = key(one("category"));
  const color = key(one("color"));
  return { tab, q: one("q").slice(0, 100), category, color, sort };
}

export function filtersQuery(f: Partial<ProductFilters>, overrides: Partial<ProductFilters> = {}) {
  const m = { ...f, ...overrides };
  const sp = new URLSearchParams();
  if (m.tab && m.tab !== "all") sp.set("tab", m.tab);
  if (m.q) sp.set("q", m.q);
  if (m.category) sp.set("category", m.category);
  if (m.color) sp.set("color", m.color);
  if (m.sort && m.sort !== "sort") sp.set("sort", m.sort);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** Search + category + colour (everything except the tab) */
export function matchBase(p: Product, f: ProductFilters) {
  if (f.category && p.category !== f.category) return false;
  if (f.color && p.color !== f.color) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    if (!`${p.name} ${p.sku || ""} ${p.slug}`.toLowerCase().includes(q)) return false;
  }
  return true;
}

export function matchTab(p: Product, tab: TabKey) {
  switch (tab) {
    case "active":
      return p.active;
    case "hidden":
      return !p.active;
    case "low":
      return stockLevel(p) === "low";
    case "out":
      return stockLevel(p) === "out";
    default:
      return true;
  }
}

export function sortProducts(list: Product[], sort: SortKey): Product[] {
  const a = [...list];
  const byId = (x: Product, y: Product) => y.id - x.id;
  switch (sort) {
    case "new":
      return a.sort((x, y) => (y.created_at || "").localeCompare(x.created_at || "") || byId(x, y));
    case "price_asc":
      return a.sort((x, y) => x.price - y.price || byId(x, y));
    case "price_desc":
      return a.sort((x, y) => y.price - x.price || byId(x, y));
    case "stock":
      return a.sort((x, y) => stockTotal(x.stock) - stockTotal(y.stock) || byId(x, y));
    default:
      return a.sort((x, y) => x.sort - y.sort || byId(x, y));
  }
}

export function applyFilters(all: Product[], f: ProductFilters) {
  const base = all.filter((p) => matchBase(p, f));
  const counts = Object.fromEntries((Object.keys(TABS) as TabKey[]).map((k) => [k, base.filter((p) => matchTab(p, k)).length])) as Record<TabKey, number>;
  const list = sortProducts(base.filter((p) => matchTab(p, f.tab)), f.sort);
  return { list, counts };
}

export { SIZES };
