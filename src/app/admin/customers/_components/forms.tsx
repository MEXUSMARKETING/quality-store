"use client";

import { useFormState } from "react-dom";
import { createCustomerAction, saveCustomerNotesAction, updateCustomerAction } from "../actions";
import { Result, Submit } from "../../orders/_components/forms";
import type { Customer } from "@/lib/types";

export function NewCustomerForm() {
  const [state, action] = useFormState(createCustomerAction, null);
  return (
    <form action={action} className="a-card flex flex-col gap-3 max-w-[640px]">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="a-field">שם מלא *<input name="name" required maxLength={120} className="a-input" autoComplete="off" /></label>
        <label className="a-field">
          טלפון נייד *
          <input name="phone" required inputMode="tel" dir="ltr" className="a-input text-left" placeholder="05X-XXXXXXX" aria-describedby="nc-phone-help" />
          <span id="nc-phone-help" className="text-[12px] font-normal text-adm-muted">10 ספרות שמתחילות ב־05</span>
        </label>
        <label className="a-field">מייל<input name="email" type="email" dir="ltr" maxLength={160} className="a-input text-left" /></label>
        <label className="a-field">עיר<input name="city" maxLength={80} className="a-input" /></label>
      </div>
      <label className="a-field">הערות פנימיות<textarea name="notes" rows={3} maxLength={2000} className="a-input" /></label>
      <label className="flex items-start gap-2.5 text-[14px] cursor-pointer min-h-[36px]">
        <input type="checkbox" name="marketing_consent" className="w-[18px] h-[18px] mt-0.5 accent-adm-blue" />
        <span>הלקוחה אישרה לקבל דיוור שיווקי <span className="text-adm-muted">(סמנו רק אם התקבל אישור מפורש)</span></span>
      </label>
      <div className="flex items-center gap-3 flex-wrap">
        <Submit>שמירת לקוח</Submit>
        <Result state={state} />
      </div>
    </form>
  );
}

export function EditCustomerForm({ c }: { c: Customer }) {
  const [state, action] = useFormState(updateCustomerAction, null);
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={c.id} />
      <label className="a-field">שם<input name="name" defaultValue={c.name} required maxLength={120} className="a-input" /></label>
      <label className="a-field">טלפון נייד<input name="phone" defaultValue={c.phone} required inputMode="tel" dir="ltr" className="a-input text-left" /></label>
      <label className="a-field">מייל<input name="email" type="email" defaultValue={c.email} dir="ltr" maxLength={160} className="a-input text-left" /></label>
      <label className="a-field">עיר<input name="city" defaultValue={c.city} maxLength={80} className="a-input" /></label>
      <div className="flex items-center gap-3 flex-wrap">
        <Submit className="a-btn a-btn-sm a-btn-primary">שמירת פרטים</Submit>
        <Result state={state} />
      </div>
    </form>
  );
}

export function NotesForm({ c }: { c: Customer }) {
  const [state, action] = useFormState(saveCustomerNotesAction, null);
  return (
    <form action={action} className="flex flex-col gap-2.5">
      <input type="hidden" name="id" value={c.id} />
      <label className="a-field">
        <span className="sr-only">הערות פנימיות</span>
        <textarea name="notes" defaultValue={c.notes} rows={4} maxLength={4000} className="a-input" placeholder="מידה מועדפת, העדפות, שיחות קודמות…" />
      </label>
      <div className="flex items-center gap-3 flex-wrap">
        <Submit className="a-btn a-btn-sm">שמירת הערות</Submit>
        <Result state={state} />
      </div>
    </form>
  );
}

/** A form whose submit asks for confirmation first (archive etc.) */
export function ConfirmForm({ action, message, children, fields }: { action: (fd: FormData) => Promise<void>; message: string; fields: Record<string, string | number>; children: React.ReactNode }) {
  return (
    <form action={action} onSubmit={(e: any) => { if (!window.confirm(message)) e.preventDefault(); }}>
      {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
    </form>
  );
}
