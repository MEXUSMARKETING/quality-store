"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { imageStorageReady, uploadProductImage } from "@/lib/storage";
import { requireAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { audit } from "@/lib/admin";
import { shekel } from "@/lib/config";
import { getAttributes, getCategoriesAll } from "@/lib/catalog";
import { bulkUpdateProducts, deleteProduct, duplicateProduct, getProductById, saveProduct, type BulkProductOp, type ProductInput } from "@/lib/store";
import type { Product } from "@/lib/types";
import { slugify } from "./shared";
import { aggregateStock, colorTotal, normVariants, type Variants } from "@/lib/variants";

export type SaveState = { error?: string; tab?: string } | null;

const NO_DB = "מסד הנתונים לא מחובר, ולכן אי אפשר לשמור שינויים. יש לחבר Neon Postgres ב־Vercel ולפרוס מחדש.";

/** Integer from a form value; null when empty, NaN when not a whole non-negative number */
const int = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? "").trim().replace(/,/g, "");
  if (!s) return null;
  if (!/^[0-9]+$/.test(s)) return NaN;
  return Number(s);
};
const bad = (n: number | null) => n !== null && !Number.isFinite(n);

function revalidateProduct(slug?: string) {
  revalidatePath("/", "layout");
  revalidatePath("/admin/products");
  if (slug) revalidatePath(`/product/${slug}`);
}

/* ---------------- change summary for the audit log ---------------- */

const LABELS: Partial<Record<keyof ProductInput, string>> = {
  name: "שם",
  slug: "כתובת",
  sku: "מק״ט",
  description: "תיאור",
  category: "קטגוריה",
  color: "צבע",
  heel: "גובה עקב",
  sort: "סדר תצוגה",
  featured: "מומלץ",
  active: "הצגה באתר",
  cost: "עלות",
  images: "תמונות",
  low_stock: "סף מלאי נמוך",
  seo_title: "כותרת SEO",
  seo_description: "תיאור SEO",
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const normStock = (s: Record<string, number>) => Object.fromEntries(Object.keys(s || {}).sort().filter((k) => Number(s?.[k]) > 0).map((k) => [k, Number(s[k])]));
const money = (n: number | null | undefined) => (n === null || n === undefined ? "—" : shekel(n));

async function auditChanges(id: number, before: Product | null, after: ProductInput) {
  if (!before) {
    await audit({
      action: "create",
      entity: "product",
      entityId: id,
      summary: `נוצר מוצר חדש: ${after.name} (${shekel(after.price)})`,
      after: { name: after.name, slug: after.slug, price: after.price, active: after.active },
    });
    return;
  }

  if (before.price !== after.price || !same(before.old_price, after.old_price)) {
    const parts: string[] = [];
    if (before.price !== after.price) parts.push(`${shekel(before.price)} ← ${shekel(after.price)}`);
    if (!same(before.old_price, after.old_price)) parts.push(`מחיר לפני הנחה ${money(before.old_price)} ← ${money(after.old_price)}`);
    await audit({
      action: "price",
      entity: "product",
      entityId: id,
      summary: `שינוי מחיר – ${after.name}: ${parts.join(", ")}`,
      before: { price: before.price, old_price: before.old_price },
      after: { price: after.price, old_price: after.old_price },
    });
  }

  const sb = normStock(before.stock);
  const sa = normStock(after.stock);
  if (!same(sb, sa)) {
    const keys = Array.from(new Set([...Object.keys(sb), ...Object.keys(sa)])).sort((x, y) => (parseFloat(x) || 0) - (parseFloat(y) || 0));
    const diffs = keys.filter((s) => (sb[s] || 0) !== (sa[s] || 0)).map((s) => `${s}: ${sb[s] || 0}→${sa[s] || 0}`);
    const tb = Object.values(sb).reduce((a, b) => a + b, 0);
    const ta = Object.values(sa).reduce((a, b) => a + b, 0);
    await audit({
      action: "stock",
      entity: "product",
      entityId: id,
      summary: `עדכון מלאי – ${after.name}: ${diffs.join(", ")} (סה״כ ${tb}→${ta})`,
      before: { stock: sb },
      after: { stock: sa },
    });
  }

  // colours × sizes: one readable line per colour
  const vb = before.variants || null;
  const va = after.variants || null;
  if (!same(vb, va)) {
    const line = (v: Variants | null) => (v ? v.colors.map((c) => `${c.key}: ${colorTotal(v, c.key)}`).join(", ") : "צבע אחד");
    await audit({
      action: "stock",
      entity: "product",
      entityId: id,
      summary: `צבעים ומלאי לפי צבע – ${after.name}: ${line(vb)} ← ${line(va)}`,
      before: { variants: vb },
      after: { variants: va },
    });
  }

  const val = (p: any, k: keyof ProductInput) => {
    const v = p[k];
    if (v === undefined || v === null) return k === "sku" || k === "seo_title" || k === "seo_description" ? "" : null;
    return v;
  };
  const changed = (Object.keys(LABELS) as (keyof ProductInput)[]).filter((k) => !same(val(before, k), val(after, k)));
  if (changed.length) {
    const b: Record<string, unknown> = {};
    const a: Record<string, unknown> = {};
    for (const k of changed) {
      if (k === "description" || k === "seo_description") continue; // long text: label only
      b[k] = (before as any)[k] ?? null;
      a[k] = (after as any)[k] ?? null;
    }
    await audit({
      action: "update",
      entity: "product",
      entityId: id,
      summary: `עודכן ${after.name}: ${changed.map((k) => LABELS[k]).join(", ")}`,
      before: b,
      after: a,
    });
  }
}

/* ---------------- save (create / update) ---------------- */

export async function saveProductAction(_: SaveState, fd: FormData): Promise<SaveState> {
  await requireAdmin("products");
  if (!hasDb()) return { error: NO_DB };

  const id = int(fd.get("id"));
  const before = id ? await getProductById(id) : null;
  if (id && !before) return { error: "המוצר לא נמצא – ייתכן שנמחק בינתיים" };

  const name = String(fd.get("name") || "").trim().slice(0, 160);
  if (!name) return { error: "יש להזין שם מוצר", tab: "general" };
  const slug = slugify(String(fd.get("slug") || "")) || slugify(name) || "p-" + Date.now().toString(36);

  const price = int(fd.get("price"));
  if (price === null || bad(price)) return { error: "יש להזין מחיר בשקלים שלמים (מספר ללא נקודה)", tab: "price" };
  const old_price = int(fd.get("old_price"));
  if (bad(old_price)) return { error: "המחיר לפני הנחה חייב להיות מספר שלם", tab: "price" };
  const cost = int(fd.get("cost"));
  if (bad(cost)) return { error: "העלות חייבת להיות מספר שלם", tab: "price" };
  const heel = int(fd.get("heel"));
  if (bad(heel) || (heel !== null && heel > 30)) return { error: "גובה העקב צריך להיות מספר שלם בס״מ (0–30)", tab: "general" };
  const sortRaw = String(fd.get("sort") ?? "").trim();
  const sort = sortRaw === "" ? 100 : /^-?[0-9]+$/.test(sortRaw) ? Number(sortRaw) : NaN;
  if (!Number.isFinite(sort)) return { error: "סדר התצוגה חייב להיות מספר שלם", tab: "general" };
  const low_stock = int(fd.get("low_stock"));
  if (bad(low_stock)) return { error: "סף המלאי הנמוך חייב להיות מספר שלם", tab: "stock" };

  const [attrs, cats] = await Promise.all([getAttributes(), getCategoriesAll()]);
  // configured sizes + any other size the editor sent (a size removed from the list that still had stock)
  const sentSizes = Array.from(fd.keys()).filter((k) => k.startsWith("stock_")).map((k) => k.slice(6)).filter((k) => k && k.length <= 10);
  const stock: Record<string, number> = {};
  for (const s of Array.from(new Set([...attrs.sizes, ...sentSizes]))) {
    const q = int(fd.get(`stock_${s}`));
    if (bad(q)) return { error: `הכמות במידה ${s} חייבת להיות מספר שלם`, tab: "stock" };
    if (q && q > 0) stock[s] = Math.min(q, 9999);
  }

  // images: existing list in the order chosen in the editor (first = main), then uploads, then a pasted URL
  const images = fd.getAll("image").map((v) => String(v).trim()).filter(Boolean);
  const files = fd.getAll("files").filter((f): f is File => typeof f === "object" && f !== null && "size" in f && (f as File).size > 0);
  if (files.length) {
    if (!imageStorageReady()) {
      return { error: "אחסון התמונות עדיין לא מחובר (Supabase Storage). בינתיים אפשר להדביק קישור לתמונה.", tab: "images" };
    }
    for (const f of files) {
      try {
        images.push(await uploadProductImage(f));
      } catch (e: any) {
        console.error(e);
        const msg = String(e?.message || "");
        if (/^הקובץ/.test(msg)) return { error: msg, tab: "images" };
        return { error: "העלאת התמונות נכשלה. נסי שוב, או הדביקי קישור לתמונה.", tab: "images" };
      }
    }
  }
  const url = String(fd.get("imageUrl") || "").trim();
  if (url) {
    if (!/^(https?:\/\/|\/)/.test(url)) return { error: "קישור התמונה צריך להתחיל ב־https://", tab: "images" };
    images.push(url);
  }

  // variants: colours × sizes (validated colours, per-colour uploads)
  let variants: Variants | null = null;
  if (fd.get("variants_on") === "1") {
    let raw: any;
    try {
      raw = JSON.parse(String(fd.get("variants") || "{}"));
    } catch {
      return { error: "נתוני הצבעים לא תקינים. רענני את הדף ונסי שוב.", tab: "stock" };
    }
    const known = (k: string) => attrs.colors.some((c) => c.key === k) || !!before?.variants?.colors.some((c) => c.key === k);
    raw.colors = (Array.isArray(raw?.colors) ? raw.colors : []).filter((c: any) => known(String(c?.key || "")));
    for (const c of raw.colors) {
      const vf = fd.getAll(`vfiles_${c.key}`).filter((f): f is File => typeof f === "object" && f !== null && "size" in f && (f as File).size > 0);
      if (!vf.length) continue;
      if (!imageStorageReady()) return { error: "אחסון התמונות עדיין לא מחובר. בינתיים אפשר להדביק קישור לתמונה של הצבע.", tab: "stock" };
      c.images = Array.isArray(c.images) ? c.images : [];
      for (const f of vf) {
        try {
          c.images.push(await uploadProductImage(f));
        } catch (e: any) {
          console.error(e);
          const msg = String(e?.message || "");
          return { error: /^הקובץ/.test(msg) ? msg : "העלאת תמונות הצבע נכשלה. נסי שוב.", tab: "stock" };
        }
      }
    }
    variants = normVariants(raw);
    if (!variants) return { error: "במצב „כמה צבעים” צריך לבחור לפחות צבע אחד", tab: "stock" };
  }

  const color = variants ? variants.colors[0].key : String(fd.get("color") || before?.color || "black");
  const category = String(fd.get("category") || "boots");

  const input: ProductInput = {
    slug,
    name,
    sku: String(fd.get("sku") || "").trim().slice(0, 60),
    description: String(fd.get("description") || "").trim(),
    price,
    old_price: old_price && old_price > 0 ? old_price : null,
    cost,
    heel,
    color: attrs.colors.some((c) => c.key === color) || color === before?.color ? color : attrs.colors.some((c) => c.key === "other") ? "other" : attrs.colors[0].key,
    category: cats.some((c) => c.key === category) || category === before?.category ? category : "boots",
    images: Array.from(new Set(images)),
    baseImages: Array.from(new Set(images)),
    stock: variants ? aggregateStock(variants) : stock,
    variants,
    low_stock: low_stock ?? 2,
    featured: fd.get("featured") === "on",
    active: fd.get("active") === "on",
    sort,
    seo_title: String(fd.get("seo_title") || "").trim().slice(0, 120),
    seo_description: String(fd.get("seo_description") || "").trim().slice(0, 320),
  };

  let newId: number;
  try {
    newId = await saveProduct(before ? before.id : null, input);
  } catch (e: any) {
    if (String(e?.message || "").includes("duplicate key")) return { error: "הכתובת (slug) הזו כבר בשימוש במוצר אחר – בחרי כתובת אחרת", tab: "general" };
    console.error(e);
    return { error: "השמירה נכשלה. נסי שוב בעוד רגע." };
  }

  await auditChanges(newId, before, input);
  revalidateProduct(input.slug);
  if (before && before.slug !== input.slug) revalidatePath(`/product/${before.slug}`);
  redirect(`/admin/products/${newId}?saved=1`);
}

/* ---------------- delete / duplicate ---------------- */

export async function deleteProductAction(fd: FormData) {
  await requireAdmin("products");
  if (!hasDb()) redirect("/admin/products");
  const id = int(fd.get("id"));
  if (id && Number.isFinite(id)) {
    const p = await getProductById(id);
    if (p) {
      await deleteProduct(id);
      await audit({ action: "delete", entity: "product", entityId: id, summary: `נמחק מוצר: ${p.name}`, before: { name: p.name, slug: p.slug, price: p.price, stock: p.stock } });
      revalidateProduct(p.slug);
    }
  }
  redirect("/admin/products?deleted=1");
}

export async function duplicateProductAction(fd: FormData) {
  await requireAdmin("products");
  if (!hasDb()) redirect("/admin/products");
  const id = int(fd.get("id"));
  if (!id || !Number.isFinite(id)) redirect("/admin/products");
  const src = await getProductById(id);
  const copy = await duplicateProduct(id);
  if (!src || !copy) redirect("/admin/products");
  await audit({ action: "create", entity: "product", entityId: copy.id, summary: `שוכפל מוצר: ${src.name} ← עותק מוסתר (${copy.slug})`, after: { from: src.id, slug: copy.slug } });
  revalidatePath("/admin/products");
  redirect(`/admin/products/${copy.id}?duplicated=1`);
}

/* ---------------- bulk ---------------- */

const BULK: Record<BulkProductOp, { past: string }> = {
  show: { past: "הוצגו באתר" },
  hide: { past: "הוסתרו מהאתר" },
  feature: { past: "סומנו כמומלצים" },
  delete: { past: "נמחקו" },
};

export async function bulkProducts(ids: number[], op: string): Promise<{ ok?: string; error?: string }> {
  await requireAdmin("products");
  if (!hasDb()) return { error: NO_DB };
  if (!(op in BULK)) return { error: "פעולה לא מוכרת" };
  if (!Array.isArray(ids) || !ids.length) return { error: "לא נבחרו מוצרים" };
  if (ids.length > 500) return { error: "אפשר לבחור עד 500 מוצרים בכל פעולה" };
  const rows = await bulkUpdateProducts(ids, op as BulkProductOp);
  if (!rows.length) return { error: "המוצרים שנבחרו לא נמצאו" };
  const names = rows.map((r) => r.name);
  await audit({
    action: op === "delete" ? "delete" : "bulk",
    entity: "product",
    entityId: rows.map((r) => r.id).join(","),
    summary: `פעולה מרוכזת: ${rows.length} מוצרים ${BULK[op as BulkProductOp].past} (${names.slice(0, 5).join(", ")}${names.length > 5 ? ` ועוד ${names.length - 5}` : ""})`,
    after: { op, ids: rows.map((r) => r.id) },
  });
  revalidateProduct();
  return { ok: `${rows.length} מוצרים ${BULK[op as BulkProductOp].past}` };
}
