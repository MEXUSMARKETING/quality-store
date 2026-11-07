import ClubSignup from "./ClubSignup";
import RichTitle from "./RichTitle";
import type { ClubSection } from "@/lib/content-shared";

/** Club signup — joined to the footer. */
export default function ClubBlock({ s }: { s: ClubSection }) {
  return (
    <section aria-label="מועדון לקוחות" className="bg-night text-white">
      <div className="container-site py-14 md:pt-[72px] md:pb-16 flex flex-col lg:flex-row lg:items-center gap-9 lg:gap-[72px]">
        <div className="lg:flex-1 flex flex-col gap-3 lg:max-w-[440px]">
          {s.kicker && <span className="kicker text-gold">{s.kicker}</span>}
          {s.title && (
            <h2 className="font-display font-extrabold text-[36px] md:text-[52px] leading-[1.02]">
              <RichTitle text={s.title} />
            </h2>
          )}
          {s.text && <p className="text-soft font-light">{s.text}</p>}
        </div>
        <ClubSignup />
      </div>
    </section>
  );
}
