import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { db, hasDb } from "@/lib/db";
import { couponState, normCoupon, type CouponState } from "@/lib/admin";
import type { Coupon } from "@/lib/types";
import { Chip, Empty, Icon, LinkTabs, Notice, PageHeader } from "../_components/ui";
import { deleteCouponAction, toggleCouponAction } from "./actions";
import { ConfirmButton, CopyCode, CouponDrawer, type CouponFormValues } from "./CouponClient";
import { STATE_META, fmtShekel, shortDate, toIsraelYmd, valueLabel } from "./lib";

export const dynamic = "force-dynamic";
export const metadata = { title: "קופונים" };

type Stats = { orders: number; revenue: number; discount: number };

const TAB_ORDER: (CouponState | "all")[] = ["all", "active", "scheduled", "expired", "used_up", "disabled"];

export default async function CouponsPage({ searchParams }: { searchParams: { state?: string; edit?: string; new?: string; saved?: string; deleted?: string; error?: string } }) {
  if (!isAdmin()) return null;

  let coupons: Coupon[] = [];
  const stats = new Map<string, Stats>();
  if (hasDb()) {
    try {
      const sql = await db();
      const [rows, agg] = await Promise.all([
        sql`select * from coupons order by created_at desc, id desc`,
        sql`select upper(coupon_code) as code, count(*)::int as orders, coalesce(sum(total), 0)::int as revenue, coalesce(sum(discount), 0)::int as discount
            from orders where coupon_code <> '' and status not in ('cancelled', 'returned') group by 1`,
      ]);
      coupons = rows.map(normCoupon);
      for (const r of agg as any[]) stats.set(r.code, { orders: Number(r.orders), revenue: Number(r.revenue), discount: Number(r.discount) });
    } catch (e) {
      console.error(e);
    }
  }

  const now = new Date();
  const withState = coupons.map((c) => ({ c, st: couponState(c, now), s: stats.get(c.code.toUpperCase()) || { orders: 0, revenue: 0, discount: 0 } }));
  const counts: Record<string, number> = { all: withState.length };
  for (const x of withState) counts[x.st] = (counts[x.st] || 0) + 1;
  const tab = TAB_ORDER.includes(searchParams.state as any) ? (searchParams.state as CouponState | "all") : "all";
  const shown = tab === "all" ? withState : withState.filter((x) => x.st === tab);

  let totalRevenue = 0, totalDiscount = 0, totalOrders = 0;
  for (const s of stats.values()) { totalRevenue += s.revenue; totalDiscount += s.discount; totalOrders += s.orders; }
  const totalUses = coupons.reduce((a, c) => a + c.used, 0);

  // drawer (create / edit)
  let drawer: CouponFormValues | null = null;
  let editMissing = false;
  if (searchParams.new) {
    drawer = { id: null, code: "", description: "", type: "percent", value: "", min_total: "", max_discount: "", starts_at: "", ends_at: "", usage_limit: "", per_customer: "1", active: true, used: 0 };
  } else if (searchParams.edit) {
    const c = coupons.find((x) => x.id === Number(searchParams.edit));
    if (c) {
      drawer = {
        id: c.id,
        code: c.code,
        description: c.description,
        type: c.type === "fixed" ? "fixed" : "percent",
        value: String(c.value),
        min_total: c.min_total ? String(c.min_total) : "",
        max_discount: c.max_discount !== null ? String(c.max_discount) : "",
        starts_at: toIsraelYmd(c.starts_at),
        ends_at: toIsraelYmd(c.ends_at),
        usage_limit: c.usage_limit !== null ? String(c.usage_limit) : "",
        per_customer: c.per_customer !== null ? String(c.per_customer) : "",
        active: c.active,
        used: c.used,
      };
    } else editMissing = true;
  }

  const kpis = [
    { label: "קופונים פעילים", value: String(counts.active || 0), sub: `${counts.scheduled || 0} מתוזמנים · ${coupons.length} בסך הכל` },
    { label: "שימושים", value: totalUses.toLocaleString("he-IL"), sub: `${totalOrders} הזמנות פעילות עם קופון` },
    { label: "הכנסות מהזמנות עם קופון", value: fmtShekel(totalRevenue), sub: "ללא הזמנות שבוטלו או הוחזרו" },
    { label: "סך ההנחות שניתנו", value: fmtShekel(totalDiscount), sub: totalRevenue ? `${Math.round((totalDiscount / (totalRevenue + totalDiscount)) * 100)}% מסכום הסלים` : "עדיין לא נעשה שימוש" },
  ];

  const tabHref = (k: string) => (k === "all" ? "/admin/coupons" : `/admin/coupons?state=${k}`);

  return (
    <>
      <PageHeader crumbs={[{ href: "/admin", label: "ראשי" }, { label: "קופונים" }]} title="קופונים" sub="קודי הנחה שהלקוחות מזינות בקופה באתר. להנחות אוטומטיות בלי קוד (1+1, חבילות, מדרגות) ראו מבצעים.">
        <Link href="/admin/promotions" className="a-btn"><Icon name="percent" /> למבצעים</Link>
        <Link href="/admin/coupons?new=1" className="a-btn a-btn-primary"><Icon name="plus" /> קופון חדש</Link>
      </PageHeader>

      {searchParams.saved && <Notice tone="green">הקופון <b dir="ltr" className="font-mono">{searchParams.saved}</b> נשמר.</Notice>}
      {searchParams.deleted && <Notice tone="green">הקופון <b dir="ltr" className="font-mono">{searchParams.deleted}</b> נמחק.</Notice>}
      {searchParams.error === "used" && <Notice tone="amber">אי אפשר למחוק קופון שכבר נעשה בו שימוש – ההזמנות שלו נשמרות לדוחות. אפשר להשבית אותו במקום.</Notice>}
      {editMissing && <Notice tone="red">הקופון המבוקש לא נמצא. ייתכן שנמחק.</Notice>}

      <section aria-label="מדדי קופונים" className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        {kpis.map((k) => (
          <div key={k.label} className="a-card flex flex-col gap-1.5">
            <span className="text-[14px] text-adm-muted font-medium">{k.label}</span>
            <b className="text-[26px] font-extrabold text-adm-navy tracking-tight">{k.value}</b>
            <span className="text-[12px] text-adm-muted">{k.sub}</span>
          </div>
        ))}
      </section>

      <div className="a-card !p-0 overflow-hidden">
        <div className="px-3 pt-1">
          <LinkTabs tabs={TAB_ORDER.map((k) => ({ href: tabHref(k), label: k === "all" ? "הכל" : STATE_META[k].label, count: counts[k] || 0, active: tab === k }))} />
        </div>

        {shown.length === 0 ? (
          coupons.length === 0 ? (
            <Empty title="עדיין אין קופונים" text={hasDb() ? "צרו קוד הנחה ראשון – למשל 10% לחברות המועדון או ₪50 הנחה בקנייה מעל ₪400." : "כדי ליצור קופונים יש לחבר מסד נתונים."}>
              {hasDb() && <Link href="/admin/coupons?new=1" className="a-btn a-btn-primary"><Icon name="plus" /> קופון חדש</Link>}
            </Empty>
          ) : (
            <Empty title="אין קופונים במצב הזה" text="בחרו לשונית אחרת כדי לראות את שאר הקופונים." />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="a-table min-w-[1080px]">
              <thead>
                <tr>
                  <th>קוד</th>
                  <th>הנחה</th>
                  <th>תנאים</th>
                  <th>תוקף</th>
                  <th>שימושים</th>
                  <th>הכנסות</th>
                  <th>מצב</th>
                  <th><span className="sr-only">פעולות</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map(({ c, st, s }) => {
                  const pctUsed = c.usage_limit ? Math.min(100, Math.round((c.used / c.usage_limit) * 100)) : 0;
                  const conds = [c.min_total ? `מעל ${fmtShekel(c.min_total)}` : "", c.type === "percent" && c.max_discount ? `עד ${fmtShekel(c.max_discount)}` : "", c.per_customer ? `${c.per_customer} ללקוחה` : ""].filter(Boolean);
                  const canDelete = c.used === 0 && s.orders === 0;
                  return (
                    <tr key={c.id}>
                      <td>
                        <div className="flex items-center gap-1.5">
                          <Link href={`/admin/coupons?edit=${c.id}`} dir="ltr" className="font-mono font-bold text-adm-navy hover:underline">{c.code}</Link>
                          <CopyCode code={c.code} />
                        </div>
                        {c.description && <div className="text-[13px] text-adm-muted max-w-[240px] truncate" title={c.description}>{c.description}</div>}
                      </td>
                      <td>
                        <b className="text-[15px]" dir="ltr">{valueLabel(c.type, c.value)}</b>
                        <div className="text-[12px] text-adm-muted">{c.type === "fixed" ? "סכום קבוע" : c.type === "percent" ? "אחוז מהסל" : "משלוח"}</div>
                      </td>
                      <td className="text-[13px]">{conds.length ? conds.join(" · ") : <span className="text-adm-muted">ללא</span>}</td>
                      <td className="text-[13px] whitespace-nowrap">
                        {c.starts_at || c.ends_at ? (
                          <>
                            {c.starts_at && <div>מ־{shortDate(c.starts_at)}</div>}
                            {c.ends_at && <div>עד {shortDate(c.ends_at)}</div>}
                          </>
                        ) : <span className="text-adm-muted">ללא הגבלה</span>}
                      </td>
                      <td className="min-w-[110px]">
                        <span className="text-[14px] font-semibold">{c.used}</span>
                        <span className="text-[13px] text-adm-muted"> / {c.usage_limit ?? "∞"}</span>
                        {c.usage_limit !== null && (
                          <div className="mt-1.5 h-1.5 w-[90px] bg-[#EEF1F6] rounded overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={c.usage_limit} aria-valuenow={c.used} aria-label={`נוצל ${c.used} מתוך ${c.usage_limit}`}>
                            <div className={`h-full rounded ${pctUsed >= 100 ? "bg-[#5B3FC4]" : pctUsed >= 80 ? "bg-[#D08A00]" : "bg-adm-blue"}`} style={{ width: `${pctUsed}%` }} />
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap">
                        <b className="text-[14px]">{fmtShekel(s.revenue)}</b>
                        <div className="text-[12px] text-adm-muted">{s.orders} הזמנות{s.discount ? ` · הנחה ${fmtShekel(s.discount)}` : ""}</div>
                      </td>
                      <td><Chip tone={STATE_META[st].tone}>{STATE_META[st].label}</Chip></td>
                      <td>
                        <div className="flex items-center gap-1.5 justify-end">
                          <form action={toggleCouponAction}>
                            <input type="hidden" name="id" value={c.id} />
                            <button type="submit" role="switch" aria-checked={c.active} aria-label={`${c.active ? "השבתת" : "הפעלת"} הקופון ${c.code}`} title={c.active ? "השבתה" : "הפעלה"} className="h-9 px-1.5 flex items-center rounded-lg hover:bg-adm-bg">
                              <span className={`w-10 h-[22px] rounded-full p-[3px] flex transition-colors ${c.active ? "bg-[#0F7A57] justify-end" : "bg-[#B7C0CF] justify-start"}`} dir="ltr">
                                <span className="w-4 h-4 rounded-full bg-white shadow" />
                              </span>
                            </button>
                          </form>
                          <Link href={`/admin/coupons?edit=${c.id}`} className="a-btn a-btn-sm !h-9 !px-2.5" aria-label={`עריכת הקופון ${c.code}`} title="עריכה"><Icon name="edit" size={15} /></Link>
                          {canDelete ? (
                            <ConfirmButton action={deleteCouponAction} id={c.id} ariaLabel={`מחיקת הקופון ${c.code}`} message={`למחוק את הקופון ${c.code}? לא ניתן לבטל את הפעולה.`} />
                          ) : (
                            <button type="button" disabled className="a-btn a-btn-sm !h-9 !px-2.5" title="נעשה בקופון שימוש – אפשר רק להשבית" aria-label={`לא ניתן למחוק את ${c.code} כי נעשה בו שימוש. אפשר להשבית אותו במתג.`}>
                              <Icon name="trash" size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[13px] text-adm-muted">משלוח כבר חינם בחנות, לכן אין קופוני משלוח. קופון שכבר נעשה בו שימוש לא נמחק כדי לשמור על הדוחות – אפשר להשבית אותו במתג.</p>

      {drawer && <CouponDrawer key={drawer.id ?? "new"} initial={drawer} />}
    </>
  );
}
