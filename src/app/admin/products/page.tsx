import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { listProducts } from "@/lib/store";
import { CATEGORIES, COLORS } from "@/lib/config";
import { Empty, Icon, LinkTabs, Notice, PageHeader } from "../_components/ui";
import ProductsTable from "./ProductsTable";
import { SORTS, TABS, applyFilters, filtersQuery, readFilters, stockLevel, type TabKey } from "./shared";

export const dynamic = "force-dynamic";

export default async function ProductsAdmin({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  if (!isAdmin()) return null;
  const f = readFilters(searchParams);
  const all = await listProducts({ includeInactive: true });
  const { list, counts } = applyFilters(all, f);

  const lowCount = all.filter((p) => stockLevel(p) === "low").length;
  const outCount = all.filter((p) => stockLevel(p) === "out").length;
  const filtered = !!(f.q || f.category || f.color);
  const canEdit = hasDb();

  return (
    <>
      <PageHeader
        title="מוצרים ומלאי"
        sub={`${all.length} מוצרים · ${lowCount} במלאי נמוך · ${outCount} אזלו`}
      >
        <a href="/admin/products/export" className="a-btn" download>
          <Icon name="download" /> ייצוא CSV
        </a>
        <Link href="/admin/products/new" className="a-btn a-btn-primary">
          <Icon name="plus" /> מוצר חדש
        </Link>
      </PageHeader>

      {searchParams.deleted && <div role="status"><Notice tone="green">המוצר נמחק.</Notice></div>}

      <LinkTabs
        tabs={(Object.keys(TABS) as TabKey[]).map((k) => ({
          href: `/admin/products${filtersQuery(f, { tab: k })}`,
          label: TABS[k],
          count: counts[k],
          active: f.tab === k,
        }))}
      />

      <form method="get" action="/admin/products" role="search" aria-label="סינון מוצרים" className="a-card !p-3.5 flex flex-wrap items-end gap-3">
        {f.tab !== "all" && <input type="hidden" name="tab" value={f.tab} />}
        <label className="a-field flex-1 min-w-[220px]">
          חיפוש
          <span className="relative">
            <span className="absolute inset-y-0 start-3 flex items-center text-adm-muted pointer-events-none"><Icon name="search" size={16} /></span>
            <input name="q" defaultValue={f.q} placeholder="שם, מק״ט או כתובת" className="a-input !ps-9" type="search" />
          </span>
        </label>
        <label className="a-field w-[170px]">
          קטגוריה
          <select name="category" defaultValue={f.category} className="a-input">
            <option value="">כל הקטגוריות</option>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="a-field w-[150px]">
          צבע
          <select name="color" defaultValue={f.color} className="a-input">
            <option value="">כל הצבעים</option>
            {Object.entries(COLORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label className="a-field w-[150px]">
          מיון
          <select name="sort" defaultValue={f.sort} className="a-input">
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <div className="flex gap-2">
          <button className="a-btn a-btn-dark">סינון</button>
          {(filtered || f.sort !== "sort") && (
            <Link href={`/admin/products${filtersQuery({ tab: f.tab })}`} className="a-btn">ניקוי</Link>
          )}
        </div>
      </form>

      {list.length ? (
        <ProductsTable products={list} canEdit={canEdit} />
      ) : (
        <div className="a-card">
          {all.length === 0 ? (
            <Empty title="עדיין אין מוצרים" text="הוסיפי את המוצר הראשון: שם, מחיר, תמונות ומלאי לפי מידה.">
              <Link href="/admin/products/new" className="a-btn a-btn-primary"><Icon name="plus" /> מוצר חדש</Link>
            </Empty>
          ) : (
            <Empty title="לא נמצאו מוצרים" text={filtered ? "אין מוצרים שמתאימים לחיפוש ולסינון שבחרת." : `אין מוצרים בלשונית "${TABS[f.tab]}".`}>
              <Link href="/admin/products" className="a-btn">הצגת כל המוצרים</Link>
            </Empty>
          )}
        </div>
      )}
    </>
  );
}
