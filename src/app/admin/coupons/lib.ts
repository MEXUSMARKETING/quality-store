import type { CouponState } from "@/lib/admin";
import type { Tone } from "../_components/ui";

/* Coupon helpers shared by the coupons page and its server actions (no "use server" here). */

export const TZ = "Asia/Jerusalem";

export const STATE_META: Record<CouponState, { label: string; tone: Tone }> = {
  active: { label: "פעיל", tone: "green" },
  scheduled: { label: "מתוזמן", tone: "blue" },
  expired: { label: "פג תוקף", tone: "gray" },
  used_up: { label: "נוצל", tone: "purple" },
  disabled: { label: "מושבת", tone: "amber" },
};

export const fmtShekel = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");

export const valueLabel = (type: string, value: number) => (type === "fixed" ? fmtShekel(value) : `${value}%`);

/** "31.12" (or "31.12.27" when not in the current year), Israel time */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.toLocaleDateString("en-CA", { timeZone: TZ }).slice(0, 4);
  const thisYear = new Date().toLocaleDateString("en-CA", { timeZone: TZ }).slice(0, 4);
  const [dd, mm] = [d.toLocaleDateString("en-GB", { timeZone: TZ, day: "2-digit" }), d.toLocaleDateString("en-GB", { timeZone: TZ, month: "2-digit" })];
  return `${Number(dd)}.${mm}${y === thisYear ? "" : "." + y.slice(2)}`;
}

/** Customer-facing sentence parts, e.g. ["קופון WINTER15", "15% הנחה בקנייה מעל ₪300", "בתוקף עד 31.12"] */
export function describeCoupon(c: { code: string; type: string; value: number | null; min_total: number | null; max_discount: number | null; starts_at?: string | null; ends_at?: string | null }): string[] {
  const parts: string[] = [`קופון ${c.code || "—"}`];
  let main = c.value ? `${valueLabel(c.type, c.value)} הנחה` : "הנחה";
  if (c.min_total) main += ` בקנייה מעל ${fmtShekel(c.min_total)}`;
  parts.push(main);
  if (c.type === "percent" && c.max_discount) parts.push(`עד ${fmtShekel(c.max_discount)} הנחה`);
  if (c.starts_at && new Date(c.starts_at) > new Date()) parts.push(`החל מ־${shortDate(c.starts_at)}`);
  if (c.ends_at) parts.push(`בתוקף עד ${shortDate(c.ends_at)}`);
  return parts;
}

/** UTC instant of 00:00 Israel time on a YYYY-MM-DD date */
export function israelDayStart(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
  if (!m) return null;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(guess))
      .map((x) => [x.type, x.value])
  ) as Record<string, string>;
  const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
  return new Date(guess - (local - guess));
}

/** UTC instant of 23:59:59.999 Israel time on a YYYY-MM-DD date */
export function israelDayEnd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
  if (!m) return null;
  const next = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + 1)).toISOString().slice(0, 10);
  const s = israelDayStart(next);
  return s ? new Date(s.getTime() - 1) : null;
}

/** ISO instant → YYYY-MM-DD in Israel time (for <input type="date">) */
export const toIsraelYmd = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ }) : "");
