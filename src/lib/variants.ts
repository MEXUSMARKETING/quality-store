/* Product variants (וריאציות): colours × sizes.
   A product either has simple stock (one colour, stock per size) or variants: a list of colours,
   each with its own images, and stock per colour per size. To keep every existing screen working
   (lists, low-stock alerts, reports, size filters) the product's plain `stock` always holds the
   total per size across colours, `color` holds the first (default) colour, and `images` holds the
   default colour's images followed by the shared ones.
   Pure code: used by the server, the admin editor and the storefront. */

export type VariantColor = { key: string; images: string[] };
export type Variants = { colors: VariantColor[]; stock: Record<string, Record<string, number>> };

const MAX_COLORS = 20;
const MAX_QTY = 9999;

const cleanKey = (v: unknown) => String(v ?? "").trim().slice(0, 40);
const cleanSize = (v: unknown) => String(v ?? "").trim().slice(0, 10);
const cleanUrl = (v: unknown) => {
  const s = String(v ?? "").trim();
  return /^(https?:\/\/|\/)/.test(s) ? s.slice(0, 600) : "";
};

/** Validate/normalise anything that claims to be variants. Returns null when there are no colours. */
export function normVariants(v: any): Variants | null {
  const raw = typeof v === "string" ? safeParse(v) : v;
  if (!raw || typeof raw !== "object" || !Array.isArray(raw.colors)) return null;
  const colors: VariantColor[] = [];
  for (const c of raw.colors) {
    const key = cleanKey(c?.key);
    if (!key || colors.some((x) => x.key === key)) continue;
    const images = Array.from(new Set((Array.isArray(c?.images) ? c.images : []).map(cleanUrl).filter(Boolean))).slice(0, 20) as string[];
    colors.push({ key, images });
    if (colors.length >= MAX_COLORS) break;
  }
  if (!colors.length) return null;
  const stock: Record<string, Record<string, number>> = {};
  for (const c of colors) {
    const row = raw.stock?.[c.key] || {};
    const out: Record<string, number> = {};
    for (const [s, q] of Object.entries(row)) {
      const size = cleanSize(s);
      const n = Math.max(0, Math.min(MAX_QTY, Math.round(Number(q) || 0)));
      if (size && n > 0) out[size] = n;
    }
    stock[c.key] = out;
  }
  return { colors, stock };
}

function safeParse(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/** Total per size across all colours (what the product's plain `stock` holds). */
export function aggregateStock(v: Variants): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of v.colors) for (const [s, q] of Object.entries(v.stock[c.key] || {})) out[s] = (out[s] || 0) + (Number(q) || 0);
  return out;
}

export const colorTotal = (v: Variants, color: string) => Object.values(v.stock[color] || {}).reduce((a, b) => a + (Number(b) || 0), 0);

type WithVariants = { stock: Record<string, number>; images: string[]; color: string; variants?: Variants | null; baseImages?: string[] };

export function hasVariants(p: { variants?: Variants | null }): p is { variants: Variants } {
  return !!p.variants && p.variants.colors.length > 0;
}

/** Stock per size for one colour (or the plain stock for a simple product / unknown colour). */
export function stockFor(p: WithVariants, color?: string | null): Record<string, number> {
  if (!hasVariants(p)) return p.stock || {};
  if (color && p.variants.stock[color]) return p.variants.stock[color];
  return color ? {} : p.stock || {};
}

/** Images to show for a colour: its own images, then the shared product images. */
export function imagesFor(p: WithVariants, color?: string | null): string[] {
  if (!hasVariants(p)) return p.images;
  const own = (color && p.variants.colors.find((c) => c.key === color)?.images) || [];
  const shared = p.baseImages || [];
  const list = Array.from(new Set([...own, ...shared]));
  return list.length ? list : p.images;
}

/** Colours that have at least one size in stock, in the product's order. */
export function colorsInStock(p: WithVariants): string[] {
  if (!hasVariants(p)) return [p.color];
  return p.variants.colors.filter((c) => colorTotal(p.variants, c.key) > 0).map((c) => c.key);
}

/** The colour to show first: the requested one if it exists, else the first colour with stock. */
export function defaultColor(p: WithVariants, wanted?: string | null): string {
  if (!hasVariants(p)) return p.color;
  if (wanted && p.variants.colors.some((c) => c.key === wanted)) return wanted;
  return colorsInStock(p)[0] || p.variants.colors[0].key;
}

/** Does the product come in this colour (any variant colour, or its single colour)? */
export function hasColor(p: WithVariants, color: string, inStockOnly = false): boolean {
  if (!hasVariants(p)) return p.color === color;
  const c = p.variants.colors.find((x) => x.key === color);
  return !!c && (!inStockOnly || colorTotal(p.variants, color) > 0);
}

/** Units available for one colour+size (the plain stock for simple products). */
export function unitsFor(p: WithVariants, size: string, color?: string | null): number {
  return Number(stockFor(p, hasVariants(p) ? color || defaultColor(p) : null)[size] || 0);
}

/** Stable key of a cart/order line: product, colour (variants only) and size. */
export function lineKey(productId: number, size: string, color?: string | null): string {
  return color ? `${productId}-${color}-${size}` : `${productId}-${size}`;
}
