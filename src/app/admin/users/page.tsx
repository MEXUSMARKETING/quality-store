import Link from "next/link";
import { currentAdmin, isAdmin } from "@/lib/auth";
import { db, hasDb } from "@/lib/db";
import { MODULES, ROLES, can, permsFor, type Level, type Module, type PermissionMap } from "@/lib/permissions";
import { Chip, Empty, Icon, LinkTabs, Notice, PageHeader, fmtDateTime, type Tone } from "../_components/ui";
import { deleteUserAction, toggleUserAction } from "./actions";
import { ConfirmSubmit, UserDrawer, type UserFormValues } from "./UsersClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "משתמשים והרשאות" };

type SP = { tab?: string; edit?: string; new?: string; saved?: string; deleted?: string; error?: string; status?: string; q?: string; range?: string };

type UserRow = { id: number; email: string; name: string; role: string; permissions: Record<string, Level | null> | null; active: boolean; last_login: string | null; created_at: string };
type LoginRow = { id: number; user_id: number | null; email: string; ok: boolean; ip: string; user_agent: string; created_at: string; name: string | null };

const ROLE_TONE: Record<string, Tone> = { owner: "purple", store_manager: "blue", product_manager: "green", order_manager: "amber", content_manager: "gray", marketing_manager: "red" };

const iso = (v: any) => (v ? new Date(v).toISOString() : null);

function device(ua: string): string {
  if (!ua) return "—";
  const os = /iPhone/.test(ua) ? "iPhone" : /iPad/.test(ua) ? "iPad" : /Android/.test(ua) ? "Android" : /Windows/.test(ua) ? "Windows" : /Mac OS X|Macintosh/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
  const br = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /OPR\/|Opera/.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  const kind = /Mobile|iPhone|Android.*Mobile/.test(ua) ? "נייד" : /iPad|Tablet/.test(ua) ? "טאבלט" : "מחשב";
  return [kind, os, br].filter(Boolean).join(" · ") || ua.slice(0, 40);
}

/** IPs are already stored masked (first two octets); mask again defensively for older rows. */
const maskIp = (ip: string) => (!ip ? "—" : ip.includes("x") || ip.includes("…") ? ip : ip.includes(".") ? ip.split(".").slice(0, 2).join(".") + ".x.x" : ip.slice(0, 9) + "…");

function qs(base: SP, patch: Partial<SP>) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...patch })) if (v) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

function LevelCell({ l }: { l?: Level | null }) {
  if (l === "edit") return <Chip tone="green">עריכה</Chip>;
  if (l === "view") return <Chip tone="blue">צפייה</Chip>;
  return <span className="text-adm-muted text-[13px]">—</span>;
}

export default async function UsersPage({ searchParams }: { searchParams: SP }) {
  if (!isAdmin()) return null;
  const me = await currentAdmin();
  if (!me) return null;
  const canEdit = can(me.perms, "users", "edit");
  const isOwner = me.role === "owner";
  const tab = ["roles", "history"].includes(searchParams.tab || "") ? searchParams.tab! : "users";

  let users: UserRow[] = [];
  let logins: LoginRow[] = [];
  let loadError = false;
  if (hasDb()) {
    try {
      const sql = await db();
      const r = await sql`select id, email, name, role, permissions, active, last_login, created_at from admin_users order by active desc, name asc, id asc`;
      users = r.map((u: any) => ({ id: Number(u.id), email: u.email, name: u.name || "", role: u.role, permissions: typeof u.permissions === "string" ? JSON.parse(u.permissions) : u.permissions, active: !!u.active, last_login: iso(u.last_login), created_at: iso(u.created_at)! }));
      if (tab === "history") {
        const status = searchParams.status === "ok" ? true : searchParams.status === "failed" ? false : null;
        const q = searchParams.q ? `%${searchParams.q.trim()}%` : null;
        const days = { "1": 1, "7": 7, "30": 30, "90": 90 }[searchParams.range || "30"] || 30;
        const h = await sql`
          select l.id, l.user_id, l.email, l.ok, l.ip, l.user_agent, l.created_at, u.name
          from login_history l left join admin_users u on u.id = l.user_id and l.user_id > 0
          where l.created_at >= now() - make_interval(days => ${days}::int)
            and (${status}::boolean is null or l.ok = ${status}::boolean)
            and (${q}::text is null or l.email ilike ${q} or u.name ilike ${q} or (l.user_id = 0 and 'מנהל ראשי' ilike ${q}))
          order by l.id desc limit 300`;
        logins = h.map((x: any) => ({ id: Number(x.id), user_id: x.user_id === null ? null : Number(x.user_id), email: x.email || "", ok: !!x.ok, ip: x.ip || "", user_agent: x.user_agent || "", created_at: iso(x.created_at)!, name: x.name || null }));
      }
    } catch (e) {
      console.error(e);
      loadError = true;
    }
  }

  // drawer
  let drawer: UserFormValues | null = null;
  let editMissing = false;
  let editForbidden = false;
  if (canEdit && tab === "users" && hasDb()) {
    if (searchParams.new) drawer = { id: null, name: "", email: "", role: "store_manager", permissions: null, custom: false };
    else if (searchParams.edit) {
      const u = users.find((x) => x.id === Number(searchParams.edit));
      if (!u) editMissing = true;
      else if (!isOwner && (u.role === "owner" || permsFor(u.role, u.permissions as PermissionMap).users === "edit") && u.id !== me.id) editForbidden = true;
      else drawer = { id: u.id, name: u.name, email: u.email, role: u.role, permissions: (u.permissions as PermissionMap) || null, custom: !!u.permissions && Object.keys(u.permissions).length > 0 };
    }
  }
  const editingUser = drawer?.id ? users.find((u) => u.id === drawer!.id) : null;
  const manageable = (u: UserRow) => canEdit && (isOwner || (u.role !== "owner" && permsFor(u.role, u.permissions as PermissionMap).users !== "edit"));

  const tabs = [
    { href: "/admin/users", label: "משתמשים", count: users.length + 1, active: tab === "users" },
    { href: "/admin/users?tab=roles", label: "תפקידים והרשאות", active: tab === "roles" },
    { href: "/admin/users?tab=history", label: "היסטוריית התחברות", active: tab === "history" },
  ];

  return (
    <>
      <PageHeader crumbs={[{ href: "/admin", label: "ראשי" }, { label: "משתמשים והרשאות" }]} title="משתמשים והרשאות" sub="מי נכנס למערכת הניהול ומה כל אחד יכול לראות ולשנות">
        {canEdit && tab === "users" && hasDb() && <Link href="/admin/users?new=1" className="a-btn a-btn-primary"><Icon name="plus" /> משתמש חדש</Link>}
      </PageHeader>

      {searchParams.saved && <Notice tone="green">השינויים של <b>{searchParams.saved}</b> נשמרו.</Notice>}
      {searchParams.deleted && <Notice tone="green">המשתמש <b>{searchParams.deleted}</b> נמחק ולא יוכל להתחבר יותר.</Notice>}
      {searchParams.error === "self" && <Notice tone="amber">אי אפשר להשבית או למחוק את המשתמש שלך.</Notice>}
      {searchParams.error === "owner" && <Notice tone="amber">רק המנהל הראשי יכול לנהל את המשתמש הזה.</Notice>}
      {editMissing && <Notice tone="red">המשתמש המבוקש לא נמצא. ייתכן שנמחק.</Notice>}
      {editForbidden && <Notice tone="amber">רק המנהל הראשי יכול לערוך את המשתמש הזה.</Notice>}
      {loadError && <Notice tone="red">לא הצלחנו לטעון את רשימת המשתמשים. נסו לרענן.</Notice>}

      <div className="a-card !p-0 overflow-hidden">
        <div className="px-3 pt-1"><LinkTabs tabs={tabs} /></div>

        {tab === "users" && (
          <div className="overflow-x-auto">
            <table className="a-table min-w-[860px]">
              <thead>
                <tr><th>משתמש</th><th>תפקיד</th><th>פעיל</th><th>התחברות אחרונה</th><th><span className="sr-only">פעולות</span></th></tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <b className="text-[14px]">מנהל ראשי (סיסמת המערכת)</b>
                    <div className="text-[13px] text-adm-muted">נכנס עם ADMIN_PASSWORD, בלי אימייל{me.id === 0 && " · זה את/ה"}</div>
                  </td>
                  <td><Chip tone="purple">{ROLES.owner.label}</Chip></td>
                  <td><Chip tone="green">תמיד פעיל</Chip></td>
                  <td className="text-[13px] text-adm-muted">ראו בהיסטוריית ההתחברות</td>
                  <td className="text-[13px] text-adm-muted"><span className="flex items-center gap-1.5 justify-end"><Icon name="lock" size={15} /> מנוהל ב־Vercel</span></td>
                </tr>
                {users.map((u) => {
                  const custom = !!u.permissions && Object.keys(u.permissions).length > 0;
                  const mine = u.id === me.id;
                  const canManage = manageable(u) || (canEdit && mine);
                  return (
                    <tr key={u.id} className={u.active ? "" : "opacity-75"}>
                      <td>
                        <b className="text-[14px]">{u.name || "ללא שם"}</b>{mine && <span className="text-[12px] text-adm-muted"> · זה את/ה</span>}
                        <div className="text-[13px] text-adm-muted" dir="ltr" style={{ textAlign: "right" }}>{u.email}</div>
                      </td>
                      <td>
                        <span className="flex flex-wrap gap-1.5 items-center">
                          <Chip tone={ROLE_TONE[u.role] || "gray"}>{ROLES[u.role]?.label || u.role}</Chip>
                          {custom && <Chip tone="amber">הרשאות מותאמות</Chip>}
                        </span>
                      </td>
                      <td>
                        {manageable(u) && !mine ? (
                          <form action={toggleUserAction}>
                            <input type="hidden" name="id" value={u.id} />
                            <button type="submit" role="switch" aria-checked={u.active} aria-label={`${u.active ? "השבתת" : "הפעלת"} המשתמש ${u.name || u.email}`} className="h-9 px-1.5 flex items-center gap-2 rounded-lg hover:bg-adm-bg text-[13px]">
                              <span className={`w-10 h-[22px] rounded-full p-[3px] flex transition-colors ${u.active ? "bg-[#0F7A57] justify-end" : "bg-[#B7C0CF] justify-start"}`} dir="ltr"><span className="w-4 h-4 rounded-full bg-white shadow" /></span>
                              {u.active ? "פעיל" : "מושבת"}
                            </button>
                          </form>
                        ) : u.active ? <Chip tone="green">פעיל</Chip> : <Chip tone="gray">מושבת</Chip>}
                      </td>
                      <td className="text-[13px] whitespace-nowrap">{u.last_login ? fmtDateTime(u.last_login) : <span className="text-adm-muted">עוד לא התחבר/ה</span>}</td>
                      <td>
                        {canManage && (
                          <div className="flex items-center gap-1.5 justify-end">
                            <Link href={`/admin/users?edit=${u.id}`} className="a-btn a-btn-sm !px-2.5" aria-label={`עריכת ${u.name || u.email}`} title="עריכה"><Icon name="edit" size={15} /></Link>
                            {!mine && <ConfirmSubmit action={deleteUserAction} id={u.id} danger ariaLabel={`מחיקת ${u.name || u.email}`} message={`למחוק את המשתמש ${u.name || u.email}? הוא לא יוכל להתחבר יותר. היסטוריית הפעולות שלו נשמרת ביומן.`} />}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {users.length === 0 && (
              <Empty title="עדיין אין חברי צוות" text={hasDb() ? "הוסיפו עובדים עם אימייל וסיסמה משלהם, ובחרו לכל אחד תפקיד – כך כל אחד רואה רק את מה שהוא צריך." : "כדי להוסיף חברי צוות יש לחבר מסד נתונים."}>
                {canEdit && hasDb() && <Link href="/admin/users?new=1" className="a-btn a-btn-primary"><Icon name="plus" /> משתמש חדש</Link>}
              </Empty>
            )}
          </div>
        )}

        {tab === "roles" && (
          <div className="flex flex-col gap-3 p-4">
            <p className="text-[14px] leading-6 text-adm-text">
              לכל משתמש יש תפקיד שקובע את ההרשאות שלו כברירת מחדל. אפשר להתאים הרשאות למשתמש מסוים בעריכת המשתמש.
              <b> צפייה</b> – רואה את העמוד ואת הנתונים. <b>עריכה</b> – יכול גם לשנות, להוסיף ולמחוק.
            </p>
            <Notice tone="blue"><b>ההרשאות נאכפות בשרת</b> – כל פעולה נבדקת מחדש בשרת, גם אם מישהו מנסה לעקוף את הממשק. משתמש מושבת מנותק מיד.</Notice>
            <div className="overflow-x-auto border border-adm-line rounded-xl">
              <table className="a-table min-w-[900px]">
                <caption className="sr-only">הרשאות ברירת מחדל לפי תפקיד</caption>
                <thead>
                  <tr><th scope="col">מודול</th>{Object.entries(ROLES).map(([k, r]) => <th key={k} scope="col">{r.label}</th>)}</tr>
                </thead>
                <tbody>
                  {(Object.keys(MODULES) as Module[]).map((m) => (
                    <tr key={m}>
                      <th scope="row" className="!bg-white !text-[13px] !text-adm-text !font-semibold">{MODULES[m]}</th>
                      {Object.entries(ROLES).map(([k, r]) => <td key={k}><LevelCell l={r.perms[m]} /></td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[13px] text-adm-muted">רק המנהל הראשי יכול למנות מנהל ראשי נוסף או לתת הרשאת עריכה ל&quot;משתמשים והרשאות&quot;. אי אפשר לשנות את ההרשאות של עצמך.</p>
          </div>
        )}

        {tab === "history" && (
          <div className="flex flex-col">
            <form method="get" className="flex flex-wrap gap-3 items-end p-4 border-b border-adm-line">
              <input type="hidden" name="tab" value="history" />
              <label className="a-field min-w-[200px] flex-1">
                חיפוש לפי שם או אימייל
                <input name="q" defaultValue={searchParams.q || ""} className="a-input" />
              </label>
              <label className="a-field">
                סטטוס
                <select name="status" defaultValue={searchParams.status || ""} className="a-input">
                  <option value="">הכל</option>
                  <option value="ok">הצליחו</option>
                  <option value="failed">נכשלו</option>
                </select>
              </label>
              <label className="a-field">
                תקופה
                <select name="range" defaultValue={searchParams.range || "30"} className="a-input">
                  <option value="1">24 שעות</option>
                  <option value="7">7 ימים</option>
                  <option value="30">30 יום</option>
                  <option value="90">90 יום</option>
                </select>
              </label>
              <button type="submit" className="a-btn a-btn-dark">סינון</button>
              {(searchParams.q || searchParams.status || (searchParams.range && searchParams.range !== "30")) && <Link href="/admin/users?tab=history" className="a-btn">ניקוי</Link>}
            </form>
            {logins.length === 0 ? (
              <Empty title="אין התחברויות להצגה" text={hasDb() ? "לא נמצאו ניסיונות התחברות בסינון הזה." : "היסטוריית ההתחברות נשמרת במסד הנתונים."} />
            ) : (
              <div className="overflow-x-auto">
                <table className="a-table min-w-[760px]">
                  <thead><tr><th>זמן</th><th>משתמש</th><th>תוצאה</th><th>רשת (IP חלקי)</th><th>מכשיר</th></tr></thead>
                  <tbody>
                    {logins.map((l) => (
                      <tr key={l.id}>
                        <td className="text-[13px] whitespace-nowrap">{fmtDateTime(l.created_at)}</td>
                        <td>
                          <b className="text-[14px]">{l.user_id === 0 ? "מנהל ראשי" : l.name || (l.user_id ? "משתמש שנמחק" : "לא מוכר")}</b>
                          {l.email && <div className="text-[13px] text-adm-muted" dir="ltr" style={{ textAlign: "right" }}>{l.email}</div>}
                        </td>
                        <td>{l.ok ? <Chip tone="green">הצליחה</Chip> : <Chip tone="red">נכשלה</Chip>}</td>
                        <td className="text-[13px] font-mono" dir="ltr" style={{ textAlign: "right" }}>{maskIp(l.ip)}</td>
                        <td className="text-[13px]" title={l.user_agent}>{device(l.user_agent)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-[12px] text-adm-muted p-4">מוצגות עד 300 רשומות אחרונות. כתובות IP נשמרות באופן חלקי בלבד לשמירה על פרטיות.</p>
          </div>
        )}
      </div>

      {drawer && <UserDrawer key={drawer.id ?? "new"} initial={drawer} isOwner={isOwner} myPerms={me.perms} isSelf={drawer.id === me.id} canReset={!!editingUser && editingUser.id !== me.id} />}
    </>
  );
}
