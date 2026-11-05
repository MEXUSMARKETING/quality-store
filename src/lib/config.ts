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
  jewelry: "תכשיטים ואקססוריז",
  bags: "תיקים וארנקים",
};

export const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  new: { label: "חדשה", color: "#C9A24A" },
  confirmed: { label: "אושרה", color: "#2C6BB0" },
  shipped: { label: "נשלחה", color: "#6B4FA0" },
  delivered: { label: "נמסרה", color: "#2F7A3A" },
  cancelled: { label: "בוטלה", color: "#A13A0D" },
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
