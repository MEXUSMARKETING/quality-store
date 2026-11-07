import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { ORDER_PAGE_SIZE, itemsCount, listOrdersAdmin } from "@/lib/admin-orders";
import { PAYMENT, PAYMENT_STATUS, shekel } from "@/lib/config";
import { Empty, Icon, LinkTabs, OrderStatusChip, PageHeader, PaymentStatusChip, fmtDateTime } from "../_components/ui";
import BulkOrders from "./_components/BulkOrders";
import { RANGES, SORTS, STATUS_TABS, ordersHref, parseOrdersSearch, type OrdersSearch } from "./_lib";

export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: OrdersSearch }) {
  if (!isAdmin()) return null;
  const { status, range, sort, pay, q, page, filters } = parseOrdersSearch(searchParams);
  const { rows, total, counts } = await listOrdersAdmin(filters);
  const pages = Math.max(1, Math.ceil(total / ORDER_PAGE_SIZE));
  const cur = { status, q, pay, range, sort };
  const filtered = !!(q || pay || range !== "all");

  const tabCount = (statuses: string[]) =>
    statuses.length ? statuses.reduce((a, s) => a + (counts[s] || 0), 0) : Object.values(counts).reduce((a, b) => a + b, 0);

  const exportHref = ordersHref(cur, "/admin/orders/export");

  return (
    <>
      <PageHeader crumbs={[{ href: "/admin", label: "ראשי" }, { label: "הזמנות" }]} title="הזמנות" sub={hasDb() ? `${total.toLocaleString("he-IL")} הזמנות${filtered || status ? " תואמות לסינון" : ""}` : undefined}>
        <a href={exportHref} className="a-btn" download>
          <Icon name="download" /> ייצוא CSV
        </a>
        <Link href="/admin/orders/new" className="a-btn a-btn-primary">
          <Icon name="plus" /> הזמנה ידנית
        </Link>
      </PageHeader>

      <LinkTabs tabs={STATUS_TABS.map((t) => ({ href: ordersHref({ ...cur, status: t.key }), label: t.label, count: tabCount(t.statuses), active: (status === "cancelled" || status === "returned" ? "closed" : status) === t.key }))} />

      <form method="get" action="/admin/orders" role="search" aria-label="סינון הזמנות" className="a-card !p-3.5 flex flex-wrap gap-3 items-end">
        {status && <input type="hidden" name="status" value={status} />}
        <label className="a-field flex-[2_1_220px]">
          חיפוש
          <input name="q" defaultValue={q} className="a-input" placeholder="מספר הזמנה, שם או טלפון" type="search" />
        </label>
        <label className="a-field flex-[1_1_150px]">
          תשלום
          <select name="pay" defaultValue={pay} className="a-input">
            <option value="">כל הסטטוסים</option>
            {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label className="a-field flex-[1_1_150px]">
          תקופה
          <select name="range" defaultValue={range} className="a-input">
            {Object.entries(RANGES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label className="a-field flex-[1_1_170px]">
          מיון
          <select name="sort" defaultValue={sort} className="a-input">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button className="a-btn a-btn-dark h-[42px]">סינון</button>
          {filtered && <Link href={ordersHref({ status })} className="a-btn h-[42px]">ניקוי</Link>}
        </div>
      </form>

      <section className="a-card !p-0 overflow-hidden">
        {rows.length ? (
          <BulkOrders ids={rows.map((o) => o.id)}>
            <div className="overflow-x-auto">
              <table className="a-table min-w-[960px]">
                <caption className="sr-only">רשימת הזמנות, עמוד {page} מתוך {pages}</caption>
                <thead>
                  <tr>
                    <th className="w-10"><span className="sr-only">בחירה</span></th>
                    <th>הזמנה</th>
                    <th>לקוחה</th>
                    <th>תאריך</th>
                    <th>פריטים</th>
                    <th>סכום</th>
                    <th>אמצעי תשלום</th>
                    <th>תשלום</th>
                    <th>סטטוס</th>
                    <th><span className="sr-only">פעולות</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <input type="checkbox" name="ids" value={o.id} className="w-[18px] h-[18px] accent-adm-blue align-middle" aria-label={`בחירת הזמנה ${o.number}`} />
                      </td>
                      <td><Link href={`/admin/orders/${o.id}`} className="font-bold text-adm-link" dir="ltr">{o.number}</Link></td>
                      <td>
                        <span className="flex flex-col">
                          <span className="font-semibold">{o.customer_name}</span>
                          <span className="text-[13px] text-adm-muted text-right" dir="ltr">{o.phone}</span>
                        </span>
                      </td>
                      <td className="text-adm-muted whitespace-nowrap">{fmtDateTime(o.created_at)}</td>
                      <td className="text-adm-muted whitespace-nowrap">{itemsCount(o)} זוגות</td>
                      <td className="whitespace-nowrap">
                        <span className="flex flex-col">
                          <b>{shekel(o.total)}</b>
                          {!!o.discount && <span className="text-[12px] text-[#0F7A57]">הנחה {shekel(o.discount)}{o.coupon_code ? <> · <span dir="ltr">{o.coupon_code}</span></> : null}</span>}
                        </span>
                      </td>
                      <td className="text-[13px] text-adm-mid">{PAYMENT[o.payment_method] || o.payment_method}</td>
                      <td><PaymentStatusChip status={o.payment_status} /></td>
                      <td><OrderStatusChip status={o.status} /></td>
                      <td>
                        <Link href={`/admin/orders/${o.id}`} className="a-btn a-btn-sm" aria-label={`פתיחת הזמנה ${o.number}`}>
                          פתיחה <Icon name="arrowLeft" size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </BulkOrders>
        ) : (
          <Empty
            title={filtered || status ? "אין הזמנות שתואמות לסינון" : "עדיין אין הזמנות"}
            text={filtered || status ? "נסו לשנות את החיפוש, התקופה או הלשונית." : "הזמנות מהאתר יופיעו כאן. אפשר גם ליצור הזמנה ידנית למכירה בטלפון או בוואטסאפ."}
          >
            {filtered || status ? <Link href="/admin/orders" className="a-btn">לכל ההזמנות</Link> : <Link href="/admin/orders/new" className="a-btn a-btn-primary"><Icon name="plus" /> הזמנה ידנית</Link>}
          </Empty>
        )}
      </section>

      {pages > 1 && (
        <nav aria-label="עימוד" className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[13px] text-adm-muted">
            מציג {(page - 1) * ORDER_PAGE_SIZE + 1}–{Math.min(page * ORDER_PAGE_SIZE, total)} מתוך {total.toLocaleString("he-IL")}
          </span>
          <span className="flex gap-2">
            {page > 1 ? <Link href={ordersHref({ ...cur, page: page - 1 })} className="a-btn a-btn-sm" rel="prev"><Icon name="arrowRight" size={16} /> הקודם</Link> : <span className="a-btn a-btn-sm opacity-55" aria-disabled="true"><Icon name="arrowRight" size={16} /> הקודם</span>}
            <span className="a-btn a-btn-sm pointer-events-none" aria-current="page">עמוד {page} / {pages}</span>
            {page < pages ? <Link href={ordersHref({ ...cur, page: page + 1 })} className="a-btn a-btn-sm" rel="next">הבא <Icon name="arrowLeft" size={16} /></Link> : <span className="a-btn a-btn-sm opacity-55" aria-disabled="true">הבא <Icon name="arrowLeft" size={16} /></span>}
          </span>
        </nav>
      )}
    </>
  );
}
