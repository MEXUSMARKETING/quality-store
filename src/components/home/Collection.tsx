"use client";

import Link from "next/link";
import { useState } from "react";
import ProductCard from "../ProductCard";
import type { Product } from "@/lib/types";

export default function Collection({ products }: { products: Product[] }) {
  const [shown, setShown] = useState(4);
  const list = products.slice(0, shown);

  return (
    <section className="container-site pt-14 md:pt-20">
      <div className="flex items-end justify-between pb-6 md:pb-7">
        <div className="flex flex-col gap-1.5">
          <span className="kicker text-golddark font-bold">חורף 2026</span>
          <h2 className="font-display font-bold text-[28px] md:text-[40px] tracking-tight">הקולקציה החדשה</h2>
        </div>
        <span className="text-[13px] md:text-[15px] text-muted">
          {list.length} מתוך {products.length}
        </span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-7 md:gap-x-[22px] md:gap-y-10">
        {list.map((p) => (
          <ProductCard key={p.id} p={p} large />
        ))}
      </div>
      <div className="flex flex-col sm:flex-row justify-center gap-3 pt-8 md:pt-11">
        {shown < products.length && (
          <button onClick={() => setShown((s) => s + 4)} className="btn btn-dark h-[54px] px-9">
            טעינת מוצרים נוספים
          </button>
        )}
        <Link href="/shop" className="btn btn-outline h-[54px] px-8 font-medium">
          לכל המוצרים
        </Link>
      </div>
    </section>
  );
}
