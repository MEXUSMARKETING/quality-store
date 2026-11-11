"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { useCart } from "./CartProvider";
import { BagIcon, ChevronLeft, CloseIcon, MenuIcon, SearchIcon, WhatsAppIcon } from "./Icons";
import { STORE, waLink } from "@/lib/config";
import { defaultMenus, isHighlight, type MenuItem, type Menus } from "@/lib/content-shared";

export type ShopStore = { name: string; city: string; address: string; phoneDisplay: string; whatsapp: string };

export function Logo({ className = "text-[30px] md:text-[34px]" }: { className?: string }) {
  return (
    <Link href="/" dir="ltr" className={`font-logo font-bold flex items-baseline gap-[3px] leading-none ${className}`}>
      Quality<span className="inline-block w-2 h-2 rounded-full bg-gold" />
    </Link>
  );
}

/** Link that opens internal paths with next/link and external ones as anchors. */
function NavLink({ item, className, onClick, role }: { item: MenuItem; className?: string; onClick?: () => void; role?: string }) {
  const internal = /^\/(?!\/)/.test(item.href);
  if (internal && !item.newTab) {
    return <Link href={item.href} className={className} onClick={onClick} role={role}>{item.label}</Link>;
  }
  return (
    <a href={item.href} className={className} onClick={onClick} role={role} {...(item.newTab ? { target: "_blank", rel: "noopener" } : {})}>
      {item.label}
    </a>
  );
}

/** "a | b" in the admin text → gold ✦ separators, as in the original bar. */
function AnnouncementText({ text }: { text: string }) {
  const parts = text.split("|").map((s) => s.trim()).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <>{" "}<span className="text-gold px-2">✦</span>{" "}</>}
          {p}
        </Fragment>
      ))}
    </>
  );
}

/** Photo shown in the mega-menu for a top-level category (by its ?category= key). */
const MENU_PHOTOS: Record<string, string> = {
  "women-shoes": "photo-1605733160314-4fc7dac4bb16",
  jewelry: "photo-1617038220319-276d3cfab638",
  bags: "photo-1624687943971-e86af76d57de",
};
const menuPhoto = (href: string) => {
  const key = /[?&]category=([^&]+)/.exec(href)?.[1];
  const id = key ? MENU_PHOTOS[decodeURIComponent(key)] : undefined;
  return id ? `https://images.unsplash.com/${id}?auto=format&fit=crop&w=640&q=80` : "";
};

/** Desktop mega-menu for a top-level item with children: a full-width panel under the header. */
function Dropdown({ item }: { item: MenuItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = () => { if (timer.current) clearTimeout(timer.current); setOpen(true); };
  const hide = () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 140); };
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const photo = menuPhoto(item.href);
  const kids = item.children || [];

  return (
    <div ref={ref} onMouseEnter={show} onMouseLeave={hide}>
      <div className={`flex items-center border-b-2 transition-colors ${open ? "border-ink" : "border-transparent"}`}>
        <NavLink item={item} className="ps-3 pe-1 py-2.5 hover:text-golddark" />
        <button type="button" aria-expanded={open} aria-label={`תת־תפריט ${item.label}`} onClick={() => setOpen((o) => !o)} className="w-7 h-10 flex items-center justify-center hover:text-golddark">
          <ChevronLeft size={14} strokeWidth={2.2} className={`transition-transform ${open ? "rotate-90" : "-rotate-90"}`} />
        </button>
      </div>
      {open && (
        <div className="absolute inset-x-0 top-full z-50 bg-white border-t border-line shadow-[0_28px_40px_-24px_rgba(0,0,0,0.22)]">
          <div className="container-site py-8 flex gap-10 items-stretch">
            <div className="w-[210px] shrink-0 flex flex-col gap-2 pe-8 border-e border-line">
              <span className="font-display font-bold text-[26px] leading-tight text-ink">{item.label}</span>
              <span className="text-[13px] text-muted">{kids.length} קטגוריות</span>
              <NavLink
                item={{ ...item, label: `לכל ${item.label}`, children: undefined }}
                onClick={() => setOpen(false)}
                className="mt-auto self-start h-10 px-5 rounded-full bg-ink text-white text-[14px] font-bold flex items-center hover:text-white hover:opacity-90"
              />
            </div>
            <ul className="flex-1 grid grid-cols-2 xl:grid-cols-3 gap-x-10 content-start">
              {kids.map((c, i) => (
                <li key={c.href + i}>
                  <NavLink
                    item={c}
                    onClick={() => setOpen(false)}
                    className="group/l flex items-center justify-between gap-3 py-3.5 border-b border-[#EEECE6] text-[16px] text-ink hover:text-golddark transition-colors"
                  />
                </li>
              ))}
            </ul>
            {photo && (
              <Link href={item.href} onClick={() => setOpen(false)} className="hidden xl:block relative w-[260px] shrink-0 aspect-[4/5] overflow-hidden bg-panel group/p">
                <img src={photo} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover/p:scale-105" />
                <span className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-black/60 to-transparent text-white flex flex-col gap-0.5">
                  <span className="text-[12px] tracking-[2px] text-[#E8E4DA]">קולקציה חדשה</span>
                  <span className="font-display font-bold text-[20px]">{item.label}</span>
                </span>
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header({ menus, store }: { menus?: Menus; store?: ShopStore }) {
  const { count, ready } = useCart();
  const [open, setOpen] = useState(false);
  const m = menus || defaultMenus();
  const phone = store?.phoneDisplay || STORE.phoneDisplay;
  const wa = store?.whatsapp || STORE.whatsapp;
  const ann = m.announcement;
  const mobileExtra = m.mobileExtra || [];

  return (
    <>
      {ann.enabled && (ann.text || ann.showPhone) && (
        <div className="bg-night text-[#E8E4DA] text-[12px] md:text-[13px] text-center py-2.5 px-4">
          <AnnouncementText text={ann.text} />
          {ann.showPhone !== false && (
            <span className="hidden md:inline">
              {ann.text && <span className="text-gold px-2">✦</span>} וואטסאפ <span dir="ltr">{phone}</span>
            </span>
          )}
        </div>
      )}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-line">
        <div className="container-site flex items-center gap-4 md:gap-7 py-2.5 md:py-4">
          <button className="md:hidden w-11 h-11 flex items-center justify-center -ms-2" aria-label="תפריט" onClick={() => setOpen(true)}>
            <MenuIcon size={24} />
          </button>
          <Logo />
          {m.main.length > 0 && (
            <nav aria-label="קטגוריות" className="hidden lg:flex gap-0.5 text-[15px] font-medium">
              {m.main.map((n, i) =>
                n.children && n.children.length ? (
                  <Dropdown key={n.href + i} item={n} />
                ) : isHighlight(n) ? (
                  <NavLink key={n.href + i} item={n} className="ms-1.5 self-center h-9 px-4 rounded-full bg-[#D21F2A] text-white font-extrabold tracking-wider text-[14px] flex items-center hover:bg-[#B3161F] hover:text-white" />
                ) : (
                  <NavLink key={n.href + i} item={n} className="px-3 py-2.5 hover:text-golddark" />
                )
              )}
            </nav>
          )}
          <form action="/shop" className="hidden md:flex flex-1 items-center gap-2.5 h-[46px] px-4 bg-panel border border-line rounded-full text-muted">
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
          <div className="absolute top-0 bottom-0 right-0 w-[84%] max-w-[340px] bg-white p-5 flex flex-col gap-2 shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between pb-3">
              <Logo className="text-[28px]" />
              <button className="w-11 h-11 flex items-center justify-center" aria-label="סגירה" onClick={() => setOpen(false)}>
                <CloseIcon />
              </button>
            </div>
            <form action="/shop" className="flex items-center gap-2 h-12 px-4 bg-panel border border-line rounded-xl text-muted mb-2">
              <SearchIcon size={19} />
              <input name="q" type="search" placeholder="חיפוש" aria-label="חיפוש" className="flex-1 min-w-0 bg-transparent outline-none text-[15px] text-ink" />
            </form>
            {m.main.map((n, i) => (
              <Fragment key={n.href + i}>
                <NavLink item={n} onClick={() => setOpen(false)} className={isHighlight(n) ? "my-2 self-start h-10 px-5 rounded-full bg-[#D21F2A] text-white font-extrabold tracking-wider text-[15px] flex items-center hover:text-white" : "py-3 text-[17px] font-medium border-b border-line"} />
                {n.children && n.children.length > 0 && (
                  <ul className="flex flex-col border-b border-line pb-1">
                    {n.children.map((c, j) => (
                      <li key={c.href + j}>
                        <NavLink item={c} onClick={() => setOpen(false)} className="block py-2.5 ps-4 text-[15px] text-muted" />
                      </li>
                    ))}
                  </ul>
                )}
              </Fragment>
            ))}
            {mobileExtra.map((n, i) => (
              <NavLink key={"x" + n.href + i} item={n} onClick={() => setOpen(false)} className="py-3 text-[15px] border-b border-line" />
            ))}
            <a href={waLink("שלום, אשמח לעזרה בהזמנה", wa)} target="_blank" rel="noopener" className="btn btn-dark mt-4">
              <WhatsAppIcon size={20} /> הזמנה בוואטסאפ
            </a>
          </div>
        </div>
      )}
    </>
  );
}
