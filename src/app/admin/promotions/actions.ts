"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db, hasDb } from "@/lib/db";
import { audit } from "@/lib/admin";
import { normPromotion } from "@/lib/promotions";
import { autoBadge, normConfig, normScope, TYPE_META, type PromoType, type Promotion } from "@/lib/promotions-shared";
import { israelDayEnd, israelDayStart } from "../coupons/lib";

export type PromoSaveState = { ok?: boolean; error?: string; id?: number } | null;

const NO_DB = "מסד הנתונים לא מחובר, לא ניתן לשמור מבצעים כרגע";

const snap = (p: Partial<Promotion>) => ({ name: p.name, type: p.type, badge: p.badge, scope: p.scope, config: p.config, starts_at: p.starts_at, ends_at: p.ends_at, active: p.active, allow_coupon: p.allow_coupon });

async function getPromo(id: number): Promise<Promotion | null> {
  const sql = await db();
  const r = await sql`select * from promotions where id=${id} limit 1`;
  return r[0] ? normPromotion(r[0]) : null;
}

function refresh() {
  revalidatePath("/admin/promotions");
  revalidatePath("/", "layout");
}

/** The editor posts one JSON payload (the form state); everything is re-validated here. */
export async function savePromotionAction(_: PromoSaveState, fd: FormData): Promise<PromoSaveState> {
  await requireAdmin("promotions");
  if (!hasDb()) return { error: NO_DB };
  let v: any;
  try {
    v = JSON.parse(String(fd.get("payload") || "{}"));
  } catch {
    return { error: "הנתונים שנשלחו לא תקינים, רענני את הדף ונסי שוב" };
  }
  const id = Number(v.id) || null;
  const type = String(v.type) as PromoType;
  if (!TYPE_META[type]) return { error: "יש לבחור סוג מבצע" };
  const name = String(v.name || "").trim().slice(0, 80);
  if (!name) return { error: "יש לתת למבצע שם (הוא מופיע ללקוחות בסל)" };
  const scope = normScope(v.scope);
  const config = normConfig(v.config);
  if (scope.mode === "categories" && !scope.categories.length) return { error: "בחרי לפחות קטגוריה אחת למבצע" };
  if (scope.mode === "products" && !scope.products.length) return { error: "בחרי לפחות מוצר אחד למבצע" };
  if (type === "bxgy" && config.target) {
    if (config.target.mode === "categories" && !config.target.categories.length) return { error: "בחרי את הקטגוריה של הפריטים המוזלים" };
    if (config.target.mode === "products" && !config.target.products.length) return { error: "בחרי את המוצרים המוזלים" };
  }
  if (type !== "bxgy") config.target = null;
  const starts = v.starts_at ? israelDayStart(String(v.starts_at)) : null;
  const ends = v.ends_at ? israelDayEnd(String(v.ends_at)) : null;
  if (v.starts_at && !starts) return { error: "תאריך ההתחלה לא תקין" };
  if (v.ends_at && !ends) return { error: "תאריך הסיום לא תקין" };
  if (starts && ends && ends < starts) return { error: "תאריך הסיום מוקדם מתאריך ההתחלה" };
  const badge = String(v.badge || "").trim().slice(0, 24);
  const row = {
    name,
    type,
    badge,
    scope,
    config,
    starts_at: starts ? starts.toISOString() : null,
    ends_at: ends ? ends.toISOString() : null,
    active: !!v.active,
    allow_coupon: v.allow_coupon !== false,
  };

  const sql = await db();
  let newId = id;
  if (id) {
    const before = await getPromo(id);
    if (!before) return { error: "המבצע לא נמצא, ייתכן שנמחק" };
    await sql`update promotions set name=${row.name}, type=${row.type}, badge=${row.badge}, scope=${JSON.stringify(row.scope)}::jsonb,
      config=${JSON.stringify(row.config)}::jsonb, starts_at=${row.starts_at}, ends_at=${row.ends_at}, active=${row.active},
      allow_coupon=${row.allow_coupon}, updated_at=now() where id=${id}`;
    await audit({ action: "update", entity: "promotion", entityId: id, summary: `עדכון מבצע "${name}"`, before: snap(before), after: snap({ ...row, id } as any) });
  } else {
    const r = await sql`insert into promotions (name, type, badge, scope, config, starts_at, ends_at, active, allow_coupon)
      values (${row.name}, ${row.type}, ${row.badge}, ${JSON.stringify(row.scope)}::jsonb, ${JSON.stringify(row.config)}::jsonb,
              ${row.starts_at}, ${row.ends_at}, ${row.active}, ${row.allow_coupon}) returning id`;
    newId = Number(r[0].id);
    await audit({ action: "create", entity: "promotion", entityId: newId, summary: `מבצע חדש "${name}" (${badge || autoBadge(type, config)})`, after: snap(row as any) });
  }
  refresh();
  return { ok: true, id: newId! };
}

export async function togglePromotionAction(fd: FormData) {
  await requireAdmin("promotions");
  if (!hasDb()) return;
  const id = Number(fd.get("id"));
  const p = await getPromo(id);
  if (!p) return;
  const sql = await db();
  await sql`update promotions set active=${!p.active}, updated_at=now() where id=${id}`;
  await audit({ action: "update", entity: "promotion", entityId: id, summary: `${p.active ? "השהיית" : "הפעלת"} מבצע "${p.name}"`, before: { active: p.active }, after: { active: !p.active } });
  refresh();
}

export async function duplicatePromotionAction(fd: FormData) {
  await requireAdmin("promotions");
  if (!hasDb()) return;
  const id = Number(fd.get("id"));
  const p = await getPromo(id);
  if (!p) return;
  const sql = await db();
  const r = await sql`insert into promotions (name, type, badge, scope, config, starts_at, ends_at, active, allow_coupon)
    values (${(p.name + " (עותק)").slice(0, 80)}, ${p.type}, ${p.badge}, ${JSON.stringify(p.scope)}::jsonb, ${JSON.stringify(p.config)}::jsonb,
            ${p.starts_at}, ${p.ends_at}, false, ${p.allow_coupon}) returning id`;
  const newId = Number(r[0].id);
  await audit({ action: "create", entity: "promotion", entityId: newId, summary: `שכפול מבצע "${p.name}" (העותק כבוי)` });
  refresh();
  redirect(`/admin/promotions/${newId}`);
}

export async function deletePromotionAction(fd: FormData) {
  await requireAdmin("promotions");
  if (!hasDb()) return;
  const id = Number(fd.get("id"));
  const p = await getPromo(id);
  if (!p) return;
  const sql = await db();
  await sql`delete from promotions where id=${id}`; // orders keep their own copy of the promotion's name and discount
  await audit({ action: "delete", entity: "promotion", entityId: id, summary: `מחיקת מבצע "${p.name}"`, before: snap(p) });
  refresh();
  redirect(`/admin/promotions?deleted=${encodeURIComponent(p.name)}`);
}
