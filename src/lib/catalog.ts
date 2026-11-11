import { cache } from "react";
import { db, hasDb } from "./db";
import { getSetting } from "./site";
import { CATEGORIES, CATEGORY_PARENTS, COLORS, SIZES } from "./config";

/* Catalog data managed in the admin: categories (table `categories`), sizes & colours
   (settings key `attributes`) and product reviews (table `reviews`).
   Every storefront read falls back to the hard-coded config when the DB is missing/empty/erroring. */

/* ---------------- categories ---------------- */

export type Category = {
  key: string;
  name: string;
  parent: string | null;
  description: string;
  image: string;
  banner: string;
  sort: number;
  active: boolean;
  featured: boolean;
  seo_title: string;
  seo_description: string;
  updated_at?: string;
};

export type CategoryWithCount = Category & { count: number };

/** The store's default category (the /shop landing page) – cannot be deleted or re-keyed. */
export const DEFAULT_CATEGORY = "boots";

export const CATEGORY_KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fallbackCategories(): Category[] {
  return Object.entries(CATEGORIES).map(([key, name], i) => ({
    key,
    name,
    parent: CATEGORY_PARENTS[key] || null,
    description: "",
    image: "",
    banner: "",
    sort: (i + 1) * 10,
    active: true,
    featured: false,
    seo_title: "",
    seo_description: "",
  }));
}

function normCategory(r: any): Category {
  return {
    key: String(r.key),
    name: String(r.name || r.key),
    parent: r.parent ? String(r.parent) : null,
    description: r.description || "",
    image: r.image || "",
    banner: r.banner || "",
    sort: Number(r.sort ?? 100),
    active: !!r.active,
    featured: !!r.featured,
    seo_title: r.seo_title || "",
    seo_description: r.seo_description || "",
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
  };
}

const g = globalThis as unknown as { __qcatSeeded?: boolean };

/** Seed the categories table from config the first time it is empty (idempotent). */
async function ensureCategories(sql: any) {
  if (g.__qcatSeeded) return;
  const [{ c }] = await sql`select count(*)::int as c from categories`;
  if (Number(c) === 0) {
    const rows = fallbackCategories();
    for (const r of rows) {
      await sql`insert into categories (key, name, parent, sort) values (${r.key}, ${r.name}, ${r.parent}, ${r.sort}) on conflict (key) do nothing`;
    }
  }
  g.__qcatSeeded = true;
}

/** Sort siblings by `sort`, then name; returns parents before their children (depth-first). */
export function orderTree<T extends Category>(list: T[]): T[] {
  const keys = new Set(list.map((c) => c.key));
  const byParent = new Map<string, T[]>();
  for (const c of list) {
    const p = c.parent && keys.has(c.parent) && c.parent !== c.key ? c.parent : "";
    if (!byParent.has(p)) byParent.set(p, []);
    byParent.get(p)!.push(c);
  }
  byParent.forEach((arr) => arr.sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "he")));
  const out: T[] = [];
  const seen = new Set<string>();
  const walk = (p: string) => {
    for (const c of byParent.get(p) || []) {
      if (seen.has(c.key)) continue;
      seen.add(c.key);
      out.push(c);
      walk(c.key);
    }
  };
  walk("");
  for (const c of list) if (!seen.has(c.key)) out.push(c); // orphans of a cycle – never lose a row
  return out;
}

/** Keys of a category and all its descendants. */
export function descendantKeys(list: Pick<Category, "key" | "parent">[], key: string): string[] {
  const out = [key];
  for (let i = 0; i < out.length; i++) {
    for (const c of list) if (c.parent === out[i] && !out.includes(c.key)) out.push(c.key);
  }
  return out;
}

/** All categories (admin: includes inactive) with product counts. Seeds the table lazily. */
export async function listAllCategories(): Promise<CategoryWithCount[]> {
  if (!hasDb()) return fallbackCategories().map((c) => ({ ...c, count: 0 }));
  const sql = await db();
  await ensureCategories(sql);
  const [rows, counts] = await Promise.all([
    sql`select * from categories`,
    sql`select category, count(*)::int as n from products group by category`,
  ]);
  const cnt = new Map<string, number>(counts.map((r: any) => [String(r.category), Number(r.n)]));
  return orderTree(rows.map((r: any) => ({ ...normCategory(r), count: cnt.get(String(r.key)) || 0 })));
}

const readCategories = cache(async (): Promise<Category[] | null> => {
  if (!hasDb()) return null;
  try {
    const sql = await db();
    await ensureCategories(sql);
    const rows = await sql`select * from categories`;
    return rows.length ? orderTree(rows.map(normCategory)) : null;
  } catch (e) {
    console.error("categories read failed", e);
    return null;
  }
});

/** Storefront categories: active (a child of an inactive parent is hidden too), tree-ordered.
 *  Falls back to the config list when there is no DB, the table is empty, or the read fails. */
export async function getCategories(): Promise<Category[]> {
  const list = await readCategories();
  if (!list) return fallbackCategories();
  const off = new Set(list.filter((c) => !c.active).map((c) => c.key));
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of list) if (!off.has(c.key) && c.parent && off.has(c.parent)) { off.add(c.key); grew = true; }
  }
  const on = list.filter((c) => !off.has(c.key));
  return on.length ? on : fallbackCategories();
}

/** Every category including inactive ones (admin selects, e.g. the product editor). Same fallback. */
export async function getCategoriesAll(): Promise<Category[]> {
  return (await readCategories()) || fallbackCategories();
}

/** key → name map (for labels). */
export function categoryNames(list: Pick<Category, "key" | "name">[]): Record<string, string> {
  return Object.fromEntries(list.map((c) => [c.key, c.name]));
}

/* ---------------- attributes (sizes & colours) ---------------- */

export type ColorDef = { key: string; label: string; hex: string };
export type Attributes = { sizes: string[]; colors: ColorDef[] };

export const DEFAULT_ATTRIBUTES: Attributes = {
  sizes: [...SIZES],
  colors: Object.entries(COLORS).map(([key, c]) => ({ key, label: c.label, hex: c.hex })),
};

export const COLOR_KEY_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Validate/clean a stored attributes value; null when unusable. */
export function cleanAttributes(v: any): Attributes | null {
  if (!v || typeof v !== "object") return null;
  const sizes = Array.isArray(v.sizes)
    ? Array.from(new Set(v.sizes.map((s: any) => String(s ?? "").trim()).filter((s: string) => s && s.length <= 10))) as string[]
    : [];
  const seen = new Set<string>();
  const colors: ColorDef[] = [];
  if (Array.isArray(v.colors)) {
    for (const c of v.colors) {
      const key = String(c?.key ?? "").trim();
      if (!COLOR_KEY_RE.test(key) || seen.has(key)) continue;
      seen.add(key);
      colors.push({ key, label: String(c?.label ?? key).trim().slice(0, 40) || key, hex: HEX_RE.test(String(c?.hex)) ? String(c.hex) : "#BDB9AF" });
    }
  }
  if (!sizes.length || !colors.length) return null;
  return { sizes, colors };
}

export const getAttributes = cache(async (): Promise<Attributes> => {
  try {
    const raw = await getSetting<any>("attributes", null);
    return cleanAttributes(raw) || DEFAULT_ATTRIBUTES;
  } catch {
    return DEFAULT_ATTRIBUTES;
  }
});

/** key → { label, hex } map, same shape as config COLORS. */
export function colorMap(a: Attributes): Record<string, { label: string; hex: string }> {
  return Object.fromEntries(a.colors.map((c) => [c.key, { label: c.label, hex: c.hex }]));
}

/* ---------------- reviews ---------------- */

export type Review = {
  id: number;
  product_id: number;
  name: string;
  phone: string;
  rating: number;
  title: string;
  body: string;
  verified: boolean;
  status: "pending" | "approved" | "rejected" | "hidden";
  reply: string;
  reply_at: string | null;
  reported: boolean;
  created_at: string;
};

export type Rating = { avg: number; count: number };

export function normReview(r: any): Review {
  return {
    id: Number(r.id),
    product_id: Number(r.product_id),
    name: r.name || "",
    phone: r.phone || "",
    rating: Math.max(1, Math.min(5, Number(r.rating) || 5)),
    title: r.title || "",
    body: r.body || "",
    verified: !!r.verified,
    status: r.status || "pending",
    reply: r.reply || "",
    reply_at: r.reply_at ? new Date(r.reply_at).toISOString() : null,
    reported: !!r.reported,
    created_at: new Date(r.created_at).toISOString(),
  };
}

/** Average rating + count of approved reviews per product, in one grouped query. */
export const getRatings = cache(async (): Promise<Record<number, Rating>> => {
  if (!hasDb()) return {};
  try {
    const sql = await db();
    const rows = await sql`
      select product_id, avg(rating)::float as avg, count(*)::int as n
      from reviews where status = 'approved' group by product_id`;
    const out: Record<number, Rating> = {};
    for (const r of rows) out[Number(r.product_id)] = { avg: Math.round(Number(r.avg) * 10) / 10, count: Number(r.n) };
    return out;
  } catch (e) {
    console.error("ratings read failed", e);
    return {};
  }
});

/** Approved reviews of one product for the storefront (phone is never returned). */
export async function getApprovedReviews(productId: number): Promise<Review[]> {
  if (!hasDb()) return [];
  try {
    const sql = await db();
    const rows = await sql`
      select id, product_id, name, rating, title, body, verified, status, reply, reply_at, reported, created_at
      from reviews where product_id = ${productId} and status = 'approved'
      order by created_at desc limit 100`;
    return rows.map(normReview);
  } catch (e) {
    console.error("reviews read failed", e);
    return [];
  }
}
