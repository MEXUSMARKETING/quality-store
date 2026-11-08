import { isAdmin } from "@/lib/auth";
import { aiConfigured } from "@/lib/ai";
import { geminiConfigured } from "@/lib/gemini-image";
import { imageStorageReady } from "@/lib/storage";
import { getAttributes, getCategoriesAll } from "@/lib/catalog";
import { listProducts } from "@/lib/store";
import { getStoreInfo } from "@/lib/site";
import AiWizard, { type WizProduct } from "./AiWizard";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";
// image generation + quality check can take a while
export const maxDuration = 120;
export const metadata = { title: "הוספה מהירה עם AI" };

const toWiz = (p: Product): WizProduct => ({
  id: p.id,
  name: p.name,
  image: p.images?.[0] || "",
  price: p.price,
  category: p.category,
  heel: p.heel ?? null,
  colors: p.variants?.colors?.length ? p.variants.colors.map((c) => c.key) : p.color ? [p.color] : [],
});

export default async function AiQuickAdd({ searchParams }: { searchParams: { product?: string } }) {
  if (!isAdmin()) return null;
  const [cats, attrs, products, store] = await Promise.all([
    getCategoriesAll(),
    getAttributes(),
    listProducts({ includeInactive: true }).catch(() => [] as Product[]),
    getStoreInfo().catch(() => ({ name: "" }) as { name: string }),
  ]);
  const focusId = Number(searchParams.product) || 0;
  const focusP = focusId ? products.find((p) => p.id === focusId) : undefined;
  return (
    <>
      <h1 className="sr-only">{focusP ? "צבע חדש מצילום" : "הוספה מהירה עם AI"}</h1>
      <AiWizard
        colors={attrs.colors}
        sizes={attrs.sizes}
        categories={cats.filter((c) => c.active !== false).map((c) => ({ key: c.key, name: c.name }))}
        products={products.map(toWiz)}
        focus={focusP ? toWiz(focusP) : null}
        aiReady={aiConfigured()}
        storageReady={imageStorageReady()}
        storeName={store.name || ""}
        mockupReady={geminiConfigured()}
      />
    </>
  );
}
