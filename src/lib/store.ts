import { db, hasDb } from "./db";
import { SEED_WITH_IDS } from "./seed";
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
  if (id) {
    await sql`
      update products set slug=${p.slug}, name=${p.name}, description=${p.description}, price=${p.price},
        old_price=${p.old_price}, heel=${p.heel}, color=${p.color}, category=${p.category},
        images=${images}::jsonb, stock=${stock}::jsonb, featured=${p.featured}, active=${p.active}, sort=${p.sort}
      where id=${id}`;
    return id;
  }
  const r = await sql`
    insert into products (slug, name, description, price, old_price, heel, color, category, images, stock, featured, active, sort)
    values (${p.slug}, ${p.name}, ${p.description}, ${p.price}, ${p.old_price}, ${p.heel}, ${p.color}, ${p.category},
            ${images}::jsonb, ${stock}::jsonb, ${p.featured}, ${p.active}, ${p.sort})
    returning id`;
  return Number(r[0].id);
}

export async function deleteProduct(id: number) {
  const sql = await db();
  await sql`delete from products where id=${id}`;
}

/* ---------------- orders ---------------- */

export async function createOrder(o: Omit<Order, "id" | "number" | "status" | "created_at">): Promise<string> {
  const sql = await db();
  const r = await sql`
    insert into orders (customer_name, phone, email, city, street, apt, notes, shipping_method, payment_method, items, subtotal, total)
    values (${o.customer_name}, ${o.phone}, ${o.email}, ${o.city}, ${o.street}, ${o.apt}, ${o.notes},
            ${o.shipping_method}, ${o.payment_method}, ${JSON.stringify(o.items)}::jsonb, ${o.subtotal}, ${o.total})
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

/* ---------------- club ---------------- */

export async function addClubMember(m: { name: string; phone: string; email: string }) {
  const sql = await db();
  await sql`insert into club_members (name, phone, email) values (${m.name}, ${m.phone}, ${m.email})`;
}

export async function listClubMembers(): Promise<ClubMember[]> {
  if (!hasDb()) return [];
  const sql = await db();
  const r = await sql`select * from club_members order by id desc`;
  return r.map((x: any) => ({ ...x, id: Number(x.id), created_at: new Date(x.created_at).toISOString() }));
}
