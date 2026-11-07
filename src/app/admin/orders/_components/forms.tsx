"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { ORDER_STATUS, PAYMENT_STATUS } from "@/lib/config";
import {
  addOrderNoteAction,
  markShippedAction,
  setPaymentStatusAction,
  updateOrderStatusAction,
  type ActionResult,
} from "../actions";

/* Small interactive forms for the order page. Each shows its own result message. */

export function Submit({ children, className = "a-btn a-btn-primary", pendingText = "שומר…" }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className} aria-busy={pending || undefined}>
      {pending ? pendingText : children}
    </button>
  );
}

export function Result({ state }: { state: ActionResult }) {
  if (!state) return null;
  if (state.error) return <p role="alert" className="text-[13px] font-semibold text-[#B03A3A]">{state.error}</p>;
  if (state.message) return <p role="status" className="text-[13px] font-semibold text-[#0F7A57]">{state.message}</p>;
  return null;
}

export function StatusForm({ id, status, number, restocked }: { id: number; status: string; number: string; restocked: boolean }) {
  const [state, action] = useFormState(updateOrderStatusAction, null);
  const [next, setNext] = useState(status);
  const closing = (next === "cancelled" || next === "returned") && next !== status;
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) {
      const n = ref.current?.querySelector<HTMLInputElement>("input[name=note]");
      if (n) n.value = "";
    }
  }, [state]);
  return (
    <form
      ref={ref}
      action={action}
      className="flex flex-col gap-3"
      onSubmit={(e: any) => {
        if (closing && !window.confirm(`לשנות את הזמנה ${number} ל"${ORDER_STATUS[next].label}"?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <label className="a-field">
        סטטוס חדש
        <select name="status" className="a-input" value={next} onChange={(e: any) => setNext(e.target.value)}>
          {Object.entries(ORDER_STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}{k === status ? " (נוכחי)" : ""}</option>
          ))}
        </select>
      </label>
      <label className="a-field">
        הערה לציר הזמן (לא חובה)
        <input name="note" className="a-input" maxLength={300} placeholder="למשל: הלקוחה ביקשה לבטל בטלפון" />
      </label>
      {closing && (
        restocked ? (
          <p className="text-[13px] text-adm-muted">הזוגות של הזמנה זו כבר הוחזרו למלאי בעבר.</p>
        ) : (
          <label className="flex items-center gap-2.5 min-h-[36px] text-[14px] cursor-pointer">
            <input type="checkbox" name="restock" defaultChecked className="w-[18px] h-[18px] accent-adm-blue" />
            להחזיר את הזוגות למלאי
          </label>
        )
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <Submit className={closing ? "a-btn a-btn-danger" : "a-btn a-btn-primary"}>{closing ? `סימון כ"${ORDER_STATUS[next].label}"` : "עדכון סטטוס"}</Submit>
        <Result state={state} />
      </div>
    </form>
  );
}

export function ShipForm({ id, tracking, disabled }: { id: number; tracking: string; disabled: boolean }) {
  const [state, action] = useFormState(markShippedAction, null);
  return (
    <form action={action} className="flex flex-col gap-2.5">
      <input type="hidden" name="id" value={id} />
      <label className="a-field">
        מספר מעקב
        <input name="tracking" defaultValue={tracking} dir="ltr" className="a-input text-left" maxLength={80} placeholder="RR123456789IL" disabled={disabled} />
      </label>
      <div className="flex items-center gap-3 flex-wrap">
        <Submit className="a-btn a-btn-dark a-btn-sm" pendingText="מעדכן…">{tracking ? "עדכון מעקב" : "סימון כנשלח"}</Submit>
        <Result state={state} />
      </div>
    </form>
  );
}

export function PaymentForm({ id, paymentStatus }: { id: number; paymentStatus: string }) {
  const [state, action] = useFormState(setPaymentStatusAction, null);
  return (
    <form action={action} className="flex flex-col gap-2.5">
      <input type="hidden" name="id" value={id} />
      <label className="a-field">
        סטטוס תשלום
        <select name="payment_status" defaultValue={paymentStatus} className="a-input">
          {Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-3 flex-wrap">
        <Submit className="a-btn a-btn-sm">שמירה</Submit>
        <Result state={state} />
      </div>
    </form>
  );
}

export function NoteForm({ id }: { id: number }) {
  const [state, action] = useFormState(addOrderNoteAction, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-2.5 adm-noprint">
      <input type="hidden" name="id" value={id} />
      <label className="a-field">
        הערה פנימית (לא נשלחת ללקוחה)
        <textarea name="note" rows={2} maxLength={1000} required className="a-input" />
      </label>
      <div className="flex items-center gap-3 flex-wrap">
        <Submit className="a-btn a-btn-sm">הוספת הערה</Submit>
        <Result state={state} />
      </div>
    </form>
  );
}

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="a-btn">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z" /></svg>
      הדפסה
    </button>
  );
}
