import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { db, hasDb } from "@/lib/db";
import { listProducts } from "@/lib/store";
import { phoneKey } from "@/lib/admin";
import { shekel } from "@/lib/config";
import { Empty, OrderStatusChip, PageHeader, fmtDate } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  if (!isAdmin()) return null;
  const q = (searchParams.q || "").trim();
  const like = `%${q}%`;
  const digits = phoneKey(q);

  const products = q ? (await listProducts({ includeInactive: true })).filter((p) => (p.name + " " + p.slug + " " + (p.sku || "")).toLowerCase().includes(q.toLowerCase())).slice(0, 10) : [];
  let orders: any[] = [];
  let customers: any[] = [];
  let coupons: any[] = [];
  if (q && hasDb()) {
    const sql = await db();
    [orders, customers, coupons] = await Promise.all([
      sql`select id, number, customer_name, total, status, created_at from orders
          where number ilike ${like} or customer_name ilike ${like} or (${digits} <> '' and regexp_replace(phone, '[^0-9]', '', 'g') like ${"%" + digits + "%"})
          order by id desc limit 10`,
      sql`select id, name, phone, email from customers
          where name ilike ${like} or email ilike ${like} or (${digits} <> '' and phone like ${"%" + digits + "%"})
          order by id desc limit 10`,
      sql`select id, code, description from coupons where code ilike ${like} or description ilike ${like} limit 10`,
    ]);
  }
  const total = products.length + orders.length + customers.length + coupons.length;

  const Group = ({ title, children, count }: { title: string; count: number; children: React.ReactNode }) =>
    count ? (
      <section className="a-card !p-0 overflow-hidden">
        <h2 className="text-[13px] font-bold text-adm-muted px-[18px] pt-3.5 pb-2">{title} · {count}</h2>
        <ul>{children}</ul>
      </section>
    ) : null;

  const Row = ({ href, title, meta, extra }: { href: string; title: React.ReactNode; meta?: React.ReactNode; extra?: React.ReactNode }) => (
    <li className="border-t border-[#F0EEF6]">
      <Link href={href} className="flex items-center justify-between gap-3 px-[18px] py-3 hover:bg-adm-bg">
        <span className="flex flex-col"><b className="text-[14px]">{title}</b>{meta && <span className="text-[13px] text-adm-muted">{meta}</span>}</span>
        {extra}
      </Link>
    </li>
  );

  return (
    <>
      <PageHeader crumbs={[{ href: "/admin", label: "ראשי" }, { label: "חיפוש" }]} title={q ? `תוצאות עבור "${q}"` : "חיפוש"} sub={q ? `${total} תוצאות` : "חפשו מוצר, הזמנה, לקוח או קופון בשורת החיפוש למעלה."} />
      {q && total === 0 && <div className="a-card"><Empty title="לא נמצאו תוצאות" text="נסו מילה אחרת, מספר הזמנה (למשל Q1012) או מספר טלפון." /></div>}
      <Group title="מוצרים" count={products.length}>
        {products.map((p) => <Row key={p.id} href={`/admin/products/${p.id}`} title={p.name} meta={p.sku || p.slug} extra={<b className="text-[14px]">{shekel(p.price)}</b>} />)}
      </Group>
      <Group title="הזמנות" count={orders.length}>
        {orders.map((o) => <Row key={o.id} href={`/admin/orders/${o.id}`} title={<span dir="ltr">{o.number}</span>} meta={`${o.customer_name} · ${fmtDate(o.created_at)}`} extra={<span className="flex items-center gap-3"><b className="text-[14px]">{shekel(Number(o.total))}</b><OrderStatusChip status={o.status} /></span>} />)}
      </Group>
      <Group title="לקוחות" count={customers.length}>
        {customers.map((c) => <Row key={c.id} href={`/admin/customers/${c.id}`} title={c.name || "ללא שם"} meta={<span dir="ltr">{c.phone}</span>} />)}
      </Group>
      <Group title="קופונים" count={coupons.length}>
        {coupons.map((c) => <Row key={c.id} href={`/admin/coupons?edit=${c.id}`} title={<span dir="ltr" className="font-mono">{c.code}</span>} meta={c.description} />)}
      </Group>
    </>
  );
}
