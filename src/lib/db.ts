import postgres from "postgres";
import { SEED_PRODUCTS } from "./seed";

type Sql = ReturnType<typeof postgres>;

const g = globalThis as unknown as { __qsql?: Sql; __qready?: Promise<void> | null };

export function dbUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

export function hasDb(): boolean {
  return !!dbUrl();
}

function client(): Sql {
  if (!g.__qsql) {
    const url = dbUrl();
    if (!url) throw new Error("DATABASE_URL is not set");
    const local = /localhost|127\.0\.0\.1/.test(url);
    g.__qsql = postgres(url, {
      ssl: local ? false : "require",
      max: 3,
      idle_timeout: 20,
      prepare: false,
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
