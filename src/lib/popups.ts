import { cache } from "react";
import { db, hasDb } from "./db";
import { normalizeConfig, popupStatus, type Popup, type PopupLead, type PublicPopup } from "./popups-shared";

export * from "./popups-shared";

function normPopup(r: any): Popup {
  return {
    id: Number(r.id),
    name: String(r.name || ""),
    active: !!r.active,
    priority: Number(r.priority ?? 100),
    config: normalizeConfig(typeof r.config === "string" ? JSON.parse(r.config) : r.config),
    starts_at: r.starts_at ? new Date(r.starts_at).toISOString() : null,
    ends_at: r.ends_at ? new Date(r.ends_at).toISOString() : null,
    views: Number(r.views || 0),
    clicks: Number(r.clicks || 0),
    submits: Number(r.submits || 0),
    created_at: new Date(r.created_at).toISOString(),
    updated_at: new Date(r.updated_at || r.created_at).toISOString(),
  };
}

export async function listPopups(): Promise<Popup[]> {
  if (!hasDb()) return [];
  const sql = await db();
  const r = await sql`select * from popups order by priority asc, id desc`;
  return r.map(normPopup);
}

export async function getPopup(id: number): Promise<Popup | null> {
  if (!hasDb()) return null;
  const sql = await db();
  const r = await sql`select * from popups where id = ${id} limit 1`;
  return r[0] ? normPopup(r[0]) : null;
}

export type PopupInput = { name: string; active: boolean; priority: number; config: unknown; starts_at: Date | null; ends_at: Date | null };

export async function savePopup(id: number | null, p: PopupInput): Promise<number> {
  const sql = await db();
  const config = JSON.stringify(normalizeConfig(p.config));
  if (id) {
    await sql`
      update popups set name=${p.name}, active=${p.active}, priority=${p.priority}, config=${config}::jsonb,
        starts_at=${p.starts_at}, ends_at=${p.ends_at}, updated_at=now()
      where id=${id}`;
    return id;
  }
  const r = await sql`
    insert into popups (name, active, priority, config, starts_at, ends_at)
    values (${p.name}, ${p.active}, ${p.priority}, ${config}::jsonb, ${p.starts_at}, ${p.ends_at})
    returning id`;
  return Number(r[0].id);
}

export async function deletePopup(id: number) {
  const sql = await db();
  await sql`delete from popups where id=${id}`;
}

export async function setPopupActive(id: number, active: boolean) {
  const sql = await db();
  await sql`update popups set active=${active}, updated_at=now() where id=${id}`;
}

export async function duplicatePopup(id: number): Promise<number | null> {
  const p = await getPopup(id);
  if (!p) return null;
  return savePopup(null, { name: `${p.name} (עותק)`, active: false, priority: p.priority, config: p.config, starts_at: null, ends_at: null });
}

/** Popups currently live on the storefront (active and inside their schedule), highest priority first.
 *  Coupon codes that should only appear after the form is sent are stripped here. */
export const getLivePopups = cache(async (): Promise<PublicPopup[]> => {
  if (!hasDb()) return [];
  try {
    const sql = await db();
    const r = await sql`
      select * from popups
      where active = true and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at >= now())
      order by priority asc, id desc limit 10`;
    return r
      .map(normPopup)
      .filter((p) => popupStatus(p) === "active")
      .map((p) => {
        const hidden = p.config.couponMode === "after" && !!p.config.coupon;
        return { id: p.id, config: hidden ? { ...p.config, coupon: "" } : p.config, hasHiddenCoupon: hidden };
      });
  } catch (e) {
    console.error("popups read failed", e);
    return [];
  }
});

export async function countPopupEvent(id: number, type: "view" | "click" | "submit") {
  if (!hasDb()) return;
  const sql = await db();
  if (type === "view") await sql`update popups set views = views + 1 where id = ${id}`;
  else if (type === "click") await sql`update popups set clicks = clicks + 1 where id = ${id}`;
  else await sql`update popups set submits = submits + 1 where id = ${id}`;
}

export async function addPopupLead(l: Omit<PopupLead, "id" | "created_at">) {
  const sql = await db();
  await sql`
    insert into popup_leads (popup_id, name, phone, email, message, page)
    values (${l.popup_id}, ${l.name}, ${l.phone}, ${l.email}, ${l.message}, ${l.page})`;
}

export async function listPopupLeads(popupId?: number, limit = 500): Promise<PopupLead[]> {
  if (!hasDb()) return [];
  const sql = await db();
  const r = popupId
    ? await sql`select * from popup_leads where popup_id = ${popupId} order by id desc limit ${limit}`
    : await sql`select * from popup_leads order by id desc limit ${limit}`;
  return r.map((x: any) => ({ ...x, id: Number(x.id), popup_id: Number(x.popup_id), created_at: new Date(x.created_at).toISOString() }));
}

export async function popupLeadCounts(): Promise<Record<number, number>> {
  if (!hasDb()) return {};
  const sql = await db();
  const r = await sql`select popup_id, count(*)::int as n from popup_leads group by popup_id`;
  return Object.fromEntries(r.map((x: any) => [Number(x.popup_id), Number(x.n)]));
}
