"use client";

import { useFormState, useFormStatus } from "react-dom";
import { joinClub, type ActionResult } from "@/app/actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="sm:col-span-3 h-14 rounded-[14px] bg-gold text-ink text-[17px] font-bold disabled:opacity-60">
      {pending ? "שולחת…" : "הצטרפות וקבלת 5% הנחה"}
    </button>
  );
}

export default function ClubSignup() {
  const [state, action] = useFormState<ActionResult | null, FormData>(joinClub, null);

  if (state?.ok) {
    return (
      <div role="status" className="flex-1 p-7 md:p-8 rounded-[20px] border border-gold flex flex-col gap-2">
        <b className="text-[22px] md:text-[24px]">ברוכה הבאה למועדון!</b>
        <span className="text-soft">פרטי ההטבה יישלחו אלייך בקרוב.</span>
        {state.whatsapp && (
          <a href={state.whatsapp} target="_blank" rel="noopener" className="btn btn-gold self-start mt-2">
            שליחת הפרטים בוואטסאפ
          </a>
        )}
      </div>
    );
  }

  const inputCls = "h-[54px] rounded-[14px] border border-[#3A3833] bg-[#1A1A1A] text-white px-4 text-base w-full min-w-0 placeholder:text-[#77736B] focus:outline focus:outline-2 focus:outline-gold";

  return (
    <form action={action} className="flex-1 grid sm:grid-cols-3 gap-3.5 items-end">
      <label className="flex flex-col gap-2 text-sm text-soft">
        שם
        <input name="name" required autoComplete="name" placeholder="השם שלך" className={inputCls} />
      </label>
      <label className="flex flex-col gap-2 text-sm text-soft">
        טלפון
        <input name="phone" required type="tel" autoComplete="tel" placeholder="050-0000000" dir="ltr" className={inputCls + " text-right"} />
      </label>
      <label className="flex flex-col gap-2 text-sm text-soft">
        מייל
        <input name="email" type="email" autoComplete="email" placeholder="name@example.com" dir="ltr" className={inputCls + " text-right"} />
      </label>
      <Submit />
      {state?.error && <p role="alert" className="sm:col-span-3 text-[#F2B8A2] text-sm font-bold">{state.error}</p>}
      <label className="sm:col-span-3 flex items-center gap-2.5 text-[13px] text-soft">
        <input type="checkbox" name="consent" defaultChecked className="w-[18px] h-[18px] accent-gold" />
        אני מאשרת קבלת עדכונים ומבצעים ב־SMS ובמייל
      </label>
    </form>
  );
}
