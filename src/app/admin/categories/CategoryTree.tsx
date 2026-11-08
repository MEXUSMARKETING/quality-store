"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Icon } from "../_components/ui";
import { addSubcategoryAction, moveCategoryAction, toggleCategoryAction, type CatState } from "./actions";

type Cat = { key: string; name: string; parent: string | null; count: number; active: boolean; featured: boolean; image: string; sort: number };

function Pending({ children, className, label, disabled = false }: { children: React.ReactNode; className: string; label: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className={className} disabled={pending || disabled} aria-label={label} title={label}>
      {children}
    </button>
  );
}

function AddInline({ parent, parentName, onDone }: { parent: string; parentName: string; onDone: () => void }) {
  const [state, action] = useFormState<CatState, FormData>(addSubcategoryAction, null);
  const ref = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => ref.current?.focus(), []);
  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      onDone();
    }
  }, [state, onDone]);
  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-end gap-2 py-2.5 px-3 rounded-xl bg-adm-bg border border-adm-line">
      <input type="hidden" name="parent" value={parent} />
      <label className="a-field flex-1 min-w-[150px]">
        שם תת־קטגוריה תחת {parentName}
        <input ref={ref} name="name" required maxLength={80} className="a-input" placeholder="למשל: מגפוני קרסול" />
      </label>
      <label className="a-field w-[160px]">
        מפתח (באנגלית)
        <input name="key" dir="ltr" maxLength={40} pattern="[a-z0-9\-]*" className="a-input" placeholder="ankle-boots" />
      </label>
      <Pending className="a-btn a-btn-primary" label="הוספה"><Icon name="plus" size={16} /> הוספה</Pending>
      <button type="button" className="a-btn" onClick={onDone}>ביטול</button>
      {state?.error && <p role="alert" className="w-full text-[13px] text-[#B03A3A] font-semibold">{state.error}</p>}
    </form>
  );
}

export default function CategoryTree({ cats, canEdit, editKey }: { cats: Cat[]; canEdit: boolean; editKey: string }) {
  const keys = new Set(cats.map((c) => c.key));
  const children = (k: string | null) => cats.filter((c) => (k === null ? !c.parent || !keys.has(c.parent) : c.parent === k));
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(cats.map((c) => [c.key, true])));
  const [adding, setAdding] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  // plain render function (not a component) so the subtree is not remounted on every state change
  const row = (c: Cat, depth: number, i: number, n: number): React.ReactNode => {
    const kids = children(c.key);
    const isOpen = open[c.key] !== false;
    const sel = editKey === c.key;
    return (
      <li key={c.key}>
        <div className={`flex items-center gap-2 px-3 py-2 border-b border-[#F0EEF6] min-h-[60px] ${sel ? "bg-[#F1ECFF]" : "hover:bg-[#FBFAFE]"}`} style={{ paddingInlineStart: 12 + depth * 26 }}>
          {kids.length ? (
            <button type="button" className="w-8 h-8 rounded-lg flex items-center justify-center text-adm-mid hover:bg-adm-bg" aria-expanded={isOpen} aria-label={`${isOpen ? "כיווץ" : "הרחבה"} ${c.name}`} onClick={() => setOpen((o) => ({ ...o, [c.key]: !isOpen }))}>
              <Icon name={isOpen ? "down" : "arrowLeft"} size={16} />
            </button>
          ) : (
            <span className="w-8 h-8 flex items-center justify-center text-[#C5CDD9]" aria-hidden="true">•</span>
          )}
          {c.image ? <img src={c.image} alt="" className="w-9 h-9 rounded-lg object-cover border border-adm-line bg-adm-bg shrink-0" /> : <span className="w-9 h-9 rounded-lg bg-adm-bg border border-adm-line flex items-center justify-center text-adm-muted shrink-0"><Icon name="image" size={15} /></span>}
          <Link href={`/admin/categories?edit=${encodeURIComponent(c.key)}`} className="flex flex-col min-w-0 flex-1 group">
            <b className={`leading-5 group-hover:underline truncate ${c.active ? "text-adm-navy" : "text-adm-muted"}`}>{c.name}</b>
            <span className="text-[12px] text-adm-muted">
              <span dir="ltr">{c.key}</span> · {c.count} מוצרים{kids.length ? ` · ${kids.length} תתי־קטגוריות` : ""}
            </span>
          </Link>

          {/* active switch */}
          <form action={toggleCategoryAction} onSubmit={() => setMsg(`${c.name}: ${c.active ? "הוסתרה" : "הופעלה"}`)}>
            <input type="hidden" name="key" value={c.key} />
            <input type="hidden" name="field" value="active" />
            <Pending className="h-9 px-2 rounded-lg flex items-center gap-2 text-[12px] font-semibold text-adm-mid hover:bg-adm-bg disabled:opacity-50" label={c.key === "boots" ? `${c.name} – עמוד החנות הראשי, תמיד פעילה` : `${c.active ? "הסתרת" : "הצגת"} ${c.name} באתר`} disabled={!canEdit || (c.key === "boots" && c.active)}>
              <span aria-hidden="true" className={`relative w-9 h-5 rounded-full transition-colors ${c.active ? "bg-[#0F7A57]" : "bg-[#C5CDD9]"} ${canEdit ? "" : "opacity-60"}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${c.active ? "start-[18px]" : "start-0.5"}`} />
              </span>
              <span className="hidden sm:inline w-[44px] text-start">{c.active ? "פעילה" : "מוסתרת"}</span>
            </Pending>
          </form>

          {/* featured */}
          <form action={toggleCategoryAction}>
            <input type="hidden" name="key" value={c.key} />
            <input type="hidden" name="field" value="featured" />
            <Pending className={`w-9 h-9 rounded-lg flex items-center justify-center hover:bg-adm-bg disabled:opacity-50 ${c.featured ? "text-[#C98A00]" : "text-[#8C97A8]"}`} label={c.featured ? `הסרת סימון מומלצת: ${c.name}` : `סימון כמומלצת: ${c.name}`} disabled={!canEdit}>
              <Icon name="star" size={18} className={c.featured ? "fill-current" : ""} />
            </Pending>
          </form>

          {canEdit && (
            <>
              <form action={moveCategoryAction}>
                <input type="hidden" name="key" value={c.key} />
                <input type="hidden" name="dir" value="up" />
                <button disabled={i === 0} className="w-9 h-9 rounded-lg flex items-center justify-center text-adm-mid hover:bg-adm-bg disabled:opacity-30" aria-label={`הזזת ${c.name} למעלה`}><Icon name="up" size={16} /></button>
              </form>
              <form action={moveCategoryAction}>
                <input type="hidden" name="key" value={c.key} />
                <input type="hidden" name="dir" value="down" />
                <button disabled={i === n - 1} className="w-9 h-9 rounded-lg flex items-center justify-center text-adm-mid hover:bg-adm-bg disabled:opacity-30" aria-label={`הזזת ${c.name} למטה`}><Icon name="down" size={16} /></button>
              </form>
              <button type="button" className="a-btn a-btn-sm !px-2.5" aria-label={`הוספת תת־קטגוריה תחת ${c.name}`} title="הוספת תת־קטגוריה" onClick={() => { setAdding(c.key); setOpen((o) => ({ ...o, [c.key]: true })); }}>
                <Icon name="plus" size={15} />
              </button>
            </>
          )}
          <Link href={`/admin/categories?edit=${encodeURIComponent(c.key)}`} className="a-btn a-btn-sm !px-2.5" aria-label={`עריכת ${c.name}`}><Icon name="edit" size={15} /></Link>
        </div>
        {adding === c.key && (
          <div className="px-3 py-2 border-b border-[#F0EEF6]" style={{ paddingInlineStart: 12 + (depth + 1) * 26 }}>
            <AddInline parent={c.key} parentName={c.name} onDone={() => setAdding(null)} />
          </div>
        )}
        {kids.length > 0 && isOpen && (
          <ul>
            {kids.map((k, j) => row(k, depth + 1, j, kids.length))}
          </ul>
        )}
      </li>
    );
  };

  const roots = children(null);
  return (
    <div>
      <div className="sr-only" role="status" aria-live="polite">{msg}</div>
      <ul>
        {roots.map((c, i) => row(c, 0, i, roots.length))}
      </ul>
      {canEdit && (
        <div className="p-3">
          {adding === "" ? (
            <AddInline parent="" parentName="הרמה הראשית" onDone={() => setAdding(null)} />
          ) : (
            <button type="button" className="a-btn a-btn-sm" onClick={() => setAdding("")}><Icon name="plus" size={15} /> קטגוריה ראשית חדשה</button>
          )}
        </div>
      )}
    </div>
  );
}
