"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "../_components/ui";
import { askAiAction, saveAiDraftToProductAction } from "./actions";

type Msg = { role: "user" | "assistant"; content: string; productContent?: boolean; productId?: number | null; error?: boolean };

type Task = { key: string; label: string; needsProduct?: boolean; productContent?: boolean; prompt: (productName: string) => string };

const TASKS: Task[] = [
  { key: "desc", label: "תיאור מוצר", needsProduct: true, productContent: true, prompt: (p) => `כתוב/י תיאור מוצר חדש ומזמין לדף המוצר "${p}" (60–110 מילים). החזר/י רק את התיאור.` },
  { key: "seo", label: "כותרת ותיאור SEO", needsProduct: true, prompt: (p) => `הצע/י למוצר "${p}" כותרת SEO (עד 60 תווים) ותיאור מטא (עד 155 תווים), בעברית, עם מילות מפתח טבעיות. תן/י 2 חלופות.` },
  { key: "ar", label: "תרגום לערבית", needsProduct: true, productContent: true, prompt: (p) => `תרגם/י לערבית את התיאור הנוכחי של המוצר "${p}". אם אין תיאור – כתוב/י תיאור קצר בערבית על סמך הפרטים בלבד. החזר/י רק את הטקסט.` },
  { key: "en", label: "תרגום לאנגלית", needsProduct: true, productContent: true, prompt: (p) => `Translate the current description of the product "${p}" to natural English. If there is no description, write a short one from the given facts only. Return only the text.` },
  { key: "coupon", label: "רעיונות לקופון / קמפיין", prompt: () => "הצע/י 3 רעיונות לקופון או קמפיין לשבועיים הקרובים, על בסיס המכירות, המלאי והקופונים הקיימים. לכל רעיון: קוד מוצע, ההנחה, למי מיועד ולמה (לפי הנתונים)." },
  { key: "wa", label: "הודעת וואטסאפ", prompt: () => "כתוב/י הודעת וואטסאפ קצרה ונעימה ללקוחות החנות (עד 60 מילים) על הקולקציה או מבצע פעיל – רק לפי הנתונים. כולל אימוג׳י אחד או שניים לכל היותר." },
  { key: "sales", label: "סיכום מכירות", prompt: () => "סכם/י את המכירות ב־30 הימים האחרונים לעומת 30 הימים שלפני כן: הכנסות, הזמנות, סל ממוצע, המוצרים המובילים ו־3 תובנות מעשיות." },
  { key: "slow", label: "מוצרים שלא נמכרים", prompt: () => "אילו מוצרים פעילים לא נמכרו ב־30 הימים האחרונים למרות שיש להם מלאי? הצע/י לכל אחד פעולה אחת (מחיר, צילום, תיאור, קידום)." },
  { key: "sizes", label: "ביקוש לפי מידות", prompt: () => "נתח/י את הביקוש לפי מידות ב־30 הימים האחרונים לעומת המלאי הקיים. אילו מידות כדאי להזמין יותר ואילו פחות? פרט/י לפי הנתונים." },
];

async function copyText(t: string) {
  try {
    await navigator.clipboard.writeText(t);
  } catch {
    const el = document.createElement("textarea");
    el.value = t;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    el.remove();
  }
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="a-btn a-btn-sm" onClick={async () => { await copyText(text); setDone(true); setTimeout(() => setDone(false), 1500); }}>
      <Icon name={done ? "check" : "copy"} size={15} /> {done ? "הועתק" : "העתקה"}
      <span className="sr-only" aria-live="polite">{done ? "הטקסט הועתק" : ""}</span>
    </button>
  );
}

function SaveToProduct({ text, products, defaultId }: { text: string; products: { id: number; name: string }[]; defaultId?: number | null }) {
  const [open, setOpen] = useState(false);
  const [pid, setPid] = useState<string>(defaultId ? String(defaultId) : "");
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ ok?: boolean; error?: string; name?: string } | null>(null);

  if (res?.ok)
    return (
      <span className="text-[13px] text-[#0B5E43] font-semibold flex items-center gap-1.5" role="status">
        <Icon name="check" size={15} /> נשמר בתיאור של {res.name}.{" "}
        <Link href={`/admin/products/${pid}`} className="text-adm-link underline">לעורך המוצר</Link>
      </span>
    );
  if (!open)
    return (
      <button type="button" className="a-btn a-btn-sm" onClick={() => setOpen(true)}>
        <Icon name="box" size={15} /> שמירה כטיוטה למוצר
      </button>
    );
  const chosen = products.find((p) => String(p.id) === pid);
  return (
    <div className="w-full mt-1 p-3 rounded-xl border border-adm-line bg-adm-bg flex flex-col gap-3">
      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="a-field">
          מוצר
          <select className="a-input" value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">בחירת מוצר…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <fieldset className="flex gap-3 text-[13px] min-h-[42px] items-center">
          <legend className="sr-only">אופן השמירה</legend>
          <label className="flex items-center gap-1.5"><input type="radio" name="mode" checked={mode === "replace"} onChange={() => setMode("replace")} className="w-4 h-4 accent-[#3478F6]" /> החלפת התיאור</label>
          <label className="flex items-center gap-1.5"><input type="radio" name="mode" checked={mode === "append"} onChange={() => setMode("append")} className="w-4 h-4 accent-[#3478F6]" /> הוספה בסוף</label>
        </fieldset>
      </div>
      <p className="text-[12px] text-adm-muted">הטקסט ייכנס לשדה התיאור בלבד. מצב התצוגה של המוצר באתר לא משתנה. מומלץ לעבור על הטקסט לפני השמירה.</p>
      {res?.error && <p role="alert" className="text-[13px] font-bold text-[#A13A0D]">{res.error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          className="a-btn a-btn-primary a-btn-sm"
          disabled={!pid || busy}
          onClick={async () => {
            if (!chosen) return;
            if (!window.confirm(`${mode === "replace" ? "להחליף" : "להוסיף ל"}תיאור של "${chosen.name}" בטקסט הזה? השינוי יופיע מיד בדף המוצר אם המוצר מוצג באתר.`)) return;
            setBusy(true);
            try {
              setRes(await saveAiDraftToProductAction({ productId: Number(pid), text, mode }));
            } catch {
              setRes({ error: "השמירה נכשלה – ייתכן שאין לך הרשאת עריכה למוצרים" });
            }
            setBusy(false);
          }}
        >
          {busy ? "שומר…" : "שמירה בתיאור המוצר"}
        </button>
        <button type="button" className="a-btn a-btn-sm" onClick={() => { setOpen(false); setRes(null); }}>ביטול</button>
      </div>
    </div>
  );
}

export default function AiChat({ ready, products, canSaveToProduct, model, limit }: { ready: boolean; products: { id: number; name: string }[]; canSaveToProduct: boolean; model: string; limit: number }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [productId, setProductId] = useState<string>("");
  const [pendingTask, setPendingTask] = useState<Task | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs, busy]);

  const productName = products.find((p) => String(p.id) === productId)?.name || "";

  async function send(text: string, opts: { productContent?: boolean } = {}) {
    const content = text.trim();
    if (!content || busy || !ready) return;
    const pid = productId ? Number(productId) : null;
    const next: Msg[] = [...msgs, { role: "user", content }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      const history = next.filter((m) => !m.error).slice(-10).map((m) => ({ role: m.role, content: m.content }));
      const r = await askAiAction({ messages: history, productId: pid });
      setMsgs((s) => [...s, r.error ? { role: "assistant", content: r.error, error: true } : { role: "assistant", content: r.text || "", productContent: !!opts.productContent, productId: pid }]);
    } catch {
      setMsgs((s) => [...s, { role: "assistant", content: "הבקשה נכשלה. ייתכן שפג תוקף ההתחברות – רענני את הדף.", error: true }]);
    }
    setBusy(false);
    inputRef.current?.focus();
  }

  function runTask(t: Task) {
    if (t.needsProduct && !productId) {
      setPendingTask(t);
      document.getElementById("ai-product")?.focus();
      return;
    }
    setPendingTask(null);
    send(t.prompt(productName), { productContent: t.productContent });
  }

  useEffect(() => {
    if (pendingTask && productId) {
      const t = pendingTask;
      setPendingTask(null);
      send(t.prompt(productName), { productContent: t.productContent });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  return (
    <div className="grid lg:grid-cols-[300px_1fr] gap-4 items-start">
      <aside className="a-card flex flex-col gap-4" aria-label="משימות מהירות">
        <label className="a-field">
          מוצר להקשר (לא חובה)
          <select id="ai-product" className="a-input" value={productId} onChange={(e) => setProductId(e.target.value)} disabled={!ready}>
            <option value="">ללא מוצר מסוים</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          {pendingTask && <span className="text-[12px] font-semibold text-[#8A5A00]" role="status">בחרו מוצר כדי להמשיך: {pendingTask.label}</span>}
        </label>
        <div className="flex flex-col gap-2">
          <b className="text-[13px] text-adm-text">משימות מהירות</b>
          <div className="flex flex-wrap lg:flex-col gap-2">
            {TASKS.map((t) => (
              <button key={t.key} type="button" disabled={!ready || busy} onClick={() => runTask(t)} className="a-btn a-btn-sm lg:justify-start">
                <Icon name="sparkle" size={14} className="text-[#5B3FC4]" /> {t.label}
              </button>
            ))}
          </div>
        </div>
        <p className="text-[12px] text-adm-muted leading-5">
          העוזר מקבל תמונת מצב של החנות: מכירות 30 יום, מלאי, מוצרים וקופונים. הוא לא משנה דבר באתר בעצמו.
          {ready && <> מודל: <span dir="ltr" className="font-mono">{model}</span> · עד {limit} בקשות בשעה.</>}
        </p>
      </aside>

      <section className="a-card !p-0 flex flex-col min-h-[520px]" aria-label="שיחה עם העוזר">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-adm-line">
          <b className="text-[15px] text-adm-navy">שיחה</b>
          {msgs.length > 0 && (
            <button type="button" className="a-btn a-btn-sm" onClick={() => setMsgs([])} disabled={busy}>שיחה חדשה</button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 max-h-[60vh]" aria-live="polite">
          {msgs.length === 0 && !busy && (
            <div className="m-auto text-center text-[14px] text-adm-muted max-w-[420px] leading-6 py-10">
              <span className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-[#F1EDFD] text-[#5B3FC4] flex items-center justify-center"><Icon name="sparkle" size={22} /></span>
              בחרו משימה מהירה או כתבו בקשה חופשית – למשל &quot;איזה מגפון הכי נמכר החודש ובאיזו מידה?&quot;
            </div>
          )}
          {msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="self-start max-w-[85%] rounded-2xl rounded-tr-md bg-adm-blue text-white px-4 py-2.5 text-[14px] leading-6 whitespace-pre-wrap">{m.content}</div>
            ) : (
              <div key={i} className={`self-end w-full max-w-[92%] rounded-2xl rounded-tl-md border px-4 py-3 flex flex-col gap-2.5 ${m.error ? "bg-[#FDECEC] border-[#F3D3D3] text-[#8A2626]" : "bg-white border-adm-line"}`}>
                <div className="text-[14px] leading-7 whitespace-pre-wrap" dir="auto">{m.content}</div>
                {!m.error && (
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyBtn text={m.content} />
                    {m.productContent && canSaveToProduct && <SaveToProduct text={m.content} products={products} defaultId={m.productId} />}
                  </div>
                )}
              </div>
            )
          )}
          {busy && <div className="self-end text-[14px] text-adm-muted px-2" role="status">העוזר כותב…</div>}
          <div ref={endRef} />
        </div>
        <form
          className="border-t border-adm-line p-3 flex gap-2 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <label className="flex-1">
            <span className="sr-only">הודעה לעוזר</span>
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              maxLength={4000}
              disabled={!ready}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e: any) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder={ready ? "כתבו בקשה… (Enter לשליחה, Shift+Enter לשורה חדשה)" : "העוזר לא מחובר – יש להוסיף ANTHROPIC_API_KEY ב־Vercel"}
              className="a-input resize-none"
            />
          </label>
          <button type="submit" className="a-btn a-btn-primary" disabled={!ready || busy || !input.trim()}>
            שליחה
          </button>
        </form>
      </section>
    </div>
  );
}
