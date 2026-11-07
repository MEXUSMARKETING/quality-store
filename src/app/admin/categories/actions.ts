"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db, hasDb } from "@/lib/db";
import { audit } from "@/lib/admin";
import { imageStorageReady, uploadProductImage } from "@/lib/storage";
import { CATEGORY_KEY_RE, DEFAULT_CATEGORY, descendantKeys, listAllCategories, type Category } from "@/lib/catalog";

export type CatState = { error?: string; ok?: string } | null;

const NO_DB = "מסד הנתונים לא מחובר, ולכן אי אפשר לשמור שינויים.";

const str = (fd: FormData, k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);

/** Lowercase latin key from free text ("Ankle Boots" → "ankle-boots"); "" when nothing latin is left. */
function toKey(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function revalidateCatalog(extra: string[] = []) {
  revalidatePath("/", "layout");
  revalidatePath("/shop");
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  for (const p of extra) revalidatePath(p);
}

async function urlOrUpload(fd: FormData, field: string, fileField: string): Promise<{ url?: string; error?: string }> {
  const f = fd.get(fileField);
  if (f && typeof f === "object" && "size" in f && (f as File).size > 0) {
    if (!imageStorageReady()) return { error: "אחסון התמונות עדיין לא מחובר. בינתיים אפשר להדביק קישור לתמונה." };
    try {
      return { url: await uploadProductImage(f as File) };
    } catch (e: any) {
      const msg = String(e?.message || "");
      return { error: /^הקובץ/.test(msg) ? msg : "העלאת התמונה נכשלה. נסי שוב או הדביקי קישור." };
    }
  }
  const url = str(fd, field, 600);
  if (url && !/^(https?:\/\/|\/)/.test(url)) return { error: "קישור לתמונה צריך להתחיל ב־https://" };
  return { url };
}

const snap = (c: Category) => ({
  key: c.key, name: c.name, parent: c.parent, active: c.active, featured: c.featured, sort: c.sort,
  image: c.image, banner: c.banner, seo_title: c.seo_title,
});

/* ---------------- create / update (side panel) ---------------- */

export async function saveCategoryAction(_: CatState, fd: FormData): Promise<CatState> {
  await requireAdmin("categories");
  if (!hasDb()) return { error: NO_DB };

  const orig = str(fd, "orig", 60);
  const all = await listAllCategories();
  const before = orig ? all.find((c) => c.key === orig) : undefined;
  if (orig && !before) return { error: "הקטגוריה לא נמצאה – ייתכן שנמחקה בינתיים" };

  const name = str(fd, "name", 80);
  if (!name) return { error: "יש להזין שם לקטגוריה" };
  const key = toKey(str(fd, "key", 60)) || (before ? before.key : toKey(name));
  if (!key || !CATEGORY_KEY_RE.test(key)) return { error: "יש להזין מפתח (slug) באותיות לטיניות קטנות, ספרות ומקפים – למשל ankle-boots" };
  if (before && before.key === DEFAULT_CATEGORY && key !== DEFAULT_CATEGORY) return { error: "אי אפשר לשנות את המפתח של קטגוריית ברירת המחדל (boots) – עמוד החנות הראשי מבוסס עליה" };
  if (key !== orig && all.some((c) => c.key === key)) return { error: `המפתח "${key}" כבר בשימוש בקטגוריה אחרת` };

  const parentRaw = str(fd, "parent", 60);
  const parent = parentRaw || null;
  if (parent) {
    if (!all.some((c) => c.key === parent)) return { error: "קטגוריית האב שנבחרה לא קיימת" };
    if (before && descendantKeys(all, before.key).includes(parent)) return { error: "אי אפשר לשייך קטגוריה לעצמה או לתת־קטגוריה שלה" };
  }

  if ((before?.key === DEFAULT_CATEGORY || key === DEFAULT_CATEGORY) && fd.get("active") !== "on") return { error: "קטגוריית ברירת המחדל (boots) היא עמוד החנות הראשי ולא ניתן להסתיר אותה" };

  const img = await urlOrUpload(fd, "image", "image_file");
  if (img.error) return { error: img.error };
  const ban = await urlOrUpload(fd, "banner", "banner_file");
  if (ban.error) return { error: ban.error };

  const data = {
    name,
    parent,
    description: str(fd, "description", 2000),
    image: img.url || "",
    banner: ban.url || "",
    seo_title: str(fd, "seo_title", 120),
    seo_description: str(fd, "seo_description", 320),
    active: fd.get("active") === "on",
    featured: fd.get("featured") === "on",
  };

  const sql = await db();
  let movedProducts = 0;
  try {
    if (!before) {
      const siblings = all.filter((c) => (c.parent || null) === parent);
      const sort = siblings.length ? Math.max(...siblings.map((c) => c.sort)) + 10 : 10;
      await sql`
        insert into categories (key, name, parent, description, image, banner, sort, active, featured, seo_title, seo_description)
        values (${key}, ${data.name}, ${data.parent}, ${data.description}, ${data.image}, ${data.banner}, ${sort}, ${data.active}, ${data.featured}, ${data.seo_title}, ${data.seo_description})`;
    } else {
      // parent changed → put it at the end of its new siblings
      const sortNext = (before.parent || null) !== parent
        ? Math.max(0, ...all.filter((c) => (c.parent || null) === parent && c.key !== before.key).map((c) => c.sort)) + 10
        : before.sort;
      await sql.begin(async (tx: any) => {
        await tx`
          update categories set key = ${key}, name = ${data.name}, parent = ${data.parent}, description = ${data.description},
            image = ${data.image}, banner = ${data.banner}, sort = ${sortNext}, active = ${data.active}, featured = ${data.featured},
            seo_title = ${data.seo_title}, seo_description = ${data.seo_description}, updated_at = now()
          where key = ${before.key}`;
        if (key !== before.key) {
          await tx`update categories set parent = ${key}, updated_at = now() where parent = ${before.key}`;
          const r = await tx`update products set category = ${key}, updated_at = now() where category = ${before.key} returning id`;
          movedProducts = r.length;
        }
      });
    }
  } catch (e: any) {
    if (String(e?.message || "").includes("duplicate key")) return { error: `המפתח "${key}" כבר בשימוש` };
    console.error(e);
    return { error: "השמירה נכשלה. נסי שוב בעוד רגע." };
  }

  const after = { key, ...data };
  if (!before) {
    await audit({ action: "create", entity: "category", entityId: key, summary: `נוצרה קטגוריה: ${name}${parent ? ` (תחת ${all.find((c) => c.key === parent)?.name || parent})` : ""}`, after });
  } else {
    const changes: string[] = [];
    if (before.name !== name) changes.push(`שם "${before.name}" ← "${name}"`);
    if (before.key !== key) changes.push(`מפתח ${before.key} ← ${key}${movedProducts ? ` (${movedProducts} מוצרים עודכנו)` : ""}`);
    if ((before.parent || null) !== parent) changes.push("קטגוריית אב");
    if (before.description !== data.description) changes.push("תיאור");
    if (before.image !== data.image) changes.push("תמונה");
    if (before.banner !== data.banner) changes.push("באנר");
    if (before.seo_title !== data.seo_title || before.seo_description !== data.seo_description) changes.push("SEO");
    if (before.active !== data.active) changes.push(data.active ? "הופעלה" : "הושבתה");
    if (before.featured !== data.featured) changes.push(data.featured ? "סומנה כמומלצת" : "הוסר סימון מומלצת");
    await audit({ action: "update", entity: "category", entityId: key, summary: `עודכנה קטגוריה ${name}: ${changes.join(", ") || "ללא שינוי"}`, before: snap(before), after });
  }

  revalidateCatalog();
  const view = str(fd, "view", 10) === "table" ? "&view=table" : "";
  redirect(`/admin/categories?edit=${encodeURIComponent(key)}&saved=1${view}`);
}

/* ---------------- inline add sub-category ---------------- */

export async function addSubcategoryAction(_: CatState, fd: FormData): Promise<CatState> {
  await requireAdmin("categories");
  if (!hasDb()) return { error: NO_DB };
  const all = await listAllCategories();
  const parent = str(fd, "parent", 60) || null;
  if (parent && !all.some((c) => c.key === parent)) return { error: "קטגוריית האב לא נמצאה" };
  const name = str(fd, "name", 80);
  if (!name) return { error: "יש להזין שם" };
  const key = toKey(str(fd, "key", 60)) || toKey(name);
  if (!key) return { error: "יש להזין מפתח באנגלית (למשל ankle-boots)" };
  if (all.some((c) => c.key === key)) return { error: `המפתח "${key}" כבר בשימוש` };
  const siblings = all.filter((c) => (c.parent || null) === parent);
  const sort = siblings.length ? Math.max(...siblings.map((c) => c.sort)) + 10 : 10;
  const sql = await db();
  try {
    await sql`insert into categories (key, name, parent, sort) values (${key}, ${name}, ${parent}, ${sort})`;
  } catch (e: any) {
    if (String(e?.message || "").includes("duplicate key")) return { error: `המפתח "${key}" כבר בשימוש` };
    console.error(e);
    return { error: "ההוספה נכשלה" };
  }
  await audit({ action: "create", entity: "category", entityId: key, summary: `נוספה ${parent ? "תת־קטגוריה" : "קטגוריה"}: ${name}${parent ? ` תחת ${all.find((c) => c.key === parent)?.name}` : ""}`, after: { key, name, parent } });
  revalidateCatalog();
  return { ok: `"${name}" נוספה` };
}

/* ---------------- quick toggles & sorting (tree / table rows) ---------------- */

export async function toggleCategoryAction(fd: FormData) {
  await requireAdmin("categories");
  if (!hasDb()) return;
  const key = str(fd, "key", 60);
  const field = str(fd, "field", 20);
  if (field !== "active" && field !== "featured") return;
  const sql = await db();
  const r = await sql`select name, active, featured from categories where key = ${key}`;
  if (!r[0]) return;
  const now = !r[0][field];
  if (field === "active" && !now && key === DEFAULT_CATEGORY) return; // the main /shop page must stay visible
  if (field === "active") await sql`update categories set active = ${now}, updated_at = now() where key = ${key}`;
  else await sql`update categories set featured = ${now}, updated_at = now() where key = ${key}`;
  await audit({
    action: field === "active" ? "status" : "update",
    entity: "category",
    entityId: key,
    summary: field === "active" ? `קטגוריה ${r[0].name} ${now ? "הופעלה באתר" : "הוסתרה מהאתר"}` : `קטגוריה ${r[0].name} ${now ? "סומנה כמומלצת" : "הוסר סימון מומלצת"}`,
    before: { [field]: !now },
    after: { [field]: now },
  });
  revalidateCatalog();
}

export async function moveCategoryAction(fd: FormData) {
  await requireAdmin("categories");
  if (!hasDb()) return;
  const key = str(fd, "key", 60);
  const dir = str(fd, "dir", 4) === "up" ? -1 : 1;
  const all = await listAllCategories();
  const me = all.find((c) => c.key === key);
  if (!me) return;
  const sibs = all.filter((c) => (c.parent || null) === (me.parent || null)); // already sorted by orderTree
  const i = sibs.findIndex((c) => c.key === key);
  const j = i + dir;
  if (j < 0 || j >= sibs.length) return;
  const order = sibs.map((c) => c.key);
  [order[i], order[j]] = [order[j], order[i]];
  const sql = await db();
  await sql.begin(async (tx: any) => {
    for (let k = 0; k < order.length; k++) await tx`update categories set sort = ${(k + 1) * 10}, updated_at = now() where key = ${order[k]}`;
  });
  await audit({ action: "update", entity: "category", entityId: key, summary: `שינוי סדר: ${me.name} הוזזה ${dir < 0 ? "למעלה" : "למטה"}`, before: { order: sibs.map((c) => c.key) }, after: { order } });
  revalidateCatalog();
}

/* ---------------- delete ---------------- */

export async function deleteCategoryAction(_: CatState, fd: FormData): Promise<CatState> {
  await requireAdmin("categories");
  if (!hasDb()) return { error: NO_DB };
  const key = str(fd, "key", 60);
  const moveTo = str(fd, "move_to", 60);
  if (key === DEFAULT_CATEGORY) return { error: "אי אפשר למחוק את קטגוריית ברירת המחדל (boots). אפשר לשנות לה שם." };
  const all = await listAllCategories();
  const me = all.find((c) => c.key === key);
  if (!me) return { error: "הקטגוריה לא נמצאה" };
  if (me.count > 0) {
    if (!moveTo) return { error: `יש ${me.count} מוצרים בקטגוריה הזו. בחרי לאן להעביר אותם לפני המחיקה.` };
    if (moveTo === key || !all.some((c) => c.key === moveTo)) return { error: "קטגוריית היעד להעברת המוצרים לא תקינה" };
  }
  const sql = await db();
  let moved = 0;
  try {
    await sql.begin(async (tx: any) => {
      if (me.count > 0) {
        const r = await tx`update products set category = ${moveTo}, updated_at = now() where category = ${key} returning id`;
        moved = r.length;
      }
      // sub-categories move up one level
      await tx`update categories set parent = ${me.parent}, updated_at = now() where parent = ${key}`;
      await tx`delete from categories where key = ${key}`;
    });
  } catch (e) {
    console.error(e);
    return { error: "המחיקה נכשלה. נסי שוב." };
  }
  const target = all.find((c) => c.key === moveTo);
  await audit({
    action: "delete",
    entity: "category",
    entityId: key,
    summary: `נמחקה קטגוריה: ${me.name}${moved ? ` · ${moved} מוצרים הועברו ל"${target?.name || moveTo}"` : ""}`,
    before: snap(me),
    after: moved ? { moved_products: moved, move_to: moveTo } : null,
  });
  revalidateCatalog();
  redirect("/admin/categories?deleted=1");
}
