"use client";

import { useFormState, useFormStatus } from "react-dom";
import { login } from "./actions";

function Btn() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="a-btn a-btn-primary h-[50px] text-[15px]">
      {pending ? "נכנסת…" : "כניסה"}
    </button>
  );
}

export default function LoginForm({ configured }: { configured: boolean }) {
  const [state, action] = useFormState(login, null);
  return (
    <div className="adm min-h-screen flex items-center justify-center p-4">
      <form action={action} className="w-full max-w-[400px] bg-white border border-adm-line rounded-2xl p-7 flex flex-col gap-4 shadow-[0_12px_32px_rgba(23,36,58,.08)]">
        <span className="flex items-center gap-2.5"><span className="w-10 h-10 rounded-[10px] bg-adm-blue text-white flex items-center justify-center font-extrabold text-xl">Q</span><b dir="ltr" className="text-[22px] text-adm-navy">Quality</b></span>
        <h1 className="font-bold text-xl text-adm-navy">כניסה למערכת הניהול</h1>
        {!configured ? (
          <p className="text-sm leading-6 text-[#A13A0D] bg-[#FBEDE6] rounded-xl p-3">
            עדיין לא הוגדרה סיסמת ניהול. יש להוסיף ב־Vercel משתנה סביבה בשם <b dir="ltr">ADMIN_PASSWORD</b> ולפרוס מחדש.
          </p>
        ) : (
          <>
            <label className="a-field">
              סיסמה
              <input name="password" type="password" required autoFocus className="a-input h-[48px]" />
            </label>
            {state?.error && <p role="alert" className="text-sm font-bold text-[#A13A0D]">{state.error}</p>}
            <Btn />
          </>
        )}
      </form>
    </div>
  );
}
