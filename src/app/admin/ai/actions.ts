"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db, hasDb } from "@/lib/db";
import { audit } from "@/lib/admin";
import { AI_HOURLY_LIMIT, SYSTEM_PROMPT, aiConfigured, buildStoreContext, callClaude, takeAiQuota, type AiMessage } from "@/lib/ai";
import { CATEGORIES, COLORS } from "@/lib/config";

export type AiReply = { text?: string; error?: string };

const MAX_MSG = 6000;
const MAX_HISTORY = 10;

function cleanHistory(raw: unknown): AiMessage[] {
  if (!Array.isArray(raw)) return [];
  const msgs = raw
    .filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map((m: any) => ({ role: m.role as AiMessage["role"], content: String(m.content).slice(0, MAX_MSG) }))
    .slice(-MAX_HISTORY);
  // The API needs the conversation to start with the user and alternate roles.
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  const out: AiMessage[] = [];
  for (const m of msgs) {
    if (out.length && out[out.length - 1].role === m.role) out[out.length - 1] = { role: m.role, content: out[out.length - 1].content + "\n\n" + m.content };
    else out.push(m);
  }
  return out;
}

async function quotaOrError(userId: number): Promise<string | null> {
  const q = await takeAiQuota(userId);
  return q.ok ? null : `הגעת למגבלה של ${AI_HOURLY_LIMIT} בקשות AI בשעה. אפשר לנסות שוב בתחילת השעה הבאה.`;
}

/** Chat with the store assistant. The conversation lives in the browser; the last ~10 messages are sent. */
export async function askAiAction(input: { messages: AiMessage[]; productId?: number | null }): Promise<AiReply> {
  const me = await requireAdmin("ai");
  if (!aiConfigured()) return { error: "עוזר ה־AI לא מחובר. יש להוסיף ב־Vercel את המשתנה ANTHROPIC_API_KEY." };
  const messages = cleanHistory(input?.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") return { error: "יש לכתוב שאלה או בקשה" };
  const limited = await quotaOrError(me.id);
  if (limited) return { error: limited };

  const pid = Number(input?.productId) || null;
  const context = await buildStoreContext(pid);
  const system = `${SYSTEM_PROMPT}\n\n=== נתוני החנות (מתוך מסד הנתונים, נכון לעכשיו) ===\n${context}`;
  const r = await callClaude({ system, messages, maxTokens: 1800 });
  return r.error ? { error: r.error } : { text: r.text };
}

/** Draft a product description for the product editor (returns text only – nothing is saved here). */
export async function draftProductDescriptionAction(input: {
  productId?: number | null;
  name: string;
  category?: string;
  color?: string;
  heel?: string | number | null;
  price?: string | number | null;
  current?: string;
}): Promise<AiReply> {
  const me = await requireAdmin("ai");
  if (!aiConfigured()) return { error: "עוזר ה־AI לא מחובר. יש להוסיף ב־Vercel את המשתנה ANTHROPIC_API_KEY ולפרוס מחדש." };
  const name = String(input?.name || "").trim().slice(0, 140);
  if (!name) return { error: "כדי לכתוב תיאור, יש למלא קודם את שם המוצר" };
  const limited = await quotaOrError(me.id);
  if (limited) return { error: limited };

  // categories/colors may be admin-managed now, so fall back to the raw key (sanitized) when not in config
  const raw = (v: unknown) => String(v || "").replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 40);
  const cat = CATEGORIES[String(input?.category || "")] || raw(input?.category);
  const color = COLORS[String(input?.color || "")]?.label || (input?.color === "other" ? "" : raw(input?.color));
  const heel = Number(input?.heel) || null;
  const price = Number(input?.price) || null;
  const current = String(input?.current || "").trim().slice(0, 2000);
  const facts = [
    `שם: ${name}`,
    cat && `קטגוריה: ${cat}`,
    color && `צבע: ${color}`,
    heel && `גובה עקב: ${heel} ס״מ`,
    price && `מחיר: ₪${price}`,
    current && `התיאור הנוכחי (לשיפור): ${current}`,
  ].filter(Boolean).join("\n");

  const prompt = `כתוב/י תיאור מוצר לדף המוצר באתר, בעברית, 60–110 מילים, 2–3 פסקאות קצרות.
השתמש/י רק בפרטים שלמטה. אל תמציא/י חומרים, טכנולוגיות או מידות שלא צוינו. אפשר להציע שילובי לבוש ואירועים מתאימים.
החזר/י את טקסט התיאור בלבד – בלי כותרת, בלי הקדמה ובלי מרכאות.

${facts}`;
  const r = await callClaude({ system: SYSTEM_PROMPT, messages: [{ role: "user", content: prompt }], maxTokens: 700 });
  return r.error ? { error: r.error } : { text: r.text };
}

/** Save an AI reply into a product's description – only after the admin confirmed in the UI. Never changes visibility. */
export async function saveAiDraftToProductAction(input: { productId: number; text: string; mode: "replace" | "append" }): Promise<{ ok?: boolean; error?: string; name?: string }> {
  await requireAdmin("ai");
  await requireAdmin("products");
  if (!hasDb()) return { error: "מסד הנתונים לא מחובר, לא ניתן לשמור" };
  const id = Number(input?.productId);
  const text = String(input?.text || "").trim();
  if (!Number.isInteger(id) || id <= 0) return { error: "יש לבחור מוצר" };
  if (!text) return { error: "אין טקסט לשמירה" };
  if (text.length > 5000) return { error: "הטקסט ארוך מדי לתיאור מוצר (עד 5,000 תווים)" };
  const sql = await db();
  const [p] = await sql`select id, slug, name, description from products where id = ${id}`;
  if (!p) return { error: "המוצר לא נמצא" };
  const next = input.mode === "append" && p.description ? `${String(p.description).trim()}\n\n${text}` : text;
  await sql`update products set description = ${next}, updated_at = now() where id = ${id}`;
  await audit({
    action: "update",
    entity: "product",
    entityId: id,
    summary: `תיאור המוצר ${p.name} עודכן מטיוטת עוזר AI`,
    before: { description: p.description },
    after: { description: next },
  });
  revalidatePath(`/admin/products/${id}`);
  revalidatePath(`/product/${p.slug}`);
  return { ok: true, name: p.name };
}
