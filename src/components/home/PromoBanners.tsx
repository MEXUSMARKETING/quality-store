import SmartLink from "./SmartLink";
import type { PromosSection } from "@/lib/content-shared";

/** One or two promo banners — edge to edge, no gaps. */
export default function PromoBanners({ s }: { s: PromosSection }) {
  const items = s.items.filter((b) => b.title || b.text || b.image);
  if (!items.length) return null;
  const single = items.length === 1;
  return (
    <section aria-label="מבצעים" className={`mt-10 md:mt-14 grid ${single ? "" : "md:grid-cols-2"}`}>
      {items.map((b, i) => {
        const inner = (
          <>
            {b.image && <img src={b.image} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" aria-hidden="true" />
            <div className="absolute bottom-0 inset-x-0 p-6 md:p-10 text-white flex flex-col gap-2 md:gap-3">
              {b.title && <h2 className="font-display font-extrabold text-[30px] md:text-[44px] leading-[1.05]">{b.title}</h2>}
              {b.text && <p className="text-[15px] md:text-[17px] text-[#E8E4DA] font-light">{b.text}</p>}
            </div>
          </>
        );
        const cls = `group relative block ${single ? "aspect-[4/3] md:aspect-[21/8]" : "aspect-[4/3] md:aspect-[16/11]"} overflow-hidden bg-night hover:text-white`;
        return b.href ? (
          <SmartLink key={b.title + i} href={b.href} className={cls}>{inner}</SmartLink>
        ) : (
          <div key={b.title + i} className={cls}>{inner}</div>
        );
      })}
    </section>
  );
}
