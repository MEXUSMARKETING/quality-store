"use server";

import { redirect } from "next/navigation";
import { checkPassword, endSession, requestMeta, startSession, verifyPassword } from "@/lib/auth";
import { audit } from "@/lib/admin";
import { db, hasDb } from "@/lib/db";

async function logLogin(userId: number | null, email: string, ok: boolean) {
  if (!hasDb()) return;
  try {
    const sql = await db();
    const { ip, userAgent } = requestMeta();
    await sql`insert into login_history (user_id, email, ok, ip, user_agent) values (${userId}, ${email}, ${ok}, ${ip}, ${userAgent})`;
  } catch (e) {
    console.error("login history failed", e);
  }
}

/** Owner's username (the owner signs in with ADMIN_PASSWORD). Team members sign in with their email. */
function ownerUsername() {
  return (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
}

const LOCK_ATTEMPTS = 8;
const LOCK_MINUTES = 10;

/** Too many wrong passwords for this username recently? (brute-force protection) */
async function lockedOut(username: string): Promise<boolean> {
  if (!hasDb()) return false;
  try {
    const sql = await db();
    const [r] = await sql`select count(*)::int as n from login_history
      where email = ${username} and ok = false and created_at > now() - make_interval(mins => ${LOCK_MINUTES})`;
    return Number(r?.n || 0) >= LOCK_ATTEMPTS;
  } catch {
    return false;
  }
}

export async function login(_: { error?: string } | null, fd: FormData): Promise<{ error?: string }> {
  const username = String(fd.get("username") ?? fd.get("email") ?? "").trim().toLowerCase();
  const pw = String(fd.get("password") || "");
  if (!pw) return { error: "נא להזין סיסמה" };
  const isOwner = !username || username === ownerUsername();
  const key = isOwner ? ownerUsername() : username;

  if (await lockedOut(key)) {
    return { error: `יותר מדי ניסיונות כניסה שגויים. מטעמי אבטחה הכניסה נחסמה ל־${LOCK_MINUTES} דקות.` };
  }

  if (isOwner) {
    // Owner login with the store's admin password
    if (!checkPassword(pw)) {
      await logLogin(0, key, false);
      return { error: "שם המשתמש או הסיסמה שגויים" };
    }
    startSession(0);
    await logLogin(0, key, true);
    await audit({ action: "login", entity: "user", entityId: 0, summary: "כניסה למערכת הניהול (מנהל ראשי)" });
    redirect("/admin");
  }

  // Team member login (username = their email)
  if (!hasDb()) return { error: "כניסת צוות דורשת מסד נתונים מחובר" };
  const sql = await db();
  const [u] = await sql`select id, name, password_hash, active from admin_users where lower(email) = ${username}`;
  if (!u || !u.active || !verifyPassword(pw, u.password_hash)) {
    await logLogin(u ? Number(u.id) : null, username, false);
    return { error: "שם המשתמש או הסיסמה שגויים" };
  }
  startSession(Number(u.id));
  await sql`update admin_users set last_login = now() where id = ${u.id}`;
  await logLogin(Number(u.id), username, true);
  await audit({ action: "login", entity: "user", entityId: u.id, summary: `כניסה למערכת הניהול (${u.name || username})` });
  redirect("/admin");
}

export async function logout() {
  endSession();
  redirect("/admin");
}
