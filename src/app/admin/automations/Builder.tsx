"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Icon } from "../_components/ui";
import { saveRuleAction, type BuilderState } from "./actions";
import {
  ACTION_META,
  COND_FIELDS,
  DELAYS,
  OPS,
  ORDER_STATUSES,
  SAMPLE_VARS,
  TRIGGERS,
  VARIABLES,
  renderTemplate,
  type Action,
  type ActionType,
  type CondField,
  type Condition,
  type RuleDraft,
  type TriggerKey,
} from "./meta";

type ChannelInfo = Record<"whatsapp" | "email" | "sms", { configured: boolean; label: string }>;

function SaveButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="a-btn a-btn-primary">
      <Icon name="check" /> {pending ? "שומר…" : editing ? "שמירת שינויים" : "שמירה (כבויה)"}
    </button>
  );
}

function StepCard({ n, title, sub, children }: { n: number; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="a-card flex flex-col gap-4" aria-labelledby={`step-${n}`}>
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-full bg-adm-navy text-white text-[14px] font-bold flex items-center justify-center shrink-0" aria-hidden="true">{n}</span>
        <div className="flex flex-col">
          <h2 id={`step-${n}`} className="text-[17px] font-bold text-adm-navy">{title}</h2>
          {sub && <p className="text-[13px] text-adm-muted">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const defaultAction = (type: ActionType): Action => {
  switch (type) {
    case "send_whatsapp": return { type, message: "היי {שם}, " };
    case "send_sms": return { type, message: "היי {שם}, " };
    case "send_email": return { type, subject: "", message: "היי {שם},\n\n" };
    case "add_customer_tag": return { type, tag: "" };
    case "create_coupon": return { type, coupon_type: "percent", coupon_value: 10, coupon_days: 14, coupon_min_total: 0, coupon_prefix: "Q" };
    case "admin_notification": return { type, message: "{שם} – הזמנה {הזמנה} על סך {סכום}" };
  }
};

function MessageEditor({ a, onChange, channel }: { a: Action; onChange: (a: Action) => void; channel?: { configured: boolean; label: string } }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = (token: string) => {
    const el = ref.current;
    const cur = a.message || "";
    if (!el) return onChange({ ...a, message: cur + token });
    const s = el.selectionStart ?? cur.length;
    const e = el.selectionEnd ?? cur.length;
    const next = cur.slice(0, s) + token + cur.slice(e);
    onChange({ ...a, message: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + token.length, s + token.length);
    });
  };
  const preview = renderTemplate(a.message || "", SAMPLE_VARS);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="flex flex-col gap-2">
        {a.type === "send_email" && (
          <label className="a-field">
            נושא המייל
            <input className="a-input" value={a.subject || ""} maxLength={150} onChange={(e: any) => onChange({ ...a, subject: e.target.value })} placeholder="קיבלנו את הזמנה {הזמנה}" />
          </label>
        )}
        <label className="a-field">
          {a.type === "admin_notification" ? "טקסט ההתראה" : "ההודעה"}
          <textarea ref={ref} className="a-input" rows={5} maxLength={1000} value={a.message || ""} onChange={(e: any) => onChange({ ...a, message: e.target.value })} />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="הוספת משתנה להודעה">
          {VARIABLES.map((v) => (
            <button key={v.token} type="button" onClick={() => insert(v.token)} className="h-9 px-2.5 rounded-full border border-[#D6E4FD] bg-[#EEF4FF] text-[#1F5FD6] text-[13px] font-semibold hover:bg-[#E0EBFF]" title={v.label}>
              {v.token}
            </button>
          ))}
        </div>
        <span className="text-[12px] text-adm-muted">{(a.message || "").length}/1000 תווים</span>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">תצוגה מקדימה (עם נתוני דוגמה)</span>
        {a.type === "send_whatsapp" ? (
          <div className="rounded-xl bg-[#E9E4DA] p-3 min-h-[120px]">
            <div className="max-w-[92%] mr-0 ml-auto bg-white rounded-lg rounded-tr-none px-3 py-2 text-[14px] leading-6 whitespace-pre-wrap shadow-sm">{preview || <span className="text-adm-muted">ההודעה תופיע כאן</span>}</div>
          </div>
        ) : a.type === "send_email" ? (
          <div className="rounded-xl border border-adm-line bg-white min-h-[120px] overflow-hidden">
            <div className="px-3 py-2 border-b border-adm-line text-[13px]"><b>נושא:</b> {renderTemplate(a.subject || "", SAMPLE_VARS) || <span className="text-adm-muted">—</span>}</div>
            <div className="px-3 py-2 text-[14px] leading-6 whitespace-pre-wrap">{preview}</div>
          </div>
        ) : (
          <div className="rounded-xl border border-adm-line bg-adm-bg p-3 text-[14px] leading-6 whitespace-pre-wrap min-h-[120px]">{preview}</div>
        )}
        {channel && !channel.configured && (
          <p className="text-[13px] text-[#8A5A00] bg-[#FFF4E0] rounded-lg px-3 py-2">ערוץ {channel.label} לא מחובר – כרגע הפעולה תירשם ביומן כ״דולג״ ולא תישלח בפועל.</p>
        )}
        {a.type === "send_whatsapp" && (
          <p className="text-[12px] text-adm-muted">בוואטסאפ ההודעה נשלחת בתוך תבנית מאושרת אחת; ירידות שורה מוחלפות ב־״·״.</p>
        )}
      </div>
    </div>
  );
}

export default function Builder({ initial, channels, templateTitle }: { initial: RuleDraft; channels: ChannelInfo; templateTitle?: string }) {
  const [state, action] = useFormState<BuilderState, FormData>(saveRuleAction, null);
  const [r, setR] = useState<RuleDraft>(initial);
  const editing = !!initial.id;
  const trig = TRIGGERS[r.trigger];

  const setTrigger = (t: TriggerKey) =>
    setR((s) => ({
      ...s,
      trigger: t,
      trigger_config: t === "inactive_customer" ? { days: s.trigger_config.days || 90 } : t === "coupon_expiring" ? { days: s.trigger_config.days || 3 } : t === "order_status_changed" ? { status: s.trigger_config.status || "shipped" } : {},
      conditions: TRIGGERS[t].order ? s.conditions : s.conditions.filter((c) => !COND_FIELDS[c.field].orderOnly),
    }));
  const setCond = (i: number, c: Condition) => setR((s) => ({ ...s, conditions: s.conditions.map((x, j) => (j === i ? c : x)) }));
  const setAct = (i: number, a: Action) => setR((s) => ({ ...s, actions: s.actions.map((x, j) => (j === i ? a : x)) }));
  const moveAct = (i: number, d: -1 | 1) =>
    setR((s) => {
      const a = [...s.actions];
      const j = i + d;
      if (j < 0 || j >= a.length) return s;
      [a[i], a[j]] = [a[j], a[i]];
      return { ...s, actions: a };
    });
  const fields = (Object.keys(COND_FIELDS) as CondField[]).filter((f) => trig.order || !COND_FIELDS[f].orderOnly);
  const hasCoupon = r.actions.some((a) => a.type === "create_coupon");

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="rule" value={JSON.stringify(r)} />
      <div className="a-card flex flex-wrap items-end gap-3 justify-between">
        <label className="a-field flex-1 min-w-[240px]">
          שם האוטומציה
          <input className="a-input" value={r.name} maxLength={120} required onChange={(e: any) => setR({ ...r, name: e.target.value })} placeholder="למשל: תודה על ההזמנה" />
        </label>
        <div className="flex gap-2">
          <Link href="/admin/automations" className="a-btn">ביטול</Link>
          <SaveButton editing={editing} />
        </div>
        {templateTitle && <p className="w-full text-[13px] text-adm-muted">מבוסס על התבנית ״{templateTitle}״ – אפשר לשנות הכל לפני השמירה.</p>}
      </div>

      {state?.error && <div role="alert" className="p-4 rounded-xl border text-[14px] bg-[#FDECEC] text-[#8A2626] border-[#F3D3D3]">{state.error}</div>}

      <StepCard n={1} title="טריגר" sub="מתי האוטומציה מתחילה">
        <div className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))]" role="radiogroup" aria-label="בחירת טריגר">
          {(Object.keys(TRIGGERS) as TriggerKey[]).map((k) => {
            const t = TRIGGERS[k];
            const on = r.trigger === k;
            return (
              <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setTrigger(k)} className={`text-right p-3 rounded-xl border flex gap-2.5 items-start min-h-[64px] ${on ? "border-adm-blue bg-[#EEF4FF] ring-1 ring-adm-blue" : "border-adm-line bg-white hover:bg-adm-bg"}`}>
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${on ? "bg-adm-blue text-white" : "bg-adm-bg text-adm-muted"}`}><Icon name={t.icon} size={16} /></span>
                <span className="flex flex-col gap-0.5">
                  <b className="text-[14px]">{t.label}</b>
                  <span className="text-[12px] text-adm-muted leading-5">{t.desc}</span>
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 items-end">
          {r.trigger === "order_status_changed" && (
            <label className="a-field">
              כשהסטטוס משתנה ל־
              <select className="a-input !w-auto min-w-[160px]" value={r.trigger_config.status || ""} onChange={(e: any) => setR({ ...r, trigger_config: { status: e.target.value || undefined } })}>
                <option value="">כל שינוי סטטוס</option>
                {Object.entries(ORDER_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
          )}
          {(r.trigger === "inactive_customer" || r.trigger === "coupon_expiring") && (
            <label className="a-field">
              {r.trigger === "inactive_customer" ? "ימים מההזמנה האחרונה" : "ימים לפני שהקופון פג"}
              <input type="number" className="a-input !w-[140px]" min={r.trigger === "inactive_customer" ? 14 : 1} max={r.trigger === "inactive_customer" ? 730 : 30} value={r.trigger_config.days ?? ""} onChange={(e: any) => setR({ ...r, trigger_config: { days: Number(e.target.value) } })} />
            </label>
          )}
          {!trig.daily && (
            <label className="a-field">
              מתי לבצע
              <select className="a-input !w-auto min-w-[160px]" value={r.delay_minutes} onChange={(e: any) => setR({ ...r, delay_minutes: Number(e.target.value) })}>
                {DELAYS.map((d) => <option key={d.minutes} value={d.minutes}>{d.label}</option>)}
              </select>
            </label>
          )}
        </div>
        {trig.daily && <p className="text-[13px] text-adm-muted">טריגר יומי: נבדק פעם ביום (בסביבות 9:00–10:00 בבוקר שעון ישראל) ע״י משימה מתוזמנת. כל לקוחה מקבלת אותו פעם אחת לכל אירוע.</p>}
        {!trig.daily && r.delay_minutes > 0 && <p className="text-[13px] text-adm-muted">פעולות מושהות מתבצעות במשימה היומית, לכן בפועל הן יישלחו בבדיקה היומית הראשונה אחרי מועד ההשהיה.</p>}
        {r.trigger === "birthday" && <p className="text-[13px] text-adm-muted">עובד רק ללקוחות שהוזן להן תאריך לידה בכרטיס הלקוחה.</p>}
        {r.trigger === "coupon_expiring" && <p className="text-[13px] text-adm-muted">חל על קופונים אישיים שנוצרו ע״י אוטומציה (פעולת ״יצירת קופון אישי״) ועוד לא מומשו. המשתנה {"{קופון}"} יכיל את הקוד.</p>}
      </StepCard>

      <StepCard n={2} title="תנאים" sub="אופציונלי – כל התנאים חייבים להתקיים">
        {r.conditions.length === 0 && <p className="text-[14px] text-adm-muted">ללא תנאים: האוטומציה תפעל בכל פעם שהטריגר מתרחש.</p>}
        {r.conditions.map((c, i) => {
          const f = COND_FIELDS[c.field];
          return (
            <div key={i} className="flex flex-wrap gap-2 items-end p-3 rounded-xl bg-adm-bg">
              {i > 0 && <span className="text-[12px] font-bold text-adm-muted w-full">וגם</span>}
              <label className="a-field">
                שדה
                <select className="a-input !w-auto min-w-[190px]" value={c.field} onChange={(e: any) => { const nf = e.target.value as CondField; setCond(i, { field: nf, op: COND_FIELDS[nf].ops[0], value: "" }); }}>
                  {fields.map((k) => <option key={k} value={k}>{COND_FIELDS[k].label}</option>)}
                </select>
              </label>
              <label className="a-field">
                השוואה
                <select className="a-input !w-auto min-w-[120px]" value={c.op} onChange={(e: any) => setCond(i, { ...c, op: e.target.value })}>
                  {f.ops.map((o) => <option key={o} value={o}>{OPS[o]}</option>)}
                </select>
              </label>
              {f.kind !== "bool" && (
                <label className="a-field">
                  ערך{f.unit ? ` (${f.unit})` : ""}
                  <input className="a-input !w-[160px]" type={f.kind === "number" ? "number" : "text"} min={0} value={c.value} onChange={(e: any) => setCond(i, { ...c, value: e.target.value })} placeholder={c.field === "tags" ? "VIP" : c.field === "city" ? "טמרה" : ""} />
                </label>
              )}
              <button type="button" className="a-btn a-btn-sm a-btn-danger !h-[42px]" onClick={() => setR({ ...r, conditions: r.conditions.filter((_, j) => j !== i) })} aria-label={`הסרת התנאי ${f.label}`}><Icon name="trash" size={15} /></button>
            </div>
          );
        })}
        <div>
          <button type="button" className="a-btn a-btn-sm" disabled={r.conditions.length >= 10} onClick={() => setR({ ...r, conditions: [...r.conditions, { field: fields[0], op: COND_FIELDS[fields[0]].ops[0], value: "" }] })}>
            <Icon name="plus" size={15} /> הוספת תנאי
          </button>
        </div>
        <p className="text-[12px] text-adm-muted">״מספר ההזמנות״ ו״סך הקניות״ לא כוללים הזמנות שבוטלו או הוחזרו, וכוללים את ההזמנה הנוכחית. בהודעות שיווקיות מומלץ להוסיף ״אישור דיוור שיווקי: אישרה״.</p>
      </StepCard>

      <StepCard n={3} title="פעולות" sub="מה קורה – לפי הסדר">
        {r.actions.map((a, i) => {
          const m = ACTION_META[a.type];
          const ch = m.channel ? channels[m.channel] : undefined;
          return (
            <div key={i} className="rounded-xl border border-adm-line p-3.5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-bold text-adm-muted">{i + 1}.</span>
                  <b className="text-[15px]">{m.label}</b>
                  {ch && <span className={`a-chip ${ch.configured ? "bg-[#E6F6F0] text-[#0F7A57]" : "bg-[#FFF4E0] text-[#8A5A00]"}`}>{ch.configured ? "מחובר" : "לא מחובר"}</span>}
                </div>
                <div className="flex gap-1">
                  <button type="button" className="a-btn a-btn-sm !px-2.5" disabled={i === 0} onClick={() => moveAct(i, -1)} aria-label="הזזה למעלה"><Icon name="up" size={15} /></button>
                  <button type="button" className="a-btn a-btn-sm !px-2.5" disabled={i === r.actions.length - 1} onClick={() => moveAct(i, 1)} aria-label="הזזה למטה"><Icon name="down" size={15} /></button>
                  <button type="button" className="a-btn a-btn-sm a-btn-danger !px-2.5" onClick={() => setR({ ...r, actions: r.actions.filter((_, j) => j !== i) })} aria-label={`הסרת הפעולה ${m.label}`}><Icon name="trash" size={15} /></button>
                </div>
              </div>
              {m.message && <MessageEditor a={a} onChange={(na) => setAct(i, na)} channel={ch} />}
              {a.type === "add_customer_tag" && (
                <label className="a-field max-w-[280px]">
                  תגית
                  <input className="a-input" maxLength={40} value={a.tag || ""} onChange={(e: any) => setAct(i, { ...a, tag: e.target.value })} placeholder="למשל: VIP" />
                </label>
              )}
              {a.type === "create_coupon" && (
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-3 items-end">
                    <label className="a-field">
                      סוג
                      <select className="a-input !w-auto" value={a.coupon_type} onChange={(e: any) => setAct(i, { ...a, coupon_type: e.target.value })}>
                        <option value="percent">אחוז הנחה</option>
                        <option value="fixed">סכום קבוע (₪)</option>
                      </select>
                    </label>
                    <label className="a-field">
                      {a.coupon_type === "fixed" ? "סכום (₪)" : "אחוז"}
                      <input type="number" className="a-input !w-[110px]" min={1} max={a.coupon_type === "fixed" ? 5000 : 100} value={a.coupon_value ?? ""} onChange={(e: any) => setAct(i, { ...a, coupon_value: Number(e.target.value) })} />
                    </label>
                    <label className="a-field">
                      תוקף (ימים)
                      <input type="number" className="a-input !w-[110px]" min={1} max={365} value={a.coupon_days ?? ""} onChange={(e: any) => setAct(i, { ...a, coupon_days: Number(e.target.value) })} />
                    </label>
                    <label className="a-field">
                      מינימום קנייה (₪)
                      <input type="number" className="a-input !w-[130px]" min={0} value={a.coupon_min_total ?? 0} onChange={(e: any) => setAct(i, { ...a, coupon_min_total: Number(e.target.value) })} />
                    </label>
                    <label className="a-field">
                      תחילית לקוד
                      <input className="a-input !w-[120px] font-mono" dir="ltr" maxLength={8} value={a.coupon_prefix || ""} onChange={(e: any) => setAct(i, { ...a, coupon_prefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} />
                    </label>
                  </div>
                  <p className="text-[12px] text-adm-muted">נוצר קוד ייחודי לכל לקוחה (למשל <span dir="ltr" className="font-mono">{(a.coupon_prefix || "Q") + "-7KQ2MX"}</span>), לשימוש אחד בלבד. הקופון נוצר לפני שאר הפעולות, כך שאפשר להשתמש ב־{"{קופון}"} בהודעות.</p>
                </div>
              )}
            </div>
          );
        })}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ACTION_META) as ActionType[]).map((t) => (
            <button key={t} type="button" className="a-btn a-btn-sm" disabled={r.actions.length >= 6 || (t === "create_coupon" && hasCoupon)} onClick={() => setR({ ...r, actions: [...r.actions, defaultAction(t)] })}>
              <Icon name="plus" size={15} /> {ACTION_META[t].label}
            </button>
          ))}
        </div>
      </StepCard>

      <div className="flex gap-2 justify-end">
        <Link href="/admin/automations" className="a-btn">ביטול</Link>
        <SaveButton editing={editing} />
      </div>
      {!editing && <p className="text-[13px] text-adm-muted text-left">אוטומציה חדשה נשמרת כבויה. מפעילים אותה במתג ברשימה, אחרי שבודקים את ההודעות.</p>}
    </form>
  );
}
