import { ChevronLeft } from "../Icons";
import SmartLink from "./SmartLink";
import type { TilesSection } from "@/lib/content-shared";

const COLS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 lg:grid-cols-4" };

/** Category tiles — edge to edge, no gaps. */
export default function CategoryTiles({ s }: { s: TilesSection }) {
  const tiles = s.tiles.filter((t) => t.label && t.href);
  if (!tiles.length) return null;
  return (
    <section aria-label="קטגוריות" className={`grid ${COLS[tiles.length] || COLS[4]}`}>
      {tiles.map((c, i) => (
        <SmartLink key={c.label + i} href={c.href} className="group relative block aspect-[3/4] lg:aspect-[4/5] overflow-hidden bg-panel hover:text-white">
          {c.image && <img src={c.image} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/5 to-transparent" aria-hidden="true" />
          <div className="absolute bottom-0 inset-x-0 p-4 md:p-7 text-white flex flex-col gap-1">
            <span className="font-display font-bold text-[20px] md:text-[28px] leading-tight">{c.label}</span>
            <span className="hidden md:inline-flex items-center gap-1.5 text-[14px] font-bold mt-1 underline underline-offset-4">לקטגוריה <ChevronLeft size={14} strokeWidth={2.4} /></span>
          </div>
        </SmartLink>
      ))}
    </section>
  );
}
