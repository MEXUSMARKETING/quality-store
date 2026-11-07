"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";
import { checkPassword, endSession, requireAdmin, startSession } from "@/lib/auth";
import { deleteProduct, saveProduct, setOrderStatus } from "@/lib/store";
import { CATEGORIES, COLORS, ORDER_STATUS, SIZES } from "@/lib/config";
import { audit } from "@/lib/admin";

export async function login(_: { error?: string } | null, fd: FormData): Promise<{ error?: string }> {
  const pw = String(fd.get("password") || "");
  if (!checkPassword(pw)) return { error: "סיסמה שגויה" };
  startSession();
  await audit({ action: "login", entity: "user", summary: "כניסה למערכת הניהול" });
  redirect("/admin");
}

export async function logout() {
  endSession();
  redirect("/admin");
}

const num = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n) : null;
};

function slugify(s: string) {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9֐-׿\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function saveProductAction(_: { error?: string } | null, fd: FormData): Promise<{ error?: string }> {
  requireAdmin();
  const id = num(fd.get("id"));
  const name = String(fd.get("name") || "").trim();
  if (!name) return { error: "יש להזין שם מוצר" };
  const price = num(fd.get("price"));
  if (price === null || price < 0) return { error: "יש להזין מחיר" };
  let slug = slugify(String(fd.get("slug") || "")) || slugify(name) || "p-" + Date.now().toString(36);

  // images: keep the ones still listed, add uploads + pasted URL
  const keep = fd.getAll("keepImage").map(String).filter(Boolean);
  const images = [...keep];
  const files = fd.getAll("files").filter((f): f is File => typeof f === "object" && f !== null && "size" in f && (f as File).size > 0);
  if (files.length) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return { error: "כדי להעלות תמונות יש לחבר Vercel Blob לפרויקט (או להדביק קישור לתמונה)" };
    }
    for (const f of files) {
      const safe = f.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const blob = await put(`products/${Date.now()}-${safe}`, f, { access: "public" });
      images.push(blob.url);
    }
  }
  const url = String(fd.get("imageUrl") || "").trim();
  if (url) images.push(url);
  const mainFirst = String(fd.get("mainImage") || "");
  if (mainFirst && images.includes(mainFirst)) {
    images.splice(images.indexOf(mainFirst), 1);
    images.unshift(mainFirst);
  }

  const stock: Record<string, number> = {};
  for (const s of SIZES) {
    const q = num(fd.get(`stock_${s}`));
    if (q && q > 0) stock[s] = q;
  }

  const color = String(fd.get("color") || "black");
  const category = String(fd.get("category") || "boots");

  let newId: number;
  try {
    newId = await saveProduct(id, {
      slug,
      name,
      description: String(fd.get("description") || "").trim(),
      price,
      old_price: num(fd.get("old_price")),
      heel: num(fd.get("heel")),
      color: COLORS[color] ? color : "other",
      category: CATEGORIES[category] ? category : "boots",
      images,
      stock,
      featured: fd.get("featured") === "on",
      active: fd.get("active") === "on",
      sort: num(fd.get("sort")) ?? 100,
    });
  } catch (e: any) {
    if (String(e?.message || "").includes("duplicate key")) return { error: "כתובת (slug) זו כבר קיימת — בחרי כתובת אחרת" };
    console.error(e);
    return { error: "השמירה נכשלה" };
  }
  revalidatePath("/", "layout");
  redirect(`/admin/products/${newId}?saved=1`);
}

export async function deleteProductAction(fd: FormData) {
  requireAdmin();
  const id = num(fd.get("id"));
  if (id) await deleteProduct(id);
  revalidatePath("/", "layout");
  redirect("/admin/products");
}

export async function setOrderStatusAction(fd: FormData) {
  requireAdmin();
  const id = num(fd.get("id"));
  const status = String(fd.get("status") || "");
  if (id && ORDER_STATUS[status]) await setOrderStatus(id, status);
  revalidatePath("/admin", "layout");
}
