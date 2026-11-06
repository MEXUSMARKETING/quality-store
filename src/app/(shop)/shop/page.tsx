import Link from "next/link";
import { listProducts } from "@/lib/store";
import ProductCard from "@/components/ProductCard";
import { CATEGORIES, COLORS, SIZES, STORE, waLink } from "@/lib/config";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "קולקציה" };

type SP = { [k: string]: string | string[] | undefined };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || "";

const HEELS: Record<string, { label: string; test: (p: Product) => boolean }> = {
  low: { label: "נמוך (עד 4 ס״מ)", test: (p) => (p.heel ?? 0) <= 4 },
  mid: { label: "בינוני (5–6 ס״מ)", test: (p) => (p.heel ?? 0) >= 5 && (p.heel ?? 0) <= 6 },
  high: { label: "גבוה (7+ ס״מ)", test: (p) => (p.heel ?? 0) >= 7 },
};

const SORTS: Record<string, string> = {
  "": "מומלצים",
  "price-asc": "מחיר: מהנמוך לגבוה",
  "price-desc": "מחיר: מהגבוה לנמוך",
  discount: "ההנחה הגדולה",
  new: "חדשים ביותר",
};

export default async function ShopPage({ searchParams }: { searchParams: SP }) {
  const category = one(searchParams.category) || "boots";
  const color = one(searchParams.color);
  const heel = one(searchParams.heel);
  const size = one(searchParams.size);
  const sort = one(searchParams.sort);
  const q = one(searchParams.q).trim();
  const max = Number(one(searchParams.max)) || 0;

  const all = await listProducts();
  let list = all.filter((p) => p.category === category);
  if (q) list = all.filter((p) => (p.name + " " + p.description).includes(q));
  if (color) list = list.filter((p) => p.color === color);
  if (heel && HEELS[heel]) list = list.filter(HEELS[heel].test);
  if (size) list = list.filter((p) => Number(p.stock?.[size] || 0) > 0);
  if (max) list = list.filter((p) => p.price <= max);

  const pct = (p: Product) => (p.old_price && p.old_price > p.price ? 1 - p.price / p.old_price : 0);
  if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
  else if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
  else if (sort === "discount") list = [...list].sort((a, b) => pct(b) - pct(a));
  else if (sort === "new") list = [...list].sort((a, b) => b.id - a.id);

  const current: Record<string, string> = { category: category === "boots" ? "" : category, color, heel, size, sort, q, max: max ? String(max) : "" };
  const href = (patch: Record<string, string>) => {
    const next = { ...current, ...patch };
    const sp = new URLSearchParams();
    Object.entries(next).forEach(([k, v]) => v && sp.set(k, v));
    const s = sp.toString();
    return "/shop" + (s ? "?" + s : "");
  };

  const title = q ? `תוצאות עבור "${q}"` : category === "boots" ? "מגפונים לנשים" : CATEGORIES[category] || "קולקציה";
  const active = [
    color && { label: COLORS[color]?.label || color, href: href({ color: "" }) },
    heel && { label: "עקב " + (HEELS[heel]?.label || heel), href: href({ heel: "" }) },
    size && { label: "מידה " + size, href: href({ size: "" }) },
    max && { label: `עד ₪${max}`, href: href({ max: "" }) },
    q && { label: `"${q}"`, href: href({ q: "" }) },
  ].filter(Boolean) as { label: string; href: string }[];

  const chip = (on: boolean) =>
    `h-10 px-4 rounded-full border text-[14px] font-medium flex items-center whitespace-nowrap ${on ? "bg-ink text-white border-ink hover:text-white" : "bg-white border-line"}`;

  const Filters = (
    <div className="flex flex-col gap-6">
      <div>
        <b className="block text-[15px] pb-2.5">המידה שלי</b>
        <div className="grid grid-cols-4 gap-1.5">
          {SIZES.map((s) => (
            <Link key={s} href={href({ size: size === s ? "" : s })} className={`h-11 rounded-[10px] border flex items-center justify-center text-[15px] ${size === s ? "bg-ink text-white border-ink hover:text-white" : "bg-white border-line"}`}>
              {s}
            </Link>
          ))}
        </div>
      </div>
      {category === "boots" && (
        <div>
          <b className="block text-[15px] pb-2.5">גובה עקב</b>
          <div className="flex flex-col gap-1">
            {Object.entries(HEELS).map(([k, h]) => (
              <Link key={k} href={href({ heel: heel === k ? "" : k })} className="flex items-center gap-2.5 min-h-[36px] text-[15px]">
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${heel === k ? "border-ink" : "border-[#CFCBC2]"}`}>
                  {heel === k && <span className="w-2.5 h-2.5 rounded-full bg-ink" />}
                </span>
                {h.label}
              </Link>
            ))}
          </div>
        </div>
      )}
      <div>
        <b className="block text-[15px] pb-2.5">צבע</b>
        <div className="flex flex-col gap-1">
          {Object.entries(COLORS).filter(([k]) => k !== "other").map(([k, c]) => (
            <Link key={k} href={href({ color: color === k ? "" : k })} className="flex items-center gap-2.5 min-h-[36px] text-[15px]">
              <span className={`w-6 h-6 rounded-full border ${color === k ? "ring-2 ring-offset-2 ring-ink" : ""}`} style={{ background: c.hex }} />
              {c.label}
            </Link>
          ))}
        </div>
      </div>
      <div>
        <b className="block text-[15px] pb-2.5">מחיר</b>
        <div className="flex flex-wrap gap-2">
          {[150, 200].map((m) => (
            <Link key={m} href={href({ max: max === m ? "" : String(m) })} className={chip(max === m)}>
              עד ₪{m}
            </Link>
          ))}
        </div>
      </div>
      <div className="p-[18px] rounded-2xl bg-ink text-white flex flex-col gap-1.5 text-sm">
        <b className="text-[15px]">לא מצאת מידה?</b>
        <span className="text-soft">כתבי לנו ונבדוק במלאי.</span>
        <a href={waLink("שלום, אני מחפשת מגפון במידה...")} target="_blank" rel="noopener" className="text-gold font-bold mt-1 hover:text-gold">
          וואטסאפ <span dir="ltr">{STORE.phoneDisplay}</span>
        </a>
      </div>
    </div>
  );

  return (
    <div className="container-site pt-5 md:pt-6 pb-16">
      <nav aria-label="פירורי לחם" className="text-[13px] md:text-sm text-muted flex gap-2">
        <Link href="/">בית</Link>
        <span aria-hidden="true">/</span>
        <span>{title}</span>
      </nav>
      <div className="flex items-end justify-between flex-wrap gap-4 pt-3 pb-5 md:pb-6">
        <div>
          <h1 className="font-display font-extrabold text-[30px] md:text-[44px]">{title}</h1>
          <span className="text-sm md:text-[15px] text-muted">{list.length} דגמים</span>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-full">
          {Object.entries(SORTS).map(([k, label]) => (
            <Link key={k} href={href({ sort: k })} className={chip(sort === k)}>
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start">
        <details className="lg:hidden w-full rounded-2xl bg-panel border border-line">
          <summary className="list-none cursor-pointer h-12 px-4 flex items-center justify-between font-bold">
            סינון {active.length ? `(${active.length})` : ""}
            <span aria-hidden="true">▾</span>
          </summary>
          <div className="p-4 pt-1">{Filters}</div>
        </details>
        <aside aria-label="סינון" className="hidden lg:block w-[260px] shrink-0">
          <div className="flex justify-between items-baseline pb-4">
            <b className="text-lg">סינון</b>
            {active.length > 0 && <Link href={href({ color: "", heel: "", size: "", max: "", q: "" })} className="text-sm underline">ניקוי הכל</Link>}
          </div>
          {Filters}
        </aside>

        <div className="flex-1 min-w-0 w-full flex flex-col gap-6">
          {active.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              {active.map((a) => (
                <Link key={a.label} href={a.href} className="h-9 px-3 rounded-full bg-ink text-white text-sm flex items-center gap-1.5 hover:text-white">
                  {a.label} <span aria-hidden="true">✕</span>
                </Link>
              ))}
            </div>
          )}
          {list.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-7 md:gap-x-5 md:gap-y-9">
              {list.map((p) => (
                <ProductCard key={p.id} p={p} />
              ))}
            </div>
          ) : (
            <div className="p-10 md:p-12 rounded-[22px] bg-panel text-center flex flex-col gap-3 items-center">
              <b className="text-lg">{category !== "boots" && !q ? "הקטגוריה תעלה בקרוב" : "אין דגמים בבחירה הזו"}</b>
              <Link href="/shop" className="btn btn-outline">לכל המגפונים</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
