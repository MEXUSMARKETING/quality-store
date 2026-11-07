import Link from "next/link";
import { LockIcon } from "./Icons";
import { STORE } from "@/lib/config";
import { defaultMenus, resolveMenus, type MenuItem, type Menus } from "@/lib/content-shared";
import type { ShopStore } from "./Header";

function FooterLink({ item }: { item: MenuItem }) {
  const cls = "text-soft hover:text-white";
  if (/^\/(?!\/)/.test(item.href) && !item.newTab) return <Link href={item.href} className={cls}>{item.label}</Link>;
  return (
    <a href={item.href} className={cls} {...(item.newTab ? { target: "_blank", rel: "noopener" } : {})}>
      {item.label}
    </a>
  );
}

export default function Footer({ menus, store }: { menus?: Menus; store?: ShopStore }) {
  const s = store || STORE;
  const m = menus || resolveMenus(defaultMenus(), s.whatsapp);
  return (
    <footer className="bg-night text-white border-t border-[#2A2925]">
      <div className="container-site py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-[15px]">
        <div className="col-span-2 md:col-span-1 flex flex-col gap-3">
          <span dir="ltr" className="font-logo font-bold text-[32px] text-gold text-right">Quality</span>
          <span className="text-soft leading-7">
            {s.city} · {s.address}
            <br />
            <span dir="ltr">{s.phoneDisplay}</span>
          </span>
        </div>
        {m.footer.map((col, i) => (
          <div key={col.title + i} className="flex flex-col gap-2.5">
            {col.title && <b>{col.title}</b>}
            {col.items.map((it, j) => (
              <FooterLink key={it.href + j} item={it} />
            ))}
          </div>
        ))}
      </div>
      <div className="container-site py-5 border-t border-[#2A2925] flex flex-wrap justify-between gap-2.5 text-[13px] text-[#8C8980]">
        <span>© Quality {new Date().getFullYear()} · כל הזכויות שמורות</span>
        <span className="flex items-center gap-1.5"><LockIcon size={14} strokeWidth={2} /> אתר מאובטח SSL</span>
      </div>
    </footer>
  );
}
