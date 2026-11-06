import Link from "next/link";
import { listProducts, bestSellerIds } from "@/lib/store";
import ProductRow from "@/components/home/ProductRow";
import ClubSignup from "@/components/home/ClubSignup";
import { CardIcon, ChevronLeft, ShieldIcon, StarIcon, TagIcon, TruckIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

const img = (slug: string) => `/products/${slug}.jpg`;
const stock = (id: string, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const CATS = [
  { label: "מגפונים", sub: "הקולקציה החדשה", href: "/shop", img: stock("photo-1605733160314-4fc7dac4bb16", 900) },
  { label: "נעלי עקב", sub: "לערב ולאירועים", href: "/shop?category=heels", img: stock("photo-1551489186-ccb95a1ea6a3", 900) },
  { label: "תיקים וארנקים", sub: "משלימים את הלוק", href: "/shop?category=bags", img: stock("photo-1624687943971-e86af76d57de", 900) },
  { label: "תכשיטים ואקססוריז", sub: "נגיעה של זהב", href: "/shop?category=jewelry", img: stock("photo-1617038220319-276d3cfab638", 900) },
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
    { title: "אתר מאובטח בתקן SSL", sub: "הפרטים שלך מוצפנים ומוגנים", Icon: ShieldIcon },
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

      {/* Promo — full width */}
      <section aria-label="מבצע" className="mt-10 md:mt-14 bg-night text-white">
        <div className="flex flex-col lg:flex-row lg:min-h-[320px]">
          <div className="lg:flex-1 px-5 py-10 md:px-14 lg:py-12 lg:pr-[max(32px,calc((100vw_-_1320px)/2_+_32px))] flex flex-col justify-center gap-3.5">
            <span className="kicker text-gold">מבצע לזמן מוגבל</span>
            <h2 className="font-display font-extrabold text-[34px] md:text-[52px] leading-[1.02]">
              עד <span className="text-gold">{maxPct || 60}%</span> הנחה
              <br />
              על כל המגפונים
            </h2>
            <p className="text-soft font-light">מידות מוגבלות — חלק מהדגמים כבר במידה אחרונה.</p>
            <Link href="/shop?sort=discount" className="btn btn-gold self-start mt-1.5">לכל המבצעים</Link>
          </div>
          <div className="lg:flex-[1.25] grid grid-cols-3 gap-[3px] h-[160px] md:h-[260px] lg:h-auto">
            <img src={img("croc-square-toe")} alt="" className="w-full h-full object-cover" />
            <img src={img("brown-gold-buckle")} alt="" className="w-full h-full object-cover" />
            <img src={img("croc-gold-buckle")} alt="" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      {/* Perks */}
      <section aria-label="למה לקנות אצלנו" className="container-site py-14 md:py-[72px]">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-y-9">
          {perks.map(({ title, sub, Icon }, i) => (
            <div key={title} className={`flex flex-col items-center gap-3 text-center px-3 md:px-5 ${i < perks.length - 1 ? "lg:border-l lg:border-[#DDD9D0]" : ""} ${i === perks.length - 1 ? "col-span-2 md:col-span-1" : ""}`}>
              <Icon size={42} stroke="#7A5A12" strokeWidth={1.1} />
              <b className="text-[15px] md:text-[17px]">{title}</b>
              <span className="text-[13px] md:text-[14px] text-muted leading-normal">{sub}</span>
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
