import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { LAYOUTS, TEMPLATES, TEMPLATE_KEYS, TRIGGERS, listPopups, popupLeadCounts, popupStatus, type PopupStatus } from "@/lib/popups";
import { Chip, Empty, Icon, Notice, PageHeader, fmtDate, type Tone, ICONS } from "../_components/ui";
import { createFromTemplateAction, duplicatePopupAction, togglePopupAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "פופ־אפים" };

const STATUS: Record<PopupStatus, { label: string; tone: Tone }> = {
  active: { label: "פעיל באתר", tone: "green" },
  paused: { label: "מושהה", tone: "gray" },
  scheduled: { label: "מתוזמן", tone: "blue" },
  ended: { label: "הסתיים", tone: "amber" },
};

const pctOf = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");

export default async function PopupsPage({ searchParams }: { searchParams: { deleted?: string; error?: string } }) {
  if (!isAdmin()) return null;
  const [popups, leads] = await Promise.all([listPopups(), popupLeadCounts()]);
  const live = popups.filter((p) => popupStatus(p) === "active");
  const views = popups.reduce((a, p) => a + p.views, 0);
  const submits = popups.reduce((a, p) => a + p.submits, 0);
  const totalLeads = Object.values(leads).reduce((a, b) => a + b, 0);

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin", label: "ראשי" }, { label: "פופ־אפים" }]}
        title="פופ־אפים"
        sub="חלונות קופצים לאיסוף לידים, קופונים, מבצעים והודעות. בכל דף באתר מוצג רק פופ־אפ אחד – זה עם העדיפות הגבוהה ביותר."
      />

      {!hasDb() && <Notice tone="amber">כדי ליצור פופ־אפים צריך מסד נתונים מחובר.</Notice>}
      {searchParams.deleted && <Notice tone="green">הפופ־אפ נמחק.</Notice>}

      {/* stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "פעילים עכשיו", value: String(live.length), icon: "popup" as const },
          { label: "צפיות", value: views.toLocaleString("he-IL"), icon: "eye" as const },
          { label: "השארת פרטים", value: submits.toLocaleString("he-IL"), icon: "users" as const },
          { label: "אחוז המרה", value: pctOf(submits, views), icon: "chart" as const },
        ].map((s) => (
          <div key={s.label} className="a-card flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-adm-bg text-adm-blue flex items-center justify-center shrink-0"><Icon name={s.icon} size={20} /></span>
            <span className="flex flex-col">
              <span className="text-[13px] text-adm-muted">{s.label}</span>
              <b className="text-[22px] text-adm-navy leading-tight">{s.value}</b>
            </span>
          </div>
        ))}
      </div>

      {/* template gallery */}
      <section className="a-card flex flex-col gap-4" aria-label="תבניות">
        <div className="flex items-baseline justify-between gap-3 flex-wrap">
          <h2 className="text-[17px] font-bold">יצירת פופ־אפ מתבנית</h2>
          <span className="text-[13px] text-adm-muted">כל תבנית נפתחת לעריכה עם תצוגה מקדימה חיה, ונשמרת כמושהית עד שתפעילי אותה</span>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {TEMPLATE_KEYS.map((k) => {
            const t = TEMPLATES[k];
            const c = t.config();
            return (
              <form key={k} action={createFromTemplateAction}>
                <input type="hidden" name="template" value={k} />
                <button
                  disabled={!hasDb()}
                  className="group w-full h-full text-right rounded-2xl border border-adm-line p-4 flex flex-col gap-2.5 hover:border-[#6C1CF5] hover:shadow-[0_10px_30px_-16px_rgba(108,28,245,.6)] transition-all disabled:opacity-50"
                >
                  <span className="flex items-center justify-between w-full">
                    <span className="w-10 h-10 rounded-xl nx-grad text-white flex items-center justify-center"><Icon name={(t.icon in ICONS ? t.icon : "popup") as keyof typeof ICONS} size={19} /></span>
                    <span className="text-[12px] text-adm-muted">{LAYOUTS[c.layout]}</span>
                  </span>
                  <b className="text-[15px]">{t.label}</b>
                  <span className="text-[13px] text-adm-muted leading-5">{t.description}</span>
                  <span className="mt-auto pt-1 text-[13px] font-semibold text-adm-link flex items-center gap-1">
                    יצירה <Icon name="arrowLeft" size={14} />
                  </span>
                </button>
              </form>
            );
          })}
        </div>
      </section>

      {/* list */}
      <section className="a-card !p-0 overflow-hidden" aria-label="הפופ־אפים שלך">
        {popups.length ? (
          <div className="overflow-x-auto">
            <table className="a-table min-w-[880px]">
              <thead>
                <tr>
                  <th>פופ־אפ</th>
                  <th>סטטוס</th>
                  <th>מתי מופיע</th>
                  <th>צפיות</th>
                  <th>קליקים</th>
                  <th>לידים</th>
                  <th>המרה</th>
                  <th><span className="sr-only">פעולות</span></th>
                </tr>
              </thead>
              <tbody>
                {popups.map((p) => {
                  const st = STATUS[popupStatus(p)];
                  const c = p.config;
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/admin/popups/${p.id}`} className="flex flex-col hover:underline">
                          <b className="text-[15px]">{p.name}</b>
                          <span className="text-[12px] text-adm-muted">{TEMPLATES[c.template].label} · {LAYOUTS[c.layout]}</span>
                        </Link>
                      </td>
                      <td>
                        <span className="flex flex-col gap-1 items-start">
                          <Chip tone={st.tone}>{st.label}</Chip>
                          {(p.starts_at || p.ends_at) && <span className="text-[12px] text-adm-muted">{p.starts_at ? fmtDate(p.starts_at) : "…"} – {p.ends_at ? fmtDate(p.ends_at) : "…"}</span>}
                        </span>
                      </td>
                      <td className="text-[13px] text-adm-mid">
                        {TRIGGERS[c.trigger]}
                        {c.trigger === "delay" ? ` · ${c.delay} שנ׳` : c.trigger === "scroll" ? ` · ${c.scroll}%` : ""}
                      </td>
                      <td>{p.views.toLocaleString("he-IL")}</td>
                      <td>{p.clicks.toLocaleString("he-IL")}</td>
                      <td>{(leads[p.id] || 0).toLocaleString("he-IL")}</td>
                      <td className="font-semibold">{pctOf(p.submits || p.clicks, p.views)}</td>
                      <td>
                        <span className="flex gap-1.5 justify-end">
                          <form action={togglePopupAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <button className="a-btn a-btn-sm" aria-label={p.active ? `השהיית ${p.name}` : `הפעלת ${p.name}`} title={p.active ? "השהיה" : "הפעלה"}>
                              <Icon name={p.active ? "pause" : "play"} size={15} />
                            </button>
                          </form>
                          <form action={duplicatePopupAction}>
                            <input type="hidden" name="id" value={p.id} />
                            <button className="a-btn a-btn-sm" aria-label={`שכפול ${p.name}`} title="שכפול"><Icon name="copy" size={15} /></button>
                          </form>
                          <Link href={`/admin/popups/${p.id}`} className="a-btn a-btn-sm"><Icon name="edit" size={15} /> עריכה</Link>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="עדיין אין פופ־אפים" text="בחרי תבנית למעלה – למשל הנחה לקנייה ראשונה – ערכי את הטקסטים והפעילי." />
        )}
      </section>
      {totalLeads > 0 && (
        <p className="text-[13px] text-adm-muted">סה״כ {totalLeads.toLocaleString("he-IL")} לידים נאספו מפופ־אפים. את הלידים של כל פופ־אפ אפשר לראות ולייצא בעמוד העריכה שלו.</p>
      )}
    </>
  );
}
