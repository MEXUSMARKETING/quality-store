import { CardIcon, CashIcon, HeartIcon, LockIcon, PinIcon, ShieldIcon, StarIcon, TagIcon, TruckIcon } from "../Icons";
import type { PerkIcon, PerksSection } from "@/lib/content-shared";

export const PERK_ICON_COMPONENTS: Record<PerkIcon, (p: { size?: number; stroke?: string; strokeWidth?: number }) => JSX.Element> = {
  card: CardIcon,
  truck: TruckIcon,
  tag: TagIcon,
  star: StarIcon,
  shield: ShieldIcon,
  pin: PinIcon,
  cash: CashIcon,
  lock: LockIcon,
  heart: HeartIcon,
};

const COLS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

/** Perks — one compact row. */
export default function Perks({ s }: { s: PerksSection }) {
  const items = s.items.filter((p) => p.title);
  if (!items.length) return null;
  return (
    <section aria-label="למה לקנות אצלנו" className="container-site py-8 md:py-12">
      <div className={`grid ${COLS[items.length] || COLS[4]}`}>
        {items.map(({ title, sub, icon }, i) => {
          const Icon = PERK_ICON_COMPONENTS[icon] || StarIcon;
          return (
            <div key={title + i} className={`flex flex-col items-center gap-1.5 md:gap-2 text-center px-1.5 md:px-4 ${i < items.length - 1 ? "border-l border-[#E6E3DC]" : ""}`}>
              <Icon size={28} stroke="#7A5A12" strokeWidth={1.3} />
              <b className="text-[11px] md:text-[15px] leading-tight">{title}</b>
              {sub && <span className="hidden md:block text-[13px] text-muted leading-normal">{sub}</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
