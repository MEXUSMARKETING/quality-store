"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { audit } from "@/lib/admin";
import { STORE_DEFAULTS, getSetting, setSetting, type StoreInfo } from "@/lib/site";
import { imageStorageReady, uploadProductImage } from "@/lib/storage";
import { SEO_DEFAULTS, TRACKING_DEFAULTS, TRACKING_FORMATS, type SeoSettings, type TrackingSettings } from "./defaults";

export type SettingsState = { ok?: boolean; error?: string; field?: string; at?: number } | null;

const NO_DB = "מסד הנתונים לא מחובר – לא ניתן לשמור הגדרות כרגע";
const str = (fd: FormData, k: string, max = 200) => String(fd.get(k) || "").trim().slice(0, max);

function diff(a: Record<string, unknown>, b: Record<string, unknown>) {
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const k of Object.keys(b)) if (JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)) { before[k] = a[k] ?? null; after[k] = b[k] ?? null; }
  return { before, after, changed: Object.keys(after).length > 0 };
}

function urlOk(v: string) {
  return !v || /^https:\/\/[^\s]+$/i.test(v);
}

export async function saveStoreAction(_: SettingsState, fd: FormData): Promise<SettingsState> {
  await requireAdmin("settings", "edit");
  if (!hasDb()) return { error: NO_DB };
  const whatsappRaw = str(fd, "whatsapp", 30).replace(/[^0-9]/g, "");
  const next: StoreInfo = {
    name: str(fd, "name", 80),
    city: str(fd, "city", 60),
    address: str(fd, "address", 160),
    phoneDisplay: str(fd, "phoneDisplay", 30),
    whatsapp: whatsappRaw,
    email: str(fd, "email", 160).toLowerCase(),
    hours: str(fd, "hours", 300),
    instagram: str(fd, "instagram", 300),
    facebook: str(fd, "facebook", 300),
    tiktok: str(fd, "tiktok", 300),
  };
  if (!next.name) return { error: "יש להזין את שם החנות", field: "name" };
  if (!/^972[1-9][0-9]{7,8}$/.test(next.whatsapp)) return { error: "מספר הוואטסאפ צריך להיות בפורמט בינלאומי: 972 ואחריו המספר בלי 0, למשל 972542910333", field: "whatsapp" };
  if (next.phoneDisplay && !/^[0-9+\-\s()]{7,20}$/.test(next.phoneDisplay)) return { error: "מספר הטלפון לתצוגה לא תקין", field: "phoneDisplay" };
  if (next.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(next.email)) return { error: "כתובת האימייל לא תקינה", field: "email" };
  for (const k of ["instagram", "facebook", "tiktok"] as const) if (!urlOk(next[k])) return { error: "קישור לרשת חברתית צריך להתחיל ב־https://", field: k };

  const old = await getSetting<StoreInfo>("store", STORE_DEFAULTS);
  await setSetting("store", next);
  const d = diff(old as any, next as any);
  if (d.changed) await audit({ action: "settings", entity: "settings", entityId: "store", summary: "עודכנו פרטי החנות", before: d.before, after: d.after });
  revalidatePath("/", "layout");
  return { ok: true, at: Date.now() };
}

export async function saveSeoAction(_: SettingsState, fd: FormData): Promise<SettingsState> {
  await requireAdmin("settings", "edit");
  if (!hasDb()) return { error: NO_DB };
  const old = await getSetting<SeoSettings>("seo", SEO_DEFAULTS);
  let shareImage = str(fd, "shareImage", 500);
  const file = fd.get("shareFile");
  if (file && typeof file === "object" && "size" in file && (file as File).size > 0) {
    if (!imageStorageReady()) return { error: "אחסון התמונות לא מחובר. אפשר להדביק קישור לתמונה במקום.", field: "shareImage" };
    try {
      shareImage = await uploadProductImage(file as File);
    } catch (e: any) {
      const msg = String(e?.message || "");
      return { error: /^הקובץ/.test(msg) ? msg : "העלאת התמונה נכשלה, נסו שוב", field: "shareImage" };
    }
  }
  if (fd.get("removeImage") === "on") shareImage = "";
  const next: SeoSettings = {
    defaultTitle: str(fd, "defaultTitle", 120),
    titleTemplate: str(fd, "titleTemplate", 80) || "%s",
    description: str(fd, "description", 320),
    shareImage,
    robotsAllow: fd.get("robotsAllow") === "on",
  };
  if (!next.defaultTitle) return { error: "יש להזין כותרת ברירת מחדל", field: "defaultTitle" };
  if (!next.titleTemplate.includes("%s")) return { error: "תבנית הכותרת חייבת לכלול %s (המקום של שם העמוד)", field: "titleTemplate" };
  if (next.shareImage && !/^https:\/\/[^\s]+$/i.test(next.shareImage)) return { error: "קישור התמונה צריך להתחיל ב־https://", field: "shareImage" };

  await setSetting("seo", next);
  const d = diff(old as any, next as any);
  if (d.changed) await audit({ action: "settings", entity: "settings", entityId: "seo", summary: next.robotsAllow !== old.robotsAllow ? `עודכנו הגדרות SEO (מנועי חיפוש: ${next.robotsAllow ? "מותר" : "חסום"})` : "עודכנו הגדרות SEO", before: d.before, after: d.after });
  revalidatePath("/", "layout");
  return { ok: true, at: Date.now() };
}

export async function saveTrackingAction(_: SettingsState, fd: FormData): Promise<SettingsState> {
  await requireAdmin("settings", "edit");
  if (!hasDb()) return { error: NO_DB };
  const next: TrackingSettings = { ...TRACKING_DEFAULTS };
  for (const k of Object.keys(TRACKING_FORMATS) as (keyof TrackingSettings)[]) {
    const v = str(fd, k, 40).replace(/\s+/g, "");
    const val = k === "metaPixel" ? v : v.toUpperCase();
    if (val && !TRACKING_FORMATS[k].re.test(val)) return { error: `${TRACKING_FORMATS[k].label}: פורמט לא תקין. דוגמה: ${TRACKING_FORMATS[k].example}`, field: k };
    next[k] = val;
  }
  const old = await getSetting<TrackingSettings>("tracking", TRACKING_DEFAULTS);
  await setSetting("tracking", next);
  const d = diff(old as any, next as any);
  if (d.changed) await audit({ action: "settings", entity: "settings", entityId: "tracking", summary: "עודכנו קודי המעקב באתר", before: d.before, after: d.after });
  revalidatePath("/", "layout");
  return { ok: true, at: Date.now() };
}
