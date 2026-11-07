import { db, hasDb } from "./db";
import { normCustomer, phoneKey } from "./admin";
import type { Customer, Order, OrderEvent } from "./types";

/* Admin v2 – orders & customers queries (server only). Money is integer shekels. */

const iso = (v: any) => (v ? new Date(v).toISOString() : null);

export function normOrderRow(r: any): Order {
  const items = typeof r.items === "string" ? JSON.parse(r.items) : r.items || [];
  return {
    id: Number(r.id),
    number: r.number || "",
    customer_name: r.customer_name || "",
    phone: r.phone || "",
    email: r.email || "",
    city: r.city || "",
    street: r.street || "",
    apt: r.apt || "",
    notes: r.notes || "",
    shipping_method: r.shipping_method || "home",
    payment_method: r.payment_method || "cash",
    items: Array.isArray(items) ? items : [],
    subtotal: Number(r.subtotal || 0),
    total: Number(r.total || 0),
    status: r.status || "new",
    created_at: iso(r.created_at)!,
    payment_status: r.payment_status || "pending",
    tracking: r.tracking || "",
    discount: Number(r.discount || 0),
    coupon_code: r.coupon_code || "",
  };
}

export const CLOSED = ["cancelled", "returned"];
export const itemsCount = (o: Pick<Order, "items">) => o.items.reduce((a, i) => a + (Number(i.qty) || 0), 0);
/** VAT (18%) included in a VAT-inclusive total, in whole shekels */
export const vatIncluded = (total: number) => total - Math.round(total / 1.18);

/** 05X-XXXXXXX → 9725XXXXXXXX for wa.me links */
export function intlPhone(p: string) {
  const d = phoneKey(p);
  return d.startsWith("0") ? "972" + d.slice(1) : d;
}

/** Normalise an Israeli mobile number to 05XXXXXXXX, or null when invalid. */
export function normIsraeliMobile(raw: string): string | null {
  let d = phoneKey(raw);
  if (d.startsWith("972")) d = "0" + d.slice(3);
  return /^05[0-9]{8}$/.test(d) ? d : null;
}

/* ---------------- orders list ---------------- */

export type OrderFilters = {
  status?: string; // a status key, or "closed" for cancelled+returned
  q?: string;
  pay?: string;
  days?: number | null;
  sort?: string;
  page?: number;
};

export const ORDER_PAGE_SIZE = 50;

function searchParts(qRaw?: string) {
  const q = (qRaw || "").trim();
  const like = q ? `%${q}%` : null;
  // only treat the query as a phone when it looks like one
  const digits = q && /^[0-9+\-\s()]+$/.test(q) ? phoneKey(q) : "";
  return { like, digitsLike: digits ? `%${digits}%` : null };
}

export async function listOrdersAdmin(f: OrderFilters, opts: { all?: boolean } = {}): Promise<{ rows: Order[]; total: number; counts: Record<string, number> }> {
  if (!hasDb()) return { rows: [], total: 0, counts: {} };
  const sql = await db();
  const { like, digitsLike } = searchParts(f.q);
  const pay = f.pay || null;
  const days = f.days && f.days > 0 ? Math.round(f.days) : null;
  const st = f.status || null;
  const page = Math.max(1, f.page || 1);

  const base = (withStatus: boolean) => sql`
    (${like}::text is null or number ilike ${like} or customer_name ilike ${like} or email ilike ${like}
       or (${digitsLike}::text is not null and regexp_replace(phone, '[^0-9]', '', 'g') like ${digitsLike}))
    and (${pay}::text is null or payment_status = ${pay})
    and (${days}::int is null or created_at >= now() - make_interval(days => ${days}::int))
    ${withStatus ? sql`and (${st}::text is null or (${st} = 'closed' and status in ('cancelled', 'returned')) or status = ${st})` : sql``}`;

  const order =
    f.sort === "oldest" ? sql`id asc` : f.sort === "total_desc" ? sql`total desc, id desc` : f.sort === "total_asc" ? sql`total asc, id desc` : sql`id desc`;

  const [rows, countRows] = await Promise.all([
    opts.all
      ? sql`select *, count(*) over() as _total from orders where ${base(true)} order by ${order} limit 5000`
      : sql`select *, count(*) over() as _total from orders where ${base(true)} order by ${order}
            limit ${ORDER_PAGE_SIZE} offset ${(page - 1) * ORDER_PAGE_SIZE}`,
    sql`select status, count(*)::int as n from orders where ${base(false)} group by status`,
  ]);
  const counts: Record<string, number> = {};
  for (const r of countRows as any[]) counts[r.status] = Number(r.n);
  let total = rows[0] ? Number((rows[0] as any)._total) : 0;
  if (!rows[0] && page > 1) {
    // page beyond the end – still report the real total
    const [{ n }] = await sql`select count(*)::int as n from orders where ${base(true)}`;
    total = Number(n);
  }
  return { rows: (rows as any[]).map(normOrderRow), total, counts };
}

/* ---------------- single order ---------------- */

export async function getOrderAdmin(id: number): Promise<{ order: Order; customerId: number | null; restocked: boolean } | null> {
  if (!hasDb() || !Number.isFinite(id)) return null;
  const sql = await db();
  const r = await sql`select * from orders where id = ${id} limit 1`;
  if (!r[0]) return null;
  const order = normOrderRow(r[0]);
  const [c, ev] = await Promise.all([
    sql`select id from customers where phone = ${phoneKey(order.phone)} limit 1`,
    sql`select 1 from order_events where order_id = ${id} and type = 'restock' limit 1`,
  ]);
  return { order, customerId: c[0] ? Number(c[0].id) : null, restocked: !!ev[0] };
}

/**
 * Change an order's status inside a transaction: writes a timeline event and,
 * when asked and the order moves to cancelled/returned, puts the pairs back in stock
 * (once per order – guarded by a 'restock' event).
 */
export async function changeOrderStatus(id: number, status: string, opts: { note?: string; restock?: boolean; labels: Record<string, string> }): Promise<{ before: string; restocked: number } | null> {
  const sql = await db();
  return sql.begin(async (tx: any) => {
    const r = await tx`select id, status, items from orders where id = ${id} for update`;
    if (!r[0]) return null;
    const before = String(r[0].status);
    const items = (typeof r[0].items === "string" ? JSON.parse(r[0].items) : r[0].items) || [];
    if (before !== status) {
      await tx`update orders set status = ${status}, updated_at = now() where id = ${id}`;
      const msg = `הסטטוס שונה מ־${opts.labels[before] || before} ל־${opts.labels[status] || status}` + (opts.note ? ` · ${opts.note}` : "");
      await tx`insert into order_events (order_id, type, message, actor) values (${id}, 'status', ${msg}, 'מנהל')`;
    } else if (opts.note) {
      await tx`insert into order_events (order_id, type, message, actor) values (${id}, 'note', ${opts.note}, 'מנהל')`;
    }
    let restocked = 0;
    if (opts.restock && CLOSED.includes(status)) {
      const done = await tx`select 1 from order_events where order_id = ${id} and type = 'restock' limit 1`;
      if (!done[0]) {
        for (const it of items) {
          const qty = Math.max(0, Math.round(Number(it.qty) || 0));
          const size = String(it.size || "");
          const pid = Number(it.productId);
          if (!qty || !size || !Number.isFinite(pid)) continue;
          const u = await tx`
            update products
            set stock = jsonb_set(coalesce(stock, '{}'::jsonb), array[${size}]::text[],
                                  to_jsonb(coalesce((stock->>${size})::int, 0) + ${qty}::int), true),
                updated_at = now()
            where id = ${pid} returning id`;
          if (u[0]) restocked += qty;
        }
        await tx`insert into order_events (order_id, type, message, actor)
                 values (${id}, 'restock', ${`${restocked} זוגות הוחזרו למלאי`}, 'מנהל')`;
      }
    }
    return { before, restocked };
  });
}

export async function listOrderTimeline(id: number): Promise<OrderEvent[]> {
  if (!hasDb()) return [];
  const sql = await db();
  const r = await sql`select * from order_events where order_id = ${id} order by created_at asc, id asc`;
  return (r as any[]).map((x) => ({ ...x, id: Number(x.id), order_id: Number(x.order_id), created_at: iso(x.created_at)! }));
}

/* ---------------- customers ---------------- */

export type CustomerRow = Customer & { orders: number; spent: number; first_order: string | null; last_order: string | null; all_orders: number };

/** All customers with per-customer order aggregates, in one query (orders/spent exclude cancelled & returned). */
export async function listCustomersAgg(): Promise<CustomerRow[]> {
  if (!hasDb()) return [];
  const sql = await db();
  const r = await sql`
    with agg as (
      select regexp_replace(phone, '[^0-9]', '', 'g') as k,
             count(*)::int as all_orders,
             count(*) filter (where status not in ('cancelled', 'returned'))::int as orders,
             coalesce(sum(total) filter (where status not in ('cancelled', 'returned')), 0)::int as spent,
             min(created_at) filter (where status not in ('cancelled', 'returned')) as first_order,
             max(created_at) filter (where status not in ('cancelled', 'returned')) as last_order
      from orders group by 1
    )
    select c.*, coalesce(a.orders, 0) as orders, coalesce(a.all_orders, 0) as all_orders, coalesce(a.spent, 0) as spent,
           a.first_order, a.last_order
    from customers c left join agg a on a.k = c.phone
    order by c.id desc`;
  return (r as any[]).map((x) => ({
    ...normCustomer(x),
    orders: Number(x.orders),
    all_orders: Number(x.all_orders),
    spent: Number(x.spent),
    first_order: iso(x.first_order),
    last_order: iso(x.last_order),
  }));
}

const DAY = 24 * 3600 * 1000;
export const VIP_MIN = 1000;

export const SEGMENTS: Record<string, { label: string; test: (c: CustomerRow, now: number) => boolean }> = {
  all: { label: "הכל", test: (c) => !c.archived },
  new: { label: "חדשים 30 יום", test: (c, now) => !c.archived && now - new Date(c.created_at).getTime() <= 30 * DAY },
  returning: { label: "חוזרים", test: (c) => !c.archived && c.orders >= 2 },
  vip: { label: "VIP", test: (c) => !c.archived && c.spent >= VIP_MIN },
  inactive: {
    label: "לא פעילים 90+ יום",
    test: (c, now) => !c.archived && (c.last_order ? now - new Date(c.last_order).getTime() > 90 * DAY : now - new Date(c.created_at).getTime() > 90 * DAY),
  },
  consent: { label: "מאשרים דיוור", test: (c) => !c.archived && c.marketing_consent },
  archived: { label: "בארכיון", test: (c) => c.archived },
};

export function filterCustomers(all: CustomerRow[], p: { seg?: string; q?: string; sort?: string }): CustomerRow[] {
  const now = Date.now();
  const seg = SEGMENTS[p.seg || ""] ? p.seg! : "all";
  const q = (p.q || "").trim().toLowerCase();
  const qd = q && /^[0-9+\-\s()]+$/.test(q) ? phoneKey(q) : "";
  let list = all.filter((c) => SEGMENTS[seg].test(c, now));
  if (q) {
    list = list.filter((c) =>
      qd ? c.phone.includes(qd) || (qd.startsWith("972") && c.phone.includes("0" + qd.slice(3))) :(c.name + " " + c.email + " " + c.city + " " + c.tags.join(" ")).toLowerCase().includes(q)
    );
  }
  const t = (s: string | null) => (s ? new Date(s).getTime() : 0);
  const sorters: Record<string, (a: CustomerRow, b: CustomerRow) => number> = {
    last: (a, b) => t(b.last_order) - t(a.last_order) || b.id - a.id,
    spent: (a, b) => b.spent - a.spent || b.id - a.id,
    name: (a, b) => a.name.localeCompare(b.name, "he"),
    newest: (a, b) => b.id - a.id,
  };
  return list.sort(sorters[p.sort || ""] || sorters.last);
}

export async function getCustomerAdmin(id: number): Promise<{ customer: Customer; orders: Order[] } | null> {
  if (!hasDb() || !Number.isFinite(id)) return null;
  const sql = await db();
  const r = await sql`select * from customers where id = ${id} limit 1`;
  if (!r[0]) return null;
  const customer = normCustomer(r[0]);
  const o = await sql`select * from orders where regexp_replace(phone, '[^0-9]', '', 'g') = ${customer.phone} order by id desc limit 500`;
  return { customer, orders: (o as any[]).map(normOrderRow) };
}

export async function getCustomerRaw(id: number): Promise<Customer | null> {
  const sql = await db();
  const r = await sql`select * from customers where id = ${id} limit 1`;
  return r[0] ? normCustomer(r[0]) : null;
}
