import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { db, hasDb } from "@/lib/db";
import { listPromotions } from "@/lib/promotions";
import { getCategoriesAll } from "@/lib/catalog";
import { autoBadge, describePromo, promoState, TYPE_META, type PromoState, type Promotion } from "@/lib/promotions-shared";
import { Chip, Empty, Icon, LinkTabs, Notice, PageHeader, type Tone } from "../_components/ui";
import { ConfirmButton } from "../coupons/CouponClient";
import { fmtShekel, shortDate } from "../coupons/lib";
import { deletePromotionAction, duplicatePromotionAction, togglePromotionAction } from "./actions";
import { PRESETS } from "./presets";

export const dynamic = "force-dynamic";
export const metadata = { title: "מבצעים" };

const STATE: Record<PromoState, { label: string; tone: Tone }> = {
  active: { label: "פעיל עכשיו", tone: "green" },
  scheduled: { label: "מתוזמן", tone: "blue" },
  expired: { label: "הסתיים", tone: "gray" },
  disabled: { label: "מושהה", tone: "amber" },
};
const TABS: (PromoState | "all")[] = ["all", "active", "scheduled", "disabled", "expired"];

type Stats = { orders: number; discount: number; revenue: number };

export default async function PromotionsPage({ searchParams }: { searchParams: { state?: string; deleted?: string } }) {
  if (!isAdmin()) return null;
  let promos: Promotion[] = [];
  const stats = new Map<number, Stats>();
  let catNames: Record<string, string> = {};
  let productCount = 0;
  if (hasDb()) {
    try {
      const sql = await db();
      const [list, agg, cats, pc] = await Promise.all([
        listPromotions(),
        sql`select (p->>'id')::int as id, count(distinct o.id)::int as orders, coalesce(sum((p->>'discount')::int), 0)::int as discount, coalesce(sum(o.total), 0)::int as revenue
            from orders o, jsonb_array_elements(o.promotions) p
            where o.status not in ('cancelled', 'returned') group by 1`,
        getCategoriesAll(),
        sql`select count(*)::int as n from products where active`,
      ]);
      promos = list;
      for (const r of agg as any[]) stats.set(Number(r.id), { orders: Number(r.orders), discount: Number(r.discount), revenue: Number(r.revenue) });
      catNames = Object.fromEntries(cats.map((c) => [c.key, c.name]));
      productCount = Number((pc as any)[0]?.n || 0);
    } catch (e) {
      console.error(e);
    }
  }

  const now = new Date();
  const rows = promos.map((p) => ({ p, st: promoState(p, now), s: stats.get(p.id) || { orders: 0, discount: 0, revenue: 0 } }));
  const counts: Record<string, number> = { all: rows.length };
  for (const r of rows) counts[r.st] = (counts[r.st] || 0) + 1;
  const tab = TABS.includes(searchParams.state as any) ? (searchParams.state as PromoState | "all") : "all";
  const shown = tab === "all" ? rows : rows.filter((r) => r.st === tab);

  // totals straight from orders (an order with two promotions is counted once)
  const { n: promoOrders, revenue: totalRevenue, discount: totalDiscount } = hasDb() ? await promoTotals() : { n: 0, revenue: 0, discount: 0 };

  const scopeText = (p: Promotion) => {
    const s = p.scope;
    const base = s.mode === "all" ? "כל החנות" : s.mode === "categories" ? s.categories.map((k) => catNames[k] || k).join(", ") : `${s.products.length} מוצרים נבחרים`;
    const extra = [s.exclude.length ? `ללא ${s.exclude.length} מוצרים` : "", s.excludeSale ? "ללא מוצרים שכבר בהנחה" : ""].filter(Boolean);
    return extra.length ? `${base} · ${extra.join(" · ")}` : base;
  };

  const kpis = [
    { label: "מבצעים פעילים עכשיו", value: String(counts.active || 0), sub: `${counts.scheduled || 0} מתוזמנים · ${promos.length} בסך הכל` },
    { label: "הזמנות עם מבצע", value: promoOrders.toLocaleString("he-IL"), sub: "ללא הזמנות שבוטלו או הוחזרו" },
    { label: "הכנסות מהזמנות עם מבצע", value: fmtShekel(totalRevenue), sub: "סכום ששולם בפועל" },
    { label: "סך ההנחות במבצעים", value: fmtShekel(totalDiscount), sub: totalRevenue ? `${Math.round((totalDiscount / (totalRevenue + totalDiscount)) * 100)}% מסכום הסלים` : "עדיין לא נוצל" },
  ];
  const tabHref = (k: string) => (k === "all" ? "/admin/promotions" : `/admin/promotions?state=${k}`);

  return (
    <>
      <PageHeader crumbs={[{ href: "/admin", label: "ראשי" }, { label: "מבצעים" }]} title="מבצעים" sub="הנחות אוטומטיות שמופעלות בסל לבד, בלי קוד. לקודי הנחה ראו קופונים.">
        <Link href="/admin/coupons" className="a-btn"><Icon name="tag" /> לקופונים</Link>
        <Link href="/admin/promotions/new" className="a-btn a-btn-primary"><Icon name="plus" /> מבצע חדש</Link>
      </PageHeader>

      {searchParams.deleted && <Notice tone="green">המבצע <b>{searchParams.deleted}</b> נמחק. ההזמנות שכבר נעשו בו נשמרות כמו שהן.</Notice>}
      {!hasDb() && <Notice tone="amber">מסד הנתונים לא מחובר, לכן אי אפשר ליצור מבצעים כרגע.</Notice>}

      <section aria-label="מדדי מבצעים" className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {kpis.map((k) => (
          <div key={k.label} className="a-card flex flex-col gap-1.5">
            <span className="text-[14px] text-adm-muted font-medium">{k.label}</span>
            <b className="text-[26px] font-extrabold text-adm-navy tracking-tight">{k.value}</b>
            <span className="text-[12px] text-adm-muted">{k.sub}</span>
          </div>
        ))}
      </section>

      <section aria-labelledby="quick" className="a-card flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <h2 id="quick" className="text-[17px] font-bold text-adm-navy">התחלה מהירה</h2>
          <span className="text-[13px] text-adm-muted">בוחרים תבנית, מתאימים מוצרים ותאריכים, ושומרים</span>
        </div>
        <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
          {PRESETS.map((t) => (
            <Link key={t.key} href={`/admin/promotions/new?preset=${t.key}`} className="group rounded-xl border border-adm-line p-3.5 flex flex-col gap-1.5 hover:border-adm-blue hover:bg-[#F8F5FF] transition-colors">
              <span className="self-start text-[13px] font-extrabold px-2.5 py-1 rounded-full bg-[#FFF4E0] text-[#6B4600]">{autoBadge(t.type, t.config)}</span>
              <b className="text-[15px]">{t.title}</b>
              <span className="text-[13px] text-adm-muted leading-5">{t.text}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="a-card !p-0 overflow-hidden">
        <div className="px-3 pt-1">
          <LinkTabs tabs={TABS.map((k) => ({ href: tabHref(k), label: k === "all" ? "הכל" : STATE[k].label, count: counts[k] || 0, active: tab === k }))} />
        </div>
        {shown.length === 0 ? (
          promos.length === 0 ? (
            <Empty title="עדיין אין מבצעים" text="מבצע מופעל אוטומטית בסל, למשל 1+1 על כל המגפונים או 2 זוגות ב-₪300. אפשר להתחיל מתבנית למעלה." >
              {hasDb() && <Link href="/admin/promotions/new" className="a-btn a-btn-primary"><Icon name="plus" /> מבצע חדש</Link>}
            </Empty>
          ) : (
            <Empty title="אין מבצעים במצב הזה" text="בחרו לשונית אחרת כדי לראות את שאר המבצעים." />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="a-table min-w-[1040px]">
              <thead>
                <tr>
                  <th>מבצע</th>
                  <th>מה הלקוחה מקבלת</th>
                  <th>על אילו מוצרים</th>
                  <th>תוקף</th>
                  <th>ביצועים</th>
                  <th>מצב</th>
                  <th><span className="sr-only">פעולות</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ p, st, s }) => (
                  <tr key={p.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-[12px] font-extrabold px-2 py-0.5 rounded-full bg-[#FFF4E0] text-[#6B4600]">{p.badge || autoBadge(p.type, p.config)}</span>
                        <Link href={`/admin/promotions/${p.id}`} className="font-bold text-adm-navy hover:underline">{p.name}</Link>
                      </div>
                      <div className="text-[12px] text-adm-muted pt-0.5">{TYPE_META[p.type].short}{p.allow_coupon ? "" : " · לא מצטבר עם קופונים"}</div>
                    </td>
                    <td className="text-[13px] max-w-[280px]">{describePromo(p.type, p.config)}</td>
                    <td className="text-[13px] max-w-[220px]">{scopeText(p)}{p.scope.mode === "all" && productCount ? <span className="text-adm-muted"> ({productCount} מוצרים)</span> : null}</td>
                    <td className="text-[13px] whitespace-nowrap">
                      {p.starts_at || p.ends_at ? (
                        <>
                          {p.starts_at && <div>מ־{shortDate(p.starts_at)}</div>}
                          {p.ends_at && <div>עד {shortDate(p.ends_at)}</div>}
                        </>
                      ) : <span className="text-adm-muted">ללא הגבלה</span>}
                    </td>
                    <td className="whitespace-nowrap">
                      <b className="text-[14px]">{s.orders} הזמנות</b>
                      <div className="text-[12px] text-adm-muted">{s.discount ? `הנחה ${fmtShekel(s.discount)} · הכנסות ${fmtShekel(s.revenue)}` : "עדיין לא נוצל"}</div>
                    </td>
                    <td><Chip tone={STATE[st].tone}>{STATE[st].label}</Chip></td>
                    <td>
                      <div className="flex items-center gap-1.5 justify-end">
                        <form action={togglePromotionAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <button type="submit" role="switch" aria-checked={p.active} aria-label={`${p.active ? "השהיית" : "הפעלת"} המבצע ${p.name}`} title={p.active ? "השהיה" : "הפעלה"} className="h-9 px-1.5 flex items-center rounded-lg hover:bg-adm-bg">
                            <span className={`w-10 h-[22px] rounded-full p-[3px] flex transition-colors ${p.active ? "bg-[#0F7A57] justify-end" : "bg-[#B7C0CF] justify-start"}`} dir="ltr">
                              <span className="w-4 h-4 rounded-full bg-white shadow" />
                            </span>
                          </button>
                        </form>
                        <Link href={`/admin/promotions/${p.id}`} className="a-btn a-btn-sm !h-9 !px-2.5" aria-label={`עריכת המבצע ${p.name}`} title="עריכה"><Icon name="edit" size={15} /></Link>
                        <form action={duplicatePromotionAction}>
                          <input type="hidden" name="id" value={p.id} />
                          <button type="submit" className="a-btn a-btn-sm !h-9 !px-2.5" aria-label={`שכפול המבצע ${p.name}`} title="שכפול"><Icon name="copy" size={15} /></button>
                        </form>
                        <ConfirmButton action={deletePromotionAction} id={p.id} ariaLabel={`מחיקת המבצע ${p.name}`} message={`למחוק את המבצע "${p.name}"? הזמנות שכבר נעשו בו לא ישתנו.`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[13px] text-adm-muted leading-6">
        כשכמה מבצעים חלים על אותו סל, המערכת בוחרת לבד את השילוב המשתלם ביותר ללקוחה, ופריט אחד לא מקבל שתי הנחות. קופון מחושב אחרי המבצעים, אלא אם הגדרתם שהמבצע לא מצטבר עם קופונים.
      </p>
    </>
  );
}

async function promoTotals(): Promise<{ n: number; revenue: number; discount: number }> {
  try {
    const sql = await db();
    const [r] = await sql`select count(*)::int as n, coalesce(sum(total), 0)::int as revenue, coalesce(sum(promo_discount), 0)::int as discount
      from orders where promo_discount > 0 and status not in ('cancelled', 'returned')`;
    return { n: Number(r.n), revenue: Number(r.revenue), discount: Number(r.discount) };
  } catch {
    return { n: 0, revenue: 0, discount: 0 };
  }
}
