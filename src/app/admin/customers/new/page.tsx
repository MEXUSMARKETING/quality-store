import { isAdmin } from "@/lib/auth";
import { PageHeader } from "../../_components/ui";
import { NewCustomerForm } from "../_components/forms";

export const dynamic = "force-dynamic";

export default function NewCustomerPage() {
  if (!isAdmin()) return null;
  return (
    <>
      <PageHeader crumbs={[{ href: "/admin", label: "ראשי" }, { href: "/admin/customers", label: "לקוחות" }, { label: "הוספת לקוח" }]} title="הוספת לקוח" sub="לקוחות שמזמינים באתר נוספים אוטומטית. כאן מוסיפים לקוחה מהחנות או מהטלפון." />
      <NewCustomerForm />
    </>
  );
}
