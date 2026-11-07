import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getSetting } from "@/lib/site";
import TrackingScripts from "@/components/TrackingScripts";
import { SEO_DEFAULTS, type SeoSettings } from "@/app/admin/settings/defaults";

/** Site-wide SEO from /admin/settings → SEO, with today's hard-coded values as the fallback. */
export async function generateMetadata(): Promise<Metadata> {
  let seo: SeoSettings = SEO_DEFAULTS;
  try {
    seo = await getSetting<SeoSettings>("seo", SEO_DEFAULTS);
  } catch {
    seo = SEO_DEFAULTS;
  }
  const title = String(seo.defaultTitle || "").trim() || SEO_DEFAULTS.defaultTitle;
  const template = String(seo.titleTemplate || "").includes("%s") ? seo.titleTemplate : SEO_DEFAULTS.titleTemplate;
  const description = String(seo.description || "").trim() || SEO_DEFAULTS.description;
  const image = String(seo.shareImage || "").trim();
  const meta: Metadata = {
    title: { default: title, template },
    description,
    openGraph: { title, description, type: "website", locale: "he_IL", ...(image ? { images: [{ url: image }] } : {}) },
  };
  if (seo.robotsAllow === false) meta.robots = { index: false, follow: false };
  return meta;
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0E0E0E",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;700&family=Rubik:wght@500;700;800&family=Playfair+Display:wght@700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        {children}
        <TrackingScripts />
      </body>
    </html>
  );
}
