"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { db, hasDb } from "@/lib/db";
import { addOrderEvent, audit } from "@/lib/admin";
import { createOrder, getProductById } from "@/lib/store";
import { changeOrderStatus, normIsraeliMobile } from "@/lib/admin-orders";
import { runAutomationsSafe } from "@/lib/automations";
import { ORDER_STATUS, PAYMENT, PAYMENT_STATUS, SHIPPING } from "@/lib/config";
import type { OrderItem } from "@/lib/types";

export type ActionResult = { ok?: boolean; error?: string; message?: string } | null;

const LABELS: Record<string, string> = Object.fromEntries(Object.entries(ORDER_STATUS).map(([k, v]) => [k, v.label]));
const PAY_LABELS: Record<string, string> = Object.fromEntries(Object.entries(PAYMENT_STATUS).map(([k, v]) => [k, v.label]));
const str = (v: FormDataEntryValue | null, max = 500) => String(v ?? "").trim().slice(0, max);
const intId = (v: FormDataEntryValue | null) => {
  const n = Number(String(v ?? ""));
  return Number.isInteger(n) && n > 0 ? n : null;
};

function refresh(id?: number) {
  revalidatePath("/admin", "layout");
  if (id) revalidatePath(`/admin/orders/${id}`);
}

/** Legacy signature kept for any old form: id + status */
export async function setOrderStatusAction(fd: FormData) {
  await requireAdmin("orders");
  const id = intId(fd.get("id"));
  const status = str(fd.get("status"));
  if (!id || !ORDER_STATUS[status] || !hasDb()) return;
  const r = await changeOrderStatus(id, status, { labels: LABELS });
  if (r && r.before !== status) {
    await audit({ action: "status", entity: "order", entityId: id, summary: `סטטוס הזמנה #${id}: ${LABELS[r.before] || r.before} ← ${LABELS[status]}`, before: { status: r.before }, after: { status } });
    await runAutomationsSafe({ type: "order_status_changed", orderId: id, status, before: r.before });
  }
  refresh(id);
}

export async function updateOrderStatusAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin("orders");
  if (!hasDb()) return { error: "מסד הנתונים לא מחובר" };
  const id = intId(fd.get("id"));
  const status = str(fd.get("status"));
  const note = str(fd.get("note"), 300);
  const restock = fd.get("restock") === "on";
  if (!id) return { error: "הזמנה לא תקינה" };
  if (!ORDER_STATUS[status]) return { error: "יש לבחור סטטוס" };
  try {
    const r = await changeOrderStatus(id, status, { note, restock, labels: LABELS });
    if (!r) return { error: "ההזמנה לא נמצאה" };
    if (r.before === status && !note && !r.restocked) return { ok: true, message: "לא בוצע שינוי – זה כבר הסטטוס הנוכחי" };
    const sql = await db();
    const [{ number }] = await sql`select number from orders where id = ${id}`;
    await audit({
      action: "status",
      entity: "order",
      entityId: id,
      summary: `הזמנה ${number}: ${LABELS[r.before] || r.before} ← ${LABELS[status]}${r.restocked ? ` · ${r.restocked} זוגות הוחזרו למלאי` : ""}`,
      before: { status: r.before },
      after: { status, note: note || undefined, restocked: r.restocked || undefined },
    });
    if (r.before !== status) await runAutomationsSafe({ type: "order_status_changed", orderId: id, status, before: r.before });
    refresh(id);
    return { ok: true, message: r.restocked ? `הסטטוס עודכן ו־${r.restocked} זוגות הוחזרו למלאי` : "הסטטוס עודכן" };
  } catch (e) {
    console.error(e);
    return { error: "העדכון נכשל, נסו שוב" };
  }
}

export async function bulkOrderStatusAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin("orders");
  if (!hasDb()) return { error: "מסד הנתונים לא מחובר" };
  const status = str(fd.get("status"));
  const ids = Array.from(new Set(fd.getAll("ids").map((v) => intId(v)).filter((n): n is number => !!n))).slice(0, 200);
  if (!ORDER_STATUS[status]) return { error: "יש לבחור סטטוס" };
  if (!ids.length) return { error: "לא נבחרו הזמנות" };
  let changed = 0;
  const changes: { id: number; before: string }[] = [];
  try {
    for (const id of ids) {
      const r = await changeOrderStatus(id, status, { note: "עדכון מרוכז", labels: LABELS });
      if (r && r.before !== status) {
        changed++;
        changes.push({ id, before: r.before });
      }
    }
  } catch (e) {
    console.error(e);
    return { error: `העדכון נעצר אחרי ${changed} הזמנות` };
  }
  if (changed) {
    await audit({
      action: "bulk",
      entity: "order",
      entityId: changes.map((c) => c.id).join(","),
      summary: `עדכון מרוכז: ${changed} הזמנות סומנו "${LABELS[status]}"`,
      before: { orders: changes },
      after: { status },
    });
  }
  for (const c of changes) await runAutomationsSafe({ type: "order_status_changed", orderId: c.id, status, before: c.before }, 2000);
  refresh();
  return { ok: true, message: changed ? `${changed} הזמנות עודכנו ל"${LABELS[status]}"` : "כל ההזמנות שנבחרו כבר בסטטוס הזה" };
}

export async function markShippedAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin("orders");
  if (!hasDb()) return { error: "מסד הנתונים לא מחובר" };
  const id = intId(fd.get("id"));
  const tracking = str(fd.get("tracking"), 80);
  if (!id) return { error: "הזמנה לא תקינה" };
  if (tracking && !/^[A-Za-z0-9\-\s]{4,80}$/.test(tracking)) return { error: "מספר מעקב יכול להכיל אותיות באנגלית, ספרות ומקפים בלבד" };
  const sql = await db();
  const r = await sql`select number, status, tracking from orders where id = ${id}`;
  if (!r[0]) return { error: "ההזמנה לא נמצאה" };
  if (["cancelled", "returned"].includes(r[0].status)) return { error: "לא ניתן לשלוח הזמנה מבוטלת או מוחזרת" };
  const before = { status: r[0].status, tracking: r[0].tracking };
  await sql`update orders set tracking = ${tracking}, updated_at = now() where id = ${id}`;
  if (r[0].status !== "shipped" && r[0].status !== "delivered") {
    await changeOrderStatus(id, "shipped", { labels: LABELS });
    await runAutomationsSafe({ type: "order_status_changed", orderId: id, status: "shipped", before: r[0].status });
  }
  if (tracking && tracking !== r[0].tracking) await addOrderEvent(id, "shipping", `מספר מעקב: ${tracking}`);
  await audit({ action: "status", entity: "order", entityId: id, summary: `הזמנה ${r[0].number} סומנה כנשלחה${tracking ? ` (מעקב ${tracking})` : ""}`, before, after: { status: r[0].status === "delivered" ? "delivered" : "shipped", tracking } });
  refresh(id);
  return { ok: true, message: "ההזמנה סומנה כנשלחה" };
}

export async function setPaymentStatusAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin("orders");
  if (!hasDb()) return { error: "מסד הנתונים לא מחובר" };
  const id = intId(fd.get("id"));
  const ps = str(fd.get("payment_status"));
  if (!id || !PAYMENT_STATUS[ps]) return { error: "יש לבחור סטטוס תשלום" };
  const sql = await db();
  const r = await sql`select number, payment_status from orders where id = ${id}`;
  if (!r[0]) return { error: "ההזמנה לא נמצאה" };
  const before = r[0].payment_status || "pending";
  if (before === ps) return { ok: true, message: "לא בוצע שינוי" };
  await sql`update orders set payment_status = ${ps}, updated_at = now() where id = ${id}`;
  await addOrderEvent(id, "payment", `סטטוס התשלום שונה מ־${PAY_LABELS[before] || before} ל־${PAY_LABELS[ps]}`);
  await audit({ action: "update", entity: "order", entityId: id, summary: `הזמנה ${r[0].number}: תשלום ${PAY_LABELS[before] || before} ← ${PAY_LABELS[ps]}`, before: { payment_status: before }, after: { payment_status: ps } });
  refresh(id);
  return { ok: true, message: "סטטוס התשלום עודכן" };
}

export async function addOrderNoteAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin("orders");
  if (!hasDb()) return { error: "מסד הנתונים לא מחובר" };
  const id = intId(fd.get("id"));
  const note = str(fd.get("note"), 1000);
  if (!id) return { error: "הזמנה לא תקינה" };
  if (!note) return { error: "יש לכתוב הערה" };
  const sql = await db();
  const r = await sql`select number from orders where id = ${id}`;
  if (!r[0]) return { error: "ההזמנה לא נמצאה" };
  await addOrderEvent(id, "note", note);
  await audit({ action: "update", entity: "order", entityId: id, summary: `הערה פנימית נוספה להזמנה ${r[0].number}`, after: { note } });
  refresh(id);
  return { ok: true, message: "ההערה נשמרה" };
}

/* ---------------- manual order ---------------- */

export async function createManualOrderAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin("orders");
  if (!hasDb()) return { error: "מסד הנתונים לא מחובר – לא ניתן ליצור הזמנה" };

  const name = str(fd.get("customer_name"), 120);
  const phone = normIsraeliMobile(str(fd.get("phone"), 30));
  const email = str(fd.get("email"), 160);
  const city = str(fd.get("city"), 80);
  const street = str(fd.get("street"), 160);
  const apt = str(fd.get("apt"), 60);
  const notes = str(fd.get("notes"), 1000);
  const shipping = str(fd.get("shipping_method"));
  const payment = str(fd.get("payment_method"));
  const payStatus = str(fd.get("payment_status"));

  if (!name) return { error: "יש להזין שם לקוחה" };
  if (!phone) return { error: "מספר נייד לא תקין – 10 ספרות שמתחילות ב־05" };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "כתובת המייל לא תקינה" };
  if (!SHIPPING[shipping]) return { error: "יש לבחור שיטת משלוח" };
  if (shipping === "home" && (!city || !street)) return { error: "במשלוח עד הבית יש להזין עיר ורחוב" };
  if (!PAYMENT[payment]) return { error: "יש לבחור אמצעי תשלום" };
  if (!PAYMENT_STATUS[payStatus]) return { error: "יש לבחור סטטוס תשלום" };

  // lines: productId / size / qty arrays (aligned). Merge duplicates.
  const pids = fd.getAll("productId").map(String);
  const sizes = fd.getAll("size").map(String);
  const qtys = fd.getAll("qty").map(String);
  const wanted = new Map<string, { productId: number; size: string; qty: number }>();
  for (let i = 0; i < pids.length; i++) {
    const pid = Number(pids[i]);
    const size = (sizes[i] || "").trim();
    const qty = Math.round(Number(qtys[i]));
    if (!pids[i] && !size) continue;
    if (!Number.isInteger(pid) || pid <= 0) return { error: `שורה ${i + 1}: יש לבחור מוצר` };
    if (!size) return { error: `שורה ${i + 1}: יש לבחור מידה` };
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) return { error: `שורה ${i + 1}: כמות לא תקינה` };
    const k = `${pid}|${size}`;
    const prev = wanted.get(k);
    wanted.set(k, { productId: pid, size, qty: (prev?.qty || 0) + qty });
  }
  if (!wanted.size) return { error: "יש להוסיף לפחות פריט אחד" };

  // prices and stock always come from the database
  const items: OrderItem[] = [];
  for (const w of Array.from(wanted.values())) {
    const p = await getProductById(w.productId);
    if (!p) return { error: "אחד המוצרים כבר לא קיים" };
    const have = Number(p.stock?.[w.size] || 0);
    if (have < w.qty) return { error: `${p.name} מידה ${w.size}: נשארו במלאי ${have} בלבד` };
    items.push({ productId: p.id, slug: p.slug, name: p.name, image: p.images[0] || "", size: w.size, qty: w.qty, price: p.price });
  }
  const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0);

  let number: string;
  try {
    number = await createOrder({
      customer_name: name,
      phone,
      email,
      city,
      street: shipping === "home" ? street : "",
      apt: shipping === "home" ? apt : "",
      notes,
      shipping_method: shipping,
      payment_method: payment,
      items,
      subtotal,
      total: subtotal,
      discount: 0,
      coupon_code: "",
    });
  } catch (e) {
    console.error(e);
    return { error: "יצירת ההזמנה נכשלה" };
  }
  const sql = await db();
  const [row] = await sql`select id from orders where number = ${number} limit 1`;
  const id = Number(row.id);
  if (payStatus !== "pending") await sql`update orders set payment_status = ${payStatus} where id = ${id}`;
  // createOrder() logs "received from the website" – not true for a manual order, so replace it
  await sql`delete from order_events where order_id = ${id} and type = 'created' and actor = 'לקוח'`;
  await addOrderEvent(id, "created", "הזמנה ידנית נוצרה ע״י מנהל");
  await audit({
    action: "create",
    entity: "order",
    entityId: id,
    summary: `הזמנה ידנית ${number} נוצרה ל${name} (${items.reduce((a, i) => a + i.qty, 0)} זוגות)`,
    after: { number, total: subtotal, payment_method: payment, payment_status: payStatus, items: items.map((i) => ({ productId: i.productId, size: i.size, qty: i.qty, price: i.price })) },
  });
  revalidatePath("/", "layout");
  redirect(`/admin/orders/${id}?created=1`);
}
