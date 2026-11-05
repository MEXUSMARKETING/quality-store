import Link from "next/link";
import { listProducts } from "@/lib/store";
import CategoryCarousel, { type Cat } from "@/components/home/CategoryCarousel";
import Collection from "@/components/home/Collection";
import ClubSignup from "@/components/home/ClubSignup";
import { CardIcon, ChevronLeft, ShieldIcon, StarIcon, TagIcon, TruckIcon } from "@/components/Icons";
import { waLink } from "@/lib/config";

export const dynamic = "force-dynamic";

const img = (slug: string) => `/products/${slug}.jpg`;

export default async function Home() {
  const all = await listProducts();
  const boots = all.filter((p) => p.category === "boots");
  const ordered = [...boots.filter((p) => p.featured), ...boots.filter((p) => !p.featured)];
  const minPrice = boots.length ? Math.min(...boots.map((p) => p.price)) : 140;
  const maxPct = boots.reduce((m, p) => (p.old_price && p.old_price > p.price ? Math.max(m, Math.round((1 - p.price / p.old_price) * 100)) : m), 0);

  const cats: Cat[] = [
    { label: "שחור קלאסי", href: "/shop?color=black", img: img("black-gold-stripe") },
    { label: "חום וקוניאק", href: "/shop?color=brown", img: img("brown-gold-buckle") },
    { label: "כחול כהה", href: "/shop?color=blue", img: img("navy-gold-heel") },
    { label: "עקב נמוך", href: "/shop?heel=low", img: img("black-gold-heel") },
    { label: "עקב 9 ס״מ", href: "/shop?heel=high", img: img("suede-high-heel") },
    { label: "לק וקרוקו", href: "/shop?q=" + encodeURIComponent("קרוקו"), img: img("croc-square-toe") },
    { label: "מנומר", href: "/shop?q=" + encodeURIComponent("מנומר"), img: img("leopard") },
    { label: "אבזם קריסטל", href: "/shop?q=" + encodeURIComponent("קריסטל"), img: img("crystal-black") },
  ];

  const perks = [
    { title: "תשלום מאובטח", sub: "אשראי, Bit או מזומן בעת המסירה", Icon: CardIcon },
    { title: "משלוח מהיר", sub: "חינם עד דלת הבית", Icon: TruckIcon },
    { title: "מחירים ללא תחרות", sub: `עד ${maxPct || 60}% הנחה על הקולקציה`, Icon: TagIcon },
    { title: "שירות אישי באיכות גבוהה", sub: "זמינים לך בוואטסאפ", Icon: StarIcon },
    { title: "אתר מאובטח בתקן SSL", sub: "הפרטים שלך מוצפנים ומוגנים", Icon: ShieldIcon },
  ];

  return (
    <>
      {/* Hero — full width */}
      <section aria-label="באנר ראשי" className="bg-night text-white">
        <div className="flex flex-col-reverse lg:flex-row lg:min-h-[600px]">
          <div className="lg:flex-1 px-5 py-10 md:px-14 lg:py-[72px] lg:pr-[max(32px,calc((100vw_-_1320px)/2_+_32px))] flex flex-col justify-center gap-5 md:gap-[22px]">
            <span dir="ltr" className="kicker text-gold self-end text-[12px] md:text-[13px] tracking-[5px]">NEW COLLECTION · 2026</span>
            <h1 className="font-display font-extrabold text-[40px] md:text-[64px] lg:text-[72px] leading-[1.02] tracking-tight">
              מגפוני חורף
              <br />
              <span className="text-gold">מ־₪{minPrice}</span> בלבד
            </h1>
            <p className="text-[16px] md:text-[19px] leading-relaxed text-soft font-light max-w-[440px]">
              עד {maxPct || 60}% הנחה על הקולקציה החדשה. משלוח חינם עד הבית — ומשלמים רק כשהנעל אצלך.
            </p>
            <div className="flex flex-wrap gap-3 md:gap-3.5 mt-1 md:mt-2">
              <Link href="/shop" className="btn btn-gold h-[52px] md:h-14 px-8">
                לכל הקולקציה <ChevronLeft size={18} strokeWidth={2.2} />
              </Link>
              <a href={waLink("שלום, אשמח להזמין מגפון מהקולקציה")} target="_blank" rel="noopener" className="btn btn-outline-light h-[52px] md:h-14 font-medium">
                הזמנה בוואטסאפ
              </a>
            </div>
          </div>
          <div className="lg:flex-[1.25] grid grid-cols-[1.2fr_1fr] grid-rows-2 gap-[3px] h-[360px] md:h-[480px] lg:h-auto">
            <img src={img("leopard")} alt="מגפון מנומר" className="w-full h-full object-cover row-span-2" />
            <img src={img("crystal-cognac")} alt="מגפון קריסטל קוניאק" className="w-full h-full object-cover" />
            <img src={img("navy-gold-heel")} alt="מגפון כחול עקב זהב" className="w-full h-full object-cover" />
          </div>
        </div>
      </section>

      {/* Style carousel */}
      <section aria-label="קנייה לפי סגנון" className="container-site pt-6 md:pt-8">
        <CategoryCarousel cats={cats} />
      </section>

      {/* Collection */}
      <Collection products={ordered} />

      {/* Jewelry + bags */}
      <section aria-label="קטגוריות נוספות" className="container-site pt-14 md:pt-20 grid md:grid-cols-2 gap-4 md:gap-[22px]">
        <Link href="/shop?category=jewelry" className="group relative min-h-[300px] md:min-h-[380px] rounded-[24px] md:rounded-[28px] overflow-hidden bg-night text-white flex hover:text-white">
          <div className="flex-[1.2] p-7 md:p-11 flex flex-col justify-end gap-3 z-10">
            <span className="kicker text-gold">קטגוריה חדשה</span>
            <h2 className="font-display font-extrabold text-[32px] md:text-[40px] leading-[1.05]">תכשיטים<br />ואקססוריז</h2>
            <p className="text-soft font-light">הנגיעה שמשלימה את הלוק</p>
            <span className="btn btn-gold self-start mt-2">לקולקציה <ChevronLeft size={16} strokeWidth={2.2} /></span>
          </div>
          <div className="flex-1 flex items-center justify-center border-r border-dashed border-[#3A3833]">
            <svg width="150" height="150" viewBox="0 0 120 120" fill="none" stroke="#C9A24A" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M24 22c4 30 18 48 36 48s32-18 36-48" /><path d="M30 22c4 24 16 40 30 40s26-16 30-40" /><path d="M60 70v8" /><path d="M60 78l-9 12 9 14 9-14z" /><path d="M51 90h18" />
            </svg>
          </div>
        </Link>
        <Link href="/shop?category=bags" className="group relative min-h-[300px] md:min-h-[380px] rounded-[24px] md:rounded-[28px] overflow-hidden bg-sand text-ink flex">
          <div className="flex-[1.2] p-7 md:p-11 flex flex-col justify-end gap-3">
            <span className="kicker text-golddark font-bold">קטגוריה חדשה</span>
            <h2 className="font-display font-extrabold text-[32px] md:text-[40px] leading-[1.05]">תיקים<br />וארנקים</h2>
            <p className="text-[#45443F]">תיק שמתאים למגפון — וליום שלך</p>
            <span className="btn btn-dark self-start mt-2">לקולקציה <ChevronLeft size={16} strokeWidth={2.2} /></span>
          </div>
          <div className="flex-1 flex items-center justify-center border-r border-dashed border-[#C9C1AE]">
            <svg width="150" height="150" viewBox="0 0 120 120" fill="none" stroke="#141414" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 48h76l-6 52H28z" /><path d="M42 48V38a18 18 0 0 1 36 0v10" /><path d="M22 62h76" /><rect x="54" y="58" width="12" height="9" rx="2" stroke="#7A5A12" />
            </svg>
          </div>
        </Link>
      </section>

      {/* Promo — full width */}
      <section aria-label="מבצע" className="mt-16 md:mt-[88px] bg-night text-white">
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
