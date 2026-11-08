import Link from "next/link";
import { headers } from "next/headers";
import { currentAdmin, isAdmin } from "@/lib/auth";
import { hasDb } from "@/lib/db";
import { can } from "@/lib/permissions";
import { STORE_DEFAULTS, getSetting, type StoreInfo } from "@/lib/site";
import { imageStorageReady } from "@/lib/storage";
import { Chip, Icon, Notice, PageHeader, type ICONS } from "../_components/ui";
import { SEO_DEFAULTS, TRACKING_DEFAULTS, type SeoSettings, type TrackingSettings } from "./defaults";
import { SeoForm, StoreForm, TrackingForm } from "./SettingsForms";

export const dynamic = "force-dynamic";
export const metadata = { title: "הגדרות מערכת" };

const SECTIONS: { key: string; label: string; icon: keyof typeof ICONS }[] = [
  { key: "store", label: "פרטי החנות", icon: "home" },
  { key: "seo", label: "SEO", icon: "search" },
  { key: "tracking", label: "קוד מעקב", icon: "chart" },
  { key: "integrations", label: "אינטגרציות", icon: "link" },
  { key: "security", label: "אבטחה", icon: "lock" },
];

type Integration = { title: string; ok: boolean; okText: string; missingText: string; env: string[]; note?: string; na?: boolean };

const env = (k: string) => !!process.env[k];

function integrations(): Integration[] {
  return [
    { title: "מסד נתונים", ok: hasDb(), okText: "מחובר", missingText: "לא מחובר – הזמנות ושינויים לא נשמרים", env: ["DATABASE_URL", "POSTGRES_URL"], note: "חיבור Supabase/Postgres. מספיק אחד מהשניים." },
    { title: "אחסון תמונות", ok: imageStorageReady(), okText: env("SUPABASE_SERVICE_ROLE_KEY") || env("SUPABASE_SECRET_KEY") ? "Supabase Storage" : "Vercel Blob", missingText: "לא מחובר – אפשר רק להדביק קישורים לתמונות", env: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY", "BLOB_READ_WRITE_TOKEN"], note: "SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (או SUPABASE_SECRET_KEY), או לחלופין BLOB_READ_WRITE_TOKEN." },
    { title: "שליחת אימיילים", ok: env("RESEND_API_KEY"), okText: "מוגדר", missingText: "לא מחובר – לא נשלחים מיילים ללקוחות", env: ["RESEND_API_KEY"], note: "מפתח API של Resend." },
    { title: "WhatsApp Business API", ok: env("WHATSAPP_TOKEN"), okText: "מוגדר", missingText: "לא מחובר – הודעות נשלחות ידנית בקישור wa.me", env: ["WHATSAPP_TOKEN"], note: "טוקן של WhatsApp Cloud API (Meta)." },
    { title: "עוזר AI", ok: env("ANTHROPIC_API_KEY"), okText: `מחובר · ${process.env.AI_MODEL || "claude-sonnet-4-5"}`, missingText: "לא מחובר", env: ["ANTHROPIC_API_KEY", "AI_MODEL"], note: "מפתח Anthropic. AI_MODEL לא חובה." },
    { title: "משימות מתוזמנות (Cron)", ok: env("CRON_SECRET"), okText: "מוגדר", missingText: "לא מוגדר – אוטומציות מתוזמנות לא ירוצו", env: ["CRON_SECRET"], note: "מחרוזת סודית אקראית שמגנה על נתיבי ה־cron." },
    { title: "תשלומים אונליין", ok: false, na: true, okText: "", missingText: "אין סליקה באתר – תשלום מתבצע במזומן/Bit/טלפונית", env: [] },
    { title: "חשבוניות", ok: false, na: true, okText: "", missingText: "אין חיבור למערכת חשבוניות – מפיקים ידנית", env: [] },
  ];
}

export default async function SettingsPage({ searchParams }: { searchParams: { section?: string } }) {
  if (!isAdmin()) return null;
  const me = await currentAdmin();
  if (!me) return null;
  const canEdit = can(me.perms, "settings", "edit") && hasDb();
  const section = SECTIONS.some((s) => s.key === searchParams.section) ? searchParams.section! : "store";
  const host = headers().get("host") || "quality-store";

  const [store, seo, tracking] = await Promise.all([
    getSetting<StoreInfo>("store", STORE_DEFAULTS),
    getSetting<SeoSettings>("seo", SEO_DEFAULTS),
    getSetting<TrackingSettings>("tracking", TRACKING_DEFAULTS),
  ]);

  return (
    <>
      <PageHeader crumbs={[{ href: "/admin", label: "ראשי" }, { label: "הגדרות מערכת" }]} title="הגדרות מערכת" sub="פרטי החנות, SEO, קודי מעקב וחיבורים" />
      {!can(me.perms, "settings", "edit") && <Notice tone="blue">יש לך הרשאת צפייה בלבד בהגדרות.</Notice>}

      <div className="grid md:grid-cols-[220px_1fr] gap-4 items-start">
        <nav aria-label="חלקי ההגדרות" className="a-card !p-2 flex md:flex-col gap-1 overflow-x-auto no-scrollbar md:sticky md:top-[84px]">
          {SECTIONS.map((s) => (
            <Link
              key={s.key}
              href={`/admin/settings?section=${s.key}`}
              aria-current={section === s.key ? "page" : undefined}
              className={`flex items-center gap-2.5 min-h-[40px] px-3 rounded-[9px] text-[14px] whitespace-nowrap ${section === s.key ? "bg-[#F1ECFF] text-adm-navy font-bold" : "text-adm-text hover:bg-adm-bg"}`}
            >
              <Icon name={s.icon} size={17} /> {s.label}
            </Link>
          ))}
        </nav>

        <div className="min-w-0 flex flex-col gap-4">
          {section === "store" && <StoreForm v={store} canEdit={canEdit} />}
          {section === "seo" && <SeoForm v={seo} canEdit={canEdit} storageReady={imageStorageReady()} host={host} />}
          {section === "tracking" && <TrackingForm v={tracking} canEdit={canEdit} />}

          {section === "integrations" && (
            <>
              <p className="text-[14px] text-adm-muted">המצב מחושב לפי משתני הסביבה ב־Vercel (Project → Settings → Environment Variables). הערכים עצמם לא מוצגים כאן אף פעם. אחרי הוספת משתנה יש לבצע Redeploy.</p>
              <div className="grid sm:grid-cols-2 gap-3.5">
                {integrations().map((it) => (
                  <section key={it.title} className="a-card flex flex-col gap-2.5" aria-label={it.title}>
                    <div className="flex items-center justify-between gap-2">
                      <b className="text-[15px] text-adm-navy">{it.title}</b>
                      {it.na ? <Chip tone="gray">לא בשימוש</Chip> : it.ok ? <Chip tone="green">מחובר</Chip> : <Chip tone="amber">לא מחובר</Chip>}
                    </div>
                    <p className="text-[13px] text-adm-text">{it.ok ? it.okText : it.missingText}</p>
                    {it.env.length > 0 && (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[12px] text-adm-muted">{it.note}</span>
                        <span className="flex flex-wrap gap-1.5">
                          {it.env.map((k) => (
                            <span key={k} dir="ltr" className={`a-chip font-mono !font-semibold ${env(k) ? "bg-[#E6F6F0] text-[#0F7A57]" : "bg-[#F0EEF6] text-[#3D3858]"}`}>
                              {env(k) ? "✓ " : ""}{k}
                            </span>
                          ))}
                        </span>
                      </div>
                    )}
                  </section>
                ))}
              </div>
            </>
          )}

          {section === "security" && (
            <div className="flex flex-col gap-4">
              <section className="a-card flex flex-col gap-3">
                <h2 className="text-[16px] font-bold text-adm-navy">התחברות וסשן</h2>
                <ul className="list-disc pr-5 text-[14px] leading-7">
                  <li>חיבור למערכת הניהול נשמר <b>14 יום</b> בעוגייה מוצפנת (HttpOnly) ואז נדרשת כניסה מחדש.</li>
                  <li>כל פעולה נבדקת בשרת מול ההרשאות העדכניות. משתמש מושבת מנותק מיד.</li>
                  <li>כל כניסה (מוצלחת או כושלת) נרשמת ב<Link href="/admin/users?tab=history" className="text-adm-link underline">היסטוריית ההתחברות</Link>, וכל שינוי נרשם ב<Link href="/admin/activity" className="text-adm-link underline">יומן הפעילות</Link>.</li>
                </ul>
              </section>
              <section className="a-card flex flex-col gap-3">
                <h2 className="text-[16px] font-bold text-adm-navy">החלפת סיסמת המנהל הראשי</h2>
                <ol className="list-decimal pr-5 text-[14px] leading-7">
                  <li>ב־Vercel: Project → Settings → Environment Variables.</li>
                  <li>עורכים את <b dir="ltr" className="font-mono">ADMIN_PASSWORD</b> לסיסמה חדשה וחזקה (לפחות 14 תווים).</li>
                  <li>Deployments → Redeploy. אחרי הפריסה כל החיבורים הקיימים (כולל של הצוות) מתנתקים וצריך להתחבר מחדש.</li>
                </ol>
                <p className="text-[13px] text-adm-muted">לא חובה: <span dir="ltr" className="font-mono">SESSION_SECRET</span> – מחרוזת אקראית נוספת לחתימת החיבורים. שינוי שלה מנתק את כולם.</p>
              </section>
              <section className="a-card flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col">
                  <b className="text-[15px] text-adm-navy">חברי צוות והרשאות</b>
                  <span className="text-[13px] text-adm-muted">לכל עובד כדאי משתמש משלו עם ההרשאות שהוא צריך בלבד – במקום לשתף את סיסמת המנהל.</span>
                </div>
                <Link href="/admin/users" className="a-btn"><Icon name="shield" size={16} /> משתמשים והרשאות</Link>
              </section>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
