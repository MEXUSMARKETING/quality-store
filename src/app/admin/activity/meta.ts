import type { ICONS, Tone } from "../_components/ui";

/* Labels shared by the activity page and its CSV export. */

export const ENTITIES: Record<string, { label: string; db: string[] }> = {
  product: { label: "מוצרים", db: ["product"] },
  order: { label: "הזמנות", db: ["order"] },
  customer: { label: "לקוחות", db: ["customer"] },
  coupon: { label: "קופונים", db: ["coupon"] },
  catalog: { label: "קטלוג", db: ["category", "attribute", "review"] },
  content: { label: "תוכן", db: ["homepage", "page", "menu"] },
  automation: { label: "אוטומציות", db: ["automation"] },
  system: { label: "מערכת", db: ["settings", "user"] },
};

export const ENTITY_SINGLE: Record<string, string> = {
  product: "מוצר",
  order: "הזמנה",
  customer: "לקוח",
  coupon: "קופון",
  settings: "הגדרות",
  user: "משתמש",
  category: "קטגוריה",
  attribute: "מאפיין",
  review: "ביקורת",
  homepage: "דף הבית",
  page: "דף",
  menu: "תפריט",
  automation: "אוטומציה",
};

export const ACTIONS: Record<string, { label: string; icon: keyof typeof ICONS; tone: Tone }> = {
  create: { label: "יצירה", icon: "plus", tone: "green" },
  update: { label: "עדכון", icon: "edit", tone: "blue" },
  delete: { label: "מחיקה", icon: "trash", tone: "red" },
  permission: { label: "הרשאות", icon: "shield", tone: "purple" },
  status: { label: "סטטוס", icon: "check", tone: "purple" },
  price: { label: "מחיר", icon: "tag", tone: "amber" },
  stock: { label: "מלאי", icon: "box", tone: "amber" },
  login: { label: "כניסה", icon: "logout", tone: "gray" },
  bulk: { label: "פעולה מרובה", icon: "copy", tone: "blue" },
  settings: { label: "הגדרות", icon: "edit", tone: "gray" },
};

export const RANGES: Record<string, { label: string; days: number | null }> = {
  today: { label: "היום", days: 0 },
  "7d": { label: "7 ימים", days: 7 },
  "30d": { label: "30 יום", days: 30 },
  "90d": { label: "90 יום", days: 90 },
  all: { label: "הכל", days: null },
};

export const FIELD_LABELS: Record<string, string> = {
  name: "שם",
  slug: "כתובת",
  price: "מחיר",
  old_price: "מחיר לפני הנחה",
  cost: "עלות",
  stock: "מלאי",
  active: "פעיל",
  featured: "מומלץ",
  category: "קטגוריה",
  color: "צבע",
  description: "תיאור",
  images: "תמונות",
  status: "סטטוס",
  payment_status: "סטטוס תשלום",
  tracking: "מספר מעקב",
  notes: "הערות",
  tags: "תגיות",
  email: "מייל",
  phone: "טלפון",
  city: "עיר",
  code: "קוד",
  type: "סוג",
  value: "ערך",
  min_total: "מינימום לסל",
  max_discount: "הנחה מקסימלית",
  starts_at: "מתאריך",
  ends_at: "עד תאריך",
  usage_limit: "מגבלת שימושים",
  per_customer: "שימושים ללקוחה",
  sku: "מק״ט",
  low_stock: "סף מלאי נמוך",
  heel: "גובה עקב",
  sort: "סדר",
  seo_title: "כותרת SEO",
  seo_description: "תיאור SEO",
  marketing_consent: "הסכמה לדיוור",
  archived: "בארכיון",
};

const TZ = "Asia/Jerusalem";

/** Start of "today" in Israel, as a UTC instant */
export function israelTodayStart(now = new Date()): Date {
  const ymd = now.toLocaleDateString("en-CA", { timeZone: TZ });
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(new Date(guess))
      .map((x) => [x.type, x.value])
  ) as Record<string, string>;
  const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
  return new Date(guess - (local - guess));
}

export function sinceFor(range: string): Date | null {
  const r = RANGES[range];
  if (!r || r.days === null) return null;
  const today = israelTodayStart();
  return r.days === 0 ? today : new Date(today.getTime() - (r.days - 1) * 24 * 3600 * 1000);
}

/** Human value for the diff table / CSV */
export function fmtValue(field: string, v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "כן" : "לא";
  if ((field.endsWith("_at") || field === "date") && typeof v === "string" && !Number.isNaN(Date.parse(v))) {
    return new Date(v).toLocaleDateString("he-IL", { timeZone: TZ });
  }
  if (["price", "old_price", "cost", "min_total", "max_discount", "total", "subtotal", "discount"].includes(field) && typeof v === "number") {
    return "₪" + v.toLocaleString("he-IL");
  }
  if (Array.isArray(v)) return v.length ? v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ") : "—";
  if (typeof v === "object") {
    return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${k}: ${typeof x === "object" ? JSON.stringify(x) : String(x)}`).join(" · ") || "—";
  }
  return String(v);
}

export function entityHref(entity: string, id: string): string | null {
  if (!id) return null;
  if (entity === "product") return `/admin/products/${id}`;
  if (entity === "order") return `/admin/orders/${id}`;
  if (entity === "customer") return `/admin/customers/${id}`;
  if (entity === "coupon") return `/admin/coupons?edit=${id}`;
  return null;
}
