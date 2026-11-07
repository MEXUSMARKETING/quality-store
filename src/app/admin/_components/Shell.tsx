"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon, ICONS } from "./ui";
import { can, type Module, type PermissionMap } from "@/lib/permissions";

type NavItem = { href: string; label: string; icon: keyof typeof ICONS; badge?: number; module: Module };
type Group = { label: string; items: NavItem[] };
export type Alert = { href: string; title: string; meta: string; tone: "blue" | "amber" | "red" };

function isActive(path: string, href: string) {
  if (href === "/admin") return path === "/admin";
  return path === href || path.startsWith(href + "/");
}

export default function Shell({ newOrders, alerts, logoutAction, perms, userName, roleLabel, children }: { newOrders: number; alerts: Alert[]; logoutAction: () => Promise<void>; perms: PermissionMap; userName: string; roleLabel: string; children: React.ReactNode }) {
  const path = usePathname() || "/admin";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);

  const allGroups: Group[] = [
    { label: "", items: [
      { href: "/admin", label: "סקירה כללית", icon: "home", module: "dashboard" },
      { href: "/admin/orders", label: "הזמנות", icon: "bag", badge: newOrders || undefined, module: "orders" },
      { href: "/admin/products", label: "מוצרים ומלאי", icon: "box", module: "products" },
      { href: "/admin/customers", label: "לקוחות", icon: "users", module: "customers" },
    ] },
    { label: "קטלוג", items: [
      { href: "/admin/categories", label: "קטגוריות", icon: "grid", module: "categories" },
      { href: "/admin/attributes", label: "מידות וצבעים", icon: "sliders", module: "attributes" },
      { href: "/admin/reviews", label: "ביקורות ודירוגים", icon: "star", module: "reviews" },
    ] },
    { label: "שיווק", items: [
      { href: "/admin/promotions", label: "מבצעים", icon: "percent", module: "promotions" },
      { href: "/admin/coupons", label: "קופונים", icon: "tag", module: "coupons" },
      { href: "/admin/club", label: "מועדון לקוחות", icon: "heart", module: "coupons" },
      { href: "/admin/automations", label: "אוטומציות", icon: "zap", module: "automations" },
      { href: "/admin/reports", label: "דוחות ואנליטיקה", icon: "chart", module: "reports" },
    ] },
    { label: "אתר ותוכן", items: [
      { href: "/admin/homepage", label: "ניהול דף הבית", icon: "layout", module: "homepage" },
      { href: "/admin/pages", label: "דפים ותוכן", icon: "file", module: "pages" },
      { href: "/admin/menus", label: "ניהול תפריטים", icon: "list", module: "menus" },
    ] },
    { label: "מערכת", items: [
      { href: "/admin/ai", label: "עוזר AI", icon: "sparkle", module: "ai" },
      { href: "/admin/users", label: "משתמשים והרשאות", icon: "shield", module: "users" },
      { href: "/admin/settings", label: "הגדרות מערכת", icon: "gear", module: "settings" },
      { href: "/admin/activity", label: "יומן פעילות", icon: "clock", module: "activity" },
    ] },
  ];
  const groups = allGroups.map((g) => ({ ...g, items: g.items.filter((it) => can(perms, it.module, "view")) })).filter((g) => g.items.length);

  // close the mobile drawer on navigation
  useEffect(() => setOpen(false), [path]);

  // Ctrl/Cmd+K focuses search; Escape closes popovers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") {
        setBell(false);
        setOpen(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBell(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, []);

  const nav = (
    <nav aria-label="ניווט ראשי" className="flex flex-col gap-4">
      {groups.map((g, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {g.label && <span className="text-[11px] font-semibold text-[#AEB9CC] px-2.5 pb-1 tracking-wide">{g.label}</span>}
          {g.items.map((it) => {
            const on = isActive(path, it.href);
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={on ? "page" : undefined}
                className={`flex items-center gap-2.5 min-h-[40px] px-2.5 rounded-[9px] text-[14px] transition-colors ${on ? "bg-adm-blue text-white font-semibold hover:text-white" : "text-[#D3DBE8] hover:bg-white/10 hover:text-white"}`}
              >
                <Icon name={it.icon} />
                <span className="flex-1">{it.label}</span>
                {it.badge ? <span className={`min-w-[22px] h-5 px-1.5 rounded-full text-[12px] font-bold flex items-center justify-center ${on ? "bg-adm-navy text-white" : "bg-adm-blue text-white"}`}>{it.badge}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const sidebar = (
    <div className="h-full flex flex-col gap-5 p-3.5 pt-5">
      <Link href="/admin" className="flex items-center gap-2.5 px-2 hover:text-white">
        <span className="w-[38px] h-[38px] rounded-[10px] bg-adm-blue flex items-center justify-center font-extrabold text-[20px] text-white">Q</span>
        <span className="flex flex-col leading-tight">
          <b className="text-[17px] text-white" dir="ltr">Quality</b>
          <span className="text-[12px] text-[#AEB9CC]">ניהול החנות</span>
        </span>
      </Link>
      {nav}
      <div className="mt-auto flex flex-col gap-0.5 pt-4 border-t border-white/10">
        <a href="/" target="_blank" rel="noopener" className="flex items-center gap-2.5 min-h-[40px] px-2.5 rounded-[9px] text-[14px] text-[#D3DBE8] hover:bg-white/10 hover:text-white">
          <Icon name="external" /> צפייה באתר
        </a>
        <form action={logoutAction}>
          <button className="w-full flex items-center gap-2.5 min-h-[40px] px-2.5 rounded-[9px] text-[14px] text-[#D3DBE8] hover:bg-white/10 hover:text-white">
            <Icon name="logout" /> יציאה
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="adm min-h-screen flex font-sans">
      {/* desktop sidebar */}
      <aside className="hidden lg:block w-[248px] shrink-0 bg-adm-navy sticky top-0 h-screen overflow-y-auto adm-noprint">{sidebar}</aside>

      {/* mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex adm-noprint">
          <div className="w-[272px] max-w-[85vw] bg-adm-navy h-full overflow-y-auto shadow-2xl">{sidebar}</div>
          <button aria-label="סגירת התפריט" className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-white border-b border-adm-line px-4 md:px-7 py-3 flex items-center gap-3 adm-noprint">
          <button className="lg:hidden w-11 h-11 rounded-[11px] border border-adm-line flex items-center justify-center" aria-label="פתיחת התפריט" onClick={() => setOpen(true)}>
            <Icon name="menu" />
          </button>
          <form
            role="search"
            className="flex-1 max-w-[560px]"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) router.push(`/admin/search?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <label className="flex items-center gap-2.5 h-11 px-3.5 border border-adm-line rounded-[11px] bg-adm-bg">
              <Icon name="search" className="text-adm-muted" />
              <span className="sr-only">חיפוש בכל המערכת</span>
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                type="search"
                placeholder="חיפוש מוצר, הזמנה, לקוח או קופון…"
                className="flex-1 min-w-0 bg-transparent outline-none text-[14px]"
              />
              <span className="hidden md:inline text-[12px] text-adm-muted border border-adm-field rounded-md px-1.5 bg-white" dir="ltr">Ctrl K</span>
            </label>
          </form>
          <div className="ms-auto flex items-center gap-2 relative" ref={bellRef}>
            <button
              className="relative w-11 h-11 rounded-[11px] border border-adm-line bg-white flex items-center justify-center"
              aria-label={alerts.length ? `התראות – ${alerts.length}` : "התראות"}
              aria-expanded={bell}
              onClick={() => setBell((b) => !b)}
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4" /></svg>
              {alerts.length > 0 && <span className="absolute top-2 left-2 w-2.5 h-2.5 rounded-full bg-[#E05252] border-2 border-white" />}
            </button>
            {bell && (
              <div className="absolute top-[52px] left-0 w-[340px] max-w-[calc(100vw-32px)] bg-white border border-adm-line rounded-xl shadow-[0_12px_32px_rgba(23,36,58,.14)] p-2.5 flex flex-col gap-1">
                <b className="px-2 py-1.5 text-[15px]">התראות</b>
                {alerts.length === 0 && <p className="px-2 py-3 text-[14px] text-adm-muted">אין התראות חדשות. הכל תקין.</p>}
                {alerts.map((a, i) => (
                  <Link key={i} href={a.href} onClick={() => setBell(false)} className="flex gap-2.5 p-2.5 rounded-lg hover:bg-adm-bg">
                    <span className={`w-2 h-2 rounded-full mt-2 shrink-0 ${a.tone === "red" ? "bg-[#E05252]" : a.tone === "amber" ? "bg-[#E6A23C]" : "bg-adm-blue"}`} />
                    <span className="flex flex-col">
                      <span className="text-[14px] font-semibold">{a.title}</span>
                      <span className="text-[12px] text-adm-muted">{a.meta}</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
            <span className="hidden sm:flex items-center gap-2.5 ps-1">
              <span className="w-9 h-9 rounded-full bg-adm-navy text-white flex items-center justify-center font-bold">{(userName || "מ").trim().charAt(0)}</span>
              <span className="flex flex-col leading-tight">
                <span className="text-[14px] font-semibold">{userName}</span>
                <span className="text-[12px] text-adm-muted">{roleLabel}</span>
              </span>
            </span>
          </div>
        </header>
        <main className="p-4 md:p-7 flex flex-col gap-5 w-full max-w-[1280px] mx-auto">{children}</main>
      </div>
    </div>
  );
}
