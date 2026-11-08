import { db, hasDb } from "./db";
import { CATEGORIES, COLORS, STORE } from "./config";

/* AI assistant – Anthropic Messages API, called from the server only (the key never reaches the browser).
   Env: ANTHROPIC_API_KEY (required), AI_MODEL (optional, default below). */

export const DEFAULT_AI_MODEL = "claude-sonnet-4-5";
export const AI_HOURLY_LIMIT = 30;

/** The Anthropic key. Also accepts a variable whose name was pasted twice by mistake. */
export function aiKey(): string {
  return (process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEYANTHROPIC_API_KEY || "").trim();
}

export function aiConfigured(): boolean {
  return !!aiKey();
}

export function aiModel(): string {
  return (process.env.AI_MODEL || "").trim() || DEFAULT_AI_MODEL;
}

/** Text, or content blocks (text + images) for vision requests. */
export type AiContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } | { type: "url"; url: string } };
export type AiMessage = { role: "user" | "assistant"; content: string | AiContentBlock[] };
export type AiResult = { text: string; error?: undefined } | { text?: undefined; error: string };

/** One call to the Messages API. Never throws – returns a Hebrew error instead. */
export async function callClaude(opts: { system: string; messages: AiMessage[]; maxTokens?: number; timeoutMs?: number }): Promise<AiResult> {
  const key = aiKey();
  if (!key) return { error: "עוזר ה־AI עדיין לא מחובר: יש להוסיף ב־Vercel את המשתנה ANTHROPIC_API_KEY ולפרוס מחדש." };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || 25_000);
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: aiModel(), max_tokens: opts.maxTokens || 1500, system: opts.system, messages: opts.messages }),
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      console.error("anthropic error", r.status, body.slice(0, 500));
      if (r.status === 401 || r.status === 403) return { error: "מפתח ה־API של Anthropic לא תקין או חסרות לו הרשאות. בדקו את ANTHROPIC_API_KEY ב־Vercel." };
      if (r.status === 404 || (r.status === 400 && /model/i.test(body))) return { error: `המודל "${aiModel()}" לא זמין בחשבון. בדקו את המשתנה AI_MODEL ב־Vercel.` };
      if (r.status === 429) return { error: "חרגנו ממגבלת הקריאות של Anthropic. נסו שוב בעוד דקה." };
      if (r.status === 529 || r.status >= 500) return { error: "שירות ה־AI עמוס כרגע. נסו שוב בעוד רגע." };
      return { error: "הבקשה לשירות ה־AI נכשלה. נסו לקצר את ההודעה ולשלוח שוב." };
    }
    const data = await r.json();
    const text = Array.isArray(data?.content)
      ? data.content.filter((b: any) => b?.type === "text").map((b: any) => String(b.text || "")).join("\n").trim()
      : "";
    if (!text) return { error: "לא התקבלה תשובה מה־AI. נסו שוב." };
    return { text };
  } catch (e: any) {
    if (e?.name === "AbortError") return { error: "התשובה מה־AI התעכבה יותר מדי. נסו בקשה קצרה יותר." };
    console.error("anthropic fetch failed", e);
    return { error: "לא הצלחנו להתחבר לשירות ה־AI. נסו שוב." };
  } finally {
    clearTimeout(timer);
  }
}

/** Ask for JSON only and parse the first JSON object in the answer. */
export async function callClaudeJson<T = any>(opts: { system: string; messages: AiMessage[]; maxTokens?: number; timeoutMs?: number }): Promise<{ data: T; error?: undefined } | { data?: undefined; error: string }> {
  const r = await callClaude(opts);
  if (r.error) return { error: r.error };
  const t = r.text!;
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return { error: "ה־AI החזיר תשובה לא צפויה. נסו שוב." };
  try {
    return { data: JSON.parse(t.slice(start, end + 1)) as T };
  } catch {
    return { error: "ה־AI החזיר תשובה לא צפויה. נסו שוב." };
  }
}

/* ---------------- rate limit (per admin user, fixed 1-hour windows, atomic counter in `settings`) ---------------- */

/** Counts one AI call. Returns false when the user already used AI_HOURLY_LIMIT calls this hour. */
export async function takeAiQuota(userId: number): Promise<{ ok: boolean; used: number }> {
  if (!hasDb()) return { ok: true, used: 0 }; // nothing to count against; the owner is the only possible user then
  try {
    const sql = await db();
    const window = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH (UTC)
    const key = `ai_usage:${userId}`;
    const [row] = await sql`
      insert into settings (key, value, updated_at) values (${key}, jsonb_build_object('w', ${window}::text, 'n', 1), now())
      on conflict (key) do update set
        value = case when settings.value->>'w' = ${window}::text
                     then jsonb_build_object('w', ${window}::text, 'n', coalesce((settings.value->>'n')::int, 0) + 1)
                     else jsonb_build_object('w', ${window}::text, 'n', 1) end,
        updated_at = now()
      returning (value->>'n')::int as n`;
    const n = Number(row?.n || 0);
    return { ok: n <= AI_HOURLY_LIMIT, used: n };
  } catch (e) {
    console.error("ai quota failed", e);
    return { ok: true, used: 0 };
  }
}

/* ---------------- store context for the assistant ---------------- */

const n = (v: unknown) => Number(v) || 0;

/** A compact, factual snapshot of the store (last 30 days) built from the database. */
export async function buildStoreContext(focusProductId?: number | null): Promise<string> {
  if (!hasDb()) return "אין מסד נתונים מחובר – אין נתוני מכירות או מלאי זמינים.";
  try {
    const sql = await db();
    const [products, orders30, prev30, coupons] = await Promise.all([
      sql`select id, name, price, old_price, category, color, heel, stock, active, low_stock, description from products order by sort asc, id desc limit 200`,
      sql`select items, total, discount, coupon_code from orders where status not in ('cancelled', 'returned') and created_at >= now() - interval '30 days'`,
      sql`select count(*)::int as c, coalesce(sum(total), 0)::int as rev from orders where status not in ('cancelled', 'returned') and created_at >= now() - interval '60 days' and created_at < now() - interval '30 days'`,
      sql`select code, type, value, min_total, used, usage_limit, ends_at from coupons where active = true and (ends_at is null or ends_at > now()) order by created_at desc limit 15`,
    ]);

    const sold = new Map<number, { qty: number; rev: number }>();
    const sizes = new Map<string, number>();
    let revenue = 0;
    for (const o of orders30 as any[]) {
      revenue += n(o.total);
      const items = typeof o.items === "string" ? JSON.parse(o.items) : o.items || [];
      for (const it of items) {
        const id = n(it.productId);
        const s = sold.get(id) || { qty: 0, rev: 0 };
        s.qty += n(it.qty);
        s.rev += n(it.qty) * n(it.price);
        sold.set(id, s);
        if (it.size) sizes.set(String(it.size), (sizes.get(String(it.size)) || 0) + n(it.qty));
      }
    }
    const pmap = new Map<number, any>((products as any[]).map((p) => [Number(p.id), p]));
    const stockOf = (p: any): Record<string, number> => (typeof p.stock === "string" ? JSON.parse(p.stock) : p.stock || {});
    const total = (p: any) => Object.values(stockOf(p)).reduce((a: number, b) => a + n(b), 0);
    const inStock = (p: any) =>
      Object.entries(stockOf(p))
        .filter(([, q]) => n(q) > 0)
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([s, q]) => `${s}:${q}`)
        .join(" ");

    const lines: string[] = [];
    lines.push(`חנות: ${STORE.name}, ${STORE.city}. נעלי נשים (בעיקר מגפונים), משלוח חינם, תשלום במזומן/Bit/טלפונית. מטבע: ₪ (שקלים שלמים).`);
    lines.push(`תאריך היום: ${new Date().toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })}`);
    const p30 = (prev30 as any[])[0] || { c: 0, rev: 0 };
    lines.push(
      `30 הימים האחרונים: ${orders30.length} הזמנות, הכנסות ₪${revenue}${orders30.length ? `, סל ממוצע ₪${Math.round(revenue / orders30.length)}` : ""}. 30 הימים שלפני כן: ${n(p30.c)} הזמנות, ₪${n(p30.rev)}.`
    );

    const top = [...sold.entries()].sort((a, b) => b[1].qty - a[1].qty).slice(0, 10);
    lines.push("\nהנמכרים ביותר (30 יום) – מזהה | שם | זוגות | הכנסות:");
    lines.push(top.length ? top.map(([id, s]) => `#${id} | ${pmap.get(id)?.name || "מוצר שנמחק"} | ${s.qty} | ₪${s.rev}`).join("\n") : "אין מכירות ב־30 הימים האחרונים.");

    const sizeLine = [...sizes.entries()].sort((a, b) => Number(a[0]) - Number(b[0])).map(([s, q]) => `${s}: ${q}`).join(", ");
    lines.push(`\nביקוש לפי מידה (זוגות שנמכרו ב־30 יום): ${sizeLine || "אין נתונים"}`);

    const active = (products as any[]).filter((p) => p.active);
    const notSelling = active.filter((p) => !sold.has(Number(p.id)) && total(p) > 0).slice(0, 25);
    lines.push(`\nמוצרים פעילים במלאי שלא נמכרו ב־30 יום (${notSelling.length}): ${notSelling.map((p) => `#${p.id} ${p.name} (מלאי ${total(p)})`).join("; ") || "אין"}`);

    const low = active.filter((p) => total(p) <= n(p.low_stock ?? 2)).slice(0, 25);
    lines.push(`\nמלאי נמוך / אזל: ${low.map((p) => `#${p.id} ${p.name} – ${total(p) === 0 ? "אזל" : `נשארו ${total(p)}`}`).join("; ") || "אין"}`);

    lines.push("\nקטלוג מוצרים פעילים – מזהה | שם | קטגוריה | מחיר | מלאי לפי מידה:");
    lines.push(
      active
        .slice(0, 60)
        .map((p) => `#${p.id} | ${p.name} | ${CATEGORIES[p.category] || p.category} | ₪${n(p.price)}${p.old_price ? ` (במקום ₪${n(p.old_price)})` : ""} | ${inStock(p) || "אזל"}`)
        .join("\n") || "אין מוצרים פעילים"
    );
    const hidden = (products as any[]).length - active.length;
    if (hidden > 0) lines.push(`(+ ${hidden} מוצרים מוסתרים מהאתר)`);

    lines.push(
      `\nקופונים פעילים: ${(coupons as any[]).map((c) => `${c.code} (${c.type === "fixed" ? `₪${n(c.value)}` : `${n(c.value)}%`}${n(c.min_total) ? ` מעל ₪${n(c.min_total)}` : ""}, נוצל ${n(c.used)}${c.usage_limit ? `/${n(c.usage_limit)}` : ""})`).join("; ") || "אין"}`
    );

    if (focusProductId) {
      const p = pmap.get(Number(focusProductId));
      if (p) {
        const s = sold.get(Number(p.id));
        lines.push(
          `\nהמוצר שנבחר לבקשה הזו: #${p.id} "${p.name}". קטגוריה: ${CATEGORIES[p.category] || p.category}. צבע: ${COLORS[p.color]?.label || p.color}. ` +
            `${p.heel ? `גובה עקב: ${p.heel} ס״מ. ` : ""}מחיר: ₪${n(p.price)}${p.old_price ? ` (במקום ₪${n(p.old_price)})` : ""}. מלאי: ${inStock(p) || "אזל"}. ` +
            `נמכרו ב־30 יום: ${s?.qty || 0}. ${p.active ? "מוצג באתר" : "מוסתר מהאתר"}.\nהתיאור הנוכחי: ${String(p.description || "").slice(0, 1200) || "(אין תיאור)"}`
        );
      }
    }
    return lines.join("\n");
  } catch (e) {
    console.error("ai context failed", e);
    return "לא הצלחנו לקרוא את נתוני החנות כרגע.";
  }
}

export const SYSTEM_PROMPT = `את/ה העוזר/ת החכם/ה של מערכת הניהול של "Quality" – חנות נעלי נשים (בעיקר מגפונים) בטמרה, עם אתר מכירות בעברית.
המשתמשים הם צוות החנות. ענה/י תמיד בעברית (אלא אם התבקש תרגום לשפה אחרת), בקצרה, בטון חם ומקצועי.
כללים:
- היה/י עובדתי/ת. השתמש/י אך ורק בנתונים שסופקו בהקשר החנות ובשיחה. אל תמציא/י מספרים, מכירות, מלאי, מחירים, חומרים או תכונות מוצר שלא נמסרו.
- אם חסר מידע כדי לענות – אמור/י זאת במפורש ופרט/י מה חסר.
- בתיאורי מוצר: אל תמציא/י חומר (עור אמיתי וכו׳), מידות או התחייבויות. אפשר לתאר סגנון, שילובים ותחושה באופן כללי.
- כתוב/י טקסט נקי ומוכן להעתקה, בלי Markdown כבד (בלי טבלאות ובלי כותרות #). רשימות קצרות עם מקף הן בסדר.
- התשלום בחנות במזומן בעת המסירה, ב־Bit או בכרטיס אשראי טלפונית. המשלוח חינם. אין לחנות סליקה אונליין.`;
