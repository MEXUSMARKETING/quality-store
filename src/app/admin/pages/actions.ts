"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db, hasDb } from "@/lib/db";
import { audit } from "@/lib/admin";
import { imageStorageReady, uploadProductImage } from "@/lib/storage";
import { getPageById, israelLocalToUtc, normalizeBlocks, safeImage, SLUG_RE, type CmsPage } from "@/lib/content";

export type PageFormState = { error?: string; field?: string; ok?: boolean; id?: number; savedAt?: string } | null;

const NO_DB = "מסד הנתונים לא מחובר, לא ניתן לשמור דפים כרגע";
const RESERVED = new Set(["admin", "api", "shop", "cart", "checkout", "order", "product", "info", "new"]);

const snap = (p: Partial<CmsPage>) => ({
  slug: p.slug,
  title: p.title,
  type: p.type,
  status: p.status,
  publish_at: p.publish_at,
  seo_title: p.seo_title,
  seo_description: p.seo_description,
  share_image: p.share_image,
  blocks: Array.isArray(p.blocks) ? p.blocks.length : undefined,
});

function diff(a: Record<string, unknown>, b: Record<string, unknown>) {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const k of Object.keys(b)) {
    if (JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)) {
      before[k] = a[k] ?? null;
      after[k] = b[k] ?? null;
    }
  }
  return { before, after, changed: Object.keys(after).length > 0 };
}

const revalidatePage = (slug?: string, oldSlug?: string) => {
  revalidatePath("/admin/pages");
  revalidatePath("/", "layout");
  if (slug) revalidatePath(`/info/${slug}`);
  if (oldSlug && oldSlug !== slug) revalidatePath(`/info/${oldSlug}`);
};

/** Create or update a page from the block editor. */
export async function savePageAction(_: PageFormState, fd: FormData): Promise<PageFormState> {
  await requireAdmin("pages");
  if (!hasDb()) return { error: NO_DB };

  const id = Number(fd.get("id")) || null;
  const title = String(fd.get("title") || "").trim().slice(0, 160);
  const slug = String(fd.get("slug") || "").trim().toLowerCase().slice(0, 80);
  const type = fd.get("type") === "blog" ? "blog" : "page";
  const statusRaw = String(fd.get("status") || "draft");
  const status = (["draft", "published", "scheduled"].includes(statusRaw) ? statusRaw : "draft") as CmsPage["status"];
  const seo_title = String(fd.get("seo_title") || "").trim().slice(0, 120);
  const seo_description = String(fd.get("seo_description") || "").trim().slice(0, 320);
  const shareRaw = String(fd.get("share_image") || "").trim();
  const share_image = safeImage(shareRaw);
  let blocks;
  try {
    blocks = normalizeBlocks(JSON.parse(String(fd.get("blocks") || "[]")));
  } catch {
    return { error: "תוכן הדף לא תקין" };
  }

  if (!title) return { error: "יש להזין כותרת לדף", field: "title" };
  if (!slug) return { error: "יש להזין כתובת (slug) לדף", field: "slug" };
  if (!SLUG_RE.test(slug)) return { error: "הכתובת יכולה להכיל רק אותיות באנגלית קטנות, ספרות ומקפים (למשל winter-care)", field: "slug" };
  if (RESERVED.has(slug)) return { error: "הכתובת הזו שמורה למערכת, בחרו כתובת אחרת", field: "slug" };
  if (shareRaw && !share_image) return { error: "קישור תמונת השיתוף צריך להתחיל ב־https://", field: "share_image" };

  let publish_at: string | null = null;
  if (status === "scheduled") {
    const d = israelLocalToUtc(String(fd.get("publish_at") || ""));
    if (!d) return { error: "יש לבחור תאריך ושעה לפרסום המתוזמן", field: "publish_at" };
    publish_at = d.toISOString();
  }

  const sql = await db();
  const dup = await sql`select id from pages where slug = ${slug} and id <> ${id || 0} limit 1`;
  if (dup[0]) return { error: `כבר קיים דף בכתובת /info/${slug}. בחרו כתובת אחרת.`, field: "slug" };

  let savedId = id;
  try {
    if (id) {
      const old = await getPageById(id);
      if (!old) return { error: "הדף לא נמצא (אולי נמחק)" };
      // keep the original publish time when re-saving a published page
      if (status === "published") publish_at = old.status === "published" && old.publish_at ? old.publish_at : new Date().toISOString();
      await sql`
        update pages set slug=${slug}, title=${title}, type=${type}, blocks=${JSON.stringify(blocks)}::jsonb, status=${status},
          publish_at=${publish_at}::timestamptz, seo_title=${seo_title}, seo_description=${seo_description}, share_image=${share_image}, updated_at=now()
        where id=${id}`;
      const next = { slug, title, type, status, publish_at, seo_title, seo_description, share_image, blocks } as Partial<CmsPage>;
      const d = diff(snap(old), snap(next));
      const contentChanged = JSON.stringify(old.blocks) !== JSON.stringify(blocks);
      if (d.changed || contentChanged) {
        await audit({
          action: old.status !== status ? "status" : "update",
          entity: "page",
          entityId: id,
          summary: old.status !== status ? `הדף "${title}" עבר למצב ${status === "published" ? "מפורסם" : status === "scheduled" ? "מתוזמן" : "טיוטה"}` : `עודכן הדף "${title}"${contentChanged ? " (תוכן)" : ""}`,
          before: d.before,
          after: d.after,
        });
      }
      revalidatePage(slug, old.slug);
    } else {
      if (status === "published") publish_at = new Date().toISOString();
      const r = await sql`
        insert into pages (slug, title, type, blocks, status, publish_at, seo_title, seo_description, share_image)
        values (${slug}, ${title}, ${type}, ${JSON.stringify(blocks)}::jsonb, ${status}, ${publish_at}::timestamptz, ${seo_title}, ${seo_description}, ${share_image})
        returning id`;
      savedId = Number(r[0].id);
      await audit({ action: "create", entity: "page", entityId: savedId, summary: `נוצר ${type === "blog" ? "פוסט" : "דף"} "${title}"`, after: snap({ slug, title, type, status, publish_at, seo_title, seo_description, share_image, blocks }) });
      revalidatePage(slug);
    }
  } catch (e: any) {
    if (String(e?.code) === "23505") return { error: `כבר קיים דף בכתובת /info/${slug}. בחרו כתובת אחרת.`, field: "slug" };
    console.error(e);
    return { error: "לא הצלחנו לשמור את הדף, נסו שוב" };
  }
  if (!id) redirect(`/admin/pages/${savedId}?saved=1`);
  return { ok: true, id: savedId!, savedAt: new Date().toISOString() };
}

/** Copy a page as a draft with a unique slug. */
export async function duplicatePageAction(fd: FormData) {
  await requireAdmin("pages");
  if (!hasDb()) return;
  const src = await getPageById(Number(fd.get("id")));
  if (!src) redirect("/admin/pages");
  const sql = await db();
  const base = `${src!.slug}-copy`;
  const taken = await sql`select slug from pages where slug = ${base} or slug like ${base + "-%"}`;
  const set = new Set(taken.map((r: any) => String(r.slug)));
  let slug = base;
  for (let i = 2; set.has(slug); i++) slug = `${base}-${i}`;
  const r = await sql`
    insert into pages (slug, title, type, blocks, status, seo_title, seo_description, share_image)
    values (${slug}, ${src!.title + " (עותק)"}, ${src!.type}, ${JSON.stringify(src!.blocks)}::jsonb, 'draft', ${src!.seo_title}, ${src!.seo_description}, ${src!.share_image})
    returning id`;
  const newId = Number(r[0].id);
  await audit({ action: "create", entity: "page", entityId: newId, summary: `שוכפל הדף "${src!.title}"`, after: { slug, from: src!.slug } });
  revalidatePath("/admin/pages");
  redirect(`/admin/pages/${newId}?saved=dup`);
}

export async function deletePageAction(fd: FormData) {
  await requireAdmin("pages");
  if (!hasDb()) return;
  const p = await getPageById(Number(fd.get("id")));
  if (!p) redirect("/admin/pages");
  const sql = await db();
  await sql`delete from pages where id=${p!.id}`;
  await audit({ action: "delete", entity: "page", entityId: p!.id, summary: `נמחק הדף "${p!.title}" (/info/${p!.slug})`, before: { ...snap(p!), blocks: p!.blocks } as Record<string, unknown> });
  revalidatePage(p!.slug);
  revalidatePath("/", "layout");
  redirect(`/admin/pages?deleted=${encodeURIComponent(p!.title)}${p!.type === "blog" ? "&tab=blog" : ""}`);
}

/** Upload one image for an image block / share image. */
export async function uploadPageImageAction(fd: FormData): Promise<{ url?: string; error?: string }> {
  await requireAdmin("pages");
  const f = fd.get("file");
  if (!f || typeof f !== "object" || !("size" in f) || !(f as File).size) return { error: "לא נבחר קובץ" };
  if (!imageStorageReady()) return { error: "אחסון התמונות עדיין לא מחובר (Supabase Storage). בינתיים אפשר להדביק קישור לתמונה." };
  try {
    const url = await uploadProductImage(f as File);
    await audit({ action: "create", entity: "page", entityId: "image", summary: "הועלתה תמונה לדף תוכן", after: { url } });
    return { url };
  } catch (e: any) {
    console.error(e);
    const msg = String(e?.message || "");
    if (/^הקובץ/.test(msg)) return { error: msg };
    return { error: "העלאת התמונה נכשלה. נסו שוב, או הדביקו קישור לתמונה." };
  }
}
