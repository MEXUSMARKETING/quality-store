"use client";

import { useFormState, useFormStatus } from "react-dom";
import { Icon } from "../_components/ui";
import { retryRunAction, type RetryState } from "./actions";

function RetrySubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="a-btn a-btn-sm">
      <Icon name="zap" size={14} /> {pending ? "מריץ…" : "הרץ שוב"}
    </button>
  );
}

/** Re-execute a failed run and show the real outcome. */
export function RetryButton({ id }: { id: number }) {
  const [state, action] = useFormState<RetryState, FormData>(retryRunAction, null);
  return (
    <form action={action} className="flex flex-col gap-1 items-start">
      <input type="hidden" name="id" value={id} />
      <RetrySubmit />
      {state && (
        <span role="status" className={`text-[12px] max-w-[260px] ${state.error ? "text-[#B03A3A]" : state.ok ? "text-[#0F7A57]" : "text-[#8A5A00]"}`}>
          {state.error || state.message}
        </span>
      )}
    </form>
  );
}

export function ConfirmDelete({ action, id, name }: { action: (fd: FormData) => void; id: number; name: string }) {
  return (
    <form action={action} onSubmit={(e: any) => { if (!window.confirm(`למחוק את האוטומציה "${name}"? גם יומן הריצות שלה יימחק. לא ניתן לבטל.`)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="a-btn a-btn-sm a-btn-danger !px-2.5" aria-label={`מחיקת האוטומציה ${name}`} title="מחיקה">
        <Icon name="trash" size={15} />
      </button>
    </form>
  );
}
