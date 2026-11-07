import { cache } from "react";
import { db, hasDb } from "./db";
import { STORE } from "./config";

/* Site-wide settings stored in the `settings` table as JSON, one row per key.
   Every getter has a fallback, so the storefront keeps working without a DB or before
   anything was saved in the admin. Reads are de-duplicated per request with React cache. */

const readAll = cache(async (): Promise<Record<string, unknown>> => {
  if (!hasDb()) return {};
  try {
    const sql = await db();
    const rows = await sql`select key, value from settings`;
    const out: Record<string, unknown> = {};
    for (const r of rows) out[r.key] = typeof r.value === "string" ? JSON.parse(r.value) : r.value;
    return out;
  } catch (e) {
    console.error("settings read failed", e);
    return {};
  }
});

/** Read one settings key. Objects are shallow-merged over the fallback so new fields get defaults. */
export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const all = await readAll();
  const v = all[key];
  if (v === undefined || v === null) return fallback;
  if (fallback && typeof fallback === "object" && !Array.isArray(fallback) && typeof v === "object" && !Array.isArray(v)) {
    return { ...(fallback as object), ...(v as object) } as T;
  }
  return v as T;
}

/** Write one settings key (server actions only — callers must check permissions first). */
export async function setSetting(key: string, value: unknown) {
  const sql = await db();
  await sql`
    insert into settings (key, value, updated_at) values (${key}, ${JSON.stringify(value)}::jsonb, now())
    on conflict (key) do update set value = excluded.value, updated_at = now()`;
}

/* ---------------- store details (used by header, footer, checkout, WhatsApp links) ---------------- */

export type StoreInfo = {
  name: string;
  city: string;
  address: string;
  phoneDisplay: string;
  whatsapp: string; // international digits, e.g. 972542910333
  email: string;
  hours: string;
  instagram: string;
  facebook: string;
  tiktok: string;
};

export const STORE_DEFAULTS: StoreInfo = {
  ...STORE,
  email: "",
  hours: "",
  instagram: "",
  facebook: "",
  tiktok: "",
};

export const getStoreInfo = cache(() => getSetting<StoreInfo>("store", STORE_DEFAULTS));
