"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ProductCard from "../ProductCard";
import { ChevronLeft, ChevronRight } from "../Icons";
import type { Product } from "@/lib/types";

export default function ProductRow({ title, kicker, products, href, limit = 10, badges = {} }: { title: string; kicker?: string; products: Product[]; href: string; limit?: number; badges?: Record<number, string> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const list = products.slice(0, limit);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft); // RTL scrollLeft is 0 at start, negative after
    setAtStart(pos < 4);
    setAtEnd(pos > max - 4);
  };

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: -dir * el.clientWidth, behavior: "smooth" });
  };

  if (!list.length) return null;

  return (
    <section className="container-site pt-8 md:pt-12">
      <div className="flex items-end justify-between gap-4 pb-4 md:pb-5">
        <h2 className="font-display font-bold text-[24px] md:text-[32px] tracking-tight">{title}</h2>
        <div className="flex items-center gap-2 md:gap-3">
          <Link href={href} className="text-[14px] md:text-[15px] font-medium underline underline-offset-4">לכל המוצרים</Link>
          <button onClick={() => go(-1)} disabled={atStart} aria-label="הקודם" className="hidden md:flex w-11 h-11 rounded-full border border-line items-center justify-center disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
          <button onClick={() => go(1)} disabled={atEnd} aria-label="הבא" className="hidden md:flex w-11 h-11 rounded-full bg-ink text-white items-center justify-center disabled:opacity-30">
            <ChevronLeft size={18} />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        onScroll={update}
        className="flex gap-3 md:gap-5 overflow-x-auto no-scrollbar snap-x snap-mandatory"
      >
        {list.map((p) => (
          <div key={p.id} className="snap-start shrink-0 w-[calc((100%_-_12px)/2)] md:w-[calc((100%_-_40px)/3)] lg:w-[calc((100%_-_60px)/4)]">
            <ProductCard p={p} promo={badges[p.id]} />
          </div>
        ))}
      </div>
    </section>
  );
}
