"use client";

import { useFormState } from "react-dom";
import { useEffect, useState } from "react";
import { ORDER_STATUS } from "@/lib/config";
import { bulkOrderStatusAction } from "../actions";
import { Result, Submit } from "./forms";

/**
 * Wraps the server-rendered orders table: row checkboxes (name="ids") live inside
 * this form, so the selection is submitted with the chosen status.
 */
export default function BulkOrders({ ids, children }: { ids: number[]; children: React.ReactNode }) {
  const [state, action] = useFormState(bulkOrderStatusAction, null);
  const [count, setCount] = useState(0);
  const [formEl, setFormEl] = useState<HTMLFormElement | null>(null);

  const boxes = () => Array.from(formEl?.querySelectorAll<HTMLInputElement>("input[name=ids]") || []);
  const sync = () => setCount(boxes().filter((b) => b.checked).length);

  useEffect(() => {
    if (state?.ok) {
      boxes().forEach((b) => (b.checked = false));
      setCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const all = count > 0 && count === ids.length;

  return (
    <form
      ref={setFormEl}
      action={action}
      onChange={sync}
      onSubmit={(e: any) => {
        const st = (e.currentTarget.elements.namedItem("status") as HTMLSelectElement)?.value;
        if ((st === "cancelled" || st === "returned") && !window.confirm(`לסמן ${count} הזמנות כ"${ORDER_STATUS[st].label}"? המלאי לא יעודכן אוטומטית.`)) e.preventDefault();
      }}
      className="flex flex-col"
    >
      <div className="flex flex-wrap items-center gap-2.5 px-[18px] py-3 border-b border-adm-line bg-[#F9F8FD] adm-noprint">
        <label className="flex items-center gap-2 min-h-[36px] text-[14px] cursor-pointer">
          <input
            type="checkbox"
            className="w-[18px] h-[18px] accent-adm-blue"
            checked={all}
            aria-label="בחירת כל ההזמנות בעמוד"
            onChange={(e: any) => {
              boxes().forEach((b) => (b.checked = e.target.checked));
              sync();
            }}
          />
          {count ? `${count} נבחרו` : "בחירת הכל"}
        </label>
        <span className="flex-1" />
        <label className="flex items-center gap-2 text-[13px] font-semibold">
          <span>שינוי סטטוס ל־</span>
          <select name="status" className="a-input !h-9 !w-auto" defaultValue="confirmed" disabled={!count}>
            {Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <Submit className="a-btn a-btn-dark a-btn-sm" pendingText="מעדכן…">החלה על הנבחרות</Submit>
        <Result state={state} />
      </div>
      {children}
    </form>
  );
}
