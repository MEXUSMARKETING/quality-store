import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { CLOSED, VIP_MIN, getCustomerAdmin, intlPhone, itemsCount } from "@/lib/admin-orders";
import { shekel, waLink } from "@/lib/config";
import { Chip, Empty, Icon, Notice, OrderStatusChip, PageHeader, PaymentStatusChip, fmtDate, fmtDateTime } from "../../_components/ui";
import { ConfirmForm, EditCustomerForm, NotesForm } from "../_components/forms";
import { customerArchiveAction, customerConsentAction, customerTagAction } from "../actions";

export const dynamic = "force-dynamic";

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`a-card flex flex-col gap-3 ${className}`} aria-label={title}>
      <h2 className="text-[16px] font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default async function CustomerPage({ params, searchParams }: { params: { id: string }; searchParams: { saved?: string } }) {
  if (!isAdmin()) return null;
  const data = await getCustomerAdmin(Number(params.id));
  if (!data) notFound();
  const { customer: c, orders } = data;

  const valid = orders.filter((o) => !CLOSED.includes(o.status));
  const spent = valid.reduce((a, o) => a + o.total, 0);
  const aov = valid.length ? Math.round(spent / valid.length) : 0;
  const first = valid.length ? valid[valid.length - 1].created_at : null;
  const last = valid.length ? valid[0].created_at : null;
  const pairs = valid.reduce((a, o) => a + itemsCount(o), 0);
  const sizes = Array.from(new Set(valid.flatMap((o) => o.items.map((i) => i.size)))).sort((a, b) => Number(a) - Number(b));

  const stats = [
    { label: "הזמנות", value: String(valid.length), sub: orders.length !== valid.length ? `+${orders.length - valid.length} שבוטלו/הוחזרו` : `${pairs} זוגות` },
    { label: "סך רכישות", value: shekel(spent), sub: spent >= VIP_MIN ? "לקוחת VIP" : `VIP מ־${shekel(VIP_MIN)}` },
    { label: "סל ממוצע", value: valid.length ? shekel(aov) : "—", sub: sizes.length ? `מידות: ${sizes.join(", ")}` : "אין רכישות" },
    { label: "רכישה ראשונה / אחרונה", value: last ? fmtDate(last) : "—", sub: first ? `ראשונה: ${fmtDate(first)}` : "—" },
  ];

  const wa = waLink(c.name ? `שלום ${c.name}, כאן Quality טמרה.` : "שלום, כאן Quality טמרה.", intlPhone(c.phone));

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin", label: "ראשי" }, { href: "/admin/customers", label: "לקוחות" }, { label: c.name || c.phone }]}
        title={c.name || "ללא שם"}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <span dir="ltr">{c.phone}</span>
            {c.city && <span>· {c.city}</span>}
            <span>· לקוחה מ־{fmtDate(c.created_at)}</span>
            {spent >= VIP_MIN && <Chip tone="purple">VIP</Chip>}
            {c.archived && <Chip tone="gray">בארכיון</Chip>}
          </span>
        }
      >
        <a href={`tel:${c.phone}`} className="a-btn">התקשרות</a>
        <a href={wa} target="_blank" rel="noopener noreferrer" className="a-btn !bg-[#1F8A4C] !border-[#1F8A4C] !text-white hover:!bg-[#187040]">
          וואטסאפ <span className="sr-only">(נפתח בחלון חדש)</span>
        </a>
        <Link href="/admin/orders/new" className="a-btn a-btn-primary"><Icon name="plus" /> הזמנה ידנית</Link>
      </PageHeader>

      {searchParams.saved && <Notice tone="green">הלקוח נשמר.</Notice>}
      {c.archived && <Notice tone="amber">הלקוח בארכיון ולא מופיע ברשימות ובסגמנטים. הזמנה חדשה מאותו מספר תחזיר אותו אוטומטית.</Notice>}

      <section aria-label="נתוני רכישה" className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {stats.map((s) => (
          <div key={s.label} className="a-card flex flex-col gap-1.5">
            <span className="text-[14px] text-adm-muted font-medium">{s.label}</span>
            <b className="text-[24px] font-extrabold text-adm-navy tracking-tight">{s.value}</b>
            <span className="text-[12px] text-adm-muted">{s.sub}</span>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr] items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <section className="a-card !p-0 overflow-hidden" aria-label="היסטוריית הזמנות">
            <h2 className="text-[16px] font-bold p-[18px] pb-3">היסטוריית הזמנות</h2>
            {orders.length ? (
              <div className="overflow-x-auto">
                <table className="a-table min-w-[620px]">
                  <thead><tr><th>הזמנה</th><th>תאריך</th><th>פריטים</th><th>סכום</th><th>תשלום</th><th>סטטוס</th></tr></thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td><Link href={`/admin/orders/${o.id}`} className="font-bold text-adm-link" dir="ltr">{o.number}</Link></td>
                        <td className="text-adm-muted whitespace-nowrap">{fmtDateTime(o.created_at)}</td>
                        <td className="text-[13px]">{o.items.map((i) => `${i.name} (${i.size})${i.qty > 1 ? ` ×${i.qty}` : ""}`).join(", ")}</td>
                        <td className="font-semibold whitespace-nowrap">{shekel(o.total)}</td>
                        <td><PaymentStatusChip status={o.payment_status} /></td>
                        <td><OrderStatusChip status={o.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty title="עדיין אין הזמנות" text="הזמנות מקושרות ללקוחה לפי מספר הטלפון.">
                <Link href="/admin/orders/new" className="a-btn a-btn-sm">יצירת הזמנה ידנית</Link>
              </Empty>
            )}
          </section>

          <Card title="הערות פנימיות">
            <NotesForm c={c} />
          </Card>
        </div>

        <div className="flex flex-col gap-4 min-w-0">
          <Card title="פרטי קשר">
            <EditCustomerForm c={c} />
          </Card>

          <Card title="תגיות">
            {c.tags.length ? (
              <ul className="flex flex-wrap gap-2" aria-label="תגיות הלקוחה">
                {c.tags.map((t) => (
                  <li key={t}>
                    <form action={customerTagAction} className="inline-flex">
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="op" value="remove" />
                      <input type="hidden" name="tag" value={t} />
                      <span className="a-chip bg-[#EEF4FF] text-[#1F5FD6] !pl-1">
                        {t}
                        <button type="submit" aria-label={`הסרת התגית ${t}`} className="w-9 h-9 -my-2.5 -ml-1.5 rounded-full flex items-center justify-center hover:bg-[#D6E4FD]">
                          <Icon name="close" size={13} />
                        </button>
                      </span>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[14px] text-adm-muted">אין תגיות עדיין.</p>
            )}
            <form action={customerTagAction} className="flex gap-2 items-end">
              <input type="hidden" name="id" value={c.id} />
              <input type="hidden" name="op" value="add" />
              <label className="a-field flex-1">
                תגית חדשה
                <input name="tag" required maxLength={30} className="a-input" placeholder="למשל: מידה 38, לקוחת חנות" list="tag-suggestions" />
              </label>
              <datalist id="tag-suggestions">
                {["לקוחת חנות", "וואטסאפ", "מידה רחבה", "מתנה", "החזרה"].filter((t) => !c.tags.includes(t)).map((t) => <option key={t} value={t} />)}
              </datalist>
              <button className="a-btn a-btn-sm h-[42px]">הוספה</button>
            </form>
          </Card>

          <Card title="דיוור שיווקי">
            <p className="text-[14px] flex items-center gap-2">
              {c.marketing_consent ? <Chip tone="green"><Icon name="check" size={14} /> מאשרת דיוור</Chip> : <Chip tone="gray">לא אישרה דיוור</Chip>}
            </p>
            <ConfirmForm
              action={customerConsentAction}
              fields={{ id: c.id, value: c.marketing_consent ? "0" : "1" }}
              message={c.marketing_consent ? "להסיר את ההסכמה לדיוור?" : "לסמן שהלקוחה אישרה קבלת דיוור? סמנו רק אם התקבל אישור מפורש."}
            >
              <button className="a-btn a-btn-sm">{c.marketing_consent ? "הסרת הסכמה" : "סימון שאישרה דיוור"}</button>
            </ConfirmForm>
            <p className="text-[12px] text-adm-muted">כל שינוי נרשם ביומן הפעילות.</p>
          </Card>

          <Card title={c.archived ? "ארכיון" : "העברה לארכיון"}>
            <p className="text-[13px] text-adm-muted">{c.archived ? "החזרה תציג את הלקוח שוב ברשימות." : "מסתיר את הלקוח מהרשימות. ההזמנות שלו נשמרות."}</p>
            <ConfirmForm action={customerArchiveAction} fields={{ id: c.id, value: c.archived ? "0" : "1" }} message={c.archived ? "להחזיר את הלקוח מהארכיון?" : `להעביר את ${c.name || "הלקוח"} לארכיון?`}>
              <button className={`a-btn a-btn-sm ${c.archived ? "" : "a-btn-danger"}`}>{c.archived ? "החזרה מהארכיון" : "העברה לארכיון"}</button>
            </ConfirmForm>
          </Card>
        </div>
      </div>
    </>
  );
}
