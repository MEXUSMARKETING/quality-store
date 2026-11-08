import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { SEGMENTS, VIP_MIN, filterCustomers, listCustomersAgg } from "@/lib/admin-orders";
import { shekel } from "@/lib/config";
import { Chip, Empty, Icon, LinkTabs, PageHeader, fmtDate } from "../_components/ui";

export const dynamic = "force-dynamic";

const SORTS: Record<string, string> = { last: "רכישה אחרונה", spent: "סך רכישות", name: "שם (א–ת)", newest: "הצטרפות אחרונה" };
const PAGE = 50;
const DAY = 24 * 3600 * 1000;

type SP = { seg?: string; q?: string; sort?: string; page?: string };

function href(p: { seg?: string; q?: string; sort?: string; page?: number }, path = "/admin/customers") {
  const u = new URLSearchParams();
  if (p.seg && p.seg !== "all") u.set("seg", p.seg);
  if (p.q) u.set("q", p.q);
  if (p.sort && p.sort !== "last") u.set("sort", p.sort);
  if (p.page && p.page > 1) u.set("page", String(p.page));
  const s = u.toString();
  return s ? `${path}?${s}` : path;
}

export default async function CustomersPage({ searchParams }: { searchParams: SP }) {
  if (!isAdmin()) return null;
  const seg = SEGMENTS[searchParams.seg || ""] ? searchParams.seg! : "all";
  const sort = SORTS[searchParams.sort || ""] ? searchParams.sort! : "last";
  const q = (searchParams.q || "").trim().slice(0, 80);
  const page = Math.max(1, parseInt(searchParams.page || "1", 10) || 1);

  const all = await listCustomersAgg();
  const now = Date.now();
  const live = all.filter((c) => !c.archived);
  const list = filterCustomers(all, { seg, q, sort });
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const rows = list.slice((page - 1) * PAGE, page * PAGE);

  const buyers = live.filter((c) => c.orders >= 1).length;
  const returning = live.filter((c) => c.orders >= 2).length;
  const kpis = [
    { label: "לקוחות", value: live.length.toLocaleString("he-IL"), sub: `${buyers} ביצעו לפחות הזמנה אחת` },
    { label: "חדשים ב־30 יום", value: String(live.filter((c) => now - new Date(c.created_at).getTime() <= 30 * DAY).length), sub: "לפי תאריך יצירת הכרטיס" },
    { label: "לקוחות חוזרים", value: buyers ? `${Math.round((returning / buyers) * 100)}%` : "—", sub: `${returning} עם 2 הזמנות ומעלה (מתוך הקונים)` },
    { label: "מאשרים דיוור", value: String(live.filter((c) => c.marketing_consent).length), sub: live.length ? `${Math.round((live.filter((c) => c.marketing_consent).length / live.length) * 100)}% מהלקוחות` : "—" },
  ];

  const segCount = (k: string) => all.filter((c) => SEGMENTS[k].test(c, now)).length;
  const segLabel = (k: string) => (k === "returning" ? "חוזרים (2+ הזמנות)" : k === "vip" ? `VIP (${shekel(VIP_MIN)}+)` : SEGMENTS[k].label);

  return (
    <>
      <PageHeader crumbs={[{ href: "/admin", label: "ראשי" }, { label: "לקוחות" }]} title="לקוחות" sub="כל מי שהזמינה באתר, הצטרפה למועדון או נוספה ידנית. סכומים לא כוללים הזמנות שבוטלו או הוחזרו.">
        <a href={href({ seg, q, sort }, "/admin/customers/export")} className="a-btn" download><Icon name="download" /> ייצוא CSV</a>
        <Link href="/admin/customers/new" className="a-btn a-btn-primary"><Icon name="plus" /> הוספת לקוח</Link>
      </PageHeader>

      <section aria-label="מדדי לקוחות" className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {kpis.map((k) => (
          <div key={k.label} className="a-card flex flex-col gap-1.5">
            <span className="text-[14px] text-adm-muted font-medium">{k.label}</span>
            <b className="text-[26px] font-extrabold text-adm-navy tracking-tight">{k.value}</b>
            <span className="text-[12px] text-adm-muted">{k.sub}</span>
          </div>
        ))}
      </section>

      <LinkTabs tabs={Object.keys(SEGMENTS).map((k) => ({ href: href({ seg: k, q, sort }), label: segLabel(k), count: segCount(k), active: k === seg }))} />

      <form method="get" action="/admin/customers" role="search" aria-label="חיפוש לקוחות" className="a-card !p-3.5 flex flex-wrap gap-3 items-end">
        {seg !== "all" && <input type="hidden" name="seg" value={seg} />}
        <label className="a-field flex-[2_1_240px]">
          חיפוש
          <input type="search" name="q" defaultValue={q} className="a-input" placeholder="שם, טלפון, מייל, עיר או תגית" />
        </label>
        <label className="a-field flex-[1_1_170px]">
          מיון
          <select name="sort" defaultValue={sort} className="a-input">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button className="a-btn a-btn-dark h-[42px]">חיפוש</button>
          {q && <Link href={href({ seg, sort })} className="a-btn h-[42px]">ניקוי</Link>}
        </div>
      </form>

      <section className="a-card !p-0 overflow-hidden">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="a-table min-w-[900px]">
              <caption className="sr-only">רשימת לקוחות – {segLabel(seg)}</caption>
              <thead>
                <tr><th>שם</th><th>טלפון</th><th>עיר</th><th>הזמנות</th><th>סך רכישות</th><th>רכישה אחרונה</th><th>תגיות</th><th>דיוור</th></tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/customers/${c.id}`} className="font-semibold text-adm-link">{c.name || "ללא שם"}</Link>
                      {c.archived && <Chip tone="gray" className="mr-2">בארכיון</Chip>}
                    </td>
                    <td dir="ltr" className="text-right whitespace-nowrap">{c.phone}</td>
                    <td className="text-adm-mid">{c.city || "—"}</td>
                    <td>{c.orders}</td>
                    <td className="font-semibold whitespace-nowrap">
                      {shekel(c.spent)}
                      {c.spent >= VIP_MIN && <Chip tone="purple" className="mr-2">VIP</Chip>}
                    </td>
                    <td className="text-adm-muted whitespace-nowrap">{fmtDate(c.last_order)}</td>
                    <td>
                      <span className="flex gap-1 flex-wrap">{c.tags.slice(0, 3).map((t) => <Chip key={t} tone="blue">{t}</Chip>)}{c.tags.length > 3 && <Chip tone="gray">+{c.tags.length - 3}</Chip>}</span>
                    </td>
                    <td>
                      {c.marketing_consent
                        ? <span role="img" aria-label="מאשרת דיוור" className="inline-flex w-7 h-7 rounded-full bg-[#E6F6F0] text-[#0F7A57] items-center justify-center"><Icon name="check" size={16} /></span>
                        : <span role="img" aria-label="לא אישרה דיוור" className="inline-flex w-7 h-7 rounded-full bg-[#F0EEF6] text-[#615C7A] items-center justify-center"><Icon name="close" size={14} /></span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={!hasDb() ? "מסד הנתונים לא מחובר" : all.length ? "אין לקוחות שתואמים לסינון" : "עדיין אין לקוחות"}
            text={all.length ? "נסו לשנות את החיפוש או הלשונית." : "לקוחות נוצרים אוטומטית מכל הזמנה באתר ומכל הצטרפות למועדון."}
          >
            {all.length ? <Link href="/admin/customers" className="a-btn">לכל הלקוחות</Link> : <Link href="/admin/customers/new" className="a-btn a-btn-primary"><Icon name="plus" /> הוספת לקוח</Link>}
          </Empty>
        )}
      </section>

      {pages > 1 && (
        <nav aria-label="עימוד" className="flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[13px] text-adm-muted">מציג {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, list.length)} מתוך {list.length}</span>
          <span className="flex gap-2">
            {page > 1 && <Link href={href({ seg, q, sort, page: page - 1 })} className="a-btn a-btn-sm" rel="prev"><Icon name="arrowRight" size={16} /> הקודם</Link>}
            <span className="a-btn a-btn-sm pointer-events-none" aria-current="page">עמוד {page} / {pages}</span>
            {page < pages && <Link href={href({ seg, q, sort, page: page + 1 })} className="a-btn a-btn-sm" rel="next">הבא <Icon name="arrowLeft" size={16} /></Link>}
          </span>
        </nav>
      )}
    </>
  );
}
