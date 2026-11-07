/* Outbound messaging channels (server only). Each channel works only when its env vars are set;
   otherwise the send helpers return status "skipped" with "ערוץ לא מחובר" – they never pretend to send.
   All calls use fetch (no SDKs) with a timeout. */

export type Channel = "whatsapp" | "email" | "sms";
export type SendResult = { status: "sent" | "skipped" | "failed"; detail: string };

export const NOT_CONNECTED = "ערוץ לא מחובר";

export const CHANNEL_META: Record<Channel, { label: string; provider: string; env: string[]; optional?: string[]; help: string }> = {
  whatsapp: {
    label: "וואטסאפ",
    provider: "WhatsApp Cloud API (Meta)",
    env: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_TEMPLATE"],
    optional: ["WHATSAPP_TEMPLATE_LANG"],
    help: "תבנית (Template) מאושרת ב־Meta עם משתנה גוף אחד {{1}} – כל ההודעה נשלחת בתוכו. שפת התבנית ברירת מחדל: he.",
  },
  email: {
    label: "מייל",
    provider: "Resend",
    env: ["RESEND_API_KEY", "EMAIL_FROM"],
    help: "EMAIL_FROM צריך להיות כתובת בדומיין מאומת ב־Resend, למשל Quality <shop@your-domain.co.il>.",
  },
  sms: {
    label: "SMS",
    provider: "Twilio",
    env: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM"],
    help: "TWILIO_FROM הוא מספר או שם שולח מאושר בחשבון Twilio.",
  },
};

const env = (k: string) => String(process.env[k] || "").trim();

export function channelStatus(): Record<Channel, { configured: boolean; missing: string[] }> {
  const out = {} as Record<Channel, { configured: boolean; missing: string[] }>;
  for (const c of Object.keys(CHANNEL_META) as Channel[]) {
    const missing = CHANNEL_META[c].env.filter((k) => !env(k));
    out[c] = { configured: missing.length === 0, missing };
  }
  return out;
}

/** 05XXXXXXXX / +972… / 972… → 9725XXXXXXXX (digits only) */
export function intlDigits(phone: string): string {
  let d = String(phone || "").replace(/[^0-9]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = "972" + d.slice(1);
  return d;
}

async function post(url: string, init: RequestInit, timeoutMs: number): Promise<{ ok: boolean; status: number; body: any }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
    let body: any = null;
    try {
      body = await res.json();
    } catch {}
    return { ok: res.ok, status: res.status, body };
  } finally {
    clearTimeout(t);
  }
}

const errText = (e: any) => (e?.name === "AbortError" ? "תם הזמן להמתנה לספק" : String(e?.message || e).slice(0, 200));

/** WhatsApp Cloud API template message with one body variable holding the whole text. */
export async function sendWhatsApp(phone: string, text: string, opts: { timeoutMs?: number } = {}): Promise<SendResult> {
  if (!channelStatus().whatsapp.configured) return { status: "skipped", detail: NOT_CONNECTED };
  const to = intlDigits(phone);
  if (to.length < 11) return { status: "skipped", detail: "אין מספר טלפון תקין ללקוחה" };
  // Template parameters may not contain new lines, tabs or more than 4 spaces in a row.
  const param = text.replace(/[\r\n\t]+/g, " · ").replace(/ {4,}/g, "   ").trim().slice(0, 1000);
  try {
    const r = await post(
      `https://graph.facebook.com/v20.0/${encodeURIComponent(env("WHATSAPP_PHONE_NUMBER_ID"))}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${env("WHATSAPP_TOKEN")}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: env("WHATSAPP_TEMPLATE"),
            language: { code: env("WHATSAPP_TEMPLATE_LANG") || "he" },
            components: [{ type: "body", parameters: [{ type: "text", text: param }] }],
          },
        }),
      },
      opts.timeoutMs || 8000
    );
    if (r.ok && r.body?.messages?.[0]?.id) return { status: "sent", detail: `נשלח (מזהה ${String(r.body.messages[0].id).slice(-12)})` };
    return { status: "failed", detail: `שגיאת WhatsApp ${r.status}: ${String(r.body?.error?.message || "ללא פירוט").slice(0, 160)}` };
  } catch (e) {
    return { status: "failed", detail: errText(e) };
  }
}

const escHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function sendEmail(to: string, subject: string, text: string, opts: { timeoutMs?: number } = {}): Promise<SendResult> {
  if (!channelStatus().email.configured) return { status: "skipped", detail: NOT_CONNECTED };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to || "")) return { status: "skipped", detail: "אין כתובת מייל ללקוחה" };
  const html = `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;color:#141414">${escHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
    .replace(/\n/g, "<br>")}</div>`;
  try {
    const r = await post(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env("EMAIL_FROM"), to: [to], subject: subject.slice(0, 200) || "Quality", text, html }),
      },
      opts.timeoutMs || 8000
    );
    if (r.ok && r.body?.id) return { status: "sent", detail: `נשלח ל־${to}` };
    return { status: "failed", detail: `שגיאת Resend ${r.status}: ${String(r.body?.message || r.body?.name || "ללא פירוט").slice(0, 160)}` };
  } catch (e) {
    return { status: "failed", detail: errText(e) };
  }
}

export async function sendSms(phone: string, text: string, opts: { timeoutMs?: number } = {}): Promise<SendResult> {
  if (!channelStatus().sms.configured) return { status: "skipped", detail: NOT_CONNECTED };
  const to = intlDigits(phone);
  if (to.length < 11) return { status: "skipped", detail: "אין מספר טלפון תקין ללקוחה" };
  const sid = env("TWILIO_ACCOUNT_SID");
  const auth = Buffer.from(`${sid}:${env("TWILIO_AUTH_TOKEN")}`).toString("base64");
  const form = new URLSearchParams({ To: "+" + to, From: env("TWILIO_FROM"), Body: text.slice(0, 1000) });
  try {
    const r = await post(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
      { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() },
      opts.timeoutMs || 8000
    );
    if (r.ok && r.body?.sid) return { status: "sent", detail: "נשלח" };
    return { status: "failed", detail: `שגיאת Twilio ${r.status}: ${String(r.body?.message || "ללא פירוט").slice(0, 160)}` };
  } catch (e) {
    return { status: "failed", detail: errText(e) };
  }
}
