"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon, Notice } from "../_components/ui";
import type { Variants } from "@/lib/variants";

/* Colours × sizes for one product: which colours exist, images per colour, and stock for every
   colour+size. Posts `variants_on` and `variants` (JSON) plus `vfiles_<colour>` uploads; the
   server validates everything again. */

type ColorOpt = { key: string; label: string; hex: string };
type Row = { key: string; images: string[] };

const toInt = (s: string) => {
  const t = String(s ?? "").trim();
  return /^[0-9]+$/.test(t) ? Math.min(9999, Number(t)) : 0;
};

export default function VariantsEditor({
  initial,
  colors,
  sizes,
  simpleStock,
  simpleColor,
  sharedImages,
  blobReady,
  onSummary,
}: {
  initial: Variants | null;
  colors: ColorOpt[];
  sizes: string[];
  /** the simple (one-colour) stock, used when turning variants on */
  simpleStock: Record<string, string>;
  simpleColor: string;
  /** the product's general images (images tab) – can be assigned to colours */
  sharedImages: string[];
  blobReady: boolean;
  onSummary: (s: { on: boolean; total: number; colors: number }) => void;
}) {
  const [on, setOn] = useState(!!initial);
  const [rows, setRows] = useState<Row[]>(() => initial?.colors.map((c) => ({ key: c.key, images: c.images })) || []);
  const [grid, setGrid] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries((initial?.colors || []).map((c) => [c.key, Object.fromEntries(Object.entries(initial!.stock[c.key] || {}).map(([s, q]) => [s, String(q)]))]))
  );
  const [picked, setPicked] = useState<Record<string, { name: string; url: string }[]>>({});
  const [paste, setPaste] = useState<Record<string, string>>({});
  const [openImages, setOpenImages] = useState<string | null>(null);
  const [fillTarget, setFillTarget] = useState("all");
  const [fillValue, setFillValue] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [copyTo, setCopyTo] = useState("");
  const tableRef = useRef<HTMLTableElement>(null);

  const label = (k: string) => colors.find((c) => c.key === k)?.label || k;
  const hex = (k: string) => colors.find((c) => c.key === k)?.hex || "#ccc";

  // sizes: the store's list plus any size this product has stock in
  const allSizes = useMemo(() => {
    const extra = new Set<string>();
    Object.values(grid).forEach((r) => Object.entries(r).forEach(([s, q]) => toInt(q) > 0 && !sizes.includes(s) && extra.add(s)));
    return [...sizes, ...Array.from(extra).sort((a, b) => Number(a) - Number(b))];
  }, [grid, sizes]);

  const q = (c: string, s: string) => toInt(grid[c]?.[s] || "");
  const rowTotal = (c: string) => allSizes.reduce((a, s) => a + q(c, s), 0);
  const colTotal = (s: string) => rows.reduce((a, r) => a + q(r.key, s), 0);
  const total = rows.reduce((a, r) => a + rowTotal(r.key), 0);

  useEffect(() => onSummary({ on, total, colors: rows.length }), [on, total, rows.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const setCell = (c: string, s: string, v: string) => setGrid((g) => ({ ...g, [c]: { ...(g[c] || {}), [s]: v.replace(/[^0-9]/g, "").slice(0, 4) } }));

  function enable() {
    setOn(true);
    if (!rows.length) {
      // start from the current simple product: its colour and its stock
      const k = colors.some((c) => c.key === simpleColor) ? simpleColor : colors[0]?.key || "black";
      setRows([{ key: k, images: [] }]);
      setGrid({ [k]: { ...simpleStock } });
    }
  }

  function addColor(k: string) {
    if (rows.some((r) => r.key === k)) return;
    setRows((r) => [...r, { key: k, images: [] }]);
    setGrid((g) => ({ ...g, [k]: g[k] || {} }));
    setOpenImages(k);
  }

  function removeColor(k: string) {
    if (rowTotal(k) > 0 && !window.confirm(`לצבע ${label(k)} יש ${rowTotal(k)} יחידות במלאי. להסיר אותו?`)) return;
    setRows((r) => r.filter((x) => x.key !== k));
  }

  const move = (i: number, d: -1 | 1) =>
    setRows((r) => {
      const j = i + d;
      if (j < 0 || j >= r.length) return r;
      const a = [...r];
      [a[i], a[j]] = [a[j], a[i]];
      return a;
    });

  const setImages = (k: string, fn: (imgs: string[]) => string[]) => setRows((r) => r.map((x) => (x.key === k ? { ...x, images: fn(x.images) } : x)));

  function applyFill(mode: "set" | "add") {
    const n = toInt(fillValue);
    if (!fillValue.trim()) return;
    setGrid((g) => {
      const out = { ...g };
      for (const r of rows) {
        for (const s of allSizes) {
          const hit = fillTarget === "all" || fillTarget === `c:${r.key}` || fillTarget === `s:${s}`;
          if (!hit) continue;
          const cur = toInt(out[r.key]?.[s] || "");
          out[r.key] = { ...(out[r.key] || {}), [s]: String(mode === "set" ? n : Math.min(9999, cur + n)) };
        }
      }
      return out;
    });
  }

  function copyStock() {
    if (!copyFrom || !copyTo || copyFrom === copyTo) return;
    setGrid((g) => ({ ...g, [copyTo]: { ...(g[copyFrom] || {}) } }));
  }

  // arrow keys move between cells (RTL: left = next size)
  function onCellKey(e: React.KeyboardEvent<HTMLInputElement>, ri: number, si: number) {
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, 1], ArrowRight: [0, -1], Enter: [1, 0] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    const r = Math.max(0, Math.min(rows.length - 1, ri + m[0]));
    const s = Math.max(0, Math.min(allSizes.length - 1, si + m[1]));
    tableRef.current?.querySelector<HTMLInputElement>(`input[data-cell="${r}-${s}"]`)?.focus();
  }

  const payload = on
    ? JSON.stringify({
        colors: rows.map((r) => ({ key: r.key, images: r.images })),
        stock: Object.fromEntries(rows.map((r) => [r.key, Object.fromEntries(allSizes.map((s) => [s, q(r.key, s)]).filter(([, n]) => (n as number) > 0))])),
      })
    : "";

  /* smart checks */
  const checks: { tone: "amber" | "blue" | "red"; text: string }[] = [];
  if (on) {
    const noImg = rows.filter((r) => !r.images.length && !(picked[r.key] || []).length);
    if (noImg.length) checks.push({ tone: "amber", text: `אין תמונה לצבע ${noImg.map((r) => label(r.key)).join(", ")}. בבחירת הצבע הלקוחה תראה את התמונות המשותפות של המוצר.` });
    const empty = rows.filter((r) => rowTotal(r.key) === 0);
    if (empty.length) checks.push({ tone: "amber", text: `${empty.map((r) => label(r.key)).join(", ")}: אין מלאי, הצבע יוצג באתר כ"אזל".` });
    const gone = allSizes.filter((s) => sizes.includes(s) && colTotal(s) === 0);
    if (gone.length && total > 0) checks.push({ tone: "blue", text: `מידות שאין באף צבע: ${gone.join(", ")}.` });
    const last = rows.flatMap((r) => allSizes.filter((s) => q(r.key, s) === 1).map((s) => `${label(r.key)} ${s}`));
    if (last.length) checks.push({ tone: "blue", text: `נשאר זוג אחרון ב: ${last.slice(0, 8).join(", ")}${last.length > 8 ? ` ועוד ${last.length - 8}` : ""}.` });
  }

  const cellCls = (n: number) => (n === 0 ? "bg-[#F9F8FD] border-[#E8E5F3]" : n <= 2 ? "bg-[#FFF8EB] border-[#F5DFB3]" : "bg-[#F1FAF6] border-[#C6EADB]");
  const unused = colors.filter((c) => !rows.some((r) => r.key === c.key));

  return (
    <div className="flex flex-col gap-5">
      <input type="hidden" name="variants_on" value={on ? "1" : ""} />
      <input type="hidden" name="variants" value={payload} />

      {/* mode */}
      <section className="a-card flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[16px] font-bold text-adm-navy">וריאציות: צבעים × מידות</h2>
            <p className="text-[13px] text-adm-muted leading-5 max-w-[620px]">
              דגם אחד בכמה צבעים: לכל צבע יש תמונות משלו ומלאי משלו בכל מידה. באתר הלקוחה בוחרת צבע, התמונה מתחלפת ומוצגות רק המידות שיש בצבע הזה.
            </p>
          </div>
          <div role="radiogroup" aria-label="סוג המלאי" className="inline-flex p-1 rounded-[11px] bg-adm-bg border border-adm-line">
            <button type="button" role="radio" aria-checked={!on} onClick={() => setOn(false)} className={`min-h-[38px] px-3.5 rounded-lg text-[14px] font-semibold ${!on ? "bg-white shadow text-adm-navy" : "text-adm-muted"}`}>צבע אחד</button>
            <button type="button" role="radio" aria-checked={on} onClick={enable} className={`min-h-[38px] px-3.5 rounded-lg text-[14px] font-semibold ${on ? "bg-white shadow text-adm-navy" : "text-adm-muted"}`}>כמה צבעים</button>
          </div>
        </div>
      </section>

      {on && (
        <>
          {/* colours */}
          <section className="a-card flex flex-col gap-3" aria-labelledby="v-colors">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h3 id="v-colors" className="text-[15px] font-bold text-adm-navy">הצבעים של הדגם</h3>
              <span className="text-[12px] text-adm-muted">הצבע הראשון מוצג ראשון באתר</span>
            </div>
            <ul className="flex flex-col gap-2">
              {rows.map((r, i) => (
                <li key={r.key} className="flex flex-wrap items-center gap-3 p-2.5 rounded-xl border border-adm-line bg-white">
                  <span className="w-9 h-9 rounded-full border border-adm-line shrink-0" style={{ background: hex(r.key) }} aria-hidden="true" />
                  <span className="flex flex-col min-w-[110px]">
                    <b className="text-[14px]">{label(r.key)}{i === 0 && <span className="ms-2 a-chip bg-[#F1ECFF] text-[#5414D6]">ראשי</span>}</b>
                    <span className="text-[12px] text-adm-muted">{rowTotal(r.key)} יחידות · {r.images.length + (picked[r.key]?.length || 0)} תמונות</span>
                  </span>
                  <span className="flex gap-1">
                    {r.images.slice(0, 4).map((src) => <img key={src} src={src} alt="" className="w-9 h-9 rounded-lg object-cover bg-adm-bg" />)}
                  </span>
                  <span className="ms-auto flex items-center gap-1">
                    <button type="button" onClick={() => setOpenImages(openImages === r.key ? null : r.key)} aria-expanded={openImages === r.key} className="a-btn a-btn-sm"><Icon name="image" size={15} /> תמונות</button>
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="a-btn a-btn-sm !px-2" aria-label={`הזזת ${label(r.key)} למעלה`}><Icon name="up" size={15} /></button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="a-btn a-btn-sm !px-2" aria-label={`הזזת ${label(r.key)} למטה`}><Icon name="down" size={15} /></button>
                    <button type="button" onClick={() => removeColor(r.key)} disabled={rows.length === 1} className="a-btn a-btn-sm a-btn-danger !px-2" aria-label={`הסרת ${label(r.key)}`}><Icon name="trash" size={15} /></button>
                  </span>

                  {/* images of this colour (kept in the DOM so pending uploads are submitted) */}
                  <div className={openImages === r.key ? "basis-full flex flex-col gap-3 pt-2 border-t border-adm-line" : "hidden"}>
                    {r.images.length ? (
                      <ul className="flex flex-wrap gap-2">
                        {r.images.map((src, j) => (
                          <li key={src} className={`w-[104px] rounded-lg border-2 overflow-hidden bg-white ${j === 0 ? "border-adm-blue" : "border-adm-line"}`}>
                            <img src={src} alt={`${label(r.key)} ${j + 1}`} className="w-full aspect-square object-cover bg-adm-bg" />
                            <div className="flex gap-0.5 p-1">
                              {j !== 0 && <button type="button" onClick={() => setImages(r.key, (a) => [a[j], ...a.filter((_, x) => x !== j)])} className="a-btn a-btn-sm !h-7 !px-1.5 text-[11px] flex-1">ראשית</button>}
                              <button type="button" onClick={() => setImages(r.key, (a) => a.filter((x) => x !== src))} className="a-btn a-btn-sm a-btn-danger !h-7 !px-1.5 ms-auto" aria-label="הסרה"><Icon name="trash" size={13} /></button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[13px] text-adm-muted">עדיין אין תמונות לצבע הזה.</p>
                    )}
                    {sharedImages.filter((x) => !r.images.includes(x)).length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[13px] font-semibold">בחירה מתמונות המוצר</span>
                        <div className="flex flex-wrap gap-2">
                          {sharedImages.filter((x) => !r.images.includes(x)).map((src) => (
                            <button key={src} type="button" onClick={() => setImages(r.key, (a) => [...a, src])} className="relative w-16 h-16 rounded-lg overflow-hidden border border-adm-line hover:border-adm-blue" aria-label="הוספת התמונה לצבע">
                              <img src={src} alt="" className="w-full h-full object-cover" />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 text-white opacity-0 hover:opacity-100"><Icon name="plus" /></span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="grid sm:grid-cols-2 gap-3">
                      {blobReady ? (
                        <label className="a-field">
                          העלאת תמונות לצבע {label(r.key)}
                          <input
                            name={`vfiles_${r.key}`}
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(e) => setPicked((p) => ({ ...p, [r.key]: Array.from((e.target.files || []) as ArrayLike<File>).map((f) => ({ name: f.name, url: URL.createObjectURL(f) })) }))}
                            className="text-[13px] font-normal file:me-3 file:h-9 file:px-3 file:rounded-[9px] file:border-0 file:bg-adm-navy file:text-white file:font-semibold"
                          />
                          {(picked[r.key] || []).length > 0 && (
                            <span className="flex flex-wrap gap-1.5 pt-1">
                              {picked[r.key].map((f) => <img key={f.url} src={f.url} alt={f.name} className="w-11 h-11 rounded-md object-cover" />)}
                              <span className="text-[12px] text-adm-muted self-center">יעלו בשמירה</span>
                            </span>
                          )}
                        </label>
                      ) : (
                        <p className="text-[12px] text-adm-muted">העלאת קבצים דורשת חיבור אחסון תמונות. אפשר להדביק קישור.</p>
                      )}
                      <div className="flex gap-2 items-end">
                        <label className="a-field flex-1">
                          קישור לתמונה
                          <input dir="ltr" value={paste[r.key] || ""} onChange={(e) => setPaste((p) => ({ ...p, [r.key]: e.target.value }))} placeholder="https://…" className="a-input" />
                        </label>
                        <button
                          type="button"
                          className="a-btn"
                          disabled={!/^(https?:\/\/|\/)/.test((paste[r.key] || "").trim())}
                          onClick={() => {
                            const u = (paste[r.key] || "").trim();
                            setImages(r.key, (a) => (a.includes(u) ? a : [...a, u]));
                            setPaste((p) => ({ ...p, [r.key]: "" }));
                          }}
                        >
                          <Icon name="plus" /> הוספה
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {unused.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold">הוספת צבע</span>
                <div className="flex flex-wrap gap-1.5">
                  {unused.map((c) => (
                    <button key={c.key} type="button" onClick={() => addColor(c.key)} className="flex items-center gap-1.5 h-9 px-3 rounded-full border border-adm-line bg-white text-[13px] hover:border-adm-blue">
                      <span className="w-4 h-4 rounded-full border border-adm-line" style={{ background: c.hex }} aria-hidden="true" /> {c.label} <Icon name="plus" size={13} />
                    </button>
                  ))}
                </div>
                <span className="text-[12px] text-adm-muted">צבע חסר? מוסיפים אותו במסך "מידות וצבעים".</span>
              </div>
            )}
          </section>

          {/* stock matrix */}
          <section className="a-card flex flex-col gap-3" aria-labelledby="v-stock">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <h3 id="v-stock" className="text-[15px] font-bold text-adm-navy">מלאי לפי צבע ומידה</h3>
              <span className="text-[12px] text-adm-muted">חיצים במקלדת עוברים בין המשבצות · המלאי יורד אוטומטית בכל הזמנה</span>
            </div>
            <div className="overflow-x-auto -mx-1 px-1">
              <table ref={tableRef} className="border-separate border-spacing-1 min-w-full">
                <thead>
                  <tr>
                    <th className="text-start text-[12px] text-adm-muted font-semibold px-1">צבע \ מידה</th>
                    {allSizes.map((s) => <th key={s} className="text-[13px] font-bold text-adm-navy min-w-[54px]">{s}</th>)}
                    <th className="text-[12px] text-adm-muted font-semibold px-2">סה״כ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, ri) => (
                    <tr key={r.key}>
                      <th scope="row" className="text-start pe-2">
                        <span className="flex items-center gap-2 whitespace-nowrap text-[14px] font-semibold">
                          <span className="w-4 h-4 rounded-full border border-adm-line" style={{ background: hex(r.key) }} aria-hidden="true" /> {label(r.key)}
                        </span>
                      </th>
                      {allSizes.map((s, si) => (
                        <td key={s}>
                          <input
                            data-cell={`${ri}-${si}`}
                            inputMode="numeric"
                            value={grid[r.key]?.[s] ?? ""}
                            onChange={(e) => setCell(r.key, s, e.target.value)}
                            onKeyDown={(e) => onCellKey(e, ri, si)}
                            onFocus={(e) => e.currentTarget.select()}
                            placeholder="0"
                            aria-label={`${label(r.key)} מידה ${s}`}
                            className={`w-full h-10 rounded-lg border text-center text-[15px] font-semibold tabular-nums outline-none focus:border-adm-blue focus:ring-2 focus:ring-[#6C1CF5]/20 ${cellCls(q(r.key, s))}`}
                          />
                        </td>
                      ))}
                      <td className="text-center text-[14px] font-bold tabular-nums px-2">{rowTotal(r.key)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th className="text-start text-[12px] text-adm-muted font-semibold px-1">סה״כ</th>
                    {allSizes.map((s) => <td key={s} className={`text-center text-[13px] font-bold tabular-nums ${colTotal(s) === 0 ? "text-[#B03A3A]" : "text-adm-navy"}`}>{colTotal(s)}</td>)}
                    <td className="text-center text-[15px] font-extrabold tabular-nums text-adm-navy px-2">{total}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* quick tools */}
            <div className="grid lg:grid-cols-2 gap-3 pt-1">
              <div className="flex flex-wrap items-end gap-2 p-3 rounded-xl bg-adm-bg">
                <label className="a-field">
                  מילוי מהיר
                  <select value={fillTarget} onChange={(e) => setFillTarget(e.target.value)} className="a-input !h-10">
                    <option value="all">כל הטבלה</option>
                    <optgroup label="צבע">{rows.map((r) => <option key={r.key} value={`c:${r.key}`}>כל המידות ב{label(r.key)}</option>)}</optgroup>
                    <optgroup label="מידה">{allSizes.map((s) => <option key={s} value={`s:${s}`}>מידה {s} בכל הצבעים</option>)}</optgroup>
                  </select>
                </label>
                <label className="a-field w-[84px]">
                  כמות
                  <input inputMode="numeric" value={fillValue} onChange={(e) => setFillValue(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))} className="a-input !h-10 text-center" placeholder="0" />
                </label>
                <button type="button" className="a-btn a-btn-sm !h-10" onClick={() => applyFill("set")} disabled={!fillValue}>קביעה</button>
                <button type="button" className="a-btn a-btn-sm !h-10" onClick={() => applyFill("add")} disabled={!fillValue}><span dir="ltr">+</span> הוספה</button>
              </div>
              <div className="flex flex-wrap items-end gap-2 p-3 rounded-xl bg-adm-bg">
                <label className="a-field">
                  העתקת מלאי מ־
                  <select value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} className="a-input !h-10">
                    <option value="">צבע…</option>
                    {rows.map((r) => <option key={r.key} value={r.key}>{label(r.key)}</option>)}
                  </select>
                </label>
                <label className="a-field">
                  אל
                  <select value={copyTo} onChange={(e) => setCopyTo(e.target.value)} className="a-input !h-10">
                    <option value="">צבע…</option>
                    {rows.filter((r) => r.key !== copyFrom).map((r) => <option key={r.key} value={r.key}>{label(r.key)}</option>)}
                  </select>
                </label>
                <button type="button" className="a-btn a-btn-sm !h-10" onClick={copyStock} disabled={!copyFrom || !copyTo}><Icon name="copy" size={15} /> העתקה</button>
                <button type="button" className="a-btn a-btn-sm !h-10 ms-auto" onClick={() => { if (window.confirm("לאפס את כל המלאי בטבלה?")) setGrid({}); }}>איפוס</button>
              </div>
            </div>
          </section>

          {checks.length > 0 && (
            <section aria-label="בדיקות חכמות" className="flex flex-col gap-2">
              {checks.map((c, i) => <Notice key={i} tone={c.tone}>{c.text}</Notice>)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
