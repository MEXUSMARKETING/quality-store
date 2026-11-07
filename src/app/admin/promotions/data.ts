import { listProducts } from "@/lib/store";
import { getCategoriesAll, orderTree } from "@/lib/catalog";
import { getCategoryPaths, listPromotions } from "@/lib/promotions";
import { promoState } from "@/lib/promotions-shared";
import type { EditorCategory, EditorProduct } from "./PromoEditor";

/** Everything the promotion editor needs: products (with category paths), the category tree and
 *  the other running/scheduled promotions (for the overlap check). */
export async function editorData() {
  const [products, cats, paths, promos] = await Promise.all([listProducts({ includeInactive: true }), getCategoriesAll(), getCategoryPaths(), listPromotions().catch(() => [])]);
  const tree = orderTree(cats);
  const parent = new Map(tree.map((c) => [c.key, c.parent]));
  const depth = (k: string) => { let d = 0, p = parent.get(k); while (p && d < 6) { d++; p = parent.get(p); } return d; };
  const categories: EditorCategory[] = tree.map((c) => ({ key: c.key, name: c.name, depth: depth(c.key), active: c.active }));
  const eps: EditorProduct[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    cost: p.cost ?? null,
    image: p.images[0] || "",
    category: p.category,
    cats: paths[p.category] || [p.category],
    onSale: !!(p.old_price && p.old_price > p.price),
    active: p.active,
  }));
  const others = promos.filter((p) => ["active", "scheduled"].includes(promoState(p)));
  return { categories, products: eps, others, promos };
}
