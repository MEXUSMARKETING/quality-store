import { STORE, waLink } from "./config";

/* Pure content types, defaults and validators for the home page, menus and info/blog pages.
   No server imports: safe for client components (admin editors, previews).
   Server reads/writes live in ./content.ts. */

export const TZ = "Asia/Jerusalem";
const uid = () => Math.random().toString(36).slice(2, 10);

/* ================================================================== */
/* sanitizers                                                          */
/* ================================================================== */

const str = (v: unknown, max = 300): string => String(v ?? "").replace(/\r\n?/g, "\n").trim().slice(0, max);

/** Allowed link forms: /path (same site), https://…, mailto:, tel:, wa:<message> (WhatsApp to the store), #anchor. */
export function safeHref(v: unknown): string {
  const s = String(v ?? "").trim().slice(0, 500);
  if (!s) return "";
  if (/^\/(?!\/)/.test(s)) return s;
  if (/^https?:\/\/[^\s]+$/i.test(s)) return s;
  if (/^(mailto|tel):[^\s]+$/i.test(s)) return s;
  if (/^wa:/i.test(s)) return s;
  if (/^#[^\s]*$/.test(s)) return s;
  return "";
}

/** Image URL: same-site path or https. */
export function safeImage(v: unknown): string {
  const s = String(v ?? "").trim().slice(0, 1000);
  if (/^\/(?!\/)[^\s]*$/.test(s) || /^https?:\/\/[^\s]+$/i.test(s)) return s;
  return "";
}

const ymd = (v: unknown): string | undefined => {
  const s = String(v ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
};

/** Today's date (YYYY-MM-DD) in Israel. */
export const israelToday = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });

function israelParts(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(d)
      .map((x) => [x.type, x.value])
  ) as Record<string, string>;
  return p;
}

/** "YYYY-MM-DDTHH:mm" in Israel time → UTC Date */
export function israelLocalToUtc(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v || "");
  if (!m) return null;
  const guess = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]));
  const p = israelParts(new Date(guess));
  const local = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
  const d = new Date(guess - (local - guess));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** ISO instant → "YYYY-MM-DDTHH:mm" in Israel time (for <input type="datetime-local">) */
export function toIsraelLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = israelParts(d);
  return `${p.year}-${p.month}-${p.day}T${String(Number(p.hour) % 24).padStart(2, "0")}:${p.minute}`;
}

/** Replace {minPrice}, {maxPct} … in admin text. Unknown placeholders are left as-is. */
export function fillPlaceholders(text: string, vars: Record<string, string | number>): string {
  return String(text || "").replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

/* ================================================================== */
/* HOME PAGE                                                           */
/* ================================================================== */

export type SectionBase = { id: string; visible: boolean; start?: string; end?: string };
export type HeroSection = SectionBase & {
  type: "hero";
  kicker: string;
  title: string;
  subtitle: string;
  primaryText: string;
  primaryHref: string;
  secondaryText: string;
  secondaryHref: string;
  image: string;
};
export type Tile = { label: string; href: string; image: string };
export type TilesSection = SectionBase & { type: "categories"; tiles: Tile[] };
export type ProductsSection = SectionBase & { type: "products"; title: string; source: string; count: number; href: string };
export type Promo = { title: string; text: string; href: string; image: string };
export type PromosSection = SectionBase & { type: "promos"; items: Promo[] };
export const PERK_ICONS = ["card", "truck", "tag", "star", "shield", "pin", "cash", "lock", "heart"] as const;
export type PerkIcon = (typeof PERK_ICONS)[number];
export type Perk = { title: string; sub: string; icon: PerkIcon };
export type PerksSection = SectionBase & { type: "perks"; items: Perk[] };
export type ClubSection = SectionBase & { type: "club"; kicker: string; title: string; text: string };
export type HomeSection = HeroSection | TilesSection | ProductsSection | PromosSection | PerksSection | ClubSection;
export type SectionType = HomeSection["type"];

export const SECTION_TYPES: SectionType[] = ["hero", "categories", "products", "promos", "perks", "club"];

export type HomepageSetting = { sections?: HomeSection[]; draft?: HomeSection[] | null; publishedAt?: string | null };

const unsplash = (id: string, w = 1200) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

/** Exactly what the home page showed before it became editable. */
export function defaultSections(): HomeSection[] {
  return [
    {
      id: "default-hero",
      type: "hero",
      visible: true,
      kicker: "NEW COLLECTION · 2026",
      title: "מגפוני חורף\n*מ־₪{minPrice}* בלבד",
      subtitle: "עד {maxPct}% הנחה על הקולקציה החדשה. משלוח חינם עד הבית — ומשלמים רק כשהנעל אצלך.",
      primaryText: "לכל הקולקציה",
      primaryHref: "/shop",
      secondaryText: "למבצעים",
      secondaryHref: "/shop?sort=discount",
      image: unsplash("photo-1574413230119-f302e1c9035d", 2000),
    },
    {
      id: "default-categories",
      type: "categories",
      visible: true,
      tiles: [
        { label: "מגפונים", href: "/shop", image: unsplash("photo-1605733160314-4fc7dac4bb16", 900) },
        { label: "נעלי עקב", href: "/shop?category=heels", image: unsplash("photo-1551489186-ccb95a1ea6a3", 900) },
        { label: "תיקים וארנקים", href: "/shop?category=bags", image: unsplash("photo-1624687943971-e86af76d57de", 900) },
        { label: "תכשיטים ואקססוריז", href: "/shop?category=jewelry", image: unsplash("photo-1617038220319-276d3cfab638", 900) },
      ],
    },
    { id: "default-newest", type: "products", visible: true, title: "מה חדש", source: "newest", count: 10, href: "/shop?sort=new" },
    { id: "default-best", type: "products", visible: true, title: "הנמכרים ביותר", source: "best", count: 10, href: "/shop" },
    {
      id: "default-promos",
      type: "promos",
      visible: true,
      items: [
        { title: "מבצע לזמן מוגבל", text: "עד 60% הנחה על מגפונים נבחרים", href: "/shop?sort=discount", image: unsplash("photo-1605732440685-d0654d81aa30", 1400) },
        { title: "קולקציית חורף", text: "מגפונים חמים ומעוצבים לימים הקרים", href: "/shop?sort=new", image: unsplash("photo-1571489555750-c932b569ef5d", 1400) },
      ],
    },
    {
      id: "default-perks",
      type: "perks",
      visible: true,
      items: [
        { title: "תשלום מאובטח", sub: "אשראי, Bit או מזומן בעת המסירה", icon: "card" },
        { title: "משלוח מהיר", sub: "חינם עד דלת הבית", icon: "truck" },
        { title: "מחירים ללא תחרות", sub: "עד {maxPct}% הנחה על הקולקציה", icon: "tag" },
        { title: "שירות אישי באיכות גבוהה", sub: "זמינים לך בוואטסאפ", icon: "star" },
      ],
    },
    {
      id: "default-club",
      type: "club",
      visible: true,
      kicker: "מועדון הלקוחות של Quality",
      title: "*5%* הנחה\nבהרשמה למועדון",
      text: "ההנחה נשלחת אלייך מיד, ותקבלי עדכון ראשון על דגמים חדשים ומבצעים.",
    },
  ];
}

/** Starting content for a newly added section of each type. */
export function sectionTemplates(): Record<SectionType, HomeSection> {
  const d = defaultSections();
  const find = <T extends SectionType>(t: T) => d.find((s) => s.type === t)! as Extract<HomeSection, { type: T }>;
  return {
    hero: { ...find("hero"), id: "" },
    categories: { ...find("categories"), id: "" },
    products: { id: "", type: "products", visible: true, title: "מוצרים נבחרים", source: "featured", count: 8, href: "/shop" },
    promos: { ...find("promos"), id: "" },
    perks: { ...find("perks"), id: "" },
    club: { ...find("club"), id: "" },
  };
}

const SOURCE_RE = /^(newest|best|featured|sale|category:[a-z0-9_-]{1,40})$/;

/** Validate and clean sections coming from the admin (or the DB). Unknown types are dropped. */
export function normalizeSections(raw: unknown): HomeSection[] {
  if (!Array.isArray(raw)) return [];
  const out: HomeSection[] = [];
  const seen = new Set<string>();
  for (const r of raw.slice(0, 40)) {
    if (!r || typeof r !== "object") continue;
    const x = r as Record<string, any>;
    let id = str(x.id, 40).replace(/[^a-zA-Z0-9_-]/g, "") || uid();
    if (seen.has(id)) id = uid();
    seen.add(id);
    const base: SectionBase = { id, visible: x.visible !== false };
    const start = ymd(x.start), end = ymd(x.end);
    if (start) base.start = start;
    if (end) base.end = end;
    switch (x.type) {
      case "hero":
        out.push({
          ...base,
          type: "hero",
          kicker: str(x.kicker, 80),
          title: str(x.title, 160),
          subtitle: str(x.subtitle, 400),
          primaryText: str(x.primaryText, 40),
          primaryHref: safeHref(x.primaryHref),
          secondaryText: str(x.secondaryText, 40),
          secondaryHref: safeHref(x.secondaryHref),
          image: safeImage(x.image),
        });
        break;
      case "categories":
        out.push({
          ...base,
          type: "categories",
          tiles: (Array.isArray(x.tiles) ? x.tiles : []).slice(0, 4).map((t: any) => ({ label: str(t?.label, 60), href: safeHref(t?.href), image: safeImage(t?.image) })),
        });
        break;
      case "products": {
        const source = SOURCE_RE.test(String(x.source)) ? String(x.source) : "newest";
        const count = Math.min(20, Math.max(2, Math.round(Number(x.count) || 10)));
        out.push({ ...base, type: "products", title: str(x.title, 80), source, count, href: safeHref(x.href) || "/shop" });
        break;
      }
      case "promos":
        out.push({
          ...base,
          type: "promos",
          items: (Array.isArray(x.items) ? x.items : []).slice(0, 2).map((t: any) => ({ title: str(t?.title, 80), text: str(t?.text, 200), href: safeHref(t?.href), image: safeImage(t?.image) })),
        });
        break;
      case "perks":
        out.push({
          ...base,
          type: "perks",
          items: (Array.isArray(x.items) ? x.items : []).slice(0, 4).map((t: any) => ({
            title: str(t?.title, 60),
            sub: str(t?.sub, 120),
            icon: (PERK_ICONS as readonly string[]).includes(t?.icon) ? t.icon : "star",
          })),
        });
        break;
      case "club":
        out.push({ ...base, type: "club", kicker: str(x.kicker, 80), title: str(x.title, 160), text: str(x.text, 400) });
        break;
    }
  }
  return out;
}

/** Is the section shown today (visible toggle + optional date window, Israel dates, inclusive)? */
export function sectionLive(s: HomeSection, today = israelToday()): boolean {
  if (!s.visible) return false;
  if (s.start && today < s.start) return false;
  if (s.end && today > s.end) return false;
  return true;
}

/* ================================================================== */
/* MENUS                                                               */
/* ================================================================== */

export type MenuItem = { label: string; href: string; newTab?: boolean; children?: MenuItem[] };
export type FooterColumn = { title: string; items: MenuItem[] };
export type Menus = {
  announcement: { text: string; enabled: boolean; showPhone?: boolean };
  main: MenuItem[];
  footer: FooterColumn[];
  mobileExtra?: MenuItem[];
};

/** Exactly today's header nav, footer columns and announcement bar. */
export function defaultMenus(): Menus {
  return {
    announcement: { text: "משלוח חינם עד הבית | תשלום במזומן בעת המסירה", enabled: true, showPhone: true },
    main: [
      { href: "/shop", label: "כל המגפונים" },
      { href: "/shop?color=black", label: "שחור" },
      { href: "/shop?color=brown", label: "חום וקוניאק" },
      { href: "/shop?heel=high", label: "עקב גבוה" },
      { href: "/shop?category=jewelry", label: "תכשיטים" },
      { href: "/shop?category=bags", label: "תיקים" },
    ],
    footer: [
      {
        title: "קנייה",
        items: [
          { label: "כל המגפונים", href: "/shop" },
          { label: "עקב נמוך", href: "/shop?heel=low" },
          { label: "עקב גבוה", href: "/shop?heel=high" },
          { label: "מבצעים", href: "/shop?sort=discount" },
        ],
      },
      {
        title: "שירות לקוחות",
        items: [
          { label: "וואטסאפ", href: "wa:שלום, יש לי שאלה", newTab: true },
          { label: "משלוחים והחזרות", href: "/info/shipping" },
          { label: "מדריך מידות", href: "/info/sizes" },
        ],
      },
      {
        title: "מידע",
        items: [
          { label: "תקנון האתר", href: "/info/terms" },
          { label: "מדיניות פרטיות", href: "/info/privacy" },
          { label: "הצהרת נגישות", href: "/info/accessibility" },
        ],
      },
    ],
    mobileExtra: [],
  };
}

function normItems(raw: unknown, depth: number, max = 30): MenuItem[] {
  if (!Array.isArray(raw)) return [];
  const out: MenuItem[] = [];
  for (const r of raw.slice(0, max)) {
    if (!r || typeof r !== "object") continue;
    const x = r as Record<string, any>;
    const label = str(x.label, 60);
    const href = safeHref(x.href);
    if (!label || !href) continue;
    const it: MenuItem = { label, href };
    if (x.newTab) it.newTab = true;
    if (depth > 1) {
      const ch = normItems(x.children, depth - 1, 20);
      if (ch.length) it.children = ch;
    }
    out.push(it);
  }
  return out;
}

export function normalizeMenus(raw: unknown): Menus {
  const d = defaultMenus();
  if (!raw || typeof raw !== "object") return d;
  const x = raw as Record<string, any>;
  const a = x.announcement && typeof x.announcement === "object" ? x.announcement : d.announcement;
  return {
    announcement: { text: str(a.text, 200), enabled: a.enabled !== false, showPhone: a.showPhone !== false },
    main: Array.isArray(x.main) ? normItems(x.main, 2) : d.main,
    footer: Array.isArray(x.footer)
      ? x.footer.slice(0, 3).map((c: any) => ({ title: str(c?.title, 60), items: normItems(c?.items, 1, 15) })).filter((c: FooterColumn) => c.title || c.items.length)
      : d.footer,
    mobileExtra: Array.isArray(x.mobileExtra) ? normItems(x.mobileExtra, 1, 15) : [],
  };
}

/** Turn "wa:<message>" links into real WhatsApp links for the store phone. */
export function resolveHref(href: string, whatsapp: string = STORE.whatsapp): string {
  if (/^wa:/i.test(href)) return waLink(href.slice(3).trim() || "שלום", whatsapp);
  return href;
}

export function resolveMenus(m: Menus, whatsapp: string): Menus {
  const fix = (items: MenuItem[] = []): MenuItem[] =>
    items.map((i) => ({ ...i, href: resolveHref(i.href, whatsapp), newTab: i.newTab || /^wa:/i.test(i.href) || undefined, children: i.children ? fix(i.children) : undefined }));
  return { ...m, main: fix(m.main), footer: m.footer.map((c) => ({ ...c, items: fix(c.items) })), mobileExtra: fix(m.mobileExtra) };
}

/* ================================================================== */
/* PAGES & BLOG                                                        */
/* ================================================================== */

export type PageBlock =
  | { id: string; type: "heading"; text: string; level: 2 | 3 }
  | { id: string; type: "paragraph"; text: string }
  | { id: string; type: "image"; url: string; alt: string; caption: string }
  | { id: string; type: "button"; text: string; href: string }
  | { id: string; type: "faq"; q: string; a: string }
  | { id: string; type: "divider" };
export type BlockType = PageBlock["type"];

export type PageStatus = "draft" | "published" | "scheduled";
export type CmsPage = {
  id: number;
  slug: string;
  title: string;
  type: "page" | "blog";
  blocks: PageBlock[];
  status: PageStatus;
  publish_at: string | null;
  seo_title: string;
  seo_description: string;
  share_image: string;
  created_at: string;
  updated_at: string;
};

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function normalizeBlocks(raw: unknown): PageBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: PageBlock[] = [];
  for (const r of raw.slice(0, 200)) {
    if (!r || typeof r !== "object") continue;
    const x = r as Record<string, any>;
    const id = str(x.id, 40).replace(/[^a-zA-Z0-9_-]/g, "") || uid();
    switch (x.type) {
      case "heading": {
        const text = str(x.text, 200);
        if (text) out.push({ id, type: "heading", text, level: Number(x.level) === 3 ? 3 : 2 });
        break;
      }
      case "paragraph": {
        const text = str(x.text, 8000);
        if (text) out.push({ id, type: "paragraph", text });
        break;
      }
      case "image": {
        const url = safeImage(x.url);
        if (url) out.push({ id, type: "image", url, alt: str(x.alt, 200), caption: str(x.caption, 300) });
        break;
      }
      case "button": {
        const text = str(x.text, 60);
        const href = safeHref(x.href);
        if (text && href) out.push({ id, type: "button", text, href });
        break;
      }
      case "faq": {
        const q = str(x.q, 300);
        if (q) out.push({ id, type: "faq", q, a: str(x.a, 4000) });
        break;
      }
      case "divider":
        out.push({ id, type: "divider" });
        break;
    }
  }
  return out;
}

const iso = (v: any) => (v ? new Date(v).toISOString() : null);

export function normPage(r: any): CmsPage {
  const blocks = typeof r.blocks === "string" ? JSON.parse(r.blocks) : r.blocks;
  const status = ["draft", "published", "scheduled"].includes(r.status) ? r.status : "draft";
  return {
    id: Number(r.id),
    slug: String(r.slug),
    title: String(r.title || ""),
    type: r.type === "blog" ? "blog" : "page",
    blocks: normalizeBlocks(blocks),
    status,
    publish_at: iso(r.publish_at),
    seo_title: r.seo_title || "",
    seo_description: r.seo_description || "",
    share_image: r.share_image || "",
    created_at: iso(r.created_at) || new Date().toISOString(),
    updated_at: iso(r.updated_at) || new Date().toISOString(),
  };
}

/** Published, or scheduled with publish_at in the past. */
export function pageIsLive(p: Pick<CmsPage, "status" | "publish_at">, now = new Date()): boolean {
  if (p.status === "published") return true;
  if (p.status === "scheduled") return !!p.publish_at && new Date(p.publish_at) <= now;
  return false;
}

/** The info pages the store had before the CMS (the storefront fallback and the seed). */
export function defaultPages(store: { city: string; address: string; phoneDisplay: string } = STORE): Record<string, { title: string; body: string[] }> {
  return {
    shipping: {
      title: "משלוחים והחזרות",
      body: [
        "משלוח עד הבית ללא עלות. השליח יתאם איתך את מועד המסירה מראש.",
        `אפשר גם לאסוף את ההזמנה מהחנות ב${store.city}, ${store.address}.`,
        "התשלום מתבצע במזומן בעת המסירה, או באשראי / Bit לפי בחירתך.",
        "[מדיניות החלפות והחזרות — יש להשלים לפי מדיניות החנות]",
      ],
    },
    sizes: {
      title: "מדריך מידות",
      body: [
        "המגפונים שלנו תואמים למידה הרגילה שלך (מידות אירופאיות EU).",
        "אם את בין שתי מידות — מומלץ לבחור את המידה הגדולה.",
        `לא בטוחה? כתבי לנו בוואטסאפ ${store.phoneDisplay} ונשמח לעזור.`,
      ],
    },
    terms: {
      title: "תקנון האתר",
      body: ["[תקנון האתר — יש להשלים לפני העלייה לאוויר: פרטי העסק, תנאי רכישה, ביטולים לפי חוק הגנת הצרכן, אחריות ומשלוחים]"],
    },
    privacy: {
      title: "מדיניות פרטיות",
      body: ["[מדיניות פרטיות — יש להשלים: איזה מידע נאסף (שם, טלפון, כתובת, מייל), לשם מה, ואיך אפשר לבקש מחיקה]"],
    },
    accessibility: {
      title: "הצהרת נגישות",
      body: ["[הצהרת נגישות — יש להשלים לפי תקנות שוויון זכויות לאנשים עם מוגבלות, כולל פרטי רכז/ת נגישות]"],
    },
  };
}
