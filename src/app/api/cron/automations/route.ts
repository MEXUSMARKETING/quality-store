import crypto from "crypto";
import { runCron } from "@/lib/automations";

/* Daily automations cron (vercel.json "crons"). Vercel sends `Authorization: Bearer ${CRON_SECRET}`.
   Without CRON_SECRET the endpoint refuses to run. */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = String(process.env.CRON_SECRET || "");
  if (!secret) return false;
  const got = Buffer.from(req.headers.get("authorization") || "");
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

async function handle(req: Request) {
  if (!process.env.CRON_SECRET) return Response.json({ ok: false, error: "CRON_SECRET is not set" }, { status: 503 });
  if (!authorized(req)) return Response.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const force = new URL(req.url).searchParams.get("force") === "1";
  try {
    const summary = await runCron({ force, deadline: Date.now() + 50_000 });
    return Response.json({ ok: true, ...summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    console.error("cron automations failed", e);
    return Response.json({ ok: false, error: String(e?.message || e).slice(0, 200) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
