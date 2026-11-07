import { ChevronLeft } from "../Icons";
import RichTitle from "./RichTitle";
import SmartLink from "./SmartLink";
import type { HeroSection } from "@/lib/content-shared";

/** Big full-width hero. Texts already have {placeholders} filled. */
export default function Hero({ s, first = true }: { s: HeroSection; first?: boolean }) {
  const H = first ? "h1" : "h2";
  return (
    <section aria-label="באנר ראשי" className="relative bg-night text-white overflow-hidden">
      {s.image && <img src={s.image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-black/35 to-black/10" aria-hidden="true" />
      <div className="relative container-site min-h-[480px] md:min-h-[620px] lg:min-h-[680px] flex flex-col justify-center gap-5 py-14">
        {s.kicker && <span dir="auto" className="kicker text-gold self-end text-[12px] md:text-[13px] tracking-[5px]">{s.kicker}</span>}
        {s.title && (
          <H className="font-display font-extrabold text-[42px] md:text-[68px] lg:text-[80px] leading-[1] tracking-tight max-w-[640px]">
            <RichTitle text={s.title} />
          </H>
        )}
        {s.subtitle && <p className="text-[16px] md:text-[20px] leading-relaxed text-[#E8E4DA] font-light max-w-[460px]">{s.subtitle}</p>}
        {((s.primaryText && s.primaryHref) || (s.secondaryText && s.secondaryHref)) && (
          <div className="flex flex-wrap gap-3 mt-2">
            {s.primaryText && s.primaryHref && (
              <SmartLink href={s.primaryHref} className="btn btn-gold h-[52px] md:h-14 px-8">
                {s.primaryText} <ChevronLeft size={18} strokeWidth={2.2} />
              </SmartLink>
            )}
            {s.secondaryText && s.secondaryHref && (
              <SmartLink href={s.secondaryHref} className="btn btn-outline-light h-[52px] md:h-14 font-medium border-white/60">
                {s.secondaryText}
              </SmartLink>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
