import Link from "next/link";
import { adminPasswordSet, isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import LoginForm from "./LoginForm";
import { logout } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "ניהול", robots: { index: false, follow: false } };

const NAV = [
  { href: "/admin", label: "לוח בקרה" },
  { href: "/admin/orders", label: "הזמנות" },
  { href: "/admin/products", label: "מוצרים ומלאי" },
  { href: "/admin/club", label: "מועדון לקוחות" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!isAdmin()) return <LoginForm configured={adminPasswordSet()} />;

  return (
    <div className="min-h-screen bg-[#F1EFEA] flex flex-col md:flex-row">
      <aside className="md:w-[240px] md:min-h-screen bg-night text-white flex md:flex-col gap-1 p-3 md:p-5 overflow-x-auto no-scrollbar shrink-0">
        <Link href="/admin" dir="ltr" className="font-logo font-bold text-[26px] text-gold md:pb-6 pe-4 md:pe-0 text-right hover:text-gold">Quality</Link>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className="px-3 py-2.5 rounded-lg text-[15px] whitespace-nowrap text-[#D9D7D0] hover:bg-white/10 hover:text-white">
            {n.label}
          </Link>
        ))}
        <div className="md:mt-auto flex md:flex-col gap-1 md:pt-6">
          <Link href="/" target="_blank" className="px-3 py-2.5 rounded-lg text-[14px] whitespace-nowrap text-soft hover:text-white">צפייה באתר ↗</Link>
          <form action={logout}>
            <button className="px-3 py-2.5 rounded-lg text-[14px] whitespace-nowrap text-soft hover:text-white">יציאה</button>
          </form>
        </div>
      </aside>
      <div className="flex-1 min-w-0 p-4 md:p-8">
        {!hasDb() && (
          <div className="mb-5 p-4 rounded-2xl bg-[#FBEDE6] text-[#7A2E0C] text-sm leading-6">
            <b>מסד הנתונים עדיין לא מחובר.</b> האתר מציג כרגע את מוצרי ברירת המחדל, והזמנות נשלחות בוואטסאפ.
            כדי לשמור הזמנות ולערוך מוצרים: ב־Vercel ← Storage ← חיבור <b dir="ltr">Neon Postgres</b> לפרויקט, ואז פריסה מחדש.
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
