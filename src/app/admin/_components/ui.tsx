import Link from "next/link";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/config";

/* Shared admin UI building blocks (server-safe: no hooks). */

export const ICONS = {
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  bag: "M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2",
  box: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",
  users: "M16 19v-1a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v1M10 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM20 19v-1a3 3 0 0 0-2-3M16 4a3 3 0 0 1 0 6",
  tag: "M3 12V4h8l10 10-8 8zM7.5 7.5h.01",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM21 21l-4.3-4.3",
  plus: "M12 5v14M5 12h14",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  copy: "M8 8h12v12H8zM4 16V4h12",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6L6 18",
  print: "M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z",
  check: "M5 12l5 5 9-10",
  alert: "M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z",
  download: "M12 4v11M7 10l5 5 5-5M5 20h14",
  arrowLeft: "M15 6l-6 6 6 6",
  arrowRight: "M9 6l6 6-6 6",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  sliders: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M14 4v4M8 10v4M16 16v4",
  zap: "M13 3L4 14h7l-1 7 9-11h-7z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  layout: "M4 4h16v16H4zM4 9h16M10 9v11",
  file: "M6 3h8l4 4v14H6zM14 3v4h4",
  list: "M4 6h16M4 12h16M4 18h10",
  sparkle: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12h2M3 12h2M12 3v2M12 19v2M17 7l1.5-1.5M5.5 18.5L7 17M17 17l1.5 1.5M5.5 5.5L7 7",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  up: "M6 15l6-6 6 6",
  down: "M6 9l6 6 6-6",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01",
  percent: "M19 5L5 19M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  gift: "M4 11h16v10H4zM3 7h18v4H3zM12 7v14M12 7c-1.5-3-5-3.5-5-1s3.5 1 5 1c1.5 0 5 1.5 5-1s-3.5-2-5 1",
  pause: "M8 5v14M16 5v14",
  play: "M7 5l12 7-12 7z",
} as const;

export function Icon({ name, size = 18, className = "", strokeWidth = 1.8 }: { name: keyof typeof ICONS; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={ICONS[name]} />
    </svg>
  );
}

export function PageHeader({ crumbs, title, sub, children }: { crumbs?: { href?: string; label: string }[]; title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1 min-w-0">
        {crumbs && crumbs.length > 0 && (
          <nav aria-label="פירורי לחם" className="text-[13px] text-adm-muted flex gap-1.5 flex-wrap">
            {crumbs.map((c, i) => (
              <span key={i} className="flex gap-1.5">
                {c.href ? <Link href={c.href} className="hover:underline">{c.label}</Link> : <span>{c.label}</span>}
                {i < crumbs.length - 1 && <span aria-hidden="true">/</span>}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-[26px] font-extrabold text-adm-navy leading-tight">{title}</h1>
        {sub && <p className="text-[14px] text-adm-muted">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2 items-center">{children}</div>}
    </div>
  );
}

const TONES = {
  green: "bg-[#E6F6F0] text-[#0F7A57]",
  amber: "bg-[#FFF4E0] text-[#8A5A00]",
  red: "bg-[#FDECEC] text-[#B03A3A]",
  blue: "bg-[#F1ECFF] text-[#5414D6]",
  gray: "bg-[#F0EEF6] text-[#3D3858]",
  purple: "bg-[#F1EDFD] text-[#5B3FC4]",
} as const;
export type Tone = keyof typeof TONES;

export function Chip({ tone = "gray", children, className = "" }: { tone?: Tone; children: React.ReactNode; className?: string }) {
  return <span className={`a-chip ${TONES[tone]} ${className}`}>{children}</span>;
}

/** Colored chip from a { label, color } map (order / payment statuses) */
function MapChip({ s }: { s: { label: string; color: string } }) {
  return (
    <span className="a-chip" style={{ background: s.color + "18", color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
      {s.label}
    </span>
  );
}
export function OrderStatusChip({ status }: { status: string }) {
  return <MapChip s={ORDER_STATUS[status] || { label: status, color: "#615C7A" }} />;
}
export function PaymentStatusChip({ status }: { status?: string }) {
  const k = status || "pending";
  return <MapChip s={PAYMENT_STATUS[k] || { label: k, color: "#615C7A" }} />;
}

export function Empty({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return (
    <div className="py-12 px-5 flex flex-col items-center gap-2.5 text-center">
      <span className="w-12 h-12 rounded-2xl bg-adm-bg text-adm-muted flex items-center justify-center"><Icon name="box" size={22} /></span>
      <b className="text-[16px]">{title}</b>
      {text && <p className="text-[14px] text-adm-muted max-w-[420px] leading-6">{text}</p>}
      {children && <div className="pt-1 flex gap-2 flex-wrap justify-center">{children}</div>}
    </div>
  );
}

export function Notice({ tone = "amber", children }: { tone?: "amber" | "blue" | "red" | "green"; children: React.ReactNode }) {
  const t = { amber: "bg-[#FFF4E0] text-[#6B4600] border-[#F5DFB3]", blue: "bg-[#F1ECFF] text-[#3A1C7A] border-[#E2D6FD]", red: "bg-[#FDECEC] text-[#8A2626] border-[#F3D3D3]", green: "bg-[#E6F6F0] text-[#0B5E43] border-[#C6EADB]" }[tone];
  return <div className={`p-4 rounded-xl border text-[14px] leading-6 ${t}`}>{children}</div>;
}

/** Tabs that are plain links (server-side filtering through the URL) */
export function LinkTabs({ tabs }: { tabs: { href: string; label: string; count?: number; active: boolean }[] }) {
  return (
    <nav className="flex gap-1 border-b border-adm-line overflow-x-auto no-scrollbar">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className="a-tab" aria-current={t.active ? "page" : undefined}>
          {t.label}
          {t.count !== undefined && <span className="a-count">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function DbMissing() {
  return (
    <Notice tone="amber">
      <b>מסד הנתונים עדיין לא מחובר.</b> כדי לשמור הזמנות, לקוחות, קופונים ושינויים במוצרים יש לחבר את פרויקט{" "}
      <b dir="ltr">Supabase</b> של החנות ל־Vercel (משתני הסביבה DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY), ואז פריסה מחדש.
    </Notice>
  );
}

export const fmtDate = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" }) : "—");
export const fmtDateTime = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
