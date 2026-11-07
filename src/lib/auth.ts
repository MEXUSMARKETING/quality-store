import { cookies, headers } from "next/headers";
import crypto from "crypto";
import { cache } from "react";
import { db, hasDb } from "./db";
import { can, permsFor, type Level, type Module, type PermissionMap } from "./permissions";

/* Admin authentication.
   - The owner logs in with ADMIN_PASSWORD (no email) – full access, works even without a DB.
   - Team members log in with email + password (table admin_users, scrypt hashes) and get the
     permissions of their role, optionally overridden per user.
   The session cookie is HMAC-signed: v2.<timestamp>.<userId>.<sig>  (userId 0 = owner). */

const COOKIE = "q_admin";
const MAX_AGE = 60 * 60 * 24 * 14; // 14 days

export type AdminUser = { id: number; name: string; email: string; role: string; perms: PermissionMap };

export function adminPasswordSet(): boolean {
  return !!process.env.ADMIN_PASSWORD;
}

function sign(value: string): string {
  const secret = (process.env.ADMIN_PASSWORD || "") + "|" + (process.env.SESSION_SECRET || "quality-store");
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function safeEq(a: string, b: string) {
  return a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/** Parse and verify the cookie. Returns the user id (0 = owner) or null. */
function sessionUserId(): number | null {
  if (!adminPasswordSet()) return null;
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(".");
  let ts: string, uid: string, sig: string;
  if (parts.length === 2) {
    // legacy owner cookie: <ts>.<sig>
    [ts, sig] = parts;
    uid = "0";
    if (!safeEq(sig, sign(ts))) return null;
  } else if (parts.length === 4 && parts[0] === "v2") {
    [, ts, uid, sig] = parts;
    if (!safeEq(sig, sign(`v2.${ts}.${uid}`))) return null;
  } else return null;
  if (!(Date.now() - Number(ts) < MAX_AGE * 1000)) return null;
  const id = Number(uid);
  return Number.isInteger(id) && id >= 0 ? id : null;
}

/** The signed-in admin (owner or team member), re-validated against the DB once per request. */
export const currentAdmin = cache(async (): Promise<AdminUser | null> => {
  const id = sessionUserId();
  if (id === null) return null;
  if (id === 0) return { id: 0, name: "מנהל ראשי", email: "", role: "owner", perms: permsFor("owner") };
  if (!hasDb()) return null;
  try {
    const sql = await db();
    const [u] = await sql`select id, name, email, role, permissions, active from admin_users where id = ${id}`;
    if (!u || !u.active) return null;
    const custom = typeof u.permissions === "string" ? JSON.parse(u.permissions) : u.permissions;
    return { id: Number(u.id), name: u.name || u.email, email: u.email, role: u.role, perms: permsFor(u.role, custom) };
  } catch (e) {
    console.error("currentAdmin failed", e);
    return null;
  }
});

/** Quick check used by pages before rendering admin content (cookie signature only). */
export function isAdmin(): boolean {
  return sessionUserId() !== null;
}

/**
 * Server-side guard for every admin server action and route handler.
 * Throws when not signed in, the user was disabled, or lacks the permission.
 * ALWAYS await it.
 */
export async function requireAdmin(module?: Module, level: Level = "edit"): Promise<AdminUser> {
  const u = await currentAdmin();
  if (!u) throw new Error("Unauthorized");
  if (module && !can(u.perms, module, level)) throw new Error("Forbidden");
  return u;
}

export function checkPassword(pw: string): boolean {
  const real = process.env.ADMIN_PASSWORD || "";
  if (!real) return false;
  const a = Buffer.from(crypto.createHash("sha256").update(pw).digest("hex"));
  const b = Buffer.from(crypto.createHash("sha256").update(real).digest("hex"));
  return crypto.timingSafeEqual(a, b);
}

/* ---------------- team member passwords (scrypt) ---------------- */

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, salt, hash] = String(stored || "").split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const test = crypto.scryptSync(pw, salt, 64).toString("hex");
  return safeEq(test, hash);
}

export function startSession(userId = 0) {
  const ts = String(Date.now());
  const payload = `v2.${ts}.${userId}`;
  cookies().set(COOKIE, `${payload}.${sign(payload)}`, {
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

/** Best-effort request info for the login history. */
export function requestMeta() {
  try {
    const h = headers();
    const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim();
    // keep the first two octets only – enough to recognise a network, without storing a full IP
    const masked = ip.includes(".") ? ip.split(".").slice(0, 2).join(".") + ".x.x" : ip ? ip.slice(0, 9) + "…" : "";
    return { ip: masked, userAgent: (h.get("user-agent") || "").slice(0, 200) };
  } catch {
    return { ip: "", userAgent: "" };
  }
}

/** Non-throwing permission check for route handlers and pages. */
export async function hasPermission(module: Module, level: Level = "view"): Promise<boolean> {
  const u = await currentAdmin();
  return !!u && can(u.perms, module, level);
}
