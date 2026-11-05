"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "./CartProvider";
import { BagIcon, CloseIcon, MenuIcon, SearchIcon, WhatsAppIcon } from "./Icons";
import { STORE, waLink } from "@/lib/config";

const NAV = [
  { href: "/shop", label: "כל המגפונים" },
  { href: "/shop?color=black", label: "שחור" },
  { href: "/shop?color=brown", label: "חום וקוניאק" },
  { href: "/shop?heel=high", label: "עקב גבוה" },
  { href: "/shop?category=jewelry", label: "תכשיטים" },
  { href: "/shop?category=bags", label: "תיקים" },
];

export function Logo({ className = "text-[30px] md:text-[34px]" }: { className?: string }) {
  return (
    <Link href="/" dir="ltr" className={`font-logo font-bold flex items-baseline gap-[3px] leading-none ${className}`}>
      Quality<span className="inline-block w-2 h-2 rounded-full bg-gold" />
    </Link>
  );
}

export default function Header() {
  const { count, ready } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="bg-night text-[#E8E4DA] text-[12px] md:text-[13px] text-center py-2.5 px-4">
        משלוח חינם עד הבית <span className="text-gold px-2">✦</span> תשלום במזומן בעת המסירה
        <span className="hidden md:inline">
          <span className="text-gold px-2">✦</span> וואטסאפ <span dir="ltr">{STORE.phoneDisplay}</span>
        </span>
      </div>
      <header className="sticky top-0 z-40 bg-cream/95 backdrop-blur border-b border-line">
        <div className="container-site flex items-center gap-4 md:gap-7 py-2.5 md:py-4">
          <button className="md:hidden w-11 h-11 flex items-center justify-center -ms-2" aria-label="תפריט" onClick={() => setOpen(true)}>
            <MenuIcon size={24} />
          </button>
          <Logo />
          <nav aria-label="קטגוריות" className="hidden lg:flex gap-0.5 text-[15px] font-medium">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="px-3 py-2.5 hover:text-golddark">
                {n.label}
              </Link>
            ))}
          </nav>
          <form action="/shop" className="hidden md:flex flex-1 items-center gap-2.5 h-[46px] px-4 bg-white border border-line rounded-full text-muted">
            <SearchIcon size={19} />
            <label className="sr-only" htmlFor="q">חיפוש</label>
            <input id="q" name="q" type="search" placeholder="חיפוש לפי צבע, עקב או דגם" className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-ink" />
          </form>
          <div className="flex items-center gap-1 ms-auto md:ms-0">
            <Link href="/shop" aria-label="חיפוש" className="md:hidden w-11 h-11 flex items-center justify-center">
              <SearchIcon />
            </Link>
            <Link href="/cart" aria-label={`סל קניות, ${count} פריטים`} className="relative h-11 md:px-4 w-11 md:w-auto rounded-full md:bg-ink md:text-white flex items-center justify-center gap-2 font-bold text-sm hover:text-white">
              <BagIcon size={21} />
              <span className="hidden md:inline">סל</span>
              {ready && count > 0 && (
                <span className="absolute md:static top-1 left-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-ink text-[11px] font-bold flex items-center justify-center">
                  {count}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button className="absolute inset-0 bg-black/40" aria-label="סגירת תפריט" onClick={() => setOpen(false)} />
          <div className="absolute top-0 bottom-0 right-0 w-[84%] max-w-[340px] bg-cream p-5 flex flex-col gap-2 shadow-xl">
            <div className="flex items-center justify-between pb-3">
              <Logo className="text-[28px]" />
              <button className="w-11 h-11 flex items-center justify-center" aria-label="סגירה" onClick={() => setOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <form action="/shop" className="flex items-center gap-2 h-12 px-4 bg-white border border-line rounded-xl text-muted mb-2">
              <SearchIcon size={19} />
              <input name="q" type="search" placeholder="חיפוש" aria-label="חיפוש" className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-ink" />
            </form>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="py-3 text-[17px] font-medium border-b border-line">
                {n.label}
              </Link>
            ))}
            <a href={waLink("שלום, אשמח לעזרה בהזמנה")} target="_blank" rel="noopener" className="btn btn-dark mt-4">
              <WhatsAppIcon size={20} /> הזמנה בוואטסאפ
            </a>
          </div>
        </div>
      )}
    </>
  );
}
