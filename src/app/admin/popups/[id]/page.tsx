import Link from "next/link";
import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { db, hasDb } from "@/lib/db";
import { imageStorageReady } from "@/lib/storage";
import { getPopup, listPopupLeads, popupStatus, TEMPLATES } from "@/lib/popups";
import { Chip, Empty, Icon, Notice, PageHeader, fmtDateTime } from "../../_components/ui";
import PopupEditor from "../PopupEditor";
import { deletePopupAction, duplicatePopupAction } from "../actions";

export const dynamic = "force-dynamic";

async function couponOptions(): Promise<{ code: string; label: string }[]> {
  if (!hasDb()) return [];
  try {
    const sql = await db();
    const r = await sql`select code, type, value, active from coupons order by active desc, id desc limit 100`;
    return r.map((x: any) => ({
      code: String(x.code),
      label: `${x.code} · ${x.type === "fixed" ? "₪" + x.value : x.value + "%"}${x.active ? "" : " (מושבת)"}`,
    }));
  } catch {
    return [];
  }
}

const STATUS = {
  active: { label: "פעיל באתר", tone: "green" as const },
  paused: { label: "מושהה", tone: "gray" as const },
  scheduled: { label: "מתוזמן", tone: "blue" as const },
  ended: { label: "הסתיים", tone: "amber" as const },
};

export default async function PopupPage({ params, searchParams }: { params: { id: string }; searchParams: { new?: string } }) {
  if (!isAdmin()) return null;
  const p = await getPopup(Number(params.id));
  if (!p) notFound();
  const [coupons, leads] = await Promise.all([couponOptions(), listPopupLeads(p.id, 200)]);
  const st = STATUS[popupStatus(p)];
  const conv = p.views ? `${(((p.submits || p.clicks) / p.views) * 100).toFixed(1)}%` : "—";

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin", label: "ראשי" }, { href: "/admin/popups", label: "פופ־אפים" }, { label: p.name }]}
        title={p.name}
        sub={
          <span className="flex flex-wrap items-center gap-2">
            <Chip tone={st.tone}>{st.label}</Chip>
            <span>תבנית: {TEMPLATES[p.config.template].label}</span>
            <span>· {p.views.toLocaleString("he-IL")} צפיות · {p.clicks.toLocaleString("he-IL")} קליקים · {p.submits.toLocaleString("he-IL")} לידים · המרה {conv}</span>
          </span>
        }
      >
        <form action={duplicatePopupAction}>
          <input type="hidden" name="id" value={p.id} />
          <button className="a-btn"><Icon name="copy" size={16} /> שכפול</button>
        </form>
        <a href="/" target="_blank" rel="noopener" className="a-btn"><Icon name="external" size={16} /> צפייה באתר</a>
      </PageHeader>

      {searchParams.new && (
        <Notice tone="blue">
          הפופ־אפ נוצר מהתבנית ונשמר <b>כמושהה</b>. ערכי טקסטים, צבעים ומתי להציג, ואז הפעילי את המתג &quot;פעיל באתר&quot; ולחצי שמירה.
        </Notice>
      )}

      <PopupEditor popup={p} coupons={coupons} storageReady={imageStorageReady()} />

      <section className="a-card !p-0 overflow-hidden" aria-label="לידים מהפופ־אפ">
        <div className="flex items-center justify-between gap-3 flex-wrap p-4 border-b border-adm-line">
          <h2 className="text-[16px] font-bold">לידים מהפופ־אפ ({leads.length.toLocaleString("he-IL")})</h2>
          {leads.length > 0 && <a href={`/admin/popups/${p.id}/export`} className="a-btn a-btn-sm" download><Icon name="download" size={15} /> ייצוא CSV</a>}
        </div>
        {leads.length ? (
          <div className="overflow-x-auto">
            <table className="a-table min-w-[640px]">
              <thead><tr><th>תאריך</th><th>שם</th><th>טלפון</th><th>מייל</th><th>הודעה</th><th>עמוד</th></tr></thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap text-adm-muted">{fmtDateTime(l.created_at)}</td>
                    <td className="font-semibold">{l.name || "—"}</td>
                    <td dir="ltr" className="text-right whitespace-nowrap">
                      {l.phone ? <a href={`https://wa.me/${l.phone.replace(/\D/g, "").replace(/^0/, "972")}`} target="_blank" rel="noopener" className="text-adm-link hover:underline">{l.phone}</a> : "—"}
                    </td>
                    <td dir="ltr" className="text-right">{l.email || "—"}</td>
                    <td className="max-w-[280px] text-[13px] whitespace-pre-line">{l.message || "—"}</td>
                    <td dir="ltr" className="text-right text-[12px] text-adm-muted">{l.page || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="עדיין אין לידים" text="פרטים שגולשות ישאירו בטופס של הפופ־אפ יופיעו כאן, ואפשר יהיה לפנות אליהן בוואטסאפ בלחיצה." />
        )}
      </section>

      <details className="a-card max-w-[560px]">
        <summary className="cursor-pointer text-[14px] font-semibold text-[#B03A3A]">מחיקת הפופ־אפ</summary>
        <form action={deletePopupAction} className="pt-3 flex items-center gap-3 flex-wrap">
          <input type="hidden" name="id" value={p.id} />
          <span className="text-[13px] text-adm-muted">המחיקה סופית. הלידים שנאספו יישארו במערכת. אפשר במקום זה להשהות.</span>
          <button className="a-btn a-btn-sm a-btn-danger"><Icon name="trash" size={15} /> מחיקה סופית</button>
        </form>
      </details>
      <Link href="/admin/popups" className="text-[14px] text-adm-link hover:underline self-start">← לכל הפופ־אפים</Link>
    </>
  );
}
