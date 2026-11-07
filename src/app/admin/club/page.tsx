import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { listClubMembers } from "@/lib/store";
import { Empty, Icon, PageHeader, fmtDate } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function ClubAdmin() {
  if (!isAdmin()) return null;
  const members = await listClubMembers();
  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin", label: "ראשי" }, { label: "מועדון לקוחות" }]}
        title="מועדון לקוחות"
        sub={`${members.length} הצטרפויות דרך טופס המועדון באתר. כל מצטרפת נשמרת גם ככרטיס לקוחה עם הסכמה לדיוור.`}
      >
        <Link href="/admin/customers?seg=consent" className="a-btn"><Icon name="users" /> כל מאשרי הדיוור</Link>
        {members.length > 0 && <a href="/admin/club/export" className="a-btn a-btn-dark" download><Icon name="download" /> ייצוא CSV</a>}
      </PageHeader>
      <section className="a-card !p-0 overflow-hidden">
        {members.length ? (
          <div className="overflow-x-auto">
            <table className="a-table min-w-[560px]">
              <thead><tr><th>שם</th><th>טלפון</th><th>מייל</th><th>תאריך הצטרפות</th></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td className="font-semibold">{m.name || "—"}</td>
                    <td dir="ltr" className="text-right whitespace-nowrap">{m.phone}</td>
                    <td dir="ltr" className="text-right">{m.email}</td>
                    <td className="text-adm-muted">{fmtDate(m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="עדיין אין חברות במועדון" text="הצטרפויות מטופס המועדון באתר יופיעו כאן." />
        )}
      </section>
    </>
  );
}
