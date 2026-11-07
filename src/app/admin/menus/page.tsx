import { isAdmin, currentAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { hasDb } from "@/lib/db";
import { getStoreInfo } from "@/lib/site";
import { STORE } from "@/lib/config";
import { defaultMenus, getMenus, listCategoryOptions, listLinkablePages, menusSaved, type Menus } from "@/lib/content";
import { Notice, PageHeader } from "../_components/ui";
import MenusEditor from "./MenusEditor";

export const dynamic = "force-dynamic";
export const metadata = { title: "ניהול תפריטים" };

export default async function MenusAdmin() {
  if (!isAdmin()) return null;
  const me = await currentAdmin();
  const canEdit = !!me && can(me.perms, "menus", "edit");
  let menus: Menus = defaultMenus();
  let saved = false;
  try {
    [menus, saved] = await Promise.all([getMenus(), menusSaved()]);
  } catch (e) {
    console.error(e);
  }
  const [categories, pages] = await Promise.all([listCategoryOptions(), listLinkablePages()]);
  let phone = STORE.phoneDisplay;
  try {
    phone = (await getStoreInfo()).phoneDisplay || phone;
  } catch {}

  return (
    <>
      <PageHeader crumbs={[{ href: "/admin", label: "ראשי" }, { label: "ניהול תפריטים" }]} title="ניהול תפריטים" sub={saved ? "התפריטים באתר נטענים מההגדרות כאן" : "מוצגים כרגע התפריטים המקוריים של האתר"} />
      {!canEdit && <Notice tone="blue">יש לך הרשאת צפייה בלבד בתפריטים.</Notice>}
      <MenusEditor initial={menus} defaults={defaultMenus()} categories={categories} pages={pages} canEdit={canEdit && hasDb()} phone={phone} />
    </>
  );
}
