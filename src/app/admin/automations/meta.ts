/* Automations – pure data and helpers shared by the server engine (src/lib/automations.ts),
   the admin page and the client-side builder. No server imports here. */

export type TriggerKey =
  | "order_created"
  | "order_status_changed"
  | "order_delivered"
  | "customer_created"
  | "birthday"
  | "inactive_customer"
  | "coupon_expiring";

export type TriggerConfig = { status?: string; days?: number };

export const TRIGGERS: Record<TriggerKey, { label: string; desc: string; daily: boolean; order: boolean; icon: "bag" | "check" | "users" | "heart" | "clock" | "tag" }> = {
  order_created: { label: "הזמנה חדשה", desc: "מיד כשהזמנה נקלטת באתר או נוצרת ידנית", daily: false, order: true, icon: "bag" },
  order_status_changed: { label: "שינוי סטטוס הזמנה", desc: "כשמנהל משנה סטטוס (אפשר לבחור סטטוס מסוים)", daily: false, order: true, icon: "check" },
  order_delivered: { label: "הזמנה נמסרה", desc: "כשהזמנה מסומנת \"נמסרה\"", daily: false, order: true, icon: "check" },
  customer_created: { label: "לקוחה חדשה", desc: "כשלקוחה נוספת בפעם הראשונה (הזמנה ראשונה או הצטרפות למועדון)", daily: false, order: false, icon: "users" },
  birthday: { label: "יום הולדת", desc: "ביום ההולדת של הלקוחה (אם הוזן תאריך לידה בכרטיס הלקוחה)", daily: true, order: false, icon: "heart" },
  inactive_customer: { label: "לקוחה לא פעילה", desc: "כשעברו N ימים מההזמנה האחרונה", daily: true, order: false, icon: "clock" },
  coupon_expiring: { label: "קופון עומד לפוג", desc: "N ימים לפני שקופון אישי שנוצר באוטומציה פג – אם עוד לא מומש", daily: true, order: false, icon: "tag" },
};

export const ORDER_STATUSES: Record<string, string> = {
  confirmed: "אושרה",
  packed: "נארזה",
  shipped: "נשלחה",
  delivered: "נמסרה",
  cancelled: "בוטלה",
  returned: "הוחזרה",
};

/* ---------------- conditions ---------------- */

export type CondField = "order_total" | "orders_count" | "spent" | "tags" | "city" | "consent";
export type CondOp = "gt" | "gte" | "lt" | "lte" | "eq" | "neq" | "has" | "not_has" | "contains" | "is_yes" | "is_no";
export type Condition = { field: CondField; op: CondOp; value: string };

export const COND_FIELDS: Record<CondField, { label: string; ops: CondOp[]; kind: "number" | "text" | "bool"; orderOnly?: boolean; unit?: string }> = {
  order_total: { label: "סכום ההזמנה", ops: ["gte", "gt", "lte", "lt", "eq"], kind: "number", orderOnly: true, unit: "₪" },
  orders_count: { label: "מספר ההזמנות של הלקוחה", ops: ["eq", "gte", "gt", "lte", "lt"], kind: "number" },
  spent: { label: "סך הקניות של הלקוחה", ops: ["gte", "gt", "lte", "lt"], kind: "number", unit: "₪" },
  tags: { label: "תגית לקוחה", ops: ["has", "not_has"], kind: "text" },
  city: { label: "עיר", ops: ["eq", "neq", "contains"], kind: "text" },
  consent: { label: "אישור דיוור שיווקי", ops: ["is_yes", "is_no"], kind: "bool" },
};

export const OPS: Record<CondOp, string> = {
  gt: "גדול מ־",
  gte: "לפחות",
  lt: "קטן מ־",
  lte: "לכל היותר",
  eq: "שווה ל־",
  neq: "שונה מ־",
  has: "כוללת",
  not_has: "לא כוללת",
  contains: "מכילה",
  is_yes: "אישרה",
  is_no: "לא אישרה",
};

export function describeCondition(c: Condition): string {
  const f = COND_FIELDS[c.field];
  if (!f) return "";
  if (f.kind === "bool") return `${f.label}: ${OPS[c.op]}`;
  return `${f.label} ${OPS[c.op] || c.op} ${f.unit === "₪" ? "₪" : ""}${c.value}`;
}

/* ---------------- actions ---------------- */

export type ActionType = "send_whatsapp" | "send_email" | "send_sms" | "add_customer_tag" | "create_coupon" | "admin_notification";
export type Action = {
  type: ActionType;
  message?: string;
  subject?: string;
  tag?: string;
  coupon_type?: "percent" | "fixed";
  coupon_value?: number;
  coupon_days?: number;
  coupon_min_total?: number;
  coupon_prefix?: string;
};

export const ACTION_META: Record<ActionType, { label: string; channel?: "whatsapp" | "email" | "sms"; message: boolean; icon: "mail" | "tag" | "zap" | "alert" | "users" }> = {
  send_whatsapp: { label: "שליחת וואטסאפ", channel: "whatsapp", message: true, icon: "mail" },
  send_email: { label: "שליחת מייל", channel: "email", message: true, icon: "mail" },
  send_sms: { label: "שליחת SMS", channel: "sms", message: true, icon: "mail" },
  create_coupon: { label: "יצירת קופון אישי", message: false, icon: "tag" },
  add_customer_tag: { label: "הוספת תגית ללקוחה", message: false, icon: "users" },
  admin_notification: { label: "התראה למנהל (ביומן הפעילות)", message: true, icon: "alert" },
};

export function describeAction(a: Action): string {
  const m = ACTION_META[a.type];
  if (!m) return a.type;
  if (a.type === "create_coupon") return `קופון ${a.coupon_type === "fixed" ? `₪${a.coupon_value}` : `${a.coupon_value}%`} ל־${a.coupon_days} ימים`;
  if (a.type === "add_customer_tag") return `תגית "${a.tag}"`;
  return m.label;
}

/* ---------------- message variables ---------------- */

export const VARIABLES: { token: string; label: string; sample: string }[] = [
  { token: "{שם}", label: "שם פרטי", sample: "מאיה" },
  { token: "{הזמנה}", label: "מספר הזמנה", sample: "Q1042" },
  { token: "{סכום}", label: "סכום ההזמנה", sample: "₪389" },
  { token: "{קופון}", label: "קוד קופון", sample: "BDAY-7KQ2MX" },
  { token: "{קישור}", label: "קישור", sample: "https://quality-store.co.il/order/Q1042" },
];

export type Vars = { name: string; order: string; amount: string; coupon: string; link: string };

export function renderTemplate(text: string, v: Vars): string {
  return String(text || "")
    .replace(/\{שם\}/g, v.name)
    .replace(/\{הזמנה\}/g, v.order)
    .replace(/\{סכום\}/g, v.amount)
    .replace(/\{קופון\}/g, v.coupon)
    .replace(/\{קישור\}/g, v.link);
}

export const SAMPLE_VARS: Vars = { name: "מאיה", order: "Q1042", amount: "₪389", coupon: "BDAY-7KQ2MX", link: "https://quality-store.co.il/order/Q1042" };

/* ---------------- run statuses ---------------- */

export const RUN_STATUS: Record<string, { label: string; tone: "green" | "amber" | "red" | "blue" | "gray" | "purple" }> = {
  scheduled: { label: "מתוזמן", tone: "blue" },
  running: { label: "בריצה", tone: "purple" },
  success: { label: "בוצע", tone: "green" },
  partial: { label: "בוצע חלקית", tone: "amber" },
  skipped: { label: "דולג", tone: "gray" },
  failed: { label: "נכשל", tone: "red" },
  cancelled: { label: "בוטל", tone: "gray" },
};

export type ActionResult = { type: ActionType; status: "sent" | "done" | "skipped" | "failed"; detail: string; coupon?: string };

/* ---------------- rule draft + validation ---------------- */

export type RuleDraft = {
  id: number | null;
  name: string;
  trigger: TriggerKey;
  trigger_config: TriggerConfig;
  conditions: Condition[];
  actions: Action[];
  delay_minutes: number;
};

export const DELAYS: { minutes: number; label: string }[] = [
  { minutes: 0, label: "מיד" },
  { minutes: 60, label: "אחרי שעה" },
  { minutes: 180, label: "אחרי 3 שעות" },
  { minutes: 1440, label: "אחרי יום" },
  { minutes: 2880, label: "אחרי יומיים" },
  { minutes: 4320, label: "אחרי 3 ימים" },
  { minutes: 10080, label: "אחרי שבוע" },
  { minutes: 20160, label: "אחרי שבועיים" },
];

export const delayLabel = (m: number) => DELAYS.find((d) => d.minutes === m)?.label || (m ? `אחרי ${m} דקות` : "מיד");

const clampInt = (v: unknown, min: number, max: number, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : def;
};

/** Validate and normalise a rule coming from the builder. Returns a Hebrew error or the clean rule. */
export function validateRule(raw: any): { rule?: RuleDraft; error?: string } {
  if (!raw || typeof raw !== "object") return { error: "נתוני האוטומציה לא תקינים" };
  const name = String(raw.name || "").trim().slice(0, 120);
  if (!name) return { error: "יש לתת שם לאוטומציה" };
  const trigger = String(raw.trigger || "") as TriggerKey;
  if (!TRIGGERS[trigger]) return { error: "יש לבחור טריגר" };
  const cfgIn = raw.trigger_config || {};
  const trigger_config: TriggerConfig = {};
  if (trigger === "order_status_changed") {
    const st = String(cfgIn.status || "");
    if (st && !ORDER_STATUSES[st]) return { error: "הסטטוס שנבחר לא תקין" };
    if (st) trigger_config.status = st;
  }
  if (trigger === "inactive_customer") trigger_config.days = clampInt(cfgIn.days, 14, 730, 90);
  if (trigger === "coupon_expiring") trigger_config.days = clampInt(cfgIn.days, 1, 30, 3);

  const conditions: Condition[] = [];
  for (const c of Array.isArray(raw.conditions) ? raw.conditions.slice(0, 10) : []) {
    const field = String(c?.field || "") as CondField;
    const f = COND_FIELDS[field];
    if (!f) return { error: "אחד התנאים לא תקין" };
    const op = String(c?.op || "") as CondOp;
    if (!f.ops.includes(op)) return { error: `תנאי "${f.label}": יש לבחור השוואה` };
    if (f.orderOnly && !TRIGGERS[trigger].order) return { error: `התנאי "${f.label}" זמין רק בטריגרים של הזמנה` };
    let value = String(c?.value ?? "").trim().slice(0, 80);
    if (f.kind === "number") {
      const n = Number(value);
      if (value === "" || !Number.isFinite(n) || n < 0) return { error: `תנאי "${f.label}": יש להזין מספר` };
      value = String(Math.round(n));
    } else if (f.kind === "text" && !value) return { error: `תנאי "${f.label}": יש להזין ערך` };
    if (f.kind === "bool") value = "";
    conditions.push({ field, op, value });
  }

  const actions: Action[] = [];
  const list = Array.isArray(raw.actions) ? raw.actions.slice(0, 6) : [];
  if (!list.length) return { error: "יש להוסיף לפחות פעולה אחת" };
  for (const a of list) {
    const type = String(a?.type || "") as ActionType;
    const m = ACTION_META[type];
    if (!m) return { error: "אחת הפעולות לא תקינה" };
    const out: Action = { type };
    if (m.message) {
      out.message = String(a.message || "").trim().slice(0, 1000);
      if (!out.message) return { error: `${m.label}: יש לכתוב הודעה` };
    }
    if (type === "send_email") {
      out.subject = String(a.subject || "").trim().slice(0, 150);
      if (!out.subject) return { error: "שליחת מייל: יש לכתוב נושא" };
    }
    if (type === "add_customer_tag") {
      out.tag = String(a.tag || "").trim().slice(0, 40);
      if (!out.tag) return { error: "הוספת תגית: יש לכתוב את התגית" };
    }
    if (type === "create_coupon") {
      out.coupon_type = a.coupon_type === "fixed" ? "fixed" : "percent";
      out.coupon_value = Math.round(Number(a.coupon_value));
      if (!Number.isFinite(out.coupon_value) || out.coupon_value < 1) return { error: "קופון: יש להזין גובה הנחה" };
      if (out.coupon_type === "percent" && out.coupon_value > 100) return { error: "קופון: אחוז ההנחה צריך להיות בין 1 ל־100" };
      if (out.coupon_type === "fixed" && out.coupon_value > 5000) return { error: "קופון: סכום ההנחה גבוה מדי" };
      out.coupon_days = clampInt(a.coupon_days, 1, 365, 14);
      out.coupon_min_total = clampInt(a.coupon_min_total, 0, 100000, 0);
      out.coupon_prefix = String(a.coupon_prefix || "Q").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "Q";
    }
    actions.push(out);
  }
  if (actions.filter((a) => a.type === "create_coupon").length > 1) return { error: "אפשר ליצור קופון אחד בכל אוטומציה" };
  const usesCoupon = actions.some((a) => /\{קופון\}/.test((a.message || "") + (a.subject || "")));
  if (usesCoupon && trigger !== "coupon_expiring" && !actions.some((a) => a.type === "create_coupon"))
    return { error: "ההודעה משתמשת ב־{קופון} אבל אין פעולת \"יצירת קופון אישי\"" };
  const delay_minutes = DELAYS.some((d) => d.minutes === Number(raw.delay_minutes)) ? Number(raw.delay_minutes) : 0;
  const id = Number(raw.id);
  return { rule: { id: Number.isInteger(id) && id > 0 ? id : null, name, trigger, trigger_config, conditions, actions, delay_minutes } };
}

/** True for triggers that are marketing by nature (not about an order the customer placed). */
export const isMarketingTrigger = (t: TriggerKey) => ["customer_created", "birthday", "inactive_customer", "coupon_expiring"].includes(t);

/* ---------------- templates gallery ---------------- */

const CONSENT: Condition = { field: "consent", op: "is_yes", value: "" };

export const TEMPLATES: { key: string; title: string; desc: string; rule: Omit<RuleDraft, "id"> }[] = [
  {
    key: "welcome",
    title: "ברוכה הבאה",
    desc: "הודעת היכרות ללקוחה חדשה שאישרה דיוור",
    rule: {
      name: "ברוכה הבאה ללקוחה חדשה",
      trigger: "customer_created",
      trigger_config: {},
      conditions: [CONSENT],
      delay_minutes: 0,
      actions: [{ type: "send_whatsapp", message: "היי {שם}, ברוכה הבאה ל־Quality טמרה! 👢 שמחות שהצטרפת. כל הדגמים והמידות מחכים לך כאן: {קישור}" }],
    },
  },
  {
    key: "thanks",
    title: "תודה על ההזמנה",
    desc: "אישור מיידי עם מספר הזמנה, סכום וקישור",
    rule: {
      name: "תודה על ההזמנה",
      trigger: "order_created",
      trigger_config: {},
      conditions: [],
      delay_minutes: 0,
      actions: [
        { type: "send_whatsapp", message: "תודה {שם}! קיבלנו את הזמנה {הזמנה} על סך {סכום}. נחזור אלייך בקרוב לתיאום. פרטי ההזמנה: {קישור}" },
        { type: "send_email", subject: "קיבלנו את הזמנה {הזמנה}", message: "היי {שם},\n\nתודה שקנית ב־Quality! הזמנה {הזמנה} על סך {סכום} התקבלה ונחזור אלייך בקרוב לתיאום המשלוח.\n\nפרטי ההזמנה: {קישור}\n\nQuality טמרה" },
      ],
    },
  },
  {
    key: "shipped",
    title: "ההזמנה יצאה לדרך",
    desc: "עדכון כשהזמנה מסומנת \"נשלחה\"",
    rule: {
      name: "עדכון משלוח",
      trigger: "order_status_changed",
      trigger_config: { status: "shipped" },
      conditions: [],
      delay_minutes: 0,
      actions: [{ type: "send_whatsapp", message: "{שם}, הזמנה {הזמנה} יצאה אלייך! 🚚 פרטים: {קישור}" }],
    },
  },
  {
    key: "birthday",
    title: "קופון יום הולדת",
    desc: "קופון אישי של 15% ל־14 יום ביום ההולדת",
    rule: {
      name: "קופון יום הולדת",
      trigger: "birthday",
      trigger_config: {},
      conditions: [CONSENT],
      delay_minutes: 0,
      actions: [
        { type: "create_coupon", coupon_type: "percent", coupon_value: 15, coupon_days: 14, coupon_min_total: 0, coupon_prefix: "BDAY" },
        { type: "send_whatsapp", message: "יום הולדת שמח {שם}! 🎉 מתנה מאיתנו: 15% הנחה עם הקוד {קופון}, בתוקף לשבועיים. {קישור}" },
      ],
    },
  },
  {
    key: "winback",
    title: "החזרת לקוחות (90 יום)",
    desc: "קופון 10% ללקוחה שלא הזמינה 90 יום",
    rule: {
      name: "מתגעגעות אלייך – 90 יום",
      trigger: "inactive_customer",
      trigger_config: { days: 90 },
      conditions: [CONSENT],
      delay_minutes: 0,
      actions: [
        { type: "create_coupon", coupon_type: "percent", coupon_value: 10, coupon_days: 21, coupon_min_total: 0, coupon_prefix: "BACK" },
        { type: "send_whatsapp", message: "היי {שם}, מזמן לא ראינו אותך 💛 הגיעו דגמים חדשים! הנה 10% הנחה עם הקוד {קופון} ל־3 שבועות: {קישור}" },
        { type: "add_customer_tag", tag: "win-back" },
      ],
    },
  },
  {
    key: "reminder",
    title: "תזכורת לפני שהקופון פג",
    desc: "3 ימים לפני שקופון אישי פג, אם לא מומש",
    rule: {
      name: "תזכורת קופון",
      trigger: "coupon_expiring",
      trigger_config: { days: 3 },
      conditions: [CONSENT],
      delay_minutes: 0,
      actions: [{ type: "send_whatsapp", message: "{שם}, תזכורת קטנה: הקופון {קופון} שלך בתוקף רק עוד 3 ימים ⏳ {קישור}" }],
    },
  },
];
