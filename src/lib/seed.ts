import type { Product } from "./types";

type SeedRow = Omit<Product, "id" | "created_at">;

const p = (
  slug: string,
  name: string,
  heel: number,
  sizes: number[],
  price: number,
  old: number,
  color: string,
  description: string,
  sort: number,
  featured = false
): SeedRow => ({
  slug,
  name,
  description,
  price,
  old_price: old,
  heel,
  color,
  category: "boots",
  images: [`/products/${slug}.jpg`],
  stock: Object.fromEntries(sizes.map((s) => [String(s), 2])),
  featured,
  active: true,
  sort,
});

export const SEED_PRODUCTS: SeedRow[] = [
  p("crystal-black", "מגפון קריסטל שחור", 6, [36, 38, 40], 200, 440, "black", "מגפון שחור עם בוהן מחודדת, עקב רחב ויציב בגובה 6 ס״מ ואבזם קריסטל מנצנץ בצד. מתאים לעבודה ולערב.", 1, true),
  p("leopard", "מגפון מנומר", 6, [36, 37, 38, 39, 40], 200, 440, "black", "מגפון שחור עם פאנל מנומר מאחור ואבזם זהב. עקב בלוק יציב בגובה 6 ס״מ.", 2, true),
  p("navy-gold-heel", "מגפון כחול עקב זהב", 4, [37, 38, 39, 40], 140, 350, "blue", "מגפון בכחול כהה עם רצועה ואבזם זהב, ועקב נמוך ונוח בגובה 4 ס״מ עם פס זהב.", 3, true),
  p("crystal-cognac", "מגפון קריסטל קוניאק", 6, [36, 40], 200, 440, "brown", "מגפון בגוון קוניאק חם עם אבזם קריסטל ועקב רחב בגובה 6 ס״מ.", 4, true),
  p("black-gold-heel", "מגפון שחור עקב זהב", 4, [36, 37], 149, 350, "black", "מגפון שחור קלאסי עם רצועה ואבזם זהב, ועקב 4 ס״מ עם פס זהב.", 5),
  p("patent-black", "מגפון לק שחור", 3, [37, 39], 200, 440, "black", "מגפון לק שחור מבריק עם אבזם כסוף ועקב נמוך בגובה 3 ס״מ.", 6),
  p("brown-gold-buckle", "מגפון חום אבזם זהב", 6, [37, 40], 149, 330, "brown", "מגפון חום עם אבזם זהב רחב ועקב בלוק בגובה 6 ס״מ.", 7),
  p("croc-gold-buckle", "מגפון קרוקו אבזם זהב", 5, [36, 37], 140, 340, "black", "מגפון בשילוב עור קרוקו מבריק ואבזם זהב, עקב 5 ס״מ.", 8),
  p("suede-high-heel", "מגפון זמש עקב גבוה", 9, [38], 149, 370, "black", "מגפון זמש שחור עם רוכסן זהב ועקב גבוה בגובה 9 ס״מ.", 9),
  p("croc-square-toe", "מגפון קרוקו בוהן מרובעת", 9, [38, 40, 41], 200, 330, "black", "מגפון קרוקו שחור עם בוהן מרובעת ועקב גבוה בגובה 9 ס״מ.", 10),
  p("black-gold-stripe", "מגפון שחור פס זהב", 6, [36, 37], 140, 330, "black", "מגפון שחור עם לוחית זהב ופס זהב לאורך העקב, בגובה 6 ס״מ.", 11),
];

export const SEED_WITH_IDS: Product[] = SEED_PRODUCTS.map((row, i) => ({
  ...row,
  id: i + 1,
  created_at: new Date(0).toISOString(),
}));
