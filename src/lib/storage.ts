import { put } from "@vercel/blob";

/* Image storage for product photos.
   Preferred: Supabase Storage (same account as the database) – needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
   Fallback: Vercel Blob – needs BLOB_READ_WRITE_TOKEN.
   The service-role key is used on the server only and never reaches the browser. */

const BUCKET = "products";
const MAX_BYTES = 8 * 1024 * 1024;

/** Legacy service_role keys are JWTs (eyJ…) and go in both headers; new secret keys (sb_secret_…) go in `apikey` only. */
function authHeaders(key: string): Record<string, string> {
  return key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

function supabaseEnv() {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
  return url && key ? { url, key } : null;
}

export function imageStorageReady(): boolean {
  return !!supabaseEnv() || !!process.env.BLOB_READ_WRITE_TOKEN;
}

let bucketChecked = false;

async function ensureBucket(url: string, key: string) {
  if (bucketChecked) return;
  const headers = { ...authHeaders(key), "Content-Type": "application/json" };
  const r = await fetch(`${url}/storage/v1/bucket/${BUCKET}`, { headers, cache: "no-store" });
  if (!r.ok) {
    const c = await fetch(`${url}/storage/v1/bucket`, {
      method: "POST",
      headers,
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true, file_size_limit: MAX_BYTES, allowed_mime_types: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"] }),
    });
    // 409 / "already exists" is fine (race between instances)
    if (!c.ok && c.status !== 409) {
      const t = await c.text();
      if (!/exist/i.test(t)) throw new Error(`Supabase bucket create failed: ${c.status} ${t}`);
    }
  }
  bucketChecked = true;
}

/** Upload one image file and return its public URL. Throws a Hebrew-friendly Error on validation problems. */
export async function uploadProductImage(f: File): Promise<string> {
  if (!String(f.type || "").startsWith("image/")) throw new Error(`הקובץ ${f.name} אינו תמונה`);
  if (f.size > MAX_BYTES) throw new Error(`הקובץ ${f.name} גדול מ־8MB`);
  const safe = f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_").slice(-80);
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;

  const sb = supabaseEnv();
  if (sb) {
    await ensureBucket(sb.url, sb.key);
    const r = await fetch(`${sb.url}/storage/v1/object/${BUCKET}/${path}`, {
      method: "POST",
      headers: { ...authHeaders(sb.key), "Content-Type": f.type, "x-upsert": "false", "cache-control": "31536000" },
      body: Buffer.from(await f.arrayBuffer()),
    });
    if (!r.ok) throw new Error(`Supabase upload failed: ${r.status} ${await r.text()}`);
    return `${sb.url}/storage/v1/object/public/${BUCKET}/${path}`;
  }

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`products/${path}`, f, { access: "public" });
    return blob.url;
  }
  throw new Error("NO_STORAGE");
}
