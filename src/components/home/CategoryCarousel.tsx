"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "../Icons";

export type Cat = { label: string; href: string; img: string };

export default function CategoryCarousel({ cats }: { cats: Cat[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const update = () => {
    const el = ref.current;
    if (!el) return;
    // RTL: scrollLeft is 0 at the start and goes negative
    const max = el.scrollWidth - el.clientWidth;
    const pos = Math.abs(el.scrollLeft);
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
    if (!el) return;
    el.scrollBy({ left: -dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div ref={ref} onScroll={update} className="flex gap-3 md:gap-[18px] overflow-x-auto no-scrollbar snap-x snap-mandatory scroll-px-4">
        {cats.map((c) => (
          <Link key={c.label} href={c.href} className="snap-start shrink-0 relative w-[150px] h-[200px] md:w-[236px] md:h-[260px] rounded-[20px] md:rounded-[22px] overflow-hidden bg-ink block">
            <img src={c.img} alt="" loading="lazy" className="w-full h-full object-cover" />
            <span className="absolute bottom-2.5 inset-x-2.5 md:bottom-3.5 md:inset-x-3.5 h-[38px] md:h-[46px] px-4 rounded-full bg-white/95 text-ink font-bold text-[13px] md:text-[15px] flex items-center justify-center md:justify-between">
              {c.label}
              <span className="hidden md:inline text-golddark"><ChevronLeft size={15} strokeWidth={2.2} /></span>
            </span>
          </Link>
        ))}
      </div>
      <button onClick={() => go(-1)} disabled={atStart} aria-label="הקודם" className="hidden md:flex absolute top-[106px] -right-5 w-12 h-12 rounded-full bg-white shadow-[0_4px_14px_rgba(0,0,0,0.18)] items-center justify-center disabled:opacity-0 transition-opacity">
        <ChevronRight size={20} />
      </button>
      <button onClick={() => go(1)} disabled={atEnd} aria-label="הבא" className="hidden md:flex absolute top-[106px] -left-5 w-12 h-12 rounded-full bg-white shadow-[0_4px_14px_rgba(0,0,0,0.18)] items-center justify-center disabled:opacity-0 transition-opacity">
        <ChevronLeft size={20} />
      </button>
    </div>
  );
}
