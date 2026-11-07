"use server";

import { headers } from "next/headers";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { db, hasDb } from "@/lib/db";
import { phoneKey } from "@/lib/admin";

export type ReviewFormState = { ok?: boolean; error?: string } | null;

const MAX_PER_DAY = 3;

/** Salted hash of the visitor's IP – used only for rate limiting; the IP itself is never stored. */
function ipHash(): string {
  try {
    const h = headers();
    const ip = (h.get("x-forwarded-for") || h.get("x-real-ip") || "").split(",")[0].trim();
    if (!ip) return "";
    return crypto.createHash("sha256").update(`${process.env.SESSION_SECRET || "quality-store"}|review|${ip}`).digest("hex").slice(0, 32);
  } catch {
    return "";
  }
}

/** Public: a customer writes a review. Always stored as 'pending' until approved in the admin. */
export async function submitReview(_: ReviewFormState, fd: FormData): Promise<ReviewFormState> {
  // honeypot field – real people never fill it
  if (String(fd.get("website") || "").trim()) return { ok: true };
  if (!hasDb()) return { error: "לא ניתן לשלוח ביקורת כרגע. נסי שוב מאוחר יותר." };

  const productId = Number(fd.get("product_id"));
  const name = String(fd.get("name") || "").trim().slice(0, 60);
  const phoneRaw = String(fd.get("phone") || "").trim().slice(0, 20);
  const phone = phoneKey(phoneRaw);
  const rating = Number(fd.get("rating"));
  const title = String(fd.get("title") || "").trim().slice(0, 120);
  const body = String(fd.get("body") || "").trim().slice(0, 2000);

  if (!Number.isInteger(productId) || productId <= 0) return { error: "המוצר לא נמצא" };
  if (!name) return { error: "נשמח לדעת את שמך" };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "יש לבחור דירוג בין 1 ל־5 כוכבים" };
  if (body.length < 3) return { error: "יש לכתוב כמה מילים על המוצר" };
  if (phoneRaw && (phone.length < 9 || phone.length > 12)) return { error: "מספר הטלפון לא תקין (אפשר גם להשאיר ריק)" };
  if (/(https?:\/\/|www\.)/i.test(body + " " + title)) return { error: "אי אפשר לכלול קישורים בביקורת" };

  const ip = ipHash();
  try {
    const sql = await db();
    const [p] = await sql`select id, slug from products where id = ${productId} and active = true`;
    if (!p) return { error: "המוצר לא נמצא" };

    // basic rate limit: max 3 reviews in 24h per phone and per IP (hashed)
    const [{ n }] = await sql`
      select count(*)::int as n from reviews
      where created_at > now() - interval '1 day'
        and ((${phone} <> '' and phone = ${phone}) or (${ip} <> '' and ip_hash = ${ip}))`;
    if (Number(n) >= MAX_PER_DAY) return { error: "שלחת כבר כמה ביקורות היום. אפשר לנסות שוב מחר." };

    let verified = false;
    if (phone) {
      const [o] = await sql`
        select 1 from orders o, jsonb_array_elements(o.items) it
        where regexp_replace(o.phone, '[^0-9]', '', 'g') = ${phone}
          and o.status = 'delivered'
          and (it->>'productId')::int = ${productId}
        limit 1`;
      verified = !!o;
    }

    await sql`
      insert into reviews (product_id, name, phone, rating, title, body, verified, status, ip_hash)
      values (${productId}, ${name}, ${phone}, ${rating}, ${title}, ${body}, ${verified}, 'pending', ${ip})`;
    revalidatePath("/admin/reviews");
    return { ok: true };
  } catch (e) {
    console.error("review submit failed", e);
    return { error: "השליחה נכשלה. נסי שוב בעוד רגע." };
  }
}

/** Public: flag a review for the store to check. */
export async function reportReview(id: number): Promise<{ ok?: boolean }> {
  const rid = Number(id);
  if (!hasDb() || !Number.isInteger(rid) || rid <= 0) return {};
  try {
    const sql = await db();
    await sql`update reviews set reported = true where id = ${rid} and status = 'approved'`;
    revalidatePath("/admin/reviews");
    return { ok: true };
  } catch (e) {
    console.error("review report failed", e);
    return {};
  }
}
