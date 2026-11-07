import postgres from "postgres";
import { SEED_PRODUCTS } from "./seed";

type Sql = ReturnType<typeof postgres>;

const g = globalThis as unknown as { __qsql?: Sql; __qready?: Promise<void> | null; __qlast?: number };

/** Serverless instances are frozen between requests; sockets left open across a freeze can be
 *  silently dead when the instance wakes, and a query on them hangs until the function times out.
 *  So after a quiet period we drop the old client and open a fresh connection. */
const STALE_MS = 10_000;

export function dbUrl(): string | undefined {
  const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
  if (!raw) return undefined;
  // Supabase/Vercel connection strings carry extra query params (supa, pgbouncer) that postgres.js
  // would forward to the server as settings and fail on. Keep only the ones postgres.js understands.
  try {
    const u = new URL(raw);
    for (const k of Array.from(u.searchParams.keys())) if (!["sslmode", "connect_timeout"].includes(k)) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return raw;
  }
}

export function hasDb(): boolean {
  return !!dbUrl();
}

function client(): Sql {
  const now = Date.now();
  if (g.__qsql && g.__qlast && now - g.__qlast > STALE_MS) {
    const old = g.__qsql;
    g.__qsql = undefined;
    old.end({ timeout: 0 }).catch(() => {});
  }
  g.__qlast = now;
  if (!g.__qsql) {
    const url = dbUrl();
    if (!url) throw new Error("DATABASE_URL is not set");
    const local = /localhost|127\.0\.0\.1/.test(url);
    g.__qsql = postgres(url, {
      ssl: local ? false : "require",
      max: 3,
      idle_timeout: 5,
      max_lifetime: 60 * 5,
      connect_timeout: 10,
      prepare: false,
      onnotice: () => {},
    });
  }
  return g.__qsql;
}

async function init(sql: Sql) {
  await sql`
    create table if not exists products (
      id serial primary key,
      slug text unique not null,
      name text not null,
      description text not null default '',
      price integer not null default 0,
      old_price integer,
      heel integer,
      color text not null default 'black',
      category text not null default 'boots',
      images jsonb not null default '[]'::jsonb,
      stock jsonb not null default '{}'::jsonb,
      featured boolean not null default false,
      active boolean not null default true,
      sort integer not null default 100,
      created_at timestamptz not null default now()
    )`;
  await sql`
    create table if not exists orders (
      id serial primary key,
      number text,
      customer_name text not null,
      phone text not null,
      email text not null default '',
      city text not null default '',
      street text not null default '',
      apt text not null default '',
      notes text not null default '',
      shipping_method text not null default 'home',
      payment_method text not null default 'cash',
      items jsonb not null default '[]'::jsonb,
      subtotal integer not null default 0,
      total integer not null default 0,
      status text not null default 'new',
      created_at timestamptz not null default now()
    )`;
  await sql`
    create table if not exists club_members (
      id serial primary key,
      name text not null default '',
      phone text not null default '',
      email text not null default '',
      created_at timestamptz not null default now()
    )`;

  // ---- Admin v2 (additive migrations: safe to run on a live database) ----
  await sql`alter table products add column if not exists sku text not null default ''`;
  await sql`alter table products add column if not exists cost integer`;
  await sql`alter table products add column if not exists low_stock integer not null default 2`;
  await sql`alter table products add column if not exists seo_title text not null default ''`;
  await sql`alter table products add column if not exists seo_description text not null default ''`;
  await sql`alter table products add column if not exists updated_at timestamptz not null default now()`;

  await sql`alter table orders add column if not exists payment_status text not null default 'pending'`;
  await sql`alter table orders add column if not exists tracking text not null default ''`;
  await sql`alter table orders add column if not exists discount integer not null default 0`;
  await sql`alter table orders add column if not exists coupon_code text not null default ''`;
  await sql`alter table orders add column if not exists updated_at timestamptz not null default now()`;

  await sql`
    create table if not exists order_events (
      id serial primary key,
      order_id integer not null references orders(id) on delete cascade,
      type text not null default 'note',
      message text not null default '',
      actor text not null default '',
      created_at timestamptz not null default now()
    )`;
  await sql`create index if not exists order_events_order_idx on order_events(order_id)`;

  await sql`
    create table if not exists customers (
      id serial primary key,
      phone text unique not null,
      name text not null default '',
      email text not null default '',
      city text not null default '',
      tags jsonb not null default '[]'::jsonb,
      notes text not null default '',
      marketing_consent boolean not null default false,
      archived boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`;

  await sql`
    create table if not exists coupons (
      id serial primary key,
      code text unique not null,
      description text not null default '',
      type text not null default 'percent',
      value integer not null default 0,
      min_total integer not null default 0,
      max_discount integer,
      starts_at timestamptz,
      ends_at timestamptz,
      usage_limit integer,
      per_customer integer,
      used integer not null default 0,
      active boolean not null default true,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`;

  await sql`
    create table if not exists audit_logs (
      id serial primary key,
      actor text not null default 'מנהל',
      action text not null,
      entity text not null,
      entity_id text not null default '',
      summary text not null default '',
      before jsonb,
      after jsonb,
      created_at timestamptz not null default now()
    )`;
  await sql`create index if not exists audit_logs_created_idx on audit_logs(created_at desc)`;

  // Backfill customers from existing orders and club members (only once: when the table is empty)
  const [{ c }] = await sql<{ c: string }[]>`select count(*)::text as c from customers`;
  if (Number(c) === 0) {
    await sql`
      insert into customers (phone, name, email, city, created_at)
      select distinct on (k) k, customer_name, email, city, created_at
      from (select regexp_replace(phone, '[^0-9]', '', 'g') as k, customer_name, email, city, created_at from orders) o
      where k <> '' order by k, created_at asc
      on conflict (phone) do nothing`;
    await sql`
      insert into customers (phone, name, email, marketing_consent, created_at)
      select distinct on (k) k, name, email, true, created_at
      from (select regexp_replace(phone, '[^0-9]', '', 'g') as k, name, email, created_at from club_members) m
      where k <> '' order by k, created_at asc
      on conflict (phone) do update set marketing_consent = true`;
  }

  const [{ count }] = await sql<{ count: string }[]>`select count(*)::text as count from products`;
  if (Number(count) === 0) {
    for (const p of SEED_PRODUCTS) {
      await sql`
        insert into products (slug, name, description, price, old_price, heel, color, category, images, stock, featured, active, sort)
        values (${p.slug}, ${p.name}, ${p.description}, ${p.price}, ${p.old_price}, ${p.heel}, ${p.color}, ${p.category},
                ${JSON.stringify(p.images)}::jsonb, ${JSON.stringify(p.stock)}::jsonb, ${p.featured}, ${p.active}, ${p.sort})
        on conflict (slug) do nothing`;
    }
  }
}

export async function db(): Promise<Sql> {
  const sql = client();
  if (!g.__qready) {
    g.__qready = init(sql).catch((e) => {
      g.__qready = null;
      throw e;
    });
  }
  await g.__qready;
  return sql;
}
