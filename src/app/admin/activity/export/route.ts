import { isAdmin } from "@/lib/auth";
import { listAudit } from "@/lib/admin";
import { ACTIONS, ENTITIES, ENTITY_SINGLE, FIELD_LABELS, RANGES, fmtValue, sinceFor } from "../meta";

export const dynamic = "force-dynamic";

const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;

function changes(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const b = before || {};
  const a = after || {};
  const keys = Array.from(new Set([...Object.keys(b), ...Object.keys(a)]));
  return keys.map((k) => `${FIELD_LABELS[k] || k}: ${k in b ? fmtValue(k, b[k]) : "—"} → ${k in a ? fmtValue(k, a[k]) : "—"}`).join(" | ");
}

export async function GET(req: Request) {
  if (!isAdmin()) return new Response("Unauthorized", { status: 401 });
  const u = new URL(req.url).searchParams;
  const entity = ENTITIES[u.get("entity") || ""] ? u.get("entity")! : "";
  const action = ACTIONS[u.get("action") || ""] ? u.get("action")! : "";
  const range = RANGES[u.get("range") || ""] ? u.get("range")! : "30d";
  const q = (u.get("q") || "").trim().slice(0, 100);

  const rows = await listAudit({
    entities: entity ? ENTITIES[entity].db : undefined,
    action: action || undefined,
    q: q || undefined,
    since: sinceFor(range),
    limit: 20000,
  });

  const csv =
    "﻿" +
    ["תאריך,שעה,פעולה,סוג,מזהה,תיאור,משתמש,שינויים"]
      .concat(
        rows.map((r) => {
          const d = new Date(r.created_at);
          return [
            d.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" }),
            d.toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" }),
            ACTIONS[r.action]?.label || r.action,
            ENTITY_SINGLE[r.entity] || r.entity,
            r.entity_id,
            r.summary,
            r.actor,
            changes(r.before, r.after),
          ]
            .map(esc)
            .join(",");
        })
      )
      .join("\n");
  const stamp = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="quality-activity-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
