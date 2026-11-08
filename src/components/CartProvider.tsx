"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { CartItem } from "@/lib/types";

type CartCtx = {
  items: CartItem[];
  count: number;
  subtotal: number;
  ready: boolean;
  add: (item: CartItem) => void;
  setQty: (productId: number, size: string, qty: number, color?: string) => void;
  remove: (productId: number, size: string, color?: string) => void;
  clear: () => void;
};

const Ctx = createContext<CartCtx | null>(null);
/** same product + size + colour (colour only for variant products) */
const same = (x: CartItem, productId: number, size: string, color?: string) => x.productId === productId && x.size === size && (x.color || "") === (color || "");
const KEY = "quality_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch {}
  }, [items, ready]);

  const add = useCallback((item: CartItem) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => same(x, item.productId, item.size, item.color));
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: Math.min(9, next[i].qty + item.qty) };
        return next;
      }
      return [...prev, item];
    });
  }, []);

  const setQty = useCallback((productId: number, size: string, qty: number, color?: string) => {
    setItems((prev) => prev.map((x) => (same(x, productId, size, color) ? { ...x, qty: Math.max(1, Math.min(9, qty)) } : x)));
  }, []);

  const remove = useCallback((productId: number, size: string, color?: string) => {
    setItems((prev) => prev.filter((x) => !same(x, productId, size, color)));
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartCtx>(
    () => ({
      items,
      ready,
      count: items.reduce((a, x) => a + x.qty, 0),
      subtotal: items.reduce((a, x) => a + x.qty * x.price, 0),
      add,
      setQty,
      remove,
      clear,
    }),
    [items, ready, add, setQty, remove, clear]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCart(): CartCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}
