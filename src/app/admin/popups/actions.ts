"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { audit } from "@/lib/admin";
import { imageStorageReady, uploadProductImage } from "@/lib/storage";
import { TEMPLATES, TEMPLATE_KEYS, deletePopup, duplicatePopup, getPopup, normalizeConfig, savePopup, setPopupActive, type PopupTemplate } from "@/lib/popups";
import { israelDayEnd, israelDayStart } from "../coupons/lib";

export type PopupFormState = { error?: string; ok?: boolean } | null;

const NO_DB = "מסד הנתונים לא מחובר, לא ניתן לשמור פופ־אפים כרגע";

const refresh = () => {
  revalidatePath("/admin/popups");
  revalidatePath("/", "layout");
};

/** Create a new (paused) popup from a template and open its editor. */
export async function createFromTemplateAction(fd: FormData) {
  await requireAdmin("popups");
  if (!hasDb()) redirect("/admin/popups?error=db");
  const key = String(fd.get("template") || "") as PopupTemplate;
  const t = TEMPLATES[TEMPLATE_KEYS.includes(key) ? key : "welcome"];
  const id = await savePopup(null, { name: t.name, active: false, priority: 100, config: t.config(), starts_at: null, ends_at: null });
  await audit({ action: "create", entity: "popup", entityId: id, summary: `פופ־אפ חדש מתבנית "${t.label}"` });
  refresh();
  redirect(`/admin/popups/${id}?new=1`);
}

export async function savePopupAction(_: PopupFormState, fd: FormData): Promise<PopupFormState> {
  await requireAdmin("popups");
  if (!hasDb()) return { error: NO_DB };
  const id = Number(fd.get("id")) || null;
  const name = String(fd.get("name") || "").trim().slice(0, 80);
  if (!name) return { error: "יש לתת שם לפופ־אפ (מופיע רק במערכת)" };
  let config: unknown;
  try {
    config = JSON.parse(String(fd.get("config") || "{}"));
  } catch {
    return { error: "שגיאה בנתוני העיצוב, רענני את העמוד ונסי שוב" };
  }
  const c = normalizeConfig(config);
  if (!c.title.trim()) return { error: "יש להזין כותרת" };
  if (c.couponMode !== "none" && !c.coupon) return { error: "בחרת להציג קופון, אבל לא הוזן קוד קופון" };
  if (!c.pages.length) return { error: "יש לבחור לפחות עמוד אחד שבו הפופ־אפ יופיע" };
  const startsRaw = String(fd.get("starts_at") || "");
  const endsRaw = String(fd.get("ends_at") || "");
  const starts_at = startsRaw ? israelDayStart(startsRaw) : null;
  const ends_at = endsRaw ? israelDayEnd(endsRaw) : null;
  if (starts_at && ends_at && ends_at < starts_at) return { error: "תאריך הסיום לפני תאריך ההתחלה" };
  const priority = Math.max(1, Math.min(999, Number(fd.get("priority")) || 100));
  const active = fd.get("active") === "on";

  const before = id ? await getPopup(id) : null;
  const newId = await savePopup(id, { name, active, priority, config: c, starts_at, ends_at });
  await audit({
    action: id ? "update" : "create",
    entity: "popup",
    entityId: newId,
    summary: `${id ? "עדכון" : "יצירת"} פופ־אפ "${name}"${before && before.active !== active ? (active ? " (הופעל)" : " (הושהה)") : ""}`,
  });
  refresh();
  return { ok: true };
}

export async function togglePopupAction(fd: FormData) {
  await requireAdmin("popups");
  const id = Number(fd.get("id"));
  const p = id ? await getPopup(id) : null;
  if (!p) return;
  await setPopupActive(id, !p.active);
  await audit({ action: "status", entity: "popup", entityId: id, summary: `פופ־אפ "${p.name}" ${p.active ? "הושהה" : "הופעל"}` });
  refresh();
}

export async function duplicatePopupAction(fd: FormData) {
  await requireAdmin("popups");
  const id = Number(fd.get("id"));
  const newId = id ? await duplicatePopup(id) : null;
  if (!newId) return;
  await audit({ action: "create", entity: "popup", entityId: newId, summary: `שכפול פופ־אפ #${id}` });
  refresh();
  redirect(`/admin/popups/${newId}`);
}

export async function deletePopupAction(fd: FormData) {
  await requireAdmin("popups");
  const id = Number(fd.get("id"));
  const p = id ? await getPopup(id) : null;
  if (!p) redirect("/admin/popups");
  await deletePopup(id);
  await audit({ action: "delete", entity: "popup", entityId: id, summary: `מחיקת פופ־אפ "${p.name}"` });
  refresh();
  redirect("/admin/popups?deleted=1");
}

export async function uploadPopupImageAction(fd: FormData): Promise<{ url?: string; error?: string }> {
  await requireAdmin("popups");
  if (!imageStorageReady()) return { error: "אחסון התמונות לא מחובר. אפשר להדביק קישור לתמונה." };
  const f = fd.get("file");
  if (!f || typeof f !== "object" || !("size" in f) || !(f as File).size) return { error: "לא נבחר קובץ" };
  try {
    return { url: await uploadProductImage(f as File) };
  } catch (e: any) {
    return { error: e?.message || "ההעלאה נכשלה" };
  }
}
