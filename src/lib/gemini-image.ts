/* Gemini image generation ("Nano Banana") for product mock-ups: the real product photos go in as
   references, a lifestyle / on-model photo comes out. Server only – the key never reaches the browser.
   Supports the current Interactions API and falls back to the classic generateContent API and to
   older models, so a change on Google's side doesn't break the store. */

import { callClaudeJson, type AiContentBlock } from "./ai";

export const DEFAULT_IMAGE_MODEL = "gemini-nano-banana-2.1";
const FALLBACK_MODELS = ["gemini-nano-banana-2.1", "gemini-3.1-flash-image", "gemini-3-pro-image", "gemini-2.5-flash-image"];
const BASE = "https://generativelanguage.googleapis.com/v1beta";
let workingModel: string | null = null;

export function geminiKey(): string {
  return (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "").trim();
}
export function geminiConfigured(): boolean {
  return !!geminiKey();
}
export function imageModel(): string {
  return workingModel || (process.env.GEMINI_IMAGE_MODEL || "").trim() || DEFAULT_IMAGE_MODEL;
}

export type RefImage = { mimeType: string; data: string };
export type GenImage = { mimeType: string; data: string };

/** Find generated images anywhere in a response (new and classic shapes). */
function findImages(x: any, out: GenImage[] = [], depth = 0): GenImage[] {
  if (!x || typeof x !== "object" || depth > 12) return out;
  if (Array.isArray(x)) {
    x.forEach((v) => findImages(v, out, depth + 1));
    return out;
  }
  // classic: { inlineData: { mimeType, data } } / { inline_data: { mime_type, data } }
  const inl = x.inlineData || x.inline_data;
  if (inl && typeof inl.data === "string" && inl.data.length > 200) {
    out.push({ mimeType: inl.mimeType || inl.mime_type || "image/png", data: inl.data });
    return out;
  }
  // interactions: { type: "image", data, mime_type } and output_image: { data }
  if ((x.type === "image" || x.mime_type || x.mimeType) && typeof x.data === "string" && x.data.length > 200) {
    out.push({ mimeType: x.mime_type || x.mimeType || "image/png", data: x.data });
    return out;
  }
  for (const k of Object.keys(x)) if (k !== "input") findImages(x[k], out, depth + 1);
  return out;
}

async function post(url: string, body: unknown, signal: AbortSignal): Promise<{ ok: boolean; status: number; json?: any; text?: string }> {
  const r = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": geminiKey(), "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
    cache: "no-store",
  });
  const text = await r.text().catch(() => "");
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {}
  return { ok: r.ok, status: r.status, json, text };
}

/** One image from a prompt + reference photos. */
export async function generateImage(opts: { prompt: string; refs: RefImage[]; aspect?: string; timeoutMs?: number }): Promise<{ image?: GenImage; error?: string }> {
  if (!geminiConfigured()) return { error: "Gemini לא מחובר: יש להוסיף ב־Vercel את המשתנה GEMINI_API_KEY ולפרוס מחדש." };
  const aspect = opts.aspect || "4:5";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || 90_000);
  const candidates = Array.from(new Set([imageModel(), ...FALLBACK_MODELS]));
  let lastErr = "";
  try {
    for (const model of candidates) {
      // 1) Interactions API (current)
      const a = await post(
        `${BASE}/interactions`,
        {
          model,
          input: [{ type: "text", text: opts.prompt }, ...opts.refs.map((r) => ({ type: "image", mime_type: r.mimeType, data: r.data }))],
          response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: aspect, image_size: "1K" },
        },
        ctrl.signal
      );
      if (a.ok) {
        const imgs = findImages(a.json);
        if (imgs.length) {
          workingModel = model;
          return { image: imgs[imgs.length - 1] };
        }
        lastErr = "empty";
      } else {
        lastErr = `${a.status} ${(a.text || "").slice(0, 300)}`;
        if (a.status === 401 || a.status === 403) return { error: "מפתח Gemini לא תקין או חסרות לו הרשאות. בדקו את GEMINI_API_KEY ב־Vercel." };
        if (a.status === 429) return { error: "חרגנו ממגבלת הקריאות של Gemini. נסו שוב בעוד דקה." };
      }
      // 2) classic generateContent
      const b = await post(
        `${BASE}/models/${encodeURIComponent(model)}:generateContent`,
        {
          contents: [{ role: "user", parts: [{ text: opts.prompt }, ...opts.refs.map((r) => ({ inline_data: { mime_type: r.mimeType, data: r.data } }))] }],
          generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } },
        },
        ctrl.signal
      );
      if (b.ok) {
        const imgs = findImages(b.json?.candidates || b.json);
        if (imgs.length) {
          workingModel = model;
          return { image: imgs[imgs.length - 1] };
        }
        const blocked = b.json?.promptFeedback?.blockReason || b.json?.candidates?.[0]?.finishReason;
        if (blocked && blocked !== "STOP") return { error: "Gemini סירב ליצור את התמונה הזו. נסו ניסוח אחר." };
        lastErr = "empty";
      } else {
        lastErr = `${b.status} ${(b.text || "").slice(0, 300)}`;
        if (b.status === 401 || b.status === 403) return { error: "מפתח Gemini לא תקין או חסרות לו הרשאות. בדקו את GEMINI_API_KEY ב־Vercel." };
        if (b.status === 429) return { error: "חרגנו ממגבלת הקריאות של Gemini. נסו שוב בעוד דקה." };
        if (/billing|quota|exceeded/i.test(b.text || "")) return { error: "החשבון ב־Google לא מאפשר עדיין יצירת תמונות (חיוב/מכסה). יש להפעיל חיוב ב־Google AI Studio." };
      }
      console.error("gemini image failed", model, lastErr);
    }
    return { error: "Gemini לא החזיר תמונה. נסו שוב או ניסוח אחר." };
  } catch (e: any) {
    if (e?.name === "AbortError") return { error: "יצירת התמונה התעכבה יותר מדי. נסו שוב." };
    console.error("gemini fetch failed", e, lastErr);
    return { error: "לא הצלחנו להתחבר ל־Gemini. נסו שוב." };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */

const SKIN: Record<string, string> = {
  light: "fair/light skin tone",
  wheat: "light olive / wheat skin tone",
  tan: "tanned medium-brown skin tone",
  dark: "deep dark-brown skin tone",
};
const OUTFIT: Record<string, string> = {
  jeans: "dark slim jeans",
  dress: "an elegant long dress",
  skirt: "a midi skirt",
  pants: "tailored trousers",
  modest: "a long modest dress (covering the legs, elegant and conservative)",
};

/** Build the prompt for the image model (English works best; the user's own words are passed along). */
export function tryOnPrompt(o: { productType: string; colorName: string; userText: string; scene: string; skin: string; outfit: string; variant: number }): string {
  const product = [o.colorName, o.productType].filter(Boolean).join(" ") || "the product";
  return [
    `Create a photorealistic, high-end e-commerce lifestyle photograph featuring the EXACT product shown in the reference photos (${product}).`,
    `Scene requested by the shop owner (Hebrew, translate the intent): "${o.userText.slice(0, 400)}".`,
    o.scene ? `Scene direction: ${o.scene}.` : "",
    `If a person appears: an adult woman, ${SKIN[o.skin] || SKIN.wheat}, wearing ${OUTFIT[o.outfit] || OUTFIT.jeans}; show only what the scene needs (e.g. legs and feet for footwear), no face close-up.`,
    "The product must be identical to the references: same shape and proportions, same colour, same material texture, same stitching, buckles, zips and hardware, same heel and sole. Do not redesign, recolour or simplify it. Do not add logos, text or watermarks.",
    "The product is the hero: sharp focus, well lit, fully visible, centred. Natural light, realistic shadows, professional fashion photography, shallow depth of field.",
    `Variation ${o.variant + 1}: choose a slightly different camera angle or framing than other variations.`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Claude compares a mock-up with the real product and scores how faithful it is (0–100). */
export async function fidelityScore(real: RefImage, gen: GenImage): Promise<{ score: number; issue: string }> {
  const content: AiContentBlock[] = [
    { type: "text", text: "תמונה 1: המוצר האמיתי." },
    { type: "image", source: { type: "base64", media_type: real.mimeType, data: real.data } },
    { type: "text", text: "תמונה 2: הדמיה שנוצרה ב־AI." },
    { type: "image", source: { type: "base64", media_type: gen.mimeType, data: gen.data } },
    { type: "text", text: "האם המוצר בתמונה 2 זהה למוצר בתמונה 1? בדוק/י צבע, צורה, חומר, תפרים, אבזמים/רוכסנים, עקב וסוליה. ענה/י JSON בלבד: {\"score\":0-100,\"issue\":\"הבעיה העיקרית בעברית, עד 8 מילים, או ריק\"}" },
  ];
  const r = await callClaudeJson<any>({
    system: "את/ה בודק/ת איכות לתמונות מוצר בחנות. היה/י קפדני/ת: שינוי בצבע, בצורה או בפרט בולט מוריד ציון משמעותית. מוצר שלא מופיע או חתוך = ציון נמוך.",
    messages: [{ role: "user", content }],
    maxTokens: 200,
    timeoutMs: 30_000,
  });
  if (r.error || !r.data) return { score: -1, issue: "" };
  const score = Math.max(0, Math.min(100, Math.round(Number(r.data.score) || 0)));
  return { score, issue: String(r.data.issue || "").slice(0, 80) };
}
