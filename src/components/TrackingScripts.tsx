import Script from "next/script";
import { headers } from "next/headers";
import { getSetting } from "@/lib/site";
import { TRACKING_DEFAULTS, cleanTracking, type TrackingSettings } from "@/app/admin/settings/defaults";

/* Storefront analytics / pixels, configured in /admin/settings → "קוד מעקב".
   Renders nothing unless an ID is set, never runs inside the admin, and never throws
   (a settings/DB problem must not break the live store). IDs are re-validated against strict
   formats here, so only [A-Z0-9-] can ever reach the inline scripts. */
export default async function TrackingScripts() {
  // Outside try/catch on purpose: headers() opts the render into dynamic mode and Next must see that.
  if (headers().get("x-admin-path")) return null; // set by middleware for /admin only
  let t: TrackingSettings = TRACKING_DEFAULTS;
  try {
    t = cleanTracking(await getSetting<TrackingSettings>("tracking", TRACKING_DEFAULTS));
  } catch {
    return null;
  }
  if (!t.ga4 && !t.gtm && !t.metaPixel && !t.tiktokPixel) return null;

  return (
    <>
      {t.gtm && (
        <>
          <Script id="q-gtm" strategy="afterInteractive">
            {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${t.gtm}');`}
          </Script>
          <noscript>
            <iframe src={`https://www.googletagmanager.com/ns.html?id=${t.gtm}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} title="Google Tag Manager" />
          </noscript>
        </>
      )}

      {t.ga4 && (
        <>
          <Script id="q-ga4-src" src={`https://www.googletagmanager.com/gtag/js?id=${t.ga4}`} strategy="afterInteractive" />
          <Script id="q-ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${t.ga4}');`}
          </Script>
        </>
      )}

      {t.metaPixel && (
        <>
          <Script id="q-meta-pixel" strategy="afterInteractive">
            {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${t.metaPixel}');fbq('track','PageView');`}
          </Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img height="1" width="1" style={{ display: "none" }} alt="" src={`https://www.facebook.com/tr?id=${t.metaPixel}&ev=PageView&noscript=1`} />
          </noscript>
        </>
      )}

      {t.tiktokPixel && (
        <Script id="q-tiktok-pixel" strategy="afterInteractive">
          {`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${t.tiktokPixel}');ttq.page();}(window,document,'ttq');`}
        </Script>
      )}
    </>
  );
}
