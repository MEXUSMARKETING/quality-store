import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { listAudit } from "@/lib/admin";
import type { AuditLog } from "@/lib/types";
import { Chip, Empty, Icon, Notice, PageHeader } from "../_components/ui";
import { ACTIONS, ENTITIES, ENTITY_SINGLE, FIELD_LABELS, RANGES, entityHref, fmtValue, israelTodayStart, sinceFor } from "./meta";

export const dynamic = "force-dynamic";
export const metadata = { title: "יומן פעילות" };

const TZ = "Asia/Jerusalem";
const LIMIT = 500;

type SP = { entity?: string; action?: string; q?: string; range?: string };

function qs(base: SP, patch: Partial<SP>) {
  const p = new URLSearchParams();
  const all = { ...base, ...patch };
  for (const [k, v] of Object.entries(all)) if (v) p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });

function dayLabel(key: string) {
  const today = israelTodayStart();
  const todayKey = dayKey(today.toISOString());
  const yKey = dayKey(new Date(today.getTime() - 12 * 3600 * 1000).toISOString());
  if (key === todayKey) return "היום";
  if (key === yKey) return "אתמול";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("he-IL", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const time = (iso: string) => new Date(iso).toLocaleTimeString("he-IL", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

function Diff({ a }: { a: AuditLog }) {
  const before = (a.before || {}) as Record<string, unknown>;
  const after = (a.after || {}) as Record<string, unknown>;
  const fields = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  if (!fields.length) return null;
  return (
    <details className="group mt-2">
      <summary className="inline-flex items-center gap-1.5 min-h-[36px] text-[13px] font-semibold text-adm-link cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden">
        <Icon name="arrowLeft" size={14} className="transition-transform group-open:-rotate-90" />
        <span className="group-open:hidden">הצגת {fields.length} שינויים</span>
        <span className="hidden group-open:inline">הסתרת השינויים</span>
      </summary>
      <div className="mt-2 border border-adm-line rounded-xl overflow-x-auto">
        <table className="a-table min-w-[420px]">
          <caption className="sr-only">שינויים: {a.summary}</caption>
          <thead><tr><th scope="col">שדה</th><th scope="col">ערך קודם</th><th scope="col">ערך חדש</th></tr></thead>
          <tbody>
            {fields.map((f) => {
              const has = (o: Record<string, unknown>) => Object.prototype.hasOwnProperty.call(o, f);
              return (
                <tr key={f}>
                  <th scope="row" className="!bg-white !text-[13px] !text-adm-text !font-semibold align-top">{FIELD_LABELS[f] || f}</th>
                  <td className="align-top text-[13px] break-words max-w-[280px]">
                    {has(before) ? <del className="text-[#B03A3A] bg-[#FDECEC] rounded px-1.5 py-0.5 [text-decoration-thickness:1px]"><span className="sr-only">ערך קודם: </span>{fmtValue(f, before[f])}</del> : <span className="text-adm-muted">—</span>}
                  </td>
                  <td className="align-top text-[13px] break-words max-w-[280px]">
                    {has(after) ? <ins className="text-[#0B5E43] bg-[#E6F6F0] rounded px-1.5 py-0.5 no-underline font-semibold"><span className="sr-only">ערך חדש: </span>{fmtValue(f, after[f])}</ins> : <span className="text-adm-muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default async function ActivityPage({ searchParams }: { searchParams: SP }) {
  if (!isAdmin()) return null;
  const sp: SP = {
    entity: ENTITIES[searchParams.entity || ""] ? searchParams.entity : undefined,
    action: ACTIONS[searchParams.action || ""] ? searchParams.action : undefined,
    q: (searchParams.q || "").trim().slice(0, 100) || undefined,
    range: RANGES[searchParams.range || ""] ? searchParams.range : undefined,
  };
  const range = sp.range || "30d";

  let rows: AuditLog[] = [];
  let failed = false;
  try {
    rows = await listAudit({
      entities: sp.entity ? ENTITIES[sp.entity].db : undefined,
      action: sp.action,
      q: sp.q,
      since: sinceFor(range),
      limit: LIMIT,
    });
  } catch (e) {
    console.error(e);
    failed = true;
  }

  const groups: { key: string; items: AuditLog[] }[] = [];
  for (const r of rows) {
    const k = dayKey(r.created_at);
    if (!groups.length || groups[groups.length - 1].key !== k) groups.push({ key: k, items: [] });
    groups[groups.length - 1].items.push(r);
  }
  const filtered = !!(sp.entity || sp.action || sp.q || sp.range);

  return (
    <>
      <PageHeader crumbs={[{ href: "/admin", label: "ראשי" }, { label: "יומן פעילות" }]} title="יומן פעילות" sub="כל שינוי שנעשה במערכת הניהול, לפי סדר כרונולוגי">
        <a href={`/admin/activity/export${qs(sp, {})}`} className="a-btn"><Icon name="download" /> ייצוא CSV</a>
      </PageHeader>

      <Notice tone="blue">
        <span className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          היומן נשמר אוטומטית ולא ניתן לעריכה או מחיקה
        </span>
      </Notice>

      <section aria-label="סינון היומן" className="a-card flex flex-col gap-3.5">
        <form method="get" action="/admin/activity" className="flex flex-wrap gap-3 items-end">
          {sp.action && <input type="hidden" name="action" value={sp.action} />}
          <label className="a-field flex-1 min-w-[200px]">
            חיפוש
            <input name="q" defaultValue={sp.q} type="search" placeholder="שם מוצר, מספר הזמנה, קוד קופון…" className="a-input" />
          </label>
          <label className="a-field w-[160px]">
            סוג
            <select name="entity" defaultValue={sp.entity || ""} className="a-input">
              <option value="">הכל</option>
              {Object.entries(ENTITIES).map(([k, e]) => <option key={k} value={k}>{e.label}</option>)}
            </select>
          </label>
          <label className="a-field w-[140px]">
            תקופה
            <select name="range" defaultValue={range} className="a-input">
              {Object.entries(RANGES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
            </select>
          </label>
          <button type="submit" className="a-btn a-btn-dark"><Icon name="search" /> סינון</button>
          {filtered && <Link href="/admin/activity" className="a-btn">ניקוי</Link>}
        </form>
        <nav aria-label="סוג פעולה" className="flex flex-wrap gap-1.5">
          <Link href={`/admin/activity${qs(sp, { action: undefined })}`} aria-current={!sp.action ? "page" : undefined} className={`h-9 px-3 rounded-full text-[13px] font-semibold flex items-center border ${!sp.action ? "bg-adm-navy text-white border-adm-navy hover:text-white" : "bg-white text-adm-mid border-adm-line hover:bg-adm-bg"}`}>כל הפעולות</Link>
          {Object.entries(ACTIONS).filter(([k]) => k !== "settings").map(([k, a]) => {
            const on = sp.action === k;
            return (
              <Link key={k} href={`/admin/activity${qs(sp, { action: on ? undefined : k })}`} aria-current={on ? "page" : undefined} className={`h-9 px-3 rounded-full text-[13px] font-semibold flex items-center gap-1.5 border ${on ? "bg-adm-navy text-white border-adm-navy hover:text-white" : "bg-white text-adm-mid border-adm-line hover:bg-adm-bg"}`}>
                <Icon name={a.icon} size={14} /> {a.label}
              </Link>
            );
          })}
        </nav>
      </section>

      {failed ? (
        <Notice tone="red">לא הצלחנו לטעון את היומן כרגע. נסו לרענן את הדף.</Notice>
      ) : rows.length === 0 ? (
        <div className="a-card">
          <Empty title={filtered ? "אין פעולות שמתאימות לסינון" : "היומן עדיין ריק"} text={filtered ? "נסו תקופה ארוכה יותר או סוג פעולה אחר." : "כל שינוי במוצרים, הזמנות, לקוחות וקופונים יירשם כאן אוטומטית."}>
            {filtered && <Link href="/admin/activity?range=all" className="a-btn">הצגת כל היומן</Link>}
          </Empty>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-[13px] text-adm-muted -mb-2">{rows.length >= LIMIT ? `מוצגות ${LIMIT} הפעולות האחרונות – צמצמו את הסינון או ייצאו ל־CSV כדי לראות עוד.` : `${rows.length} פעולות`}</p>
          {groups.map((g) => (
            <section key={g.key} aria-labelledby={`day-${g.key}`} className="flex flex-col gap-2">
              <h2 id={`day-${g.key}`} className="text-[14px] font-bold text-adm-navy flex items-center gap-2">
                {dayLabel(g.key)} <span className="a-count">{g.items.length}</span>
              </h2>
              <ol className="a-card !p-0 overflow-hidden">
                {g.items.map((a) => {
                  const meta = ACTIONS[a.action] || { label: a.action, icon: "edit" as const, tone: "gray" as const };
                  const href = entityHref(a.entity, a.entity_id);
                  return (
                    <li key={a.id} className="flex gap-3 px-4 py-3.5 border-b border-[#EEF1F6] last:border-0">
                      <span className={`w-9 h-9 rounded-[10px] shrink-0 flex items-center justify-center ${{ green: "bg-[#E6F6F0] text-[#0F7A57]", blue: "bg-[#EEF4FF] text-[#1F5FD6]", red: "bg-[#FDECEC] text-[#B03A3A]", purple: "bg-[#F1EDFD] text-[#5B3FC4]", amber: "bg-[#FFF4E0] text-[#8A5A00]", gray: "bg-[#EEF1F6] text-[#3B475C]" }[meta.tone]}`} aria-hidden="true">
                        <Icon name={meta.icon} size={17} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                          <p className="text-[14px] font-semibold leading-6 min-w-0 break-words">{a.summary || meta.label}</p>
                          <time dateTime={a.created_at} className="text-[13px] text-adm-muted whitespace-nowrap" dir="ltr">{time(a.created_at)}</time>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[13px] text-adm-muted">
                          <Chip tone={meta.tone}>{meta.label}</Chip>
                          <span>{ENTITY_SINGLE[a.entity] || a.entity}</span>
                          {href ? (
                            <Link href={href} className="font-semibold text-adm-link hover:underline">פתיחת ה{ENTITY_SINGLE[a.entity] || "פריט"} <span dir="ltr">#{a.entity_id}</span></Link>
                          ) : a.entity_id ? <span dir="ltr">#{a.entity_id}</span> : null}
                          <span aria-hidden="true">·</span>
                          <span>{a.actor}</span>
                        </div>
                        <Diff a={a} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
