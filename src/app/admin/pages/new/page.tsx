import { currentAdmin, isAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { hasDb } from "@/lib/db";
import { imageStorageReady } from "@/lib/storage";
import { Notice, PageHeader } from "../../_components/ui";
import PageEditor from "../PageEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "דף חדש" };

export default async function NewPage({ searchParams }: { searchParams: { type?: string } }) {
  if (!isAdmin()) return null;
  const me = await currentAdmin();
  const canEdit = !!me && can(me.perms, "pages", "edit");
  const type = searchParams.type === "blog" ? "blog" : "page";
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin", label: "ראשי" }, { href: `/admin/pages${type === "blog" ? "?tab=blog" : ""}`, label: "דפים ותוכן" }, { label: type === "blog" ? "פוסט חדש" : "דף חדש" }]}
        title={type === "blog" ? "פוסט חדש" : "דף חדש"}
      />
      {!canEdit && <Notice tone="blue">יש לך הרשאת צפייה בלבד בדפים.</Notice>}
      {!hasDb() && <Notice tone="amber">מסד הנתונים לא מחובר – אי אפשר לשמור דפים כרגע.</Notice>}
      <PageEditor
        initial={{ id: null, slug: "", title: "", type, blocks: [{ id: "b1", type: "paragraph", text: "" }], status: "draft", publish_at: "", seo_title: "", seo_description: "", share_image: "" }}
        storageReady={imageStorageReady()}
        canSave={hasDb() && canEdit}
      />
    </>
  );
}
