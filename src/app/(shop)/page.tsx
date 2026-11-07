import { listProducts, bestSellerIds } from "@/lib/store";
import { defaultSections, fillPlaceholders, getHomepage, type HomeSection } from "@/lib/content";
import type { Product } from "@/lib/types";
import ProductRow from "@/components/home/ProductRow";
import Hero from "@/components/home/Hero";
import CategoryTiles from "@/components/home/CategoryTiles";
import PromoBanners from "@/components/home/PromoBanners";
import Perks from "@/components/home/Perks";
import ClubBlock from "@/components/home/ClubBlock";

export const dynamic = "force-dynamic";

const pct = (p: Product) => (p.old_price && p.old_price > p.price ? 1 - p.price / p.old_price : 0);

/** Products for a "product row" section source. */
function pickProducts(source: string, all: Product[], best: Product[]): Product[] {
  if (source === "best") return best;
  if (source === "featured") {
    const f = all.filter((p) => p.featured);
    return f.length ? f : [...all].sort((a, b) => b.id - a.id);
  }
  if (source === "sale") return all.filter((p) => pct(p) > 0).sort((a, b) => pct(b) - pct(a));
  if (source.startsWith("category:")) {
    const key = source.slice(9);
    return [...all].filter((p) => p.category === key).sort((a, b) => b.id - a.id);
  }
  // newest first (highest id)
  return [...all].sort((a, b) => b.id - a.id);
}

export default async function Home() {
  const all = await listProducts();
  const boots = all.filter((p) => p.category === "boots");
  const minPrice = boots.length ? Math.min(...boots.map((p) => p.price)) : 140;
  const maxPct = boots.reduce((m, p) => (p.old_price && p.old_price > p.price ? Math.max(m, Math.round((1 - p.price / p.old_price) * 100)) : m), 0);
  const vars = { minPrice, maxPct: maxPct || 60 };
  const fill = (t: string) => fillPlaceholders(t, vars);

  let sections: HomeSection[];
  try {
    sections = await getHomepage();
  } catch {
    sections = defaultSections();
  }

  // Best sellers: by units sold; fall back to featured + biggest discount until there are orders
  let best: Product[] = [];
  if (sections.some((s) => s.type === "products" && s.source === "best")) {
    const soldIds = await bestSellerIds();
    const byId = new Map(all.map((p) => [p.id, p]));
    best = soldIds.map((id) => byId.get(id)).filter(Boolean) as Product[];
    if (best.length < 4) {
      const rest = all.filter((p) => !best.includes(p)).sort((a, b) => Number(b.featured) - Number(a.featured) || pct(b) - pct(a));
      best = [...best, ...rest];
    }
  }

  let heroSeen = false;
  return (
    <>
      {sections.map((s) => {
        switch (s.type) {
          case "hero": {
            const first = !heroSeen;
            heroSeen = true;
            return <Hero key={s.id} first={first} s={{ ...s, kicker: fill(s.kicker), title: fill(s.title), subtitle: fill(s.subtitle) }} />;
          }
          case "categories":
            return <CategoryTiles key={s.id} s={s} />;
          case "products":
            return <ProductRow key={s.id} title={fill(s.title)} products={pickProducts(s.source, all, best).slice(0, s.count)} limit={s.count} href={s.href} />;
          case "promos":
            return <PromoBanners key={s.id} s={{ ...s, items: s.items.map((b) => ({ ...b, title: fill(b.title), text: fill(b.text) })) }} />;
          case "perks":
            return <Perks key={s.id} s={{ ...s, items: s.items.map((p) => ({ ...p, title: fill(p.title), sub: fill(p.sub) })) }} />;
          case "club":
            return <ClubBlock key={s.id} s={{ ...s, title: fill(s.title), text: fill(s.text) }} />;
          default:
            return null;
        }
      })}
    </>
  );
}
