import { hasPermission } from "@/lib/auth";
import { getPopup, listPopupLeads } from "@/lib/popups";

export const dynamic = "force-dynamic";

const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET(_: Request, { params }: { params: { id: string } }) {
  if (!(await hasPermission("popups", "view"))) return new Response("Unauthorized", { status: 401 });
  const p = await getPopup(Number(params.id));
  if (!p) return new Response("Not found", { status: 404 });
  const rows = await listPopupLeads(p.id, 10000);
  const csv =
    "﻿" +
    ["תאריך,שם,טלפון,מייל,הודעה,עמוד"]
      .concat(
        rows.map((l) =>
          [new Date(l.created_at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" }), l.name, l.phone, l.email, l.message, l.page].map(esc).join(",")
        )
      )
      .join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="popup-${p.id}-leads.csv"`,
    },
  });
}
