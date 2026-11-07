import Link from "next/link";
import { isAdmin, currentAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { hasDb } from "@/lib/db";
import { listProducts } from "@/lib/store";
import { imageStorageReady } from "@/lib/storage";
import { defaultSections, getHomepageAdmin, listCategoryOptions, sectionTemplates } from "@/lib/content";
import { Icon, Notice, PageHeader, fmtDateTime } from "../_components/ui";
import HomepageEditor from "./HomepageEditor";
import type { PreviewProduct } from "./meta";

export const dynamic = "force-dynamic";
export const metadata = { title: "ניהול דף הבית" };

export default async function HomepageAdmin() {
  if (!isAdmin()) return null;
  const me = await currentAdmin();
  const canEdit = !!me && can(me.perms, "homepage", "edit");

  let state = { published: defaultSections(), draft: defaultSections(), hasDraft: false, publishedAt: null as string | null, isDefault: true };
  let loadError = false;
  try {
    state = await getHomepageAdmin();
  } catch (e) {
    console.error(e);
    loadError = true;
  }

  let products: PreviewProduct[] = [];
  try {
    products = (await listProducts()).map((p) => ({ id: p.id, name: p.name, price: p.price, old_price: p.old_price, image: p.images[0] || "", category: p.category, featured: p.featured }));
  } catch (e) {
    console.error(e);
  }
  const categories = await listCategoryOptions();

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin", label: "ראשי" }, { label: "ניהול דף הבית" }]}
        title="ניהול דף הבית"
        sub={state.publishedAt ? `פורסם לאחרונה ${fmtDateTime(state.publishedAt)}` : state.isDefault ? "מוצג כרגע התוכן המקורי של האתר" : undefined}
      >
        <Link href="/" target="_blank" className="a-btn"><Icon name="external" size={16} /> צפייה באתר</Link>
      </PageHeader>

      {loadError && <Notice tone="red">לא הצלחנו לטעון את ההגדרות השמורות. מוצג התוכן המקורי של האתר – שמירה תדרוס אותו.</Notice>}
      {!canEdit && <Notice tone="blue">יש לך הרשאת צפייה בלבד בדף הבית.</Notice>}

      <HomepageEditor
        initial={state.draft}
        published={state.published}
        initialHasDraft={state.hasDraft}
        templates={sectionTemplates()}
        products={products}
        categories={categories}
        canEdit={canEdit && hasDb()}
        storageReady={imageStorageReady()}
      />
    </>
  );
}
