"use server";

import { hasDb } from "@/lib/db";
import { addClubMember, createOrder, getProductById } from "@/lib/store";
import type { CartItem, OrderItem } from "@/lib/types";
import { PAYMENT, SHIPPING, STORE, shekel, waLink } from "@/lib/config";

export type ActionResult = { ok: boolean; error?: string; number?: string; whatsapp?: string };

const clean = (v: FormDataEntryValue | null, max = 200) => String(v ?? "").trim().slice(0, max);

export async function joinClub(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const name = clean(fd.get("name"), 80);
  const phone = clean(fd.get("phone"), 30);
  const email = clean(fd.get("email"), 120);
  if (!name || phone.replace(/\D/g, "").length < 9) return { ok: false, error: "נא למלא שם ומספר טלפון תקין" };
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "כתובת המייל לא תקינה" };
  if (!hasDb()) {
    return { ok: true, whatsapp: waLink(`שלום, אשמח להצטרף למועדון הלקוחות.\nשם: ${name}\nטלפון: ${phone}\nמייל: ${email}`) };
  }
  try {
    await addClubMember({ name, phone, email });
    return { ok: true };
  } catch {
    return { ok: false, error: "משהו השתבש, נסי שוב" };
  }
}

export async function placeOrder(_: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const name = clean(fd.get("name"), 80);
  const phone = clean(fd.get("phone"), 30);
  const email = clean(fd.get("email"), 120);
  const shipping = clean(fd.get("shipping"), 20) || "home";
  const payment = clean(fd.get("payment"), 20) || "cash";
  const city = clean(fd.get("city"), 80);
  const street = clean(fd.get("street"), 120);
  const apt = clean(fd.get("apt"), 40);
  const notes = clean(fd.get("notes"), 400);
  const terms = fd.get("terms");

  let cart: CartItem[] = [];
  try {
    cart = JSON.parse(String(fd.get("cart") || "[]"));
  } catch {}

  if (!cart.length) return { ok: false, error: "הסל ריק" };
  if (!name) return { ok: false, error: "נא למלא שם מלא" };
  if (phone.replace(/\D/g, "").length < 9) return { ok: false, error: "נא למלא מספר טלפון תקין" };
  if (!SHIPPING[shipping]) return { ok: false, error: "שיטת משלוח לא תקינה" };
  if (!PAYMENT[payment]) return { ok: false, error: "אמצעי תשלום לא תקין" };
  if (shipping === "home" && (!city || !street)) return { ok: false, error: "נא למלא עיר ורחוב למשלוח" };
  if (!terms) return { ok: false, error: "יש לאשר את תקנון האתר" };

  // Recompute everything from the catalogue so prices can't be changed in the browser
  const items: OrderItem[] = [];
  for (const c of cart.slice(0, 30)) {
    const p = await getProductById(Number(c.productId));
    const qty = Math.max(1, Math.min(9, Number(c.qty) || 1));
    const size = String(c.size);
    if (!p || !p.active) return { ok: false, error: `המוצר "${c.name}" כבר לא זמין` };
    const inStock = Number(p.stock?.[size] || 0);
    if (inStock < qty) {
      return { ok: false, error: inStock > 0 ? `נשארו רק ${inStock} זוגות של "${p.name}" במידה ${size}` : `"${p.name}" במידה ${size} אזל מהמלאי` };
    }
    items.push({ productId: p.id, slug: p.slug, name: p.name, image: p.images[0] || "", size, qty, price: p.price });
  }
  const subtotal = items.reduce((a, x) => a + x.price * x.qty, 0);
  const total = subtotal;

  const summary =
    `הזמנה חדשה מהאתר\n` +
    items.map((x) => `• ${x.name} | מידה ${x.size} | ×${x.qty} | ${shekel(x.price * x.qty)}`).join("\n") +
    `\nסה״כ: ${shekel(total)}\n\nשם: ${name}\nטלפון: ${phone}` +
    (shipping === "home" ? `\nכתובת: ${street}${apt ? " " + apt : ""}, ${city}` : `\nאיסוף מהחנות`) +
    `\nתשלום: ${PAYMENT[payment]}` +
    (notes ? `\nהערות: ${notes}` : "");

  if (!hasDb()) {
    return { ok: true, whatsapp: waLink(summary) };
  }

  try {
    const number = await createOrder({
      customer_name: name,
      phone,
      email,
      city,
      street,
      apt,
      notes,
      shipping_method: shipping,
      payment_method: payment,
      items,
      subtotal,
      total,
    });
    return { ok: true, number, whatsapp: waLink(`${summary}\n\nמספר הזמנה: ${number}`) };
  } catch (e) {
    console.error(e);
    return { ok: false, error: `לא הצלחנו לשמור את ההזמנה. אפשר להזמין בוואטסאפ ${STORE.phoneDisplay}` };
  }
}
