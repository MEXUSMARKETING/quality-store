import Link from "next/link";
import { currentAdmin, isAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { hasDb } from "@/lib/db";
import { ensurePagesSeeded, listPages, type CmsPage } from "@/lib/content";
import { Chip, Empty, Icon, LinkTabs, Notice, PageHeader, fmtDateTime } from "../_components/ui";
import { deletePageAction, duplicatePageAction } from "./actions";
import ConfirmForm from "./ConfirmForm";
import { pageState } from "./lib";

export const dynamic = "force-dynamic";
export const metadata = { title: "דפים ותוכן" };

export default async function PagesAdmin({ searchParams }: { searchParams: { tab?: string; q?: string; status?: string; deleted?: string } }) {
  if (!isAdmin()) return null;

  const me = await currentAdmin();
  const canEdit = !!me && can(me.perms, "pages", "edit");
  let pages: CmsPage[] = [];
  let loadError = false;
  if (hasDb()) {
    try {
      if (canEdit) await ensurePagesSeeded();
      pages = await listPages();
    } catch (e) {
      console.error(e);
      loadError = true;
    }
  }

  const tab = searchParams.tab === "blog" ? "blog" : "page";
  const q = String(searchParams.q || "").trim();
  const status = ["draft", "published", "scheduled"].includes(String(searchParams.status)) ? String(searchParams.status) : "";
  const now = new Date();
  const ofType = pages.filter((p) => p.type === tab);
  const shown = ofType.filter((p) => (!q || p.title.includes(q) || p.slug.includes(q.toLowerCase())) && (!status || p.status === status));
  const counts = { page: pages.filter((p) => p.type === "page").length, blog: pages.filter((p) => p.type === "blog").length };
  const qs = (o: Record<string, string>) => {
    const u = new URLSearchParams();
    if (tab === "blog") u.set("tab", "blog");
    for (const [k, v] of Object.entries(o)) if (v) u.set(k, v);
    const s = u.toString();
    return "/admin/pages" + (s ? "?" + s : "");
  };

  return (
    <>
      <PageHeader crumbs={[{ href: "/admin", label: "ראשי" }, { label: "דפים ותוכן" }]} title="דפים ותוכן" sub="דפי מידע (משלוחים, תקנון, מידות…) ופוסטים לבלוג. כל דף זמין בכתובת /info/<כתובת>.">
        {hasDb() && canEdit && (
          <Link href={`/admin/pages/new${tab === "blog" ? "?type=blog" : ""}`} className="a-btn a-btn-primary"><Icon name="plus" /> {tab === "blog" ? "פוסט חדש" : "דף חדש"}</Link>
        )}
      </PageHeader>

      {searchParams.deleted && <Notice tone="green">הדף <b>{searchParams.deleted}</b> נמחק.</Notice>}
      {loadError && <Notice tone="red">לא הצלחנו לטעון את הדפים. האתר ממשיך להציג את דפי המידע המקוריים.</Notice>}
      {!hasDb() && <Notice tone="blue">בלי מסד נתונים האתר מציג את דפי המידע המקוריים. אחרי החיבור הם ייטענו לכאן לעריכה.</Notice>}

      <div className="a-card !p-0 overflow-hidden">
        <div className="px-3 pt-1">
          <LinkTabs
            tabs={[
              { href: "/admin/pages", label: "עמודים", count: counts.page, active: tab === "page" },
              { href: "/admin/pages?tab=blog", label: "בלוג", count: counts.blog, active: tab === "blog" },
            ]}
          />
        </div>
        <form className="flex flex-wrap gap-2 p-3 border-b border-adm-line" role="search">
          {tab === "blog" && <input type="hidden" name="tab" value="blog" />}
          <label className="flex-1 min-w-[200px]">
            <span className="sr-only">חיפוש</span>
            <input name="q" defaultValue={q} placeholder="חיפוש לפי כותרת או כתובת" className="a-input" />
          </label>
          <label>
            <span className="sr-only">סטטוס</span>
            <select name="status" defaultValue={status} className="a-input !w-auto">
              <option value="">כל הסטטוסים</option>
              <option value="published">מפורסם</option>
              <option value="scheduled">מתוזמן</option>
              <option value="draft">טיוטה</option>
            </select>
          </label>
          <button className="a-btn"><Icon name="search" size={16} /> סינון</button>
          {(q || status) && <Link href={qs({})} className="a-btn">ניקוי</Link>}
        </form>

        {shown.length === 0 ? (
          ofType.length === 0 ? (
            <Empty title={tab === "blog" ? "עדיין אין פוסטים" : "עדיין אין דפים"} text={tab === "blog" ? "פוסטים בבלוג עוזרים לקידום בגוגל – למשל ״איך לבחור מידה במגפונים״ או ״טיפים לטיפוח עור״." : "צרו דף מידע ראשון."}>
              {hasDb() && canEdit && <Link href={`/admin/pages/new${tab === "blog" ? "?type=blog" : ""}`} className="a-btn a-btn-primary"><Icon name="plus" /> {tab === "blog" ? "פוסט חדש" : "דף חדש"}</Link>}
            </Empty>
          ) : (
            <Empty title="לא נמצאו תוצאות" text="נסו חיפוש אחר או נקו את הסינון." />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="a-table min-w-[760px]">
              <thead>
                <tr>
                  <th>כותרת</th>
                  <th>כתובת</th>
                  <th>סטטוס</th>
                  <th>עודכן</th>
                  <th><span className="sr-only">פעולות</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => {
                  const st = pageState(p, now);
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/admin/pages/${p.id}`} className="font-bold text-adm-navy hover:underline">{p.title}</Link>
                        <div className="text-[12px] text-adm-muted">{p.blocks.length} בלוקים{p.seo_title || p.seo_description ? " · SEO מוגדר" : ""}</div>
                      </td>
                      <td><span dir="ltr" className="font-mono text-[13px] text-adm-muted">/info/{p.slug}</span></td>
                      <td>
                        <Chip tone={st.tone}>{st.label}</Chip>
                        {p.status === "scheduled" && p.publish_at && <div className="text-[12px] text-adm-muted pt-1">{fmtDateTime(p.publish_at)}</div>}
                      </td>
                      <td className="text-[13px] whitespace-nowrap">{fmtDateTime(p.updated_at)}</td>
                      <td>
                        <div className="flex items-center gap-1.5 justify-end">
                          <a href={`/info/${p.slug}`} target="_blank" rel="noopener" className="a-btn a-btn-sm !h-9 !px-2.5" aria-label={`צפייה בדף ${p.title} באתר`} title="צפייה באתר"><Icon name="external" size={15} /></a>
                          <Link href={`/admin/pages/${p.id}`} className="a-btn a-btn-sm !h-9 !px-2.5" aria-label={`עריכת ${p.title}`} title="עריכה"><Icon name="edit" size={15} /></Link>
                          {canEdit && <ConfirmForm action={duplicatePageAction} id={p.id} icon="copy" danger={false} ariaLabel={`שכפול ${p.title}`} />}
                          {canEdit && <ConfirmForm action={deletePageAction} id={p.id} ariaLabel={`מחיקת ${p.title}`} message={`למחוק את "${p.title}"? הכתובת /info/${p.slug} תפסיק לעבוד${["shipping", "sizes", "terms", "privacy", "accessibility"].includes(p.slug) ? " (ייתכן שיש אליה קישור בפוטר)" : ""}. לא ניתן לבטל.`} />}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[13px] text-adm-muted">דף מתוזמן מתפרסם אוטומטית בתאריך שנבחר. דף בטיוטה לא נגיש באתר.</p>
    </>
  );
}
