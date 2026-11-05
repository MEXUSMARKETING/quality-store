import { CartProvider } from "@/components/CartProvider";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { STORE, waLink } from "@/lib/config";
import { WhatsAppIcon } from "@/components/Icons";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      <Header />
      <main className="min-h-[60vh]">{children}</main>
      <Footer />
      <a
        href={waLink("שלום, אשמח לעזרה")}
        target="_blank"
        rel="noopener"
        aria-label={`וואטסאפ ${STORE.phoneDisplay}`}
        className="fixed bottom-5 left-5 z-40 w-14 h-14 rounded-full bg-[#1F8A4C] text-white flex items-center justify-center shadow-lg hover:text-white"
      >
        <WhatsAppIcon size={26} />
      </a>
    </CartProvider>
  );
}
