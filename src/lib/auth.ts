import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE = "q_admin";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

export function adminPasswordSet(): boolean {
  return !!process.env.ADMIN_PASSWORD;
}

function sign(value: string): string {
  const secret = (process.env.ADMIN_PASSWORD || "") + "|" + (process.env.SESSION_SECRET || "quality-store");
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function isAdmin(): boolean {
  if (!adminPasswordSet()) return false;
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return false;
  const [ts, sig] = raw.split(".");
  if (!ts || !sig) return false;
  const expected = sign(ts);
  if (sig.length !== expected.length) return false;
  const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  return ok && Date.now() - Number(ts) < MAX_AGE * 1000;
}

export function checkPassword(pw: string): boolean {
  const real = process.env.ADMIN_PASSWORD || "";
  if (!real) return false;
  const a = Buffer.from(crypto.createHash("sha256").update(pw).digest("hex"));
  const b = Buffer.from(crypto.createHash("sha256").update(real).digest("hex"));
  return crypto.timingSafeEqual(a, b);
}

export function startSession() {
  const ts = String(Date.now());
  cookies().set(COOKIE, `${ts}.${sign(ts)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export function endSession() {
  cookies().delete(COOKIE);
}

export function requireAdmin() {
  if (!isAdmin()) throw new Error("Unauthorized");
}
