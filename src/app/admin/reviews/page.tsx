import Link from "next/link";
import { isAdmin, currentAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { db, hasDb } from "@/lib/db";
import { normReview } from "@/lib/catalog";
import { Empty, Icon, LinkTabs, Notice, PageHeader } from "../_components/ui";
import ReviewsList, { type AdminReview } from "./ReviewsList";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => String((Array.isArray(v) ? v[0] : v) ?? "").trim();

const TABS = {
  pending: "ממתינות",
  approved: "מאושרות",
  rejected: "נדחו",
  hidden: "מוסתרות",
  all: "הכל",
} as const;
type Tab = keyof typeof TABS;

export default async function ReviewsAdmin({ searchParams }: { searchParams: SP }) {
  if (!isAdmin()) return null;
  const me = await currentAdmin();
  const canEdit = hasDb() && !!me && can(me.perms, "reviews", "edit");

  const rawTab = one(searchParams.tab);
  const tab: Tab = rawTab in TABS ? (rawTab as Tab) : "pending";
  const star = Math.max(0, Math.min(5, Number(one(searchParams.star)) || 0));
  const q = one(searchParams.q).slice(0, 100);
  const product = Number(one(searchParams.product)) || 0;
  const reported = one(searchParams.reported) === "1";

  let list: AdminReview[] = [];
  let counts: Record<string, number> = { pending: 0, approved: 0, rejected: 0, hidden: 0, all: 0 };
  let dist = [0, 0, 0, 0, 0];
  let avg = 0;
  let approvedTotal = 0;
  let reportedCount = 0;
  let products: { id: number; name: string }[] = [];
  let failed = false;

  if (hasDb()) {
    try {
      const sql = await db();
      const like = q ? `%${q}%` : null;
      const [rows, cnt, d, prods] = await Promise.all([
        sql`
          select r.*, coalesce(p.name, '') as product_name, coalesce(p.slug, '') as product_slug
          from reviews r left join products p on p.id = r.product_id
          where (${tab === "all"} or r.status = ${tab})
            and (${star}::int = 0 or r.rating = ${star}::int)
            and (${product}::int = 0 or r.product_id = ${product}::int)
            and (${!reported} or r.reported)
            and (${like}::text is null or r.name ilike ${like} or r.title ilike ${like} or r.body ilike ${like} or p.name ilike ${like})
          order by r.reported desc, r.created_at desc limit 300`,
        sql`
          select status, count(*)::int as n, count(*) filter (where reported)::int as rep from reviews
          where (${star}::int = 0 or rating = ${star}::int) and (${product}::int = 0 or product_id = ${product}::int)
          group by status`,
        sql`select rating, count(*)::int as n from reviews where status = 'approved' and (${product}::int = 0 or product_id = ${product}::int) group by rating`,
        sql`select distinct p.id, p.name from products p join reviews r on r.product_id = p.id order by p.name`,
      ]);
      list = rows.map((r: any) => ({ ...normReview(r), product_name: r.product_name, product_slug: r.product_slug }));
      counts = { pending: 0, approved: 0, rejected: 0, hidden: 0, all: 0 };
      for (const r of cnt) {
        counts[r.status] = (counts[r.status] || 0) + Number(r.n);
        counts.all += Number(r.n);
        reportedCount += Number(r.rep);
      }
      dist = [1, 2, 3, 4, 5].map((s) => Number(d.find((x: any) => Number(x.rating) === s)?.n || 0));
      approvedTotal = dist.reduce((a, b) => a + b, 0);
      avg = approvedTotal ? dist.reduce((a, n, i) => a + n * (i + 1), 0) / approvedTotal : 0;
      products = prods.map((p: any) => ({ id: Number(p.id), name: String(p.name) }));
    } catch (e) {
      console.error(e);
      failed = true;
    }
  }

  const qs = (patch: Record<string, string>) => {
    const cur: Record<string, string> = { tab: tab === "pending" ? "" : tab, star: star ? String(star) : "", q, product: product ? String(product) : "", reported: reported ? "1" : "" };
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...cur, ...patch })) if (v) sp.set(k, v);
    const s = sp.toString();
    return `/admin/reviews${s ? `?${s}` : ""}`;
  };
  const filtered = !!(star || q || product || reported);

  return (
    <>
      <PageHeader title="ביקורות ודירוגים" sub="ביקורות חדשות מהאתר ממתינות לאישור לפני שהן מתפרסמות. אי אפשר לערוך את מה שהלקוחה כתבה – רק לאשר, לדחות, להסתיר או להגיב." />

      {failed && <Notice tone="red">טעינת הביקורות נכשלה. נסי לרענן את העמוד.</Notice>}

      <div className="grid md:grid-cols-[260px_1fr_220px] gap-4">
        <div className="a-card flex flex-col items-center justify-center gap-1 text-center">
          <span className="text-[13px] text-adm-muted font-semibold">דירוג ממוצע (מאושרות)</span>
          <b className="text-[40px] leading-none text-adm-navy tabular-nums">{approvedTotal ? avg.toFixed(1) : "—"}</b>
          <span className="flex text-[#C98A00]" aria-label={`${avg.toFixed(1)} מתוך 5`}>
            {[1, 2, 3, 4, 5].map((s) => <Icon key={s} name="star" size={18} className={s <= Math.round(avg) ? "fill-current" : "text-[#C5CDD9]"} />)}
          </span>
          <span className="text-[13px] text-adm-muted">{approvedTotal} ביקורות מפורסמות</span>
        </div>
        <div className="a-card flex flex-col gap-1.5 justify-center" aria-label="התפלגות דירוגים">
          {[5, 4, 3, 2, 1].map((s) => {
            const n = dist[s - 1];
            const w = approvedTotal ? Math.round((n / approvedTotal) * 100) : 0;
            return (
              <Link key={s} href={qs({ star: star === s ? "" : String(s), tab: "approved" })} className={`flex items-center gap-2.5 text-[13px] rounded-lg px-1.5 min-h-[28px] hover:bg-adm-bg ${star === s ? "bg-[#EEF4FF]" : ""}`}>
                <span className="w-9 flex items-center gap-0.5 font-semibold tabular-nums">{s}<Icon name="star" size={13} className="text-[#C98A00] fill-current" /></span>
                <span className="flex-1 h-2.5 rounded-full bg-[#EEF1F6] overflow-hidden"><span className="block h-full rounded-full bg-[#C98A00]" style={{ width: `${w}%` }} /></span>
                <span className="w-16 text-adm-muted tabular-nums text-end">{n} · {w}%</span>
              </Link>
            );
          })}
        </div>
        <div className="a-card flex flex-col gap-2 justify-center">
          <Link href={qs({ tab: "", star: "", reported: "" })} className="flex items-center justify-between gap-2 min-h-[36px]">
            <span className="text-[14px] font-semibold">ממתינות לאישור</span>
            <b className={`text-[22px] tabular-nums ${counts.pending ? "text-[#8A5A00]" : "text-adm-navy"}`}>{counts.pending}</b>
          </Link>
          <Link href={qs({ tab: "all", reported: "1" })} className="flex items-center justify-between gap-2 min-h-[36px]">
            <span className="text-[14px] font-semibold">דווחו ע״י גולשות</span>
            <b className={`text-[22px] tabular-nums ${reportedCount ? "text-[#B03A3A]" : "text-adm-navy"}`}>{reportedCount}</b>
          </Link>
        </div>
      </div>

      <LinkTabs tabs={(Object.keys(TABS) as Tab[]).map((k) => ({ href: qs({ tab: k === "pending" ? "" : k }), label: TABS[k], count: counts[k] || 0, active: tab === k }))} />

      <form method="get" action="/admin/reviews" role="search" aria-label="סינון ביקורות" className="a-card !p-3.5 flex flex-wrap items-end gap-3">
        {tab !== "pending" && <input type="hidden" name="tab" value={tab} />}
        <label className="a-field flex-1 min-w-[200px]">
          חיפוש
          <span className="relative">
            <span className="absolute inset-y-0 start-3 flex items-center text-adm-muted pointer-events-none"><Icon name="search" size={16} /></span>
            <input name="q" type="search" defaultValue={q} placeholder="שם, כותרת, תוכן או מוצר" className="a-input !ps-9" />
          </span>
        </label>
        <label className="a-field w-[130px]">
          דירוג
          <select name="star" defaultValue={star ? String(star) : ""} className="a-input">
            <option value="">כל הדירוגים</option>
            {[5, 4, 3, 2, 1].map((s) => <option key={s} value={s}>{s} כוכבים</option>)}
          </select>
        </label>
        <label className="a-field w-[200px]">
          מוצר
          <select name="product" defaultValue={product ? String(product) : ""} className="a-input">
            <option value="">כל המוצרים</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2 min-h-[42px] text-[14px] font-semibold">
          <input type="checkbox" name="reported" value="1" defaultChecked={reported} className="w-5 h-5 accent-[#3478F6]" /> רק מדווחות
        </label>
        <div className="flex gap-2">
          <button className="a-btn a-btn-dark">סינון</button>
          {filtered && <Link href={qs({ star: "", q: "", product: "", reported: "" })} className="a-btn">ניקוי</Link>}
        </div>
      </form>

      {list.length ? (
        <ReviewsList key={list.map((r) => `${r.id}${r.status}${r.reported}${r.reply_at}`).join(",")} reviews={list} canEdit={canEdit} />
      ) : (
        <div className="a-card">
          <Empty
            title={counts.all === 0 && !filtered ? "עדיין אין ביקורות" : "אין ביקורות להצגה"}
            text={counts.all === 0 && !filtered ? "ביקורות שלקוחות כותבות בדף המוצר יופיעו כאן לאישור." : filtered ? "אין ביקורות שמתאימות לסינון." : `אין ביקורות בלשונית "${TABS[tab]}".`}
          />
        </div>
      )}
    </>
  );
}
