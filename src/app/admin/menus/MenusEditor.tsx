"use client";

import { useEffect, useState, useTransition } from "react";
import { Chip, Icon } from "../_components/ui";
import type { MenuItem, Menus } from "@/lib/content-shared";
import { saveMenusAction } from "./actions";

type Opt = { key: string; name: string };
type PageOpt = { slug: string; title: string; type: string };
type Path = [number] | [number, number];

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const validHref = (h: string) => /^\/(?!\/)/.test(h) || /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(h) || /^(mailto|tel):\S+$/i.test(h) || /^wa:/i.test(h) || /^#\S*$/.test(h);

const TABS = [
  { key: "main", label: "תפריט ראשי" },
  { key: "footer", label: "פוטר" },
  { key: "announcement", label: "פס הודעה" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function MenusEditor({ initial, defaults, categories, pages, canEdit, phone }: { initial: Menus; defaults: Menus; categories: Opt[]; pages: PageOpt[]; canEdit: boolean; phone: string }) {
  const [m, setM] = useState<Menus>(() => clone(initial));
  const [saved, setSaved] = useState<Menus>(() => clone(initial));
  const [tab, setTab] = useState<Tab>("main");
  const [msg, setMsg] = useState<{ tone: "green" | "red"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dirty = JSON.stringify(m) !== JSON.stringify(saved);

  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, [dirty]);

  const save = () =>
    start(async () => {
      setMsg(null);
      try {
        const r = await saveMenusAction(JSON.stringify(m));
        if (r.error) setMsg({ tone: "red", text: r.error });
        else if (r.menus) {
          setM(clone(r.menus));
          setSaved(clone(r.menus));
          setMsg({ tone: "green", text: "התפריטים נשמרו ומעודכנים באתר." });
        }
      } catch {
        setMsg({ tone: "red", text: "השמירה נכשלה. בדקו את החיבור ונסו שוב." });
      }
    });

  const reset = () => {
    if (!window.confirm("לשחזר את התפריטים המקוריים של האתר? השינוי יישמר רק אחרי לחיצה על שמירה.")) return;
    setM(clone(defaults));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="a-card !py-3 flex flex-wrap items-center gap-3 sticky top-[72px] z-20">
        {dirty ? <Chip tone="amber">שינויים שלא נשמרו</Chip> : <Chip tone="green">מעודכן באתר</Chip>}
        {canEdit && (
          <div className="flex gap-2 ms-auto">
            <button type="button" onClick={reset} disabled={pending} className="a-btn a-btn-sm">שחזור ברירת מחדל</button>
            {dirty && <button type="button" onClick={() => setM(clone(saved))} disabled={pending} className="a-btn a-btn-sm">ביטול שינויים</button>}
            <button type="button" onClick={save} disabled={pending || !dirty} className="a-btn a-btn-sm a-btn-primary"><Icon name="check" size={15} /> {pending ? "שומר…" : "שמירה ופרסום"}</button>
          </div>
        )}
      </div>

      {msg && (
        <div role={msg.tone === "red" ? "alert" : "status"} className={`p-3 rounded-xl border text-[14px] ${msg.tone === "red" ? "bg-[#FDECEC] text-[#8A2626] border-[#F3D3D3]" : "bg-[#E6F6F0] text-[#0B5E43] border-[#C6EADB]"}`}>{msg.text}</div>
      )}

      <div className="a-card !p-0 overflow-hidden">
        <div className="px-3 pt-1 flex gap-1 border-b border-adm-line overflow-x-auto no-scrollbar" role="tablist">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className="a-tab">{t.label}</button>
          ))}
        </div>

        <div className="p-4 flex flex-col gap-4" role="tabpanel">
          <Preview m={m} tab={tab} phone={phone} />

          {tab === "main" && (
            <>
              <TreeEditor title="פריטי התפריט הראשי" hint="במחשב פריט עם תת־פריטים נפתח כתפריט נגלל; בנייד הם מוצגים ברשימה מוזחת." items={m.main} maxDepth={2} max={12} onChange={(main) => setM({ ...m, main })} categories={categories} pages={pages} canEdit={canEdit} />
              <TreeEditor title="קישורים נוספים בתפריט הנייד (לא חובה)" hint="מוצגים בתפריט הנייד מתחת לתפריט הראשי, לפני כפתור הוואטסאפ." items={m.mobileExtra || []} maxDepth={1} max={15} onChange={(mobileExtra) => setM({ ...m, mobileExtra })} categories={categories} pages={pages} canEdit={canEdit} />
            </>
          )}

          {tab === "footer" && (
            <div className="flex flex-col gap-4">
              {m.footer.map((col, ci) => (
                <div key={ci} className="rounded-xl border border-adm-line p-3 flex flex-col gap-3">
                  <div className="flex items-end gap-2 flex-wrap">
                    <label className="a-field flex-1 min-w-[180px]">
                      כותרת העמודה
                      <input value={col.title} onChange={(e) => setM({ ...m, footer: m.footer.map((c, j) => (j === ci ? { ...c, title: e.target.value } : c)) })} disabled={!canEdit} maxLength={60} className="a-input" />
                    </label>
                    {canEdit && (
                      <div className="flex gap-1">
                        <button type="button" disabled={ci === 0} onClick={() => { const f = [...m.footer]; [f[ci - 1], f[ci]] = [f[ci], f[ci - 1]]; setM({ ...m, footer: f }); }} className="a-btn a-btn-sm !h-[42px]" aria-label={`הזזת העמודה ${col.title} ימינה`}><Icon name="arrowRight" size={15} /></button>
                        <button type="button" disabled={ci === m.footer.length - 1} onClick={() => { const f = [...m.footer]; [f[ci + 1], f[ci]] = [f[ci], f[ci + 1]]; setM({ ...m, footer: f }); }} className="a-btn a-btn-sm !h-[42px]" aria-label={`הזזת העמודה ${col.title} שמאלה`}><Icon name="arrowLeft" size={15} /></button>
                        <button type="button" onClick={() => { if (window.confirm(`למחוק את העמודה "${col.title || ci + 1}" וכל הקישורים שבה?`)) setM({ ...m, footer: m.footer.filter((_, j) => j !== ci) }); }} className="a-btn a-btn-sm a-btn-danger !h-[42px]" aria-label={`מחיקת העמודה ${col.title}`}><Icon name="trash" size={15} /></button>
                      </div>
                    )}
                  </div>
                  <TreeEditor title="קישורים" items={col.items} maxDepth={1} max={15} onChange={(items) => setM({ ...m, footer: m.footer.map((c, j) => (j === ci ? { ...c, items } : c)) })} categories={categories} pages={pages} canEdit={canEdit} compact />
                </div>
              ))}
              {canEdit && m.footer.length < 3 && (
                <button type="button" onClick={() => setM({ ...m, footer: [...m.footer, { title: "עמודה חדשה", items: [] }] })} className="a-btn a-btn-sm self-start"><Icon name="plus" size={15} /> הוספת עמודה ({m.footer.length}/3)</button>
              )}
              <p className="text-[12px] text-adm-muted">העמודה הראשונה בפוטר (לוגו, כתובת וטלפון) קבועה ונלקחת מפרטי החנות בהגדרות המערכת.</p>
            </div>
          )}

          {tab === "announcement" && (
            <div className="flex flex-col gap-3 max-w-[640px]">
              <label className="flex items-center gap-2.5 min-h-[40px] text-[14px] font-semibold cursor-pointer">
                <input type="checkbox" checked={m.announcement.enabled} onChange={(e) => setM({ ...m, announcement: { ...m.announcement, enabled: e.target.checked } })} disabled={!canEdit} className="w-5 h-5 accent-[#3478F6]" />
                הצגת פס ההודעה בראש האתר
              </label>
              <label className="a-field">
                <span className="flex justify-between">טקסט ההודעה <span className="text-[12px] font-normal text-adm-muted">{m.announcement.text.length}/200</span></span>
                <input value={m.announcement.text} onChange={(e) => setM({ ...m, announcement: { ...m.announcement, text: e.target.value } })} disabled={!canEdit} maxLength={200} className="a-input" />
                <span className="text-[12px] font-normal text-adm-muted">הפרידו בין הודעות עם | – יוצג ביניהן ✦ בזהב.</span>
              </label>
              <label className="flex items-center gap-2.5 min-h-[40px] text-[14px] cursor-pointer">
                <input type="checkbox" checked={m.announcement.showPhone !== false} onChange={(e) => setM({ ...m, announcement: { ...m.announcement, showPhone: e.target.checked } })} disabled={!canEdit} className="w-5 h-5 accent-[#3478F6]" />
                להוסיף את מספר הוואטסאפ ({phone}) במחשב
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Tree editor (depth 1 or 2)                                          */
/* ------------------------------------------------------------------ */

function TreeEditor({ title, hint, items, maxDepth, max, onChange, categories, pages, canEdit, compact }: { title: string; hint?: string; items: MenuItem[]; maxDepth: 1 | 2; max: number; onChange: (v: MenuItem[]) => void; categories: Opt[]; pages: PageOpt[]; canEdit: boolean; compact?: boolean }) {
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const key = (p: Path) => p.join(".");

  const get = (p: Path): MenuItem => (p.length === 1 ? items[p[0]] : items[p[0]].children![p[1]]);
  const setAt = (p: Path, it: MenuItem) => {
    const n = clone(items);
    if (p.length === 1) n[p[0]] = it;
    else n[p[0]].children![p[1]] = it;
    onChange(n);
  };
  const siblings = (n: MenuItem[], p: Path) => (p.length === 1 ? n : n[p[0]].children!);
  const move = (p: Path, d: -1 | 1) => {
    const n = clone(items);
    const list = siblings(n, p);
    const i = p[p.length - 1];
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    onChange(n);
    setSel(key((p.length === 1 ? [j] : [p[0], j]) as Path));
  };
  const remove = (p: Path) => {
    const it = get(p);
    if (!window.confirm(`למחוק את "${it.label}"${it.children?.length ? " ואת תת־הפריטים שלו" : ""}?`)) return;
    const n = clone(items);
    siblings(n, p).splice(p[p.length - 1], 1);
    if (p.length === 2 && !n[p[0]].children!.length) delete n[p[0]].children;
    onChange(n);
    setSel(null);
  };
  const indent = (p: Path) => {
    if (p.length !== 1 || p[0] === 0) return;
    const n = clone(items);
    const [it] = n.splice(p[0], 1);
    const parent = n[p[0] - 1];
    const kids = it.children || [];
    delete it.children;
    parent.children = [...(parent.children || []), it, ...kids];
    onChange(n);
    setSel(key([p[0] - 1, parent.children.length - 1 - kids.length]));
  };
  const outdent = (p: Path) => {
    if (p.length !== 2) return;
    const n = clone(items);
    const parent = n[p[0]];
    const [it] = parent.children!.splice(p[1], 1);
    if (!parent.children!.length) delete parent.children;
    n.splice(p[0] + 1, 0, it);
    onChange(n);
    setSel(key([p[0] + 1]));
  };
  const add = (it: MenuItem) => {
    onChange([...items, it]);
    setSel(key([items.length]));
    setAdding(false);
  };

  const total = items.length;
  const row = (it: MenuItem, p: Path) => {
    const k = key(p);
    const active = sel === k;
    const i = p[p.length - 1];
    const sibs = p.length === 1 ? items : items[p[0]].children!;
    const bad = !it.label.trim() || !validHref(it.href);
    return (
      <li key={k}>
        <div className={`flex items-center gap-2 px-2.5 py-2 rounded-lg ${active ? "bg-[#EEF4FF]" : "hover:bg-adm-bg"} ${p.length === 2 ? "ms-7 border-s-2 border-adm-line" : ""}`}>
          <button type="button" onClick={() => setSel(active ? null : k)} aria-expanded={active} className="flex-1 min-w-0 text-right flex items-center gap-2 min-h-[36px]">
            <b className="text-[14px] truncate">{it.label || <span className="text-[#B03A3A]">ללא שם</span>}</b>
            <span dir="ltr" className="text-[12px] text-adm-muted truncate font-mono">{it.href}</span>
            {it.newTab && <Icon name="external" size={13} className="text-adm-muted shrink-0" />}
            {bad && <Chip tone="red">לא תקין</Chip>}
          </button>
          {canEdit && (
            <div className="flex gap-1 shrink-0">
              <button type="button" onClick={() => move(p, -1)} disabled={i === 0} className="a-btn a-btn-sm !h-9 !px-2" aria-label={`הזזת ${it.label} למעלה`}><Icon name="up" size={15} /></button>
              <button type="button" onClick={() => move(p, 1)} disabled={i === sibs.length - 1} className="a-btn a-btn-sm !h-9 !px-2" aria-label={`הזזת ${it.label} למטה`}><Icon name="down" size={15} /></button>
              {maxDepth === 2 && p.length === 1 && (
                <button type="button" onClick={() => indent(p)} disabled={i === 0} className="a-btn a-btn-sm !h-9 !px-2" aria-label={`הפיכת ${it.label} לתת־פריט של הפריט שמעליו`} title="הזחה פנימה (תת־פריט)"><Icon name="arrowLeft" size={15} /></button>
              )}
              {p.length === 2 && (
                <button type="button" onClick={() => outdent(p)} className="a-btn a-btn-sm !h-9 !px-2" aria-label={`הוצאת ${it.label} לרמה הראשית`} title="הוצאה החוצה"><Icon name="arrowRight" size={15} /></button>
              )}
              <button type="button" onClick={() => remove(p)} className="a-btn a-btn-sm a-btn-danger !h-9 !px-2" aria-label={`מחיקת ${it.label}`}><Icon name="trash" size={15} /></button>
            </div>
          )}
        </div>
        {active && <ItemForm it={it} onChange={(x) => setAt(p, { ...x, children: it.children })} disabled={!canEdit} indent={p.length === 2} />}
        {p.length === 1 && it.children && it.children.length > 0 && <ul className="flex flex-col gap-0.5 mt-0.5">{it.children.map((c, j) => row(c, [p[0], j]))}</ul>}
      </li>
    );
  };

  return (
    <section className={compact ? "flex flex-col gap-2" : "rounded-xl border border-adm-line p-3 flex flex-col gap-2"}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex flex-col">
          <h3 className="text-[14px] font-bold">{title}</h3>
          {hint && <span className="text-[12px] text-adm-muted">{hint}</span>}
        </div>
        {canEdit && total < max && (
          <button type="button" onClick={() => setAdding((a) => !a)} aria-expanded={adding} className="a-btn a-btn-sm"><Icon name="plus" size={15} /> הוספת פריט</button>
        )}
      </div>
      {adding && <AddItem onAdd={add} onCancel={() => setAdding(false)} categories={categories} pages={pages} />}
      {items.length === 0 ? (
        <p className="text-[13px] text-adm-muted py-2">אין פריטים.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">{items.map((it, i) => row(it, [i]))}</ul>
      )}
    </section>
  );
}

function ItemForm({ it, onChange, disabled, indent }: { it: MenuItem; onChange: (v: MenuItem) => void; disabled: boolean; indent: boolean }) {
  const ok = validHref(it.href);
  return (
    <div className={`grid sm:grid-cols-[1fr_1.3fr_auto] gap-2 items-end p-3 mt-1 mb-2 rounded-lg bg-adm-bg ${indent ? "ms-7" : ""}`}>
      <label className="a-field">שם<input value={it.label} onChange={(e) => onChange({ ...it, label: e.target.value })} disabled={disabled} maxLength={60} className="a-input" /></label>
      <label className="a-field">
        קישור
        <input value={it.href} onChange={(e) => onChange({ ...it, href: e.target.value.trim() })} disabled={disabled} dir="ltr" aria-invalid={!ok || undefined} className={"a-input text-left font-mono" + (ok ? "" : " !border-[#B03A3A]")} />
      </label>
      <label className="flex items-center gap-2 h-[42px] text-[13px] cursor-pointer whitespace-nowrap">
        <input type="checkbox" checked={!!it.newTab} onChange={(e) => onChange({ ...it, newTab: e.target.checked || undefined })} disabled={disabled} className="w-[18px] h-[18px] accent-[#3478F6]" />
        בלשונית חדשה
      </label>
      {!ok && <span className="sm:col-span-3 text-[12px] text-[#B03A3A]">הקישור צריך להתחיל ב־/ (עמוד באתר), https:// (אתר חיצוני), tel:, mailto: או wa:הודעה (וואטסאפ של החנות).</span>}
    </div>
  );
}

function AddItem({ onAdd, onCancel, categories, pages }: { onAdd: (it: MenuItem) => void; onCancel: () => void; categories: Opt[]; pages: PageOpt[] }) {
  const [src, setSrc] = useState<"category" | "page" | "custom">("category");
  const [cat, setCat] = useState(categories[0]?.key || "");
  const [pg, setPg] = useState(pages[0]?.slug || "");
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const [newTab, setNewTab] = useState(false);
  const [err, setErr] = useState("");

  const submit = () => {
    setErr("");
    if (src === "category") {
      const c = categories.find((x) => x.key === cat);
      if (!c) return setErr("בחרו קטגוריה");
      onAdd({ label: label.trim() || c.name, href: `/shop?category=${c.key}` });
    } else if (src === "page") {
      const p = pages.find((x) => x.slug === pg);
      if (!p) return setErr("בחרו דף");
      onAdd({ label: label.trim() || p.title, href: `/info/${p.slug}` });
    } else {
      if (!label.trim()) return setErr("יש להזין שם לפריט");
      let h = href.trim();
      if (/^www\./i.test(h)) h = "https://" + h;
      if (!validHref(h)) return setErr("הקישור צריך להתחיל ב־/ (עמוד באתר) או ב־https:// (אתר חיצוני)");
      onAdd({ label: label.trim(), href: h, newTab: newTab || undefined });
    }
  };

  return (
    <div className="rounded-xl border border-adm-blue bg-[#F7FAFF] p-3 flex flex-col gap-3">
      <fieldset className="flex gap-2 flex-wrap">
        <legend className="sr-only">סוג הקישור</legend>
        {([["category", "קטגוריה"], ["page", "דף תוכן"], ["custom", "קישור מותאם"]] as const).map(([k, l]) => (
          <label key={k} className={`a-btn a-btn-sm cursor-pointer ${src === k ? "!border-adm-blue !bg-[#EEF4FF]" : ""}`}>
            <input type="radio" name="src" checked={src === k} onChange={() => setSrc(k)} className="accent-[#3478F6]" /> {l}
          </label>
        ))}
      </fieldset>
      <div className="grid sm:grid-cols-2 gap-2">
        {src === "category" && (
          <label className="a-field">קטגוריה
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="a-input">
              {categories.map((c) => <option key={c.key} value={c.key}>{c.name}</option>)}
            </select>
          </label>
        )}
        {src === "page" && (
          <label className="a-field">דף
            {pages.length ? (
              <select value={pg} onChange={(e) => setPg(e.target.value)} className="a-input">
                {pages.map((p) => <option key={p.slug} value={p.slug}>{p.title}{p.type === "blog" ? " (בלוג)" : ""}</option>)}
              </select>
            ) : <span className="text-[13px] font-normal text-adm-muted">אין דפים מפורסמים.</span>}
          </label>
        )}
        {src === "custom" && (
          <label className="a-field">קישור<input value={href} onChange={(e) => setHref(e.target.value)} dir="ltr" placeholder="/shop?color=black או https://…" className="a-input text-left" /></label>
        )}
        <label className="a-field">{src === "custom" ? "שם" : "שם (לא חובה – ברירת מחדל: השם המקורי)"}<input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} className="a-input" /></label>
      </div>
      {src === "custom" && (
        <label className="flex items-center gap-2 text-[13px] cursor-pointer">
          <input type="checkbox" checked={newTab} onChange={(e) => setNewTab(e.target.checked)} className="w-[18px] h-[18px] accent-[#3478F6]" /> פתיחה בלשונית חדשה
        </label>
      )}
      {err && <p role="alert" className="text-[13px] text-[#B03A3A]">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={submit} className="a-btn a-btn-sm a-btn-primary"><Icon name="plus" size={15} /> הוספה</button>
        <button type="button" onClick={onCancel} className="a-btn a-btn-sm">ביטול</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Live preview strip (store colors)                                   */
/* ------------------------------------------------------------------ */

function Preview({ m, tab, phone }: { m: Menus; tab: Tab; phone: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const parts = m.announcement.text.split("|").map((s) => s.trim()).filter(Boolean);
  return (
    <div aria-label="תצוגה מקדימה" className="rounded-xl border border-adm-line overflow-hidden">
      <div className="text-[11px] font-bold text-adm-muted px-3 py-1.5 bg-adm-bg border-b border-adm-line">תצוגה מקדימה</div>
      {(tab === "announcement" || tab === "main") && (
        <>
          {m.announcement.enabled ? (
            <div className="bg-[#0E0E0E] text-[#E8E4DA] text-[12px] text-center py-2 px-3">
              {parts.map((p, i) => <span key={i}>{i > 0 && <span className="text-[#C9A24A] px-2">✦</span>}{p}</span>)}
              {m.announcement.showPhone !== false && <span>{parts.length > 0 && <span className="text-[#C9A24A] px-2">✦</span>}וואטסאפ <span dir="ltr">{phone}</span></span>}
            </div>
          ) : tab === "announcement" ? (
            <div className="text-[12px] text-adm-muted text-center py-2">פס ההודעה מוסתר</div>
          ) : null}
          {tab === "main" && (
            <div className="bg-white px-4 py-3 flex items-center gap-4 overflow-x-auto relative">
              <span dir="ltr" className="font-bold text-[22px] text-[#141414]" style={{ fontFamily: "Playfair Display, serif" }}>Quality<span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C9A24A] ms-0.5" /></span>
              <nav className="flex gap-0.5 text-[13px] text-[#141414]">
                {m.main.map((n, i) => (
                  <div key={i} className="relative">
                    <button type="button" onClick={() => setOpenIdx(openIdx === i ? null : i)} className="px-2 py-1.5 whitespace-nowrap hover:text-[#7A5A12]">
                      {n.label}{n.children?.length ? " ▾" : ""}
                    </button>
                    {openIdx === i && n.children?.length ? (
                      <ul className="absolute top-full right-0 z-10 min-w-[150px] bg-white border border-[#E2DFD8] rounded-lg shadow-lg py-1">
                        {n.children.map((c, j) => <li key={j} className="px-3 py-1.5 text-[12px] whitespace-nowrap">{c.label}</li>)}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </nav>
            </div>
          )}
        </>
      )}
      {tab === "footer" && (
        <div className="bg-[#0E0E0E] text-white px-4 py-5 grid gap-4 text-[12px]" style={{ gridTemplateColumns: `repeat(${m.footer.length + 1}, minmax(0, 1fr))` }}>
          <div className="flex flex-col gap-1">
            <span dir="ltr" className="font-bold text-[18px] text-[#C9A24A] text-right">Quality</span>
            <span className="text-[#BDB9AF]" dir="ltr">{phone}</span>
          </div>
          {m.footer.map((c, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <b>{c.title}</b>
              {c.items.map((it, j) => <span key={j} className="text-[#BDB9AF]">{it.label}</span>)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
