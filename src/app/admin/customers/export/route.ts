import { isAdmin } from "@/lib/auth";
import { SEGMENTS, filterCustomers, listCustomersAgg } from "@/lib/admin-orders";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

/** Exports the current segment/search. The consent column is always included so marketing
    lists can be filtered to people who agreed (or use ?seg=consent to export only them). */
export async function GET(req: Request) {
  if (!isAdmin()) return new Response("Unauthorized", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const seg = SEGMENTS[sp.get("seg") || ""] ? sp.get("seg")! : "all";
  const list = filterCustomers(await listCustomersAgg(), { seg, q: sp.get("q") || "", sort: sp.get("sort") || "" });
  const d = (s: string | null) => (s ? new Date(s).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" }) : "");
  const head = ["שם", "טלפון", "מייל", "עיר", "הזמנות", "סך רכישות", "רכישה ראשונה", "רכישה אחרונה", "תגיות", "מאשר/ת דיוור", "בארכיון", "נוצר"];
  const lines = list.map((c) =>
    [c.name, c.phone, c.email, c.city, c.orders, c.spent, d(c.first_order), d(c.last_order), c.tags.join(" | "), c.marketing_consent ? "כן" : "לא", c.archived ? "כן" : "לא", d(c.created_at)].map(esc).join(",")
  );
  const csv = "﻿" + [head.map(esc).join(","), ...lines].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quality-customers-${seg}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
