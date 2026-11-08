"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { MODULES, ROLES, permsFor, type Level, type Module, type PermissionMap } from "@/lib/permissions";
import { Icon } from "../_components/ui";
import { resetPasswordAction, saveUserAction, type ResetState, type UserFormState } from "./actions";

export type UserFormValues = { id: number | null; name: string; email: string; role: string; permissions: PermissionMap | null; custom: boolean };

const LEVELS: { v: "none" | Level; label: string }[] = [
  { v: "none", label: "ללא" },
  { v: "view", label: "צפייה" },
  { v: "edit", label: "עריכה" },
];

function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const a = new Uint32Array(14);
  crypto.getRandomValues(a);
  const s = Array.from(a, (n) => chars[n % chars.length]).join("");
  return s.slice(0, 4) + "-" + s.slice(4, 9) + "-" + s.slice(9);
}

async function copyText(t: string) {
  try {
    await navigator.clipboard.writeText(t);
  } catch {
    const el = document.createElement("textarea");
    el.value = t;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
}

function OneTimePassword({ password, note }: { password: string; note: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="rounded-xl border border-[#C6EADB] bg-[#E6F6F0] p-4 flex flex-col gap-2.5" role="status">
      <b className="text-[14px] text-[#0B5E43]">{note}</b>
      <div className="flex gap-2 items-center">
        <code dir="ltr" className="flex-1 bg-white border border-adm-line rounded-lg px-3 h-[42px] flex items-center font-mono text-[16px] tracking-wide select-all">{password}</code>
        <button type="button" className="a-btn !h-[42px]" onClick={async () => { await copyText(password); setDone(true); }}>
          <Icon name={done ? "check" : "copy"} size={15} /> {done ? "הועתק" : "העתקה"}
        </button>
      </div>
      <p className="text-[12px] text-[#0B5E43]">הסיסמה מוצגת פעם אחת בלבד ולא נשמרת במערכת בצורה קריאה. מסרו אותה לעובד/ת באופן אישי (לא נשלח מייל).</p>
    </div>
  );
}

/* ---------- reset password ---------- */

function ResetBtn() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className="a-btn a-btn-sm">{pending ? "מאפס…" : "איפוס סיסמה"}</button>;
}

export function ResetPassword({ id, name }: { id: number; name: string }) {
  const [state, action] = useFormState<ResetState, FormData>(resetPasswordAction, null);
  return (
    <div className="flex flex-col gap-2.5">
      <form action={action} onSubmit={(e) => { if (!window.confirm(`ליצור סיסמה חדשה ל־${name}? הסיסמה הקודמת תפסיק לעבוד מיד.`)) e.preventDefault(); }}>
        <input type="hidden" name="id" value={id} />
        <ResetBtn />
      </form>
      {state?.error && <p role="alert" className="text-[13px] font-bold text-[#A13A0D]">{state.error}</p>}
      {state?.password && <OneTimePassword password={state.password} note={`סיסמה חדשה ל־${state.name}`} />}
    </div>
  );
}

/* ---------- confirm-before-submit ---------- */

export function ConfirmSubmit({ action, id, message, label, ariaLabel, danger }: { action: (fd: FormData) => void; id: number; message: string; label?: string; ariaLabel: string; danger?: boolean }) {
  return (
    <form action={action} onSubmit={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={`a-btn a-btn-sm ${danger ? "a-btn-danger" : ""} ${label ? "" : "!px-2.5"}`} aria-label={ariaLabel} title={ariaLabel}>
        {danger && <Icon name="trash" size={15} />}
        {label}
      </button>
    </form>
  );
}

/* ---------- add / edit drawer ---------- */

function SaveButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="a-btn a-btn-primary flex-1 sm:flex-none">
      <Icon name="check" /> {pending ? "שומר…" : editing ? "שמירת שינויים" : "הוספת משתמש"}
    </button>
  );
}

export function UserDrawer({ initial, isOwner, myPerms, isSelf, canReset }: { initial: UserFormValues; isOwner: boolean; myPerms: PermissionMap; isSelf: boolean; canReset?: boolean }) {
  const router = useRouter();
  const [state, action] = useFormState<UserFormState, FormData>(saveUserAction, null);
  const [role, setRole] = useState(initial.role);
  const [custom, setCustom] = useState(initial.custom);
  const [perms, setPerms] = useState<PermissionMap>(() => permsFor(initial.role, initial.permissions));
  const [pw, setPw] = useState("");
  const [showPw, setShowPw] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);
  const editing = !!initial.id;
  const close = "/admin/users";

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") router.push(close); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [router]);

  useEffect(() => {
    if (state?.field) panelRef.current?.querySelector<HTMLElement>(`[name="${state.field}"]`)?.focus();
  }, [state]);

  function changeRole(r: string) {
    setRole(r);
    if (!custom) setPerms(permsFor(r));
  }
  function toggleCustom(on: boolean) {
    setCustom(on);
    if (!on) setPerms(permsFor(role));
  }

  const roleOptions = Object.entries(ROLES).filter(([k]) => isOwner || k !== "owner");
  const rank = (l?: Level) => (l === "edit" ? 2 : l === "view" ? 1 : 0);
  const levelAllowed = (m: Module, l: "none" | Level) => {
    if (l === "none" || isOwner) return true;
    if (m === "users" && l === "edit") return false;
    return rank(l) <= rank(myPerms[m]);
  };
  const err = (f: string) => (state?.field === f ? { "aria-invalid": true as const, "aria-describedby": "user-error" } : {});

  if (state?.created) {
    return (
      <div className="fixed inset-0 z-50 flex">
        <Link href={close} aria-label="סגירת החלונית" className="flex-1 bg-[#14102E]/40" tabIndex={-1} />
        <div role="dialog" aria-modal="true" aria-labelledby="user-created-title" className="w-full max-w-[560px] h-full bg-adm-bg shadow-[0_0_40px_rgba(20,16,46,.25)] flex flex-col">
          <div className="flex items-center justify-between gap-3 px-5 py-4 bg-white border-b border-adm-line">
            <h2 id="user-created-title" className="text-[18px] font-extrabold text-adm-navy">המשתמש נוסף</h2>
            <Link href={close} className="a-btn a-btn-sm !px-2.5" aria-label="סגירה"><Icon name="close" /></Link>
          </div>
          <div className="p-5 flex flex-col gap-4">
            <p className="text-[14px] leading-6"><b>{state.created.name}</b> יכול/ה להתחבר עכשיו ב־<span dir="ltr">/admin</span> עם האימייל <b dir="ltr">{state.created.email}</b> והסיסמה:</p>
            <OneTimePassword password={state.created.password} note="הסיסמה הראשונית" />
            <Link href={close} className="a-btn a-btn-primary self-start">סיום</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <Link href={close} aria-label="סגירת החלונית" className="flex-1 bg-[#14102E]/40" tabIndex={-1} />
      <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="user-drawer-title" className="w-full max-w-[560px] h-full bg-adm-bg shadow-[0_0_40px_rgba(20,16,46,.25)] flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 bg-white border-b border-adm-line">
          <h2 id="user-drawer-title" className="text-[18px] font-extrabold text-adm-navy">{editing ? "עריכת משתמש" : "משתמש חדש"}</h2>
          <Link href={close} className="a-btn a-btn-sm !px-2.5" aria-label="סגירה"><Icon name="close" /></Link>
        </div>
        {editing && canReset && initial.id && (
          <div className="px-5 py-3 bg-white border-b border-adm-line flex flex-col gap-1.5">
            <span className="text-[12px] text-adm-muted">שכחו סיסמה? צרו סיסמה חדשה ומסרו אותה באופן אישי.</span>
            <ResetPassword id={initial.id} name={initial.name || initial.email} />
          </div>
        )}
        <form action={action} className="flex-1 flex flex-col min-h-0" noValidate>
          {initial.id && <input type="hidden" name="id" value={initial.id} />}
          <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
            {state?.error && <div id="user-error" role="alert" className="p-3 rounded-xl border bg-[#FDECEC] text-[#8A2626] border-[#F3D3D3] text-[14px]">{state.error}</div>}
            <div className="a-card flex flex-col gap-4">
              <label className="a-field">
                שם מלא
                <input ref={firstRef} name="name" defaultValue={initial.name} required maxLength={80} className="a-input" {...err("name")} />
              </label>
              <label className="a-field">
                אימייל (משמש להתחברות)
                <input name="email" type="email" defaultValue={initial.email} required maxLength={160} dir="ltr" autoComplete="off" className="a-input text-left" {...err("email")} />
              </label>
              {!editing && (
                <label className="a-field">
                  סיסמה ראשונית (לפחות 10 תווים)
                  <span className="flex gap-2">
                    <input name="password" type={showPw ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} required minLength={10} dir="ltr" autoComplete="new-password" className="a-input font-mono text-left" {...err("password")} />
                    <button type="button" className="a-btn !h-[42px] shrink-0" onClick={() => setShowPw((s) => !s)} aria-label={showPw ? "הסתרת הסיסמה" : "הצגת הסיסמה"}><Icon name="eye" size={16} /></button>
                    <button type="button" className="a-btn !h-[42px] shrink-0" onClick={() => { setPw(generatePassword()); setShowPw(true); }}>צור סיסמה</button>
                  </span>
                  <span className="text-[12px] font-normal text-adm-muted">אחרי השמירה הסיסמה תוצג פעם אחת כדי למסור אותה לעובד/ת. היא לא נשלחת במייל.</span>
                </label>
              )}
            </div>

            <div className="a-card flex flex-col gap-4">
              <label className="a-field">
                תפקיד
                <select name="role" value={role} onChange={(e) => changeRole(e.target.value)} disabled={isSelf} className="a-input" {...err("role")}>
                  {roleOptions.map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
                </select>
                {isSelf && <span className="text-[12px] font-normal text-adm-muted">אי אפשר לשנות את התפקיד וההרשאות של עצמך.</span>}
              </label>
              <label className="flex items-center gap-2.5 min-h-[36px] text-[14px] font-semibold">
                <input type="checkbox" name="custom" checked={custom} disabled={isSelf} onChange={(e) => toggleCustom(e.target.checked)} className="w-[18px] h-[18px] accent-[#6C1CF5]" />
                הרשאות מותאמות אישית למשתמש הזה
              </label>
              <div className="border border-adm-line rounded-xl overflow-hidden">
                <table className="a-table">
                  <caption className="sr-only">הרשאות לפי מודול</caption>
                  <thead><tr><th scope="col">מודול</th>{LEVELS.map((l) => <th key={l.v} scope="col" className="text-center">{l.label}</th>)}</tr></thead>
                  <tbody>
                    {(Object.keys(MODULES) as Module[]).map((m) => {
                      const cur = perms[m] || "none";
                      return (
                        <tr key={m}>
                          <th scope="row" className="!bg-white !text-[13px] !text-adm-text !font-semibold">{MODULES[m]}</th>
                          {LEVELS.map((l) => (
                            <td key={l.v} className="text-center !py-1.5">
                              <input
                                type="radio"
                                name={`perm_${m}`}
                                value={l.v}
                                checked={cur === l.v}
                                disabled={!custom || isSelf || !levelAllowed(m, l.v)}
                                onChange={() => setPerms((p) => ({ ...p, [m]: l.v === "none" ? undefined : l.v }))}
                                aria-label={`${MODULES[m]}: ${l.label}`}
                                className="w-[18px] h-[18px] accent-[#6C1CF5]"
                              />
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-[12px] text-adm-muted">{custom ? "ההרשאות שסומנו גוברות על ברירת המחדל של התפקיד." : "ההרשאות נקבעות לפי התפקיד. סמנו \"הרשאות מותאמות אישית\" כדי לשנות."} {!isOwner && "רק המנהל הראשי יכול לתת הרשאת עריכה למשתמשים והרשאות או תפקיד מנהל ראשי."}</p>
            </div>
          </div>
          <div className="flex gap-2 px-5 py-4 bg-white border-t border-adm-line">
            <SaveButton editing={editing} />
            <Link href={close} className="a-btn">ביטול</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
