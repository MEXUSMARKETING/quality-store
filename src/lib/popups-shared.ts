/* Popups: types, templates and validation. Client-safe (no server imports). */

export type PopupTemplate = "welcome" | "club" | "contact" | "sale" | "coupon" | "exit" | "announce";
export type PopupLayout = "center" | "split" | "fullscreen" | "corner" | "bar";
export type PopupTheme = "light" | "dark" | "gold" | "red";
export type PopupTrigger = "delay" | "scroll" | "exit";
export type PopupFrequency = "every" | "session" | "days" | "once";
export type PopupPage = "home" | "shop" | "product" | "cart" | "other";
export type CouponMode = "none" | "always" | "after";

export type PopupConfig = {
  template: PopupTemplate;
  layout: PopupLayout;
  theme: PopupTheme;
  image: string;
  kicker: string;
  title: string;
  text: string;
  fields: { name: boolean; phone: boolean; email: boolean; message: boolean };
  submitText: string;
  consent: boolean;
  coupon: string;
  couponMode: CouponMode;
  ctaText: string;
  ctaHref: string;
  countdown: string; // ISO date-time, "" = none
  successTitle: string;
  successText: string;
  trigger: PopupTrigger;
  delay: number; // seconds
  scroll: number; // percent
  frequency: PopupFrequency;
  days: number;
  pages: PopupPage[];
  devices: "all" | "mobile" | "desktop";
};

export type Popup = {
  id: number;
  name: string;
  active: boolean;
  priority: number;
  config: PopupConfig;
  starts_at: string | null;
  ends_at: string | null;
  views: number;
  clicks: number;
  submits: number;
  created_at: string;
  updated_at: string;
};

/** What the storefront receives: never the coupon code of an "after submit" popup. */
export type PublicPopup = { id: number; config: PopupConfig; hasHiddenCoupon: boolean };

export type PopupLead = {
  id: number;
  popup_id: number;
  name: string;
  phone: string;
  email: string;
  message: string;
  page: string;
  created_at: string;
};

const img = (id: string, w = 1000) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

const BASE: PopupConfig = {
  template: "welcome",
  layout: "center",
  theme: "light",
  image: "",
  kicker: "",
  title: "",
  text: "",
  fields: { name: false, phone: false, email: false, message: false },
  submitText: "שליחה",
  consent: false,
  coupon: "",
  couponMode: "none",
  ctaText: "",
  ctaHref: "",
  countdown: "",
  successTitle: "תודה!",
  successText: "",
  trigger: "delay",
  delay: 6,
  scroll: 40,
  frequency: "days",
  days: 3,
  pages: ["home", "shop", "product"],
  devices: "all",
};

const inDays = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 16);

export const TEMPLATES: Record<PopupTemplate, { label: string; description: string; icon: string; name: string; config: () => PopupConfig }> = {
  welcome: {
    label: "הנחה לקנייה ראשונה",
    description: "תמונה בצד, השארת טלפון וחשיפת קוד קופון אחרי השליחה",
    icon: "gift",
    name: "הנחת הצטרפות",
    config: () => ({
      ...BASE,
      template: "welcome",
      layout: "split",
      theme: "gold",
      image: img("photo-1605733160314-4fc7dac4bb16"),
      kicker: "רק למצטרפות חדשות",
      title: "10% הנחה\nלקנייה הראשונה",
      text: "השאירי טלפון ונשלח לך את קוד ההנחה מיד, יחד עם עדכונים על דגמים חדשים.",
      fields: { name: true, phone: true, email: false, message: false },
      submitText: "לקבלת הקוד",
      consent: true,
      coupon: "WELCOME10",
      couponMode: "after",
      ctaText: "לקנייה עם ההנחה",
      ctaHref: "/shop",
      successTitle: "הקוד שלך מוכן!",
      successText: "הזיני אותו בקופה וההנחה תחושב אוטומטית.",
      delay: 6,
      frequency: "once",
    }),
  },
  club: {
    label: "הצטרפות למועדון",
    description: "שם, טלפון ומייל — נשמרים ישירות למועדון הלקוחות",
    icon: "heart",
    name: "מועדון לקוחות",
    config: () => ({
      ...BASE,
      template: "club",
      layout: "center",
      theme: "dark",
      image: img("photo-1617038220319-276d3cfab638", 900),
      kicker: "מועדון הלקוחות של Quality",
      title: "5% הנחה בהצטרפות",
      text: "הטבות קבועות, הקדמה למבצעים ועדכון ראשון על קולקציות חדשות.",
      fields: { name: true, phone: true, email: true, message: false },
      submitText: "הצטרפות למועדון",
      consent: true,
      coupon: "QUALITY5",
      couponMode: "after",
      successTitle: "ברוכה הבאה למועדון!",
      successText: "הנה קוד ההטבה שלך לקנייה הבאה.",
      delay: 12,
      frequency: "days",
      days: 7,
    }),
  },
  contact: {
    label: "טופס יצירת קשר",
    description: "שם, טלפון והודעה — מגיע ישר לרשימת הפניות במערכת",
    icon: "mail",
    name: "יצירת קשר",
    config: () => ({
      ...BASE,
      template: "contact",
      layout: "corner",
      theme: "light",
      kicker: "שירות אישי",
      title: "צריכה עזרה בבחירת מידה?",
      text: "השאירי פרטים ונחזור אלייך בוואטסאפ תוך זמן קצר.",
      fields: { name: true, phone: true, email: false, message: true },
      submitText: "שליחה",
      successTitle: "קיבלנו!",
      successText: "נחזור אלייך בהקדם.",
      trigger: "delay",
      delay: 25,
      pages: ["product"],
      frequency: "session",
    }),
  },
  sale: {
    label: "מבצע עם ספירה לאחור",
    description: "באנר גדול על כל המסך, כפתור למבצע ושעון שסופר עד הסוף",
    icon: "percent",
    name: "OUTLET",
    config: () => ({
      ...BASE,
      template: "sale",
      layout: "fullscreen",
      theme: "red",
      image: img("photo-1551489186-ccb95a1ea6a3", 1400),
      kicker: "OUTLET",
      title: "עד 60% הנחה",
      text: "על מגפונים, נעלי עקב ותיקים נבחרים. המלאי מוגבל.",
      ctaText: "לכל המבצעים",
      ctaHref: "/shop?sort=discount",
      countdown: inDays(3),
      delay: 3,
      frequency: "session",
      pages: ["home"],
    }),
  },
  coupon: {
    label: "קוד קופון",
    description: "מציג קוד הנחה עם כפתור העתקה וקישור לקנייה",
    icon: "tag",
    name: "קופון מיוחד",
    config: () => ({
      ...BASE,
      template: "coupon",
      layout: "center",
      theme: "gold",
      kicker: "הפתעה בשבילך",
      title: "₪30 הנחה על ההזמנה",
      text: "בקנייה מעל ₪250. העתיקי את הקוד והזיני אותו בקופה.",
      coupon: "SAVE30",
      couponMode: "always",
      ctaText: "לקנייה",
      ctaHref: "/shop",
      delay: 8,
      frequency: "days",
      days: 2,
    }),
  },
  exit: {
    label: "לפני שעוזבים",
    description: "נפתח כשהגולשת עומדת לצאת מהאתר, עם הנחה אחרונה",
    icon: "logout",
    name: "יציאה מהאתר",
    config: () => ({
      ...BASE,
      template: "exit",
      layout: "split",
      theme: "dark",
      image: img("photo-1624687943971-e86af76d57de"),
      kicker: "רגע לפני שהולכת…",
      title: "קבלי 15% הנחה\nעל ההזמנה הזו",
      text: "השאירי טלפון והקוד יופיע כאן מיד. בתוקף ל־24 שעות.",
      fields: { name: false, phone: true, email: false, message: false },
      submitText: "חשיפת הקוד",
      consent: true,
      coupon: "STAY15",
      couponMode: "after",
      ctaText: "המשך לקופה",
      ctaHref: "/cart",
      successTitle: "הנה ההנחה שלך",
      successText: "הזיני את הקוד בקופה.",
      trigger: "exit",
      frequency: "days",
      days: 3,
      pages: ["shop", "product", "cart"],
    }),
  },
  announce: {
    label: "הודעה קצרה",
    description: "פס או חלונית קטנה בפינה עם הודעה וקישור, בלי להסתיר את האתר",
    icon: "zap",
    name: "משלוח חינם",
    config: () => ({
      ...BASE,
      template: "announce",
      layout: "bar",
      theme: "dark",
      title: "משלוח חינם עד הבית",
      text: "ותשלום במזומן בעת המסירה.",
      ctaText: "לקולקציה",
      ctaHref: "/shop",
      trigger: "scroll",
      scroll: 25,
      frequency: "session",
      pages: ["home", "shop", "product"],
    }),
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as PopupTemplate[];

export const LAYOUTS: Record<PopupLayout, string> = {
  center: "חלון במרכז",
  split: "חלון עם תמונה בצד",
  fullscreen: "באנר גדול",
  corner: "חלונית בפינה",
  bar: "פס בתחתית",
};

export const THEMES: Record<PopupTheme, { label: string; bg: string; fg: string; muted: string; accent: string; accentFg: string; field: string; fieldBorder: string; kicker: string }> = {
  light: { label: "לבן", bg: "#FFFFFF", fg: "#141414", muted: "#5F5E5A", accent: "#141414", accentFg: "#FFFFFF", field: "#F6F5F2", fieldBorder: "#E2DFD8", kicker: "#7A5A12" },
  dark: { label: "שחור וזהב", bg: "#0E0E0E", fg: "#FFFFFF", muted: "#BDB9AF", accent: "#C9A24A", accentFg: "#141414", field: "#1A1A1A", fieldBorder: "#3A3833", kicker: "#C9A24A" },
  gold: { label: "שמנת וזהב", bg: "#F4EBD6", fg: "#141414", muted: "#5A4F3A", accent: "#141414", accentFg: "#FFFFFF", field: "#FFFFFF", fieldBorder: "#E3D5B5", kicker: "#7A5A12" },
  red: { label: "אדום מבצע", bg: "#D21F2A", fg: "#FFFFFF", muted: "#FFE1E1", accent: "#FFFFFF", accentFg: "#D21F2A", field: "rgba(255,255,255,.12)", fieldBorder: "rgba(255,255,255,.35)", kicker: "#FFFFFF" },
};

export const TRIGGERS: Record<PopupTrigger, string> = {
  delay: "אחרי זמן בעמוד",
  scroll: "אחרי גלילה",
  exit: "ביציאה מהאתר",
};

export const FREQUENCIES: Record<PopupFrequency, string> = {
  every: "בכל כניסה לעמוד",
  session: "פעם אחת בכל ביקור",
  days: "פעם בכמה ימים",
  once: "פעם אחת בלבד",
};

export const PAGES: Record<PopupPage, string> = {
  home: "דף הבית",
  shop: "קטגוריות וחיפוש",
  product: "דפי מוצר",
  cart: "סל וקופה",
  other: "שאר הדפים",
};

export const DEVICES: Record<PopupConfig["devices"], string> = { all: "מחשב ונייד", desktop: "מחשב בלבד", mobile: "נייד בלבד" };

const str = (v: unknown, max: number, d = "") => (typeof v === "string" ? v.slice(0, max) : d);
const num = (v: unknown, min: number, max: number, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : d;
};
const pick = <T extends string>(v: unknown, keys: readonly T[], d: T): T => (keys.includes(v as T) ? (v as T) : d);
const safeHref = (h: string) => (/^(\/(?!\/)|https?:\/\/|#)/.test(h) ? h : "");
const safeImg = (h: string) => (/^(\/(?!\/)|https:\/\/)/.test(h) ? h : "");

/** Clean any stored/submitted value into a complete config (missing keys take the template's defaults). */
export function normalizeConfig(raw: unknown): PopupConfig {
  const x = (raw && typeof raw === "object" ? raw : {}) as Record<string, any>;
  const template = pick(x.template, TEMPLATE_KEYS, "welcome");
  const d = TEMPLATES[template].config();
  const f = x.fields && typeof x.fields === "object" ? x.fields : d.fields;
  const pages = Array.isArray(x.pages) ? (x.pages.filter((p: unknown) => (Object.keys(PAGES) as string[]).includes(String(p))) as PopupPage[]) : d.pages;
  return {
    template,
    layout: pick(x.layout, Object.keys(LAYOUTS) as PopupLayout[], d.layout),
    theme: pick(x.theme, Object.keys(THEMES) as PopupTheme[], d.theme),
    image: safeImg(str(x.image, 600, d.image).trim()),
    kicker: str(x.kicker, 80, d.kicker),
    title: str(x.title, 140, d.title),
    text: str(x.text, 500, d.text),
    fields: { name: !!f.name, phone: !!f.phone, email: !!f.email, message: !!f.message },
    submitText: str(x.submitText, 40, d.submitText) || "שליחה",
    consent: x.consent === undefined ? d.consent : !!x.consent,
    coupon: str(x.coupon, 32, d.coupon).trim().toUpperCase(),
    couponMode: pick(x.couponMode, ["none", "always", "after"] as const, d.couponMode),
    ctaText: str(x.ctaText, 40, d.ctaText),
    ctaHref: safeHref(str(x.ctaHref, 300, d.ctaHref).trim()),
    countdown: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(x.countdown || "")) ? String(x.countdown).slice(0, 25) : "",
    successTitle: str(x.successTitle, 80, d.successTitle),
    successText: str(x.successText, 300, d.successText),
    trigger: pick(x.trigger, Object.keys(TRIGGERS) as PopupTrigger[], d.trigger),
    delay: num(x.delay, 0, 300, d.delay),
    scroll: num(x.scroll, 5, 95, d.scroll),
    frequency: pick(x.frequency, Object.keys(FREQUENCIES) as PopupFrequency[], d.frequency),
    days: num(x.days, 1, 365, d.days),
    pages: pages.length ? pages : d.pages,
    devices: pick(x.devices, ["all", "mobile", "desktop"] as const, d.devices),
  };
}

export const hasForm = (c: PopupConfig) => c.fields.name || c.fields.phone || c.fields.email || c.fields.message;

/** Which page group a storefront path belongs to. */
export function pageGroup(path: string): PopupPage {
  if (path === "/" || path === "") return "home";
  if (path.startsWith("/shop")) return "shop";
  if (path.startsWith("/product/")) return "product";
  if (path.startsWith("/cart") || path.startsWith("/checkout")) return "cart";
  return "other";
}

export type PopupStatus = "active" | "paused" | "scheduled" | "ended";
export function popupStatus(p: Pick<Popup, "active" | "starts_at" | "ends_at">, now = Date.now()): PopupStatus {
  if (!p.active) return "paused";
  if (p.starts_at && new Date(p.starts_at).getTime() > now) return "scheduled";
  if (p.ends_at && new Date(p.ends_at).getTime() < now) return "ended";
  return "active";
}
