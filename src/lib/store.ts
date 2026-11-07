import { db, hasDb } from "./db";
import { SEED_WITH_IDS } from "./seed";
import { addOrderEvent, markCouponUsed, upsertCustomer } from "./admin";
import type { ClubMember, Order, Product } from "./types";

function normProduct(r: any): Product {
  const images = typeof r.images === "string" ? JSON.parse(r.images) : r.images || [];
  const stock = typeof r.stock === "string" ? JSON.parse(r.stock) : r.stock || {};
  return {
    id: Number(r.id),
    slug: r.slug,
    name: r.name,
    description: r.description || "",
    price: Number(r.price),
    old_price: r.old_price === null || r.old_price === undefined ? null : Number(r.old_price),
    heel: r.heel === null || r.heel === undefined ? null : Number(r.heel),
    color: r.color || "black",
    category: r.category || "boots",
    images: Array.isArray(images) ? images : [],
    stock: stock && typeof stock === "object" ? stock : {},
    featured: !!r.featured,
    active: !!r.active,
    sort: Number(r.sort ?? 100),
    created_at: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    sku: r.sku || "",
    cost: r.cost === null || r.cost === undefined ? null : Number(r.cost),
    low_stock: r.low_stock === null || r.low_stock === undefined ? 2 : Number(r.low_stock),
    seo_title: r.seo_title || "",
    seo_description: r.seo_description || "",
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
  };
}

function normOrder(r: any): Order {
  const items = typeof r.items === "string" ? JSON.parse(r.items) : r.items || [];
  return {
    ...r,
    id: Number(r.id),
    subtotal: Number(r.subtotal),
    total: Number(r.total),
    items,
    created_at: new Date(r.created_at).toISOString(),
    payment_status: r.payment_status || "pending",
    tracking: r.tracking || "",
    discount: Number(r.discount || 0),
    coupon_code: r.coupon_code || "",
    updated_at: r.updated_at ? new Date(r.updated_at).toISOString() : undefined,
  };
}

export function totalStock(p: Product): number {
  return Object.values(p.stock || {}).reduce((a, b) => a + (Number(b) || 0), 0);
}

export function availableSizes(p: Product): string[] {
  return Object.entries(p.stock || {})
    .filter(([, q]) => Number(q) > 0)
    .map(([s]) => s)
    .sort((a, b) => Number(a) - Number(b));
}

export function discountPct(p: Product): number | null {
  if (!p.old_price || p.old_price <= p.price) return null;
  return Math.round((1 - p.price / p.old_price) * 100);
}

/* ---------------- products ---------------- */

export async function listProducts(opts: { includeInactive?: boolean; category?: string } = {}): Promise<Product[]> {
  let rows: Product[];
  if (!hasDb()) {
    rows = SEED_WITH_IDS;
  } else {
    const sql = await db();
    const r = await sql`select * from products order by sort asc, id desc`;
    rows = r.map(normProduct);
  }
  return rows.filter(
    (p) => (opts.includeInactive || p.active) && (!opts.category || p.category === opts.category)
  );
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (!hasDb()) return SEED_WITH_IDS.find((p) => p.slug === slug) || null;
  const sql = await db();
  const r = await sql`select * from products where slug = ${slug} limit 1`;
  return r[0] ? normProduct(r[0]) : null;
}

export async function getProductById(id: number): Promise<Product | null> {
  if (!hasDb()) return SEED_WITH_IDS.find((p) => p.id === id) || null;
  const sql = await db();
  const r = await sql`select * from products where id = ${id} limit 1`;
  return r[0] ? normProduct(r[0]) : null;
}

export type ProductInput = Omit<Product, "id" | "created_at">;

export async function saveProduct(id: number | null, p: ProductInput): Promise<number> {
  const sql = await db();
  const images = JSON.stringify(p.images);
  const stock = JSON.stringify(p.stock);
  const sku = (p.sku ?? "").trim();
  const cost = p.cost === undefined ? null : p.cost;
  const lowStock = Number.isFinite(p.low_stock as number) ? Math.max(0, Number(p.low_stock)) : 2;
  const seoTitle = p.seo_title ?? "";
  const seoDescription = p.seo_description ?? "";
  if (id) {
    await sql`
      update products set slug=${p.slug}, name=${p.name}, description=${p.description}, price=${p.price},
        old_price=${p.old_price}, heel=${p.heel}, color=${p.color}, category=${p.category},
        images=${images}::jsonb, stock=${stock}::jsonb, featured=${p.featured}, active=${p.active}, sort=${p.sort},
        sku=${sku}, cost=${cost}, low_stock=${lowStock}, seo_title=${seoTitle}, seo_description=${seoDescription},
        updated_at=now()
      where id=${id}`;
    return id;
  }
  const r = await sql`
    insert into products (slug, name, description, price, old_price, heel, color, category, images, stock, featured, active, sort,
                          sku, cost, low_stock, seo_title, seo_description, updated_at)
    values (${p.slug}, ${p.name}, ${p.description}, ${p.price}, ${p.old_price}, ${p.heel}, ${p.color}, ${p.category},
            ${images}::jsonb, ${stock}::jsonb, ${p.featured}, ${p.active}, ${p.sort},
            ${sku}, ${cost}, ${lowStock}, ${seoTitle}, ${seoDescription}, now())
    returning id`;
  return Number(r[0].id);
}

export async function deleteProduct(id: number) {
  const sql = await db();
  await sql`delete from products where id=${id}`;
}

/** Copy a product as a hidden draft with a unique slug ("-copy", "-copy-2", …). Returns the new id. */
export async function duplicateProduct(id: number): Promise<{ id: number; slug: string } | null> {
  const src = await getProductById(id);
  if (!src) return null;
  const sql = await db();
  const base = `${src.slug}-copy`;
  const taken = await sql`select slug from products where slug = ${base} or slug like ${base + "-%"}`;
  const set = new Set(taken.map((r: any) => String(r.slug)));
  let slug = base;
  for (let i = 2; set.has(slug); i++) slug = `${base}-${i}`;
  const { id: _id, created_at: _c, updated_at: _u, ...rest } = src;
  const newId = await saveProduct(null, { ...rest, slug, name: `${src.name} (עותק)`, active: false, featured: false, sku: src.sku ? `${src.sku}-COPY` : "" });
  return { id: newId, slug };
}

export type BulkProductOp = "show" | "hide" | "feature" | "delete";

/** Apply one bulk operation to many products. Returns the affected rows (before the change). */
export async function bulkUpdateProducts(ids: number[], op: BulkProductOp): Promise<{ id: number; name: string }[]> {
  const clean = Array.from(new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0)));
  if (!clean.length) return [];
  const sql = await db();
  const rows = await sql`select id, name from products where id in ${sql(clean)}`;
  if (op === "delete") await sql`delete from products where id in ${sql(clean)}`;
  else if (op === "show") await sql`update products set active = true, updated_at = now() where id in ${sql(clean)}`;
  else if (op === "hide") await sql`update products set active = false, updated_at = now() where id in ${sql(clean)}`;
  else if (op === "feature") await sql`update products set featured = true, updated_at = now() where id in ${sql(clean)}`;
  return rows.map((r: any) => ({ id: Number(r.id), name: String(r.name) }));
}

/* ---------------- orders ---------------- */

export async function createOrder(
  o: Omit<Order, "id" | "number" | "status" | "created_at" | "payment_status" | "tracking">
): Promise<string> {
  const sql = await db();
  const discount = Math.max(0, Number(o.discount || 0));
  const coupon = (o.coupon_code || "").toUpperCase();
  const r = await sql`
    insert into orders (customer_name, phone, email, city, street, apt, notes, shipping_method, payment_method, items, subtotal, total, discount, coupon_code)
    values (${o.customer_name}, ${o.phone}, ${o.email}, ${o.city}, ${o.street}, ${o.apt}, ${o.notes},
            ${o.shipping_method}, ${o.payment_method}, ${JSON.stringify(o.items)}::jsonb, ${o.subtotal}, ${o.total}, ${discount}, ${coupon})
    returning id`;
  const id = Number(r[0].id);
  const number = "Q" + (1000 + id);
  await sql`update orders set number=${number} where id=${id}`;
  for (const it of o.items) {
    await sql`
      update products
      set stock = jsonb_set(stock, ARRAY[${it.size}]::text[],
        to_jsonb(greatest(coalesce((stock->>${it.size})::int, 0) - ${it.qty}, 0)))
      where id = ${it.productId}`;
  }
  // Admin v2 side effects: never let them break the order itself
  try {
    await addOrderEvent(id, "created", "ההזמנה התקבלה מהאתר", "לקוח");
    await upsertCustomer({ phone: o.phone, name: o.customer_name, email: o.email, city: o.city });
    if (coupon) await markCouponUsed(coupon);
  } catch (e) {
    console.error("order side effects failed", e);
  }
  await import("./automations").then((m) => m.runAutomationsSafe({ type: "order_created", orderId: id })).catch((e) => console.error("automations hook failed", e));
  return number;
}

export async function listOrders(status?: string): Promise<Order[]> {
  if (!hasDb()) return [];
  const sql = await db();
  const r = status
    ? await sql`select * from orders where status=${status} order by id desc limit 500`
    : await sql`select * from orders order by id desc limit 500`;
  return r.map(normOrder);
}

export async function getOrderByNumber(number: string): Promise<Order | null> {
  if (!hasDb()) return null;
  const sql = await db();
  const r = await sql`select * from orders where number=${number} limit 1`;
  return r[0] ? normOrder(r[0]) : null;
}

export async function getOrderById(id: number): Promise<Order | null> {
  if (!hasDb()) return null;
  const sql = await db();
  const r = await sql`select * from orders where id=${id} limit 1`;
  return r[0] ? normOrder(r[0]) : null;
}

export async function setOrderStatus(id: number, status: string) {
  const sql = await db();
  await sql`update orders set status=${status} where id=${id}`;
}

/** Product ids ranked by units sold (empty when there is no database or no orders yet). */
export async function bestSellerIds(): Promise<number[]> {
  if (!hasDb()) return [];
  try {
    const sql = await db();
    const r = await sql`
      select (it->>'productId')::int as id, sum((it->>'qty')::int) as sold
      from orders, jsonb_array_elements(items) as it
      where status <> 'cancelled'
      group by 1 order by sold desc limit 20`;
    return r.map((x: any) => Number(x.id));
  } catch {
    return [];
  }
}

/* ---------------- club ---------------- */

export async function addClubMember(m: { name: string; phone: string; email: string }) {
  const sql = await db();
  await sql`insert into club_members (name, phone, email) values (${m.name}, ${m.phone}, ${m.email})`;
  try {
    await upsertCustomer({ phone: m.phone, name: m.name, email: m.email, consent: true });
  } catch (e) {
    console.error("customer upsert failed", e);
  }
}

export async function listClubMembers(): Promise<ClubMember[]> {
  if (!hasDb()) return [];
  const sql = await db();
  const r = await sql`select * from club_members order by id desc`;
  return r.map((x: any) => ({ ...x, id: Number(x.id), created_at: new Date(x.created_at).toISOString() }));
}
