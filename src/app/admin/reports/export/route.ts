import { hasPermission } from "@/lib/auth";
import { buildReport, fmtVal } from "@/lib/reports";

export const dynamic = "force-dynamic";

// Quote every cell; neutralise spreadsheet formula injection (=, +, -, @ at the start).
const esc = (v: unknown) => {
  let s = String(v ?? "");
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
};

/** Raw value for CSV: numbers stay plain numbers (spreadsheet-friendly), the rest formatted. */
const cell = (v: string | number | null | undefined, type: string) => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && type !== "date") return String(v);
  return fmtVal(v, type as any);
};

export async function GET(req: Request) {
  if (!(await hasPermission("reports", "view"))) return new Response("Unauthorized", { status: 401 });
  const sp = Object.fromEntries(new URL(req.url).searchParams.entries());
  const { report } = await buildReport(sp);
  const lines: string[] = [];
  lines.push([report.title, report.rangeLabel, report.prevLabel ? `השוואה ל־${report.prevLabel}` : ""].map(esc).join(","));
  lines.push(report.columns.map((c) => esc(c.label)).join(","));
  for (const r of report.rows) lines.push(report.columns.map((c) => esc(cell(r[c.key], c.type))).join(","));
  if (report.totals) lines.push(report.columns.map((c) => esc(cell(report.totals![c.key], c.type))).join(","));
  if (!report.rows.length) lines.push(esc("אין נתונים בתקופה"));
  for (const n of report.notes) lines.push(esc(n));
  const csv = "﻿" + lines.join("\r\n");
  const date = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quality-report-${report.key}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
