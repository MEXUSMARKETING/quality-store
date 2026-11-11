/* Admin modules, roles and their default permissions.
   Pure data (no server imports) so client components can use it to hide UI.
   Enforcement happens on the server: requireAdmin(module, level) in src/lib/auth.ts. */

export type Level = "view" | "edit";

export const MODULES = {
  dashboard: "סקירה כללית",
  orders: "הזמנות",
  products: "מוצרים ומלאי",
  customers: "לקוחות",
  categories: "קטגוריות",
  attributes: "מאפיינים (מידות וצבעים)",
  reviews: "ביקורות",
  coupons: "קופונים ומועדון",
  promotions: "מבצעים",
  popups: "פופ־אפים",
  reports: "דוחות",
  automations: "אוטומציות",
  homepage: "דף הבית",
  pages: "דפים ותוכן",
  menus: "תפריטים",
  ai: "עוזר AI",
  users: "משתמשים והרשאות",
  settings: "הגדרות מערכת",
  activity: "יומן פעילות",
} as const;
export type Module = keyof typeof MODULES;

/** Per-module permission: "edit" (implies view), "view", or absent (no access). */
export type PermissionMap = Partial<Record<Module, Level>>;

const all = (level: Level): PermissionMap => Object.fromEntries(Object.keys(MODULES).map((m) => [m, level])) as PermissionMap;

export const ROLES: Record<string, { label: string; perms: PermissionMap }> = {
  owner: { label: "מנהל ראשי", perms: all("edit") },
  store_manager: {
    label: "מנהל חנות",
    perms: { ...all("edit"), users: undefined, settings: "view", activity: "view" } as PermissionMap,
  },
  product_manager: {
    label: "מנהל מוצרים",
    perms: { dashboard: "view", products: "edit", categories: "edit", attributes: "edit", reviews: "view", ai: "edit" },
  },
  order_manager: {
    label: "מנהל הזמנות",
    perms: { dashboard: "view", orders: "edit", customers: "edit", products: "view" },
  },
  content_manager: {
    label: "מנהל תוכן",
    perms: { dashboard: "view", homepage: "edit", pages: "edit", menus: "edit", reviews: "edit", ai: "edit" },
  },
  marketing_manager: {
    label: "מנהל שיווק",
    perms: { dashboard: "view", coupons: "edit", promotions: "edit", popups: "edit", automations: "edit", reports: "view", customers: "view", ai: "edit" },
  },
};

export function permsFor(role: string, custom?: PermissionMap | null): PermissionMap {
  const base = ROLES[role]?.perms || {};
  return { ...base, ...(custom || {}) };
}

export function can(perms: PermissionMap, module: Module, level: Level = "view"): boolean {
  const p = perms[module];
  if (!p) return false;
  return level === "view" ? true : p === "edit";
}

/** Which module an /admin URL belongs to (used by the layout to block pages without permission). */
export function moduleForPath(path: string): Module | null {
  const seg = (path.split("?")[0].replace(/^\/admin\/?/, "").split("/")[0] || "") as string;
  const map: Record<string, Module> = {
    "": "dashboard",
    search: "dashboard",
    orders: "orders",
    products: "products",
    customers: "customers",
    categories: "categories",
    attributes: "attributes",
    reviews: "reviews",
    coupons: "coupons",
    club: "coupons",
    promotions: "promotions",
    popups: "popups",
    reports: "reports",
    automations: "automations",
    homepage: "homepage",
    pages: "pages",
    menus: "menus",
    ai: "ai",
    users: "users",
    settings: "settings",
    activity: "activity",
  };
  return map[seg] ?? null;
}
