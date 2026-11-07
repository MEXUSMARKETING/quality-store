import { shekel } from "@/lib/config";

/* Promotion rows and upsell hints for the cart and checkout summaries (storefront palette). */

export function PromoRows({ applied }: { applied: { id: number; name: string; badge: string; discount: number }[] }) {
  if (!applied.length) return null;
  return (
    <>
      {applied.map((a) => (
        <div key={a.id} className="flex justify-between gap-3 text-[15px] text-[#2F5A26] font-bold">
          <span className="flex items-center gap-2 min-w-0">
            <span className="shrink-0 text-[12px] px-2 py-0.5 rounded-full bg-gold text-ink">{a.badge}</span>
            <span className="truncate">{a.name}</span>
          </span>
          <span dir="ltr" className="shrink-0">-{shekel(a.discount)}</span>
        </div>
      ))}
    </>
  );
}

export function PromoHints({ hints }: { hints: string[] }) {
  if (!hints.length) return null;
  return (
    <div className="flex flex-col gap-1.5" aria-live="polite">
      {hints.map((h) => (
        <p key={h} className="flex gap-2 items-start rounded-[14px] border-[1.5px] border-dashed border-gold bg-white px-3.5 py-2.5 text-[14px] leading-6">
          <span aria-hidden="true" className="text-gold font-bold">✦</span>
          <span>{h}</span>
        </p>
      ))}
    </div>
  );
}
