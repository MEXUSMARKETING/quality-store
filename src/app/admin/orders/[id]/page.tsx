import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { getOrderAdmin, intlPhone, itemsCount, listOrderTimeline, vatIncluded } from "@/lib/admin-orders";
import { PAYMENT, SHIPPING, shekel, waLink } from "@/lib/config";
import { Chip, Icon, Notice, OrderStatusChip, PageHeader, PaymentStatusChip, fmtDateTime } from "../../_components/ui";
import { NoteForm, PaymentForm, PrintButton, ShipForm, StatusForm } from "../_components/forms";

export const dynamic = "force-dynamic";

const EVENT_STYLE: Record<string, { label: string; tone: "blue" | "green" | "amber" | "red" | "gray" | "purple" }> = {
  created: { label: "נוצרה", tone: "blue" },
  status: { label: "סטטוס", tone: "purple" },
  payment: { label: "תשלום", tone: "green" },
  shipping: { label: "משלוח", tone: "blue" },
  restock: { label: "מלאי", tone: "amber" },
  note: { label: "הערה", tone: "gray" },
  customer: { label: "הערת לקוחה", tone: "amber" },
};

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`a-card flex flex-col gap-3 break-inside-avoid ${className}`} aria-label={title}>
      <h2 className="text-[16px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Row({ k, v, strong = false }: { k: React.ReactNode; v: React.ReactNode; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-3 ${strong ? "text-[16px] font-extrabold text-adm-navy pt-2 border-t border-adm-line" : "text-[14px]"}`}>
      <span className={strong ? "" : "text-adm-mid"}>{k}</span>
      <span>{v}</span>
    </div>
  );
}

export default async function OrderPage({ params, searchParams }: { params: { id: string }; searchParams: { created?: string } }) {
  if (!isAdmin()) return null;
  const data = await getOrderAdmin(Number(params.id));
  if (!data) notFound();
  const { order: o, customerId, restocked } = data;
  const events = await listOrderTimeline(o.id);

  const pairs = itemsCount(o);
  const closed = o.status === "cancelled" || o.status === "returned";
  const address = o.shipping_method === "home" ? [o.street, o.apt, o.city].filter(Boolean).join(", ") : "";

  const summary = [
    `שלום ${o.customer_name}, כאן Quality טמרה.`,
    `לגבי ההזמנה שלך ${o.number}:`,
    ...o.items.map((i) => `• ${i.name} – מידה ${i.size} × ${i.qty}`),
    `סה״כ: ${shekel(o.total)}`,
    o.tracking ? `מספר מעקב: ${o.tracking}` : "",
  ].filter(Boolean).join("\n");
  const wa = intlPhone(o.phone) ? waLink(summary, intlPhone(o.phone)) : "";

  // the customer's checkout note is shown first, as part of the timeline
  const timeline = [
    ...(o.notes ? [{ id: -1, type: "customer", message: o.notes, actor: o.customer_name || "לקוחה", created_at: o.created_at }] : []),
    ...events,
  ];

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin", label: "ראשי" }, { href: "/admin/orders", label: "הזמנות" }, { label: o.number }]}
        title={`הזמנה ${o.number}`}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <OrderStatusChip status={o.status} />
            <PaymentStatusChip status={o.payment_status} />
            <span>{fmtDateTime(o.created_at)} · {pairs} זוגות · {shekel(o.total)}</span>
          </span>
        }
      >
        <span className="flex gap-2 adm-noprint">
          <PrintButton />
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="a-btn !bg-[#1F8A4C] !border-[#1F8A4C] !text-white hover:!bg-[#187040]">
              וואטסאפ ללקוחה <span className="sr-only">(נפתח בחלון חדש)</span>
            </a>
          ) : null}
        </span>
      </PageHeader>

      {searchParams.created && <Notice tone="green">ההזמנה הידנית נוצרה והמלאי עודכן.</Notice>}

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr] items-start print:block">
        <div className="flex flex-col gap-4 min-w-0">
          <Card title={`פריטים (${pairs})`}>
            <ul className="flex flex-col">
              {o.items.map((it, i) => (
                <li key={`${it.productId}-${it.size}-${i}`} className="flex gap-3 items-center py-3 border-b border-[#EEF1F6] last:border-0">
                  {it.image ? <img src={it.image} alt="" className="w-14 h-14 rounded-[10px] object-cover bg-adm-bg shrink-0" /> : <span className="w-14 h-14 rounded-[10px] bg-adm-bg shrink-0" aria-hidden="true" />}
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <Link href={`/admin/products/${it.productId}`} className="font-semibold text-[15px] hover:underline">{it.name}</Link>
                    <span className="text-[13px] text-adm-muted">מידה <b className="text-adm-text">{it.size}</b> · כמות {it.qty} · {shekel(it.price)} ליחידה (במחיר הקנייה)</span>
                  </span>
                  <b className="whitespace-nowrap">{shekel(it.price * it.qty)}</b>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-2 pt-1">
              <Row k="סכום ביניים" v={shekel(o.subtotal)} />
              {!!o.discount && (
                <Row k={<>הנחה{o.coupon_code ? <> · קופון <span dir="ltr" className="font-semibold">{o.coupon_code}</span></> : null}</>} v={<span className="text-[#0F7A57]">−{shekel(o.discount)}</span>} />
              )}
              <Row k="משלוח" v="חינם" />
              <Row k="סה״כ לתשלום" v={shekel(o.total)} strong />
              <Row k="מתוכו מע״מ (18%)" v={shekel(vatIncluded(o.total))} />
            </div>
          </Card>

          <Card title="ציר זמן" className="print:hidden">
            {timeline.length ? (
              <ol className="flex flex-col gap-0 border-r-2 border-adm-line mr-1.5">
                {timeline.map((e) => {
                  const s = EVENT_STYLE[e.type] || { label: e.type, tone: "gray" as const };
                  return (
                    <li key={e.id} className="relative pr-5 pb-4 last:pb-0">
                      <span className="absolute -right-[7px] top-1.5 w-3 h-3 rounded-full bg-white border-2 border-adm-blue" aria-hidden="true" />
                      <div className="flex flex-wrap items-center gap-2 text-[13px] text-adm-muted">
                        <Chip tone={s.tone}>{s.label}</Chip>
                        <span>{fmtDateTime(e.created_at)}</span>
                        {e.actor && <span>· {e.actor}</span>}
                      </div>
                      <p className="text-[14px] pt-1 leading-6 whitespace-pre-line">{e.message}</p>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-[14px] text-adm-muted">אין עדיין אירועים להזמנה זו.</p>
            )}
            <NoteForm id={o.id} />
          </Card>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <Card title="שינוי סטטוס" className="adm-noprint">
            <StatusForm id={o.id} status={o.status} number={o.number} restocked={restocked} />
          </Card>

          <Card title="לקוחה">
            <div className="flex flex-col gap-1.5 text-[14px]">
              <b className="text-[15px]">{o.customer_name}</b>
              <a href={`tel:${o.phone}`} dir="ltr" className="text-right text-adm-link font-semibold self-start">{o.phone}</a>
              {o.email && <a href={`mailto:${o.email}`} dir="ltr" className="text-right text-adm-link self-start break-all">{o.email}</a>}
              {address ? <span>{address}</span> : o.city ? <span>{o.city}</span> : null}
            </div>
            {customerId && (
              <Link href={`/admin/customers/${customerId}`} className="a-btn a-btn-sm self-start adm-noprint">
                <Icon name="users" size={16} /> לכרטיס הלקוחה
              </Link>
            )}
          </Card>

          <Card title="משלוח">
            <Row k="שיטה" v={SHIPPING[o.shipping_method] || o.shipping_method} />
            {o.shipping_method === "home" && address && <Row k="כתובת" v={address} />}
            {o.tracking && <Row k="מספר מעקב" v={<span dir="ltr" className="font-semibold">{o.tracking}</span>} />}
            {o.shipping_method === "home" ? (
              <div className="adm-noprint pt-1">
                <ShipForm id={o.id} tracking={o.tracking || ""} disabled={closed} />
                {closed && <p className="text-[13px] text-adm-muted pt-1">ההזמנה {o.status === "cancelled" ? "בוטלה" : "הוחזרה"} – לא ניתן לסמן כנשלחה.</p>}
              </div>
            ) : (
              <p className="text-[13px] text-adm-muted">איסוף עצמי מהחנות – אין צורך במספר מעקב.</p>
            )}
          </Card>

          <Card title="תשלום">
            <Row k="אמצעי" v={PAYMENT[o.payment_method] || o.payment_method} />
            <Row k="סטטוס" v={<PaymentStatusChip status={o.payment_status} />} />
            <div className="adm-noprint pt-1">
              <PaymentForm id={o.id} paymentStatus={o.payment_status || "pending"} />
            </div>
            <p className="text-[12px] text-adm-muted adm-noprint">אין חיבור לסליקה – סטטוס התשלום מתעדכן ידנית.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
