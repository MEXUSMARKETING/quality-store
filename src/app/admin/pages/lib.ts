import type { CmsPage } from "@/lib/content-shared";
import { pageIsLive } from "@/lib/content-shared";
import type { Tone } from "../_components/ui";

/* Helpers shared by the pages list, editor and actions (client-safe). */

export function pageState(p: Pick<CmsPage, "status" | "publish_at">, now = new Date()): { label: string; tone: Tone } {
  if (p.status === "published") return { label: "מפורסם", tone: "green" };
  if (p.status === "scheduled") return pageIsLive(p, now) ? { label: "מפורסם (תוזמן)", tone: "green" } : { label: "מתוזמן", tone: "blue" };
  return { label: "טיוטה", tone: "gray" };
}

/** Hebrew / free text → url slug (latin only; Hebrew titles need a manual slug). */
export function slugify(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
