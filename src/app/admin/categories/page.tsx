import Link from "next/link";
import { isAdmin, currentAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { hasDb } from "@/lib/db";
import { imageStorageReady } from "@/lib/storage";
import { listAllCategories, type CategoryWithCount } from "@/lib/catalog";
import { Chip, Empty, Icon, Notice, PageHeader } from "../_components/ui";
import CategoryTree from "./CategoryTree";
import CategoryPanel from "./CategoryPanel";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => String((Array.isArray(v) ? v[0] : v) ?? "").trim();

export default async function CategoriesAdmin({ searchParams }: { searchParams: SP }) {
  if (!isAdmin()) return null;
  const me = await currentAdmin();
  const canEdit = hasDb() && !!me && can(me.perms, "categories", "edit");

  let all: CategoryWithCount[] = [];
  let loadError = false;
  try {
    all = await listAllCategories();
  } catch (e) {
    console.error(e);
    loadError = true;
  }

  const view = one(searchParams.view) === "table" ? "table" : "tree";
  const q = one(searchParams.q).slice(0, 80);
  const editKey = one(searchParams.edit);
  const isNew = one(searchParams.new) === "1";
  const editing = editKey ? all.find((c) => c.key === editKey) : undefined;
  const showPanel = isNew || !!editing;

  const base = (extra: Record<string, string> = {}) => {
    const sp = new URLSearchParams();
    if (view === "table") sp.set("view", "table");
    if (q && view === "table") sp.set("q", q);
    for (const [k, v] of Object.entries(extra)) if (v) sp.set(k, v);
    const s = sp.toString();
    return `/admin/categories${s ? `?${s}` : ""}`;
  };

  const names = Object.fromEntries(all.map((c) => [c.key, c.name]));
  const depth = (c: CategoryWithCount) => {
    let d = 0;
    let p = c.parent;
    while (p && names[p] && d < 6) { d++; p = all.find((x) => x.key === p)?.parent || null; }
    return d;
  };
  const totalProducts = all.reduce((a, c) => a + c.count, 0);
  const filtered = q ? all.filter((c) => `${c.name} ${c.key} ${c.description}`.toLowerCase().includes(q.toLowerCase())) : all;

  return (
    <>
      <PageHeader
        title="קטגוריות"
        sub={`${all.length} קטגוריות · ${all.filter((c) => c.active).length} פעילות באתר · ${totalProducts} מוצרים משויכים`}
      >
        <nav className="flex rounded-[11px] border border-adm-line bg-white p-0.5" aria-label="תצוגה">
          <Link href={`/admin/categories${editKey ? `?edit=${encodeURIComponent(editKey)}` : ""}`} aria-current={view === "tree" ? "page" : undefined} className={`h-10 px-3.5 rounded-[9px] text-[14px] font-semibold flex items-center gap-1.5 ${view === "tree" ? "bg-adm-navy text-white hover:!text-white" : "text-adm-mid"}`}>
            <Icon name="list" size={16} /> עץ
          </Link>
          <Link href={`/admin/categories?view=table${editKey ? `&edit=${encodeURIComponent(editKey)}` : ""}`} aria-current={view === "table" ? "page" : undefined} className={`h-10 px-3.5 rounded-[9px] text-[14px] font-semibold flex items-center gap-1.5 ${view === "table" ? "bg-adm-navy text-white hover:!text-white" : "text-adm-mid"}`}>
            <Icon name="grid" size={16} /> טבלה
          </Link>
        </nav>
        {canEdit && (
          <Link href={base({ new: "1" })} className="a-btn a-btn-primary"><Icon name="plus" /> קטגוריה חדשה</Link>
        )}
      </PageHeader>

      {one(searchParams.saved) && <div role="status"><Notice tone="green"><b>הקטגוריה נשמרה.</b> השינויים כבר מופיעים באתר.</Notice></div>}
      {one(searchParams.deleted) && <div role="status"><Notice tone="green">הקטגוריה נמחקה.</Notice></div>}
      {loadError && <Notice tone="red">טעינת הקטגוריות נכשלה. נסי לרענן את העמוד.</Notice>}
      {editKey && !editing && !loadError && <Notice tone="amber">הקטגוריה &quot;{editKey}&quot; לא נמצאה.</Notice>}

      <div className={`grid gap-5 items-start ${showPanel ? "xl:grid-cols-[minmax(0,1fr)_420px]" : ""}`}>
        <div className="flex flex-col gap-4 min-w-0">
          {view === "tree" ? (
            <div className="a-card !p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-adm-line flex flex-wrap items-center justify-between gap-2 text-[13px] text-adm-muted">
                <span>הסדר כאן הוא הסדר בתפריט ובאתר. החצים מזיזים בתוך אותה רמה.</span>
                <span className="flex items-center gap-1"><Icon name="star" size={14} className="text-[#C98A00] fill-current" /> = קטגוריה מומלצת</span>
              </div>
              {all.length ? (
                <CategoryTree cats={all} canEdit={canEdit} editKey={editing?.key || ""} />
              ) : (
                <Empty title="אין קטגוריות עדיין" text="הוסיפי את הקטגוריה הראשונה – היא תופיע בעמוד החנות ובבורר הקטגוריה של המוצרים." />
              )}
            </div>
          ) : (
            <>
              <form method="get" action="/admin/categories" role="search" aria-label="חיפוש קטגוריות" className="a-card !p-3.5 flex flex-wrap items-end gap-3">
                <input type="hidden" name="view" value="table" />
                <label className="a-field flex-1 min-w-[220px]">
                  חיפוש
                  <span className="relative">
                    <span className="absolute inset-y-0 start-3 flex items-center text-adm-muted pointer-events-none"><Icon name="search" size={16} /></span>
                    <input name="q" type="search" defaultValue={q} placeholder="שם, מפתח או תיאור" className="a-input !ps-9" />
                  </span>
                </label>
                <button className="a-btn a-btn-dark">חיפוש</button>
                {q && <Link href="/admin/categories?view=table" className="a-btn">ניקוי</Link>}
              </form>
              <div className="a-card !p-0 overflow-x-auto">
                {filtered.length ? (
                  <table className="a-table min-w-[760px]">
                    <thead>
                      <tr>
                        <th>קטגוריה</th>
                        <th>מפתח</th>
                        <th>קטגוריית אב</th>
                        <th>מוצרים</th>
                        <th>סטטוס</th>
                        <th className="text-center">מומלצת</th>
                        <th><span className="sr-only">פעולות</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((c) => (
                        <tr key={c.key} className={editing?.key === c.key ? "[&>td]:!bg-[#EEF4FF]" : ""}>
                          <td>
                            <Link href={base({ edit: c.key })} className="flex items-center gap-2.5 group">
                              {c.image ? <img src={c.image} alt="" className="w-10 h-10 rounded-lg object-cover border border-adm-line bg-adm-bg" /> : <span className="w-10 h-10 rounded-lg bg-adm-bg border border-adm-line flex items-center justify-center text-adm-muted"><Icon name="image" size={16} /></span>}
                              <span className="flex flex-col">
                                <b className="text-adm-navy group-hover:underline" style={{ paddingInlineStart: depth(c) * 12 }}>{depth(c) > 0 && <span aria-hidden="true" className="text-adm-muted">↳ </span>}{c.name}</b>
                                {c.description && <span className="text-[12px] text-adm-muted line-clamp-1 max-w-[260px]">{c.description}</span>}
                              </span>
                            </Link>
                          </td>
                          <td dir="ltr" className="text-[13px] text-adm-muted text-right">{c.key}</td>
                          <td className="text-adm-muted">{c.parent ? names[c.parent] || c.parent : "—"}</td>
                          <td className="tabular-nums">{c.count ? <Link href={`/admin/products?category=${c.key}`} className="text-adm-link underline">{c.count}</Link> : 0}</td>
                          <td>{c.active ? <Chip tone="green">פעילה</Chip> : <Chip tone="gray">מוסתרת</Chip>}</td>
                          <td className="text-center">{c.featured ? <span className="inline-flex text-[#C98A00]"><Icon name="star" size={18} className="fill-current" /><span className="sr-only">מומלצת</span></span> : <span className="text-adm-muted" aria-label="לא מומלצת">—</span>}</td>
                          <td>
                            <div className="flex justify-end gap-1">
                              <Link href={base({ edit: c.key })} className="a-btn a-btn-sm !px-2.5" aria-label={`עריכת ${c.name}`}><Icon name="edit" size={16} /></Link>
                              <a href={`/shop?category=${c.key}`} target="_blank" rel="noopener" className="a-btn a-btn-sm !px-2.5" aria-label={`צפייה באתר: ${c.name}`}><Icon name="external" size={16} /></a>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <Empty title="לא נמצאו קטגוריות" text={q ? `אין קטגוריה שמתאימה ל"${q}".` : "אין קטגוריות עדיין."} />
                )}
              </div>
            </>
          )}
        </div>

        {showPanel && (
          <CategoryPanel
            key={editing ? `${editing.key}-${editing.updated_at || ""}` : "new"}
            cat={editing || null}
            all={all.map((c) => ({ key: c.key, name: c.name, parent: c.parent, count: c.count }))}
            canEdit={canEdit}
            storageReady={imageStorageReady()}
            closeHref={base()}
            view={view}
          />
        )}
      </div>
    </>
  );
}
