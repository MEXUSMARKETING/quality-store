"use client";

import { useRef, useState } from "react";

/* Period picker for reports: plain GET form (works without JS); with JS it submits on change. */

export default function PeriodForm({ r, p, from, to, cmp, periods, canCompare }: { r: string; p: string; from: string; to: string; cmp: boolean; periods: Record<string, string>; canCompare: boolean }) {
  const [period, setPeriod] = useState(p);
  const ref = useRef<HTMLFormElement>(null);
  const submit = () => ref.current?.requestSubmit();
  return (
    <form ref={ref} method="get" action="/admin/reports" className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="r" value={r} />
      <label className="a-field">
        תקופה
        <select
          name="p"
          className="a-input !w-auto min-w-[170px]"
          value={period}
          onChange={(e: any) => {
            setPeriod(e.target.value);
            if (e.target.value !== "custom") setTimeout(submit, 0);
          }}
        >
          {Object.entries(periods).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </label>
      {period === "custom" && (
        <>
          <label className="a-field">
            מתאריך
            <input type="date" name="from" defaultValue={from} required className="a-input !w-auto" />
          </label>
          <label className="a-field">
            עד תאריך
            <input type="date" name="to" defaultValue={to} required className="a-input !w-auto" />
          </label>
        </>
      )}
      {canCompare && (
        <label className="flex items-center gap-2 h-[42px] px-3 rounded-[10px] border border-adm-line bg-white text-[14px] cursor-pointer select-none">
          <input type="checkbox" name="cmp" value="1" defaultChecked={cmp} onChange={() => setTimeout(submit, 0)} className="w-4 h-4 accent-[#3478F6]" />
          השוואה לתקופה קודמת
        </label>
      )}
      <button type="submit" className="a-btn">הצגה</button>
    </form>
  );
}
