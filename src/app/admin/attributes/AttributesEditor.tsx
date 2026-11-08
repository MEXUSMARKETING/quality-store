"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon, Notice } from "../_components/ui";
import type { ColorDef } from "@/lib/catalog";
import { saveColorsAction, saveSizesAction, type AttrResult } from "./actions";

const swap = <T,>(arr: T[], i: number, d: -1 | 1) => {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const a = [...arr];
  [a[i], a[j]] = [a[j], a[i]];
  return a;
};

const iconBtn = "w-9 h-9 rounded-lg flex items-center justify-center text-adm-mid hover:bg-adm-bg disabled:opacity-30 disabled:cursor-not-allowed";

function Result({ r }: { r: AttrResult | null }) {
  if (!r) return null;
  return <div role="status" aria-live="polite"><Notice tone={r.error ? "red" : "green"}>{r.error || r.ok}</Notice></div>;
}

function SizesCard({ initial, use, canEdit }: { initial: string[]; use: Record<string, number>; canEdit: boolean }) {
  const router = useRouter();
  const [sizes, setSizes] = useState<string[]>(initial);
  const [add, setAdd] = useState("");
  const [res, setRes] = useState<AttrResult | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(sizes) !== JSON.stringify(initial);

  const doAdd = () => {
    const s = add.trim();
    if (!s) return;
    if (sizes.includes(s)) { setRes({ error: `המידה ${s} כבר ברשימה` }); return; }
    setSizes([...sizes, s]);
    setAdd("");
    setRes(null);
  };
  const sortNumeric = () => setSizes([...sizes].sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0) || a.localeCompare(b)));

  return (
    <section className="a-card flex flex-col gap-4" aria-labelledby="sizes-title">
      <div>
        <h2 id="sizes-title" className="text-[16px] font-bold text-adm-navy">מידות</h2>
        <p className="text-[13px] text-adm-muted leading-5">הסדר כאן הוא הסדר בכפתורי המידה ובמסנן. אי אפשר להסיר מידה שיש לה מלאי.</p>
      </div>
      <Result r={res} />
      <ul className="flex flex-col border border-adm-line rounded-xl overflow-hidden">
        {sizes.map((s, i) => {
          const n = use[s] || 0;
          return (
            <li key={s} className="flex items-center gap-2 px-3 py-1.5 border-b border-[#F0EEF6] last:border-0 min-h-[52px]">
              <b className="w-14 text-[16px] tabular-nums text-adm-navy" dir="ltr">{s}</b>
              <span className={`flex-1 text-[13px] ${n ? "text-[#0F7A57] font-semibold" : "text-adm-muted"}`}>{n ? `במלאי ב־${n} מוצרים` : "אין מלאי"}</span>
              {!initial.includes(s) && <span className="a-chip bg-[#F1ECFF] text-[#5414D6]">חדשה</span>}
              <button type="button" className={iconBtn} disabled={!canEdit || i === 0} onClick={() => setSizes(swap(sizes, i, -1))} aria-label={`הזזת מידה ${s} למעלה`}><Icon name="up" size={16} /></button>
              <button type="button" className={iconBtn} disabled={!canEdit || i === sizes.length - 1} onClick={() => setSizes(swap(sizes, i, 1))} aria-label={`הזזת מידה ${s} למטה`}><Icon name="down" size={16} /></button>
              <button
                type="button"
                className={`${iconBtn} hover:!bg-[#FDECEC] hover:text-[#B03A3A]`}
                disabled={!canEdit || n > 0 || sizes.length === 1}
                title={n > 0 ? "יש מלאי במידה הזו – אי אפשר להסיר" : "הסרה"}
                onClick={() => setSizes(sizes.filter((x) => x !== s))}
                aria-label={n > 0 ? `אי אפשר להסיר את מידה ${s} – יש לה מלאי` : `הסרת מידה ${s}`}
              >
                <Icon name="trash" size={16} />
              </button>
            </li>
          );
        })}
      </ul>
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="a-field w-[140px]">
            מידה חדשה
            <input dir="ltr" maxLength={10} value={add} onChange={(e) => setAdd(e.target.value)} onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") { e.preventDefault(); doAdd(); } }} className="a-input" placeholder="43" />
          </label>
          <button type="button" className="a-btn" onClick={doAdd} disabled={!add.trim()}><Icon name="plus" size={16} /> הוספה</button>
          <button type="button" className="a-btn a-btn-sm" onClick={sortNumeric}>מיון לפי מספר</button>
        </div>
      )}
      <div className="flex gap-2 items-center border-t border-adm-line pt-3">
        <button
          type="button"
          className="a-btn a-btn-primary"
          disabled={!canEdit || !dirty || pending}
          onClick={() => start(async () => {
            const r = await saveSizesAction(sizes);
            setRes(r);
            if (!r.error) router.refresh();
          })}
        >
          <Icon name="check" /> {pending ? "שומרת…" : "שמירת מידות"}
        </button>
        {dirty && <button type="button" className="a-btn" onClick={() => { setSizes(initial); setRes(null); }}>ביטול שינויים</button>}
      </div>
    </section>
  );
}

function ColorsCard({ initial, use, canEdit }: { initial: ColorDef[]; use: Record<string, number>; canEdit: boolean }) {
  const router = useRouter();
  const [colors, setColors] = useState<ColorDef[]>(initial);
  const [res, setRes] = useState<AttrResult | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(colors) !== JSON.stringify(initial);
  const set = (i: number, patch: Partial<ColorDef>) => setColors(colors.map((c, k) => (k === i ? { ...c, ...patch } : c)));
  const isOld = (key: string) => initial.some((c) => c.key === key);

  return (
    <section className="a-card flex flex-col gap-4" aria-labelledby="colors-title">
      <div>
        <h2 id="colors-title" className="text-[16px] font-bold text-adm-navy">צבעים</h2>
        <p className="text-[13px] text-adm-muted leading-5">המפתח נשמר במוצרים ולכן קבוע אחרי השמירה; השם והגוון ניתנים לשינוי. צבע שמשויך למוצרים לא ניתן להסרה.</p>
      </div>
      <Result r={res} />
      <ul className="flex flex-col gap-2">
        {colors.map((c, i) => {
          const n = use[c.key] || 0;
          const old = isOld(c.key);
          const hexOk = /^#[0-9a-fA-F]{6}$/.test(c.hex);
          return (
            <li key={i} className="flex flex-wrap items-end gap-2 p-2.5 rounded-xl border border-adm-line">
              <label className="flex flex-col items-center gap-1 text-[11px] text-adm-muted">
                <span className="sr-only">בחירת גוון ל{c.label || "צבע"}</span>
                <input type="color" value={hexOk ? c.hex : "#BDB9AF"} disabled={!canEdit} onChange={(e) => set(i, { hex: e.target.value.toUpperCase() })} className="w-11 h-11 rounded-full border border-adm-line cursor-pointer p-0 overflow-hidden" />
              </label>
              <label className="a-field flex-1 min-w-[120px]">
                שם בעברית
                <input value={c.label} maxLength={40} disabled={!canEdit} onChange={(e) => set(i, { label: e.target.value })} className="a-input" />
              </label>
              <label className="a-field w-[110px]">
                מפתח
                <input dir="ltr" value={c.key} maxLength={30} disabled={!canEdit || old} onChange={(e) => set(i, { key: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} className="a-input" placeholder="beige" />
              </label>
              <label className="a-field w-[104px]">
                קוד
                <input dir="ltr" value={c.hex} maxLength={7} disabled={!canEdit} onChange={(e) => set(i, { hex: e.target.value })} className={`a-input ${hexOk ? "" : "!border-[#B03A3A]"}`} aria-invalid={!hexOk} />
              </label>
              <div className="flex items-center gap-0.5">
                <button type="button" className={iconBtn} disabled={!canEdit || i === 0} onClick={() => setColors(swap(colors, i, -1))} aria-label={`הזזת ${c.label} למעלה`}><Icon name="up" size={16} /></button>
                <button type="button" className={iconBtn} disabled={!canEdit || i === colors.length - 1} onClick={() => setColors(swap(colors, i, 1))} aria-label={`הזזת ${c.label} למטה`}><Icon name="down" size={16} /></button>
                <button
                  type="button"
                  className={`${iconBtn} hover:!bg-[#FDECEC] hover:text-[#B03A3A]`}
                  disabled={!canEdit || n > 0 || colors.length === 1}
                  title={n > 0 ? `משויך ל־${n} מוצרים – אי אפשר להסיר` : "הסרה"}
                  onClick={() => setColors(colors.filter((_, k) => k !== i))}
                  aria-label={n > 0 ? `אי אפשר להסיר את ${c.label} – משויך ל־${n} מוצרים` : `הסרת ${c.label}`}
                >
                  <Icon name="trash" size={16} />
                </button>
              </div>
              <span className="w-full text-[12px] text-adm-muted">{n ? `${n} מוצרים בצבע הזה` : "לא בשימוש"}{!old && " · חדש"}</span>
            </li>
          );
        })}
      </ul>
      {canEdit && (
        <button type="button" className="a-btn self-start" onClick={() => setColors([...colors, { key: "", label: "", hex: "#BDB9AF" }])}><Icon name="plus" size={16} /> צבע חדש</button>
      )}
      <div className="flex gap-2 items-center border-t border-adm-line pt-3">
        <button
          type="button"
          className="a-btn a-btn-primary"
          disabled={!canEdit || !dirty || pending}
          onClick={() => start(async () => {
            const r = await saveColorsAction(colors);
            setRes(r);
            if (!r.error) router.refresh();
          })}
        >
          <Icon name="check" /> {pending ? "שומרת…" : "שמירת צבעים"}
        </button>
        {dirty && <button type="button" className="a-btn" onClick={() => { setColors(initial); setRes(null); }}>ביטול שינויים</button>}
      </div>
    </section>
  );
}

export default function AttributesEditor({ sizes, colors, sizeUse, colorUse, canEdit }: { sizes: string[]; colors: ColorDef[]; sizeUse: Record<string, number>; colorUse: Record<string, number>; canEdit: boolean }) {
  return (
    <>
      <SizesCard key={sizes.join("|")} initial={sizes} use={sizeUse} canEdit={canEdit} />
      <ColorsCard key={JSON.stringify(colors)} initial={colors} use={colorUse} canEdit={canEdit} />
    </>
  );
}
