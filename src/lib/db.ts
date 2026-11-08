import postgres from "postgres";
import { SEED_PRODUCTS } from "./seed";

type Sql = ReturnType<typeof postgres>;

const g = globalThis as unknown as { __qsql?: Sql; __qraw?: Sql; __qready?: Promise<void> | null; __qlast?: number };

/** Serverless instances are frozen between requests; sockets left open across a freeze can be
 *  silently dead when the instance wakes, and a query on them hangs until the function times out.
 *  So after a quiet period we drop the old client and open a fresh connection. */
const STALE_MS = 4_000;

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

/** A query that has not answered in this long is treated as stuck on a dead socket. Without this a
 *  silently dropped connection makes the page wait until the platform kills it (5 minutes). */
const QUERY_TIMEOUT_MS = 12_000;

function dropClient(raw: Sql | undefined, graceSeconds: number) {
  if (!raw || g.__qraw !== raw) return;
  g.__qsql = undefined;
  g.__qraw = undefined;
  raw.end({ timeout: graceSeconds }).catch(() => {});
}

/** Wrap the client so every awaited query races a timeout; on timeout the client is discarded and
 *  the next query opens a fresh connection. Fragments (nested sql``) are never awaited, so they
 *  never start a timer. sql.begin / transactions are passed through unchanged. */
function guard(raw: Sql): Sql {
  const wrap = (q: any) => {
    if (!q || typeof q.then !== "function") return q;
    const orig = q.then; // postgres.js starts the query lazily inside then()
    q.then = function (onOk?: any, onErr?: any) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          dropClient(raw, 0);
          reject(new Error(`database query timed out after ${QUERY_TIMEOUT_MS / 1000}s`));
        }, QUERY_TIMEOUT_MS);
      });
      const run = orig.call(q, (v: any) => v, (e: any) => { throw e; });
      return Promise.race([run, timeout]).finally(() => clearTimeout(timer)).then(onOk, onErr);
    };
    return q;
  };
  return new Proxy(raw as any, {
    apply(target, thisArg, args) {
      return wrap(Reflect.apply(target, thisArg, args));
    },
    get(target, prop) {
      const v = (target as any)[prop];
      if (prop === "unsafe" && typeof v === "function") return (...a: any[]) => wrap(v(...a));
      return v;
    },
  }) as Sql;
}

function client(): Sql {
  const now = Date.now();
  if (g.__qsql && g.__qlast && now - g.__qlast > STALE_MS) dropClient(g.__qraw, 5); // let any query still running finish
  g.__qlast = now;
  if (!g.__qsql) {
    const url = dbUrl();
    if (!url) throw new Error("DATABASE_URL is not set");
    const local = /localhost|127\.0\.0\.1/.test(url);
    const raw = postgres(url, {
      ssl: local ? false : "require",
      max: 3,
      // must stay above STALE_MS: an idle timer that expired during a freeze fires on wake and kills the socket mid-query
      idle_timeout: 30,
      max_lifetime: 60 * 5,
      connect_timeout: 10,
      prepare: false,
      onnotice: () => {},
    });
    g.__qraw = raw;
    g.__qsql = guard(raw);
  }
  return g.__qsql;
}

/** Bump when init() gains new DDL. Once the database is at this version, cold starts skip the DDL
 *  entirely (ALTER TABLE takes exclusive locks even when it changes nothing, and instances that
 *  start together would otherwise queue behind each other's locks). */
const SCHEMA_VERSION = 4;

async function schemaCurrent(sql: Sql): Promise<boolean> {
  // No errors on purpose: this also runs inside the migration transaction, where an error would abort it.
  const [{ t }] = await sql<{ t: string | null }[]>`select to_regclass('public.settings')::text as t`;
  if (!t) return false;
  const r = await sql<{ v: string }[]>`select value #>> '{}' as v from settings where key = '_schema_version'`;
  return !!r[0] && Number(r[0].v) >= SCHEMA_VERSION;
}

async function init(sql: Sql) {
  if (await schemaCurrent(sql)) return;
  // One instance migrates at a time; the rest wait on the lock, then see the new version and skip.
  await sql.begin(async (tx: any) => {
    await tx`select pg_advisory_xact_lock(724519)`;
    if (await schemaCurrent(tx)) return;
    await migrate(tx);
    await tx`insert into settings (key, value) values ('_schema_version', ${SCHEMA_VERSION}::text::jsonb)
             on conflict (key) do update set value = excluded.value, updated_at = now()`;
  });
}

async function migrate(sql: Sql) {
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

  // ---- Admin v3 (phase 2): every module's tables. Additive and idempotent. ----
  await sql`alter table customers add column if not exists birthday date`;

  await sql`
    create table if not exists settings (
      key text primary key,
      value jsonb not null default '{}'::jsonb,
      updated_at timestamptz not null default now()
    )`;

  await sql`
    create table if not exists categories (
      key text primary key,
      name text not null,
      parent text,
      description text not null default '',
      image text not null default '',
      banner text not null default '',
      sort integer not null default 100,
      active boolean not null default true,
      featured boolean not null default false,
      seo_title text not null default '',
      seo_description text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`;

  await sql`
    create table if not exists pages (
      id serial primary key,
      slug text unique not null,
      title text not null,
      type text not null default 'page',
      blocks jsonb not null default '[]'::jsonb,
      status text not null default 'draft',
      publish_at timestamptz,
      seo_title text not null default '',
      seo_description text not null default '',
      share_image text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`;

  await sql`
    create table if not exists reviews (
      id serial primary key,
      product_id integer not null references products(id) on delete cascade,
      name text not null default '',
      phone text not null default '',
      rating integer not null default 5,
      title text not null default '',
      body text not null default '',
      images jsonb not null default '[]'::jsonb,
      verified boolean not null default false,
      status text not null default 'pending',
      reply text not null default '',
      reply_at timestamptz,
      reported boolean not null default false,
      created_at timestamptz not null default now()
    )`;
  await sql`create index if not exists reviews_product_idx on reviews(product_id, status)`;

  await sql`
    create table if not exists automation_rules (
      id serial primary key,
      name text not null,
      trigger text not null,
      conditions jsonb not null default '[]'::jsonb,
      actions jsonb not null default '[]'::jsonb,
      delay_minutes integer not null default 0,
      active boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`;
  await sql`
    create table if not exists automation_runs (
      id serial primary key,
      rule_id integer references automation_rules(id) on delete cascade,
      event_key text not null,
      customer_phone text not null default '',
      status text not null,
      detail text not null default '',
      due_at timestamptz,
      created_at timestamptz not null default now(),
      unique (rule_id, event_key)
    )`;

  await sql`
    create table if not exists admin_users (
      id serial primary key,
      email text unique not null,
      name text not null default '',
      password_hash text not null default '',
      role text not null default 'store_manager',
      permissions jsonb,
      active boolean not null default true,
      last_login timestamptz,
      created_at timestamptz not null default now()
    )`;
  await sql`
    create table if not exists login_history (
      id serial primary key,
      user_id integer,
      email text not null default '',
      ok boolean not null default false,
      ip text not null default '',
      user_agent text not null default '',
      created_at timestamptz not null default now()
    )`;
  await sql`alter table reviews add column if not exists ip_hash text not null default ''`;

  // automations engine (reports/automations agent)
  await sql`alter table automation_rules add column if not exists trigger_config jsonb not null default '{}'::jsonb`;
  await sql`alter table automation_runs add column if not exists payload jsonb not null default '{}'::jsonb`;
  await sql`alter table automation_runs add column if not exists results jsonb not null default '[]'::jsonb`;
  await sql`alter table automation_runs add column if not exists ran_at timestamptz`;
  await sql`create index if not exists automation_runs_due_idx on automation_runs(status, due_at)`;

  // automatic promotions (v4)
  await sql`
    create table if not exists promotions (
      id serial primary key,
      name text not null,
      type text not null,
      scope jsonb not null default '{}'::jsonb,
      config jsonb not null default '{}'::jsonb,
      starts_at timestamptz,
      ends_at timestamptz,
      active boolean not null default true,
      allow_coupon boolean not null default true,
      badge text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`;
  await sql`alter table orders add column if not exists promo_discount integer not null default 0`;
  await sql`alter table orders add column if not exists promotions jsonb not null default '[]'::jsonb`;

  // Lock every table against Supabase's public API (the store talks to Postgres directly from its server).
  for (const t of ["settings", "categories", "pages", "reviews", "automation_rules", "automation_runs", "admin_users", "login_history", "promotions"]) {
    await sql.unsafe(`alter table ${t} enable row level security`);
    await sql.unsafe(`revoke all on table ${t} from anon, authenticated`).catch(() => {});
  }

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
