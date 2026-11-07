/* Automatic promotions (מבצעים): types, labels and the pricing engine.
   Pure code with no server imports, so the admin editor can run the same engine in the browser
   for its live simulator. The authoritative calculation always runs on the server (priceCart in
   ./promotions.ts and placeOrder), never trusting prices or discounts sent by the browser.

   How the engine chooses: every promotion is evaluated against the units still available in the
   cart; the one that saves the customer the most is applied first and the units it used are taken
   out; repeat until nothing more applies. So one pair of boots is never discounted twice, and when
   two deals overlap the customer automatically gets the better one. */

export type PromoType = "bxgy" | "percent" | "tiers" | "bundle" | "spend";

export type PromoScope = {
  mode: "all" | "categories" | "products";
  categories: string[];
  products: number[];
  exclude: number[];
  /** leave out products that already have a reduced price (old_price) */
  excludeSale: boolean;
};

export type Tier = { qty: number; percent: number };

export type PromoConfig = {
  // bxgy: buy `buy`, get `get` at `getPercent`% off (100 = free); target null = same products
  buy: number;
  get: number;
  getPercent: number;
  target: PromoScope | null;
  maxTimes: number | null;
  // percent & spend: discount mode
  mode: "percent" | "amount";
  percent: number;
  amount: number;
  // tiers
  tiers: Tier[];
  // bundle: `qty` items for ₪`price`
  qty: number;
  price: number;
  // spend: eligible subtotal at least ₪`min`
  min: number;
};

export type Promotion = {
  id: number;
  name: string;
  type: PromoType;
  scope: PromoScope;
  config: PromoConfig;
  starts_at: string | null;
  ends_at: string | null;
  active: boolean;
  allow_coupon: boolean;
  badge: string;
  created_at?: string;
  updated_at?: string;
};

export type PromoState = "active" | "scheduled" | "expired" | "disabled";

export const TYPE_META: Record<PromoType, { label: string; short: string; help: string }> = {
  bxgy: { label: "קני וקבלי (1+1, 2+1…)", short: "קני וקבלי", help: "קני כמות מסוימת וקבלי פריט נוסף בחינם או בהנחה" },
  percent: { label: "הנחה על מוצרים", short: "הנחה", help: "אחוז או סכום הנחה קבוע על כל פריט במבצע" },
  tiers: { label: "מדרגות כמות", short: "מדרגות", help: "ככל שקונים יותר, ההנחה גדלה (2 פריטים 10%, 3 פריטים 20%…)" },
  bundle: { label: "חבילה במחיר", short: "חבילה", help: "מספר פריטים במחיר קבוע, למשל 2 ב-₪300" },
  spend: { label: "קני ב- וקבלי הנחה", short: "סכום קנייה", help: "הנחה אוטומטית כשסכום הפריטים במבצע עובר סף" },
};

export const EMPTY_SCOPE: PromoScope = { mode: "all", categories: [], products: [], exclude: [], excludeSale: false };

export const DEFAULT_CONFIG: PromoConfig = {
  buy: 1,
  get: 1,
  getPercent: 100,
  target: null,
  maxTimes: null,
  mode: "percent",
  percent: 15,
  amount: 50,
  tiers: [
    { qty: 2, percent: 10 },
    { qty: 3, percent: 20 },
  ],
  qty: 2,
  price: 300,
  min: 500,
};

/* ---------------- normalisation (also used to validate admin input) ---------------- */

const int = (v: unknown, lo: number, hi: number, d: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
};
const ids = (v: unknown) => (Array.isArray(v) ? Array.from(new Set(v.map((x) => Math.round(Number(x))).filter((x) => x > 0))).slice(0, 500) : []);
const keys = (v: unknown) => (Array.isArray(v) ? Array.from(new Set(v.map((x) => String(x).slice(0, 60)).filter(Boolean))).slice(0, 100) : []);

export function normScope(v: any): PromoScope {
  const mode = v?.mode === "categories" || v?.mode === "products" ? v.mode : "all";
  return { mode, categories: keys(v?.categories), products: ids(v?.products), exclude: ids(v?.exclude), excludeSale: !!v?.excludeSale };
}

export function normConfig(v: any): PromoConfig {
  const c = v || {};
  const tiers = (Array.isArray(c.tiers) ? c.tiers : [])
    .map((t: any) => ({ qty: int(t?.qty, 2, 20, 2), percent: int(t?.percent, 1, 90, 10) }))
    .sort((a: Tier, b: Tier) => a.qty - b.qty)
    .filter((t: Tier, i: number, arr: Tier[]) => i === 0 || t.qty !== arr[i - 1].qty)
    .slice(0, 6);
  return {
    buy: int(c.buy, 1, 10, 1),
    get: int(c.get, 1, 10, 1),
    getPercent: int(c.getPercent, 1, 100, 100),
    target: c.target ? normScope(c.target) : null,
    maxTimes: c.maxTimes === null || c.maxTimes === undefined || c.maxTimes === "" ? null : int(c.maxTimes, 1, 50, 1),
    mode: c.mode === "amount" ? "amount" : "percent",
    percent: int(c.percent, 1, 90, 15),
    amount: int(c.amount, 1, 100000, 50),
    tiers: tiers.length ? tiers : DEFAULT_CONFIG.tiers,
    qty: int(c.qty, 2, 20, 2),
    price: int(c.price, 1, 100000, 300),
    min: int(c.min, 1, 1000000, 500),
  };
}

export function promoState(p: Pick<Promotion, "active" | "starts_at" | "ends_at">, now = new Date()): PromoState {
  if (!p.active) return "disabled";
  if (p.starts_at && new Date(p.starts_at) > now) return "scheduled";
  if (p.ends_at && new Date(p.ends_at) < now) return "expired";
  return "active";
}

/* ---------------- labels ---------------- */

const sh = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");
const items = (n: number) => (n === 1 ? "פריט אחד" : `${n} פריטים`);

/** Short badge for product cards, e.g. "1+1", "השני ב-50%", "-15%", "2 ב-₪300". */
export function autoBadge(type: PromoType, c: PromoConfig): string {
  switch (type) {
    case "bxgy":
      if (c.getPercent >= 100) return `${c.buy}+${c.get}`;
      if (c.buy === 1 && c.get === 1) return `השני ב-${c.getPercent}%`;
      return `${c.buy}+${c.get} ב-${c.getPercent}%`;
    case "percent":
      return c.mode === "amount" ? `-${sh(c.amount)}` : `-${c.percent}%`;
    case "tiers": {
      const top = c.tiers[c.tiers.length - 1];
      return top ? `עד ${top.percent}% הנחה` : "מבצע";
    }
    case "bundle":
      return `${c.qty} ב-${sh(c.price)}`;
    case "spend":
      return c.mode === "amount" ? `${sh(c.amount)} הנחה` : `${c.percent}% הנחה`;
  }
}

/** Customer-facing sentence, e.g. "קני 2 וקבלי את השלישי בחינם". */
export function describePromo(type: PromoType, c: PromoConfig): string {
  switch (type) {
    case "bxgy": {
      const what = c.getPercent >= 100 ? "בחינם" : `ב-${c.getPercent}% הנחה`;
      const other = c.target ? " מהמוצרים המשתתפים" : "";
      if (c.buy === 1 && c.get === 1) return `קני פריט אחד וקבלי פריט נוסף${other} ${what}${c.target ? "" : " (על הזול מביניהם)"}`;
      return `קני ${items(c.buy)} וקבלי עוד ${c.get === 1 ? "פריט אחד" : `${c.get} פריטים`}${other} ${what}`;
    }
    case "percent":
      return c.mode === "amount" ? `${sh(c.amount)} הנחה על כל פריט במבצע` : `${c.percent}% הנחה על כל פריט במבצע`;
    case "tiers":
      return c.tiers.map((t) => `${t.qty} פריטים: ${t.percent}%`).join(" · ");
    case "bundle":
      return `${c.qty} פריטים ב-${sh(c.price)} בלבד`;
    case "spend":
      return `בקנייה מעל ${sh(c.min)} מהמוצרים במבצע: ${c.mode === "amount" ? sh(c.amount) : c.percent + "%"} הנחה`;
  }
}

/* ---------------- engine ---------------- */

export type PricingLine = {
  /** unique per cart row, e.g. "12-38" */
  key: string;
  productId: number;
  price: number;
  qty: number;
  /** the product's category and all its ancestors */
  cats: string[];
  onSale: boolean;
};

export type AppliedPromo = { id: number; name: string; badge: string; discount: number };

export type PricingResult = {
  subtotal: number;
  discount: number;
  total: number;
  applied: AppliedPromo[];
  /** discount per cart row key */
  lines: Record<string, number>;
  /** false when an applied promotion does not combine with coupons */
  allowCoupon: boolean;
  /** upsell nudges, e.g. "הוסיפי עוד פריט אחד וקבלי אותו בחינם (1+1)" */
  hints: string[];
};

type Unit = { i: number; key: string; productId: number; price: number; cats: string[]; onSale: boolean };

export function inScope(s: PromoScope, u: { productId: number; cats: string[]; onSale: boolean }): boolean {
  if (s.exclude.includes(u.productId)) return false;
  if (s.excludeSale && u.onSale) return false;
  if (s.mode === "all") return true;
  if (s.mode === "products") return s.products.includes(u.productId);
  return u.cats.some((c) => s.categories.includes(c));
}

/** Does a product take part in a promotion at all (badges, "on sale" filter)? */
export function productInPromo(p: Promotion, u: { productId: number; cats: string[]; onSale: boolean }): boolean {
  return inScope(p.scope, u) || (p.type === "bxgy" && !!p.config.target && inScope(p.config.target, u));
}

type Eval = { discount: number; used: number[]; per: Map<number, number> };

/** Spread `total` over units in proportion to their price (whole shekels, exact sum). */
function spread(units: Unit[], total: number, per: Map<number, number>) {
  const sum = units.reduce((a, u) => a + u.price, 0);
  if (sum <= 0 || total <= 0) return;
  let left = Math.min(total, sum);
  units.forEach((u, idx) => {
    const d = idx === units.length - 1 ? left : Math.min(left, Math.round((total * u.price) / sum));
    per.set(u.i, (per.get(u.i) || 0) + d);
    left -= d;
  });
}

function evaluate(p: Promotion, avail: Unit[]): Eval | null {
  const c = p.config;
  const elig = avail.filter((u) => inScope(p.scope, u));
  const per = new Map<number, number>();
  const used: number[] = [];
  const pctOf = (price: number, pct: number) => Math.min(price, Math.round((price * pct) / 100));

  if (p.type === "bxgy") {
    if (!c.target) {
      // same pool: most expensive first, in groups of buy+get; the cheapest `get` of each group is discounted
      const sorted = [...elig].sort((a, b) => b.price - a.price);
      const group = c.buy + c.get;
      let times = Math.floor(sorted.length / group);
      if (c.maxTimes) times = Math.min(times, c.maxTimes);
      for (let t = 0; t < times; t++) {
        const g = sorted.slice(t * group, (t + 1) * group);
        g.forEach((u) => used.push(u.i));
        g.slice(c.buy).forEach((u) => per.set(u.i, pctOf(u.price, c.getPercent)));
      }
    } else {
      // buy from the scope, get from the target group (cheapest target items are discounted)
      const buyers = [...elig].sort((a, b) => b.price - a.price);
      const targets = avail.filter((u) => inScope(c.target!, u)).sort((a, b) => a.price - b.price);
      const taken = new Set<number>();
      let times = 0;
      while (!c.maxTimes || times < c.maxTimes) {
        const b = buyers.filter((u) => !taken.has(u.i)).slice(0, c.buy);
        if (b.length < c.buy) break;
        b.forEach((u) => taken.add(u.i));
        const g = targets.filter((u) => !taken.has(u.i)).slice(0, c.get);
        if (g.length < c.get) { b.forEach((u) => taken.delete(u.i)); break; }
        g.forEach((u) => { taken.add(u.i); per.set(u.i, pctOf(u.price, c.getPercent)); });
        times++;
      }
      taken.forEach((i) => used.push(i));
    }
  } else if (p.type === "percent") {
    elig.forEach((u) => { used.push(u.i); per.set(u.i, c.mode === "amount" ? Math.min(u.price, c.amount) : pctOf(u.price, c.percent)); });
  } else if (p.type === "tiers") {
    const tier = [...c.tiers].reverse().find((t) => elig.length >= t.qty);
    if (tier) elig.forEach((u) => { used.push(u.i); per.set(u.i, pctOf(u.price, tier.percent)); });
  } else if (p.type === "bundle") {
    const sorted = [...elig].sort((a, b) => b.price - a.price);
    let times = Math.floor(sorted.length / c.qty);
    if (c.maxTimes) times = Math.min(times, c.maxTimes);
    for (let t = 0; t < times; t++) {
      const g = sorted.slice(t * c.qty, (t + 1) * c.qty);
      const sum = g.reduce((a, u) => a + u.price, 0);
      if (sum <= c.price) continue; // the bundle price would not save anything for this group
      g.forEach((u) => used.push(u.i));
      spread(g, sum - c.price, per);
    }
  } else if (p.type === "spend") {
    const sum = elig.reduce((a, u) => a + u.price, 0);
    if (elig.length && sum >= c.min) {
      elig.forEach((u) => used.push(u.i));
      spread(elig, c.mode === "amount" ? Math.min(sum, c.amount) : Math.round((sum * c.percent) / 100), per);
    }
  }

  const discount = Array.from(per.values()).reduce((a, b) => a + b, 0);
  return discount > 0 ? { discount, used, per } : null;
}

function hintFor(p: Promotion, units: Unit[], applied: boolean): string | null {
  const c = p.config;
  const elig = units.filter((u) => inScope(p.scope, u));
  const n = elig.length;
  const label = p.badge || autoBadge(p.type, c);
  const one = (k: number) => (k === 1 ? "פריט אחד" : `${k} פריטים`);
  if (p.type === "bxgy" && !c.target) {
    if (!n) return null;
    const group = c.buy + c.get;
    if (c.maxTimes && Math.floor(n / group) >= c.maxTimes) return null;
    const rem = n % group;
    if (rem === 0) return null;
    const need = group - rem;
    const reward = c.getPercent >= 100 ? "בחינם" : `ב-${c.getPercent}% הנחה`;
    return `הוסיפי עוד ${one(need)} מהמבצע ${label} ותקבלי ${c.get === 1 ? "פריט" : c.get + " פריטים"} ${reward}`;
  }
  if (p.type === "bxgy" && c.target) {
    const buyers = n;
    const targets = units.filter((u) => inScope(c.target!, u)).length;
    if (buyers >= c.buy && targets === 0) return `קנית מוצרים במבצע ${label}. הוסיפי פריט מהמוצרים המשתתפים ותקבלי אותו ${c.getPercent >= 100 ? "בחינם" : `ב-${c.getPercent}% הנחה`}`;
    return null;
  }
  if (p.type === "tiers") {
    if (!n) return null;
    const next = c.tiers.find((t) => t.qty > n);
    if (!next) return null;
    return `הוסיפי עוד ${one(next.qty - n)} מהמבצע ותקבלי ${next.percent}% הנחה`;
  }
  if (p.type === "bundle") {
    if (!n || n % c.qty === 0) return null;
    if (c.maxTimes && Math.floor(n / c.qty) >= c.maxTimes) return null;
    return `הוסיפי עוד ${one(c.qty - (n % c.qty))} ותקבלי ${n >= c.qty ? "עוד חבילה של " : ""}${c.qty} ב-${sh(c.price)}`;
  }
  if (p.type === "spend") {
    if (applied || !n) return null;
    const sum = elig.reduce((a, u) => a + u.price, 0);
    const gap = c.min - sum;
    if (gap <= 0) return null;
    return `עוד ${sh(gap)} מהמוצרים במבצע ותקבלי ${c.mode === "amount" ? sh(c.amount) : c.percent + "%"} הנחה`;
  }
  return null;
}

export function applyPromotions(lines: PricingLine[], promos: Promotion[], now = new Date()): PricingResult {
  const units: Unit[] = [];
  for (const l of lines) for (let q = 0; q < Math.max(0, l.qty); q++) units.push({ i: units.length, key: l.key, productId: l.productId, price: l.price, cats: l.cats, onSale: l.onSale });
  const subtotal = units.reduce((a, u) => a + u.price, 0);
  const live = promos.filter((p) => promoState(p, now) === "active");

  let avail = units;
  const left = [...live];
  const applied: AppliedPromo[] = [];
  const perUnit = new Map<number, number>();
  let allowCoupon = true;

  while (left.length && avail.length) {
    let best: { p: Promotion; e: Eval } | null = null;
    for (const p of left) {
      const e = evaluate(p, avail);
      if (e && (!best || e.discount > best.e.discount || (e.discount === best.e.discount && p.id < best.p.id))) best = { p, e };
    }
    if (!best) break;
    applied.push({ id: best.p.id, name: best.p.name, badge: best.p.badge || autoBadge(best.p.type, best.p.config), discount: best.e.discount });
    best.e.per.forEach((d, i) => perUnit.set(i, (perUnit.get(i) || 0) + d));
    if (!best.p.allow_coupon) allowCoupon = false;
    const usedSet = new Set(best.e.used);
    avail = avail.filter((u) => !usedSet.has(u.i));
    left.splice(left.indexOf(best.p), 1);
  }

  const linesOut: Record<string, number> = {};
  perUnit.forEach((d, i) => { const k = units[i].key; linesOut[k] = (linesOut[k] || 0) + d; });
  const discount = Math.min(subtotal, applied.reduce((a, x) => a + x.discount, 0));

  const appliedIds = new Set(applied.map((a) => a.id));
  const hints: string[] = [];
  for (const p of live) {
    const h = hintFor(p, units, appliedIds.has(p.id));
    if (h && !hints.includes(h)) hints.push(h);
    if (hints.length >= 2) break;
  }

  return { subtotal, discount, total: subtotal - discount, applied, lines: linesOut, allowCoupon, hints };
}
