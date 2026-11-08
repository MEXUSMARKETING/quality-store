"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db, hasDb } from "@/lib/db";
import { audit } from "@/lib/admin";
import { setSetting } from "@/lib/site";
import { COLOR_KEY_RE, HEX_RE, getAttributes, type Attributes, type ColorDef } from "@/lib/catalog";

export type AttrResult = { ok?: string; error?: string };

const NO_DB = "מסד הנתונים לא מחובר, ולכן אי אפשר לשמור שינויים.";

/** Sizes that currently have stock (> 0) in any product, and colours used by any product. */
async function usage() {
  const sql = await db();
  const [sizes, colors] = await Promise.all([
    sql`select s.key as size, count(*)::int as n from products p, jsonb_each_text(p.stock) s where (s.value)::numeric > 0 group by s.key`,
    sql`select c as color, count(distinct id)::int as n from (
      select id, color as c from products
      union all
      select p.id, v->>'key' from products p, jsonb_array_elements(coalesce(p.variants->'colors', '[]'::jsonb)) v
    ) x group by c`,
  ]);
  return {
    sizes: new Map<string, number>(sizes.map((r: any) => [String(r.size), Number(r.n)])),
    colors: new Map<string, number>(colors.map((r: any) => [String(r.color), Number(r.n)])),
  };
}

function revalidateAll() {
  revalidatePath("/", "layout");
  revalidatePath("/shop");
  revalidatePath("/admin/attributes");
  revalidatePath("/admin/products");
}

export async function saveSizesAction(input: string[]): Promise<AttrResult> {
  await requireAdmin("attributes");
  if (!hasDb()) return { error: NO_DB };
  if (!Array.isArray(input)) return { error: "נתונים לא תקינים" };
  const sizes: string[] = [];
  for (const raw of input) {
    const s = String(raw ?? "").trim();
    if (!s) continue;
    if (s.length > 10 || !/^[0-9A-Za-z.\/\-½]+$/.test(s)) return { error: `המידה "${s}" לא תקינה – מספרים או אותיות לטיניות בלבד (למשל 38 או 38.5)` };
    if (sizes.includes(s)) return { error: `המידה ${s} מופיעה פעמיים` };
    sizes.push(s);
  }
  if (!sizes.length) return { error: "חייבת להישאר לפחות מידה אחת" };
  if (sizes.length > 30) return { error: "אפשר להגדיר עד 30 מידות" };

  const before = await getAttributes();
  const removed = before.sizes.filter((s) => !sizes.includes(s));
  if (removed.length) {
    const u = await usage();
    const blocked = removed.filter((s) => (u.sizes.get(s) || 0) > 0);
    if (blocked.length) return { error: `אי אפשר להסיר את המידות ${blocked.join(", ")} – יש להן מלאי ב־${blocked.map((s) => u.sizes.get(s)).reduce((a, b) => a! + b!, 0)} מוצרים. אפסי קודם את המלאי שלהן.` };
  }
  if (JSON.stringify(before.sizes) === JSON.stringify(sizes)) return { ok: "לא היו שינויים" };

  const next: Attributes = { sizes, colors: before.colors };
  await setSetting("attributes", next);
  const added = sizes.filter((s) => !before.sizes.includes(s));
  const parts = [added.length && `נוספו ${added.join(", ")}`, removed.length && `הוסרו ${removed.join(", ")}`, !added.length && !removed.length && "שינוי סדר"].filter(Boolean);
  await audit({ action: "update", entity: "attribute", entityId: "sizes", summary: `עדכון מידות: ${parts.join(" · ")}`, before: { sizes: before.sizes }, after: { sizes } });
  revalidateAll();
  return { ok: "המידות נשמרו" };
}

export async function saveColorsAction(input: ColorDef[]): Promise<AttrResult> {
  await requireAdmin("attributes");
  if (!hasDb()) return { error: NO_DB };
  if (!Array.isArray(input)) return { error: "נתונים לא תקינים" };
  const colors: ColorDef[] = [];
  for (const c of input) {
    const key = String(c?.key ?? "").trim().toLowerCase();
    const label = String(c?.label ?? "").trim().slice(0, 40);
    const hex = String(c?.hex ?? "").trim();
    if (!key && !label) continue;
    if (!COLOR_KEY_RE.test(key)) return { error: `מפתח הצבע "${key || label}" לא תקין – אותיות לטיניות קטנות, ספרות ומקפים (למשל light-brown)` };
    if (!label) return { error: `יש להזין שם בעברית לצבע ${key}` };
    if (!HEX_RE.test(hex)) return { error: `קוד הצבע של "${label}" צריך להיות בפורמט ‎#RRGGBB` };
    if (colors.some((x) => x.key === key)) return { error: `המפתח ${key} מופיע פעמיים` };
    colors.push({ key, label, hex: hex.toUpperCase() });
  }
  if (!colors.length) return { error: "חייב להישאר לפחות צבע אחד" };
  if (colors.length > 40) return { error: "אפשר להגדיר עד 40 צבעים" };

  const before = await getAttributes();
  const removed = before.colors.filter((c) => !colors.some((x) => x.key === c.key));
  if (removed.length) {
    const u = await usage();
    const blocked = removed.filter((c) => (u.colors.get(c.key) || 0) > 0);
    if (blocked.length) return { error: `אי אפשר להסיר את ${blocked.map((c) => `"${c.label}" (${u.colors.get(c.key)} מוצרים)`).join(", ")} – שני קודם את הצבע במוצרים האלה.` };
  }
  if (JSON.stringify(before.colors) === JSON.stringify(colors)) return { ok: "לא היו שינויים" };

  await setSetting("attributes", { sizes: before.sizes, colors } satisfies Attributes);
  const added = colors.filter((c) => !before.colors.some((x) => x.key === c.key));
  const edited = colors.filter((c) => { const b = before.colors.find((x) => x.key === c.key); return b && (b.label !== c.label || b.hex !== c.hex); });
  const parts = [
    added.length && `נוספו ${added.map((c) => c.label).join(", ")}`,
    removed.length && `הוסרו ${removed.map((c) => c.label).join(", ")}`,
    edited.length && `עודכנו ${edited.map((c) => c.label).join(", ")}`,
  ].filter(Boolean);
  await audit({ action: "update", entity: "attribute", entityId: "colors", summary: `עדכון צבעים: ${parts.join(" · ") || "שינוי סדר"}`, before: { colors: before.colors }, after: { colors } });
  revalidateAll();
  return { ok: "הצבעים נשמרו" };
}
