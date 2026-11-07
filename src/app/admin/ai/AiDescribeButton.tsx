"use client";

import { useRef, useState } from "react";
import { draftProductDescriptionAction } from "./actions";

/* "Write a description with AI" for the product editor.
   Reads the product's current fields from the surrounding <form>, shows the draft for review,
   and only inserts it into the description textarea when the admin clicks "הכנס לתיאור".
   Nothing is saved here – the editor's normal save button saves. */
export default function AiDescribeButton({ productId, name, current, price, onInsert }: { productId?: number | null; name: string; current: string; price?: string; onInsert: (text: string) => void }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setDraft(null);
    if (!name.trim()) {
      setError("כדי לכתוב תיאור, יש למלא קודם את שם המוצר");
      return;
    }
    const form = ref.current?.closest("form");
    const val = (n: string) => String((form?.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | null)?.value || "");
    setBusy(true);
    try {
      const r = await draftProductDescriptionAction({ productId: productId || null, name, category: val("category"), color: val("color"), heel: val("heel"), price: price ?? val("price"), current });
      if (r.error) setError(r.error);
      else setDraft(r.text || "");
    } catch {
      setError("אין לך הרשאה לעוזר ה־AI, או שפג תוקף ההתחברות");
    }
    setBusy(false);
  }

  return (
    <span ref={ref} className="flex flex-col gap-2 font-normal">
      <span>
        <button type="button" onClick={run} disabled={busy} className="a-btn a-btn-sm text-[#5B3FC4]" aria-describedby={error ? "ai-desc-error" : undefined}>
          <span aria-hidden="true">✦</span> {busy ? "כותב תיאור…" : draft ? "כתיבה מחדש עם AI" : "כתוב תיאור עם AI"}
        </button>
      </span>
      {error && <span id="ai-desc-error" role="alert" className="text-[13px] font-semibold text-[#A13A0D]">{error}</span>}
      {draft !== null && (
        <span className="rounded-xl border border-[#DCD3FA] bg-[#F7F5FE] p-3 flex flex-col gap-2.5" role="region" aria-label="טיוטת תיאור מה־AI">
          <b className="text-[12px] text-[#5B3FC4]">טיוטה מה־AI – עברו עליה לפני השימוש</b>
          <span className="text-[14px] leading-7 whitespace-pre-wrap text-adm-text">{draft}</span>
          <span className="flex gap-2">
            <button type="button" className="a-btn a-btn-primary a-btn-sm" onClick={() => { onInsert(draft); setDraft(null); }}>הכנס לתיאור</button>
            <button type="button" className="a-btn a-btn-sm" onClick={() => setDraft(null)}>ביטול</button>
          </span>
          <span className="text-[12px] text-adm-muted">הטקסט יחליף את התיאור בשדה. השינוי יישמר רק בלחיצה על כפתור השמירה של המוצר.</span>
        </span>
      )}
    </span>
  );
}
