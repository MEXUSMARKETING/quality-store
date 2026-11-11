import { countPopupEvent } from "@/lib/popups";

export const dynamic = "force-dynamic";

/** Storefront beacon: a popup was shown or its button was clicked. */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const id = Number(b?.id);
    const type = b?.type === "click" ? "click" : b?.type === "view" ? "view" : null;
    if (!Number.isInteger(id) || id <= 0 || !type) return new Response(null, { status: 400 });
    await countPopupEvent(id, type);
  } catch {
    /* counting must never break the page */
  }
  return new Response(null, { status: 204 });
}
