import Link from "next/link";
import type { Product } from "@/lib/types";
import { shekel } from "@/lib/config";

function sizesText(p: Product) {
  const s = Object.entries(p.stock || {})
    .filter(([, q]) => Number(q) > 0)
    .map(([k]) => k)
    .sort((a, b) => Number(a) - Number(b));
  return s;
}

export default function ProductCard({ p, large = false }: { p: Product; large?: boolean }) {
  const sizes = sizesText(p);
  const soldOut = sizes.length === 0;
  const pct = p.old_price && p.old_price > p.price ? Math.round((1 - p.price / p.old_price) * 100) : null;
  const badge = soldOut ? "אזל מהמלאי" : sizes.length === 1 ? "מידה אחרונה" : pct ? `−${pct}%` : null;
  const badgeCls = soldOut ? "bg-white text-muted" : sizes.length === 1 ? "bg-white text-ink" : "bg-gold text-ink";

  return (
    <Link href={`/product/${p.slug}`} className="group flex flex-col gap-3">
      <div className={`relative aspect-square overflow-hidden bg-ink `}>
        {p.images[0] ? (
          <img src={p.images[0]} alt={p.name} loading="lazy" className={`w-full h-full object-contain transition-transform duration-500 group-hover:scale-[1.03] ${soldOut ? "opacity-60" : ""}`} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-soft text-sm">[תמונה]</div>
        )}
        {badge && (
          <span className={`absolute top-3 right-3 md:top-4 md:right-4 text-[12px] md:text-[13px] font-bold px-2.5 md:px-3 py-1 md:py-1.5 rounded-full ${badgeCls}`}>{badge}</span>
        )}
      </div>
      <div className="flex justify-between items-start gap-3 px-0.5 md:px-1">
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className={`font-bold ${large ? "text-[17px] md:text-[18px]" : "text-[15px] md:text-[17px]"}`}>{p.name}</span>
          <span className="text-[13px] md:text-[14px] text-muted">
            {p.heel ? `עקב ${p.heel} ס״מ` : ""}
            {p.heel && sizes.length ? " · " : ""}
            {sizes.length ? `מידות ${sizes.join(", ")}` : ""}
          </span>
        </div>
        <div className="flex flex-col items-end shrink-0">
          <span className={`font-display font-bold ${large ? "text-[20px] md:text-[22px]" : "text-[17px] md:text-[19px]"}`}>{shekel(p.price)}</span>
          {p.old_price && p.old_price > p.price && <span className="text-[13px] text-muted line-through">{shekel(p.old_price)}</span>}
        </div>
      </div>
    </Link>
  );
}
