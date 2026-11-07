import { DEFAULT_CONFIG, EMPTY_SCOPE, type PromoConfig, type PromoScope, type PromoType } from "@/lib/promotions-shared";

/* Quick-start templates for the promotions page (pure data; also used by the editor). */

export type Preset = { key: string; title: string; text: string; name: string; type: PromoType; config: PromoConfig };

const c = (x: Partial<PromoConfig>): PromoConfig => ({ ...DEFAULT_CONFIG, ...x });

export const PRESETS: Preset[] = [
  { key: "1plus1", title: "1+1", text: "קני זוג וקבלי עוד אחד בחינם (על הזול מביניהם)", name: "1+1", type: "bxgy", config: c({ buy: 1, get: 1, getPercent: 100 }) },
  { key: "second50", title: "השני בחצי מחיר", text: "הפריט השני ב-50% הנחה", name: "השני ב-50%", type: "bxgy", config: c({ buy: 1, get: 1, getPercent: 50 }) },
  { key: "2plus1", title: "2+1", text: "קני 2 וקבלי את השלישי בחינם", name: "2+1", type: "bxgy", config: c({ buy: 2, get: 1, getPercent: 100 }) },
  { key: "bundle", title: "2 ב-₪300", text: "חבילה במחיר קבוע", name: "2 זוגות ב-₪300", type: "bundle", config: c({ qty: 2, price: 300 }) },
  { key: "tiers", title: "ככל שקונים יותר", text: "2 פריטים 10%, 3 פריטים ומעלה 20%", name: "מדרגות הנחה", type: "tiers", config: c({ tiers: [{ qty: 2, percent: 10 }, { qty: 3, percent: 20 }] }) },
  { key: "percent", title: "אחוז הנחה", text: "15% הנחה על קטגוריה או מוצרים", name: "15% הנחה", type: "percent", config: c({ mode: "percent", percent: 15 }) },
  { key: "spend", title: "קני ב-₪500, קבלי ₪50", text: "הנחה כשסכום הקנייה עובר סף", name: "₪50 הנחה מעל ₪500", type: "spend", config: c({ min: 500, mode: "amount", amount: 50 }) },
  { key: "cross", title: "קני מגפון, קבלי תיק בהנחה", text: "פריט מקטגוריה אחרת בהנחה", name: "מגפון + תיק ב-50%", type: "bxgy", config: c({ buy: 1, get: 1, getPercent: 50, target: { mode: "categories", categories: ["bags"], products: [], exclude: [], excludeSale: false } }) },
];

/** Starting values for a new promotion (kept here, not in the client editor, so server pages can use them). */
export const NEW_DEFAULTS: { name: string; type: PromoType; badge: string; scope: PromoScope; config: PromoConfig; starts_at: string; ends_at: string; active: boolean; allow_coupon: boolean } = {
  name: "",
  type: "bxgy",
  badge: "",
  scope: EMPTY_SCOPE,
  config: DEFAULT_CONFIG,
  starts_at: "",
  ends_at: "",
  active: true,
  allow_coupon: true,
};
