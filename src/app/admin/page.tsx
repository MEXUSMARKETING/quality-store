import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { hasDb, db } from "@/lib/db";
import { listOrders, listProducts, totalStock } from "@/lib/store";
import { listAudit } from "@/lib/admin";
import { CATEGORIES, shekel } from "@/lib/config";
import type { Order } from "@/lib/types";
import { Chip, Icon, OrderStatusChip, PageHeader, fmtDateTime } from "./_components/ui";

export const dynamic = "force-dynamic";

const RANGES: Record<string, { label: string; days: number }> = {
  today: { label: "היום", days: 1 },
  "7d": { label: "7 ימים", days: 7 },
  "30d": { label: "30 יום", days: 30 },
  "90d": { label: "90 יום", days: 90 },
};

const DAY = 24 * 3600 * 1000;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const pct = (now: number, prev: number) => (prev === 0 ? (now > 0 ? null : 0) : Math.round(((now - prev) / prev) * 1000) / 10);

function Delta({ v, invert = false }: { v: number | null; invert?: boolean }) {
  if (v === null) return <Chip tone="blue">חדש</Chip>;
  const good = invert ? v <= 0 : v >= 0;
  return (
    <Chip tone={v === 0 ? "gray" : good ? "green" : "red"}>
      <span dir="ltr">{v > 0 ? "+" : ""}{v}%</span>
    </Chip>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: { range?: string } }) {
  if (!isAdmin()) return null;
  const rangeKey = RANGES[searchParams.range || ""] ? searchParams.range! : "30d";
  const days = RANGES[rangeKey].days;

  const [orders, products, activity] = await Promise.all([listOrders(), listProducts({ includeInactive: true }), listAudit({ limit: 6 })]);
  let newCustomers = 0;
  let prevNewCustomers = 0;

  const today = startOfDay(new Date());
  const from = new Date(today.getTime() - (days - 1) * DAY);
  const prevFrom = new Date(from.getTime() - days * DAY);

  if (hasDb()) {
    try {
      const sql = await db();
      const [r] = await sql`
        select count(*) filter (where created_at >= ${from})::int as now,
               count(*) filter (where created_at >= ${prevFrom} and created_at < ${from})::int as prev
        from customers`;
      newCustomers = Number(r.now);
      prevNewCustomers = Number(r.prev);
    } catch {}
  }

  const live = (o: Order) => o.status !== "cancelled" && o.status !== "returned";
  const inRange = orders.filter((o) => new Date(o.created_at) >= from);
  const inPrev = orders.filter((o) => new Date(o.created_at) >= prevFrom && new Date(o.created_at) < from);
  const rev = inRange.filter(live).reduce((a, o) => a + o.total, 0);
  const prevRev = inPrev.filter(live).reduce((a, o) => a + o.total, 0);
  const cnt = inRange.filter(live).length;
  const prevCnt = inPrev.filter(live).length;
  const aov = cnt ? Math.round(rev / cnt) : 0;
  const prevAov = prevCnt ? Math.round(prevRev / prevCnt) : 0;

  // daily revenue buckets for the chart (at least 7 points)
  const buckets = Math.max(days, 7);
  const chartFrom = new Date(today.getTime() - (buckets - 1) * DAY);
  const series = Array.from({ length: buckets }, () => 0);
  const prevSeries = Array.from({ length: buckets }, () => 0);
  for (const o of orders.filter(live)) {
    const t = startOfDay(new Date(o.created_at)).getTime();
    const i = Math.round((t - chartFrom.getTime()) / DAY);
    if (i >= 0 && i < buckets) series[i] += o.total;
    const j = Math.round((t - (chartFrom.getTime() - buckets * DAY)) / DAY);
    if (j >= 0 && j < buckets) prevSeries[j] += o.total;
  }
  const maxY = Math.max(1, ...series, ...prevSeries);
  const W = 640, H = 200;
  const pt = (arr: number[]) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${((i / (arr.length - 1)) * W).toFixed(1)} ${(H - 10 - (v / maxY) * (H - 30)).toFixed(1)}`).join(" ");
  const line = pt(series);
  const area = `${line} L${W} ${H} L0 ${H} Z`;

  // sales by category (units × price at purchase)
  const catOf = new Map(products.map((p) => [p.id, p.category]));
  const byCat: Record<string, number> = {};
  const units: Record<number, number> = {};
  for (const o of inRange.filter(live)) {
    for (const it of o.items) {
      const c = catOf.get(it.productId) || "other";
      byCat[c] = (byCat[c] || 0) + it.price * it.qty;
      units[it.productId] = (units[it.productId] || 0) + it.qty;
    }
  }
  const catTotal = Object.values(byCat).reduce((a, b) => a + b, 0);
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: CATEGORIES[k] || "אחר", value: v, pct: catTotal ? Math.round((v / catTotal) * 100) : 0 }));

  const active = products.filter((p) => p.active);
  const lowSizes = active
    .map((p) => ({ p, sizes: Object.entries(p.stock).filter(([, q]) => Number(q) <= 1).sort((a, b) => Number(a[0]) - Number(b[0])) , total: totalStock(p) }))
    .filter((x) => x.total === 0 || x.total <= (x.p.low_stock ?? 2) || x.sizes.some(([, q]) => Number(q) === 0))
    .sort((a, b) => a.total - b.total)
    .slice(0, 6);

  // rule-based insights (no AI): only facts computed from the data
  const insights: { tone: string; tag: string; text: string; href: string; action: string }[] = [];
  const waiting = orders.filter((o) => o.status === "new" && Date.now() - new Date(o.created_at).getTime() > DAY);
  if (waiting.length) insights.push({ tone: "#9EC2FF", tag: "הזמנות", text: `${waiting.length} הזמנות חדשות מחכות יותר מ־24 שעות לאישור.`, href: "/admin/orders?status=new", action: "לטיפול בהזמנות" });
  const top = Object.entries(units).sort((a, b) => b[1] - a[1])[0];
  if (top) {
    const p = products.find((x) => x.id === Number(top[0]));
    if (p) {
      const out = Object.entries(p.stock).filter(([, q]) => Number(q) === 0).map(([s]) => s);
      insights.push({ tone: "#FFC56B", tag: "הנמכר ביותר", text: `${p.name} – ${top[1]} זוגות נמכרו בתקופה.${out.length ? ` מידות שאזלו: ${out.join(", ")}.` : ` נשארו ${totalStock(p)} זוגות במלאי.`}`, href: `/admin/products/${p.id}`, action: "למוצר" });
    }
  }
  const sold30 = new Set(orders.filter((o) => live(o) && Date.now() - new Date(o.created_at).getTime() < 30 * DAY).flatMap((o) => o.items.map((i) => i.productId)));
  const noSales = active.filter((p) => !sold30.has(p.id) && totalStock(p) > 0);
  if (orders.length && noSales.length) insights.push({ tone: "#6FE0B5", tag: "מוצרים בלי מכירות", text: `${noSales.length} מוצרים לא נמכרו ב־30 הימים האחרונים. אולי כדאי מבצע או קופון.`, href: "/admin/coupons", action: "ליצירת קופון" });

  const kpis = [
    { label: "הכנסות", value: shekel(rev), delta: pct(rev, prevRev), sub: `לעומת ${shekel(prevRev)} בתקופה הקודמת` },
    { label: "הזמנות", value: String(cnt), delta: pct(cnt, prevCnt), sub: `${orders.filter((o) => o.status === "new").length} ממתינות לטיפול` },
    { label: "סל ממוצע", value: shekel(aov), delta: pct(aov, prevAov), sub: cnt ? `${(inRange.filter(live).reduce((a, o) => a + o.items.reduce((s, i) => s + i.qty, 0), 0) / cnt).toFixed(1)} זוגות להזמנה` : "אין הזמנות בתקופה" },
    { label: "לקוחות חדשים", value: String(newCustomers), delta: pct(newCustomers, prevNewCustomers), sub: `${active.length} מוצרים פעילים באתר` },
  ];

  const axis = [0, 0.25, 0.5, 0.75, 1].map((f) => new Date(chartFrom.getTime() + f * (buckets - 1) * DAY).toLocaleDateString("he-IL", { day: "numeric", month: "numeric" }));

  return (
    <>
      <PageHeader title="סקירה כללית" sub={new Date().toLocaleDateString("he-IL", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jerusalem" })}>
        <nav aria-label="טווח תאריכים" className="flex gap-1 bg-white border border-adm-line rounded-[11px] p-1">
          {Object.entries(RANGES).map(([k, r]) => (
            <Link key={k} href={`/admin?range=${k}`} aria-current={k === rangeKey ? "page" : undefined} className={`h-9 px-3 rounded-lg text-[13px] flex items-center ${k === rangeKey ? "bg-adm-navy text-white font-semibold hover:text-white" : "text-adm-mid hover:bg-adm-bg"}`}>
              {r.label}
            </Link>
          ))}
        </nav>
        <Link href="/admin/products/new" className="a-btn a-btn-primary"><Icon name="plus" /> מוצר חדש</Link>
      </PageHeader>

      {insights.length > 0 && (
        <section aria-label="דברים שכדאי לטפל בהם" className="bg-adm-navy text-white rounded-2xl p-5 flex flex-col gap-3.5">
          <h2 className="text-[17px] font-bold">כדאי לטפל היום</h2>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
            {insights.map((x, i) => (
              <div key={i} className="bg-adm-navy2 rounded-xl p-4 flex flex-col gap-2.5">
                <span className="text-[12px] font-bold" style={{ color: x.tone }}>{x.tag}</span>
                <p className="text-[14px] leading-6 text-[#E6ECF5]">{x.text}</p>
                <Link href={x.href} className="self-start a-btn a-btn-sm !bg-transparent !text-white !border-[#3C5175] hover:!bg-white/10">{x.action} ←</Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <section aria-label="מדדים" className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {kpis.map((k) => (
          <div key={k.label} className="a-card flex flex-col gap-2">
            <div className="flex justify-between items-center gap-2">
              <span className="text-[14px] text-adm-muted font-medium">{k.label}</span>
              <Delta v={k.delta} />
            </div>
            <b className="text-[28px] font-extrabold text-adm-navy tracking-tight">{k.value}</b>
            <span className="text-[12px] text-adm-muted">{k.sub}</span>
          </div>
        ))}
      </section>

      <section className="grid gap-3.5 lg:grid-cols-3">
        <div className="a-card lg:col-span-2 flex flex-col gap-3 min-w-0">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-[16px] font-bold">הכנסות לפי יום</h2>
            <div className="flex gap-3.5 text-[12px] text-adm-muted">
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-[3px] bg-adm-blue rounded" />התקופה הנוכחית</span>
              <span className="flex items-center gap-1.5"><span className="w-3.5 border-t-2 border-dashed border-[#9AA6B8]" />התקופה הקודמת</span>
            </div>
          </div>
          <div dir="ltr">
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="220" preserveAspectRatio="none" role="img" aria-label={`הכנסות: ${shekel(rev)} בתקופה, לעומת ${shekel(prevRev)} בתקופה הקודמת`}>
              <path d={`M0 ${H * 0.25}H${W}M0 ${H * 0.5}H${W}M0 ${H * 0.75}H${W}`} stroke="#F0EEF6" />
              <path d={area} fill="#6C1CF5" fillOpacity="0.08" />
              <path d={pt(prevSeries)} stroke="#9AA6B8" strokeWidth="2" strokeDasharray="5 5" fill="none" vectorEffect="non-scaling-stroke" />
              <path d={line} stroke="#6C1CF5" strokeWidth="2.5" fill="none" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              <path d={`M0 ${H}H${W}`} stroke="#E8E5F3" />
            </svg>
          </div>
          <div className="flex justify-between text-[12px] text-adm-muted" dir="ltr">{axis.map((a, i) => <span key={i}>{a}</span>)}</div>
        </div>

        <div className="a-card flex flex-col gap-3.5 min-w-0">
          <h2 className="text-[16px] font-bold">מכירות לפי קטגוריה</h2>
          {cats.length ? cats.map((c) => (
            <div key={c.name} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[14px]"><span>{c.name}</span><b>{c.pct}% · {shekel(c.value)}</b></div>
              <div className="h-2 bg-[#F0EEF6] rounded overflow-hidden"><div className="h-full bg-adm-blue rounded" style={{ width: `${c.pct}%` }} /></div>
            </div>
          )) : <p className="text-[14px] text-adm-muted py-6 text-center">אין מכירות בתקופה</p>}
        </div>
      </section>

      <section className="grid gap-3.5 lg:grid-cols-3">
        <div className="a-card !p-0 lg:col-span-2 min-w-0 overflow-hidden">
          <div className="flex justify-between items-center p-[18px] pb-3">
            <h2 className="text-[16px] font-bold">הזמנות אחרונות</h2>
            <Link href="/admin/orders" className="text-[14px] font-semibold text-adm-link">לכל ההזמנות</Link>
          </div>
          {orders.length ? (
            <div className="overflow-x-auto">
              <table className="a-table min-w-[560px]">
                <thead><tr><th>הזמנה</th><th>לקוחה</th><th>פריטים</th><th>סכום</th><th>סטטוס</th><th>תאריך</th></tr></thead>
                <tbody>
                  {orders.slice(0, 7).map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`/admin/orders/${o.id}`} className="font-semibold text-adm-link" dir="ltr">{o.number}</Link></td>
                      <td>{o.customer_name}</td>
                      <td className="text-adm-muted">{o.items.reduce((a, i) => a + i.qty, 0)} זוגות</td>
                      <td className="font-semibold">{shekel(o.total)}</td>
                      <td><OrderStatusChip status={o.status} /></td>
                      <td className="text-adm-muted whitespace-nowrap">{fmtDateTime(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-[14px] text-adm-muted py-10 text-center">עדיין אין הזמנות</p>}
        </div>

        <div className="a-card flex flex-col gap-3 min-w-0">
          <div className="flex justify-between items-center">
            <h2 className="text-[16px] font-bold">מלאי שדורש תשומת לב</h2>
            <Link href="/admin/products?stock=low" className="text-[14px] font-semibold text-adm-link">הכל</Link>
          </div>
          {lowSizes.length ? lowSizes.map(({ p, sizes, total }) => (
            <Link key={p.id} href={`/admin/products/${p.id}`} className="flex gap-3 items-start pb-3 border-b border-[#F0EEF6] last:border-0">
              {p.images[0] ? <img src={p.images[0]} alt="" className="w-11 h-11 rounded-[10px] object-cover bg-adm-bg shrink-0" /> : <span className="w-11 h-11 rounded-[10px] bg-adm-bg shrink-0" />}
              <span className="flex flex-col gap-1.5 min-w-0">
                <b className="text-[14px]">{p.name}</b>
                <span className="flex gap-1.5 flex-wrap">
                  {total === 0 ? <Chip tone="red">אזל</Chip> : sizes.slice(0, 5).map(([s, q]) => <Chip key={s} tone={Number(q) === 0 ? "red" : "amber"}>מידה {s} · {Number(q) === 0 ? "אזל" : q}</Chip>)}
                  {total > 0 && sizes.length === 0 && <Chip tone="amber">נשארו {total}</Chip>}
                </span>
              </span>
            </Link>
          )) : <p className="text-[14px] text-adm-muted py-6 text-center">המלאי תקין</p>}
        </div>
      </section>

      {activity.length > 0 && (
        <section className="a-card flex flex-col gap-2">
          <div className="flex justify-between items-center pb-1">
            <h2 className="text-[16px] font-bold">פעילות אחרונה</h2>
            <Link href="/admin/activity" className="text-[14px] font-semibold text-adm-link">ליומן המלא</Link>
          </div>
          {activity.map((a) => (
            <div key={a.id} className="flex justify-between gap-3 text-[14px] py-1.5">
              <span>{a.summary}</span>
              <span className="text-adm-muted whitespace-nowrap text-[13px]">{fmtDateTime(a.created_at)}</span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
