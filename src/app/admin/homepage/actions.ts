"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { audit } from "@/lib/admin";
import { imageStorageReady, uploadProductImage } from "@/lib/storage";
import { defaultSections, normalizeSections, readHomepageRaw, writeHomepage, type HomeSection } from "@/lib/content";

export type HomeActionResult = { ok?: boolean; error?: string; publishedAt?: string; sections?: HomeSection[] };

const NO_DB = "מסד הנתונים לא מחובר, לא ניתן לשמור את דף הבית כרגע";

/** Short audit snapshot: type + title of each section. */
const outline = (list: HomeSection[]) =>
  list.map((s) => {
    const t = s.type === "hero" || s.type === "products" || s.type === "club" ? s.title.replace(/\n/g, " ").replace(/\*/g, "") : "";
    return `${s.type}${t ? ": " + t.slice(0, 40) : ""}${s.visible ? "" : " (מוסתר)"}${s.start || s.end ? ` [${s.start || ""}–${s.end || ""}]` : ""}`;
  });

function parse(json: unknown): HomeSection[] | null {
  try {
    const raw = JSON.parse(String(json || ""));
    if (!Array.isArray(raw)) return null;
    return normalizeSections(raw);
  } catch {
    return null;
  }
}

function validate(list: HomeSection[]): string | null {
  for (const s of list) {
    if (s.start && s.end && s.end < s.start) return "באחד המקטעים תאריך הסיום מוקדם מתאריך ההתחלה";
  }
  return null;
}

/** Save the editor state as the draft (the live site does not change). */
export async function saveHomepageDraftAction(json: string): Promise<HomeActionResult> {
  await requireAdmin("homepage");
  if (!hasDb()) return { error: NO_DB };
  const list = parse(json);
  if (!list) return { error: "הנתונים שנשלחו לא תקינים" };
  const bad = validate(list);
  if (bad) return { error: bad };
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
  const list = parse(json);
  if (!list) return { error: "הנתונים שנשלחו לא תקינים" };
  const bad = validate(list);
  if (bad) return { error: bad };
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
  try {
    const cur = await readHomepageRaw();
    await writeHomepage({ ...cur, draft: null });
    await audit({ action: "update", entity: "homepage", entityId: "draft", summary: "בוטלה טיוטת דף הבית" });
  } catch (e) {
    console.error(e);
    return { error: "הפעולה נכשלה, נסו שוב" };
  }
  revalidatePath("/admin/homepage");
  const cur = await readHomepageRaw().catch(() => ({} as any));
  return { ok: true, sections: Array.isArray(cur.sections) ? normalizeSections(cur.sections) : defaultSections() };
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
