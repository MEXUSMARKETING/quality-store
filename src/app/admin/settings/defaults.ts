/* Settings shapes, defaults and validators shared by the admin settings page, its server actions,
   the root layout (SEO) and src/components/TrackingScripts.tsx. Pure data – no server imports. */

export type SeoSettings = {
  defaultTitle: string; // home page / fallback title
  titleTemplate: string; // must contain %s
  description: string;
  shareImage: string; // absolute URL or /path
  robotsAllow: boolean;
};

export const SEO_DEFAULTS: SeoSettings = {
  defaultTitle: "Quality טמרה · מגפונים ונעלי נשים",
  titleTemplate: "%s · Quality",
  description: "קולקציית מגפוני חורף במחירים שלא חוזרים. משלוח חינם עד הבית ותשלום במזומן בעת המסירה. Quality טמרה.",
  shareImage: "",
  robotsAllow: true,
};

export type TrackingSettings = { ga4: string; gtm: string; metaPixel: string; tiktokPixel: string };

export const TRACKING_DEFAULTS: TrackingSettings = { ga4: "", gtm: "", metaPixel: "", tiktokPixel: "" };

/** Strict formats – these IDs end up inside inline scripts, so nothing else may pass. */
export const TRACKING_FORMATS: Record<keyof TrackingSettings, { re: RegExp; label: string; example: string }> = {
  ga4: { re: /^G-[A-Z0-9]{4,16}$/, label: "Google Analytics 4 – מזהה מדידה", example: "G-AB12CD34EF" },
  gtm: { re: /^GTM-[A-Z0-9]{4,12}$/, label: "Google Tag Manager – מזהה מאגר", example: "GTM-ABC1234" },
  metaPixel: { re: /^[0-9]{8,20}$/, label: "Meta Pixel (פייסבוק/אינסטגרם) – מזהה פיקסל", example: "123456789012345" },
  tiktokPixel: { re: /^[A-Z0-9]{10,30}$/, label: "TikTok Pixel – מזהה פיקסל", example: "C1A2B3C4D5E6F7G8H9I0" },
};

export function cleanTracking(t: Partial<TrackingSettings> | null | undefined): TrackingSettings {
  const out = { ...TRACKING_DEFAULTS };
  for (const k of Object.keys(TRACKING_FORMATS) as (keyof TrackingSettings)[]) {
    const v = String(t?.[k] || "").trim();
    out[k] = TRACKING_FORMATS[k].re.test(v) ? v : "";
  }
  return out;
}
