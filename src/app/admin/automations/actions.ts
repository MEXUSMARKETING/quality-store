"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db, hasDb } from "@/lib/db";
import { audit } from "@/lib/admin";
import { getRule, retryRun } from "@/lib/automations";
import { RUN_STATUS, TRIGGERS, validateRule } from "./meta";

export type BuilderState = { error?: string } | null;
export type RetryState = { ok?: boolean; error?: string; message?: string } | null;

const NO_DB = "מסד הנתונים לא מחובר, לא ניתן לשמור אוטומציות כרגע";

export async function saveRuleAction(_: BuilderState, fd: FormData): Promise<BuilderState> {
  await requireAdmin("automations");
  if (!hasDb()) return { error: NO_DB };
  let raw: unknown;
  try {
    raw = JSON.parse(String(fd.get("rule") || "{}"));
  } catch {
    return { error: "נתוני האוטומציה לא תקינים" };
  }
  const { rule, error } = validateRule(raw);
  if (!rule) return { error: error || "נתוני האוטומציה לא תקינים" };
  const sql = await db();
  let id = rule.id;
  try {
    if (id) {
      const old = await getRule(id);
      if (!old) return { error: "האוטומציה לא נמצאה (אולי נמחקה)" };
      await sql`
        update automation_rules set name = ${rule.name}, trigger = ${rule.trigger}, trigger_config = ${JSON.stringify(rule.trigger_config)}::jsonb,
          conditions = ${JSON.stringify(rule.conditions)}::jsonb, actions = ${JSON.stringify(rule.actions)}::jsonb,
          delay_minutes = ${rule.delay_minutes}, updated_at = now()
        where id = ${id}`;
      await audit({
        action: "update",
        entity: "automation",
        entityId: id,
        summary: `עודכנה האוטומציה "${rule.name}"`,
        before: { name: old.name, trigger: old.trigger, trigger_config: old.trigger_config, conditions: old.conditions, actions: old.actions, delay_minutes: old.delay_minutes },
        after: { name: rule.name, trigger: rule.trigger, trigger_config: rule.trigger_config, conditions: rule.conditions, actions: rule.actions, delay_minutes: rule.delay_minutes },
      });
    } else {
      // new rules always start inactive
      const r = await sql`
        insert into automation_rules (name, trigger, trigger_config, conditions, actions, delay_minutes, active)
        values (${rule.name}, ${rule.trigger}, ${JSON.stringify(rule.trigger_config)}::jsonb, ${JSON.stringify(rule.conditions)}::jsonb,
                ${JSON.stringify(rule.actions)}::jsonb, ${rule.delay_minutes}, false)
        returning id`;
      id = Number(r[0].id);
      await audit({ action: "create", entity: "automation", entityId: id, summary: `נוצרה אוטומציה "${rule.name}" (${TRIGGERS[rule.trigger].label}) – כבויה`, after: { ...rule, id, active: false } });
    }
  } catch (e) {
    console.error(e);
    return { error: "השמירה נכשלה, נסו שוב" };
  }
  revalidatePath("/admin/automations");
  redirect(`/admin/automations?saved=${id}`);
}

export async function toggleRuleAction(fd: FormData) {
  await requireAdmin("automations");
  if (!hasDb()) return;
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return;
  const rule = await getRule(id);
  if (!rule) return;
  const sql = await db();
  await sql`update automation_rules set active = ${!rule.active}, updated_at = now() where id = ${id}`;
  if (rule.active) {
    // turning off: scheduled runs of this rule will not be sent
    await sql`update automation_runs set status = 'cancelled', detail = 'האוטומציה הושבתה לפני מועד הביצוע' where rule_id = ${id} and status = 'scheduled'`;
  }
  await audit({ action: "status", entity: "automation", entityId: id, summary: `האוטומציה "${rule.name}" ${rule.active ? "הושבתה" : "הופעלה"}`, before: { active: rule.active }, after: { active: !rule.active } });
  revalidatePath("/admin/automations");
}

export async function deleteRuleAction(fd: FormData) {
  await requireAdmin("automations");
  if (!hasDb()) return;
  const id = Number(fd.get("id"));
  const rule = Number.isInteger(id) && id > 0 ? await getRule(id) : null;
  if (!rule) redirect("/admin/automations");
  const sql = await db();
  const [{ n }] = await sql`select count(*)::int as n from automation_runs where rule_id = ${id}`;
  await sql`delete from automation_rules where id = ${id}`;
  await audit({ action: "delete", entity: "automation", entityId: id, summary: `נמחקה האוטומציה "${rule!.name}" (${Number(n)} ריצות ביומן נמחקו איתה)`, before: { ...rule! } });
  revalidatePath("/admin/automations");
  redirect("/admin/automations?deleted=1");
}

export async function retryRunAction(_: RetryState, fd: FormData): Promise<RetryState> {
  await requireAdmin("automations");
  if (!hasDb()) return { error: NO_DB };
  const id = Number(fd.get("id"));
  if (!Number.isInteger(id) || id <= 0) return { error: "ריצה לא תקינה" };
  try {
    const r = await retryRun(id);
    if ("error" in r) return { error: r.error };
    await audit({ action: "update", entity: "automation", entityId: id, summary: `הרצה חוזרת של ריצת אוטומציה #${id}: ${RUN_STATUS[r.status]?.label || r.status}`, after: { status: r.status, detail: r.detail } });
    revalidatePath("/admin/automations");
    return { ok: r.status === "success", message: `${RUN_STATUS[r.status]?.label || r.status}: ${r.detail || "ללא פירוט"}` };
  } catch (e) {
    console.error(e);
    return { error: "ההרצה החוזרת נכשלה" };
  }
}
