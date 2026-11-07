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

export async function login(_: { error?: string } | null, fd: FormData): Promise<{ error?: string }> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const pw = String(fd.get("password") || "");

  if (!email) {
    // Owner login with the store's admin password
    if (!checkPassword(pw)) {
      await logLogin(0, "", false);
      return { error: "סיסמה שגויה" };
    }
    startSession(0);
    await logLogin(0, "", true);
    await audit({ action: "login", entity: "user", entityId: 0, summary: "כניסה למערכת הניהול (מנהל ראשי)" });
    redirect("/admin");
  }

  // Team member login
  if (!hasDb()) return { error: "כניסת צוות דורשת מסד נתונים מחובר" };
  const sql = await db();
  const [u] = await sql`select id, name, password_hash, active from admin_users where lower(email) = ${email}`;
  if (!u || !u.active || !verifyPassword(pw, u.password_hash)) {
    await logLogin(u ? Number(u.id) : null, email, false);
    return { error: "האימייל או הסיסמה שגויים" };
  }
  startSession(Number(u.id));
  await sql`update admin_users set last_login = now() where id = ${u.id}`;
  await logLogin(Number(u.id), email, true);
  await audit({ action: "login", entity: "user", entityId: u.id, summary: `כניסה למערכת הניהול (${u.name || email})` });
  redirect("/admin");
}

export async function logout() {
  endSession();
  redirect("/admin");
}
