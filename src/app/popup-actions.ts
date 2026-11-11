"use server";

import { hasDb } from "@/lib/db";
import { addClubMember } from "@/lib/store";
import { addPopupLead, countPopupEvent, getPopup, popupStatus } from "@/lib/popups";

export type PopupSubmitResult = { ok: boolean; error?: string; coupon?: string };

const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** A visitor sent a popup form: validate against the popup's own fields, save the lead, maybe join the club. */
export async function submitPopupLead(
  popupId: number,
  d: { name?: string; phone?: string; email?: string; message?: string; consent?: boolean; page?: string }
): Promise<PopupSubmitResult> {
  if (!hasDb()) return { ok: false, error: "לא ניתן לשלוח כרגע, נסי שוב מאוחר יותר" };
  const p = await getPopup(Number(popupId)).catch(() => null);
  if (!p || popupStatus(p) !== "active") return { ok: false, error: "ההצעה כבר לא זמינה" };
  const c = p.config;

  const name = c.fields.name ? clean(d.name, 80) : "";
  const phone = c.fields.phone ? clean(d.phone, 30) : "";
  const email = c.fields.email ? clean(d.email, 120) : "";
  const message = c.fields.message ? clean(d.message, 1000) : "";

  if (c.fields.name && !name) return { ok: false, error: "נא להזין שם" };
  if (c.fields.phone && phone.replace(/\D/g, "").length < 9) return { ok: false, error: "נא להזין מספר טלפון תקין" };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "כתובת המייל לא תקינה" };
  if (c.fields.email && !c.fields.phone && !email) return { ok: false, error: "נא להזין כתובת מייל" };
  if (c.fields.message && !c.fields.phone && !c.fields.email && !message) return { ok: false, error: "נא לכתוב הודעה" };

  try {
    await addPopupLead({ popup_id: p.id, name, phone, email, message, page: clean(d.page, 200) });
    if (c.consent && d.consent && phone) {
      await addClubMember({ name, phone, email }).catch((e) => console.error("club join from popup failed", e));
    }
    await countPopupEvent(p.id, "submit").catch(() => {});
  } catch (e) {
    console.error("popup lead failed", e);
    return { ok: false, error: "משהו השתבש, נסי שוב" };
  }
  return { ok: true, coupon: c.couponMode === "after" ? c.coupon : undefined };
}
