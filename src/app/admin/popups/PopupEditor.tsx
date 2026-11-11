"use client";

import { useEffect, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import PopupView from "@/components/popup/PopupView";
import {
  DEVICES,
  FREQUENCIES,
  LAYOUTS,
  PAGES,
  THEMES,
  TRIGGERS,
  hasForm,
  type Popup,
  type PopupConfig,
  type PopupLayout,
  type PopupPage,
  type PopupTheme,
} from "@/lib/popups-shared";
import { savePopupAction, uploadPopupImageAction, type PopupFormState } from "./actions";
import { Icon } from "../_components/ui";

type CouponOption = { code: string; label: string };

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="a-btn a-btn-primary min-w-[120px]">
      <Icon name="check" size={16} /> {pending ? "שומרת…" : "שמירה"}
    </button>
  );
}

function Toggle({ checked, onChange, label, sub }: { checked: boolean; onChange: (v: boolean) => void; label: string; sub?: string }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2.5 cursor-pointer">
      <span className="flex flex-col">
        <span className="text-[14px] font-semibold">{label}</span>
        {sub && <span className="text-[12px] text-adm-muted">{sub}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${checked ? "bg-[#6C1CF5]" : "bg-[#D8D3EA]"}`}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${checked ? "right-0.5" : "right-[22px]"}`} />
      </button>
    </label>
  );
}

const TABS = [
  { k: "content", label: "תוכן", icon: "edit" },
  { k: "form", label: "טופס וקופון", icon: "tag" },
  { k: "design", label: "עיצוב", icon: "layout" },
  { k: "rules", label: "מתי ואיפה", icon: "clock" },
] as const;

/** Real-size frame scaled down to the column width, so the preview matches the site exactly. */
function PreviewFrame({ device, children }: { device: "desktop" | "mobile"; children: React.ReactNode }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const W = device === "desktop" ? 1180 : 390;
  const H = device === "desktop" ? 720 : 780;
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / W));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [W]);
  return (
    <div ref={wrap} className="w-full flex justify-center">
      <div style={{ width: W * scale, height: H * scale }} className="relative">
        <div
          className="absolute top-0 right-0 origin-top-right rounded-[18px] overflow-hidden border border-adm-line bg-white shadow-[0_20px_50px_-30px_rgba(20,16,46,.5)]"
          style={{ width: W, height: H, transform: `scale(${scale})` }}
        >
          {/* a lightweight mock of the storefront behind the popup */}
          <div className="absolute inset-0 bg-white" aria-hidden="true">
            <div className="h-9 bg-[#0E0E0E]" />
            <div className="h-16 border-b border-[#E2DFD8] flex items-center px-6 gap-4">
              <span className="font-logo font-bold text-[26px]" dir="ltr">Quality</span>
              <span className="flex-1" />
              <span className="w-24 h-3 rounded bg-[#EEECE6]" />
              <span className="w-16 h-3 rounded bg-[#EEECE6]" />
            </div>
            <div className="h-[46%] bg-[linear-gradient(120deg,#2a2622,#0E0E0E)]" />
            <div className={`grid ${device === "desktop" ? "grid-cols-4" : "grid-cols-2"} gap-3 p-5`}>
              {Array.from({ length: device === "desktop" ? 4 : 2 }).map((_, i) => (
                <span key={i} className="aspect-square bg-[#F1EFEA]" />
              ))}
            </div>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function PopupEditor({ popup, coupons, storageReady }: { popup: Popup; coupons: CouponOption[]; storageReady: boolean }) {
  const [state, action] = useFormState<PopupFormState, FormData>(savePopupAction, null);
  const [c, setC] = useState<PopupConfig>(popup.config);
  const [name, setName] = useState(popup.name);
  const [active, setActive] = useState(popup.active);
  const [priority, setPriority] = useState(popup.priority);
  const [starts, setStarts] = useState(popup.starts_at ? new Date(popup.starts_at).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }) : "");
  const [ends, setEnds] = useState(popup.ends_at ? new Date(popup.ends_at).toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" }) : "");
  const [tab, setTab] = useState<(typeof TABS)[number]["k"]>("content");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [stage, setStage] = useState<"open" | "done">("open");
  const [replay, setReplay] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState("");
  const [dirty, setDirty] = useState(false);

  const set = <K extends keyof PopupConfig>(k: K, v: PopupConfig[K]) => {
    setC((x) => ({ ...x, [k]: v }));
    setDirty(true);
  };
  const setField = (k: keyof PopupConfig["fields"], v: boolean) => set("fields", { ...c.fields, [k]: v });
  const togglePage = (p: PopupPage) => set("pages", c.pages.includes(p) ? c.pages.filter((x) => x !== p) : [...c.pages, p]);

  useEffect(() => {
    if (state?.ok) setDirty(false);
  }, [state]);

  // warn before leaving with unsaved changes
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    setUploadErr("");
    const fd = new FormData();
    fd.set("file", f);
    const r = await uploadPopupImageAction(fd);
    setUploading(false);
    if (r.url) set("image", r.url);
    else setUploadErr(r.error || "ההעלאה נכשלה");
  };

  const form = hasForm(c);
  const lbl = "a-field";

  return (
    <form action={action} className="flex flex-col gap-4" onChange={() => setDirty(true)}>
      <input type="hidden" name="id" value={popup.id} />
      <input type="hidden" name="config" value={JSON.stringify(c)} />
      <input type="hidden" name="active" value={active ? "on" : ""} />

      {/* top bar */}
      <div className="a-card !p-3.5 flex flex-wrap items-end gap-3 sticky top-[68px] z-20">
        <label className={`${lbl} flex-[2_1_240px]`}>
          שם הפופ־אפ (מופיע רק במערכת)
          <input name="name" value={name} onChange={(e) => { setName(e.target.value); setDirty(true); }} className="a-input" required maxLength={80} />
        </label>
        <div className="flex items-center gap-3 flex-[1_1_220px]">
          <Toggle checked={active} onChange={(v) => { setActive(v); setDirty(true); }} label={active ? "פעיל באתר" : "מושהה"} sub={active ? "יוצג לגולשות לפי ההגדרות" : "לא מוצג באתר"} />
        </div>
        <div className="flex items-center gap-2 ms-auto">
          {dirty && <span className="text-[12px] text-[#8A5A00] font-semibold">יש שינויים שלא נשמרו</span>}
          {state?.ok && !dirty && <span className="text-[13px] text-[#0F7A57] font-semibold flex items-center gap-1"><Icon name="check" size={15} /> נשמר</span>}
          <SaveBtn />
        </div>
        {state?.error && <p role="alert" className="basis-full text-[14px] font-semibold text-[#B03A3A]">{state.error}</p>}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-start">
        {/* settings */}
        <div className="a-card !p-0 overflow-hidden">
          <div role="tablist" aria-label="הגדרות הפופ־אפ" className="flex border-b border-adm-line bg-[#FBFAFE] overflow-x-auto no-scrollbar">
            {TABS.map((t) => (
              <button
                key={t.k}
                type="button"
                role="tab"
                aria-selected={tab === t.k}
                onClick={() => setTab(t.k)}
                className={`flex-1 min-w-[110px] h-12 flex items-center justify-center gap-1.5 text-[14px] font-semibold border-b-2 transition-colors ${tab === t.k ? "border-[#6C1CF5] text-[#5B17E6] bg-white" : "border-transparent text-adm-muted hover:text-adm-text"}`}
              >
                <Icon name={t.icon} size={16} /> {t.label}
              </button>
            ))}
          </div>

          <div className="p-5 flex flex-col gap-4">
            {tab === "content" && (
              <>
                <label className={lbl}>
                  כותרת קטנה מעל
                  <input value={c.kicker} onChange={(e) => set("kicker", e.target.value)} className="a-input" placeholder="למשל: רק למצטרפות חדשות" maxLength={80} />
                </label>
                <label className={lbl}>
                  כותרת
                  <textarea value={c.title} onChange={(e) => set("title", e.target.value)} rows={2} className="a-input" maxLength={140} />
                  <span className="text-[12px] font-normal text-adm-muted">Enter יוצר שורה חדשה בכותרת</span>
                </label>
                <label className={lbl}>
                  טקסט
                  <textarea value={c.text} onChange={(e) => set("text", e.target.value)} rows={3} className="a-input" maxLength={500} />
                </label>
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold">תמונה</span>
                  <div className="flex gap-3 items-start">
                    <span className="w-24 h-24 rounded-xl overflow-hidden bg-adm-bg border border-adm-line shrink-0 flex items-center justify-center">
                      {c.image ? <img src={c.image} alt="" className="w-full h-full object-cover" /> : <Icon name="image" size={24} className="text-adm-muted" />}
                    </span>
                    <div className="flex-1 flex flex-col gap-2 min-w-0">
                      <input value={c.image} onChange={(e) => set("image", e.target.value.trim())} dir="ltr" className="a-input" placeholder="https://…" aria-label="קישור לתמונה" />
                      <div className="flex gap-2 flex-wrap">
                        {storageReady && (
                          <label className="a-btn a-btn-sm cursor-pointer">
                            <Icon name="download" size={15} className="rotate-180" /> {uploading ? "מעלה…" : "העלאת תמונה"}
                            <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
                          </label>
                        )}
                        {c.image && <button type="button" onClick={() => set("image", "")} className="a-btn a-btn-sm">הסרה</button>}
                      </div>
                      {uploadErr && <span className="text-[12px] text-[#B03A3A]">{uploadErr}</span>}
                      {(c.layout === "bar") && <span className="text-[12px] text-adm-muted">בפס תחתון התמונה לא מוצגת.</span>}
                    </div>
                  </div>
                </div>
              </>
            )}

            {tab === "form" && (
              <>
                <div className="flex flex-col">
                  <span className="text-[13px] font-semibold pb-1">שדות בטופס</span>
                  <span className="text-[12px] text-adm-muted pb-2">בלי שדות – הפופ־אפ מציג כפתור במקום טופס.</span>
                  <div className="grid grid-cols-2 gap-2">
                    {([["name", "שם"], ["phone", "טלפון"], ["email", "מייל"], ["message", "הודעה חופשית"]] as const).map(([k, l]) => (
                      <label key={k} className={`flex items-center gap-2.5 h-11 px-3 rounded-xl border cursor-pointer text-[14px] ${c.fields[k] ? "border-[#6C1CF5] bg-[#F5F0FF]" : "border-adm-line"}`}>
                        <input type="checkbox" checked={c.fields[k]} onChange={(e) => setField(k, e.target.checked)} className="w-4 h-4 accent-[#6C1CF5]" />
                        {l}
                      </label>
                    ))}
                  </div>
                </div>
                {form && (
                  <>
                    <label className={lbl}>
                      טקסט כפתור השליחה
                      <input value={c.submitText} onChange={(e) => set("submitText", e.target.value)} className="a-input" maxLength={40} />
                    </label>
                    <Toggle checked={c.consent} onChange={(v) => set("consent", v)} label="הסכמה לדיוור" sub="מי שמסמנת נכנסת אוטומטית למועדון הלקוחות (נדרש טלפון)" />
                  </>
                )}

                <div className="h-px bg-adm-line" />
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold">קופון</span>
                  <div className="grid grid-cols-3 gap-2">
                    {([["none", "בלי קופון"], ["always", "מוצג מיד"], ["after", "אחרי שליחה"]] as const).map(([k, l]) => (
                      <button key={k} type="button" onClick={() => set("couponMode", k)} disabled={k === "after" && !form} className={`h-11 rounded-xl border text-[13px] font-semibold disabled:opacity-40 ${c.couponMode === k ? "border-[#6C1CF5] bg-[#F5F0FF] text-[#5B17E6]" : "border-adm-line"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                  {c.couponMode !== "none" && (
                    <div className="grid sm:grid-cols-2 gap-2 pt-1">
                      <label className={lbl}>
                        קוד קופון
                        <input value={c.coupon} onChange={(e) => set("coupon", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} dir="ltr" className="a-input font-bold tracking-wider" maxLength={32} />
                      </label>
                      {coupons.length > 0 && (
                        <label className={lbl}>
                          או בחירה מהקופונים במערכת
                          <select value="" onChange={(e) => e.target.value && set("coupon", e.target.value)} className="a-input">
                            <option value="">בחירה…</option>
                            {coupons.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}
                          </select>
                        </label>
                      )}
                      <span className="sm:col-span-2 text-[12px] text-adm-muted">
                        {c.couponMode === "after" ? "הקוד לא נשלח לדפדפן עד שהגולשת שולחת את הטופס." : "הקוד גלוי לכל מי שרואה את הפופ־אפ."} ודאי שהקופון קיים ופעיל בעמוד &quot;קופונים&quot;.
                      </span>
                    </div>
                  )}
                </div>

                <div className="h-px bg-adm-line" />
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className={lbl}>
                    טקסט כפתור
                    <input value={c.ctaText} onChange={(e) => set("ctaText", e.target.value)} className="a-input" placeholder="למשל: לכל המבצעים" maxLength={40} />
                  </label>
                  <label className={lbl}>
                    קישור הכפתור
                    <input value={c.ctaHref} onChange={(e) => set("ctaHref", e.target.value.trim())} dir="ltr" className="a-input" placeholder="/shop?sort=discount" />
                  </label>
                  <span className="sm:col-span-2 text-[12px] text-adm-muted -mt-1">{form ? "בפופ־אפ עם טופס הכפתור מוצג במסך ההצלחה." : "מוצג במקום הטופס."}</span>
                </div>

                {form && (
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className={lbl}>
                      כותרת אחרי שליחה
                      <input value={c.successTitle} onChange={(e) => set("successTitle", e.target.value)} className="a-input" maxLength={80} />
                    </label>
                    <label className={lbl}>
                      טקסט אחרי שליחה
                      <input value={c.successText} onChange={(e) => set("successText", e.target.value)} className="a-input" maxLength={300} />
                    </label>
                  </div>
                )}

                <label className={lbl}>
                  ספירה לאחור עד (לא חובה)
                  <span className="flex gap-2">
                    <input type="datetime-local" value={c.countdown} onChange={(e) => set("countdown", e.target.value)} className="a-input" />
                    {c.countdown && <button type="button" onClick={() => set("countdown", "")} className="a-btn">ניקוי</button>}
                  </span>
                </label>
              </>
            )}

            {tab === "design" && (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold">סוג תצוגה</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {(Object.keys(LAYOUTS) as PopupLayout[]).map((k) => (
                      <button key={k} type="button" onClick={() => set("layout", k)} className={`rounded-xl border p-2.5 flex flex-col items-center gap-2 text-[13px] font-semibold ${c.layout === k ? "border-[#6C1CF5] bg-[#F5F0FF] text-[#5B17E6]" : "border-adm-line hover:border-[#B9A6F5]"}`}>
                        <span className="relative w-full h-14 rounded-lg bg-[#EEECF6] overflow-hidden" aria-hidden="true">
                          {k === "center" && <span className="absolute inset-x-[32%] inset-y-2 rounded bg-white shadow" />}
                          {k === "split" && <span className="absolute inset-x-[18%] inset-y-2 rounded bg-white shadow flex"><span className="w-1/2 bg-[#C9B8F7] rounded-l" /></span>}
                          {k === "fullscreen" && <span className="absolute inset-1.5 rounded bg-[#C9B8F7]" />}
                          {k === "corner" && <span className="absolute bottom-1.5 right-1.5 w-[34%] h-[55%] rounded bg-white shadow" />}
                          {k === "bar" && <span className="absolute bottom-0 inset-x-0 h-3 bg-[#14102E]" />}
                        </span>
                        {LAYOUTS[k]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold">צבעים</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(Object.keys(THEMES) as PopupTheme[]).map((k) => {
                      const t = THEMES[k];
                      return (
                        <button key={k} type="button" onClick={() => set("theme", k)} className={`rounded-xl border p-2 flex flex-col gap-2 text-[13px] font-semibold ${c.theme === k ? "border-[#6C1CF5] ring-2 ring-[#6C1CF5]/20" : "border-adm-line"}`}>
                          <span className="h-12 rounded-lg flex items-end justify-between p-2" style={{ background: t.bg, border: "1px solid rgba(0,0,0,.08)" }}>
                            <span className="w-8 h-2 rounded" style={{ background: t.fg }} />
                            <span className="w-6 h-4 rounded-full" style={{ background: t.accent }} />
                          </span>
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {tab === "rules" && (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className={lbl}>
                    מתי להציג
                    <select value={c.trigger} onChange={(e) => set("trigger", e.target.value as PopupConfig["trigger"])} className="a-input">
                      {Object.entries(TRIGGERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                  {c.trigger === "delay" && (
                    <label className={lbl}>
                      אחרי כמה שניות
                      <input type="number" min={0} max={300} value={c.delay} onChange={(e) => set("delay", Number(e.target.value))} className="a-input" />
                    </label>
                  )}
                  {c.trigger === "scroll" && (
                    <label className={lbl}>
                      אחרי גלילה של ({c.scroll}%)
                      <input type="range" min={5} max={95} step={5} value={c.scroll} onChange={(e) => set("scroll", Number(e.target.value))} className="accent-[#6C1CF5] h-[42px]" />
                    </label>
                  )}
                  {c.trigger === "exit" && <p className="text-[12px] text-adm-muted self-end pb-1">במחשב: כשהעכבר יוצא מהחלון. בנייד: אחרי {Math.max(c.delay, 20)} שניות בעמוד.</p>}
                  <label className={lbl}>
                    כמה פעמים
                    <select value={c.frequency} onChange={(e) => set("frequency", e.target.value as PopupConfig["frequency"])} className="a-input">
                      {Object.entries(FREQUENCIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                  {c.frequency === "days" && (
                    <label className={lbl}>
                      כל כמה ימים
                      <input type="number" min={1} max={365} value={c.days} onChange={(e) => set("days", Number(e.target.value))} className="a-input" />
                    </label>
                  )}
                </div>
                <p className="text-[12px] text-adm-muted -mt-1">גולשת שכבר השאירה פרטים בפופ־אפ לא תראה אותו שוב.</p>

                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-semibold">באילו עמודים</span>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(PAGES) as PopupPage[]).map((p) => (
                      <button key={p} type="button" aria-pressed={c.pages.includes(p)} onClick={() => togglePage(p)} className={`h-9 px-3.5 rounded-full border text-[13px] font-semibold ${c.pages.includes(p) ? "border-[#6C1CF5] bg-[#F5F0FF] text-[#5B17E6]" : "border-adm-line text-adm-mid"}`}>
                        {c.pages.includes(p) && "✓ "}{PAGES[p]}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <label className={lbl}>
                    מכשירים
                    <select value={c.devices} onChange={(e) => set("devices", e.target.value as PopupConfig["devices"])} className="a-input">
                      {Object.entries(DEVICES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </label>
                  <label className={lbl}>
                    עדיפות (1 = הכי גבוהה)
                    <input name="priority" type="number" min={1} max={999} value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="a-input" />
                  </label>
                  <label className={lbl}>
                    תאריך התחלה (לא חובה)
                    <input name="starts_at" type="date" value={starts} onChange={(e) => setStarts(e.target.value)} className="a-input" />
                  </label>
                  <label className={lbl}>
                    תאריך סיום (לא חובה)
                    <input name="ends_at" type="date" value={ends} onChange={(e) => setEnds(e.target.value)} className="a-input" />
                  </label>
                </div>
              </>
            )}
            {tab !== "rules" && (
              <>
                <input type="hidden" name="priority" value={priority} />
                <input type="hidden" name="starts_at" value={starts} />
                <input type="hidden" name="ends_at" value={ends} />
              </>
            )}
          </div>
        </div>

        {/* live preview */}
        <div className="a-card flex flex-col gap-3 xl:sticky xl:top-[150px]">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <b className="text-[15px] flex items-center gap-1.5"><Icon name="eye" size={17} /> תצוגה מקדימה</b>
            <div className="flex gap-1.5">
              <div className="flex rounded-[10px] border border-adm-line p-0.5" role="group" aria-label="מכשיר">
                {(["desktop", "mobile"] as const).map((d) => (
                  <button key={d} type="button" aria-pressed={device === d} onClick={() => setDevice(d)} className={`h-8 px-3 rounded-lg text-[13px] font-semibold ${device === d ? "bg-adm-navy text-white" : "text-adm-mid"}`}>
                    {d === "desktop" ? "מחשב" : "נייד"}
                  </button>
                ))}
              </div>
              {form && (
                <div className="flex rounded-[10px] border border-adm-line p-0.5" role="group" aria-label="מסך">
                  {(["open", "done"] as const).map((s) => (
                    <button key={s} type="button" aria-pressed={stage === s} onClick={() => setStage(s)} className={`h-8 px-3 rounded-lg text-[13px] font-semibold ${stage === s ? "bg-adm-navy text-white" : "text-adm-mid"}`}>
                      {s === "open" ? "פתיחה" : "אחרי שליחה"}
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setReplay((r) => r + 1)} className="a-btn a-btn-sm" title="הפעלה מחדש של האנימציה" aria-label="הפעלה מחדש של האנימציה">
                <Icon name="play" size={14} />
              </button>
            </div>
          </div>
          <PreviewFrame device={device}>
            <PopupView
              key={`${replay}-${device}-${stage}-${c.layout}`}
              config={c}
              contained
              compact={device === "mobile"}
              coupon={c.coupon}
              forceDone={stage === "done"}
              onClose={() => setReplay((r) => r + 1)}
              onSubmit={async () => ({ ok: true, coupon: c.coupon })}
            />
          </PreviewFrame>
          <p className="text-[12px] text-adm-muted">התצוגה זהה לאתר. סגירה בתצוגה המקדימה מפעילה אותה מחדש.</p>
        </div>
      </div>
    </form>
  );
}
