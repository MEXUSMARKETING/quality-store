"use client";

import { Icon } from "../_components/ui";

/** Small form button that asks before submitting (delete, duplicate). */
export default function ConfirmForm({ action, id, message, label, ariaLabel, icon = "trash", danger = true }: { action: (fd: FormData) => void; id: number; message?: string; label?: string; ariaLabel: string; icon?: "trash" | "copy"; danger?: boolean }) {
  return (
    <form action={action} onSubmit={(e) => { if (message && !window.confirm(message)) e.preventDefault(); }}>
      <input type="hidden" name="id" value={id} />
      <button type="submit" className={`a-btn a-btn-sm !h-9 ${danger ? "a-btn-danger" : ""} ${label ? "" : "!px-2.5"}`} aria-label={ariaLabel} title={ariaLabel}>
        <Icon name={icon} size={15} />
        {label}
      </button>
    </form>
  );
}
