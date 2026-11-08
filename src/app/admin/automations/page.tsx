import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { CHANNEL_META, channelStatus, type Channel } from "@/lib/messaging";
import { getRule, lastCronInfo, listRulesWithStats, listRuns, siteUrl } from "@/lib/automations";
import { Chip, Empty, Icon, LinkTabs, Notice, PageHeader, fmtDateTime } from "../_components/ui";
import { deleteRuleAction, toggleRuleAction } from "./actions";
import Builder from "./Builder";
import { ConfirmDelete, RetryButton } from "./RunWidgets";
import { ACTION_META, ORDER_STATUSES, RUN_STATUS, TEMPLATES, TRIGGERS, delayLabel, describeAction, describeCondition, type RuleDraft } from "./meta";

export const dynamic = "force-dynamic";
export const metadata = { title: "אוטומציות" };

type SP = { tab?: string; new?: string; tpl?: string; edit?: string; rule?: string; status?: string; saved?: string; deleted?: string };

function ChannelBanners({ status }: { status: ReturnType<typeof channelStatus> }) {
  const missing = (Object.keys(CHANNEL_META) as Channel[]).filter((c) => !status[c].configured);
  if (!missing.length) return null;
  return (
    <section aria-label="ערוצים לא מחוברים" className="flex flex-col gap-2">
      {missing.map((c) => {
        const m = CHANNEL_META[c];
        return (
          <Notice key={c} tone={c === "sms" ? "blue" : "amber"}>
            <b>ערוץ {m.label} לא מחובר</b> ({m.provider}). פעולות {m.label} יירשמו ביומן כ״דולג – ערוץ לא מחובר״ ולא יישלחו.
            {" "}כדי לחבר: Vercel ← Project ← Settings ← Environment Variables, להוסיף{" "}
            {status[c].missing.map((k, i) => <span key={k}>{i > 0 && ", "}<code dir="ltr" className="font-mono text-[13px] bg-white/60 px-1 rounded">{k}</code></span>)}
            {" "}ולפרוס מחדש. {m.help}
          </Notice>
        );
      })}
    </section>
  );
}

export default async function AutomationsPage({ searchParams: sp }: { searchParams: SP }) {
  if (!isAdmin()) return null;
  const status = channelStatus();
  const channels = Object.fromEntries((Object.keys(CHANNEL_META) as Channel[]).map((c) => [c, { configured: status[c].configured, label: CHANNEL_META[c].label }])) as Record<Channel, { configured: boolean; label: string }>;
  const cronSecret = !!process.env.CRON_SECRET;
  const site = siteUrl();

  /* ---------- builder (new / edit) ---------- */
  if (sp.new || sp.edit) {
    let initial: RuleDraft | null = null;
    let tplTitle: string | undefined;
    let missing = false;
    if (sp.edit) {
      const r = await getRule(Number(sp.edit));
      if (r) initial = { id: r.id, name: r.name, trigger: r.trigger, trigger_config: r.trigger_config, conditions: r.conditions, actions: r.actions, delay_minutes: r.delay_minutes };
      else missing = true;
    } else {
      const t = TEMPLATES.find((x) => x.key === sp.tpl);
      tplTitle = t?.title;
      initial = t ? { id: null, ...JSON.parse(JSON.stringify(t.rule)) } : { id: null, name: "", trigger: "order_created", trigger_config: {}, conditions: [], actions: [{ type: "send_whatsapp", message: "היי {שם}, " }], delay_minutes: 0 };
    }
    return (
      <>
        <PageHeader crumbs={[{ href: "/admin", label: "ראשי" }, { href: "/admin/automations", label: "אוטומציות" }, { label: sp.edit ? "עריכה" : "חדשה" }]} title={sp.edit ? "עריכת אוטומציה" : "אוטומציה חדשה"} sub="טריגר ← תנאים ← פעולות" />
        <ChannelBanners status={status} />
        {!hasDb() ? <Notice tone="amber">מסד הנתונים לא מחובר – לא ניתן לשמור אוטומציות.</Notice> : missing || !initial ? <Notice tone="red">האוטומציה לא נמצאה. ייתכן שנמחקה.</Notice> : <Builder key={initial.id ?? sp.tpl ?? "new"} initial={initial} channels={channels} templateTitle={tplTitle} />}
      </>
    );
  }

  const tab = sp.tab === "runs" || sp.tab === "templates" ? sp.tab : "rules";
  const [rules, cron] = await Promise.all([listRulesWithStats(), lastCronInfo()]);
  const ruleFilter = Number(sp.rule) || null;
  const statusFilter = sp.status && RUN_STATUS[sp.status] ? sp.status : null;
  const runs = tab === "runs" ? await listRuns({ rule: ruleFilter, status: statusFilter, limit: 300 }) : [];
  const activeCount = rules.filter((r) => r.active).length;
  const usesDelayOrDaily = rules.some((r) => r.active && (r.delay_minutes > 0 || TRIGGERS[r.trigger]?.daily));

  const runsHref = (o: { rule?: number | null; status?: string | null }) => {
    const p = new URLSearchParams({ tab: "runs" });
    const rule = o.rule === undefined ? ruleFilter : o.rule;
    const st = o.status === undefined ? statusFilter : o.status;
    if (rule) p.set("rule", String(rule));
    if (st) p.set("status", st);
    return `/admin/automations?${p.toString()}`;
  };

  return (
    <>
      <PageHeader crumbs={[{ href: "/admin", label: "ראשי" }, { label: "אוטומציות" }]} title="אוטומציות" sub="הודעות, קופונים ותגיות שקורים לבד – לפי אירועים בחנות">
        <Link href="/admin/automations?tab=templates" className="a-btn"><Icon name="grid" /> מתבנית</Link>
        <Link href="/admin/automations?new=1" className="a-btn a-btn-primary"><Icon name="plus" /> אוטומציה חדשה</Link>
      </PageHeader>

      {sp.saved && <Notice tone="green">האוטומציה נשמרה. {rules.find((r) => r.id === Number(sp.saved))?.active ? "" : "היא עדיין כבויה – מפעילים אותה במתג כשמוכנים."}</Notice>}
      {sp.deleted && <Notice tone="green">האוטומציה נמחקה.</Notice>}

      <ChannelBanners status={status} />
      {!cronSecret && (
        <Notice tone={usesDelayOrDaily ? "red" : "amber"}>
          <b>המשימה היומית לא מוגדרת.</b> טריגרים יומיים (יום הולדת, לקוחה לא פעילה, קופון שפג) ופעולות מושהות רצים פעם ביום דרך <code dir="ltr" className="font-mono text-[13px]">/api/cron/automations</code>.
          {" "}יש להוסיף ב־Vercel משתנה סביבה <code dir="ltr" className="font-mono text-[13px] bg-white/60 px-1 rounded">CRON_SECRET</code> (מחרוזת אקראית ארוכה) ולפרוס מחדש. בלעדיו המשימה מסרבת לרוץ.
          {usesDelayOrDaily && " יש כרגע אוטומציות פעילות שתלויות בה."}
        </Notice>
      )}
      {!site && (
        <Notice tone="blue">
          המשתנה {"{קישור}"} יהיה ריק עד שמגדירים את כתובת האתר: משתנה סביבה <code dir="ltr" className="font-mono text-[13px] bg-white/60 px-1 rounded">NEXT_PUBLIC_SITE_URL</code> (למשל https://quality-tamra.co.il). ב־Vercel בפרודקשן נעשה שימוש בכתובת הפרויקט אוטומטית.
        </Notice>
      )}

      <div className="a-card !p-0 overflow-hidden">
        <div className="px-3 pt-1">
          <LinkTabs
            tabs={[
              { href: "/admin/automations", label: "אוטומציות", count: rules.length, active: tab === "rules" },
              { href: "/admin/automations?tab=runs", label: "יומן ריצות", active: tab === "runs" },
              { href: "/admin/automations?tab=templates", label: "תבניות", count: TEMPLATES.length, active: tab === "templates" },
            ]}
          />
        </div>

        {tab === "rules" && (
          <div className="p-4 flex flex-col gap-3">
            {rules.length === 0 ? (
              <Empty title="עדיין אין אוטומציות" text={hasDb() ? "התחילו מתבנית מוכנה – תודה על הזמנה, עדכון משלוח, קופון יום הולדת – או בנו אוטומציה משלכם." : "כדי ליצור אוטומציות יש לחבר מסד נתונים."}>
                {hasDb() && (
                  <>
                    <Link href="/admin/automations?tab=templates" className="a-btn a-btn-primary"><Icon name="grid" /> לגלריית התבניות</Link>
                    <Link href="/admin/automations?new=1" className="a-btn"><Icon name="plus" /> אוטומציה ריקה</Link>
                  </>
                )}
              </Empty>
            ) : (
              <>
                <p className="text-[13px] text-adm-muted">{activeCount} פעילות מתוך {rules.length}{cron ? ` · בדיקה יומית אחרונה: ${fmtDateTime(cron.at)}` : cronSecret ? " · הבדיקה היומית עוד לא רצה" : ""}</p>
                {rules.map((r) => {
                  const t = TRIGGERS[r.trigger];
                  const warn = r.actions.map((a) => ACTION_META[a.type]?.channel).filter((c): c is Channel => !!c && !status[c].configured);
                  const trigText = [t?.label || r.trigger, r.trigger === "order_status_changed" ? (r.trigger_config.status ? `ל״${ORDER_STATUSES[r.trigger_config.status]}״` : "כל סטטוס") : "", r.trigger === "inactive_customer" ? `${r.trigger_config.days} ימים` : "", r.trigger === "coupon_expiring" ? `${r.trigger_config.days} ימים לפני` : "", !t?.daily && r.delay_minutes ? delayLabel(r.delay_minutes) : ""].filter(Boolean).join(" · ");
                  return (
                    <article key={r.id} className={`rounded-xl border p-4 flex flex-col gap-3 ${r.active ? "border-adm-line bg-white" : "border-dashed border-[#C9D2DF] bg-[#FBFAFE]"}`}>
                      <div className="flex justify-between items-start gap-3 flex-wrap">
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-[16px] font-bold text-adm-navy">{r.name}</h3>
                            <Chip tone={r.active ? "green" : "gray"}>{r.active ? "פעילה" : "כבויה"}</Chip>
                          </div>
                          <span className="text-[13px] text-adm-muted">
                            {r.stats.runs} ריצות{r.stats.failed ? ` · ${r.stats.failed} נכשלו` : ""}{r.stats.scheduled ? ` · ${r.stats.scheduled} מתוזמנות` : ""}
                            {r.stats.last_run ? <> · ריצה אחרונה {fmtDateTime(r.stats.last_run)}{r.stats.last_status ? ` (${RUN_STATUS[r.stats.last_status]?.label || r.stats.last_status})` : ""}</> : " · עוד לא רצה"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <form action={toggleRuleAction}>
                            <input type="hidden" name="id" value={r.id} />
                            <button type="submit" role="switch" aria-checked={r.active} aria-label={`${r.active ? "כיבוי" : "הפעלת"} האוטומציה ${r.name}`} title={r.active ? "כיבוי" : "הפעלה"} className="h-9 px-1.5 flex items-center rounded-lg hover:bg-adm-bg">
                              <span className={`w-10 h-[22px] rounded-full p-[3px] flex transition-colors ${r.active ? "bg-[#0F7A57] justify-end" : "bg-[#B7C0CF] justify-start"}`} dir="ltr">
                                <span className="w-4 h-4 rounded-full bg-white shadow" />
                              </span>
                            </button>
                          </form>
                          <Link href={`/admin/automations?edit=${r.id}`} className="a-btn a-btn-sm !px-2.5" aria-label={`עריכת ${r.name}`} title="עריכה"><Icon name="edit" size={15} /></Link>
                          <Link href={runsHref({ rule: r.id, status: null })} className="a-btn a-btn-sm" title="יומן ריצות">יומן</Link>
                          <ConfirmDelete action={deleteRuleAction} id={r.id} name={r.name} />
                        </div>
                      </div>
                      <div className="flex items-stretch gap-2 flex-wrap text-[13px]">
                        <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F1ECFF] text-[#3A1C7A]"><Icon name={t?.icon || "zap"} size={15} /> <b>טריגר:</b> {trigText}</span>
                        <span className="flex items-center text-adm-muted" aria-hidden="true">←</span>
                        <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-adm-bg">
                          <b>תנאים:</b> {r.conditions.length ? r.conditions.map(describeCondition).join(" · ") : "ללא"}
                        </span>
                        <span className="flex items-center text-adm-muted" aria-hidden="true">←</span>
                        <span className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#E6F6F0] text-[#0B5E43]">
                          <b>פעולות:</b> {r.actions.map(describeAction).join(" · ")}
                        </span>
                      </div>
                      {warn.length > 0 && (
                        <p className="text-[13px] text-[#8A5A00] bg-[#FFF4E0] rounded-lg px-3 py-2 flex items-center gap-1.5">
                          <Icon name="alert" size={15} /> {Array.from(new Set(warn)).map((c) => CHANNEL_META[c].label).join(" ו")} לא מחובר – ההודעות האלה יידלגו ולא יישלחו.
                        </p>
                      )}
                    </article>
                  );
                })}
              </>
            )}
          </div>
        )}

        {tab === "templates" && (
          <div className="p-4 grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
            {TEMPLATES.map((t) => {
              const chs = Array.from(new Set(t.rule.actions.map((a) => ACTION_META[a.type].channel).filter(Boolean))) as Channel[];
              return (
                <article key={t.key} className="rounded-xl border border-adm-line p-4 flex flex-col gap-2.5">
                  <span className="w-9 h-9 rounded-lg bg-[#F1ECFF] text-adm-blue flex items-center justify-center"><Icon name={TRIGGERS[t.rule.trigger].icon} size={18} /></span>
                  <h3 className="text-[16px] font-bold">{t.title}</h3>
                  <p className="text-[13px] text-adm-muted leading-5 flex-1">{t.desc}</p>
                  <p className="text-[12px] text-adm-muted">{TRIGGERS[t.rule.trigger].label} ← {t.rule.actions.map(describeAction).join(" · ")}</p>
                  {chs.some((c) => !status[c].configured) && <span className="text-[12px] text-[#8A5A00]">דורש {chs.filter((c) => !status[c].configured).map((c) => CHANNEL_META[c].label).join(" ו")} (לא מחובר)</span>}
                  <Link href={`/admin/automations?new=1&tpl=${t.key}`} className="a-btn a-btn-sm self-start">שימוש בתבנית</Link>
                </article>
              );
            })}
          </div>
        )}

        {tab === "runs" && (
          <div className="flex flex-col">
            <form method="get" action="/admin/automations" className="flex flex-wrap gap-3 items-end p-4 border-b border-adm-line">
              <input type="hidden" name="tab" value="runs" />
              <label className="a-field">
                אוטומציה
                <select name="rule" defaultValue={ruleFilter ? String(ruleFilter) : ""} className="a-input !w-auto min-w-[200px]">
                  <option value="">הכל</option>
                  {rules.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </label>
              <label className="a-field">
                סטטוס
                <select name="status" defaultValue={statusFilter || ""} className="a-input !w-auto min-w-[150px]">
                  <option value="">הכל</option>
                  {Object.entries(RUN_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </label>
              <button type="submit" className="a-btn">סינון</button>
              {(ruleFilter || statusFilter) && <Link href="/admin/automations?tab=runs" className="a-btn a-btn-sm !h-[42px]">ניקוי</Link>}
            </form>
            {runs.length === 0 ? (
              <Empty title="אין ריצות" text={ruleFilter || statusFilter ? "לא נמצאו ריצות שמתאימות לסינון." : "כשאוטומציה פעילה תופעל, כל ריצה תופיע כאן עם התוצאה האמיתית של כל פעולה."} />
            ) : (
              <div className="overflow-x-auto">
                <table className="a-table min-w-[900px]">
                  <thead><tr><th>זמן</th><th>אוטומציה</th><th>אירוע</th><th>סטטוס</th><th>פירוט</th><th><span className="sr-only">פעולות</span></th></tr></thead>
                  <tbody>
                    {runs.map((x) => {
                      const st = RUN_STATUS[x.status] || { label: x.status, tone: "gray" as const };
                      return (
                        <tr key={x.id} className="align-top">
                          <td className="whitespace-nowrap text-[13px]">
                            {fmtDateTime(x.ran_at || x.created_at)}
                            {x.status === "scheduled" && x.due_at && <div className="text-adm-muted">מתוזמן ל־{fmtDateTime(x.due_at)}</div>}
                          </td>
                          <td className="text-[14px] font-semibold">{x.rule_name}</td>
                          <td className="text-[13px]">
                            {x.orderId ? <Link href={`/admin/orders/${x.orderId}`} className="text-adm-link font-semibold">הזמנה #{x.orderId}</Link> : null}
                            {x.customer_phone && <div className="text-adm-muted" dir="ltr">{x.customer_phone}</div>}
                          </td>
                          <td><Chip tone={st.tone}>{st.label}</Chip></td>
                          <td className="text-[13px] max-w-[420px]">
                            {x.results.length ? (
                              <ul className="flex flex-col gap-0.5">
                                {x.results.map((a, i) => (
                                  <li key={i}>
                                    <b className={a.status === "failed" ? "text-[#B03A3A]" : a.status === "skipped" ? "text-adm-muted" : "text-[#0F7A57]"}>{ACTION_META[a.type]?.label || a.type}:</b> {a.detail}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-adm-muted">{x.detail || "—"}</span>
                            )}
                          </td>
                          <td>{(x.status === "failed" || x.status === "partial") && x.rule_id ? <RetryButton id={x.id} /> : null}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-[13px] text-adm-muted">כל אוטומציה רצה פעם אחת לכל אירוע (למשל פעם אחת לכל הזמנה). אם ערוץ לא מחובר, הפעולה נרשמת כ״דולג״ – המערכת לעולם לא מסמנת הודעה כנשלחה בלי אישור מהספק. ״הרץ שוב״ מריץ מחדש רק את הפעולות שלא הצליחו – הודעה שכבר נשלחה לא תישלח פעמיים וקופון שכבר נוצר לא ייווצר שוב.</p>
    </>
  );
}
