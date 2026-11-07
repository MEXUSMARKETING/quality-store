import { db, hasDb } from "./db";
import { currentAdmin } from "./auth";
import type { AuditLog, Coupon, Customer, OrderEvent } from "./types";

/* Shared server-side helpers for the admin system (v2).
   Everything here talks to the same Postgres database as the storefront. */

export const phoneKey = (phone: string) => String(phone || "").replace(/[^0-9]/g, "");

const iso = (v: any) => (v ? new Date(v).toISOString() : null);

/* ---------------- audit log ---------------- */

export async function audit(entry: {
  action: "create" | "update" | "delete" | "status" | "price" | "stock" | "login" | "settings" | "bulk" | "permission";
  entity: "product" | "order" | "customer" | "coupon" | "settings" | "user" | "category" | "page" | "menu" | "homepage" | "review" | "automation" | "attribute";
  entityId?: string | number;
  summary: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
}) {
  if (!hasDb()) return;
  try {
    const sql = await db();
    const who = await currentAdmin().catch(() => null);
    const actor = who?.name || "מנהל";
    await sql`
      insert into audit_logs (actor, action, entity, entity_id, summary, before, after)
      values (${actor}, ${entry.action}, ${entry.entity}, ${String(entry.entityId ?? "")}, ${entry.summary},
              ${entry.before ? JSON.stringify(entry.before) : null}::jsonb,
              ${entry.after ? JSON.stringify(entry.after) : null}::jsonb)`;
  } catch (e) {
    console.error("audit failed", e);
  }
}

export async function listAudit(
  opts: { entity?: string; entities?: string[]; action?: string; q?: string; since?: Date | null; limit?: number } = {}
): Promise<AuditLog[]> {
  if (!hasDb()) return [];
  const sql = await db();
  const q = opts.q ? `%${opts.q}%` : null;
  const ents = opts.entities && opts.entities.length ? opts.entities : null;
  const since = opts.since ? opts.since.toISOString() : null;
  const r = await sql`
    select * from audit_logs
    where (${opts.entity || null}::text is null or entity = ${opts.entity || null})
      ${ents ? sql`and entity in ${sql(ents)}` : sql``}
      and (${opts.action || null}::text is null or action = ${opts.action || null})
      and (${q}::text is null or summary ilike ${q} or entity_id ilike ${q})
      and (${since}::timestamptz is null or created_at >= ${since}::timestamptz)
    order by id desc limit ${opts.limit || 300}`;
  return r.map((x: any) => ({ ...x, id: Number(x.id), created_at: iso(x.created_at)! }));
}

/* ---------------- order events (timeline) ---------------- */

export async function addOrderEvent(orderId: number, type: string, message: string, actor = "מנהל") {
  const sql = await db();
  await sql`insert into order_events (order_id, type, message, actor) values (${orderId}, ${type}, ${message}, ${actor})`;
}

export async function listOrderEvents(orderId: number): Promise<OrderEvent[]> {
  if (!hasDb()) return [];
  const sql = await db();
  const r = await sql`select * from order_events where order_id=${orderId} order by id asc`;
  return r.map((x: any) => ({ ...x, id: Number(x.id), order_id: Number(x.order_id), created_at: iso(x.created_at)! }));
}

/* ---------------- customers ---------------- */

export function normCustomer(r: any): Customer {
  const tags = typeof r.tags === "string" ? JSON.parse(r.tags) : r.tags || [];
  return {
    id: Number(r.id),
    phone: r.phone,
    name: r.name || "",
    email: r.email || "",
    city: r.city || "",
    tags: Array.isArray(tags) ? tags : [],
    notes: r.notes || "",
    marketing_consent: !!r.marketing_consent,
    archived: !!r.archived,
    created_at: iso(r.created_at)!,
    birthday: r.birthday ? new Date(r.birthday).toISOString().slice(0, 10) : null,
  };
}

/** Create or refresh a customer record. Called by the storefront on every order and club signup. */
export async function upsertCustomer(c: { phone: string; name?: string; email?: string; city?: string; consent?: boolean }) {
  const key = phoneKey(c.phone);
  if (!key) return;
  const sql = await db();
  const res = await sql`
    insert into customers (phone, name, email, city, marketing_consent)
    values (${key}, ${c.name || ""}, ${c.email || ""}, ${c.city || ""}, ${!!c.consent})
    on conflict (phone) do update set
      name = case when excluded.name <> '' then excluded.name else customers.name end,
      email = case when excluded.email <> '' then excluded.email else customers.email end,
      city = case when excluded.city <> '' then excluded.city else customers.city end,
      marketing_consent = customers.marketing_consent or excluded.marketing_consent,
      archived = false,
      updated_at = now()
    returning (xmax = 0) as inserted`;
  if (res[0]?.inserted) await import("./automations").then((m) => m.runAutomationsSafe({ type: "customer_created", phone: key })).catch((e) => console.error("automations hook failed", e));
}

/* ---------------- coupons ---------------- */

export function normCoupon(r: any): Coupon {
  return {
    id: Number(r.id),
    code: r.code,
    description: r.description || "",
    type: r.type,
    value: Number(r.value),
    min_total: Number(r.min_total || 0),
    max_discount: r.max_discount === null || r.max_discount === undefined ? null : Number(r.max_discount),
    starts_at: iso(r.starts_at),
    ends_at: iso(r.ends_at),
    usage_limit: r.usage_limit === null || r.usage_limit === undefined ? null : Number(r.usage_limit),
    per_customer: r.per_customer === null || r.per_customer === undefined ? null : Number(r.per_customer),
    used: Number(r.used || 0),
    active: !!r.active,
    created_at: iso(r.created_at)!,
  };
}

export type CouponState = "active" | "scheduled" | "expired" | "used_up" | "disabled";

export function couponState(c: Coupon, now = new Date()): CouponState {
  if (!c.active) return "disabled";
  if (c.usage_limit !== null && c.used >= c.usage_limit) return "used_up";
  if (c.ends_at && new Date(c.ends_at) < now) return "expired";
  if (c.starts_at && new Date(c.starts_at) > now) return "scheduled";
  return "active";
}

/** Discount in whole shekels for a cart subtotal (shipping is free in this store, so 'shipping' coupons give 0). */
export function couponDiscount(c: Coupon, subtotal: number): number {
  if (subtotal < c.min_total) return 0;
  let d = c.type === "percent" ? Math.round((subtotal * Math.min(100, c.value)) / 100) : c.type === "fixed" ? c.value : 0;
  if (c.max_discount !== null) d = Math.min(d, c.max_discount);
  return Math.max(0, Math.min(d, subtotal));
}

/** Validate a code for checkout. Returns the coupon and discount, or a Hebrew error. */
export async function checkCoupon(code: string, subtotal: number, phone: string): Promise<{ coupon?: Coupon; discount?: number; error?: string }> {
  const clean = code.trim().toUpperCase();
  if (!clean) return {};
  if (!hasDb()) return { error: "לא ניתן להשתמש בקופון כרגע" };
  const sql = await db();
  const r = await sql`select * from coupons where upper(code) = ${clean} limit 1`;
  if (!r[0]) return { error: "קוד הקופון לא קיים" };
  const c = normCoupon(r[0]);
  const st = couponState(c);
  if (st === "disabled" || st === "expired") return { error: "תוקף הקופון פג" };
  if (st === "scheduled") return { error: "הקופון עדיין לא פעיל" };
  if (st === "used_up") return { error: "הקופון כבר נוצל עד הסוף" };
  if (subtotal < c.min_total) return { error: `הקופון תקף בקנייה מעל ₪${c.min_total}` };
  if (c.per_customer !== null && phoneKey(phone)) {
    const [{ n }] = await sql<{ n: string }[]>`
      select count(*)::text as n from orders
      where upper(coupon_code) = ${clean} and regexp_replace(phone, '[^0-9]', '', 'g') = ${phoneKey(phone)} and status <> 'cancelled'`;
    if (Number(n) >= c.per_customer) return { error: "כבר השתמשת בקופון הזה" };
  }
  return { coupon: c, discount: couponDiscount(c, subtotal) };
}

export async function markCouponUsed(code: string) {
  if (!code) return;
  const sql = await db();
  await sql`update coupons set used = used + 1, updated_at = now() where upper(code) = ${code.toUpperCase()}`;
}
