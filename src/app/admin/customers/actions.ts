"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db, hasDb } from "@/lib/db";
import { audit } from "@/lib/admin";
import { getCustomerRaw, normIsraeliMobile } from "@/lib/admin-orders";

export type CustResult = { ok?: boolean; error?: string; message?: string } | null;

const str = (v: FormDataEntryValue | null, max = 500) => String(v ?? "").trim().slice(0, max);
const intId = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? ""));
  return Number.isInteger(n) && n > 0 ? n : null;
};
const emailOk = (e: string) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const cleanTag = (t: string) => t.replace(/[,<>"]/g, "").replace(/\s+/g, " ").trim().slice(0, 30);

function refresh(id?: number) {
  revalidatePath("/admin/customers");
  if (id) revalidatePath(`/admin/customers/${id}`);
}

export async function createCustomerAction(_: CustResult, fd: FormData): Promise<CustResult> {
  await requireAdmin("customers");
  if (!hasDb()) return { error: "מסד הנתונים לא מחובר" };
  const name = str(fd.get("name"), 120);
  const phone = normIsraeliMobile(str(fd.get("phone"), 30));
  const email = str(fd.get("email"), 160);
  const city = str(fd.get("city"), 80);
  const notes = str(fd.get("notes"), 2000);
  const consent = fd.get("marketing_consent") === "on";
  if (!name) return { error: "יש להזין שם" };
  if (!phone) return { error: "מספר נייד לא תקין – 10 ספרות שמתחילות ב־05" };
  if (!emailOk(email)) return { error: "כתובת המייל לא תקינה" };
  const sql = await db();
  const dup = await sql`select id, name from customers where phone = ${phone} limit 1`;
  if (dup[0]) return { error: `כבר קיים לקוח עם המספר הזה (${dup[0].name || "ללא שם"}) – מספר כרטיס ${dup[0].id}` };
  const r = await sql`
    insert into customers (phone, name, email, city, notes, marketing_consent)
    values (${phone}, ${name}, ${email}, ${city}, ${notes}, ${consent})
    on conflict (phone) do nothing returning id`;
  if (!r[0]) return { error: "כבר קיים לקוח עם המספר הזה" };
  const id = Number(r[0].id);
  await audit({ action: "create", entity: "customer", entityId: id, summary: `לקוח חדש נוסף ידנית: ${name}`, after: { name, phone, email, city, marketing_consent: consent } });
  refresh();
  redirect(`/admin/customers/${id}?saved=1`);
}

export async function updateCustomerAction(_: CustResult, fd: FormData): Promise<CustResult> {
  await requireAdmin("customers");
  if (!hasDb()) return { error: "מסד הנתונים לא מחובר" };
  const id = intId(fd.get("id"));
  if (!id) return { error: "לקוח לא תקין" };
  const before = await getCustomerRaw(id);
  if (!before) return { error: "הלקוח לא נמצא" };
  const name = str(fd.get("name"), 120);
  const phone = normIsraeliMobile(str(fd.get("phone"), 30));
  const email = str(fd.get("email"), 160);
  const city = str(fd.get("city"), 80);
  const bdRaw = str(fd.get("birthday"), 10);
  const birthday = /^\d{4}-\d{2}-\d{2}$/.test(bdRaw) ? bdRaw : null;
  if (!name) return { error: "יש להזין שם" };
  if (!phone) return { error: "מספר נייד לא תקין – 10 ספרות שמתחילות ב־05" };
  if (!emailOk(email)) return { error: "כתובת המייל לא תקינה" };
  const sql = await db();
  if (phone !== before.phone) {
    const dup = await sql`select id from customers where phone = ${phone} and id <> ${id} limit 1`;
    if (dup[0]) return { error: "המספר הזה כבר שייך ללקוח אחר" };
  }
  await sql`update customers set name = ${name}, phone = ${phone}, email = ${email}, city = ${city}, birthday = ${birthday}, updated_at = now() where id = ${id}`;
  await audit({
    action: "update",
    entity: "customer",
    entityId: id,
    summary: `פרטי הלקוח ${name} עודכנו${phone !== before.phone ? " (כולל מספר טלפון)" : ""}`,
    before: { name: before.name, phone: before.phone, email: before.email, city: before.city },
    after: { name, phone, email, city },
  });
  refresh(id);
  return { ok: true, message: phone !== before.phone ? "נשמר. שימו לב: הזמנות קודמות מקושרות לפי מספר הטלפון שבהן." : "הפרטים נשמרו" };
}

export async function saveCustomerNotesAction(_: CustResult, fd: FormData): Promise<CustResult> {
  await requireAdmin("customers");
  if (!hasDb()) return { error: "מסד הנתונים לא מחובר" };
  const id = intId(fd.get("id"));
  const notes = str(fd.get("notes"), 4000);
  if (!id) return { error: "לקוח לא תקין" };
  const before = await getCustomerRaw(id);
  if (!before) return { error: "הלקוח לא נמצא" };
  if (before.notes === notes) return { ok: true, message: "לא בוצע שינוי" };
  const sql = await db();
  await sql`update customers set notes = ${notes}, updated_at = now() where id = ${id}`;
  await audit({ action: "update", entity: "customer", entityId: id, summary: `הערות פנימיות עודכנו ללקוח ${before.name}`, before: { notes: before.notes }, after: { notes } });
  refresh(id);
  return { ok: true, message: "ההערות נשמרו" };
}

export async function customerTagAction(fd: FormData) {
  await requireAdmin("customers");
  if (!hasDb()) return;
  const id = intId(fd.get("id"));
  const op = str(fd.get("op"));
  const tag = cleanTag(str(fd.get("tag"), 60));
  if (!id || !tag) return;
  const before = await getCustomerRaw(id);
  if (!before) return;
  let tags = before.tags.slice();
  if (op === "remove") tags = tags.filter((t) => t !== tag);
  else if (!tags.includes(tag)) tags = [...tags, tag].slice(0, 20);
  if (tags.length === before.tags.length && tags.every((t, i) => t === before.tags[i])) return;
  const sql = await db();
  await sql`update customers set tags = ${JSON.stringify(tags)}::jsonb, updated_at = now() where id = ${id}`;
  await audit({ action: "update", entity: "customer", entityId: id, summary: `${op === "remove" ? "הוסרה" : "נוספה"} תגית "${tag}" ללקוח ${before.name}`, before: { tags: before.tags }, after: { tags } });
  refresh(id);
}

export async function customerConsentAction(fd: FormData) {
  await requireAdmin("customers");
  if (!hasDb()) return;
  const id = intId(fd.get("id"));
  const value = fd.get("value") === "1";
  if (!id) return;
  const before = await getCustomerRaw(id);
  if (!before || before.marketing_consent === value) return;
  const sql = await db();
  await sql`update customers set marketing_consent = ${value}, updated_at = now() where id = ${id}`;
  await audit({
    action: "update",
    entity: "customer",
    entityId: id,
    summary: `${before.name}: הסכמה לדיוור ${value ? "סומנה" : "הוסרה"} ע״י מנהל`,
    before: { marketing_consent: before.marketing_consent },
    after: { marketing_consent: value },
  });
  refresh(id);
}

export async function customerArchiveAction(fd: FormData) {
  await requireAdmin("customers");
  if (!hasDb()) return;
  const id = intId(fd.get("id"));
  const value = fd.get("value") === "1";
  if (!id) return;
  const before = await getCustomerRaw(id);
  if (!before || before.archived === value) return;
  const sql = await db();
  await sql`update customers set archived = ${value}, updated_at = now() where id = ${id}`;
  await audit({ action: "update", entity: "customer", entityId: id, summary: `הלקוח ${before.name} ${value ? "הועבר לארכיון" : "הוחזר מהארכיון"}`, before: { archived: before.archived }, after: { archived: value } });
  refresh(id);
}
