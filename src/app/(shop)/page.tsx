import Link from "next/link";
import { listProducts, bestSellerIds } from "@/lib/store";
import ProductRow from "@/components/home/ProductRow";
import ClubSignup from "@/components/home/ClubSignup";
import { CardIcon, ChevronLeft, StarIcon, TagIcon, TruckIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

const img = (slug: string) => `/products/${slug}.jpg`;
const stock = (id: string, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const CATS = [
  { label: "מגפונים", sub: "הקולקציה החדשה", href: "/shop", img: stock("photo-1605733160314-4fc7dac4bb16", 900) },
  { label: "נעלי עקב", sub: "לערב ולאירועים", href: "/shop?category=heels", img: stock("photo-1551489186-ccb95a1ea6a3", 900) },
  { label: "תיקים וארנקים", sub: "משלימים את הלוק", href: "/shop?category=bags", img: stock("photo-1624687943971-e86af76d57de", 900) },
  { label: "תכשיטים ואקססוריז", sub: "נגיעה של זהב", href: "/shop?category=jewelry", img: stock("photo-1617038220319-276d3cfab638", 900) },
];

const PROMOS = [
  { title: "מבצע לזמן מוגבל", text: "עד 60% הנחה על מגפונים נבחרים", cta: "לכל המבצעים", href: "/shop?sort=discount", img: stock("photo-1605732440685-d0654d81aa30", 1400) },
  { title: "קולקציית חורף", text: "מגפונים חמים ומעוצבים לימים הקרים", cta: "לקולקציה", href: "/shop?sort=new", img: stock("photo-1571489555750-c932b569ef5d", 1400) },
];

export default async function Home() {
  const all = await listProducts();
  const boots = all.filter((p) => p.category === "boots");
  const minPrice = boots.length ? Math.min(...boots.map((p) => p.price)) : 140;
  const maxPct = boots.reduce((m, p) => (p.old_price && p.old_price > p.price ? Math.max(m, Math.round((1 - p.price / p.old_price) * 100)) : m), 0);

  // What's new: newest first (highest id), featured items lead when ids tie
  const newest = [...all].sort((a, b) => b.id - a.id).slice(0, 10);

  // Best sellers: by units sold; fall back to featured + biggest discount until there are orders
  const soldIds = await bestSellerIds();
  const byId = new Map(all.map((p) => [p.id, p]));
  let best = soldIds.map((id) => byId.get(id)).filter(Boolean) as typeof all;
  if (best.length < 4) {
    const pct = (p: (typeof all)[number]) => (p.old_price && p.old_price > p.price ? 1 - p.price / p.old_price : 0);
    const rest = all
      .filter((p) => !best.includes(p))
      .sort((a, b) => Number(b.featured) - Number(a.featured) || pct(b) - pct(a));
    best = [...best, ...rest];
  }
  best = best.slice(0, 10);

  const perks = [
    { title: "תשלום מאובטח", sub: "אשראי, Bit או מזומן בעת המסירה", Icon: CardIcon },
    { title: "משלוח מהיר", sub: "חינם עד דלת הבית", Icon: TruckIcon },
    { title: "מחירים ללא תחרות", sub: `עד ${maxPct || 60}% הנחה על הקולקציה`, Icon: TagIcon },
    { title: "שירות אישי באיכות גבוהה", sub: "זמינים לך בוואטסאפ", Icon: StarIcon },
  ];

  return (
    <>
      {/* Hero — big, full width */}
      <section aria-label="באנר ראשי" className="relative bg-night text-white overflow-hidden">
        <img
          src={stock("photo-1574413230119-f302e1c9035d", 2000)}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-black/35 to-black/10" aria-hidden="true" />
        <div className="relative container-site min-h-[480px] md:min-h-[620px] lg:min-h-[680px] flex flex-col justify-center gap-5 py-14">
          <span dir="ltr" className="kicker text-gold self-end text-[12px] md:text-[13px] tracking-[5px]">NEW COLLECTION · 2026</span>
          <h1 className="font-display font-extrabold text-[42px] md:text-[68px] lg:text-[80px] leading-[1] tracking-tight max-w-[640px]">
            מגפוני חורף
            <br />
            <span className="text-gold">מ־₪{minPrice}</span> בלבד
          </h1>
          <p className="text-[16px] md:text-[20px] leading-relaxed text-[#E8E4DA] font-light max-w-[460px]">
            עד {maxPct || 60}% הנחה על הקולקציה החדשה. משלוח חינם עד הבית — ומשלמים רק כשהנעל אצלך.
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <Link href="/shop" className="btn btn-gold h-[52px] md:h-14 px-8">
              לכל הקולקציה <ChevronLeft size={18} strokeWidth={2.2} />
            </Link>
            <Link href="/shop?sort=discount" className="btn btn-outline-light h-[52px] md:h-14 font-medium border-white/60">
              למבצעים
            </Link>
          </div>
        </div>
      </section>

      {/* 4 categories — edge to edge, no gaps */}
      <section aria-label="קטגוריות" className="grid grid-cols-2 lg:grid-cols-4">
        {CATS.map((c) => (
          <Link key={c.label} href={c.href} className="group relative block aspect-[3/4] lg:aspect-[4/5] overflow-hidden bg-panel hover:text-white">
            <img src={c.img} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" aria-hidden="true" />
            <div className="absolute bottom-0 inset-x-0 p-4 md:p-7 text-white flex flex-col gap-1">
                            <span className="font-display font-bold text-[20px] md:text-[28px] leading-tight">{c.label}</span>
              <span className="hidden md:inline-flex items-center gap-1.5 text-[14px] font-bold mt-1 underline underline-offset-4">לקטגוריה <ChevronLeft size={14} strokeWidth={2.4} /></span>
            </div>
          </Link>
        ))}
      </section>

      <ProductRow title="מה חדש" products={newest} href="/shop?sort=new" />
      <ProductRow title="הנמכרים ביותר" products={best} href="/shop" />

      {/* Two promo banners — edge to edge, no gaps */}
      <section aria-label="מבצעים" className="mt-10 md:mt-14 grid md:grid-cols-2">
        {PROMOS.map((b) => (
          <Link key={b.title} href={b.href} className="group relative block aspect-[4/3] md:aspect-[16/11] overflow-hidden bg-night hover:text-white">
            <img src={b.img} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden="true" />
            <div className="absolute bottom-0 inset-x-0 p-6 md:p-10 text-white flex flex-col gap-2 md:gap-3">
              <h2 className="font-display font-extrabold text-[30px] md:text-[44px] leading-[1.05]">{b.title}</h2>
              <p className="text-[15px] md:text-[17px] text-[#E8E4DA] font-light">{b.text}</p>
              <span className="btn btn-gold self-start mt-1 h-11 md:h-12">{b.cta} <ChevronLeft size={16} strokeWidth={2.2} /></span>
            </div>
          </Link>
        ))}
      </section>

      {/* Perks — one compact row */}
      <section aria-label="למה לקנות אצלנו" className="container-site py-8 md:py-12">
        <div className="grid grid-cols-4">
          {perks.map(({ title, sub, Icon }, i) => (
            <div key={title} className={`flex flex-col items-center gap-1.5 md:gap-2 text-center px-1.5 md:px-4 ${i < perks.length - 1 ? "border-l border-[#E6E3DC]" : ""}`}>
              <Icon size={28} stroke="#7A5A12" strokeWidth={1.3} />
              <b className="text-[11px] md:text-[15px] leading-tight">{title}</b>
              <span className="hidden md:block text-[13px] text-muted leading-normal">{sub}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Club — joined to the footer */}
      <section aria-label="מועדון לקוחות" className="bg-night text-white">
        <div className="container-site py-14 md:pt-[72px] md:pb-16 flex flex-col lg:flex-row lg:items-center gap-9 lg:gap-[72px]">
          <div className="lg:flex-1 flex flex-col gap-3 lg:max-w-[440px]">
            <span className="kicker text-gold">מועדון הלקוחות של Quality</span>
            <h2 className="font-display font-extrabold text-[36px] md:text-[52px] leading-[1.02]">
              <span className="text-gold">5%</span> הנחה
              <br />
              בהרשמה למועדון
            </h2>
            <p className="text-soft font-light">ההנחה נשלחת אלייך מיד, ותקבלי עדכון ראשון על דגמים חדשים ומבצעים.</p>
          </div>
          <ClubSignup />
        </div>
      </section>
    </>
  );
}
