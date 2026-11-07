import crypto from "crypto";
import { db, hasDb } from "./db";
import { normCustomer, phoneKey } from "./admin";
import { shekel } from "./config";
import { NOT_CONNECTED, sendEmail, sendSms, sendWhatsApp } from "./messaging";
import {
  ACTION_META,
  TRIGGERS,
  describeCondition,
  renderTemplate,
  type Action,
  type ActionResult,
  type Condition,
  type RuleDraft,
  type TriggerKey,
  type Vars,
} from "@/app/admin/automations/meta";

/* Automations engine (server only).
   - runAutomations(event): evaluates the active rules for an event. Each (rule, event_key) pair runs at most
     once – guaranteed by the unique index on automation_runs. Delay 0 runs now; otherwise a run is stored
     with status 'scheduled' and due_at, and the daily cron (/api/cron/automations) executes it.
   - Messages go through src/lib/messaging.ts; an unconfigured channel is recorded as 'skipped' –
     never as sent. */

export type AutomationEvent =
  | { type: "order_created"; orderId: number }
  | { type: "order_status_changed"; orderId: number; status: string; before?: string }
  | { type: "customer_created"; phone: string };

export type Rule = RuleDraft & { id: number; active: boolean; created_at: string; updated_at: string };

type Payload = { trigger: TriggerKey; orderId?: number; status?: string; phone?: string; coupon?: string };

type Customer = ReturnType<typeof normCustomer> & { birthday: string | null; orders_count: number; spent: number; last_order: string | null };
type OrderRow = { id: number; number: string; customer_name: string; phone: string; email: string; city: string; total: number; status: string };
type Ctx = { payload: Payload; order: OrderRow | null; customer: Customer | null; phone: string; email: string; name: string; coupon: string };

const LIVE = ["cancelled", "returned"];

const parse = (v: any, def: any) => {
  if (v === null || v === undefined) return def;
  if (typeof v === "string") {
    try {
      return JSON.parse(v);
    } catch {
      return def;
    }
  }
  return v;
};

export function normRule(r: any): Rule {
  return {
    id: Number(r.id),
    name: r.name || "",
    trigger: r.trigger,
    trigger_config: parse(r.trigger_config, {}) || {},
    conditions: parse(r.conditions, []) || [],
    actions: parse(r.actions, []) || [],
    delay_minutes: Number(r.delay_minutes || 0),
    active: !!r.active,
    created_at: new Date(r.created_at).toISOString(),
    updated_at: new Date(r.updated_at || r.created_at).toISOString(),
  };
}

/* ---------------- site link ---------------- */

export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "");
  return String(raw || "").replace(/\/+$/, "");
}

/* ---------------- context ---------------- */

type Sql = Awaited<ReturnType<typeof db>>;

async function loadCustomer(sql: Sql, phone: string): Promise<Customer | null> {
  const k = phoneKey(phone);
  if (!k) return null;
  const r = await sql`
    select c.*,
           (select count(*) from orders o where regexp_replace(o.phone, '[^0-9]', '', 'g') = c.phone and o.status not in ('cancelled', 'returned'))::int as orders_count,
           (select coalesce(sum(total), 0) from orders o where regexp_replace(o.phone, '[^0-9]', '', 'g') = c.phone and o.status not in ('cancelled', 'returned'))::int as spent,
           (select max(created_at) from orders o where regexp_replace(o.phone, '[^0-9]', '', 'g') = c.phone and o.status not in ('cancelled', 'returned')) as last_order
    from customers c where c.phone = ${k} limit 1`;
  if (!r[0]) return null;
  const x = r[0] as any;
  return {
    ...normCustomer(x),
    birthday: x.birthday ? new Date(x.birthday).toISOString().slice(0, 10) : null,
    orders_count: Number(x.orders_count || 0),
    spent: Number(x.spent || 0),
    last_order: x.last_order ? new Date(x.last_order).toISOString() : null,
  };
}

async function loadOrder(sql: Sql, id: number): Promise<OrderRow | null> {
  const r = await sql`select id, number, customer_name, phone, email, city, total, status from orders where id = ${id} limit 1`;
  if (!r[0]) return null;
  const o = r[0] as any;
  return { id: Number(o.id), number: o.number || `Q${1000 + Number(o.id)}`, customer_name: o.customer_name || "", phone: o.phone || "", email: o.email || "", city: o.city || "", total: Number(o.total || 0), status: o.status };
}

async function buildCtx(sql: Sql, payload: Payload): Promise<Ctx> {
  const order = payload.orderId ? await loadOrder(sql, payload.orderId) : null;
  const phone = order?.phone || payload.phone || "";
  const customer = phone ? await loadCustomer(sql, phone) : null;
  return {
    payload,
    order,
    customer,
    phone,
    email: order?.email || customer?.email || "",
    name: (customer?.name || order?.customer_name || "").trim(),
    coupon: payload.coupon || "",
  };
}

function vars(ctx: Ctx): Vars {
  const site = siteUrl();
  return {
    name: ctx.name.split(/\s+/)[0] || "",
    order: ctx.order?.number || "",
    amount: ctx.order ? shekel(ctx.order.total) : "",
    coupon: ctx.coupon,
    link: site ? (ctx.order ? `${site}/order/${ctx.order.number}` : `${site}/shop`) : "",
  };
}

/* ---------------- conditions ---------------- */

function checkCondition(c: Condition, ctx: Ctx): boolean {
  const num = (v: number) => {
    const t = Number(c.value);
    switch (c.op) {
      case "gt": return v > t;
      case "gte": return v >= t;
      case "lt": return v < t;
      case "lte": return v <= t;
      case "eq": return v === t;
      case "neq": return v !== t;
      default: return false;
    }
  };
  const norm = (s: string) => s.trim().toLowerCase();
  switch (c.field) {
    case "order_total": return ctx.order ? num(ctx.order.total) : false;
    case "orders_count": return num(ctx.customer?.orders_count || 0);
    case "spent": return num(ctx.customer?.spent || 0);
    case "tags": {
      const has = (ctx.customer?.tags || []).some((t) => norm(t) === norm(c.value));
      return c.op === "has" ? has : c.op === "not_has" ? !has : false;
    }
    case "city": {
      const city = norm(ctx.order?.city || ctx.customer?.city || "");
      if (c.op === "eq") return city === norm(c.value);
      if (c.op === "neq") return city !== norm(c.value);
      if (c.op === "contains") return city.includes(norm(c.value));
      return false;
    }
    case "consent": {
      const yes = !!ctx.customer?.marketing_consent;
      return c.op === "is_yes" ? yes : !yes;
    }
    default: return false;
  }
}

/* ---------------- actions ---------------- */

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const randomCode = (prefix: string) => `${prefix}-${Array.from(crypto.randomBytes(6) as Uint8Array, (b: number) => ALPHABET[b % ALPHABET.length]).join("")}`;

async function createCoupon(sql: Sql, a: Action, rule: Rule, ctx: Ctx): Promise<ActionResult> {
  const days = Math.max(1, Math.min(365, Number(a.coupon_days) || 14));
  const type = a.coupon_type === "fixed" ? "fixed" : "percent";
  const value = Math.round(Number(a.coupon_value) || 0);
  const who = ctx.name || ctx.phone || "לקוחה";
  for (let i = 0; i < 5; i++) {
    const code = randomCode(a.coupon_prefix || "Q");
    const r = await sql`
      insert into coupons (code, description, type, value, min_total, starts_at, ends_at, usage_limit, per_customer, active)
      values (${code}, ${`אישי ל${who} · אוטומציה "${rule.name}"`.slice(0, 200)}, ${type}, ${value}, ${Math.max(0, Number(a.coupon_min_total) || 0)},
              now(), now() + make_interval(days => ${days}::int), 1, 1, true)
      on conflict (code) do nothing returning code`;
    if (r[0]) return { type: "create_coupon", status: "done", detail: `נוצר קופון ${code} (${type === "fixed" ? shekel(value) : value + "%"}, ${days} ימים)`, coupon: code };
  }
  return { type: "create_coupon", status: "failed", detail: "לא הצלחנו ליצור קוד ייחודי" };
}

async function addTag(sql: Sql, a: Action, ctx: Ctx): Promise<ActionResult> {
  const tag = String(a.tag || "").trim();
  if (!ctx.customer) return { type: "add_customer_tag", status: "skipped", detail: "אין כרטיס לקוחה" };
  if (ctx.customer.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return { type: "add_customer_tag", status: "done", detail: `התגית "${tag}" כבר קיימת` };
  await sql`
    update customers set tags = (case when jsonb_typeof(tags) = 'array' then tags else '[]'::jsonb end) || ${JSON.stringify([tag])}::jsonb, updated_at = now()
    where id = ${ctx.customer.id}`;
  ctx.customer.tags.push(tag);
  return { type: "add_customer_tag", status: "done", detail: `נוספה התגית "${tag}"` };
}

async function notifyAdmin(sql: Sql, a: Action, rule: Rule, ctx: Ctx, v: Vars): Promise<ActionResult> {
  const text = renderTemplate(a.message || "", v).slice(0, 500);
  await sql`
    insert into audit_logs (actor, action, entity, entity_id, summary, after)
    values ('אוטומציה', 'create', 'automation', ${String(rule.id)}, ${`🔔 ${rule.name}: ${text}`.slice(0, 600)},
            ${JSON.stringify({ rule: rule.name, order: ctx.order?.number || undefined, phone: ctx.phone || undefined })}::jsonb)`;
  return { type: "admin_notification", status: "done", detail: "נרשמה התראה ביומן הפעילות" };
}

async function runAction(sql: Sql, a: Action, rule: Rule, ctx: Ctx, timeoutMs: number): Promise<ActionResult> {
  const v = vars(ctx);
  try {
    switch (a.type) {
      case "create_coupon": return await createCoupon(sql, a, rule, ctx);
      case "add_customer_tag": return await addTag(sql, a, ctx);
      case "admin_notification": return await notifyAdmin(sql, a, rule, ctx, v);
      case "send_whatsapp": {
        if (!ctx.phone) return { type: a.type, status: "skipped", detail: "אין מספר טלפון" };
        const r = await sendWhatsApp(ctx.phone, renderTemplate(a.message || "", v), { timeoutMs });
        return { type: a.type, status: r.status, detail: r.detail };
      }
      case "send_sms": {
        if (!ctx.phone) return { type: a.type, status: "skipped", detail: "אין מספר טלפון" };
        const r = await sendSms(ctx.phone, renderTemplate(a.message || "", v), { timeoutMs });
        return { type: a.type, status: r.status, detail: r.detail };
      }
      case "send_email": {
        const r = await sendEmail(ctx.email, renderTemplate(a.subject || "", v), renderTemplate(a.message || "", v), { timeoutMs });
        return { type: a.type, status: r.status, detail: r.detail };
      }
      default:
        return { type: a.type, status: "skipped", detail: "פעולה לא מוכרת" };
    }
  } catch (e: any) {
    console.error("automation action failed", a.type, e);
    return { type: a.type, status: "failed", detail: String(e?.message || e).slice(0, 200) };
  }
}

function summarise(results: ActionResult[]): { status: string; detail: string } {
  const ok = results.filter((r) => r.status === "sent" || r.status === "done").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const status = failed && !ok ? "failed" : failed || (ok && skipped) ? "partial" : ok ? "success" : "skipped";
  const detail = results.map((r) => `${ACTION_META[r.type]?.label || r.type}: ${r.detail}`).join(" · ").slice(0, 900);
  return { status, detail };
}

/* ---------------- executing one run ---------------- */

/** Execute a run that is already claimed (status 'running'). Writes the outcome and returns it. */
async function execute(sql: Sql, runId: number, rule: Rule, payload: Payload, opts: { timeoutMs: number; previous?: ActionResult[] }): Promise<{ status: string; detail: string }> {
  let out: { status: string; detail: string; results: ActionResult[] };
  try {
    const ctx = await buildCtx(sql, payload);
    if (payload.orderId && !ctx.order) {
      out = { status: "skipped", detail: "ההזמנה כבר לא קיימת", results: [] };
    } else if (ctx.order && LIVE.includes(ctx.order.status) && rule.trigger !== "order_status_changed") {
      out = { status: "skipped", detail: "ההזמנה בוטלה או הוחזרה לפני הביצוע", results: [] };
    } else {
      const failed = rule.conditions.filter((c) => !checkCondition(c, ctx));
      if (failed.length) {
        out = { status: "skipped", detail: `התנאים לא התקיימו: ${failed.map(describeCondition).join(" · ")}`, results: [] };
      } else {
        const results: ActionResult[] = [];
        // On a retry, actions that already succeeded are not repeated (no double messages, no second coupon)
        const prev = opts.previous || [];
        const prevCoupon = prev.find((r) => r.type === "create_coupon" && r.coupon)?.coupon;
        const ordered = [...rule.actions.filter((a) => a.type === "create_coupon"), ...rule.actions.filter((a) => a.type !== "create_coupon")];
        for (let i = 0; i < ordered.length; i++) {
          const a = ordered[i];
          if (a.type === "create_coupon" && prevCoupon) {
            ctx.coupon = prevCoupon;
            results.push({ type: "create_coupon", status: "done", detail: `נעשה שימוש בקופון שנוצר קודם: ${prevCoupon}`, coupon: prevCoupon });
            continue;
          }
          const before = prev[i];
          if (before && before.type === a.type && (before.status === "sent" || before.status === "done")) {
            results.push({ ...before, detail: `כבר בוצע בריצה הקודמת – ${before.detail}` });
            continue;
          }
          const r = await runAction(sql, a, rule, ctx, opts.timeoutMs);
          if (r.coupon) ctx.coupon = r.coupon;
          results.push(r);
        }
        out = { ...summarise(results), results };
      }
    }
  } catch (e: any) {
    console.error("automation run failed", runId, e);
    out = { status: "failed", detail: `שגיאה: ${String(e?.message || e).slice(0, 200)}`, results: [] };
  }
  await sql`
    update automation_runs set status = ${out.status}, detail = ${out.detail}, results = ${JSON.stringify(out.results)}::jsonb, ran_at = now()
    where id = ${runId}`;
  return { status: out.status, detail: out.detail };
}

/** Claim a (rule, event_key) pair and run it now, or schedule it. Returns false when it already ran. */
async function fire(sql: Sql, rule: Rule, eventKey: string, payload: Payload, phone: string, timeoutMs: number): Promise<boolean> {
  const delayed = rule.delay_minutes > 0;
  const r = await sql`
    insert into automation_runs (rule_id, event_key, customer_phone, status, detail, due_at, payload)
    values (${rule.id}, ${eventKey.slice(0, 200)}, ${phoneKey(phone)}, ${delayed ? "scheduled" : "running"},
            ${delayed ? "ממתין לביצוע" : ""}, ${delayed ? sql`now() + make_interval(mins => ${rule.delay_minutes}::int)` : null}, ${JSON.stringify(payload)}::jsonb)
    on conflict (rule_id, event_key) do nothing
    returning id`;
  if (!r[0]) return false;
  if (!delayed) await execute(sql, Number(r[0].id), rule, payload, { timeoutMs });
  return true;
}

async function activeRules(sql: Sql, triggers: TriggerKey[]): Promise<Rule[]> {
  const r = await sql`select * from automation_rules where active = true and trigger in ${sql(triggers)} order by id`;
  return (r as any[]).map(normRule);
}

/* ---------------- public: events ---------------- */

export async function runAutomations(event: AutomationEvent, opts: { timeoutMs?: number } = {}): Promise<number> {
  if (!hasDb()) return 0;
  const sql = await db();
  const timeoutMs = opts.timeoutMs || 8000;
  let fired = 0;

  if (event.type === "order_created") {
    const rules = await activeRules(sql, ["order_created"]);
    if (!rules.length) return 0;
    const o = await loadOrder(sql, event.orderId);
    if (!o) return 0;
    for (const rule of rules) if (await fire(sql, rule, `order:${o.id}`, { trigger: rule.trigger, orderId: o.id }, o.phone, timeoutMs)) fired++;
  } else if (event.type === "order_status_changed") {
    if (event.before === event.status) return 0;
    const rules = await activeRules(sql, event.status === "delivered" ? ["order_status_changed", "order_delivered"] : ["order_status_changed"]);
    if (!rules.length) return 0;
    const o = await loadOrder(sql, event.orderId);
    if (!o) return 0;
    for (const rule of rules) {
      if (rule.trigger === "order_status_changed" && rule.trigger_config.status && rule.trigger_config.status !== event.status) continue;
      const key = rule.trigger === "order_delivered" ? `delivered:${o.id}` : `status:${o.id}:${event.status}`;
      if (await fire(sql, rule, key, { trigger: rule.trigger, orderId: o.id, status: event.status }, o.phone, timeoutMs)) fired++;
    }
  } else if (event.type === "customer_created") {
    const k = phoneKey(event.phone);
    if (!k) return 0;
    const rules = await activeRules(sql, ["customer_created"]);
    for (const rule of rules) if (await fire(sql, rule, `customer:${k}`, { trigger: rule.trigger, phone: k }, k, timeoutMs)) fired++;
  }
  return fired;
}

/**
 * Hook entry point used by orders / customers code. Never throws and never takes longer than `capMs`.
 * Serverless functions can be frozen once the response is sent, so callers await this
 * (fire-and-forget is not reliable) – the cap keeps checkout fast. A run cut off by the cap stays
 * 'running' and the cron marks it failed after 15 minutes so it can be retried from the log.
 */
export async function runAutomationsSafe(event: AutomationEvent, capMs = 3000): Promise<void> {
  try {
    let timer: any;
    await Promise.race([
      runAutomations(event, { timeoutMs: Math.max(1000, capMs - 500) }).catch((e) => console.error("automations failed", e)),
      new Promise<void>((resolve) => { timer = setTimeout(resolve, capMs); }),
    ]);
    clearTimeout(timer);
  } catch (e) {
    console.error("automations failed", e);
  }
}

/* ---------------- public: retry ---------------- */

export async function retryRun(runId: number): Promise<{ status: string; detail: string } | { error: string }> {
  const sql = await db();
  const r = await sql`
    update automation_runs set status = 'running', detail = '', ran_at = now() where id = ${runId} and status in ('failed', 'partial')
    returning id, rule_id, payload, results`;
  if (!r[0]) return { error: "אפשר להריץ שוב רק ריצה שנכשלה" };
  const ruleRow = await sql`select * from automation_rules where id = ${r[0].rule_id}`;
  if (!ruleRow[0]) {
    await sql`update automation_runs set status = 'failed', detail = 'האוטומציה נמחקה' where id = ${runId}`;
    return { error: "האוטומציה נמחקה" };
  }
  const rule = normRule(ruleRow[0]);
  const previous = (parse(r[0].results, []) || []) as ActionResult[];
  return execute(sql, runId, rule, parse(r[0].payload, {}) as Payload, { timeoutMs: 8000, previous });
}

/* ---------------- public: cron ---------------- */

const todayIL = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });

export type CronSummary = { due: number; recovered: number; daily: boolean; birthday: number; inactive: number; coupon_expiring: number; errors: string[] };

export async function runCron(opts: { force?: boolean; deadline?: number } = {}): Promise<CronSummary> {
  const out: CronSummary = { due: 0, recovered: 0, daily: false, birthday: 0, inactive: 0, coupon_expiring: 0, errors: [] };
  if (!hasDb()) {
    out.errors.push("no database");
    return out;
  }
  const sql = await db();
  const deadline = opts.deadline || Date.now() + 50_000;
  const timeLeft = () => deadline - Date.now() > 4000;

  // 1. runs cut off mid-way (function timeout) → failed, so they can be retried
  const stuck = await sql`
    update automation_runs set status = 'failed', detail = 'הריצה נקטעה לפני שהסתיימה – אפשר להריץ שוב'
    where status = 'running' and created_at < now() - interval '15 minutes' and (ran_at is null or ran_at < now() - interval '15 minutes')
    returning id`;
  out.recovered = stuck.length;

  // 2. scheduled runs that are due
  while (timeLeft()) {
    const batch = await sql`
      update automation_runs set status = 'running', ran_at = now()
      where id in (select id from automation_runs where status = 'scheduled' and due_at <= now() order by due_at limit 20 for update skip locked)
      returning id, rule_id, payload`;
    if (!batch.length) break;
    for (const run of batch as any[]) {
      const rr = await sql`select * from automation_rules where id = ${run.rule_id}`;
      if (!rr[0] || !rr[0].active) {
        await sql`update automation_runs set status = 'cancelled', detail = ${!rr[0] ? "האוטומציה נמחקה" : "האוטומציה הושבתה לפני מועד הביצוע"}, ran_at = now() where id = ${run.id}`;
        continue;
      }
      await execute(sql, Number(run.id), normRule(rr[0]), parse(run.payload, {}) as Payload, { timeoutMs: 8000 });
      out.due++;
      if (!timeLeft()) break;
    }
  }

  // 3. time-based triggers, once per Israel day
  const today = todayIL();
  const last = await sql`select value from settings where key = 'automations_cron'`;
  const lastDay = last[0] ? (parse(last[0].value, {}) || {}).day : null;
  if (lastDay === today && !opts.force) return out;
  out.daily = true;

  const rules = await activeRules(sql, ["birthday", "inactive_customer", "coupon_expiring"]);
  const PER_RULE = 150; // keeps one cron run within the time limit; the rest continue tomorrow
  for (const rule of rules) {
    if (!timeLeft()) {
      out.errors.push("time limit reached");
      break;
    }
    try {
      if (rule.trigger === "birthday") {
        const [, mm, dd] = today.split("-");
        const y = Number(today.slice(0, 4));
        const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
        const feb28 = mm === "02" && dd === "28" && !leap; // Feb 29 birthdays are celebrated on Feb 28
        const list = await sql`
          select phone from customers
          where archived = false and birthday is not null
            and (to_char(birthday, 'MM-DD') = ${`${mm}-${dd}`} ${feb28 ? sql`or to_char(birthday, 'MM-DD') = '02-29'` : sql``})
          limit ${PER_RULE}`;
        for (const c of list as any[]) {
          if (!timeLeft()) break;
          if (await fire(sql, rule, `bday:${c.phone}:${y}`, { trigger: "birthday", phone: c.phone }, c.phone, 8000)) out.birthday++;
        }
      } else if (rule.trigger === "inactive_customer") {
        const days = Math.max(14, Number(rule.trigger_config.days) || 90);
        const list = await sql`
          select c.phone, to_char(max(o.created_at) at time zone 'Asia/Jerusalem', 'YYYY-MM-DD') as last_day
          from customers c join orders o on regexp_replace(o.phone, '[^0-9]', '', 'g') = c.phone and o.status not in ('cancelled', 'returned')
          where c.archived = false
          group by c.phone
          having max(o.created_at) < now() - make_interval(days => ${days}::int)
             and not exists (select 1 from automation_runs r where r.rule_id = ${rule.id} and r.event_key = 'inactive:' || c.phone || ':' || to_char(max(o.created_at) at time zone 'Asia/Jerusalem', 'YYYY-MM-DD'))
          order by max(o.created_at) desc
          limit ${PER_RULE}`;
        for (const c of list as any[]) {
          if (!timeLeft()) break;
          if (await fire(sql, rule, `inactive:${c.phone}:${c.last_day}`, { trigger: "inactive_customer", phone: c.phone }, c.phone, 8000)) out.inactive++;
        }
      } else if (rule.trigger === "coupon_expiring") {
        const days = Math.max(1, Number(rule.trigger_config.days) || 3);
        // personal coupons created by an automation, still unused, ending within `days`
        const list = await sql`
          select distinct on (c.code) c.code, r.customer_phone as phone
          from coupons c
          join automation_runs r on r.customer_phone <> '' and exists (select 1 from jsonb_array_elements(case when jsonb_typeof(r.results) = 'array' then r.results else '[]'::jsonb end) x where x->>'coupon' = c.code)
          where c.active = true and c.ends_at > now() and c.ends_at <= now() + make_interval(days => ${days}::int)
            and (c.usage_limit is null or c.used < c.usage_limit)
            and not exists (select 1 from orders o where upper(o.coupon_code) = upper(c.code) and o.status not in ('cancelled', 'returned'))
          limit ${PER_RULE}`;
        for (const c of list as any[]) {
          if (!timeLeft()) break;
          if (await fire(sql, rule, `expiring:${c.code}`, { trigger: "coupon_expiring", phone: c.phone, coupon: c.code }, c.phone, 8000)) out.coupon_expiring++;
        }
      }
    } catch (e: any) {
      console.error("automation daily trigger failed", rule.id, e);
      out.errors.push(`rule ${rule.id}: ${String(e?.message || e).slice(0, 120)}`);
    }
  }

  await sql`
    insert into settings (key, value, updated_at) values ('automations_cron', ${JSON.stringify({ day: today, at: new Date().toISOString(), summary: out })}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
  return out;
}

/* ---------------- admin reads ---------------- */

export type RuleStats = { runs: number; success: number; failed: number; scheduled: number; last_run: string | null; last_status: string | null };

export async function listRulesWithStats(): Promise<(Rule & { stats: RuleStats })[]> {
  if (!hasDb()) return [];
  const sql = await db();
  const r = await sql`
    select ar.*,
           (select count(*) from automation_runs x where x.rule_id = ar.id)::int as runs,
           (select count(*) from automation_runs x where x.rule_id = ar.id and x.status = 'success')::int as success,
           (select count(*) from automation_runs x where x.rule_id = ar.id and x.status = 'failed')::int as failed,
           (select count(*) from automation_runs x where x.rule_id = ar.id and x.status = 'scheduled')::int as scheduled,
           (select max(coalesce(x.ran_at, x.created_at)) from automation_runs x where x.rule_id = ar.id and x.status <> 'scheduled') as last_run,
           (select x.status from automation_runs x where x.rule_id = ar.id and x.status <> 'scheduled' order by coalesce(x.ran_at, x.created_at) desc limit 1) as last_status
    from automation_rules ar order by ar.active desc, ar.id desc`;
  return (r as any[]).map((x) => ({
    ...normRule(x),
    stats: {
      runs: Number(x.runs),
      success: Number(x.success),
      failed: Number(x.failed),
      scheduled: Number(x.scheduled),
      last_run: x.last_run ? new Date(x.last_run).toISOString() : null,
      last_status: x.last_status || null,
    },
  }));
}

export async function getRule(id: number): Promise<Rule | null> {
  if (!hasDb()) return null;
  const sql = await db();
  const r = await sql`select * from automation_rules where id = ${id}`;
  return r[0] ? normRule(r[0]) : null;
}

export type RunRow = { id: number; rule_id: number | null; rule_name: string; event_key: string; customer_phone: string; status: string; detail: string; due_at: string | null; created_at: string; ran_at: string | null; results: ActionResult[]; orderId: number | null };

export async function listRuns(f: { rule?: number | null; status?: string | null; limit?: number }): Promise<RunRow[]> {
  if (!hasDb()) return [];
  const sql = await db();
  const r = await sql`
    select x.*, coalesce(ar.name, 'אוטומציה שנמחקה') as rule_name
    from automation_runs x left join automation_rules ar on ar.id = x.rule_id
    where (${f.rule || null}::int is null or x.rule_id = ${f.rule || null})
      and (${f.status || null}::text is null or x.status = ${f.status || null})
    order by x.id desc limit ${f.limit || 200}`;
  return (r as any[]).map((x) => {
    const payload = parse(x.payload, {}) || {};
    return {
      id: Number(x.id),
      rule_id: x.rule_id === null ? null : Number(x.rule_id),
      rule_name: x.rule_name,
      event_key: x.event_key,
      customer_phone: x.customer_phone || "",
      status: x.status,
      detail: x.detail || "",
      due_at: x.due_at ? new Date(x.due_at).toISOString() : null,
      created_at: new Date(x.created_at).toISOString(),
      ran_at: x.ran_at ? new Date(x.ran_at).toISOString() : null,
      results: parse(x.results, []) || [],
      orderId: payload.orderId ? Number(payload.orderId) : null,
    };
  });
}

export async function lastCronInfo(): Promise<{ day: string; at: string } | null> {
  if (!hasDb()) return null;
  try {
    const sql = await db();
    const r = await sql`select value from settings where key = 'automations_cron'`;
    const v = r[0] ? parse(r[0].value, null) : null;
    return v && v.at ? { day: v.day, at: v.at } : null;
  } catch {
    return null;
  }
}

export const triggerLabel = (t: string) => TRIGGERS[t as TriggerKey]?.label || t;
