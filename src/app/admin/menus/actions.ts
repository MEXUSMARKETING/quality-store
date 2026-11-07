"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { audit } from "@/lib/admin";
import { setSetting } from "@/lib/site";
import { getMenus, normalizeMenus, safeHref, type MenuItem, type Menus } from "@/lib/content";

export type MenusResult = { ok?: boolean; error?: string; menus?: Menus };

const outline = (items: MenuItem[] = []): string[] => items.map((i) => `${i.label} → ${i.href}${i.children?.length ? ` [${i.children.map((c) => c.label).join(", ")}]` : ""}`);
const snap = (m: Menus) => ({
  announcement: m.announcement,
  main: outline(m.main),
  footer: m.footer.map((c) => `${c.title}: ${c.items.map((i) => i.label).join(", ")}`),
  mobileExtra: outline(m.mobileExtra),
});

function check(items: unknown, where: string, depth: number): string | null {
  if (!Array.isArray(items)) return null;
  for (const raw of items) {
    const it = raw as Record<string, any>;
    if (!String(it?.label || "").trim()) return `${where}: יש פריט בלי שם`;
    if (!safeHref(it?.href)) return `${where}: הקישור של "${String(it.label).trim()}" לא תקין (צריך להתחיל ב־/ או https://)`;
    if (Array.isArray(it.children) && it.children.length) {
      if (depth <= 1) return `${where}: אפשר רק רמה אחת של תת־תפריט`;
      const e = check(it.children, where, depth - 1);
      if (e) return e;
    }
  }
  return null;
}

export async function saveMenusAction(json: string): Promise<MenusResult> {
  await requireAdmin("menus");
  if (!hasDb()) return { error: "מסד הנתונים לא מחובר, לא ניתן לשמור תפריטים כרגע" };
  let raw: any;
  try {
    raw = JSON.parse(String(json || ""));
  } catch {
    return { error: "הנתונים שנשלחו לא תקינים" };
  }
  if (!raw || typeof raw !== "object") return { error: "הנתונים שנשלחו לא תקינים" };
  const e =
    check(raw.main, "תפריט ראשי", 2) ||
    check(raw.mobileExtra, "קישורים בנייד", 1) ||
    (Array.isArray(raw.footer) ? raw.footer.map((c: any, i: number) => check(c?.items, `פוטר – ${String(c?.title || "").trim() || "עמודה " + (i + 1)}`, 1)).find(Boolean) : null);
  if (e) return { error: e };
  if (Array.isArray(raw.footer) && raw.footer.length > 3) return { error: "אפשר עד 3 עמודות קישורים בפוטר" };
  if (Array.isArray(raw.main) && raw.main.length > 12) return { error: "יותר מדי פריטים בתפריט הראשי (עד 12)" };
  const menus = normalizeMenus(raw);
  try {
    const before = await getMenus();
    await setSetting("menus", menus);
    await audit({ action: "update", entity: "menu", entityId: "menus", summary: "עודכנו התפריטים ופס ההודעה", before: snap(before), after: snap(menus) });
  } catch (err) {
    console.error(err);
    return { error: "השמירה נכשלה, נסו שוב" };
  }
  revalidatePath("/", "layout");
  revalidatePath("/admin/menus");
  return { ok: true, menus };
}
