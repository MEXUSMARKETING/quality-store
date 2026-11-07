export const STORE = {
  name: "Quality",
  city: "טמרה",
  address: "הרחוב הראשי, כיכר השעון",
  phoneDisplay: "054-2910333",
  whatsapp: "972542910333",
};

export const SIZES = ["35", "36", "37", "38", "39", "40", "41", "42"];

export const COLORS: Record<string, { label: string; hex: string }> = {
  black: { label: "שחור", hex: "#141414" },
  brown: { label: "חום / קוניאק", hex: "#8A4B2E" },
  blue: { label: "כחול כהה", hex: "#2C3E5C" },
  other: { label: "אחר", hex: "#BDB9AF" },
};

export const CATEGORIES: Record<string, string> = {
  boots: "מגפונים",
  heels: "נעלי עקב",
  jewelry: "תכשיטים ואקססוריז",
  bags: "תיקים וארנקים",
};

export const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  new: { label: "חדשה", color: "#1F5FD6" },
  confirmed: { label: "אושרה", color: "#2C6BB0" },
  packed: { label: "נארזה", color: "#5B3FC4" },
  shipped: { label: "נשלחה", color: "#1B6A9A" },
  delivered: { label: "נמסרה", color: "#0F7A57" },
  cancelled: { label: "בוטלה", color: "#B03A3A" },
  returned: { label: "הוחזרה", color: "#8A5A00" },
};

/** Order of statuses in the admin pipeline */
export const ORDER_FLOW = ["new", "confirmed", "packed", "shipped", "delivered"];

export const PAYMENT_STATUS: Record<string, { label: string; color: string }> = {
  pending: { label: "ממתין לתשלום", color: "#8A5A00" },
  paid: { label: "שולם", color: "#0F7A57" },
  failed: { label: "נכשל", color: "#B03A3A" },
  partially_refunded: { label: "הוחזר חלקית", color: "#5B3FC4" },
  refunded: { label: "הוחזר", color: "#3B475C" },
};

export const SHIPPING: Record<string, string> = {
  home: "משלוח עד הבית",
  pickup: "איסוף מהחנות בטמרה",
};

export const PAYMENT: Record<string, string> = {
  cash: "מזומן בעת המסירה",
  card: "כרטיס אשראי (טלפונית)",
  bit: "Bit",
};

export const shekel = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");

export const waLink = (text: string, phone: string = STORE.whatsapp) =>
  `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
