"use server";

import crypto from "crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { hashPassword, requireAdmin, type AdminUser } from "@/lib/auth";
import { db, hasDb } from "@/lib/db";
import { audit } from "@/lib/admin";
import { MODULES, ROLES, permsFor, type Level, type Module, type PermissionMap } from "@/lib/permissions";

export type UserFormState = { error?: string; field?: string; created?: { name: string; email: string; password: string } } | null;
export type ResetState = { error?: string; password?: string; name?: string } | null;

const NO_DB = "מסד הנתונים לא מחובר – לא ניתן לנהל משתמשים כרגע";
const MIN_PW = 10;
const LEVEL_RANK: Record<string, number> = { view: 1, edit: 2 };

type Row = { id: number; email: string; name: string; role: string; permissions: Record<string, Level | null> | null; active: boolean };

const parseJson = (v: any) => (typeof v === "string" ? JSON.parse(v) : v);

async function getUser(id: number): Promise<Row | null> {
  const sql = await db();
  const [u] = await sql`select id, email, name, role, permissions, active from admin_users where id = ${id}`;
  if (!u) return null;
  return { id: Number(u.id), email: u.email, name: u.name || "", role: u.role, permissions: parseJson(u.permissions) || null, active: !!u.active };
}

const isOwner = (me: AdminUser) => me.role === "owner";
const effective = (role: string, custom: PermissionMap | Record<string, Level | null> | null) => permsFor(role, (custom as PermissionMap) || null);

/** Can `me` manage this (existing or resulting) user? Returns a Hebrew error or null. */
function guard(me: AdminUser, role: string, perms: PermissionMap): string | null {
  if (isOwner(me)) return null;
  if (role === "owner") return "רק המנהל הראשי יכול לנהל משתמשים בתפקיד מנהל ראשי";
  if (perms.users === "edit") return "רק המנהל הראשי יכול לתת או לנהל הרשאת עריכה למשתמשים והרשאות";
  for (const m of Object.keys(MODULES) as Module[]) {
    const want = perms[m];
    if (want && (LEVEL_RANK[want] || 0) > (LEVEL_RANK[me.perms[m] || ""] || 0)) return `אי אפשר לתת הרשאה גבוהה מההרשאה שלך (${MODULES[m]})`;
  }
  return null;
}

/** Strong random password, readable (no 0/O, 1/l/I). */
function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = crypto.randomBytes(14);
  let out = "";
  for (let i = 0; i < 14; i++) out += chars[bytes[i] % chars.length];
  return out.slice(0, 4) + "-" + out.slice(4, 9) + "-" + out.slice(9);
}

function readCustom(fd: FormData): Record<string, Level | null> | null {
  if (fd.get("custom") !== "on") return null;
  const out: Record<string, Level | null> = {};
  for (const m of Object.keys(MODULES)) {
    const v = String(fd.get(`perm_${m}`) || "none");
    out[m] = v === "edit" || v === "view" ? v : null;
  }
  return out;
}

/** Store only what differs from the role (null = explicitly no access). Returns null when nothing differs. */
function minimalOverride(role: string, custom: Record<string, Level | null> | null): Record<string, Level | null> | null {
  if (!custom) return null;
  const base = ROLES[role]?.perms || {};
  const out: Record<string, Level | null> = {};
  for (const m of Object.keys(MODULES) as Module[]) {
    const want = custom[m] ?? null;
    const has = base[m] ?? null;
    if (want !== has) out[m] = want;
  }
  return Object.keys(out).length ? out : null;
}

const snap = (u: { name: string; email: string; role: string; permissions: unknown; active: boolean }) => ({
  name: u.name,
  email: u.email,
  role: u.role,
  permissions: u.permissions ?? null,
  active: u.active,
});

export async function saveUserAction(_: UserFormState, fd: FormData): Promise<UserFormState> {
  const me = await requireAdmin("users");
  if (!hasDb()) return { error: NO_DB };

  const id = Number(fd.get("id")) || null;
  const name = String(fd.get("name") || "").trim().slice(0, 80);
  const email = String(fd.get("email") || "").trim().toLowerCase().slice(0, 160);
  let role = String(fd.get("role") || "");
  const password = String(fd.get("password") || "");
  let override = minimalOverride(role, readCustom(fd));
  const old = id ? await getUser(id) : null;
  if (id && !old) return { error: "המשתמש לא נמצא (אולי נמחק)" };
  // Nobody changes their own role or permissions (only name/email) – prevents self-escalation.
  if (old && old.id === me.id) {
    role = old.role;
    override = old.permissions;
  }

  if (!name) return { error: "יש להזין שם", field: "name" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "כתובת האימייל לא תקינה", field: "email" };
  if (!ROLES[role] && !(old && old.id === me.id)) return { error: "יש לבחור תפקיד", field: "role" };
  if (!id && password.length < MIN_PW) return { error: `הסיסמה צריכה להכיל לפחות ${MIN_PW} תווים`, field: "password" };
  if (!id && password.length > 200) return { error: "הסיסמה ארוכה מדי", field: "password" };

  const self = !!old && old.id === me.id;
  const g = self ? null : guard(me, role, effective(role, override));
  if (g) return { error: g, field: "role" };

  const sql = await db();
  const dup = await sql`select id from admin_users where lower(email) = ${email} and id <> ${id || 0} limit 1`;
  if (dup[0]) return { error: "כבר קיים משתמש עם האימייל הזה", field: "email" };

  try {
    if (id && old) {
      const og = self ? null : guard(me, old.role, effective(old.role, old.permissions));
      if (og) return { error: og };
      await sql`update admin_users set name = ${name}, email = ${email}, role = ${role}, permissions = ${override ? JSON.stringify(override) : null}::jsonb where id = ${id}`;
      const before = snap(old);
      const after = snap({ ...old, name, email, role, permissions: override });
      const permChanged = before.role !== after.role || JSON.stringify(before.permissions) !== JSON.stringify(after.permissions);
      const b: Record<string, unknown> = {}, a: Record<string, unknown> = {};
      for (const k of Object.keys(after) as (keyof typeof after)[]) if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) { b[k] = before[k]; a[k] = after[k]; }
      if (Object.keys(a).length) {
        await audit({
          action: permChanged ? "permission" : "update",
          entity: "user",
          entityId: id,
          summary: permChanged ? `עודכנו התפקיד/ההרשאות של ${name} (${ROLES[role].label})` : `עודכנו פרטי המשתמש ${name}`,
          before: b,
          after: a,
        });
      }
    } else {
      const r = await sql`
        insert into admin_users (email, name, password_hash, role, permissions, active)
        values (${email}, ${name}, ${hashPassword(password)}, ${role}, ${override ? JSON.stringify(override) : null}::jsonb, true)
        returning id`;
      await audit({ action: "create", entity: "user", entityId: Number(r[0].id), summary: `נוסף משתמש ${name} (${ROLES[role].label})`, after: snap({ name, email, role, permissions: override, active: true }) });
      revalidatePath("/admin/users");
      return { created: { name, email, password } };
    }
  } catch (e: any) {
    if (String(e?.code) === "23505") return { error: "כבר קיים משתמש עם האימייל הזה", field: "email" };
    console.error(e);
    return { error: "לא הצלחנו לשמור את המשתמש, נסו שוב" };
  }
  revalidatePath("/admin/users");
  redirect(`/admin/users?saved=${encodeURIComponent(name)}`);
}

export async function resetPasswordAction(_: ResetState, fd: FormData): Promise<ResetState> {
  const me = await requireAdmin("users");
  if (!hasDb()) return { error: NO_DB };
  const u = await getUser(Number(fd.get("id")));
  if (!u) return { error: "המשתמש לא נמצא" };
  const g = guard(me, u.role, effective(u.role, u.permissions));
  if (g) return { error: g };
  const password = generatePassword();
  const sql = await db();
  await sql`update admin_users set password_hash = ${hashPassword(password)} where id = ${u.id}`;
  await audit({ action: "update", entity: "user", entityId: u.id, summary: `אופסה הסיסמה של ${u.name || u.email}` });
  revalidatePath("/admin/users");
  return { password, name: u.name || u.email };
}

export async function toggleUserAction(fd: FormData) {
  const me = await requireAdmin("users");
  if (!hasDb()) return;
  const u = await getUser(Number(fd.get("id")));
  if (!u) return;
  if (u.id === me.id) redirect("/admin/users?error=self");
  if (guard(me, u.role, effective(u.role, u.permissions))) redirect("/admin/users?error=owner");
  const sql = await db();
  await sql`update admin_users set active = ${!u.active} where id = ${u.id}`;
  await audit({ action: "permission", entity: "user", entityId: u.id, summary: `המשתמש ${u.name || u.email} ${u.active ? "הושבת" : "הופעל"}`, before: { active: u.active }, after: { active: !u.active } });
  revalidatePath("/admin/users");
}

export async function deleteUserAction(fd: FormData) {
  const me = await requireAdmin("users");
  if (!hasDb()) return;
  const u = await getUser(Number(fd.get("id")));
  if (!u) redirect("/admin/users");
  if (u!.id === me.id) redirect("/admin/users?error=self");
  if (guard(me, u!.role, effective(u!.role, u!.permissions))) redirect("/admin/users?error=owner");
  const sql = await db();
  await sql`delete from admin_users where id = ${u!.id}`;
  await audit({ action: "delete", entity: "user", entityId: u!.id, summary: `נמחק המשתמש ${u!.name || u!.email}`, before: snap(u!) });
  revalidatePath("/admin/users");
  redirect(`/admin/users?deleted=${encodeURIComponent(u!.name || u!.email)}`);
}
