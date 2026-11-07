"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Chip, Icon } from "../_components/ui";
import {
  PERK_ICONS,
  fillPlaceholders,
  israelToday,
  sectionLive,
  type HomeSection,
  type SectionType,
} from "@/lib/content-shared";
import { discardHomepageDraftAction, publishHomepageAction, saveHomepageDraftAction, uploadHomepageImageAction } from "./actions";
import { PERK_ICON_LABELS, SECTION_META, SOURCE_LABELS, type PreviewProduct } from "./meta";

type Props = {
  initial: HomeSection[];
  published: HomeSection[];
  initialHasDraft: boolean;
  templates: Record<SectionType, HomeSection>;
  products: PreviewProduct[];
  categories: { key: string; name: string }[];
  canEdit: boolean;
  storageReady: boolean;
};

const newId = () => "s" + Math.random().toString(36).slice(2, 9);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const plain = (t: string) => String(t || "").replace(/\*/g, "").replace(/\n/g, " ");

function summary(s: HomeSection, cats: Record<string, string>): string {
  switch (s.type) {
    case "hero":
      return plain(s.title) || "ללא כותרת";
    case "categories":
      return s.tiles.map((t) => t.label).filter(Boolean).join(" · ") || "אין אריחים";
    case "products":
      return `${s.title || "ללא כותרת"} · ${s.source.startsWith("category:") ? "קטגוריה: " + (cats[s.source.slice(9)] || s.source.slice(9)) : SOURCE_LABELS[s.source] || s.source} · ${s.count}`;
    case "promos":
      return s.items.map((b) => b.title).filter(Boolean).join(" · ") || "אין באנרים";
    case "perks":
      return s.items.map((p) => p.title).filter(Boolean).join(" · ");
    case "club":
      return plain(s.title);
  }
}

function dateLabel(s: HomeSection): string {
  const f = (d: string) => d.split("-").reverse().slice(0, 2).join(".");
  if (s.start && s.end) return `${f(s.start)}–${f(s.end)}`;
  if (s.start) return `מ־${f(s.start)}`;
  if (s.end) return `עד ${f(s.end)}`;
  return "";
}

/* ------------------------------------------------------------------ */

export default function HomepageEditor({ initial, published, initialHasDraft, templates, products, categories, canEdit, storageReady }: Props) {
  const [sections, setSections] = useState<HomeSection[]>(() => clone(initial));
  const [saved, setSaved] = useState<HomeSection[]>(() => clone(initial)); // last saved draft
  const [live, setLive] = useState<HomeSection[]>(() => clone(published));
  const [selected, setSelected] = useState<string | null>(initial[0]?.id ?? null);
  const [picker, setPicker] = useState(false);
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(initialHasDraft ? { tone: "green", text: "נטענה טיוטה שמורה שעדיין לא פורסמה." } : null);
  const [width, setWidth] = useState<"desktop" | "mobile">("desktop");
  const [pending, start] = useTransition();
  const editRef = useRef<HTMLDivElement>(null);

  const catNames = useMemo(() => Object.fromEntries(categories.map((c) => [c.key, c.name])), [categories]);
  const unsaved = !same(sections, saved);
  const unpublished = !same(sections, live);

  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (unsaved) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [unsaved]);

  const update = (id: string, patch: Partial<HomeSection>) => setSections((list) => list.map((s) => (s.id === id ? ({ ...s, ...patch } as HomeSection) : s)));
  const move = (i: number, d: -1 | 1) =>
    setSections((list) => {
      const j = i + d;
      if (j < 0 || j >= list.length) return list;
      const next = [...list];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const duplicate = (i: number) => {
    const copy = { ...clone(sections[i]), id: newId() };
    setSections((list) => [...list.slice(0, i + 1), copy, ...list.slice(i + 1)]);
    setSelected(copy.id);
  };
  const remove = (i: number) => {
    const s = sections[i];
    if (!window.confirm(`למחוק את המקטע "${SECTION_META[s.type].label}"? אפשר לבטל עד הפרסום בעזרת "ביטול שינויים".`)) return;
    setSections((list) => list.filter((x) => x.id !== s.id));
    if (selected === s.id) setSelected(null);
  };
  const add = (t: SectionType) => {
    const s = { ...clone(templates[t]), id: newId() } as HomeSection;
    const idx = selected ? sections.findIndex((x) => x.id === selected) : -1;
    setSections((list) => (idx >= 0 ? [...list.slice(0, idx + 1), s, ...list.slice(idx + 1)] : [...list, s]));
    setSelected(s.id);
    setPicker(false);
    setTimeout(() => editRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const run = (fn: () => Promise<{ ok?: boolean; error?: string; sections?: HomeSection[] }>, okText: string, after?: (s: HomeSection[]) => void) =>
    start(async () => {
      setMsg(null);
      try {
        const r = await fn();
        if (r.error) setMsg({ tone: "red", text: r.error });
        else {
          if (r.sections) after?.(r.sections);
          setMsg({ tone: "green", text: okText });
        }
      } catch (e) {
        console.error(e);
        setMsg({ tone: "red", text: "הפעולה נכשלה. בדקו את החיבור ונסו שוב." });
      }
    });

  const saveDraft = () => run(() => saveHomepageDraftAction(JSON.stringify(sections)), "הטיוטה נשמרה. האתר לא השתנה עד הפרסום.", (s) => { setSections(s); setSaved(clone(s)); });
  const publish = () => {
    if (!window.confirm("לפרסם את השינויים? דף הבית באתר יתעדכן מיד.")) return;
    run(() => publishHomepageAction(JSON.stringify(sections)), "דף הבית פורסם באתר.", (s) => { setSections(s); setSaved(clone(s)); setLive(clone(s)); });
  };
  const discard = () => {
    if (!window.confirm("לבטל את כל השינויים שלא פורסמו ולחזור לגרסה שבאתר?")) return;
    run(() => discardHomepageDraftAction(), "השינויים בוטלו. מוצגת הגרסה שבאתר.", (s) => { setSections(s); setSaved(clone(s)); setLive(clone(s)); setSelected(s[0]?.id ?? null); });
  };

  const sel = sections.find((s) => s.id === selected) || null;
  const today = israelToday();

  return (
    <div className="flex flex-col gap-4">
      {/* toolbar */}
      <div className="a-card !py-3 flex flex-wrap items-center gap-3 sticky top-[72px] z-20">
        <div className="flex items-center gap-2 flex-wrap" aria-live="polite">
          {unpublished ? <Chip tone="amber">שינויים שלא פורסמו</Chip> : <Chip tone="green">מעודכן באתר</Chip>}
          {unsaved && <Chip tone="gray">לא נשמר</Chip>}
          <span className="text-[13px] text-adm-muted">{sections.length} מקטעים · {sections.filter((s) => sectionLive(s, today)).length} מוצגים היום</span>
        </div>
        {canEdit && (
          <div className="flex gap-2 ms-auto flex-wrap">
            {unpublished && (
              <button type="button" onClick={discard} disabled={pending} className="a-btn a-btn-sm">ביטול שינויים</button>
            )}
            <button type="button" onClick={saveDraft} disabled={pending || !unsaved} className="a-btn a-btn-sm">
              <Icon name="check" size={15} /> שמירת טיוטה
            </button>
            <button type="button" onClick={publish} disabled={pending || !unpublished} className="a-btn a-btn-sm a-btn-primary">
              <Icon name="external" size={15} /> {pending ? "שומר…" : "פרסום"}
            </button>
          </div>
        )}
      </div>

      {msg && (
        <div role={msg.tone === "red" ? "alert" : "status"} className={`p-3 rounded-xl border text-[14px] ${msg.tone === "red" ? "bg-[#FDECEC] text-[#8A2626] border-[#F3D3D3]" : "bg-[#E6F6F0] text-[#0B5E43] border-[#C6EADB]"}`}>
          {msg.text}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
        {/* ---------- editor column ---------- */}
        <div className="flex flex-col gap-4 min-w-0">
          <section aria-label="מקטעי דף הבית" className="a-card !p-0 overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-adm-line">
              <h2 className="text-[15px] font-bold">מקטעים (לפי סדר ההצגה)</h2>
              {canEdit && (
                <button type="button" onClick={() => setPicker((p) => !p)} aria-expanded={picker} className="a-btn a-btn-sm a-btn-primary">
                  <Icon name="plus" size={15} /> הוספת מקטע
                </button>
              )}
            </div>
            {picker && canEdit && (
              <div className="p-3 border-b border-adm-line bg-adm-bg grid gap-2 sm:grid-cols-2" role="group" aria-label="בחירת סוג מקטע">
                {(Object.keys(SECTION_META) as SectionType[]).map((t) => (
                  <button key={t} type="button" onClick={() => add(t)} className="text-right rounded-xl border border-adm-line bg-white hover:border-adm-blue p-3 flex flex-col gap-0.5 min-h-[56px]">
                    <b className="text-[14px]">{SECTION_META[t].label}</b>
                    <span className="text-[12px] text-adm-muted">{SECTION_META[t].hint}</span>
                  </button>
                ))}
              </div>
            )}
            {sections.length === 0 ? (
              <p className="p-6 text-center text-[14px] text-adm-muted">אין מקטעים. דף הבית יהיה ריק – הוסיפו מקטע.</p>
            ) : (
              <ol className="divide-y divide-adm-line">
                {sections.map((s, i) => {
                  const isLive = sectionLive(s, today);
                  const active = s.id === selected;
                  return (
                    <li key={s.id} className={`flex items-center gap-2 px-3 py-2.5 ${active ? "bg-[#EEF4FF]" : ""}`}>
                      <span className="w-6 text-center text-[13px] text-adm-muted font-semibold" aria-hidden="true">{i + 1}</span>
                      <button type="button" onClick={() => setSelected(active ? null : s.id)} aria-expanded={active} className="flex-1 min-w-0 text-right py-1">
                        <span className="flex items-center gap-2 flex-wrap">
                          <b className="text-[14px]">{SECTION_META[s.type].label}</b>
                          {!s.visible && <Chip tone="gray">מוסתר</Chip>}
                          {s.visible && !isLive && <Chip tone="blue">מתוזמן {dateLabel(s)}</Chip>}
                          {s.visible && isLive && dateLabel(s) && <Chip tone="green">{dateLabel(s)}</Chip>}
                        </span>
                        <span className="block text-[12px] text-adm-muted truncate">{summary(s, catNames)}</span>
                      </button>
                      {canEdit && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button type="button" onClick={() => update(s.id, { visible: !s.visible })} role="switch" aria-checked={s.visible} aria-label={`${s.visible ? "הסתרת" : "הצגת"} ${SECTION_META[s.type].label}`} title={s.visible ? "מוצג – לחצו להסתרה" : "מוסתר – לחצו להצגה"} className="h-9 px-1 flex items-center rounded-lg hover:bg-adm-bg">
                            <span className={`w-9 h-[20px] rounded-full p-[3px] flex ${s.visible ? "bg-[#0F7A57] justify-end" : "bg-[#B7C0CF] justify-start"}`} dir="ltr">
                              <span className="w-3.5 h-3.5 rounded-full bg-white shadow" />
                            </span>
                          </button>
                          <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="a-btn a-btn-sm !h-9 !px-2" aria-label={`הזזת ${SECTION_META[s.type].label} למעלה`}><Icon name="up" size={15} /></button>
                          <button type="button" onClick={() => move(i, 1)} disabled={i === sections.length - 1} className="a-btn a-btn-sm !h-9 !px-2" aria-label={`הזזת ${SECTION_META[s.type].label} למטה`}><Icon name="down" size={15} /></button>
                          <button type="button" onClick={() => duplicate(i)} className="a-btn a-btn-sm !h-9 !px-2 hidden sm:inline-flex" aria-label={`שכפול ${SECTION_META[s.type].label}`} title="שכפול"><Icon name="copy" size={15} /></button>
                          <button type="button" onClick={() => remove(i)} className="a-btn a-btn-sm a-btn-danger !h-9 !px-2" aria-label={`מחיקת ${SECTION_META[s.type].label}`} title="מחיקה"><Icon name="trash" size={15} /></button>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          <div ref={editRef}>
            {sel ? (
              <SectionForm key={sel.id} s={sel} onChange={(p) => update(sel.id, p)} categories={categories} canEdit={canEdit} storageReady={storageReady} />
            ) : (
              <div className="a-card text-center text-[14px] text-adm-muted py-8">בחרו מקטע מהרשימה כדי לערוך אותו.</div>
            )}
          </div>
        </div>

        {/* ---------- preview column ---------- */}
        <section aria-label="תצוגה מקדימה" className="a-card !p-0 overflow-hidden xl:sticky xl:top-[140px]">
          <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-adm-line">
            <h2 className="text-[15px] font-bold">תצוגה מקדימה</h2>
            <div className="flex gap-1" role="group" aria-label="רוחב התצוגה">
              <button type="button" aria-pressed={width === "desktop"} onClick={() => setWidth("desktop")} className={`a-btn a-btn-sm ${width === "desktop" ? "a-btn-dark" : ""}`}>מחשב</button>
              <button type="button" aria-pressed={width === "mobile"} onClick={() => setWidth("mobile")} className={`a-btn a-btn-sm ${width === "mobile" ? "a-btn-dark" : ""}`}>נייד</button>
            </div>
          </div>
          <div className="bg-[#E9EDF3] p-3 max-h-[78vh] overflow-y-auto">
            <div className={`mx-auto bg-white shadow-sm transition-all ${width === "mobile" ? "max-w-[375px]" : "max-w-full"}`}>
              <Preview sections={sections} products={products} selected={selected} onSelect={setSelected} mobile={width === "mobile"} today={today} />
            </div>
          </div>
          <p className="px-4 py-2 text-[12px] text-adm-muted border-t border-adm-line">תצוגה מפושטת. מקטעים מוסתרים או מחוץ לתאריכים מוצגים בשקיפות ולא יופיעו באתר.</p>
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Edit forms                                                          */
/* ------------------------------------------------------------------ */

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="a-field">
      {label}
      {children}
      {hint && <span className="text-[12px] font-normal text-adm-muted">{hint}</span>}
    </label>
  );
}

function ImageField({ label, value, onChange, disabled, storageReady }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean; storageReady: boolean }) {
  const [busy, start] = useTransition();
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = (f: File) =>
    start(async () => {
      setErr("");
      const fd = new FormData();
      fd.append("file", f);
      try {
        const r = await uploadHomepageImageAction(fd);
        if (r.error) setErr(r.error);
        else if (r.url) onChange(r.url);
      } catch {
        setErr("העלאת התמונה נכשלה. נסו שוב, או הדביקו קישור לתמונה.");
      }
      if (fileRef.current) fileRef.current.value = "";
    });
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-semibold">{label}</span>
      <div className="flex gap-2 items-start">
        <span className="w-16 h-16 rounded-lg bg-adm-bg border border-adm-line overflow-hidden shrink-0 flex items-center justify-center text-adm-muted">
          {value ? <img src={value} alt="" className="w-full h-full object-cover" /> : <Icon name="image" size={20} />}
        </span>
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <input value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} dir="ltr" placeholder="https://… או /products/…" aria-label={`${label} – קישור`} className="a-input text-left" />
          <div className="flex gap-2 items-center flex-wrap">
            <label className={`a-btn a-btn-sm ${disabled || busy ? "opacity-55 pointer-events-none" : ""}`}>
              <Icon name="download" size={15} className="rotate-180" /> {busy ? "מעלה…" : "העלאת תמונה"}
              <input ref={fileRef} type="file" accept="image/*" className="sr-only" disabled={disabled || busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
            </label>
            {!storageReady && <span className="text-[12px] text-adm-muted">אחסון תמונות לא מחובר – אפשר להדביק קישור.</span>}
          </div>
          {err && <span role="alert" className="text-[12px] text-[#B03A3A]">{err}</span>}
        </div>
      </div>
    </div>
  );
}

function SectionForm({ s, onChange, categories, canEdit, storageReady }: { s: HomeSection; onChange: (p: Partial<HomeSection>) => void; categories: { key: string; name: string }[]; canEdit: boolean; storageReady: boolean }) {
  const dis = !canEdit;
  const inp = (k: string, v: string, set: (v: string) => void, props: Record<string, unknown> = {}) => (
    <input value={v} onChange={(e) => set(e.target.value)} disabled={dis} className="a-input" {...props} />
  );
  const titleHint = "שורה חדשה = Enter. *טקסט בין כוכביות* מודגש בזהב. אפשר להשתמש ב־{minPrice} ו־{maxPct}.";

  return (
    <section aria-label={`עריכת ${SECTION_META[s.type].label}`} className="a-card flex flex-col gap-4">
      <h2 className="text-[16px] font-extrabold text-adm-navy">עריכה: {SECTION_META[s.type].label}</h2>

      {s.type === "hero" && (
        <>
          <Field label="כיתוב עליון (קטן)">{inp("kicker", s.kicker, (v) => onChange({ kicker: v }), { dir: "auto", maxLength: 80 })}</Field>
          <Field label="כותרת" hint={titleHint}>
            <textarea value={s.title} onChange={(e) => onChange({ title: e.target.value })} disabled={dis} rows={2} maxLength={160} className="a-input" />
          </Field>
          <Field label="טקסט משנה" hint="אפשר להשתמש ב־{minPrice} (המחיר הנמוך במגפונים) ו־{maxPct} (אחוז ההנחה הגבוה).">
            <textarea value={s.subtitle} onChange={(e) => onChange({ subtitle: e.target.value })} disabled={dis} rows={3} maxLength={400} className="a-input" />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="כפתור ראשי – טקסט">{inp("p", s.primaryText, (v) => onChange({ primaryText: v }), { maxLength: 40 })}</Field>
            <Field label="כפתור ראשי – קישור">{inp("ph", s.primaryHref, (v) => onChange({ primaryHref: v }), { dir: "ltr", placeholder: "/shop" })}</Field>
            <Field label="כפתור משני – טקסט">{inp("s", s.secondaryText, (v) => onChange({ secondaryText: v }), { maxLength: 40 })}</Field>
            <Field label="כפתור משני – קישור">{inp("sh", s.secondaryHref, (v) => onChange({ secondaryHref: v }), { dir: "ltr", placeholder: "/shop?sort=discount" })}</Field>
          </div>
          <ImageField label="תמונת רקע" value={s.image} onChange={(v) => onChange({ image: v })} disabled={dis} storageReady={storageReady} />
        </>
      )}

      {s.type === "categories" && (
        <>
          {s.tiles.map((t, i) => (
            <fieldset key={i} className="rounded-xl border border-adm-line p-3 flex flex-col gap-3">
              <legend className="px-1 text-[13px] font-bold">אריח {i + 1}</legend>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="שם">{inp("l", t.label, (v) => onChange({ tiles: s.tiles.map((x, j) => (j === i ? { ...x, label: v } : x)) }), { maxLength: 60 })}</Field>
                <Field label="קישור">
                  <LinkInput value={t.href} onChange={(v) => onChange({ tiles: s.tiles.map((x, j) => (j === i ? { ...x, href: v } : x)) })} categories={categories} disabled={dis} />
                </Field>
              </div>
              <ImageField label="תמונה" value={t.image} onChange={(v) => onChange({ tiles: s.tiles.map((x, j) => (j === i ? { ...x, image: v } : x)) })} disabled={dis} storageReady={storageReady} />
              {canEdit && (
                <div className="flex gap-2">
                  <button type="button" disabled={i === 0} onClick={() => { const n = [...s.tiles]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; onChange({ tiles: n }); }} className="a-btn a-btn-sm" aria-label={`הזזת אריח ${i + 1} קדימה`}><Icon name="up" size={14} /></button>
                  <button type="button" disabled={i === s.tiles.length - 1} onClick={() => { const n = [...s.tiles]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; onChange({ tiles: n }); }} className="a-btn a-btn-sm" aria-label={`הזזת אריח ${i + 1} אחורה`}><Icon name="down" size={14} /></button>
                  <button type="button" onClick={() => onChange({ tiles: s.tiles.filter((_, j) => j !== i) })} className="a-btn a-btn-sm a-btn-danger"><Icon name="trash" size={14} /> הסרה</button>
                </div>
              )}
            </fieldset>
          ))}
          {canEdit && s.tiles.length < 4 && (
            <button type="button" onClick={() => onChange({ tiles: [...s.tiles, { label: "", href: "/shop", image: "" }] })} className="a-btn a-btn-sm self-start"><Icon name="plus" size={15} /> הוספת אריח ({s.tiles.length}/4)</button>
          )}
        </>
      )}

      {s.type === "products" && (
        <>
          <Field label="כותרת השורה">{inp("t", s.title, (v) => onChange({ title: v }), { maxLength: 80 })}</Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="מקור המוצרים">
              <select value={s.source} onChange={(e) => onChange({ source: e.target.value })} disabled={dis} className="a-input">
                {Object.entries(SOURCE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                <optgroup label="קטגוריה">
                  {categories.map((c) => <option key={c.key} value={`category:${c.key}`}>{c.name}</option>)}
                </optgroup>
              </select>
            </Field>
            <Field label="כמות מוצרים">
              <input type="number" min={2} max={20} value={s.count} onChange={(e) => onChange({ count: Math.min(20, Math.max(2, Number(e.target.value) || 2)) })} disabled={dis} className="a-input" />
            </Field>
          </div>
          <Field label='קישור "לכל המוצרים"'>
            <LinkInput value={s.href} onChange={(v) => onChange({ href: v })} categories={categories} disabled={dis} />
          </Field>
          {s.source === "best" && <p className="text-[12px] text-adm-muted -mt-2">לפי כמות יחידות שנמכרו. עד שיש מספיק הזמנות – מוצרים מומלצים ובהנחה הגבוהה.</p>}
        </>
      )}

      {s.type === "promos" && (
        <>
          {s.items.map((b, i) => (
            <fieldset key={i} className="rounded-xl border border-adm-line p-3 flex flex-col gap-3">
              <legend className="px-1 text-[13px] font-bold">באנר {i + 1}</legend>
              <Field label="כותרת">{inp("t", b.title, (v) => onChange({ items: s.items.map((x, j) => (j === i ? { ...x, title: v } : x)) }), { maxLength: 80 })}</Field>
              <Field label="טקסט">{inp("x", b.text, (v) => onChange({ items: s.items.map((x, j) => (j === i ? { ...x, text: v } : x)) }), { maxLength: 200 })}</Field>
              <Field label="קישור">
                <LinkInput value={b.href} onChange={(v) => onChange({ items: s.items.map((x, j) => (j === i ? { ...x, href: v } : x)) })} categories={categories} disabled={dis} />
              </Field>
              <ImageField label="תמונה" value={b.image} onChange={(v) => onChange({ items: s.items.map((x, j) => (j === i ? { ...x, image: v } : x)) })} disabled={dis} storageReady={storageReady} />
              {canEdit && (
                <button type="button" onClick={() => onChange({ items: s.items.filter((_, j) => j !== i) })} className="a-btn a-btn-sm a-btn-danger self-start"><Icon name="trash" size={14} /> הסרת באנר</button>
              )}
            </fieldset>
          ))}
          {canEdit && s.items.length < 2 && (
            <button type="button" onClick={() => onChange({ items: [...s.items, { title: "", text: "", href: "/shop", image: "" }] })} className="a-btn a-btn-sm self-start"><Icon name="plus" size={15} /> הוספת באנר ({s.items.length}/2)</button>
          )}
        </>
      )}

      {s.type === "perks" && (
        <>
          {s.items.map((p, i) => (
            <fieldset key={i} className="rounded-xl border border-adm-line p-3 grid sm:grid-cols-[1fr_1fr_160px] gap-3 items-end">
              <legend className="px-1 text-[13px] font-bold">יתרון {i + 1}</legend>
              <Field label="כותרת">{inp("t", p.title, (v) => onChange({ items: s.items.map((x, j) => (j === i ? { ...x, title: v } : x)) }), { maxLength: 60 })}</Field>
              <Field label="טקסט משנה">{inp("s", p.sub, (v) => onChange({ items: s.items.map((x, j) => (j === i ? { ...x, sub: v } : x)) }), { maxLength: 120 })}</Field>
              <Field label="אייקון">
                <select value={p.icon} onChange={(e) => onChange({ items: s.items.map((x, j) => (j === i ? { ...x, icon: e.target.value as any } : x)) })} disabled={dis} className="a-input">
                  {PERK_ICONS.map((k) => <option key={k} value={k}>{PERK_ICON_LABELS[k]}</option>)}
                </select>
              </Field>
            </fieldset>
          ))}
          {canEdit && (
            <div className="flex gap-2">
              {s.items.length < 4 && <button type="button" onClick={() => onChange({ items: [...s.items, { title: "", sub: "", icon: "star" }] })} className="a-btn a-btn-sm"><Icon name="plus" size={15} /> הוספה</button>}
              {s.items.length > 1 && <button type="button" onClick={() => onChange({ items: s.items.slice(0, -1) })} className="a-btn a-btn-sm a-btn-danger"><Icon name="trash" size={14} /> הסרת האחרון</button>}
            </div>
          )}
          <p className="text-[12px] text-adm-muted">בנייד מוצגות רק הכותרות. אפשר להשתמש ב־{"{maxPct}"}.</p>
        </>
      )}

      {s.type === "club" && (
        <>
          <Field label="כיתוב עליון">{inp("k", s.kicker, (v) => onChange({ kicker: v }), { maxLength: 80 })}</Field>
          <Field label="כותרת" hint={titleHint}>
            <textarea value={s.title} onChange={(e) => onChange({ title: e.target.value })} disabled={dis} rows={2} maxLength={160} className="a-input" />
          </Field>
          <Field label="טקסט">
            <textarea value={s.text} onChange={(e) => onChange({ text: e.target.value })} disabled={dis} rows={3} maxLength={400} className="a-input" />
          </Field>
          <p className="text-[12px] text-adm-muted -mt-2">הטופס עצמו (שם, טלפון, מייל) קבוע ומצטרף למועדון הלקוחות.</p>
        </>
      )}

      {/* common: visibility + dates */}
      <div className="border-t border-adm-line pt-4 flex flex-col gap-3">
        <label className="flex items-center gap-2.5 min-h-[40px] text-[14px] font-semibold cursor-pointer">
          <input type="checkbox" checked={s.visible} onChange={(e) => onChange({ visible: e.target.checked })} disabled={dis} className="w-5 h-5 accent-[#3478F6]" />
          המקטע מוצג באתר
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="מתאריך (לא חובה)">
            <input type="date" value={s.start || ""} onChange={(e) => onChange({ start: e.target.value || undefined })} disabled={dis} className="a-input" />
          </Field>
          <Field label="עד תאריך (כולל)">
            <input type="date" value={s.end || ""} min={s.start || undefined} onChange={(e) => onChange({ end: e.target.value || undefined })} disabled={dis} className="a-input" />
          </Field>
        </div>
        {s.start && s.end && s.end < s.start && <p role="alert" className="text-[13px] text-[#B03A3A]">תאריך הסיום מוקדם מתאריך ההתחלה.</p>}
        <span className="text-[12px] text-adm-muted">לפי שעון ישראל. מתאים למבצעים זמניים – המקטע יופיע וייעלם לבד.</span>
      </div>
    </section>
  );
}

/** Link input with quick picks for categories and common store links. */
function LinkInput({ value, onChange, categories, disabled }: { value: string; onChange: (v: string) => void; categories: { key: string; name: string }[]; disabled: boolean }) {
  const ok = !value || /^\/(?!\/)/.test(value) || /^https?:\/\/\S+$/i.test(value);
  return (
    <span className="flex flex-col gap-1">
      <span className="flex gap-1.5">
        <input value={value} onChange={(e) => onChange(e.target.value.trim())} disabled={disabled} dir="ltr" placeholder="/shop" aria-invalid={!ok || undefined} className={"a-input text-left" + (ok ? "" : " !border-[#B03A3A]")} />
        <select
          value=""
          onChange={(e) => e.target.value && onChange(e.target.value)}
          disabled={disabled}
          aria-label="בחירת קישור מהירה"
          className="a-input !w-[44px] !px-1 shrink-0"
        >
          <option value="">…</option>
          <option value="/shop">כל המוצרים</option>
          <option value="/shop?sort=new">חדשים</option>
          <option value="/shop?sort=discount">מבצעים</option>
          {categories.map((c) => <option key={c.key} value={`/shop?category=${c.key}`}>{c.name}</option>)}
        </select>
      </span>
      {!ok && <span className="text-[12px] text-[#B03A3A] font-normal">קישור צריך להתחיל ב־/ (עמוד באתר) או ב־https://</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Simplified live preview                                             */
/* ------------------------------------------------------------------ */

const shekel = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((l, i) => (
        <span key={i} className="block">
          {l.split(/(\*[^*]+\*)/g).map((p, j) => (/^\*[^*]+\*$/.test(p) ? <span key={j} className="text-[#C9A24A]">{p.slice(1, -1)}</span> : <span key={j}>{p}</span>))}
        </span>
      ))}
    </>
  );
}

function Preview({ sections, products, selected, onSelect, mobile, today }: { sections: HomeSection[]; products: PreviewProduct[]; selected: string | null; onSelect: (id: string) => void; mobile: boolean; today: string }) {
  const boots = products.filter((p) => p.category === "boots");
  const minPrice = boots.length ? Math.min(...boots.map((p) => p.price)) : 140;
  const maxPct = boots.reduce((m, p) => (p.old_price && p.old_price > p.price ? Math.max(m, Math.round((1 - p.price / p.old_price) * 100)) : m), 0) || 60;
  const fill = (t: string) => fillPlaceholders(t, { minPrice, maxPct });
  const pct = (p: PreviewProduct) => (p.old_price && p.old_price > p.price ? 1 - p.price / p.old_price : 0);
  const pick = (src: string) => {
    if (src === "best") return [...products].sort((a, b) => Number(b.featured) - Number(a.featured) || pct(b) - pct(a));
    if (src === "featured") { const f = products.filter((p) => p.featured); return f.length ? f : [...products].sort((a, b) => b.id - a.id); }
    if (src === "sale") return products.filter((p) => pct(p) > 0).sort((a, b) => pct(b) - pct(a));
    if (src.startsWith("category:")) return products.filter((p) => p.category === src.slice(9)).sort((a, b) => b.id - a.id);
    return [...products].sort((a, b) => b.id - a.id);
  };

  if (!sections.length) return <p className="p-10 text-center text-[13px] text-adm-muted">דף הבית ריק</p>;

  return (
    <div className="text-[#141414]" dir="rtl">
      {sections.map((s) => {
        const live = sectionLive(s, today);
        const wrap = (child: React.ReactNode) => (
          <div key={s.id} onClick={() => onSelect(s.id)} className={`relative cursor-pointer outline-offset-[-2px] ${s.id === selected ? "outline outline-2 outline-[#3478F6]" : "hover:outline hover:outline-1 hover:outline-[#9EC2FF]"} ${live ? "" : "opacity-40"}`}>
            {!live && <span className="absolute top-1 left-1 z-10 text-[10px] font-bold bg-white text-[#3B475C] rounded px-1.5 py-0.5">{s.visible ? "מחוץ לתאריכים" : "מוסתר"}</span>}
            {child}
          </div>
        );
        switch (s.type) {
          case "hero":
            return wrap(
              <div className="relative bg-[#0E0E0E] text-white overflow-hidden">
                {s.image && <img src={s.image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-black/35 to-black/10" />
                <div className={`relative flex flex-col justify-center gap-2 px-5 ${mobile ? "min-h-[260px]" : "min-h-[300px]"}`}>
                  {s.kicker && <span className="text-[#C9A24A] text-[9px] tracking-[3px] self-end" dir="auto">{fill(s.kicker)}</span>}
                  <b className={`font-extrabold leading-none ${mobile ? "text-[26px]" : "text-[34px]"}`}><Rich text={fill(s.title)} /></b>
                  {s.subtitle && <p className="text-[11px] text-[#E8E4DA] max-w-[260px] leading-relaxed">{fill(s.subtitle)}</p>}
                  <div className="flex gap-2 mt-1">
                    {s.primaryText && <span className="h-8 px-4 rounded-full bg-[#C9A24A] text-[#141414] text-[11px] font-bold flex items-center">{s.primaryText}</span>}
                    {s.secondaryText && <span className="h-8 px-4 rounded-full border border-white/60 text-[11px] flex items-center">{s.secondaryText}</span>}
                  </div>
                </div>
              </div>
            );
          case "categories": {
            const t = s.tiles;
            const cols = mobile ? Math.min(2, t.length || 1) : t.length || 1;
            return wrap(
              <div className="grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                {t.map((c, i) => (
                  <div key={i} className="relative aspect-[4/5] bg-[#F6F5F2] overflow-hidden">
                    {c.image && <img src={c.image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <b className="absolute bottom-2 right-2 text-white text-[13px]">{c.label || "—"}</b>
                  </div>
                ))}
                {!t.length && <p className="p-4 text-[12px] text-adm-muted">אין אריחים</p>}
              </div>
            );
          }
          case "products": {
            const list = pick(s.source).slice(0, s.count);
            const shown = list.slice(0, mobile ? 2 : 3);
            return wrap(
              <div className="px-4 pt-5 pb-1">
                <div className="flex justify-between items-end pb-2">
                  <b className="text-[17px]">{fill(s.title)}</b>
                  <span className="text-[10px] underline">לכל המוצרים</span>
                </div>
                {shown.length ? (
                  <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${mobile ? 2 : 3}, minmax(0, 1fr))` }}>
                    {shown.map((p) => (
                      <div key={p.id} className="flex flex-col gap-1">
                        <div className="aspect-[4/5] bg-[#F6F5F2] rounded overflow-hidden">{p.image && <img src={p.image} alt="" className="w-full h-full object-cover" />}</div>
                        <span className="text-[10px] truncate">{p.name}</span>
                        <b className="text-[11px]">{shekel(p.price)}</b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-adm-muted py-3">אין מוצרים מתאימים – השורה לא תוצג באתר.</p>
                )}
                {list.length > shown.length && <p className="text-[10px] text-adm-muted pt-1">+{list.length - shown.length} מוצרים נוספים בגלילה</p>}
              </div>
            );
          }
          case "promos":
            return wrap(
              <div className={`grid mt-5 ${!mobile && s.items.length > 1 ? "grid-cols-2" : ""}`}>
                {s.items.map((b, i) => (
                  <div key={i} className="relative aspect-[4/3] bg-[#0E0E0E] overflow-hidden">
                    {b.image && <img src={b.image} alt="" className="absolute inset-0 w-full h-full object-cover" />}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-3 right-3 left-3 text-white">
                      <b className="block text-[18px] leading-tight">{fill(b.title)}</b>
                      <span className="text-[11px] text-[#E8E4DA]">{fill(b.text)}</span>
                    </div>
                  </div>
                ))}
              </div>
            );
          case "perks":
            return wrap(
              <div className="grid px-3 py-5" style={{ gridTemplateColumns: `repeat(${s.items.length || 1}, minmax(0, 1fr))` }}>
                {s.items.map((p, i) => (
                  <div key={i} className={`text-center px-1 flex flex-col items-center gap-1 ${i < s.items.length - 1 ? "border-l border-[#E6E3DC]" : ""}`}>
                    <span className="w-5 h-5 rounded-full border border-[#7A5A12]" aria-hidden="true" />
                    <b className="text-[10px] leading-tight">{fill(p.title)}</b>
                    {!mobile && p.sub && <span className="text-[9px] text-[#5F5E5A]">{fill(p.sub)}</span>}
                  </div>
                ))}
              </div>
            );
          case "club":
            return wrap(
              <div className="bg-[#0E0E0E] text-white px-5 py-6 flex flex-col gap-1.5">
                {s.kicker && <span className="text-[#C9A24A] text-[10px]">{s.kicker}</span>}
                <b className="text-[22px] leading-tight"><Rich text={fill(s.title)} /></b>
                {s.text && <p className="text-[11px] text-[#BDB9AF]">{fill(s.text)}</p>}
                <div className={`grid gap-1.5 mt-2 ${mobile ? "" : "grid-cols-3"}`}>
                  {["שם", "טלפון", "מייל"].map((l) => <span key={l} className="h-7 rounded bg-[#1A1A1A] border border-[#3A3833] text-[10px] text-[#77736B] px-2 flex items-center">{l}</span>)}
                </div>
                <span className="h-8 rounded bg-[#C9A24A] text-[#141414] text-[11px] font-bold flex items-center justify-center mt-1">הצטרפות</span>
              </div>
            );
        }
      })}
    </div>
  );
}
