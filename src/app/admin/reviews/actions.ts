"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db, hasDb } from "@/lib/db";
import { audit } from "@/lib/admin";

export type ReviewResult = { ok?: string; error?: string };

const NO_DB = "מסד הנתונים לא מחובר, ולכן אי אפשר לשמור שינויים.";

const STATUS_LABEL: Record<string, string> = { approved: "אושרה", rejected: "נדחתה", hidden: "הוסתרה", pending: "הוחזרה להמתנה" };

async function revalidateFor(productIds: number[]) {
  revalidatePath("/admin/reviews");
  revalidatePath("/shop");
  revalidatePath("/");
  if (!productIds.length) return;
  try {
    const sql = await db();
    const rows = await sql`select slug from products where id in ${sql(productIds)}`;
    for (const r of rows) revalidatePath(`/product/${r.slug}`);
  } catch {
    /* best effort */
  }
}

const cleanIds = (ids: unknown) =>
  Array.from(new Set((Array.isArray(ids) ? ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))).slice(0, 500);

/** One action entry point for all single-review operations. */
export async function reviewAction(id: number, op: "approved" | "rejected" | "hidden" | "pending" | "delete" | "clear_report" | "reply", reply?: string): Promise<ReviewResult> {
  await requireAdmin("reviews");
  if (!hasDb()) return { error: NO_DB };
  const rid = Number(id);
  if (!Number.isInteger(rid) || rid <= 0) return { error: "ביקורת לא תקינה" };
  const sql = await db();
  const [r] = await sql`
    select r.id, r.product_id, r.name, r.rating, r.status, r.reply, r.reported, p.name as product_name
    from reviews r left join products p on p.id = r.product_id where r.id = ${rid}`;
  if (!r) return { error: "הביקורת לא נמצאה – ייתכן שנמחקה" };
  const who = `${r.name || "לקוחה"} (${r.rating}★) על ${r.product_name || `מוצר ${r.product_id}`}`;

  if (op === "delete") {
    await sql`delete from reviews where id = ${rid}`;
    await audit({ action: "delete", entity: "review", entityId: rid, summary: `נמחקה ביקורת של ${who}`, before: { status: r.status, rating: r.rating, name: r.name } });
    await revalidateFor([Number(r.product_id)]);
    return { ok: "הביקורת נמחקה" };
  }
  if (op === "clear_report") {
    await sql`update reviews set reported = false where id = ${rid}`;
    await audit({ action: "update", entity: "review", entityId: rid, summary: `נוקה דיווח על ביקורת של ${who}`, before: { reported: true }, after: { reported: false } });
    await revalidateFor([Number(r.product_id)]);
    return { ok: "הדיווח נוקה" };
  }
  if (op === "reply") {
    const text = String(reply ?? "").trim().slice(0, 1500);
    if (text === String(r.reply || "")) return { ok: "לא היו שינויים" };
    if (text) await sql`update reviews set reply = ${text}, reply_at = now() where id = ${rid}`;
    else await sql`update reviews set reply = '', reply_at = null where id = ${rid}`;
    await audit({ action: "update", entity: "review", entityId: rid, summary: text ? `${r.reply ? "עודכנה" : "נוספה"} תגובת החנות לביקורת של ${who}` : `הוסרה תגובת החנות מביקורת של ${who}`, before: { reply: r.reply || "" }, after: { reply: text } });
    await revalidateFor([Number(r.product_id)]);
    return { ok: text ? "התגובה נשמרה" : "התגובה הוסרה" };
  }
  if (!(op in STATUS_LABEL)) return { error: "פעולה לא מוכרת" };
  if (r.status === op) return { ok: "ללא שינוי" };
  await sql`update reviews set status = ${op} where id = ${rid}`;
  await audit({ action: "status", entity: "review", entityId: rid, summary: `ביקורת של ${who} ${STATUS_LABEL[op]}`, before: { status: r.status }, after: { status: op } });
  await revalidateFor([Number(r.product_id)]);
  return { ok: `הביקורת ${STATUS_LABEL[op]}` };
}

export async function bulkReviews(ids: number[], op: "approved" | "rejected"): Promise<ReviewResult> {
  await requireAdmin("reviews");
  if (!hasDb()) return { error: NO_DB };
  if (op !== "approved" && op !== "rejected") return { error: "פעולה לא מוכרת" };
  const clean = cleanIds(ids);
  if (!clean.length) return { error: "לא נבחרו ביקורות" };
  const sql = await db();
  const rows = await sql`update reviews set status = ${op} where id in ${sql(clean)} and status <> ${op} returning id, product_id`;
  if (!rows.length) return { ok: "לא היו ביקורות לעדכן" };
  await audit({
    action: "bulk",
    entity: "review",
    entityId: rows.map((r: any) => r.id).join(","),
    summary: `פעולה מרוכזת: ${rows.length} ביקורות ${op === "approved" ? "אושרו" : "נדחו"}`,
    after: { status: op, ids: rows.map((r: any) => Number(r.id)) },
  });
  await revalidateFor(Array.from(new Set(rows.map((r: any) => Number(r.product_id)))));
  return { ok: `${rows.length} ביקורות ${op === "approved" ? "אושרו" : "נדחו"}` };
}
