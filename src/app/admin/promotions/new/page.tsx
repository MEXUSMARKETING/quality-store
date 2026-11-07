import { isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { DEFAULT_CONFIG, normConfig } from "@/lib/promotions-shared";
import { DbMissing, PageHeader } from "../../_components/ui";
import PromoEditor, { NEW_DEFAULTS } from "../PromoEditor";
import { editorData } from "../data";
import { PRESETS } from "../presets";

export const dynamic = "force-dynamic";
export const metadata = { title: "מבצע חדש" };

export default async function NewPromotionPage({ searchParams }: { searchParams: { preset?: string } }) {
  if (!isAdmin()) return null;
  const { categories, products, others } = await editorData();
  const preset = PRESETS.find((p) => p.key === searchParams.preset);
  const known = new Set(categories.map((c) => c.key));
  const config = preset ? normConfig({ ...DEFAULT_CONFIG, ...preset.config }) : DEFAULT_CONFIG;
  // a template that points at a category this store doesn't have falls back to "same products"
  if (config.target && config.target.mode === "categories") {
    config.target.categories = config.target.categories.filter((k) => known.has(k));
    if (!config.target.categories.length) config.target = null;
  }
  const scope = preset?.key === "cross" && known.has("boots") ? { ...NEW_DEFAULTS.scope, mode: "categories" as const, categories: ["boots"] } : NEW_DEFAULTS.scope;
  return (
    <>
      <PageHeader crumbs={[{ href: "/admin", label: "ראשי" }, { href: "/admin/promotions", label: "מבצעים" }, { label: "מבצע חדש" }]} title={preset ? `מבצע חדש: ${preset.title}` : "מבצע חדש"} sub="המבצע מופעל אוטומטית בסל של כל לקוחה שעומדת בתנאים, בלי קוד" />
      {!hasDb() && <DbMissing />}
      <PromoEditor initial={{ ...NEW_DEFAULTS, id: null, name: preset?.name || "", type: preset?.type || NEW_DEFAULTS.type, config, scope }} categories={categories} products={products} others={others} />
    </>
  );
}
