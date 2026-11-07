import { currentAdmin, isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { can } from "@/lib/permissions";
import { listProducts } from "@/lib/store";
import { AI_HOURLY_LIMIT, DEFAULT_AI_MODEL, aiConfigured, aiModel } from "@/lib/ai";
import { Icon, PageHeader } from "../_components/ui";
import AiChat from "./AiChat";

export const dynamic = "force-dynamic";
export const metadata = { title: "עוזר AI" };

export default async function AiPage() {
  if (!isAdmin()) return null;
  const me = await currentAdmin();
  const ready = aiConfigured();
  let products: { id: number; name: string }[] = [];
  try {
    products = (await listProducts({ includeInactive: true })).map((p) => ({ id: p.id, name: p.name + (p.active ? "" : " (מוסתר)") }));
  } catch (e) {
    console.error(e);
  }
  const canSaveToProduct = !!me && can(me.perms, "products", "edit") && hasDb();

  return (
    <>
      <PageHeader
        crumbs={[{ href: "/admin", label: "ראשי" }, { label: "עוזר AI" }]}
        title="עוזר AI"
        sub="כתיבת תוכן, רעיונות לקמפיינים וניתוח מכירות – על בסיס הנתונים האמיתיים של החנות"
      />

      {!ready ? (
        <section className="a-card flex flex-col gap-4 max-w-[760px]" aria-labelledby="ai-setup">
          <div className="flex items-center gap-3">
            <span className="w-11 h-11 rounded-xl bg-[#F1EDFD] text-[#5B3FC4] flex items-center justify-center"><Icon name="sparkle" size={22} /></span>
            <div>
              <h2 id="ai-setup" className="text-[18px] font-extrabold text-adm-navy">עוזר ה־AI עדיין לא מחובר</h2>
              <p className="text-[14px] text-adm-muted">אין תשובות מדומות – העוזר יופעל רק אחרי חיבור מפתח אמיתי.</p>
            </div>
          </div>
          <ol className="list-decimal pr-5 flex flex-col gap-2 text-[14px] leading-6">
            <li>פותחים חשבון ב־<span dir="ltr">console.anthropic.com</span>, מוסיפים אמצעי תשלום ויוצרים מפתח API.</li>
            <li>
              ב־Vercel: Project → Settings → Environment Variables, מוסיפים <b dir="ltr" className="font-mono">ANTHROPIC_API_KEY</b> עם המפתח (סביבת Production).
            </li>
            <li>
              לא חובה: <b dir="ltr" className="font-mono">AI_MODEL</b> לבחירת מודל אחר (ברירת מחדל: <span dir="ltr" className="font-mono">{DEFAULT_AI_MODEL}</span>).
            </li>
            <li>פריסה מחדש (Redeploy) – ואז העוזר יהיה זמין כאן ובעורך המוצרים.</li>
          </ol>
          <p className="text-[13px] text-adm-muted">המפתח נשמר בשרת בלבד ולא נשלח לדפדפן. כל משתמש מוגבל ל־{AI_HOURLY_LIMIT} בקשות בשעה.</p>
        </section>
      ) : null}

      <AiChat ready={ready} products={products} canSaveToProduct={canSaveToProduct} model={ready ? aiModel() : ""} limit={AI_HOURLY_LIMIT} />
    </>
  );
}
