"use client";

import { useFormState, useFormStatus } from "react-dom";
import { login } from "./actions";

function Btn() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="h-[52px] rounded-xl bg-ink text-white font-bold disabled:opacity-60">
      {pending ? "נכנסת…" : "כניסה"}
    </button>
  );
}

export default function LoginForm({ configured }: { configured: boolean }) {
  const [state, action] = useFormState(login, null);
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-cream">
      <form action={action} className="w-full max-w-[380px] bg-white rounded-3xl p-7 flex flex-col gap-4">
        <span dir="ltr" className="font-logo font-bold text-[34px] text-right">Quality</span>
        <h1 className="font-display font-bold text-xl">כניסה למערכת הניהול</h1>
        {!configured ? (
          <p className="text-sm leading-6 text-[#A13A0D] bg-[#FBEDE6] rounded-xl p-3">
            עדיין לא הוגדרה סיסמת ניהול. יש להוסיף ב־Vercel משתנה סביבה בשם <b dir="ltr">ADMIN_PASSWORD</b> ולפרוס מחדש.
          </p>
        ) : (
          <>
            <label className="field">
              סיסמה
              <input name="password" type="password" required autoFocus className="input" />
            </label>
            {state?.error && <p role="alert" className="text-sm font-bold text-[#A13A0D]">{state.error}</p>}
            <Btn />
          </>
        )}
      </form>
    </div>
  );
}
