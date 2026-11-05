import { isAdmin } from "@/lib/auth";
import { listClubMembers } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function ClubAdmin() {
  if (!isAdmin()) return null;
  const members = await listClubMembers();
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display font-bold text-[28px]">מועדון לקוחות <span className="text-muted text-lg">({members.length})</span></h1>
        {members.length > 0 && <a href="/admin/club/export" className="btn btn-dark h-11">הורדה לאקסל (CSV)</a>}
      </div>
      <div className="bg-white rounded-2xl overflow-x-auto">
        {members.length ? (
          <table className="admin-table w-full min-w-[560px]">
            <thead><tr><th>שם</th><th>טלפון</th><th>מייל</th><th>תאריך הצטרפות</th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="font-bold">{m.name}</td>
                  <td dir="ltr" className="text-right">{m.phone}</td>
                  <td dir="ltr" className="text-right">{m.email}</td>
                  <td className="text-muted">{new Date(m.created_at).toLocaleDateString("he-IL")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-muted text-sm p-10 text-center">עדיין אין חברות במועדון</p>
        )}
      </div>
    </div>
  );
}
