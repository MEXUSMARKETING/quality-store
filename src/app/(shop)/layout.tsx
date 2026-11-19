import { CartProvider } from "@/components/CartProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { STORE, waLink } from "@/lib/config";
import { getStoreInfo, STORE_DEFAULTS, type StoreInfo } from "@/lib/site";
import { defaultMenus, getMenus, resolveMenus, type Menus } from "@/lib/content";
import { WhatsAppIcon } from "@/components/Icons";
import PopupHost from "@/components/popup/PopupHost";
import { getLivePopups, type PublicPopup } from "@/lib/popups";

/** a storefront page should never wait minutes; reads fall back to defaults well before this */
export const maxDuration = 30;

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  // Admin-managed menus and store details; any failure falls back to today's built-in content.
  let store: StoreInfo = STORE_DEFAULTS;
  let menus: Menus = defaultMenus();
  try {
    store = await getStoreInfo();
  } catch (e) {
    console.error("store info failed", e);
  }
  try {
    menus = await getMenus();
  } catch (e) {
    console.error("menus failed", e);
  }
  let popups: PublicPopup[] = [];
  try {
    popups = await getLivePopups();
  } catch (e) {
    console.error("popups failed", e);
  }
  const wa = store.whatsapp || STORE.whatsapp;
  const phone = store.phoneDisplay || STORE.phoneDisplay;
  const resolved = resolveMenus(menus, wa);
  const shopStore = {
    name: store.name || STORE.name,
    city: store.city || STORE.city,
    address: store.address || STORE.address,
    phoneDisplay: phone,
    whatsapp: wa,
  };

  return (
    <CartProvider>
      <a href="#main-content" className="skip-link">דילוג לתוכן</a>
      <Header menus={resolved} store={shopStore} />
      <main id="main-content" tabIndex={-1} className="min-h-[60vh]">{children}</main>
      <Footer menus={resolved} store={shopStore} />
      <PopupHost popups={popups} />
      <a
        href={waLink("שלום, אשמח לעזרה", wa)}
        target="_blank"
        rel="noopener"
        aria-label={`וואטסאפ ${phone}`}
        className="wa-fab fixed bottom-4 left-4 md:bottom-5 md:left-5 z-40 w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#1F8A4C] text-white flex items-center justify-center shadow-lg hover:text-white"
      >
        <span className="md:hidden"><WhatsAppIcon size={22} /></span>
        <span className="hidden md:inline"><WhatsAppIcon size={26} /></span>
      </a>
    </CartProvider>
  );
}
