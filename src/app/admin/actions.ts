"use server";

import { redirect } from "next/navigation";
import { checkPassword, endSession, requireAdmin, startSession } from "@/lib/auth";
import { audit } from "@/lib/admin";

export async function login(_: { error?: string } | null, fd: FormData): Promise<{ error?: string }> {
  const pw = String(fd.get("password") || "");
  if (!checkPassword(pw)) return { error: "סיסמה שגויה" };
  startSession();
  await audit({ action: "login", entity: "user", summary: "כניסה למערכת הניהול" });
  redirect("/admin");
}

export async function logout() {
  endSession();
  redirect("/admin");
}
