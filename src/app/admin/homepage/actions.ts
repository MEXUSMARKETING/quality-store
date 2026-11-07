"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { audit } from "@/lib/admin";
import { imageStorageReady, uploadProductImage } from "@/lib/storage";
import { defaultSections, normalizeSections, readHomepageRaw, safeHref, safeImage, writeHomepage, type HomeSection } from "@/lib/content";

export type HomeActionResult = { ok?: boolean; error?: string; publishedAt?: string; sections?: HomeSection[] };

const NO_DB = "מסד הנתונים לא מחובר, לא ניתן לשמור את דף הבית כרגע";

/** Short audit snapshot: type + title of each section. */
const outline = (list: HomeSection[]) =>
  list.map((s) => {
    const t = s.type === "hero" || s.type === "products" || s.type === "club" ? s.title.replace(/\n/g, " ").replace(/\*/g, "") : "";
    return `${s.type}${t ? ": " + t.slice(0, 40) : ""}${s.visible ? "" : " (מוסתר)"}${s.start || s.end ? ` [${s.start || ""}–${s.end || ""}]` : ""}`;
  });

const linkOk = (v: unknown) => !String(v ?? "").trim() || !!safeHref(v);
const imageOk = (v: unknown) => !String(v ?? "").trim() || !!safeImage(v);

/** Hebrew error for the first bad link / image URL in the raw editor data (before normalizing drops it). */
function badUrl(raw: any[]): string | null {
  for (const s of raw) {
    const links: unknown[] = [], images: unknown[] = [];
    if (s?.type === "hero") { links.push(s.primaryHref, s.secondaryHref); images.push(s.image); }
    if (s?.type === "products") links.push(s.href);
    if (s?.type === "categories") for (const t of s.tiles || []) { links.push(t?.href); images.push(t?.image); }
    if (s?.type === "promos") for (const t of s.items || []) { links.push(t?.href); images.push(t?.image); }
    if (!links.every(linkOk)) return "באחד המקטעים יש קישור לא תקין. קישור צריך להתחיל ב־/ (עמוד באתר) או ב־https://";
    if (!images.every(imageOk)) return "באחד המקטעים יש קישור תמונה לא תקין (צריך להתחיל ב־https://)";
  }
  return null;
}

/** Parse + validate the editor JSON. Returns the clean sections or a Hebrew error. */
function parse(json: unknown): { list?: HomeSection[]; error?: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(String(json || ""));
  } catch {
    return { error: "הנתונים שנשלחו לא תקינים" };
  }
  if (!Array.isArray(raw)) return { error: "הנתונים שנשלחו לא תקינים" };
  const urlErr = badUrl(raw);
  if (urlErr) return { error: urlErr };
  const list = normalizeSections(raw);
  for (const s of list) {
    if (s.start && s.end && s.end < s.start) return { error: "באחד המקטעים תאריך הסיום מוקדם מתאריך ההתחלה" };
  }
  return { list };
}

/** Save the editor state as the draft (the live site does not change). */
export async function saveHomepageDraftAction(json: string): Promise<HomeActionResult> {
  await requireAdmin("homepage");
  if (!hasDb()) return { error: NO_DB };
  const { list, error } = parse(json);
  if (!list) return { error };
  try {
    const cur = await readHomepageRaw();
    await writeHomepage({ ...cur, draft: list });
    await audit({ action: "update", entity: "homepage", entityId: "draft", summary: `נשמרה טיוטה של דף הבית (${list.length} מקטעים)`, after: { sections: outline(list) } });
  } catch (e) {
    console.error(e);
    return { error: "השמירה נכשלה, נסו שוב" };
  }
  revalidatePath("/admin/homepage");
  return { ok: true, sections: list };
}

/** Save the editor state and publish it to the live home page. */
export async function publishHomepageAction(json: string): Promise<HomeActionResult> {
  await requireAdmin("homepage");
  if (!hasDb()) return { error: NO_DB };
  const { list, error } = parse(json);
  if (!list) return { error };
  const publishedAt = new Date().toISOString();
  try {
    const cur = await readHomepageRaw();
    const before = Array.isArray(cur.sections) ? normalizeSections(cur.sections) : defaultSections();
    await writeHomepage({ sections: list, draft: null, publishedAt });
    await audit({
      action: "update",
      entity: "homepage",
      entityId: "published",
      summary: `פורסם דף הבית (${list.length} מקטעים)`,
      before: { sections: outline(before) },
      after: { sections: outline(list) },
    });
  } catch (e) {
    console.error(e);
    return { error: "הפרסום נכשל, נסו שוב" };
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/homepage");
  return { ok: true, publishedAt, sections: list };
}

/** Throw away the draft and go back to what is live. */
export async function discardHomepageDraftAction(): Promise<HomeActionResult> {
  await requireAdmin("homepage");
  if (!hasDb()) return { error: NO_DB };
  let live: HomeSection[];
  try {
    const cur = await readHomepageRaw();
    live = Array.isArray(cur.sections) ? normalizeSections(cur.sections) : defaultSections();
    await writeHomepage({ ...cur, draft: null });
    await audit({ action: "update", entity: "homepage", entityId: "draft", summary: "בוטלה טיוטת דף הבית" });
  } catch (e) {
    console.error(e);
    return { error: "הפעולה נכשלה, נסו שוב" };
  }
  revalidatePath("/admin/homepage");
  return { ok: true, sections: live };
}

/** Upload one image for a section; returns its public URL. */
export async function uploadHomepageImageAction(fd: FormData): Promise<{ url?: string; error?: string }> {
  await requireAdmin("homepage");
  const f = fd.get("file");
  if (!f || typeof f !== "object" || !("size" in f) || !(f as File).size) return { error: "לא נבחר קובץ" };
  if (!imageStorageReady()) return { error: "אחסון התמונות עדיין לא מחובר (Supabase Storage). בינתיים אפשר להדביק קישור לתמונה." };
  try {
    const url = await uploadProductImage(f as File);
    await audit({ action: "create", entity: "homepage", entityId: "image", summary: "הועלתה תמונה לדף הבית", after: { url } });
    return { url };
  } catch (e: any) {
    console.error(e);
    const msg = String(e?.message || "");
    if (/^הקובץ/.test(msg)) return { error: msg };
    return { error: "העלאת התמונה נכשלה. נסו שוב, או הדביקו קישור לתמונה." };
  }
}
