"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db, hasDb } from "@/lib/db";
import { audit } from "@/lib/admin";
import { aiConfigured, takeAiQuota, AI_HOURLY_LIMIT } from "@/lib/ai";
import { analyzeProductPhotos, parseStockWithAi, rewriteCopy, suggestPrice, type Analysis } from "@/lib/ai-product";
import { getAttributes, getCategoriesAll } from "@/lib/catalog";
import { imageStorageReady, uploadProductImage } from "@/lib/storage";
import { getProductById, listProducts, saveProduct, type ProductInput } from "@/lib/store";
import { parseStockText } from "@/lib/stock-parse";
import { normVariants, type Variants } from "@/lib/variants";
import { shekel } from "@/lib/config";
import { slugify } from "../shared";

const MAX_PHOTOS = 6;

export type AnalyzeResult = {
  ok: boolean;
  error?: string;
  urls?: string[];
  analysis?: Analysis | null;
  aiError?: string;
  price?: { price: number | null; basis: string };
};

async function quota(userId: number): Promise<string | null> {
  const q = await takeAiQuota(userId);
  return q.ok ? null : `הגעת למגבלה של ${AI_HOURLY_LIMIT} בקשות AI בשעה. אפשר להמשיך ולמלא ידנית.`;
}

/** Look at the photos (already shrunk in the browser) and say what the product is. Nothing is stored yet. */
export async function analyzePhotosAction(fd: FormData): Promise<AnalyzeResult> {
  const me = await requireAdmin("products");
  if (!hasDb()) return { ok: false, error: "מסד הנתונים לא מחובר" };
  const files = fd.getAll("photos").filter((f): f is File => typeof f === "object" && f !== null && "size" in f && (f as File).size > 0).slice(0, MAX_PHOTOS);
  if (!files.length) return { ok: false, error: "צריך לפחות תמונה אחת" };
  const focus = Number(fd.get("focusProductId")) || null;
  const hint = String(fd.get("hint") || "").slice(0, 300);

  const [attrs, cats, products] = await Promise.all([getAttributes(), getCategoriesAll(), listProducts({ includeInactive: true })]);
  let analysis: Analysis | null = null;
  let aiError: string | undefined;
  if (!aiConfigured()) aiError = "ה־AI לא מחובר (חסר ANTHROPIC_API_KEY), אפשר למלא את הפרטים ידנית.";
  else {
    const limited = await quota(me.id);
    if (limited) aiError = limited;
    else {
      const images = await Promise.all(
        files.slice(0, 4).map(async (f) => ({ mediaType: f.type || "image/jpeg", data: Buffer.from(await f.arrayBuffer()).toString("base64") }))
      );
      const r = await analyzeProductPhotos({
        images,
        categories: cats.map((c) => ({ key: c.key, name: c.name })),
        colors: attrs.colors,
        products,
        hint,
        focusProductId: focus,
      });
      if (r.error) aiError = r.error;
      else analysis = r.data!;
    }
  }
  const matchId = analysis?.matchProductId ?? focus;
  const price = suggestPrice(products, analysis?.category || products.find((p) => p.id === focus)?.category || "boots", matchId);
  return { ok: true, urls: [], analysis, aiError, price };
}

/** Store the final photos (after the background step). */
export async function uploadPhotosAction(fd: FormData): Promise<{ urls?: string[]; error?: string }> {
  await requireAdmin("products");
  if (!imageStorageReady()) return { error: "אחסון התמונות עדיין לא מחובר, ולכן אי אפשר לשמור צילומים." };
  const files = fd.getAll("photos").filter((f): f is File => typeof f === "object" && f !== null && "size" in f && (f as File).size > 0).slice(0, MAX_PHOTOS);
  if (!files.length) return { error: "אין תמונות לשמירה" };
  try {
    return { urls: await Promise.all(files.map((f) => uploadProductImage(f))) };
  } catch (e: any) {
    console.error(e);
    const msg = String(e?.message || "");
    return { error: /^הקובץ/.test(msg) ? msg : "העלאת התמונות נכשלה. נסי שוב." };
  }
}

export async function rewriteAction(input: { title: string; description: string; tone: string; facts: string }): Promise<{ title?: string; description?: string; error?: string }> {
  const me = await requireAdmin("products");
  if (!aiConfigured()) return { error: "ה־AI לא מחובר" };
  const limited = await quota(me.id);
  if (limited) return { error: limited };
  const r = await rewriteCopy({ title: String(input?.title || ""), description: String(input?.description || ""), tone: String(input?.tone || "warm"), facts: String(input?.facts || "") });
  return r.error ? { error: r.error } : r.data!;
}

/** Free text (typed or dictated) → stock per colour per size. The quick parser first; the AI for the rest. */
export async function parseStockAction(input: { text: string; defaultColor: string }): Promise<{ stock?: Record<string, Record<string, number>>; source?: "local" | "ai"; error?: string }> {
  const me = await requireAdmin("products");
  const text = String(input?.text || "").slice(0, 800);
  if (!text.trim()) return { error: "אין טקסט" };
  const attrs = await getAttributes();
  const colors = attrs.colors.map((c) => ({ key: c.key, label: c.label }));
  const def = colors.some((c) => c.key === input?.defaultColor) ? input.defaultColor : colors[0]?.key || "black";
  const local = parseStockText(text, colors, attrs.sizes, def);
  if (local.total > 0 && !local.unknown.length) return { stock: local.stock, source: "local" };
  if (!aiConfigured()) return local.total ? { stock: local.stock, source: "local" } : { error: "לא הצלחתי להבין. נסי למשל: „שחור 38 חמש, 40 שלוש”" };
  const limited = await quota(me.id);
  if (limited) return local.total ? { stock: local.stock, source: "local" } : { error: limited };
  const r = await parseStockWithAi({ text, colors, sizes: attrs.sizes, defaultColor: def });
  if (r.error || !r.data || !Object.keys(r.data).length) return local.total ? { stock: local.stock, source: "local" } : { error: r.error || "לא הצלחתי להבין את הכמויות" };
  return { stock: r.data, source: "ai" };
}

/* ---------------- save ---------------- */

export type CreatePayload = {
  mode: "new" | "addColor";
  matchId?: number | null;
  color: string;
  images: string[];
  stock: Record<string, Record<string, number>>;
  name: string;
  description: string;
  seoTitle?: string;
  seoDescription?: string;
  category: string;
  heel: number | null;
  price: number;
  cost?: number | null;
  publish: boolean;
};

async function uniqueSlug(base: string): Promise<string> {
  const sql = await db();
  const b = base || "p-" + Date.now().toString(36);
  const taken = await sql`select slug from products where slug = ${b} or slug like ${b + "-%"}`;
  const set = new Set(taken.map((r: any) => String(r.slug)));
  let slug = b;
  for (let i = 2; set.has(slug); i++) slug = `${b}-${i}`;
  return slug;
}

const cleanStock = (s: Record<string, Record<string, number>>, allowed: Set<string>, sizes: string[]) => {
  const out: Record<string, Record<string, number>> = {};
  for (const [c, row] of Object.entries(s || {})) {
    if (!allowed.has(c) || !row || typeof row !== "object") continue;
    for (const [size, q] of Object.entries(row)) {
      const n = Math.round(Number(q));
      if (!(sizes.includes(String(size)) || /^\d{2}(\.5)?$/.test(String(size))) || !Number.isFinite(n) || n <= 0) continue;
      out[c] = out[c] || {};
      out[c][String(size)] = Math.min(9999, n);
    }
  }
  return out;
};

export async function createFromAiAction(p: CreatePayload): Promise<{ ok?: boolean; id?: number; error?: string }> {
  await requireAdmin("products");
  if (!hasDb()) return { error: "מסד הנתונים לא מחובר" };
  const [attrs, cats] = await Promise.all([getAttributes(), getCategoriesAll()]);
  const colorKeys = new Set(attrs.colors.map((c) => c.key));
  const color = colorKeys.has(p?.color) ? p.color : "";
  if (!color) return { error: "יש לבחור צבע" };
  const images = (Array.isArray(p?.images) ? p.images : []).map(String).filter((u) => /^(https?:\/\/|\/)/.test(u)).slice(0, MAX_PHOTOS);
  const stock = cleanStock(p?.stock || {}, colorKeys, attrs.sizes);
  const price = Math.round(Number(p?.price));
  const heel = p?.heel === null || p?.heel === undefined || (p.heel as any) === "" ? null : Math.max(0, Math.min(30, Math.round(Number(p.heel))));
  const cost = p?.cost === null || p?.cost === undefined || (p.cost as any) === "" ? null : Math.max(0, Math.round(Number(p.cost)));

  /* ---- a new colour (and/or stock) for an existing model ---- */
  if (p?.mode === "addColor") {
    const target = await getProductById(Number(p.matchId));
    if (!target) return { error: "הדגם הקיים לא נמצא" };
    // a simple product becomes a variant product: its own colour keeps its images and stock
    let v: Variants = target.variants
      ? JSON.parse(JSON.stringify(target.variants))
      : { colors: [{ key: target.color, images: target.baseImages ?? target.images }], stock: { [target.color]: { ...target.stock } } };
    const shared = target.variants ? target.baseImages ?? [] : [];
    const ensure = (k: string) => {
      if (!v.colors.some((c) => c.key === k)) v.colors.push({ key: k, images: [] });
      v.stock[k] = v.stock[k] || {};
    };
    ensure(color);
    const row = v.colors.find((c) => c.key === color)!;
    row.images = Array.from(new Set([...images, ...row.images]));
    // stock that arrived now is added to what the model already has
    for (const [c, sizes] of Object.entries(stock)) {
      ensure(c);
      for (const [s, q] of Object.entries(sizes)) v.stock[c][s] = (Number(v.stock[c][s]) || 0) + q;
    }
    const nv = normVariants(v);
    if (!nv) return { error: "לא הצלחתי לבנות את הצבעים" };
    const { id: _i, created_at: _c, updated_at: _u, ...rest } = target;
    const input: ProductInput = { ...rest, variants: nv, baseImages: shared, images: shared };
    try {
      await saveProduct(target.id, input);
    } catch (e) {
      console.error(e);
      return { error: "השמירה נכשלה. נסי שוב." };
    }
    const added = Object.values(stock).reduce((a, r) => a + Object.values(r).reduce((x, y) => x + y, 0), 0);
    await audit({
      action: "update",
      entity: "product",
      entityId: target.id,
      summary: `הוספה מהירה עם AI – ${target.name}: צבע ${attrs.colors.find((c) => c.key === color)?.label || color}${images.length ? `, ${images.length} תמונות` : ""}${added ? `, +${added} יח׳` : ""}`,
      before: { variants: target.variants || null, stock: target.stock },
      after: { variants: nv },
    });
    revalidatePath("/", "layout");
    revalidatePath("/admin/products");
    return { ok: true, id: target.id };
  }

  /* ---- a new product ---- */
  const name = String(p?.name || "").trim().slice(0, 160);
  if (!name) return { error: "יש לתת שם למוצר" };
  if (!Number.isFinite(price) || price <= 0) return { error: "יש להזין מחיר" };
  const category = cats.some((c) => c.key === p?.category) ? p.category : "boots";
  const colorsInStock = Object.keys(stock);
  const multi = colorsInStock.some((c) => c !== color);
  const variants: Variants | null = multi
    ? normVariants({
        colors: [{ key: color, images }, ...colorsInStock.filter((c) => c !== color).map((c) => ({ key: c, images: [] }))],
        stock,
      })
    : null;
  const input: ProductInput = {
    slug: await uniqueSlug(slugify(name)),
    name,
    description: String(p?.description || "").trim().slice(0, 4000),
    price,
    old_price: null,
    cost,
    heel,
    color,
    category,
    images: multi ? [] : images,
    baseImages: multi ? [] : images,
    stock: stock[color] || {},
    variants,
    low_stock: 2,
    featured: false,
    active: !!p?.publish,
    sort: 100,
    sku: "",
    seo_title: String(p?.seoTitle || "").trim().slice(0, 120),
    seo_description: String(p?.seoDescription || "").trim().slice(0, 320),
  };
  let id: number;
  try {
    id = await saveProduct(null, input);
  } catch (e) {
    console.error(e);
    return { error: "השמירה נכשלה. נסי שוב." };
  }
  const pairs = Object.values(stock).reduce((a, r) => a + Object.values(r).reduce((x, y) => x + y, 0), 0);
  await audit({
    action: "create",
    entity: "product",
    entityId: id,
    summary: `מוצר חדש בהוספה מהירה עם AI: ${name} (${shekel(price)}, ${pairs} יח׳${multi ? `, ${colorsInStock.length} צבעים` : ""})${input.active ? "" : " · טיוטה"}`,
    after: { name, slug: input.slug, price, active: input.active },
  });
  revalidatePath("/", "layout");
  revalidatePath("/admin/products");
  return { ok: true, id };
}
