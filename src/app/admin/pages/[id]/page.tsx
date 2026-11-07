import Link from "next/link";
import { currentAdmin, isAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { hasDb } from "@/lib/db";
import { imageStorageReady } from "@/lib/storage";
import { getPageById, toIsraelLocalInput, type CmsPage } from "@/lib/content";
import { Chip, Empty, Icon, Notice, PageHeader, fmtDateTime } from "../../_components/ui";
import PageEditor from "../PageEditor";
import { deletePageAction, duplicatePageAction } from "../actions";
import ConfirmForm from "../ConfirmForm";
import { pageState } from "../lib";

export const dynamic = "force-dynamic";
export const metadata = { title: "עריכת דף" };

export default async function EditPage({ params, searchParams }: { params: { id: string }; searchParams: { saved?: string } }) {
  if (!isAdmin()) return null;
  const me = await currentAdmin();
  const canEdit = !!me && can(me.perms, "pages", "edit");
  let page: CmsPage | null = null;
  try {
    page = await getPageById(Number(params.id));
  } catch (e) {
    console.error(e);
  }
  if (!page) {
    return (
      <div className="a-card">
        <Empty title="הדף לא נמצא" text="ייתכן שנמחק.">
          <Link href="/admin/pages" className="a-btn">חזרה לדפים</Link>
        </Empty>
      </div>
    );
  }
  const st = pageState(page);
  const listHref = `/admin/pages${page.type === "blog" ? "?tab=blog" : ""}`;
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin", label: "ראשי" }, { href: listHref, label: "דפים ותוכן" }, { label: page.title }]}
        title={page.title}
        sub={<span className="flex items-center gap-2 flex-wrap"><Chip tone={st.tone}>{st.label}</Chip> עודכן {fmtDateTime(page.updated_at)}</span>}
      >
        <a href={`/info/${page.slug}`} target="_blank" rel="noopener" className="a-btn"><Icon name="external" size={16} /> צפייה באתר</a>
        {canEdit && <ConfirmForm action={duplicatePageAction} id={page.id} icon="copy" danger={false} label="שכפול" ariaLabel={`שכפול ${page.title}`} />}
        {canEdit && <ConfirmForm action={deletePageAction} id={page.id} label="מחיקה" ariaLabel={`מחיקת ${page.title}`} message={`למחוק את "${page.title}"? הכתובת /info/${page.slug} תפסיק לעבוד. לא ניתן לבטל.`} />}
      </PageHeader>
      {!canEdit && <Notice tone="blue">יש לך הרשאת צפייה בלבד בדפים.</Notice>}
      {searchParams.saved === "1" && <Notice tone="green">הדף נוצר ונשמר.</Notice>}
      {searchParams.saved === "dup" && <Notice tone="green">נוצר עותק כטיוטה. שנו כותרת וכתובת לפני הפרסום.</Notice>}
      <PageEditor
        key={page.id}
        initial={{
          id: page.id,
          slug: page.slug,
          title: page.title,
          type: page.type,
          blocks: page.blocks,
          status: page.status,
          publish_at: toIsraelLocalInput(page.publish_at),
          seo_title: page.seo_title,
          seo_description: page.seo_description,
          share_image: page.share_image,
        }}
        storageReady={imageStorageReady()}
        canSave={hasDb() && canEdit}
      />
    </>
  );
}
