"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db, hasDb } from "@/lib/db";
import { audit, normCoupon } from "@/lib/admin";
import type { Coupon } from "@/lib/types";
import { israelDayEnd, israelDayStart } from "./lib";

export type CouponFormState = { error?: string; field?: string } | null;

const NO_DB = "מסד הנתונים לא מחובר, לא ניתן לשמור קופונים כרגע";

const int = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : NaN;
};

/** The fields we compare/store in the audit log */
const snap = (c: Partial<Coupon>) => ({
  code: c.code,
  description: c.description,
  type: c.type,
  value: c.value,
  min_total: c.min_total,
  max_discount: c.max_discount,
  starts_at: c.starts_at,
  ends_at: c.ends_at,
  usage_limit: c.usage_limit,
  per_customer: c.per_customer,
  active: c.active,
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

async function getCoupon(id: number): Promise<Coupon | null> {
  const sql = await db();
  const r = await sql`select * from coupons where id=${id} limit 1`;
  return r[0] ? normCoupon(r[0]) : null;
}

export async function saveCouponAction(_: CouponFormState, fd: FormData): Promise<CouponFormState> {
  requireAdmin();
  if (!hasDb()) return { error: NO_DB };

  const id = int(fd.get("id")) || null;
  const code = String(fd.get("code") || "").trim().toUpperCase();
  const description = String(fd.get("description") || "").trim().slice(0, 200);
  const type = String(fd.get("type") || "percent");
  const value = int(fd.get("value"));
  const min_total = int(fd.get("min_total"));
  const max_discount = type === "percent" ? int(fd.get("max_discount")) : null;
  const usage_limit = int(fd.get("usage_limit"));
  const per_customer = int(fd.get("per_customer"));
  const startsRaw = String(fd.get("starts_at") || "");
  const endsRaw = String(fd.get("ends_at") || "");
  const active = fd.get("active") === "on";

  if (!code) return { error: "יש להזין קוד קופון", field: "code" };
  if (code.length > 32) return { error: "קוד הקופון ארוך מדי (עד 32 תווים)", field: "code" };
  if (!/^[A-Z0-9-]+$/.test(code)) return { error: "הקוד יכול להכיל רק אותיות באנגלית, ספרות ומקף", field: "code" };
  if (type !== "percent" && type !== "fixed") return { error: "סוג ההנחה לא תקין", field: "type" };
  if (value === null || Number.isNaN(value)) return { error: "יש להזין את גובה ההנחה", field: "value" };
  if (type === "percent" && (value < 1 || value > 100)) return { error: "אחוז ההנחה צריך להיות בין 1 ל־100", field: "value" };
  if (type === "fixed" && value <= 0) return { error: "סכום ההנחה צריך להיות גדול מ־0", field: "value" };
  for (const [v, f, label] of [
    [min_total, "min_total", "סכום מינימום"],
    [max_discount, "max_discount", "הנחה מקסימלית"],
    [usage_limit, "usage_limit", "מגבלת שימושים"],
    [per_customer, "per_customer", "שימושים ללקוחה"],
  ] as const) {
    if (v !== null && (Number.isNaN(v) || v < 0)) return { error: `${label}: יש להזין מספר שלם חיובי`, field: f };
  }
  if (max_discount === 0) return { error: "הנחה מקסימלית צריכה להיות גדולה מ־0 (או להשאיר ריק)", field: "max_discount" };
  if (usage_limit === 0) return { error: "מגבלת שימושים צריכה להיות לפחות 1 (או להשאיר ריק)", field: "usage_limit" };
  if (per_customer === 0) return { error: "שימושים ללקוחה צריכים להיות לפחות 1 (או להשאיר ריק)", field: "per_customer" };

  const starts = startsRaw ? israelDayStart(startsRaw) : null;
  const ends = endsRaw ? israelDayEnd(endsRaw) : null;
  if (startsRaw && !starts) return { error: "תאריך התחלה לא תקין", field: "starts_at" };
  if (endsRaw && !ends) return { error: "תאריך סיום לא תקין", field: "ends_at" };
  if (starts && ends && ends < starts) return { error: "תאריך הסיום חייב להיות אחרי תאריך ההתחלה", field: "ends_at" };

  const sql = await db();
  const dup = await sql`select id from coupons where upper(code) = ${code} and id <> ${id || 0} limit 1`;
  if (dup[0]) return { error: `כבר קיים קופון עם הקוד ${code}. בחרו קוד אחר.`, field: "code" };

  const data = {
    code,
    description,
    type: type as Coupon["type"],
    value: value!,
    min_total: min_total || 0,
    max_discount,
    starts_at: starts ? starts.toISOString() : null,
    ends_at: ends ? ends.toISOString() : null,
    usage_limit,
    per_customer,
    active,
  };

  let savedId = id;
  try {
    if (id) {
      const old = await getCoupon(id);
      if (!old) return { error: "הקופון לא נמצא (אולי נמחק)" };
      await sql`
        update coupons set code=${code}, description=${description}, type=${type}, value=${data.value}, min_total=${data.min_total},
          max_discount=${max_discount}, starts_at=${data.starts_at}::timestamptz, ends_at=${data.ends_at}::timestamptz,
          usage_limit=${usage_limit}, per_customer=${per_customer}, active=${active}, updated_at=now()
        where id=${id}`;
      const d = diff(snap(old), snap(data));
      if (d.changed) await audit({ action: "update", entity: "coupon", entityId: id, summary: `עודכן הקופון ${code}`, before: d.before, after: d.after });
    } else {
      const r = await sql`
        insert into coupons (code, description, type, value, min_total, max_discount, starts_at, ends_at, usage_limit, per_customer, active)
        values (${code}, ${description}, ${type}, ${data.value}, ${data.min_total}, ${max_discount}, ${data.starts_at}::timestamptz,
                ${data.ends_at}::timestamptz, ${usage_limit}, ${per_customer}, ${active})
        returning id`;
      savedId = Number(r[0].id);
      await audit({ action: "create", entity: "coupon", entityId: savedId, summary: `נוצר קופון ${code}`, after: snap(data) });
    }
  } catch (e: any) {
    if (String(e?.code) === "23505") return { error: `כבר קיים קופון עם הקוד ${code}. בחרו קוד אחר.`, field: "code" };
    console.error(e);
    return { error: "לא הצלחנו לשמור את הקופון, נסו שוב" };
  }
  revalidatePath("/admin/coupons");
  redirect(`/admin/coupons?saved=${encodeURIComponent(code)}`);
}

export async function toggleCouponAction(fd: FormData) {
  requireAdmin();
  if (!hasDb()) return;
  const id = Number(fd.get("id"));
  const c = await getCoupon(id);
  if (!c) return;
  const sql = await db();
  await sql`update coupons set active = ${!c.active}, updated_at = now() where id=${id}`;
  await audit({
    action: "status",
    entity: "coupon",
    entityId: id,
    summary: `הקופון ${c.code} ${c.active ? "הושבת" : "הופעל"}`,
    before: { active: c.active },
    after: { active: !c.active },
  });
  revalidatePath("/admin/coupons");
}

export async function deleteCouponAction(fd: FormData) {
  requireAdmin();
  if (!hasDb()) return;
  const id = Number(fd.get("id"));
  const c = await getCoupon(id);
  if (!c) redirect("/admin/coupons");
  const sql = await db();
  const [{ n }] = await sql<{ n: string }[]>`select count(*)::text as n from orders where upper(coupon_code) = ${c!.code}`;
  if (c!.used > 0 || Number(n) > 0) {
    // Coupons that were used stay for reporting; they can only be disabled.
    redirect(`/admin/coupons?error=used`);
  }
  await sql`delete from coupons where id=${id}`;
  await audit({ action: "delete", entity: "coupon", entityId: id, summary: `נמחק הקופון ${c!.code}`, before: snap(c!) });
  revalidatePath("/admin/coupons");
  redirect(`/admin/coupons?deleted=${encodeURIComponent(c!.code)}`);
}
