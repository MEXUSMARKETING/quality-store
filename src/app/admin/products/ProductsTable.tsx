"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CATEGORIES, SIZES, shekel } from "@/lib/config";
import type { Product } from "@/lib/types";
import { Chip, Icon, Notice } from "../_components/ui";
import { bulkProducts, deleteProductAction, duplicateProductAction } from "./actions";
import { lowOf, stockLevel, stockTotal } from "./shared";

const OPS = [
  { op: "show", label: "הצגה באתר", icon: "check" },
  { op: "hide", label: "הסתרה", icon: "close" },
  { op: "feature", label: "סימון כמומלץ", icon: "star" },
] as const;

function confirmSubmit(message: string) {
  return (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(message)) e.preventDefault();
  };
}

export default function ProductsTable({ products, canEdit, categoryNames, sizes }: { products: Product[]; canEdit: boolean; categoryNames?: Record<string, string>; sizes?: string[] }) {
  const catLabel = (k: string) => categoryNames?.[k] || CATEGORIES[k] || k;
  const sizeList = (stock: Record<string, number>) => Array.from(new Set([...(sizes && sizes.length ? sizes : SIZES), ...Object.keys(stock || {})])).filter((s) => Number(stock?.[s]) > 0);
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok?: string; error?: string } | null>(null);

  // drop selections that are no longer visible (filters changed / rows deleted)
  const ids = useMemo(() => products.map((p) => p.id), [products]);
  useEffect(() => {
    setSelected((s) => s.filter((id) => ids.includes(id)));
  }, [ids]);

  const all = ids.length > 0 && selected.length === ids.length;
  const some = selected.length > 0 && !all;
  const toggle = (id: number) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  function run(op: string, label: string) {
    if (!selected.length) return;
    if (op === "delete" && !window.confirm(`למחוק לצמיתות ${selected.length} מוצרים? אי אפשר לבטל את הפעולה. (אפשר במקום זה להסתיר אותם)`)) return;
    start(async () => {
      const r = await bulkProducts(selected, op);
      setResult(r.error ? r : { ok: r.ok || label });
      if (!r.error) {
        setSelected([]);
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {result && (
        <div role="status" aria-live="polite">
          <Notice tone={result.error ? "red" : "green"}>{result.error || result.ok}</Notice>
        </div>
      )}

      <div className="a-card !p-0 overflow-hidden">
        {canEdit && selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-[#F1ECFF] border-b border-[#E2D6FD]" role="toolbar" aria-label="פעולות על המוצרים שנבחרו">
            <b className="text-[14px] text-adm-navy me-2">{selected.length} נבחרו</b>
            {OPS.map((o) => (
              <button key={o.op} type="button" disabled={pending} onClick={() => run(o.op, o.label)} className="a-btn a-btn-sm">
                <Icon name={o.icon} size={15} /> {o.label}
              </button>
            ))}
            <button type="button" disabled={pending} onClick={() => run("delete", "מחיקה")} className="a-btn a-btn-sm a-btn-danger">
              <Icon name="trash" size={15} /> מחיקה
            </button>
            <button type="button" onClick={() => setSelected([])} className="a-btn a-btn-sm !bg-transparent !border-transparent text-adm-muted ms-auto">
              ביטול בחירה
            </button>
            {pending && <span className="text-[13px] text-adm-muted" role="status">מעדכנת…</span>}
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="a-table min-w-[900px]">
            <thead>
              <tr>
                <th className="w-[44px]">
                  <input
                    type="checkbox"
                    aria-label="בחירת כל המוצרים ברשימה"
                    className="w-[18px] h-[18px] accent-adm-blue align-middle"
                    checked={all}
                    ref={(el) => {
                      if (el) el.indeterminate = some;
                    }}
                    onChange={() => setSelected(all ? [] : ids)}
                    disabled={!canEdit}
                  />
                </th>
                <th>מוצר</th>
                <th>קטגוריה</th>
                <th>מחיר</th>
                <th>מלאי</th>
                <th>סטטוס</th>
                <th className="text-center">מומלץ</th>
                <th><span className="sr-only">פעולות</span></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const t = stockTotal(p.stock);
                const lvl = stockLevel(p);
                const low = lowOf(p);
                const checked = selected.includes(p.id);
                return (
                  <tr key={p.id} className={checked ? "[&>td]:!bg-[#F3F7FF]" : ""}>
                    <td>
                      <input type="checkbox" aria-label={`בחירת ${p.name}`} className="w-[18px] h-[18px] accent-adm-blue align-middle" checked={checked} onChange={() => toggle(p.id)} disabled={!canEdit} />
                    </td>
                    <td>
                      <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 min-w-[220px] group">
                        {p.images[0] ? (
                          <img src={p.images[0]} alt="" className="w-12 h-12 rounded-[10px] object-cover bg-adm-bg shrink-0 border border-adm-line" />
                        ) : (
                          <span className="w-12 h-12 rounded-[10px] bg-adm-bg shrink-0 flex items-center justify-center text-adm-muted border border-adm-line"><Icon name="box" size={18} /></span>
                        )}
                        <span className="flex flex-col min-w-0">
                          <b className="text-adm-navy group-hover:underline leading-5">{p.name}</b>
                          <span className="text-[12px] text-adm-muted" dir="ltr">{p.sku || p.slug}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="text-adm-muted whitespace-nowrap">{catLabel(p.category)}</td>
                    <td className="whitespace-nowrap">
                      <b>{shekel(p.price)}</b>
                      {p.old_price && p.old_price > p.price ? (
                        <s className="block text-[12px] text-adm-muted"><span className="sr-only">במקום </span>{shekel(p.old_price)}</s>
                      ) : null}
                    </td>
                    <td>
                      <div className="flex flex-col gap-1.5">
                        <span className={`text-[14px] font-bold ${lvl === "out" ? "text-[#B03A3A]" : lvl === "low" ? "text-[#8A5A00]" : "text-adm-navy"}`}>
                          {lvl === "out" ? "אזל" : `${t} זוגות`}
                          {lvl === "low" && <span className="font-medium text-[12px]"> · נמוך (≤{low})</span>}
                        </span>
                        {t > 0 && (
                          <span className="flex flex-wrap gap-1" aria-label="מלאי לפי מידה">
                            {sizeList(p.stock).map((s) => (
                              <span key={s} className={`text-[11px] leading-none rounded-md px-1.5 py-1 font-semibold ${Number(p.stock[s]) <= 1 ? "bg-[#FFF4E0] text-[#8A5A00]" : "bg-[#F0EEF6] text-[#3D3858]"}`} title={`מידה ${s}: ${p.stock[s]}`}>
                                {s}<span className="font-normal">·{p.stock[s]}</span>
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>{p.active ? <Chip tone="green">מוצג</Chip> : <Chip tone="gray">מוסתר</Chip>}</td>
                    <td className="text-center">
                      {p.featured ? (
                        <span className="inline-flex text-[#C98A00]" title="מוצר מומלץ"><Icon name="star" size={18} className="fill-current" /><span className="sr-only">מומלץ</span></span>
                      ) : (
                        <span className="inline-flex text-[#C5CDD9]" aria-hidden="true"><Icon name="star" size={18} /></span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/admin/products/${p.id}`} className="a-btn a-btn-sm !px-2.5" aria-label={`עריכת ${p.name}`} title="עריכה">
                          <Icon name="edit" size={16} />
                        </Link>
                        {canEdit && (
                          <>
                            <form action={duplicateProductAction}>
                              <input type="hidden" name="id" value={p.id} />
                              <button className="a-btn a-btn-sm !px-2.5" aria-label={`שכפול ${p.name}`} title="שכפול (עותק מוסתר)">
                                <Icon name="copy" size={16} />
                              </button>
                            </form>
                            <form action={deleteProductAction}>
                              <input type="hidden" name="id" value={p.id} />
                              <button onClick={confirmSubmit(`למחוק את "${p.name}" לצמיתות? אי אפשר לבטל.`)} className="a-btn a-btn-sm a-btn-danger !px-2.5" aria-label={`מחיקת ${p.name}`} title="מחיקה">
                                <Icon name="trash" size={16} />
                              </button>
                            </form>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
