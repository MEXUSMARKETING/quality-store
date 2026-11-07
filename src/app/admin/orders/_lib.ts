import type { OrderFilters } from "@/lib/admin-orders";
import { PAYMENT_STATUS } from "@/lib/config";

/* Shared parsing of the orders list URL (page + CSV export). */

export type OrdersSearch = { status?: string; q?: string; pay?: string; range?: string; sort?: string; page?: string };

export const STATUS_TABS: { key: string; label: string; statuses: string[] }[] = [
  { key: "", label: "הכל", statuses: [] },
  { key: "new", label: "חדשות", statuses: ["new"] },
  { key: "confirmed", label: "אושרו", statuses: ["confirmed"] },
  { key: "packed", label: "נארזו", statuses: ["packed"] },
  { key: "shipped", label: "נשלחו", statuses: ["shipped"] },
  { key: "delivered", label: "נמסרו", statuses: ["delivered"] },
  { key: "closed", label: "בוטלו / הוחזרו", statuses: ["cancelled", "returned"] },
];

export const RANGES: Record<string, { label: string; days: number | null }> = {
  "7": { label: "7 ימים אחרונים", days: 7 },
  "30": { label: "30 יום אחרונים", days: 30 },
  "90": { label: "90 יום אחרונים", days: 90 },
  all: { label: "כל הזמנים", days: null },
};

export const SORTS: Record<string, string> = {
  newest: "החדשות ביותר",
  oldest: "הישנות ביותר",
  total_desc: "סכום: מהגבוה לנמוך",
  total_asc: "סכום: מהנמוך לגבוה",
};

export function parseOrdersSearch(sp: OrdersSearch) {
  const statusKeys = new Set(["new", "confirmed", "packed", "shipped", "delivered", "cancelled", "returned", "closed"]);
  const status = sp.status && statusKeys.has(sp.status) ? sp.status : "";
  const range = sp.range && RANGES[sp.range] ? sp.range : "all";
  const sort = sp.sort && SORTS[sp.sort] ? sp.sort : "newest";
  const pay = sp.pay && PAYMENT_STATUS[sp.pay] ? sp.pay : "";
  const q = (sp.q || "").trim().slice(0, 80);
  const page = Math.max(1, Math.min(10000, parseInt(sp.page || "1", 10) || 1));
  const filters: OrderFilters = { status: status || undefined, q, pay: pay || undefined, days: RANGES[range].days, sort, page };
  return { status, range, sort, pay, q, page, filters };
}

export function ordersHref(base: { status?: string; q?: string; pay?: string; range?: string; sort?: string; page?: number }, path = "/admin/orders") {
  const p = new URLSearchParams();
  if (base.status) p.set("status", base.status);
  if (base.q) p.set("q", base.q);
  if (base.pay) p.set("pay", base.pay);
  if (base.range && base.range !== "all") p.set("range", base.range);
  if (base.sort && base.sort !== "newest") p.set("sort", base.sort);
  if (base.page && base.page > 1) p.set("page", String(base.page));
  const s = p.toString();
  return s ? `${path}?${s}` : path;
}
