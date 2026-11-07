import { hasPermission } from "@/lib/auth";
import { itemsCount, listOrdersAdmin } from "@/lib/admin-orders";
import { ORDER_STATUS, PAYMENT, PAYMENT_STATUS, SHIPPING } from "@/lib/config";
import { parseOrdersSearch } from "../_lib";

export const dynamic = "force-dynamic";

// Quote every cell; neutralise spreadsheet formula injection (=, +, -, @ at the start).
const esc = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(req: Request) {
  if (!(await hasPermission("orders", "view"))) return new Response("Unauthorized", { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const { filters } = parseOrdersSearch(sp);
  const { rows } = await listOrdersAdmin(filters, { all: true });
  const head = ["מספר", "תאריך", "לקוחה", "טלפון", "מייל", "עיר", "כתובת", "משלוח", "אמצעי תשלום", "סטטוס תשלום", "סטטוס", "זוגות", "פריטים", "סכום ביניים", "הנחה", "קופון", "סה״כ", "מספר מעקב", "הערות"];
  const lines = rows.map((o) =>
    [
      o.number,
      new Date(o.created_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }),
      o.customer_name,
      o.phone,
      o.email,
      o.city,
      [o.street, o.apt].filter(Boolean).join(", "),
      SHIPPING[o.shipping_method] || o.shipping_method,
      PAYMENT[o.payment_method] || o.payment_method,
      PAYMENT_STATUS[o.payment_status || "pending"]?.label || o.payment_status,
      ORDER_STATUS[o.status]?.label || o.status,
      itemsCount(o),
      o.items.map((i) => `${i.name} מידה ${i.size} ×${i.qty}`).join(" | "),
      o.subtotal,
      o.discount || 0,
      o.coupon_code,
      o.total,
      o.tracking,
      o.notes,
    ].map(esc).join(",")
  );
  const csv = "﻿" + [head.map(esc).join(","), ...lines].join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quality-orders-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
