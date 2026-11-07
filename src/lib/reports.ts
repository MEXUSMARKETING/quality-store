import { db, hasDb } from "./db";
import { CATEGORIES, SIZES } from "./config";

/* Admin reports (server only). Every number comes from SQL on `orders` (items jsonb:
   productId, size, qty, price) and `products`. Money is integer shekels.
   Revenue excludes cancelled / returned orders everywhere except the cancellations report.
   Dates are bucketed in Israel time. */

export const TZ = "Asia/Jerusalem";
const DAY = 24 * 3600 * 1000;

export type ReportKey =
  | "daily" | "monthly" | "annual"
  | "products" | "categories" | "best" | "least" | "sizes"
  | "customers" | "aov" | "coupons" | "cancellations"
  | "margin" | "stock";

export const REPORT_GROUPS: { label: string; keys: ReportKey[] }[] = [
  { label: "מכירות", keys: ["daily", "monthly", "annual", "aov"] },
  { label: "מוצרים", keys: ["products", "categories", "best", "least", "sizes"] },
  { label: "לקוחות ושיווק", keys: ["customers", "coupons", "cancellations"] },
  { label: "כספים ומלאי", keys: ["margin", "stock"] },
];

export const REPORTS: Record<ReportKey, { label: string; desc: string; defaultPeriod: string; snapshot?: boolean }> = {
  daily: { label: "מכירות יומיות", desc: "הכנסות, הזמנות וזוגות לפי יום", defaultPeriod: "30" },
  monthly: { label: "מכירות חודשיות", desc: "הכנסות והזמנות לפי חודש", defaultPeriod: "365" },
  annual: { label: "מכירות שנתיות", desc: "הכנסות והזמנות לפי שנה", defaultPeriod: "all" },
  aov: { label: "סל ממוצע", desc: "ערך הזמנה ממוצע, חציון ופילוח לפי גובה סל", defaultPeriod: "90" },
  products: { label: "הכנסות לפי מוצר", desc: "כמה כל מוצר הכניס בתקופה", defaultPeriod: "30" },
  categories: { label: "הכנסות לפי קטגוריה", desc: "מגפונים, עקבים, תיקים ואקססוריז", defaultPeriod: "30" },
  best: { label: "המוצרים הנמכרים ביותר", desc: "דירוג לפי זוגות שנמכרו", defaultPeriod: "30" },
  least: { label: "המוצרים הנמכרים פחות", desc: "מוצרים פעילים עם מעט או בלי מכירות", defaultPeriod: "30" },
  sizes: { label: "מידות שנמכרו", desc: "זוגות לפי מידה מול המלאי הנוכחי", defaultPeriod: "90" },
  customers: { label: "לקוחות חדשים מול חוזרים", desc: "מי קנתה לראשונה ומי חזרה לקנות", defaultPeriod: "90" },
  coupons: { label: "ביצועי קופונים", desc: "הזמנות, הכנסות והנחות לפי קוד", defaultPeriod: "90" },
  cancellations: { label: "ביטולים והחזרות", desc: "הזמנות שבוטלו או הוחזרו", defaultPeriod: "90" },
  margin: { label: "רווח גולמי", desc: "הכנסות פחות עלות, למוצרים שהוזנה להם עלות", defaultPeriod: "30" },
  stock: { label: "שווי מלאי", desc: "זוגות במלאי × עלות וגם × מחיר מכירה", defaultPeriod: "30", snapshot: true },
};

export const PERIODS: Record<string, string> = {
  "7": "7 ימים אחרונים",
  "30": "30 יום אחרונים",
  "90": "90 יום אחרונים",
  "365": "365 יום אחרונים",
  month: "החודש",
  lastmonth: "החודש שעבר",
  all: "כל הזמנים",
  custom: "טווח מותאם",
};

export type ValType = "money" | "int" | "pct" | "num1" | "text" | "date";
export type Kpi = { label: string; value: number; prev: number | null; type: ValType; sub?: string; invert?: boolean };
export type LineSeries = { name: string; values: number[]; color: string; dashed?: boolean };
export type Chart =
  | { kind: "line"; title: string; labels: string[]; series: LineSeries[]; type: ValType }
  | { kind: "bars"; title: string; items: { label: string; value: number; prev?: number | null }[]; type: ValType };
export type Column = { key: string; label: string; type: ValType; hrefKey?: string };
export type Row = Record<string, string | number | null>;

export type Report = {
  key: ReportKey;
  title: string;
  rangeLabel: string;
  prevLabel: string | null;
  compare: boolean;
  kpis: Kpi[];
  chart: Chart | null;
  columns: Column[];
  rows: Row[];
  totals: Row | null;
  notes: string[];
  empty: boolean;
};

/* ---------------- dates (Israel time) ---------------- */

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
export const ymdIL = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ });

function addDays(ymd: string, n: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
function addMonths(ymd: string, n: number) {
  const [y, m] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string) {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / DAY);
}

/** UTC instant of 00:00 Israel time on a YYYY-MM-DD date */
export function dayStartIL(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(guess))
      .map((x) => [x.type, x.value])
  ) as Record<string, string>;
  const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
  return new Date(guess - (local - guess));
}

const fmtYmd = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return `${d}.${m}.${y}`;
};

/** A half-open range of whole Israel days: [fromYmd, toYmd) */
export type Range = { fromYmd: string; toYmd: string; from: Date; to: Date; days: number; label: string };

function mkRange(fromYmd: string, toYmd: string): Range {
  const days = Math.max(1, daysBetween(fromYmd, toYmd));
  return { fromYmd, toYmd, from: dayStartIL(fromYmd), to: dayStartIL(toYmd), days, label: `${fmtYmd(fromYmd)} – ${fmtYmd(addDays(toYmd, -1))}` };
}

export type ReportSearch = { r?: string; p?: string; from?: string; to?: string; cmp?: string };

export type Period = { key: ReportKey; p: string; range: Range; prev: Range | null; compare: boolean; error: string | null; fromInput: string; toInput: string };

export async function resolvePeriod(sp: ReportSearch): Promise<Period> {
  const key = (REPORTS[sp.r as ReportKey] ? sp.r : "daily") as ReportKey;
  let p = PERIODS[sp.p || ""] ? sp.p! : REPORTS[key].defaultPeriod;
  if ((sp.from || sp.to) && !sp.p) p = "custom";
  const today = ymdIL(new Date());
  const tomorrow = addDays(today, 1);
  let error: string | null = null;
  let range: Range;
  let prev: Range | null = null;

  if (p === "custom") {
    const f = YMD.test(sp.from || "") ? sp.from! : "";
    const t = YMD.test(sp.to || "") ? sp.to! : "";
    if (!f || !t) error = "יש לבחור תאריך התחלה ותאריך סיום";
    else if (t < f) error = "תאריך הסיום חייב להיות אחרי תאריך ההתחלה";
    else if (daysBetween(f, t) > 3 * 366) error = "אפשר לבחור טווח של עד 3 שנים";
    if (error) {
      p = "30";
    } else {
      range = mkRange(f, addDays(t, 1));
      prev = mkRange(addDays(f, -range.days), f);
    }
  }
  if (p === "month") {
    const first = today.slice(0, 8) + "01";
    range = mkRange(first, tomorrow);
    const pf = addMonths(first, -1);
    const pt = addDays(pf, range.days) < first ? addDays(pf, range.days) : first;
    prev = mkRange(pf, pt);
  } else if (p === "lastmonth") {
    const first = today.slice(0, 8) + "01";
    range = mkRange(addMonths(first, -1), first);
    prev = mkRange(addMonths(first, -2), addMonths(first, -1));
  } else if (p === "all") {
    let start = addDays(today, -364);
    if (hasDb()) {
      try {
        const sql = await db();
        const [r] = await sql`select min(created_at) as m from orders`;
        if (r?.m) start = ymdIL(new Date(r.m));
      } catch (e) {
        console.error("reports: min date failed", e);
      }
    }
    range = mkRange(start, tomorrow);
    prev = null;
  } else if (p !== "custom") {
    const n = Number(p) || 30;
    range = mkRange(addDays(today, -(n - 1)), tomorrow);
    prev = mkRange(addDays(today, -(2 * n - 1)), addDays(today, -(n - 1)));
  }
  const compare = sp.cmp === "1" && !!prev && !REPORTS[key].snapshot;
  return { key, p, range: range!, prev: compare ? prev : null, compare, error, fromInput: sp.from || range!.fromYmd, toInput: sp.to || addDays(range!.toYmd, -1) };
}

/* ---------------- buckets ---------------- */

type Unit = "day" | "month" | "year";

function bucketKeys(r: Range, unit: Unit): string[] {
  const out: string[] = [];
  if (unit === "day") {
    for (let d = r.fromYmd; d < r.toYmd && out.length < 1200; d = addDays(d, 1)) out.push(d);
  } else if (unit === "month") {
    for (let d = r.fromYmd.slice(0, 8) + "01"; d < r.toYmd && out.length < 400; d = addMonths(d, 1)) out.push(d);
  } else {
    for (let y = Number(r.fromYmd.slice(0, 4)); y <= Number(addDays(r.toYmd, -1).slice(0, 4)); y++) out.push(`${y}-01-01`);
  }
  return out;
}

function bucketLabel(k: string, unit: Unit) {
  const [y, m, d] = k.split("-").map(Number);
  if (unit === "day") return `${d}.${m}`;
  if (unit === "month") return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("he-IL", { month: "short", year: "2-digit", timeZone: "UTC" });
  return String(y);
}
function bucketLongLabel(k: string, unit: Unit) {
  const [y, m] = k.split("-").map(Number);
  if (unit === "day") return fmtYmd(k);
  if (unit === "month") return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("he-IL", { month: "long", year: "numeric", timeZone: "UTC" });
  return String(y);
}

const autoUnit = (r: Range): Unit => (r.days <= 62 ? "day" : r.days <= 800 ? "month" : "year");

/* ---------------- SQL helpers ---------------- */

const n = (v: unknown) => Number(v) || 0;
const pctOf = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const catLabel = (k: string | null | undefined) => (k ? CATEGORIES[k] || k : "מוצר שנמחק");

type Sql = Awaited<ReturnType<typeof db>>;

/** SQL fragments reused by the item-level reports (alias `o` = orders, `it` = one item). */
function frags(sql: Sql) {
  const ITEMS = sql`(case when jsonb_typeof(o.items) = 'array' then o.items else '[]'::jsonb end)`;
  const QTY = sql`(case when (it->>'qty') ~ '^[0-9.]+$' then (it->>'qty')::numeric else 0 end)`;
  const PRICE = sql`(case when (it->>'price') ~ '^[0-9.]+$' then (it->>'price')::numeric else 0 end)`;
  const PID = sql`(case when (it->>'productId') ~ '^[0-9]+$' then (it->>'productId')::int else null end)`;
  const LIVE = sql`o.status not in ('cancelled', 'returned')`;
  return { ITEMS, QTY, PRICE, PID, LIVE };
}

/** Item rows of live orders in a range, aggregated per product. */
async function productAgg(sql: Sql, r: Range) {
  const { ITEMS, QTY, PRICE, PID, LIVE } = frags(sql);
  const rows = await sql`
    with li as (
      select o.id as order_id, ${PID} as pid, ${QTY} as qty, ${PRICE} as price, it->>'name' as name, it->>'size' as size
      from orders o cross join lateral jsonb_array_elements(${ITEMS}) as it
      where o.created_at >= ${r.from} and o.created_at < ${r.to} and ${LIVE}
    )
    select li.pid, coalesce(p.name, max(li.name), 'מוצר') as name, p.category, p.cost, p.active,
           sum(li.qty)::int as units, round(sum(li.qty * li.price))::int as revenue, count(distinct li.order_id)::int as orders
    from li left join products p on p.id = li.pid
    group by li.pid, p.name, p.category, p.cost, p.active`;
  return (rows as any[]).map((x) => ({
    pid: x.pid === null ? null : Number(x.pid),
    name: String(x.name),
    category: x.category as string | null,
    cost: x.cost === null || x.cost === undefined ? null : Number(x.cost),
    exists: x.active !== null && x.active !== undefined,
    units: n(x.units),
    revenue: n(x.revenue),
    orders: n(x.orders),
  }));
}

type Summary = { orders: number; revenue: number; discount: number; units: number; customers: number };

async function summary(sql: Sql, r: Range): Promise<Summary> {
  const { ITEMS, QTY, LIVE } = frags(sql);
  const [x] = await sql`
    select count(*)::int as orders, coalesce(sum(o.total), 0)::int as revenue, coalesce(sum(o.discount), 0)::int as discount,
           count(distinct regexp_replace(o.phone, '[^0-9]', '', 'g'))::int as customers,
           coalesce(sum((select sum(${QTY}) from jsonb_array_elements(${ITEMS}) as it)), 0)::int as units
    from orders o
    where o.created_at >= ${r.from} and o.created_at < ${r.to} and ${LIVE}`;
  return { orders: n(x.orders), revenue: n(x.revenue), discount: n(x.discount), units: n(x.units), customers: n(x.customers) };
}

async function salesSeries(sql: Sql, r: Range, unit: Unit) {
  const { ITEMS, QTY, LIVE } = frags(sql);
  const rows = await sql`
    select to_char(date_trunc(${unit}::text, o.created_at at time zone 'Asia/Jerusalem'), 'YYYY-MM-DD') as k,
           count(*)::int as orders, coalesce(sum(o.total), 0)::int as revenue, coalesce(sum(o.discount), 0)::int as discount,
           coalesce(sum((select sum(${QTY}) from jsonb_array_elements(${ITEMS}) as it)), 0)::int as units
    from orders o
    where o.created_at >= ${r.from} and o.created_at < ${r.to} and ${LIVE}
    group by 1`;
  const map = new Map<string, { orders: number; revenue: number; discount: number; units: number }>();
  for (const x of rows as any[]) map.set(String(x.k), { orders: n(x.orders), revenue: n(x.revenue), discount: n(x.discount), units: n(x.units) });
  return bucketKeys(r, unit).map((k) => ({ k, ...(map.get(k) || { orders: 0, revenue: 0, discount: 0, units: 0 }) }));
}

/** Align a previous-period series to the current one by index. */
const alignPrev = (prev: number[] | null, len: number) => (prev ? Array.from({ length: len }, (_, i) => prev[i] ?? 0) : null);

function lineChart(title: string, labels: string[], cur: number[], prev: number[] | null, type: ValType, name = "התקופה הנוכחית"): Chart {
  const series: LineSeries[] = [{ name, values: cur, color: "#3478F6" }];
  if (prev) series.push({ name: "התקופה הקודמת", values: prev, color: "#9AA6B8", dashed: true });
  return { kind: "line", title, labels, series, type };
}

/* ---------------- report builders ---------------- */

async function salesReport(sql: Sql, per: Period, unit: Unit): Promise<Partial<Report>> {
  const { range, prev } = per;
  const [cur, prv, sum, psum] = await Promise.all([
    salesSeries(sql, range, unit),
    prev ? salesSeries(sql, prev, unit) : Promise.resolve(null),
    summary(sql, range),
    prev ? summary(sql, prev) : Promise.resolve(null),
  ]);
  const aov = sum.orders ? Math.round(sum.revenue / sum.orders) : 0;
  const paov = psum ? (psum.orders ? Math.round(psum.revenue / psum.orders) : 0) : null;
  const buckets = cur.length;
  const kpis: Kpi[] = [
    { label: "הכנסות", value: sum.revenue, prev: psum?.revenue ?? null, type: "money", sub: sum.discount ? `אחרי ${fmtMoney(sum.discount)} הנחות קופון` : "ללא הזמנות שבוטלו או הוחזרו" },
    { label: "הזמנות", value: sum.orders, prev: psum?.orders ?? null, type: "int", sub: `${sum.customers} לקוחות שונות` },
    { label: "זוגות שנמכרו", value: sum.units, prev: psum?.units ?? null, type: "int", sub: sum.orders ? `${(sum.units / sum.orders).toFixed(1)} להזמנה` : "—" },
    { label: "סל ממוצע", value: aov, prev: paov, type: "money" },
    { label: unit === "day" ? "ממוצע ליום" : unit === "month" ? "ממוצע לחודש" : "ממוצע לשנה", value: buckets ? Math.round(sum.revenue / buckets) : 0, prev: psum && prv?.length ? Math.round(psum.revenue / prv.length) : null, type: "money" },
  ];
  const rows: Row[] = cur
    .map((b) => ({ period: bucketLongLabel(b.k, unit), orders: b.orders, units: b.units, discount: b.discount, revenue: b.revenue, aov: b.orders ? Math.round(b.revenue / b.orders) : 0 }))
    .reverse();
  const unitName = unit === "day" ? "יום" : unit === "month" ? "חודש" : "שנה";
  return {
    kpis,
    chart: lineChart(`הכנסות לפי ${unitName}`, cur.map((b) => bucketLabel(b.k, unit)), cur.map((b) => b.revenue), alignPrev(prv?.map((b) => b.revenue) || null, buckets), "money"),
    columns: [
      { key: "period", label: unitName, type: "text" },
      { key: "orders", label: "הזמנות", type: "int" },
      { key: "units", label: "זוגות", type: "int" },
      { key: "discount", label: "הנחות", type: "money" },
      { key: "revenue", label: "הכנסות", type: "money" },
      { key: "aov", label: "סל ממוצע", type: "money" },
    ],
    rows,
    totals: { period: "סה״כ", orders: sum.orders, units: sum.units, discount: sum.discount, revenue: sum.revenue, aov },
    empty: sum.orders === 0,
  };
}

async function productsReport(sql: Sql, per: Period, mode: "revenue" | "best" | "least"): Promise<Partial<Report>> {
  const { range, prev } = per;
  const [cur, prv] = await Promise.all([productAgg(sql, range), prev ? productAgg(sql, prev) : Promise.resolve(null)]);
  const prevBy = new Map((prv || []).map((x) => [x.pid, x]));
  const totalRev = cur.reduce((a, x) => a + x.revenue, 0);
  const totalUnits = cur.reduce((a, x) => a + x.units, 0);
  const prevRev = prv ? prv.reduce((a, x) => a + x.revenue, 0) : null;
  const prevUnits = prv ? prv.reduce((a, x) => a + x.units, 0) : null;

  if (mode === "least") {
    // every active product, including the ones that sold nothing
    const prods = await sql`
      select id, name, category, created_at,
             (select coalesce(sum(case when v ~ '^[0-9]+$' then v::int else 0 end), 0)
              from jsonb_each_text(case when jsonb_typeof(stock) = 'object' then stock else '{}'::jsonb end) as s(k, v))::int as stock
      from products where active = true`;
    const sold = new Map(cur.map((x) => [x.pid, x]));
    const list = (prods as any[]).map((p) => {
      const s = sold.get(Number(p.id));
      return { id: Number(p.id), name: String(p.name), category: p.category as string, stock: n(p.stock), units: s?.units || 0, revenue: s?.revenue || 0, prevUnits: prev ? prevBy.get(Number(p.id))?.units || 0 : null, created: ymdIL(new Date(p.created_at)) };
    });
    list.sort((a, b) => a.units - b.units || a.revenue - b.revenue || b.stock - a.stock);
    const zero = list.filter((x) => x.units === 0);
    const zeroStock = zero.reduce((a, x) => a + x.stock, 0);
    const columns: Column[] = [
      { key: "name", label: "מוצר", type: "text", hrefKey: "href" },
      { key: "category", label: "קטגוריה", type: "text" },
      { key: "units", label: "זוגות שנמכרו", type: "int" },
      ...(prev ? [{ key: "prevUnits", label: "בתקופה הקודמת", type: "int" as ValType }] : []),
      { key: "revenue", label: "הכנסות", type: "money" },
      { key: "stock", label: "במלאי עכשיו", type: "int" },
      { key: "created", label: "נוסף בתאריך", type: "date" },
    ];
    return {
      kpis: [
        { label: "מוצרים פעילים", value: list.length, prev: null, type: "int" },
        { label: "בלי אף מכירה בתקופה", value: zero.length, prev: null, type: "int", invert: true, sub: list.length ? `${pctOf(zero.length, list.length)}% מהמוצרים הפעילים` : undefined },
        { label: "זוגות במלאי שלא זזו", value: zeroStock, prev: null, type: "int", sub: "במוצרים בלי מכירות" },
      ],
      chart: { kind: "bars", title: "הכי פחות נמכרים (זוגות)", items: list.slice(0, 12).map((x) => ({ label: x.name, value: x.units, prev: x.prevUnits })), type: "int" },
      columns,
      rows: list.map((x) => ({ name: x.name, href: `/admin/products/${x.id}`, category: catLabel(x.category), units: x.units, prevUnits: x.prevUnits, revenue: x.revenue, stock: x.stock, created: x.created })),
      totals: { name: "סה״כ", units: list.reduce((a, x) => a + x.units, 0), revenue: list.reduce((a, x) => a + x.revenue, 0), stock: list.reduce((a, x) => a + x.stock, 0), prevUnits: prev ? list.reduce((a, x) => a + (x.prevUnits || 0), 0) : null },
      notes: ["כולל רק מוצרים שמוצגים כרגע באתר. מוצרים עם מלאי ובלי מכירות הם מועמדים טובים למבצע או קופון."],
      empty: list.length === 0,
    };
  }

  const list = [...cur].sort(mode === "best" ? (a, b) => b.units - a.units || b.revenue - a.revenue : (a, b) => b.revenue - a.revenue || b.units - a.units);
  const metric = mode === "best" ? "units" : "revenue";
  const columns: Column[] = [
    { key: "rank", label: "#", type: "int" },
    { key: "name", label: "מוצר", type: "text", hrefKey: "href" },
    { key: "category", label: "קטגוריה", type: "text" },
    { key: "units", label: "זוגות", type: "int" },
    { key: "orders", label: "הזמנות", type: "int" },
    { key: "revenue", label: "הכנסות", type: "money" },
    { key: "share", label: mode === "best" ? "% מהזוגות" : "% מההכנסות", type: "pct" },
    ...(prev ? [{ key: "prev", label: mode === "best" ? "זוגות בתקופה הקודמת" : "הכנסות בתקופה הקודמת", type: (mode === "best" ? "int" : "money") as ValType }] : []),
  ];
  return {
    kpis: [
      { label: "הכנסות ממוצרים", value: totalRev, prev: prevRev, type: "money", sub: "מחיר פריט × כמות, לפני הנחת קופון" },
      { label: "זוגות שנמכרו", value: totalUnits, prev: prevUnits, type: "int" },
      { label: "מוצרים שנמכרו", value: cur.length, prev: prv ? prv.length : null, type: "int" },
      ...(list[0] ? [{ label: mode === "best" ? "המוביל" : "המכניס ביותר", value: mode === "best" ? list[0].units : list[0].revenue, prev: null, type: (mode === "best" ? "int" : "money") as ValType, sub: list[0].name }] : []),
    ],
    chart: {
      kind: "bars",
      title: mode === "best" ? "זוגות שנמכרו – 12 המובילים" : "הכנסות – 12 המובילים",
      items: list.slice(0, 12).map((x) => ({ label: x.name, value: x[metric], prev: prv ? prevBy.get(x.pid)?.[metric] || 0 : null })),
      type: mode === "best" ? "int" : "money",
    },
    columns,
    rows: list.map((x, i) => ({
      rank: i + 1,
      name: x.name + (x.exists ? "" : " (נמחק)"),
      href: x.exists && x.pid ? `/admin/products/${x.pid}` : null,
      category: catLabel(x.category),
      units: x.units,
      orders: x.orders,
      revenue: x.revenue,
      share: mode === "best" ? pctOf(x.units, totalUnits) : pctOf(x.revenue, totalRev),
      prev: prv ? prevBy.get(x.pid)?.[metric] || 0 : null,
    })),
    totals: { rank: null, name: "סה״כ", units: totalUnits, revenue: totalRev, share: 100, prev: mode === "best" ? prevUnits : prevRev },
    notes: ["ההכנסות כאן הן מחיר הפריט בזמן הקנייה × הכמות, לפני הנחות קופון ברמת ההזמנה."],
    empty: cur.length === 0,
  };
}

async function categoriesReport(sql: Sql, per: Period): Promise<Partial<Report>> {
  const { range, prev } = per;
  const [cur, prv] = await Promise.all([productAgg(sql, range), prev ? productAgg(sql, prev) : Promise.resolve(null)]);
  const group = (list: Awaited<ReturnType<typeof productAgg>>) => {
    const m = new Map<string, { units: number; revenue: number; products: number }>();
    for (const x of list) {
      const k = x.category || "_deleted";
      const g = m.get(k) || { units: 0, revenue: 0, products: 0 };
      g.units += x.units;
      g.revenue += x.revenue;
      g.products += 1;
      m.set(k, g);
    }
    return m;
  };
  const c = group(cur);
  const p = prv ? group(prv) : null;
  const total = cur.reduce((a, x) => a + x.revenue, 0);
  const units = cur.reduce((a, x) => a + x.units, 0);
  const list = Array.from(c.entries()).sort((a, b) => b[1].revenue - a[1].revenue);
  return {
    kpis: [
      { label: "הכנסות ממוצרים", value: total, prev: prv ? prv.reduce((a, x) => a + x.revenue, 0) : null, type: "money", sub: "לפני הנחות קופון" },
      { label: "זוגות / פריטים", value: units, prev: prv ? prv.reduce((a, x) => a + x.units, 0) : null, type: "int" },
      { label: "קטגוריות עם מכירות", value: list.length, prev: p ? p.size : null, type: "int" },
    ],
    chart: { kind: "bars", title: "הכנסות לפי קטגוריה", items: list.map(([k, v]) => ({ label: catLabel(k === "_deleted" ? null : k), value: v.revenue, prev: p ? p.get(k)?.revenue || 0 : null })), type: "money" },
    columns: [
      { key: "name", label: "קטגוריה", type: "text" },
      { key: "products", label: "מוצרים שנמכרו", type: "int" },
      { key: "units", label: "יחידות", type: "int" },
      { key: "revenue", label: "הכנסות", type: "money" },
      { key: "share", label: "% מההכנסות", type: "pct" },
      ...(p ? [{ key: "prev", label: "הכנסות בתקופה הקודמת", type: "money" as ValType }] : []),
    ],
    rows: list.map(([k, v]) => ({ name: catLabel(k === "_deleted" ? null : k), products: v.products, units: v.units, revenue: v.revenue, share: pctOf(v.revenue, total), prev: p ? p.get(k)?.revenue || 0 : null })),
    totals: { name: "סה״כ", products: cur.length, units, revenue: total, share: 100, prev: prv ? prv.reduce((a, x) => a + x.revenue, 0) : null },
    notes: ["הקטגוריה נלקחת מהמוצר כפי שהוא מוגדר היום."],
    empty: cur.length === 0,
  };
}

async function sizesReport(sql: Sql, per: Period): Promise<Partial<Report>> {
  const { range, prev } = per;
  const { ITEMS, QTY, PRICE, LIVE } = frags(sql);
  const q = (r: Range) => sql`
    select coalesce(nullif(it->>'size', ''), 'ללא מידה') as size, sum(${QTY})::int as units, round(sum(${QTY} * ${PRICE}))::int as revenue,
           count(distinct o.id)::int as orders
    from orders o cross join lateral jsonb_array_elements(${ITEMS}) as it
    where o.created_at >= ${r.from} and o.created_at < ${r.to} and ${LIVE}
    group by 1`;
  const [cur, prv, stock] = await Promise.all([
    q(range),
    prev ? q(prev) : Promise.resolve(null),
    sql`select s.k as size, sum(case when s.v ~ '^[0-9]+$' then s.v::int else 0 end)::int as units
        from products p cross join lateral jsonb_each_text(case when jsonb_typeof(p.stock) = 'object' then p.stock else '{}'::jsonb end) as s(k, v)
        where p.active = true group by 1`,
  ]);
  const stockBy = new Map((stock as any[]).map((x) => [String(x.size), n(x.units)]));
  const prevBy = new Map(((prv || []) as any[]).map((x) => [String(x.size), n(x.units)]));
  const all = new Set<string>([...(cur as any[]).map((x) => String(x.size)), ...Array.from(stockBy.keys()).filter((k) => stockBy.get(k)! > 0)]);
  const order = (s: string) => {
    const i = SIZES.indexOf(s);
    return i >= 0 ? i : Number.isFinite(Number(s)) ? Number(s) : 1000;
  };
  const curBy = new Map((cur as any[]).map((x) => [String(x.size), x]));
  const sizes = Array.from(all).sort((a, b) => order(a) - order(b) || a.localeCompare(b));
  const totalUnits = (cur as any[]).reduce((a, x) => a + n(x.units), 0);
  const top = [...(cur as any[])].sort((a, b) => n(b.units) - n(a.units))[0];
  const rows = sizes.map((s) => {
    const x = curBy.get(s);
    const units = n(x?.units);
    const st = stockBy.get(s) || 0;
    return { size: s, units, share: pctOf(units, totalUnits), orders: n(x?.orders), revenue: n(x?.revenue), stock: st, cover: units ? Math.round((st / units) * per.range.days) : null, prev: prev ? prevBy.get(s) || 0 : null };
  });
  return {
    kpis: [
      { label: "זוגות שנמכרו", value: totalUnits, prev: prv ? (prv as any[]).reduce((a, x) => a + n(x.units), 0) : null, type: "int" },
      ...(top ? [{ label: "המידה הנמכרת ביותר", value: n(top.units), prev: null, type: "int" as ValType, sub: `מידה ${top.size} · ${pctOf(n(top.units), totalUnits)}% מהזוגות` }] : []),
      { label: "זוגות במלאי עכשיו", value: Array.from(stockBy.values()).reduce((a, b) => a + b, 0), prev: null, type: "int", sub: "בכל המוצרים הפעילים" },
    ],
    chart: { kind: "bars", title: "זוגות שנמכרו לפי מידה", items: rows.map((r) => ({ label: `מידה ${r.size}`, value: r.units, prev: r.prev })), type: "int" },
    columns: [
      { key: "size", label: "מידה", type: "text" },
      { key: "units", label: "זוגות שנמכרו", type: "int" },
      { key: "share", label: "% מהזוגות", type: "pct" },
      ...(prev ? [{ key: "prev", label: "בתקופה הקודמת", type: "int" as ValType }] : []),
      { key: "orders", label: "הזמנות", type: "int" },
      { key: "revenue", label: "הכנסות", type: "money" },
      { key: "stock", label: "במלאי עכשיו", type: "int" },
      { key: "cover", label: "ימי מלאי בקצב הנוכחי", type: "int" },
    ],
    rows,
    totals: { size: "סה״כ", units: totalUnits, share: 100, orders: null, revenue: (cur as any[]).reduce((a, x) => a + n(x.revenue), 0), stock: Array.from(stockBy.values()).reduce((a, b) => a + b, 0), prev: prv ? (prv as any[]).reduce((a, x) => a + n(x.units), 0) : null },
    notes: ["\"ימי מלאי\" = כמה ימים המלאי הנוכחי במידה יספיק אם המכירות ימשיכו בקצב של התקופה שנבחרה. מספר נמוך = כדאי להזמין עוד מהמידה."],
    empty: totalUnits === 0,
  };
}

async function customersReport(sql: Sql, per: Period): Promise<Partial<Report>> {
  const { range, prev } = per;
  const unit = autoUnit(range);
  const base = (r: Range) => sql`
    with o as (
      select id, created_at, total, regexp_replace(phone, '[^0-9]', '', 'g') as k
      from orders where status not in ('cancelled', 'returned')
    ),
    f as (select k, min(created_at) as first_at from o where k <> '' group by k),
    p as (select o.*, f.first_at from o join f using (k) where o.created_at >= ${r.from} and o.created_at < ${r.to})`;
  const sumQ = (r: Range) => sql`
    ${base(r)}
    select count(distinct k)::int as customers,
           count(distinct k) filter (where first_at >= ${r.from})::int as new_c,
           count(distinct k) filter (where first_at < ${r.from})::int as ret_c,
           coalesce(sum(total) filter (where first_at >= ${r.from}), 0)::int as new_rev,
           coalesce(sum(total) filter (where first_at < ${r.from}), 0)::int as ret_rev,
           count(*)::int as orders,
           count(*) filter (where created_at > first_at)::int as repeat_orders
    from p`;
  const [[s], ps, series] = await Promise.all([
    sumQ(range),
    prev ? sumQ(prev).then((x: any[]) => x[0]) : Promise.resolve(null),
    sql`
      ${base(range)}
      select to_char(date_trunc(${unit}::text, created_at at time zone 'Asia/Jerusalem'), 'YYYY-MM-DD') as b,
             count(distinct k) filter (where created_at = first_at)::int as new_c,
             count(distinct k) filter (where created_at > first_at)::int as ret_c,
             coalesce(sum(total) filter (where created_at = first_at), 0)::int as new_rev,
             coalesce(sum(total) filter (where created_at > first_at), 0)::int as ret_rev
      from p group by 1`,
  ]);
  const by = new Map((series as any[]).map((x) => [String(x.b), x]));
  const keys = bucketKeys(range, unit);
  const totalRev = n(s.new_rev) + n(s.ret_rev);
  return {
    kpis: [
      { label: "לקוחות שקנו", value: n(s.customers), prev: ps ? n(ps.customers) : null, type: "int" },
      { label: "לקוחות חדשות", value: n(s.new_c), prev: ps ? n(ps.new_c) : null, type: "int", sub: "ההזמנה הראשונה שלהן בתקופה" },
      { label: "לקוחות חוזרות", value: n(s.ret_c), prev: ps ? n(ps.ret_c) : null, type: "int", sub: "קנו כבר לפני התקופה" },
      { label: "% הכנסות מחוזרות", value: pctOf(n(s.ret_rev), totalRev), prev: ps ? pctOf(n(ps.ret_rev), n(ps.new_rev) + n(ps.ret_rev)) : null, type: "pct" },
      { label: "הזמנות חוזרות", value: n(s.repeat_orders), prev: ps ? n(ps.repeat_orders) : null, type: "int", sub: "לא ההזמנה הראשונה של הלקוחה" },
    ],
    chart: {
      kind: "line",
      title: "לקוחות חדשות מול חוזרות",
      labels: keys.map((k) => bucketLabel(k, unit)),
      series: [
        { name: "חדשות", values: keys.map((k) => n(by.get(k)?.new_c)), color: "#3478F6" },
        { name: "חוזרות", values: keys.map((k) => n(by.get(k)?.ret_c)), color: "#0F7A57" },
      ],
      type: "int",
    },
    columns: [
      { key: "period", label: unit === "day" ? "יום" : unit === "month" ? "חודש" : "שנה", type: "text" },
      { key: "new_c", label: "לקוחות חדשות", type: "int" },
      { key: "ret_c", label: "לקוחות חוזרות", type: "int" },
      { key: "new_rev", label: "הכנסות מחדשות", type: "money" },
      { key: "ret_rev", label: "הכנסות מחוזרות", type: "money" },
    ],
    rows: keys.map((k) => ({ period: bucketLongLabel(k, unit), new_c: n(by.get(k)?.new_c), ret_c: n(by.get(k)?.ret_c), new_rev: n(by.get(k)?.new_rev), ret_rev: n(by.get(k)?.ret_rev) })).reverse(),
    totals: { period: "סה״כ", new_c: n(s.new_c), ret_c: n(s.ret_c), new_rev: n(s.new_rev), ret_rev: n(s.ret_rev) },
    notes: [
      "לקוחה מזוהה לפי מספר הטלפון. \"חדשה\" = ההזמנה הראשונה שלה (שלא בוטלה) נמצאת בתקופה. \"חוזרת\" = הזמינה כבר לפני כן.",
      "בטבלה לפי תקופות: לקוחה נספרת כחוזרת בכל תקופה שבה ביצעה הזמנה שאינה הראשונה שלה.",
    ],
    empty: n(s.orders) === 0,
  };
}

async function aovReport(sql: Sql, per: Period): Promise<Partial<Report>> {
  const { range, prev } = per;
  const unit = autoUnit(range);
  const st = (r: Range) => sql`
    select count(*)::int as orders, coalesce(sum(total), 0)::int as revenue,
           coalesce(percentile_cont(0.5) within group (order by total), 0)::int as median,
           coalesce(max(total), 0)::int as max_total
    from orders o where o.created_at >= ${r.from} and o.created_at < ${r.to} and o.status not in ('cancelled', 'returned')`;
  const [[s], ps, cur, prv, sum, psum, bands] = await Promise.all([
    st(range),
    prev ? st(prev).then((x: any[]) => x[0]) : Promise.resolve(null),
    salesSeries(sql, range, unit),
    prev ? salesSeries(sql, prev, unit) : Promise.resolve(null),
    summary(sql, range),
    prev ? summary(sql, prev) : Promise.resolve(null),
    sql`
      select case when total < 200 then 0 when total < 300 then 1 when total < 400 then 2 when total < 500 then 3 when total < 700 then 4 else 5 end as band,
             count(*)::int as orders, coalesce(sum(total), 0)::int as revenue
      from orders o where o.created_at >= ${range.from} and o.created_at < ${range.to} and o.status not in ('cancelled', 'returned')
      group by 1`,
  ]);
  const aov = n(s.orders) ? Math.round(n(s.revenue) / n(s.orders)) : 0;
  const paov = ps ? (n(ps.orders) ? Math.round(n(ps.revenue) / n(ps.orders)) : 0) : null;
  const names = ["עד ₪199", "₪200–299", "₪300–399", "₪400–499", "₪500–699", "₪700 ומעלה"];
  const bandBy = new Map((bands as any[]).map((x) => [n(x.band), x]));
  const av = (b: { orders: number; revenue: number }) => (b.orders ? Math.round(b.revenue / b.orders) : 0);
  return {
    kpis: [
      { label: "סל ממוצע", value: aov, prev: paov, type: "money" },
      { label: "סל חציוני", value: n(s.median), prev: ps ? n(ps.median) : null, type: "money", sub: "חצי מההזמנות מעל, חצי מתחת" },
      { label: "זוגות להזמנה", value: sum.orders ? Math.round((sum.units / sum.orders) * 10) / 10 : 0, prev: psum ? (psum.orders ? Math.round((psum.units / psum.orders) * 10) / 10 : 0) : null, type: "num1" },
      { label: "ההזמנה הגדולה", value: n(s.max_total), prev: ps ? n(ps.max_total) : null, type: "money" },
    ],
    chart: lineChart("סל ממוצע לאורך זמן", cur.map((b) => bucketLabel(b.k, unit)), cur.map(av), alignPrev(prv?.map(av) || null, cur.length), "money"),
    columns: [
      { key: "band", label: "גובה הסל", type: "text" },
      { key: "orders", label: "הזמנות", type: "int" },
      { key: "share", label: "% מההזמנות", type: "pct" },
      { key: "revenue", label: "הכנסות", type: "money" },
    ],
    rows: names.map((nm, i) => ({ band: nm, orders: n(bandBy.get(i)?.orders), share: pctOf(n(bandBy.get(i)?.orders), n(s.orders)), revenue: n(bandBy.get(i)?.revenue) })),
    totals: { band: "סה״כ", orders: n(s.orders), share: 100, revenue: n(s.revenue) },
    notes: ["הסל הוא הסכום ששולם בפועל (אחרי הנחת קופון). הזמנות שבוטלו או הוחזרו לא נכללות."],
    empty: n(s.orders) === 0,
  };
}

async function couponsReport(sql: Sql, per: Period): Promise<Partial<Report>> {
  const { range, prev } = per;
  const q = (r: Range) => sql`
    select upper(o.coupon_code) as code, count(*)::int as orders, coalesce(sum(o.total), 0)::int as revenue,
           coalesce(sum(o.discount), 0)::int as discount, coalesce(sum(o.subtotal), 0)::int as subtotal,
           max(c.type) as type, max(c.value) as value, bool_or(c.id is not null) as has_coupon
    from orders o left join coupons c on upper(c.code) = upper(o.coupon_code)
    where o.coupon_code <> '' and o.created_at >= ${r.from} and o.created_at < ${r.to} and o.status not in ('cancelled', 'returned')
    group by 1`;
  const [cur, prv, sum, psum] = await Promise.all([q(range), prev ? q(prev) : Promise.resolve(null), summary(sql, range), prev ? summary(sql, prev) : Promise.resolve(null)]);
  const list = (cur as any[]).map((x) => ({ code: String(x.code), orders: n(x.orders), revenue: n(x.revenue), discount: n(x.discount), subtotal: n(x.subtotal), type: x.type, value: x.value === null ? null : n(x.value), exists: !!x.has_coupon })).sort((a, b) => b.revenue - a.revenue);
  const prevBy = new Map(((prv || []) as any[]).map((x) => [String(x.code), n(x.revenue)]));
  const tot = list.reduce((a, x) => ({ orders: a.orders + x.orders, revenue: a.revenue + x.revenue, discount: a.discount + x.discount, subtotal: a.subtotal + x.subtotal }), { orders: 0, revenue: 0, discount: 0, subtotal: 0 });
  const ptot = prv ? (prv as any[]).reduce((a, x) => ({ orders: a.orders + n(x.orders), revenue: a.revenue + n(x.revenue), discount: a.discount + n(x.discount) }), { orders: 0, revenue: 0, discount: 0 }) : null;
  return {
    kpis: [
      { label: "הזמנות עם קופון", value: tot.orders, prev: ptot?.orders ?? null, type: "int", sub: sum.orders ? `${pctOf(tot.orders, sum.orders)}% מכל ההזמנות` : undefined },
      { label: "הכנסות מהזמנות עם קופון", value: tot.revenue, prev: ptot?.revenue ?? null, type: "money" },
      { label: "סך ההנחות", value: tot.discount, prev: ptot?.discount ?? null, type: "money", invert: true, sub: tot.subtotal ? `${pctOf(tot.discount, tot.subtotal)}% מסכום הסלים` : undefined },
      { label: "% הזמנות עם קופון", value: pctOf(tot.orders, sum.orders), prev: psum && ptot ? pctOf(ptot.orders, psum.orders) : null, type: "pct" },
    ],
    chart: { kind: "bars", title: "הכנסות לפי קופון", items: list.slice(0, 12).map((x) => ({ label: x.code, value: x.revenue, prev: prv ? prevBy.get(x.code) || 0 : null })), type: "money" },
    columns: [
      { key: "code", label: "קוד", type: "text" },
      { key: "kind", label: "הנחה", type: "text" },
      { key: "orders", label: "הזמנות", type: "int" },
      { key: "revenue", label: "הכנסות", type: "money" },
      { key: "discount", label: "הנחה שניתנה", type: "money" },
      { key: "aov", label: "סל ממוצע", type: "money" },
      { key: "rate", label: "% הנחה מהסל", type: "pct" },
      ...(prev ? [{ key: "prev", label: "הכנסות בתקופה הקודמת", type: "money" as ValType }] : []),
    ],
    rows: list.map((x) => ({
      code: x.code,
      kind: !x.exists ? "קופון שנמחק" : x.type === "fixed" ? `${fmtMoney(x.value || 0)}` : `${x.value}%`,
      orders: x.orders,
      revenue: x.revenue,
      discount: x.discount,
      aov: x.orders ? Math.round(x.revenue / x.orders) : 0,
      rate: pctOf(x.discount, x.subtotal),
      prev: prv ? prevBy.get(x.code) || 0 : null,
    })),
    totals: { code: "סה״כ", kind: null, orders: tot.orders, revenue: tot.revenue, discount: tot.discount, aov: tot.orders ? Math.round(tot.revenue / tot.orders) : 0, rate: pctOf(tot.discount, tot.subtotal), prev: ptot?.revenue ?? null },
    notes: ["רק הזמנות שלא בוטלו או הוחזרו. ההכנסות הן הסכום ששולם בפועל אחרי ההנחה."],
    empty: list.length === 0,
  };
}

async function cancellationsReport(sql: Sql, per: Period): Promise<Partial<Report>> {
  const { range, prev } = per;
  const unit = autoUnit(range);
  const st = (r: Range) => sql`
    select count(*)::int as all_orders,
           count(*) filter (where status = 'cancelled')::int as cancelled,
           count(*) filter (where status = 'returned')::int as returned,
           coalesce(sum(total) filter (where status in ('cancelled', 'returned')), 0)::int as lost
    from orders where created_at >= ${r.from} and created_at < ${r.to}`;
  const ser = (r: Range) => sql`
    select to_char(date_trunc(${unit}::text, created_at at time zone 'Asia/Jerusalem'), 'YYYY-MM-DD') as k, count(*)::int as c
    from orders where created_at >= ${r.from} and created_at < ${r.to} and status in ('cancelled', 'returned') group by 1`;
  const [[s], ps, cur, prv, rows] = await Promise.all([
    st(range),
    prev ? st(prev).then((x: any[]) => x[0]) : Promise.resolve(null),
    ser(range),
    prev ? ser(prev) : Promise.resolve(null),
    sql`select id, number, created_at, customer_name, city, status, total, payment_status, items
        from orders where created_at >= ${range.from} and created_at < ${range.to} and status in ('cancelled', 'returned')
        order by created_at desc limit 1000`,
  ]);
  const by = new Map((cur as any[]).map((x) => [String(x.k), n(x.c)]));
  const keys = bucketKeys(range, unit);
  const pkeys = prev ? bucketKeys(prev, unit) : [];
  const pby = new Map(((prv || []) as any[]).map((x) => [String(x.k), n(x.c)]));
  const closed = n(s.cancelled) + n(s.returned);
  const pclosed = ps ? n(ps.cancelled) + n(ps.returned) : null;
  const units = (items: any) => (Array.isArray(items) ? items : typeof items === "string" ? JSON.parse(items) : []).reduce((a: number, i: any) => a + (Number(i.qty) || 0), 0);
  return {
    kpis: [
      { label: "בוטלו", value: n(s.cancelled), prev: ps ? n(ps.cancelled) : null, type: "int", invert: true },
      { label: "הוחזרו", value: n(s.returned), prev: ps ? n(ps.returned) : null, type: "int", invert: true },
      { label: "שווי שאבד", value: n(s.lost), prev: ps ? n(ps.lost) : null, type: "money", invert: true },
      { label: "שיעור ביטול והחזרה", value: pctOf(closed, n(s.all_orders)), prev: ps ? pctOf(pclosed!, n(ps.all_orders)) : null, type: "pct", invert: true, sub: `מתוך ${n(s.all_orders)} הזמנות בתקופה` },
    ],
    chart: lineChart("ביטולים והחזרות", keys.map((k) => bucketLabel(k, unit)), keys.map((k) => by.get(k) || 0), prev ? alignPrev(pkeys.map((k) => pby.get(k) || 0), keys.length) : null, "int"),
    columns: [
      { key: "number", label: "הזמנה", type: "text", hrefKey: "href" },
      { key: "date", label: "תאריך", type: "date" },
      { key: "customer", label: "לקוחה", type: "text" },
      { key: "city", label: "עיר", type: "text" },
      { key: "status", label: "סטטוס", type: "text" },
      { key: "units", label: "זוגות", type: "int" },
      { key: "total", label: "סכום", type: "money" },
    ],
    rows: (rows as any[]).map((o) => ({ number: o.number || `#${o.id}`, href: `/admin/orders/${o.id}`, date: ymdIL(new Date(o.created_at)), customer: o.customer_name, city: o.city, status: o.status === "returned" ? "הוחזרה" : "בוטלה", units: units(o.items), total: n(o.total) })),
    totals: { number: "סה״כ", units: (rows as any[]).reduce((a, o) => a + units(o.items), 0), total: n(s.lost) },
    notes: ["התאריך הוא תאריך יצירת ההזמנה (לא תאריך הביטול)."],
    empty: closed === 0,
  };
}

async function marginReport(sql: Sql, per: Period): Promise<Partial<Report>> {
  const { range, prev } = per;
  const [cur, prv, [cat]] = await Promise.all([
    productAgg(sql, range),
    prev ? productAgg(sql, prev) : Promise.resolve(null),
    sql`select count(*)::int as all_p, count(*) filter (where cost is null)::int as no_cost from products where active = true`,
  ]);
  const calc = (list: Awaited<ReturnType<typeof productAgg>>) => {
    const withCost = list.filter((x) => x.cost !== null);
    const without = list.filter((x) => x.cost === null);
    const revenue = withCost.reduce((a, x) => a + x.revenue, 0);
    const cost = withCost.reduce((a, x) => a + x.units * (x.cost || 0), 0);
    return { withCost, without, revenue, cost, profit: revenue - cost, missingRevenue: without.reduce((a, x) => a + x.revenue, 0) };
  };
  const c = calc(cur);
  const p = prv ? calc(prv) : null;
  const prevBy = new Map((p?.withCost || []).map((x) => [x.pid, x.revenue - x.units * (x.cost || 0)]));
  const rows = c.withCost
    .map((x) => {
      const cost = x.units * (x.cost || 0);
      return { name: x.name, href: x.pid ? `/admin/products/${x.pid}` : null, units: x.units, unitCost: x.cost, revenue: x.revenue, cost, profit: x.revenue - cost, margin: pctOf(x.revenue - cost, x.revenue), prev: p ? prevBy.get(x.pid) ?? 0 : null };
    })
    .sort((a, b) => b.profit - a.profit);
  const notes = [
    `${c.without.length} מוצרים שנמכרו בתקופה בלי עלות מוזנת (${fmtMoney(c.missingRevenue)} הכנסות) לא נכללים בחישוב.`,
    `בקטלוג: ${n(cat.no_cost)} מתוך ${n(cat.all_p)} מוצרים פעילים חסרי עלות. אפשר להזין עלות בעמוד המוצר.`,
    "החישוב משתמש בעלות הנוכחית של המוצר ובמחיר הפריט בזמן הקנייה, לפני הנחות קופון ברמת ההזמנה.",
  ];
  return {
    kpis: [
      { label: "רווח גולמי", value: c.profit, prev: p?.profit ?? null, type: "money" },
      { label: "שיעור רווח גולמי", value: pctOf(c.profit, c.revenue), prev: p ? pctOf(p.profit, p.revenue) : null, type: "pct" },
      { label: "הכנסות (מוצרים עם עלות)", value: c.revenue, prev: p?.revenue ?? null, type: "money" },
      { label: "עלות הסחורה שנמכרה", value: c.cost, prev: p?.cost ?? null, type: "money", invert: true },
      { label: "מוצרים בלי עלות", value: c.without.length, prev: null, type: "int", invert: true, sub: `נמכרו בתקופה · ${n(cat.no_cost)} בקטלוג` },
    ],
    chart: { kind: "bars", title: "רווח גולמי לפי מוצר", items: rows.slice(0, 12).map((r) => ({ label: r.name, value: r.profit, prev: r.prev })), type: "money" },
    columns: [
      { key: "name", label: "מוצר", type: "text", hrefKey: "href" },
      { key: "units", label: "זוגות", type: "int" },
      { key: "unitCost", label: "עלות ליחידה", type: "money" },
      { key: "revenue", label: "הכנסות", type: "money" },
      { key: "cost", label: "עלות", type: "money" },
      { key: "profit", label: "רווח גולמי", type: "money" },
      { key: "margin", label: "% רווח", type: "pct" },
      ...(prev ? [{ key: "prev", label: "רווח בתקופה הקודמת", type: "money" as ValType }] : []),
    ],
    rows,
    totals: { name: "סה״כ", units: rows.reduce((a, r) => a + r.units, 0), unitCost: null, revenue: c.revenue, cost: c.cost, profit: c.profit, margin: pctOf(c.profit, c.revenue), prev: p?.profit ?? null },
    notes,
    empty: cur.length === 0,
  };
}

async function stockReport(sql: Sql): Promise<Partial<Report>> {
  const rows = await sql`
    select id, name, category, price, cost, active,
           (select coalesce(sum(case when v ~ '^[0-9]+$' then v::int else 0 end), 0)
            from jsonb_each_text(case when jsonb_typeof(stock) = 'object' then stock else '{}'::jsonb end) as s(k, v))::int as units
    from products`;
  const list = (rows as any[]).map((p) => {
    const units = n(p.units);
    const cost = p.cost === null || p.cost === undefined ? null : n(p.cost);
    return { id: Number(p.id), name: String(p.name), category: p.category as string, active: !!p.active, price: n(p.price), cost, units, retail: units * n(p.price), costValue: cost === null ? null : units * cost };
  });
  list.sort((a, b) => b.retail - a.retail);
  const units = list.reduce((a, x) => a + x.units, 0);
  const retail = list.reduce((a, x) => a + x.retail, 0);
  const withCost = list.filter((x) => x.cost !== null);
  const costValue = withCost.reduce((a, x) => a + (x.costValue || 0), 0);
  const retailWithCost = withCost.reduce((a, x) => a + x.retail, 0);
  const missing = list.filter((x) => x.cost === null && x.units > 0);
  const byCat = new Map<string, number>();
  for (const x of list) byCat.set(x.category, (byCat.get(x.category) || 0) + x.retail);
  return {
    kpis: [
      { label: "זוגות / פריטים במלאי", value: units, prev: null, type: "int", sub: `${list.filter((x) => x.units > 0).length} מוצרים עם מלאי` },
      { label: "שווי לפי מחיר מכירה", value: retail, prev: null, type: "money" },
      { label: "שווי לפי עלות", value: costValue, prev: null, type: "money", sub: `${withCost.length} מוצרים עם עלות מוזנת` },
      { label: "רווח פוטנציאלי", value: retailWithCost - costValue, prev: null, type: "money", sub: "במוצרים שיש להם עלות" },
      { label: "מוצרים במלאי בלי עלות", value: missing.length, prev: null, type: "int", invert: true, sub: missing.length ? `${missing.reduce((a, x) => a + x.units, 0)} יחידות לא נכללות בשווי לפי עלות` : "לכל המוצרים במלאי יש עלות" },
    ],
    chart: { kind: "bars", title: "שווי מלאי לפי קטגוריה (מחיר מכירה)", items: Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: catLabel(k), value: v })), type: "money" },
    columns: [
      { key: "name", label: "מוצר", type: "text", hrefKey: "href" },
      { key: "category", label: "קטגוריה", type: "text" },
      { key: "status", label: "באתר", type: "text" },
      { key: "units", label: "במלאי", type: "int" },
      { key: "price", label: "מחיר", type: "money" },
      { key: "cost", label: "עלות", type: "money" },
      { key: "retail", label: "שווי במחיר מכירה", type: "money" },
      { key: "costValue", label: "שווי בעלות", type: "money" },
    ],
    rows: list.map((x) => ({ name: x.name, href: `/admin/products/${x.id}`, category: catLabel(x.category), status: x.active ? "מוצג" : "מוסתר", units: x.units, price: x.price, cost: x.cost, retail: x.retail, costValue: x.costValue })),
    totals: { name: "סה״כ", units, retail, costValue },
    notes: ["שווי המלאי נכון לרגע זה (לא תלוי בתקופה). מוצרים בלי עלות מופיעים עם \"—\" בעמודת השווי בעלות."],
    empty: list.length === 0,
  };
}

export const fmtMoney = (v: number) => (v < 0 ? "-₪" : "₪") + Math.abs(Math.round(v)).toLocaleString("he-IL");

/** Build one report for the URL search params. Never throws: errors come back as an empty report with a note. */
export async function buildReport(sp: ReportSearch): Promise<{ report: Report; period: Period }> {
  const period = await resolvePeriod(sp);
  const key = period.key;
  const base: Report = {
    key,
    title: REPORTS[key].label,
    rangeLabel: REPORTS[key].snapshot ? "נכון לעכשיו" : period.range.label,
    prevLabel: period.prev ? period.prev.label : null,
    compare: period.compare,
    kpis: [],
    chart: null,
    columns: [],
    rows: [],
    totals: null,
    notes: [],
    empty: true,
  };
  if (!hasDb()) return { report: base, period };
  try {
    const sql = await db();
    let part: Partial<Report>;
    switch (key) {
      case "daily": part = await salesReport(sql, period, "day"); break;
      case "monthly": part = await salesReport(sql, period, "month"); break;
      case "annual": part = await salesReport(sql, period, "year"); break;
      case "products": part = await productsReport(sql, period, "revenue"); break;
      case "best": part = await productsReport(sql, period, "best"); break;
      case "least": part = await productsReport(sql, period, "least"); break;
      case "categories": part = await categoriesReport(sql, period); break;
      case "sizes": part = await sizesReport(sql, period); break;
      case "customers": part = await customersReport(sql, period); break;
      case "aov": part = await aovReport(sql, period); break;
      case "coupons": part = await couponsReport(sql, period); break;
      case "cancellations": part = await cancellationsReport(sql, period); break;
      case "margin": part = await marginReport(sql, period); break;
      case "stock": part = await stockReport(sql); break;
      default: part = {};
    }
    return { report: { ...base, ...part, notes: part.notes || [] }, period };
  } catch (e) {
    console.error("report failed", key, e);
    return { report: { ...base, notes: ["לא הצלחנו לחשב את הדוח כרגע. נסו לרענן את העמוד."] }, period };
  }
}

/** Format a value for display / CSV. */
export function fmtVal(v: string | number | null | undefined, type: ValType): string {
  if (v === null || v === undefined || v === "") return "—";
  if (type === "money") return fmtMoney(Number(v));
  if (type === "int") return Math.round(Number(v)).toLocaleString("he-IL");
  if (type === "num1") return Number(v).toLocaleString("he-IL", { maximumFractionDigits: 1 });
  if (type === "pct") return `${Number(v).toLocaleString("he-IL", { maximumFractionDigits: 1 })}%`;
  if (type === "date" && typeof v === "string" && YMD.test(v)) return fmtYmd(v);
  return String(v);
}

/** Percent change, or null when the previous value is 0 (and the current is not). */
export const deltaPct = (now: number, prev: number) => (prev === 0 ? (now === 0 ? 0 : null) : Math.round(((now - prev) / Math.abs(prev)) * 1000) / 10);
