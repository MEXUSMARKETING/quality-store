import { cache } from "react";
import { db, hasDb } from "./db";
import { getCategoriesAll } from "./catalog";
import { getProductById } from "./store";
import type { Product } from "./types";
import { lineKey } from "./variants";
import {
  applyPromotions,
  autoBadge,
  normConfig,
  normScope,
  productInPromo,
  promoState,
  type PricingLine,
  type PricingResult,
  type Promotion,
} from "./promotions-shared";

/* Server side of automatic promotions: storage, active list (cached per request), cart pricing
   from the database and product badges for the storefront. Every storefront read falls back to
   "no promotions" if the DB is missing or errors, so the shop keeps selling at regular prices. */

export function normPromotion(r: any): Promotion {
  const scope = typeof r.scope === "string" ? JSON.parse(r.scope) : r.scope;
  const config = typeof r.config === "string" ? JSON.parse(r.config) : r.config;
  return {
    id: Number(r.id),
    name: String(r.name || ""),
    type: (["bxgy", "percent", "tiers", "bundle", "spend"].includes(r.type) ? r.type : "percent") as Promotion["type"],
    scope: normScope(scope),
    config: normConfig(config),
    starts_at: r.starts_at ? new Date(r.starts_at).toISOString() : null,
    ends_at: r.ends_at ? new Date(r.ends_at).toISOString() : null,
    active: !!r.active,
    allow_coupon: r.allow_coupon !== false,
    badge: String(r.badge || ""),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : undefined,
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
  };
}

export async function listPromotions(): Promise<Promotion[]> {
  if (!hasDb()) return [];
  const sql = await db();
  const r = await sql`select * from promotions order by id desc`;
  return r.map(normPromotion);
}

/** Promotions running right now (active flag + dates). Empty on any error. */
export const getActivePromotions = cache(async (): Promise<Promotion[]> => {
  if (!hasDb()) return [];
  try {
    const sql = await db();
    const r = await sql`select * from promotions where active = true
      and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now()) order by id`;
    return r.map(normPromotion);
  } catch (e) {
    console.error("promotions read failed", e);
    return [];
  }
});

/** category key → [key, parent, grandparent…] */
export const getCategoryPaths = cache(async (): Promise<Record<string, string[]>> => {
  const cats = await getCategoriesAll();
  const parent = new Map(cats.map((c) => [c.key, c.parent]));
  const out: Record<string, string[]> = {};
  for (const c of cats) {
    const path = [c.key];
    let p = parent.get(c.key);
    while (p && !path.includes(p) && path.length < 10) { path.push(p); p = parent.get(p); }
    out[c.key] = path;
  }
  return out;
});

export function lineFor(p: Product, qty: number, size: string, paths: Record<string, string[]>, color?: string | null): PricingLine {
  return {
    key: lineKey(p.id, size, p.variants ? color : null),
    productId: p.id,
    price: p.price,
    qty,
    cats: paths[p.category] || [p.category],
    onSale: !!(p.old_price && p.old_price > p.price),
  };
}

/** Price cart rows with the catalogue's current prices and the running promotions. */
export async function priceCartRows(rows: { productId: number; size: string; color?: string | null; qty: number }[]): Promise<PricingResult & { prices: Record<string, number> }> {
  const [promos, paths] = await Promise.all([getActivePromotions(), getCategoryPaths()]);
  const lines: PricingLine[] = [];
  const prices: Record<string, number> = {};
  for (const r of rows.slice(0, 30)) {
    const p = await getProductById(Number(r.productId));
    if (!p || !p.active) continue;
    const qty = Math.max(1, Math.min(9, Math.round(Number(r.qty) || 1)));
    const l = lineFor(p, qty, String(r.size), paths, r.color ? String(r.color) : null);
    lines.push(l);
    prices[l.key] = p.price;
  }
  return { ...applyPromotions(lines, promos), prices };
}

/** Badge text per product id for product cards ("1+1", "-15%"…). The first matching promotion wins. */
export async function getPromoBadges(products: Product[]): Promise<Record<number, string>> {
  const promos = await getActivePromotions();
  if (!promos.length) return {};
  const paths = await getCategoryPaths();
  const out: Record<number, string> = {};
  for (const p of products) {
    const u = { productId: p.id, cats: paths[p.category] || [p.category], onSale: !!(p.old_price && p.old_price > p.price) };
    const m = promos.find((x) => productInPromo(x, u));
    if (m) out[p.id] = m.badge || autoBadge(m.type, m.config);
  }
  return out;
}

/** Running promotions a product takes part in (product page strip). */
export async function promotionsForProduct(p: Product): Promise<Promotion[]> {
  const promos = await getActivePromotions();
  if (!promos.length) return [];
  const paths = await getCategoryPaths();
  const u = { productId: p.id, cats: paths[p.category] || [p.category], onSale: !!(p.old_price && p.old_price > p.price) };
  return promos.filter((x) => productInPromo(x, u));
}

export { promoState };
