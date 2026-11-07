import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, listProducts } from "@/lib/store";
import ProductCard from "@/components/ProductCard";
import BuyBox from "@/components/BuyBox";
import { STORE } from "@/lib/config";
import { getApprovedReviews, getAttributes, getCategories, getRatings, type Review } from "@/lib/catalog";
import { ReportButton, ReviewForm, Stars } from "./ReviewWidgets";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const p = await getProductBySlug(decodeURIComponent(params.slug));
  return { title: p?.seo_title || p?.name || "מוצר", description: p?.seo_description || p?.description };
}

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const p = await getProductBySlug(decodeURIComponent(params.slug));
  if (!p || !p.active) notFound();
  const [all, attrs, cats, ratings, reviews] = await Promise.all([
    listProducts({ category: p.category }),
    getAttributes(),
    getCategories(),
    getRatings(),
    getApprovedReviews(p.id),
  ]);
  const related = all.filter((x) => x.id !== p.id).slice(0, 4);
  const cat = cats.find((c) => c.key === p.category);
  const color = attrs.colors.find((c) => c.key === p.color && c.key !== "other");
  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: reviews.filter((r: Review) => r.rating === s).length }));
  const fmt = (d: string) => new Date(d).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "long", year: "numeric" });
  const pct = p.old_price && p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : null;

  return (
    <div className="container-site pt-4 md:pt-6 pb-16">
      <nav aria-label="פירורי לחם" className="text-[13px] md:text-sm text-muted flex gap-2 pb-4 md:pb-5">
        <Link href="/">בית</Link><span aria-hidden="true">/</span>
        {cat && cat.key !== "boots" ? <Link href={`/shop?category=${cat.key}`}>{cat.name}</Link> : <Link href="/shop">קולקציה</Link>}<span aria-hidden="true">/</span>
        <span className="truncate">{p.name}</span>
      </nav>

      <div className="flex flex-col lg:flex-row gap-7 lg:gap-12 items-start">
        <div className="w-full lg:flex-1 flex flex-col gap-3">
          <div className="relative overflow-hidden bg-ink aspect-square">
            {p.images[0] && <img src={p.images[0]} alt={p.name} className="w-full h-full object-contain" />}
            {pct && <span className="absolute top-4 right-4 text-sm font-bold px-3.5 py-1.5 rounded-full bg-gold">−{pct}%</span>}
          </div>
          {p.images.length > 1 && (
            <div className="grid grid-cols-4 gap-2.5">
              {p.images.slice(1, 5).map((src) => (
                <img key={src} src={src} alt="" className="aspect-square object-cover bg-ink" />
              ))}
            </div>
          )}
        </div>

        <div className="w-full lg:flex-1 lg:max-w-[520px] flex flex-col gap-5 md:gap-[22px]">
          <div className="flex flex-col gap-2">
            <span dir="ltr" className="self-end text-[12px] tracking-[3px] text-muted font-bold">NEW COLLECTION</span>
            <h1 className="font-display font-extrabold text-[28px] md:text-[42px] leading-[1.1]">{p.name}</h1>
            {reviews.length > 0 && (
              <a href="#reviews" className="flex items-center gap-2 text-[15px] self-start" aria-label={`דירוג ${avg.toFixed(1)} מתוך 5 – ${reviews.length} ביקורות`}>
                <Stars value={avg} /> <b className="tabular-nums">{avg.toFixed(1)}</b> <span className="text-muted underline">({reviews.length} ביקורות)</span>
              </a>
            )}
            <div className="flex items-baseline gap-3 mt-1 flex-wrap">
              <span className="font-display font-bold text-[32px] md:text-[38px]">₪{p.price}</span>
              {p.old_price && p.old_price > p.price && (
                <>
                  <span className="text-lg md:text-xl text-muted line-through">₪{p.old_price}</span>
                  <span className="text-[15px] font-bold text-[#2F5A26]">חוסכת ₪{p.old_price - p.price}</span>
                </>
              )}
            </div>
            <span className="text-[15px] text-[#45443F]">משלוח חינם · אפשר לשלם במזומן בעת המסירה</span>
          </div>

          <div className="flex flex-wrap gap-2">
            {p.heel ? <span className="h-[38px] px-4 rounded-full bg-panel border border-line flex items-center text-[15px]">עקב {p.heel} ס״מ</span> : null}
            {color ? (
              <span className="h-[38px] px-4 rounded-full bg-panel border border-line flex items-center gap-2 text-[15px]">
                <span className="w-4 h-4 rounded-full border border-line" style={{ background: color.hex }} aria-hidden="true" /> {color.label}
              </span>
            ) : null}
          </div>

          <BuyBox
            product={{ id: p.id, slug: p.slug, name: p.name, image: p.images[0] || "", price: p.price, stock: p.stock }}
            sizes={attrs.sizes}
          />

          <div className="px-[18px] rounded-[18px] bg-white flex flex-col text-[15px]">
            <div className="py-3.5 border-b border-[#EEECE6]"><b>משלוח חינם</b> עד הבית</div>
            <div className="py-3.5 border-b border-[#EEECE6]"><b>תשלום בעת המסירה</b> · במזומן לשליח</div>
            <div className="py-3.5"><b>איסוף מהחנות</b> · {STORE.city}, {STORE.address}</div>
          </div>

          <div>
            <details open className="border-b border-line">
              <summary className="list-none cursor-pointer min-h-[54px] flex items-center justify-between font-bold text-base">תיאור המוצר<span aria-hidden="true">−</span></summary>
              <p className="pb-4 text-[15px] leading-7 text-[#45443F] whitespace-pre-line">{p.description}</p>
            </details>
            <details className="border-b border-line">
              <summary className="list-none cursor-pointer min-h-[54px] flex items-center justify-between font-bold text-base">משלוחים והחזרות<span aria-hidden="true">+</span></summary>
              <p className="pb-4 text-[15px] leading-7 text-[#45443F]">משלוח חינם עד הבית ותשלום במזומן לשליח. לפרטים על החלפות והחזרות <Link href="/info/shipping" className="underline">לחצי כאן</Link>.</p>
            </details>
          </div>
        </div>
      </div>

      <section id="reviews" aria-labelledby="reviews-title" className="pt-14 md:pt-16 scroll-mt-24">
        <div className="flex flex-col md:flex-row gap-6 md:gap-12 items-start">
          <div className="w-full md:w-[300px] shrink-0 flex flex-col gap-3">
            <h2 id="reviews-title" className="font-display font-bold text-[24px] md:text-[30px]">ביקורות</h2>
            {reviews.length > 0 ? (
              <>
                <div className="flex items-center gap-3">
                  <span className="font-display font-bold text-[44px] leading-none tabular-nums">{avg.toFixed(1)}</span>
                  <span className="flex flex-col gap-1">
                    <Stars value={avg} size={18} />
                    <span className="text-sm text-muted">{reviews.length} ביקורות</span>
                  </span>
                </div>
                <div className="flex flex-col gap-1.5" aria-label="התפלגות דירוגים">
                  {dist.map(({ s, n }) => (
                    <div key={s} className="flex items-center gap-2 text-[13px]">
                      <span className="w-12 text-muted">{s} כוכבים</span>
                      <span className="flex-1 h-2 rounded-full bg-[#EEECE6] overflow-hidden"><span className="block h-full bg-gold" style={{ width: `${Math.round((n / reviews.length) * 100)}%` }} /></span>
                      <span className="w-6 text-muted tabular-nums text-end">{n}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[15px] text-muted">עדיין אין ביקורות על הדגם הזה. קנית אותו? נשמח לשמוע.</p>
            )}
            <ReviewForm productId={p.id} />
          </div>

          {reviews.length > 0 && (
            <ul className="flex-1 min-w-0 w-full flex flex-col">
              {reviews.map((r) => (
                <li key={r.id} className="py-5 border-b border-line first:pt-0 flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span aria-label={`${r.rating} מתוך 5`}><Stars value={r.rating} /></span>
                    <b className="text-[15px]">{r.name}</b>
                    {r.verified && <span className="text-[12px] font-bold px-2.5 py-1 rounded-full bg-[#E2EADF] text-[#2F5A26]">רכישה מאומתת</span>}
                    <span className="text-[13px] text-muted">{fmt(r.created_at)}</span>
                  </div>
                  {r.title && <b className="text-base">{r.title}</b>}
                  <p className="text-[15px] leading-7 text-[#45443F] whitespace-pre-line">{r.body}</p>
                  {r.reply && (
                    <div className="mt-1 p-4 rounded-[14px] bg-panel border-s-4 border-gold text-[15px] leading-7">
                      <b className="block text-[13px] pb-0.5">תגובת {STORE.name}</b>
                      <span className="whitespace-pre-line text-[#45443F]">{r.reply}</span>
                    </div>
                  )}
                  <div className="flex justify-end"><ReportButton id={r.id} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {related.length > 0 && (
        <section className="pt-14 md:pt-16">
          <h2 className="font-display font-bold text-[24px] md:text-[30px] pb-5">עוד מהקולקציה</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-7 md:gap-x-5">
            {related.map((r) => <ProductCard key={r.id} p={r} rating={ratings[r.id]} />)}
          </div>
        </section>
      )}
    </div>
  );
}
