"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Chip, Icon, Notice, fmtDateTime } from "../_components/ui";
import type { Review } from "@/lib/catalog";
import { bulkReviews, reviewAction, type ReviewResult } from "./actions";

export type AdminReview = Review & { product_name: string; product_slug: string };

const STATUS: Record<string, { label: string; tone: "amber" | "green" | "red" | "gray" }> = {
  pending: { label: "ממתינה", tone: "amber" },
  approved: { label: "מאושרת", tone: "green" },
  rejected: { label: "נדחתה", tone: "red" },
  hidden: { label: "מוסתרת", tone: "gray" },
};

function Stars({ n }: { n: number }) {
  return (
    <span className="flex text-[#C98A00]" aria-label={`${n} מתוך 5 כוכבים`}>
      {[1, 2, 3, 4, 5].map((s) => <Icon key={s} name="star" size={16} className={s <= n ? "fill-current" : "text-[#C5CDD9]"} />)}
    </span>
  );
}

function Card({ r, canEdit, selected, onSelect, run, pending }: { r: AdminReview; canEdit: boolean; selected: boolean; onSelect: () => void; run: (fn: () => Promise<ReviewResult>) => void; pending: boolean }) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState(r.reply);
  const st = STATUS[r.status] || STATUS.pending;
  const btn = "a-btn a-btn-sm";

  return (
    <article className={`a-card flex flex-col gap-3 ${r.reported ? "!border-[#F3D3D3]" : ""} ${selected ? "ring-2 ring-adm-blue" : ""}`} aria-labelledby={`rv-${r.id}`}>
      <header className="flex flex-wrap items-start gap-3">
        {canEdit && (
          <label className="pt-0.5">
            <span className="sr-only">בחירת ביקורת של {r.name}</span>
            <input type="checkbox" checked={selected} onChange={onSelect} className="w-5 h-5 accent-[#3478F6]" />
          </label>
        )}
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <b id={`rv-${r.id}`} className="text-adm-navy">{r.name || "ללא שם"}</b>
            <Stars n={r.rating} />
            <Chip tone={st.tone}>{st.label}</Chip>
            {r.verified && <Chip tone="blue"><Icon name="check" size={13} /> רכישה מאומתת</Chip>}
            {r.reported && <Chip tone="red"><Icon name="alert" size={13} /> דווחה</Chip>}
          </div>
          <span className="text-[13px] text-adm-muted">
            {r.product_name ? <Link href={`/admin/products/${r.product_id}`} className="text-adm-link underline">{r.product_name}</Link> : `מוצר ${r.product_id}`}
            {" · "}{fmtDateTime(r.created_at)}
            {r.phone && <> · <span dir="ltr">{r.phone}</span></>}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-1">
        {r.title && <b className="text-[15px]">{r.title}</b>}
        <p className="text-[14px] leading-6 whitespace-pre-line text-adm-text">{r.body}</p>
      </div>

      {r.reply && !replying && (
        <div className="rounded-xl bg-adm-bg border border-adm-line p-3 text-[14px] leading-6">
          <span className="text-[12px] font-bold text-adm-muted block pb-0.5">תגובת החנות{r.reply_at ? ` · ${fmtDateTime(r.reply_at)}` : ""}</span>
          <span className="whitespace-pre-line">{r.reply}</span>
        </div>
      )}

      {replying && (
        <div className="flex flex-col gap-2">
          <label className="a-field">
            תגובת החנות (מוצגת מתחת לביקורת באתר)
            <textarea rows={3} maxLength={1500} value={reply} onChange={(e) => setReply(e.target.value)} className="a-input !h-auto py-2.5" placeholder="תודה רבה על הביקורת! …" />
          </label>
          <div className="flex gap-2">
            <button type="button" className="a-btn a-btn-sm a-btn-primary" disabled={pending} onClick={() => run(async () => { const res = await reviewAction(r.id, "reply", reply); if (!res.error) setReplying(false); return res; })}>שמירת תגובה</button>
            {r.reply && <button type="button" className="a-btn a-btn-sm a-btn-danger" disabled={pending} onClick={() => { if (window.confirm("להסיר את תגובת החנות?")) run(() => reviewAction(r.id, "reply", "")); }}>הסרת תגובה</button>}
            <button type="button" className="a-btn a-btn-sm" onClick={() => { setReply(r.reply); setReplying(false); }}>ביטול</button>
          </div>
        </div>
      )}

      {canEdit && (
        <footer className="flex flex-wrap gap-1.5 border-t border-[#EEF1F6] pt-3">
          {r.status !== "approved" && <button type="button" className={`${btn} !border-[#C6EADB] !text-[#0F7A57]`} disabled={pending} onClick={() => run(() => reviewAction(r.id, "approved"))}><Icon name="check" size={15} /> אישור</button>}
          {r.status !== "rejected" && <button type="button" className={btn} disabled={pending} onClick={() => run(() => reviewAction(r.id, "rejected"))}><Icon name="close" size={15} /> דחייה</button>}
          {r.status !== "hidden" && <button type="button" className={btn} disabled={pending} onClick={() => run(() => reviewAction(r.id, "hidden"))}><Icon name="eye" size={15} /> הסתרה</button>}
          {!replying && <button type="button" className={btn} onClick={() => setReplying(true)}><Icon name="edit" size={15} /> {r.reply ? "עריכת תגובה" : "תגובה"}</button>}
          {r.reported && <button type="button" className={btn} disabled={pending} onClick={() => run(() => reviewAction(r.id, "clear_report"))}>ניקוי דיווח</button>}
          {r.product_slug && <a href={`/product/${r.product_slug}#reviews`} target="_blank" rel="noopener" className={btn} aria-label={`צפייה בדף המוצר ${r.product_name}`}><Icon name="external" size={15} /></a>}
          <button type="button" className={`${btn} a-btn-danger ms-auto`} disabled={pending} onClick={() => { if (window.confirm(`למחוק לצמיתות את הביקורת של ${r.name || "הלקוחה"}? אי אפשר לבטל. (אפשר במקום זה להסתיר)`)) run(() => reviewAction(r.id, "delete")); }}>
            <Icon name="trash" size={15} /> מחיקה
          </button>
        </footer>
      )}
    </article>
  );
}

export default function ReviewsList({ reviews, canEdit }: { reviews: AdminReview[]; canEdit: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<ReviewResult>) =>
    start(async () => {
      try {
        const r = await fn();
        setResult(r);
        if (!r.error) router.refresh();
      } catch {
        setResult({ error: "הפעולה נכשלה. נסי שוב." });
      }
    });

  const all = reviews.length > 0 && selected.length === reviews.length;
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="flex flex-col gap-3">
      {result && <div role="status" aria-live="polite"><Notice tone={result.error ? "red" : "green"}>{result.error || result.ok}</Notice></div>}
      {canEdit && (
        <div className="a-card !py-2.5 flex flex-wrap items-center gap-2 sticky top-2 z-10">
          <label className="flex items-center gap-2 text-[14px] font-semibold min-h-[36px]">
            <input type="checkbox" checked={all} onChange={() => setSelected(all ? [] : reviews.map((r) => r.id))} className="w-5 h-5 accent-[#3478F6]" />
            {selected.length ? `${selected.length} נבחרו` : "בחירת הכל"}
          </label>
          <span className="flex-1" />
          <button type="button" className="a-btn a-btn-sm a-btn-primary" disabled={!selected.length || pending} onClick={() => run(async () => { const r = await bulkReviews(selected, "approved"); if (!r.error) setSelected([]); return r; })}>
            <Icon name="check" size={15} /> אישור הנבחרות
          </button>
          <button type="button" className="a-btn a-btn-sm" disabled={!selected.length || pending} onClick={() => { if (window.confirm(`לדחות ${selected.length} ביקורות?`)) run(async () => { const r = await bulkReviews(selected, "rejected"); if (!r.error) setSelected([]); return r; }); }}>
            <Icon name="close" size={15} /> דחיית הנבחרות
          </button>
        </div>
      )}
      {reviews.map((r) => (
        <Card key={r.id} r={r} canEdit={canEdit} selected={selected.includes(r.id)} onSelect={() => toggle(r.id)} run={run} pending={pending} />
      ))}
    </div>
  );
}
