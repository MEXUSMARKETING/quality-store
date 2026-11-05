import Link from "next/link";
import { LockIcon } from "./Icons";
import { STORE, waLink } from "@/lib/config";

export default function Footer() {
  return (
    <footer className="bg-night text-white border-t border-[#2A2925]">
      <div className="container-site py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-[15px]">
        <div className="col-span-2 md:col-span-1 flex flex-col gap-3">
          <span dir="ltr" className="font-logo font-bold text-[32px] text-gold text-right">Quality</span>
          <span className="text-soft leading-7">
            {STORE.city} · {STORE.address}
            <br />
            <span dir="ltr">{STORE.phoneDisplay}</span>
          </span>
        </div>
        <div className="flex flex-col gap-2.5">
          <b>קנייה</b>
          <Link href="/shop" className="text-soft hover:text-white">כל המגפונים</Link>
          <Link href="/shop?heel=low" className="text-soft hover:text-white">עקב נמוך</Link>
          <Link href="/shop?heel=high" className="text-soft hover:text-white">עקב גבוה</Link>
          <Link href="/shop?sort=discount" className="text-soft hover:text-white">מבצעים</Link>
        </div>
        <div className="flex flex-col gap-2.5">
          <b>שירות לקוחות</b>
          <a href={waLink("שלום, יש לי שאלה")} target="_blank" rel="noopener" className="text-soft hover:text-white">וואטסאפ</a>
          <Link href="/info/shipping" className="text-soft hover:text-white">משלוחים והחזרות</Link>
          <Link href="/info/sizes" className="text-soft hover:text-white">מדריך מידות</Link>
        </div>
        <div className="flex flex-col gap-2.5">
          <b>מידע</b>
          <Link href="/info/terms" className="text-soft hover:text-white">תקנון האתר</Link>
          <Link href="/info/privacy" className="text-soft hover:text-white">מדיניות פרטיות</Link>
          <Link href="/info/accessibility" className="text-soft hover:text-white">הצהרת נגישות</Link>
        </div>
      </div>
      <div className="container-site py-5 border-t border-[#2A2925] flex flex-wrap justify-between gap-2.5 text-[13px] text-[#8C8980]">
        <span>© Quality {new Date().getFullYear()} · כל הזכויות שמורות</span>
        <span className="flex items-center gap-1.5"><LockIcon size={14} strokeWidth={2} /> אתר מאובטח SSL</span>
      </div>
    </footer>
  );
}
