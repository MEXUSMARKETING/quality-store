import type { PerkIcon, SectionType } from "@/lib/content-shared";

/* Labels for the home page editor (client-safe). */

export const SECTION_META: Record<SectionType, { label: string; hint: string }> = {
  hero: { label: "באנר ראשי", hint: "תמונה גדולה, כותרת וכפתורים" },
  categories: { label: "אריחי קטגוריות", hint: "עד 4 אריחים עם תמונה" },
  products: { label: "שורת מוצרים", hint: "חדשים, נמכרים, מבצעים או קטגוריה" },
  promos: { label: "באנרים לקידום", hint: "עד 2 באנרים רחבים" },
  perks: { label: "שורת יתרונות", hint: "4 יתרונות עם אייקון" },
  club: { label: "הרשמה למועדון", hint: "טופס הצטרפות למועדון הלקוחות" },
};

export const SOURCE_LABELS: Record<string, string> = {
  newest: "החדשים ביותר",
  best: "הנמכרים ביותר",
  featured: "מוצרים מומלצים",
  sale: "מוצרים במבצע",
};

export const PERK_ICON_LABELS: Record<PerkIcon, string> = {
  card: "כרטיס אשראי",
  truck: "משאית משלוח",
  tag: "תגית מחיר",
  star: "כוכב",
  shield: "מגן",
  pin: "מיקום",
  cash: "מזומן",
  lock: "מנעול",
  heart: "לב",
};

export type PreviewProduct = { id: number; name: string; price: number; old_price: number | null; image: string; category: string; featured: boolean };
