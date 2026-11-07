import { CartProvider } from "@/components/CartProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { STORE, waLink } from "@/lib/config";
import { getStoreInfo, STORE_DEFAULTS, type StoreInfo } from "@/lib/site";
import { defaultMenus, getMenus, resolveMenus, type Menus } from "@/lib/content";
import { WhatsAppIcon } from "@/components/Icons";

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
      <Header menus={resolved} store={shopStore} />
      <main className="min-h-[60vh]">{children}</main>
      <Footer menus={resolved} store={shopStore} />
      <a
        href={waLink("שלום, אשמח לעזרה", wa)}
        target="_blank"
        rel="noopener"
        aria-label={`וואטסאפ ${phone}`}
        className="fixed bottom-5 left-5 z-40 w-14 h-14 rounded-full bg-[#1F8A4C] text-white flex items-center justify-center shadow-lg hover:text-white"
      >
        <WhatsAppIcon size={26} />
      </a>
    </CartProvider>
  );
}
