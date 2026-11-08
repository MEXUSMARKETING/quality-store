"use client";

import { useEffect, useState } from "react";
import { priceCartAction, type CartPricing } from "@/app/actions";
import type { CartItem } from "@/lib/types";

/** Live promotion pricing for the cart. While loading (or without promotions) it falls back to the
 *  plain cart subtotal, so totals never flash a wrong discount. The server re-prices at checkout. */
export function usePromoPricing(items: CartItem[], ready: boolean) {
  const [pricing, setPricing] = useState<CartPricing | null>(null);
  const [loading, setLoading] = useState(false);
  const sig = JSON.stringify(items.map((i) => [i.productId, i.size, i.color || "", i.qty]));

  useEffect(() => {
    if (!ready) return;
    if (!items.length) { setPricing(null); return; }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      priceCartAction(items.map((i) => ({ productId: i.productId, size: i.size, color: i.color, qty: i.qty })))
        .then((r) => { if (!cancelled) setPricing(r.ok ? r : null); })
        .catch(() => { if (!cancelled) setPricing(null); })
        .finally(() => { if (!cancelled) setLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, ready]);

  const subtotal = items.reduce((a, x) => a + x.qty * x.price, 0);
  const discount = pricing ? Math.min(subtotal, pricing.discount) : 0;
  return {
    loading,
    subtotal,
    discount,
    afterPromo: subtotal - discount,
    applied: pricing?.applied || [],
    lines: pricing?.lines || {},
    hints: pricing?.hints || [],
    allowCoupon: pricing ? pricing.allowCoupon : true,
  };
}
