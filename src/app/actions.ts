"use server";

import { hasDb } from "@/lib/db";
import { addClubMember, createOrder, getProductById } from "@/lib/store";
import { checkCoupon } from "@/lib/admin";
import { priceCartRows } from "@/lib/promotions";
import { getAttributes } from "@/lib/catalog";
import { imagesFor, lineKey, unitsFor } from "@/lib/variants";
import type { CartItem, OrderItem } from "@/lib/types";
import { PAYMENT, SHIPPING, STORE, shekel, waLink } from "@/lib/config";

export type ActionResult = { ok: boolean; error?: string; number?: string; whatsapp?: string };

export type CouponCheck = { ok: boolean; code?: string; discount?: number; label?: string; error?: string };

/** Storefront: validate a coupon code against the current cart subtotal (display only; placeOrder re-validates). */
export async function checkCouponAction(code: string, subtotal: number, phone: string): Promise<CouponCheck> {
  const c = String(code || "").trim().toUpperCase().slice(0, 32);
  if (!c) return { ok: false, error: "נא להזין קוד קופון" };
  if (!hasDb()) return { ok: false, error: "לא ניתן להשתמש בקופון כרגע" };
  try {
    const r = await checkCoupon(c, Math.max(0, Math.round(Number(subtotal) || 0)), String(phone || "").slice(0, 30));
    if (r.error || !r.coupon) return { ok: false, error: r.error || "קוד הקופון לא קיים" };
    if (!r.discount) return { ok: false, error: "הקופון לא מקנה הנחה על הסל הזה" };
    const label = r.coupon.type === "fixed" ? `${shekel(r.coupon.value)} הנחה` : `${r.coupon.value}% הנחה`;
    return { ok: true, code: r.coupon.code.toUpperCase(), discount: r.discount, label };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "לא הצלחנו לבדוק את הקופון, נסי שוב" };
  }
}

export type CartPricing = {
  ok: boolean;
  subtotal: number;
  discount: number;
  total: number;
  applied: { id: number; name: string; badge: string; discount: number }[];
  lines: Record<string, number>;
  allowCoupon: boolean;
  hints: string[];
};

/** Storefront: price the cart with the running promotions (display; placeOrder recomputes). */
export async function priceCartAction(rows: { productId: number; size: string; color?: string; qty: number }[]): Promise<CartPricing> {
  const empty: CartPricing = { ok: false, subtotal: 0, discount: 0, total: 0, applied: [], lines: {}, allowCoupon: true, hints: [] };
  if (!hasDb() || !Array.isArray(rows) || !rows.length) return empty;
  try {
    const r = await priceCartRows(rows.slice(0, 30).map((x) => ({ productId: Number(x?.productId), size: String(x?.size ?? ""), color: x?.color ? String(x.color) : undefined, qty: Number(x?.qty) })));
    return { ok: true, subtotal: r.subtotal, discount: r.discount, total: r.total, applied: r.applied, lines: r.lines, allowCoupon: r.allowCoupon, hints: r.hints };
  } catch (e) {
    console.error("priceCart failed", e);
    return empty;
  }
}

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
  const couponCode = clean(fd.get("coupon"), 32).toUpperCase();

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
  const colorNames: Record<string, string> = hasDb() ? Object.fromEntries((await getAttributes().catch(() => ({ colors: [] as { key: string; label: string }[] }))).colors.map((c) => [c.key, c.label])) : {};
  for (const c of cart.slice(0, 30)) {
    const p = await getProductById(Number(c.productId));
    const qty = Math.max(1, Math.min(9, Number(c.qty) || 1));
    const size = String(c.size);
    if (!p || !p.active) return { ok: false, error: `המוצר "${c.name}" כבר לא זמין` };
    // variant products: the colour must be one of the product's colours
    const color = p.variants ? (c.color && p.variants.colors.some((x) => x.key === c.color) ? String(c.color) : null) : null;
    if (p.variants && !color) return { ok: false, error: `יש לבחור צבע ל"${p.name}". הסירי אותו מהסל והוסיפי שוב.` };
    const colorName = color ? colorNames[color] || color : "";
    const what = `"${p.name}"${colorName ? ` ב${colorName}` : ""} במידה ${size}`;
    const inStock = unitsFor(p, size, color);
    if (inStock < qty) {
      return { ok: false, error: inStock > 0 ? `נשארו רק ${inStock} זוגות של ${what}` : `${what} אזל מהמלאי` };
    }
    items.push({ productId: p.id, slug: p.slug, name: p.name, image: imagesFor(p, color)[0] || "", size, ...(color ? { color, colorName } : {}), qty, price: p.price });
  }
  const subtotal = items.reduce((a, x) => a + x.price * x.qty, 0);

  // Automatic promotions, computed from the catalogue (never from the browser)
  let promo_discount = 0;
  let promotions: { id: number; name: string; badge: string; discount: number }[] = [];
  let allowCoupon = true;
  if (hasDb()) {
    try {
      const pr = await priceCartRows(items.map((x) => ({ productId: x.productId, size: x.size, color: x.color, qty: x.qty })));
      promo_discount = Math.max(0, Math.min(subtotal, pr.discount));
      promotions = pr.applied;
      allowCoupon = pr.allowCoupon;
      for (const it of items) {
        const d = pr.lines[lineKey(it.productId, it.size, it.color)];
        if (d) it.discount = d;
      }
    } catch (e) {
      console.error("promotions at checkout failed", e); // sell at regular prices rather than fail the order
    }
  }
  const afterPromo = subtotal - promo_discount;

  // Coupon: never trust the client – validate again against the recomputed (post-promotion) amount
  let discount = 0;
  let coupon_code = "";
  if (couponCode) {
    if (!hasDb()) return { ok: false, error: "לא ניתן להשתמש בקופון כרגע. הסירי את הקופון כדי להמשיך." };
    if (!allowCoupon) return { ok: false, error: `המבצע בסל לא מצטבר עם קופונים. הסירי את הקופון ${couponCode} כדי להמשיך.` };
    const r = await checkCoupon(couponCode, afterPromo, phone);
    if (r.error || !r.coupon) return { ok: false, error: `קופון ${couponCode}: ${r.error || "הקוד לא תקין"}. הסירי אותו או נסי קוד אחר.` };
    discount = Math.max(0, Math.min(afterPromo, Math.round(r.discount || 0)));
    coupon_code = discount > 0 ? r.coupon.code.toUpperCase() : "";
  }
  const total = afterPromo - discount;

  const summary =
    `הזמנה חדשה מהאתר\n` +
    items.map((x) => `• ${x.name}${x.colorName ? ` | ${x.colorName}` : ""} | מידה ${x.size} | ×${x.qty} | ${shekel(x.price * x.qty)}`).join("\n") +
    (promo_discount || discount ? `\nסכום ביניים: ${shekel(subtotal)}` : "") +
    promotions.map((p) => `\nמבצע ${p.badge || p.name}: -${shekel(p.discount)}`).join("") +
    (discount ? `\nקופון ${coupon_code}: -${shekel(discount)}` : "") +
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
      discount,
      coupon_code,
      promo_discount,
      promotions,
    });
    return { ok: true, number, whatsapp: waLink(`${summary}\n\nמספר הזמנה: ${number}`) };
  } catch (e) {
    console.error(e);
    return { ok: false, error: `לא הצלחנו לשמור את ההזמנה. אפשר להזמין בוואטסאפ ${STORE.phoneDisplay}` };
  }
}
