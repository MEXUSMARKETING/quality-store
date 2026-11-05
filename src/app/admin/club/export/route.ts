import { isAdmin } from "@/lib/auth";
import { listClubMembers } from "@/lib/store";

export const dynamic = "force-dynamic";

const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET() {
  if (!isAdmin()) return new Response("Unauthorized", { status: 401 });
  const rows = await listClubMembers();
  const csv =
    "﻿" +
    ["שם,טלפון,מייל,תאריך"]
      .concat(rows.map((m) => [m.name, m.phone, m.email, new Date(m.created_at).toLocaleDateString("he-IL")].map(esc).join(",")))
      .join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quality-club.csv"`,
    },
  });
}
