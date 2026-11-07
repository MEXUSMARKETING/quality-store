import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { PERIODS, REPORTS, REPORT_GROUPS, buildReport, deltaPct, fmtVal, type Kpi, type ReportSearch } from "@/lib/reports";
import { Chip, Empty, Icon, Notice, PageHeader } from "../_components/ui";
import ReportChart from "./_components/ReportChart";
import PeriodForm from "./_components/PeriodForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "דוחות" };

function Delta({ k }: { k: Kpi }) {
  if (k.prev === null) return null;
  const d = deltaPct(k.value, k.prev);
  if (d === null) return <Chip tone="blue">חדש</Chip>;
  const good = k.invert ? d <= 0 : d >= 0;
  return (
    <Chip tone={d === 0 ? "gray" : good ? "green" : "red"}>
      <span dir="ltr">{d > 0 ? "+" : ""}{d}%</span>
    </Chip>
  );
}

const qs = (sp: ReportSearch, over: Partial<ReportSearch>) => {
  const all = { ...sp, ...over };
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(all)) if (v) p.set(k, String(v));
  return p.toString();
};

export default async function ReportsPage({ searchParams }: { searchParams: ReportSearch }) {
  if (!isAdmin()) return null;
  const { report, period } = await buildReport(searchParams);
  const meta = REPORTS[report.key];
  const cleanSp: ReportSearch = { r: report.key, p: period.p, cmp: period.compare ? "1" : undefined, ...(period.p === "custom" ? { from: searchParams.from, to: searchParams.to } : {}) };
  const csvHref = `/admin/reports/export?${qs(cleanSp, {})}`;

  return (
    <>
      <PageHeader crumbs={[{ href: "/admin", label: "ראשי" }, { label: "דוחות" }]} title="דוחות ואנליטיקה" sub="נתוני אמת מההזמנות והמוצרים בחנות · הכנסות לא כוללות הזמנות שבוטלו או הוחזרו">
        {hasDb() && !report.empty && (
          <a href={csvHref} className="a-btn"><Icon name="download" /> ייצוא CSV</a>
        )}
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_250px] items-start">
        <div className="flex flex-col gap-4 min-w-0">
          <section className="a-card flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-[19px] font-extrabold text-adm-navy">{report.title}</h2>
              <p className="text-[13px] text-adm-muted">
                {meta.desc} · <span>{report.rangeLabel}</span>
                {report.prevLabel && <> · השוואה ל־<span>{report.prevLabel}</span></>}
              </p>
            </div>
            {!meta.snapshot && (
              <PeriodForm r={report.key} p={period.p} from={period.fromInput} to={period.toInput} cmp={period.compare} periods={PERIODS} canCompare={period.p !== "all"} />
            )}
            {period.error && <Notice tone="red">{period.error}. מוצגים 30 הימים האחרונים.</Notice>}
          </section>

          {!hasDb() ? (
            <div className="a-card"><Empty title="אין נתונים" text="הדוחות מחושבים ממסד הנתונים של החנות, שעדיין לא מחובר." /></div>
          ) : (
            <>
              {report.kpis.length > 0 && (
                <section aria-label="מדדים" className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
                  {report.kpis.map((k) => (
                    <div key={k.label} className="a-card flex flex-col gap-1.5">
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-[13px] text-adm-muted font-medium">{k.label}</span>
                        <Delta k={k} />
                      </div>
                      <b className="text-[24px] font-extrabold text-adm-navy tracking-tight">{fmtVal(k.value, k.type)}</b>
                      {k.sub && <span className="text-[12px] text-adm-muted truncate" title={k.sub}>{k.sub}</span>}
                      {k.prev !== null && <span className="text-[12px] text-adm-muted">בתקופה הקודמת: {fmtVal(k.prev, k.type)}</span>}
                    </div>
                  ))}
                </section>
              )}

              {report.empty ? (
                <div className="a-card">
                  <Empty title="אין נתונים בתקופה" text={meta.snapshot ? "עדיין אין מוצרים בקטלוג." : "לא נמצאו הזמנות שמתאימות לדוח בטווח התאריכים שנבחר. נסו תקופה ארוכה יותר."}>
                    {!meta.snapshot && period.p !== "365" && <Link href={`/admin/reports?${qs(cleanSp, { p: "365", from: undefined, to: undefined })}`} className="a-btn a-btn-sm">ל־365 הימים האחרונים</Link>}
                  </Empty>
                </div>
              ) : (
                <>
                  {report.chart && (
                    <section className="a-card min-w-0">
                      <ReportChart chart={report.chart} />
                    </section>
                  )}

                  <section className="a-card !p-0 overflow-hidden min-w-0">
                    <div className="flex justify-between items-center px-[18px] py-3 gap-2 flex-wrap">
                      <h2 className="text-[16px] font-bold">פירוט <span className="text-adm-muted font-normal text-[13px]">({report.rows.length.toLocaleString("he-IL")} שורות)</span></h2>
                      <a href={csvHref} className="text-[14px] font-semibold text-adm-link flex items-center gap-1"><Icon name="download" size={15} /> CSV</a>
                    </div>
                    <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
                      <table className="a-table min-w-[640px]">
                        <thead className="sticky top-0 z-[1]">
                          <tr>{report.columns.map((c) => <th key={c.key} className={c.type === "text" || c.type === "date" ? "" : "!text-left"}>{c.label}</th>)}</tr>
                        </thead>
                        <tbody>
                          {report.rows.slice(0, 500).map((row, i) => (
                            <tr key={i}>
                              {report.columns.map((c) => {
                                const v = fmtVal(row[c.key], c.type);
                                const href = c.hrefKey ? (row[c.hrefKey] as string | null) : null;
                                const num = !(c.type === "text" || c.type === "date");
                                return (
                                  <td key={c.key} className={num ? "text-left tabular-nums whitespace-nowrap" : ""}>
                                    {href ? <Link href={href} className="font-semibold text-adm-link">{v}</Link> : v}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                        {report.totals && (
                          <tfoot>
                            <tr className="bg-[#F8FAFD] font-bold">
                              {report.columns.map((c) => {
                                const raw = report.totals![c.key];
                                const num = !(c.type === "text" || c.type === "date");
                                return <td key={c.key} className={`border-t-2 border-adm-line ${num ? "text-left tabular-nums whitespace-nowrap" : ""}`}>{raw === undefined || raw === null ? "" : fmtVal(raw, c.type)}</td>;
                              })}
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                    {report.rows.length > 500 && <p className="px-[18px] py-3 text-[13px] text-adm-muted border-t border-adm-line">מוצגות 500 השורות הראשונות. הקובץ ב־CSV כולל את כולן.</p>}
                  </section>
                </>
              )}

              {report.notes.length > 0 && (
                <ul className="text-[13px] text-adm-muted flex flex-col gap-1 list-disc pr-5">
                  {report.notes.map((n, i) => <li key={i}>{n}</li>)}
                </ul>
              )}
            </>
          )}
        </div>

        <nav aria-label="בחירת דוח" className="a-card !p-2 flex flex-col gap-1 lg:sticky lg:top-4 order-first lg:order-none">
          {REPORT_GROUPS.map((g) => (
            <div key={g.label} className="flex flex-col">
              <span className="px-3 pt-2.5 pb-1 text-[12px] font-bold text-adm-muted">{g.label}</span>
              {g.keys.map((k) => {
                const on = k === report.key;
                const href = `/admin/reports?${qs({ r: k, cmp: period.compare ? "1" : undefined, ...(period.p !== REPORTS[report.key].defaultPeriod ? { p: period.p, from: period.p === "custom" ? searchParams.from : undefined, to: period.p === "custom" ? searchParams.to : undefined } : {}) }, {})}`;
                return (
                  <Link key={k} href={href} aria-current={on ? "page" : undefined} className={`min-h-[38px] px-3 py-2 rounded-lg text-[14px] flex items-center ${on ? "bg-adm-navy text-white font-semibold hover:text-white" : "text-adm-text hover:bg-adm-bg"}`}>
                    {REPORTS[k].label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </div>
    </>
  );
}
