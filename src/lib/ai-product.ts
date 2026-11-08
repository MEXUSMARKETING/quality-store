import { callClaudeJson, type AiContentBlock } from "./ai";
import type { Product } from "./types";
import type { ParseColor } from "./stock-parse";

/* AI product intake: reads product photos, writes copy in the store's voice, spots an existing
   model in another colour, and turns free stock text into a colour × size table.
   Server only (the API key never reaches the browser). */

export type Analysis = {
  isProduct: boolean;
  productType: string;
  category: string;
  color: string;
  colorConfidence: number;
  colorAlternatives: string[];
  material: string;
  heelCm: number | null;
  heelType: string;
  features: string[];
  title: string;
  description: string;
  seoTitle: string;
  seoDescription: string;
  matchProductId: number | null;
  matchConfidence: number;
  matchReason: string;
  photoNotes: string[];
};

const STORE_VOICE = `את/ה קופירייטר/ית ומומחה/ית מוצר של "Quality" – חנות נעלי נשים (בעיקר מגפונים) בטמרה. כותבים בעברית טבעית, חמה ומדויקת, בלשון נקבה כלפי הלקוחה.
כללי אמת:
- תאר/י רק מה שרואים בתמונות. אל תמציא/י חומר: אם לא ברור שזה עור אמיתי כתוב/י "מראה עור" או "דמוי עור". אל תמציא/י מידות, מותגים, אחריות או נתונים.
- גובה עקב: הערכה בס״מ שלמים לפי הפרופורציות, או null אם לא רואים.
- בלי אימוג׳י, בלי Markdown, בלי סימני קריאה מוגזמים.`;

const clamp01 = (n: unknown) => Math.max(0, Math.min(1, Number(n) || 0));
const str = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

export async function analyzeProductPhotos(opts: {
  images: { mediaType: string; data: string }[];
  categories: { key: string; name: string }[];
  colors: { key: string; label: string }[];
  products: Product[];
  hint?: string;
  focusProductId?: number | null;
}): Promise<{ data?: Analysis; error?: string }> {
  const catalog = opts.products
    .slice(0, 150)
    .map((p) => `#${p.id} | ${p.name} | ${p.category} | צבעים: ${(p.variants ? p.variants.colors.map((c) => c.key) : [p.color]).join(",")} | עקב ${p.heel ?? "-"} | ₪${p.price}`)
    .join("\n");
  const system = `${STORE_VOICE}

המשימה: לזהות את המוצר בתמונות ולהכין טיוטה למוצר בחנות. ענה/י ב־JSON בלבד, בלי טקסט נוסף, בדיוק במבנה:
{"isProduct":true,"productType":"מגפון","category":"<מפתח>","color":"<מפתח>","colorConfidence":0.0,"colorAlternatives":["<מפתח>"],"material":"","heelCm":null,"heelType":"","features":[""],"title":"","description":"","seoTitle":"","seoDescription":"","matchProductId":null,"matchConfidence":0.0,"matchReason":"","photoNotes":[""]}

הנחיות לשדות:
- category: אחד מהמפתחות: ${opts.categories.map((c) => `${c.key} (${c.name})`).join(", ")}.
- color: אחד מהמפתחות: ${opts.colors.map((c) => `${c.key} (${c.label})`).join(", ")}. colorConfidence בין 0 ל־1. אם יש שני צבעים סבירים, שים/י את השני ב־colorAlternatives.
- title: שם קצר ומושך למוצר (עד 60 תווים), למשל "מגפון בוקרים חום עם תפרים".
- description: 2–4 משפטים לדף המוצר: מראה, נוחות, עם מה משלבים. בלי המצאות.
- seoTitle עד 60 תווים, seoDescription עד 155 תווים.
- features: עד 5 פרטים שרואים (סוג עקב, תפרים, רוכסן, אבזם, סוליה...).
- matchProductId: אם זה אותו דגם בדיוק כמו מוצר קיים מהרשימה אבל בצבע אחר (או אותו צבע) – המזהה שלו, אחרת null. matchConfidence בין 0 ל־1, matchReason משפט קצר. היה/י שמרני/ת: רק כשהצורה, העקב והפרטים זהים.
- photoNotes: הערות קצרות על איכות הצילום אם יש בעיה (חשוך, מטושטש, חתוך), אחרת [].
- isProduct=false אם בתמונה אין נעל/מוצר אופנה.

מוצרים קיימים בחנות (מזהה | שם | קטגוריה | צבעים | עקב | מחיר):
${catalog || "אין מוצרים"}`;

  const content: AiContentBlock[] = opts.images.slice(0, 4).map((im) => ({ type: "image", source: { type: "base64", media_type: im.mediaType, data: im.data } }));
  content.push({
    type: "text",
    text:
      (opts.focusProductId ? `הצילום הוא כנראה צבע נוסף למוצר #${opts.focusProductId}. בדוק/י זאת.\n` : "") +
      (opts.hint ? `הערה מהמשתמש/ת: ${opts.hint.slice(0, 300)}\n` : "") +
      "זהה/י את המוצר והחזר/י JSON בלבד.",
  });

  const r = await callClaudeJson<any>({ system, messages: [{ role: "user", content }], maxTokens: 1400, timeoutMs: 40_000 });
  if (r.error) return { error: r.error };
  const d = r.data || {};
  const catKeys = new Set(opts.categories.map((c) => c.key));
  const colorKeys = new Set(opts.colors.map((c) => c.key));
  const ids = new Set(opts.products.map((p) => p.id));
  const heel = d.heelCm === null || d.heelCm === undefined || d.heelCm === "" ? null : Math.round(Number(d.heelCm));
  return {
    data: {
      isProduct: d.isProduct !== false,
      productType: str(d.productType, 40),
      category: catKeys.has(d.category) ? d.category : catKeys.has("boots") ? "boots" : opts.categories[0]?.key || "boots",
      color: colorKeys.has(d.color) ? d.color : "",
      colorConfidence: clamp01(d.colorConfidence),
      colorAlternatives: (Array.isArray(d.colorAlternatives) ? d.colorAlternatives : []).filter((k: string) => colorKeys.has(k) && k !== d.color).slice(0, 2),
      material: str(d.material, 40),
      heelCm: heel !== null && Number.isFinite(heel) && heel >= 0 && heel <= 25 ? heel : null,
      heelType: str(d.heelType, 30),
      features: (Array.isArray(d.features) ? d.features : []).map((x: unknown) => str(x, 40)).filter(Boolean).slice(0, 5),
      title: str(d.title, 80),
      description: String(d.description ?? "").trim().slice(0, 1200),
      seoTitle: str(d.seoTitle, 70),
      seoDescription: str(d.seoDescription, 170),
      matchProductId: ids.has(Number(d.matchProductId)) ? Number(d.matchProductId) : null,
      matchConfidence: clamp01(d.matchConfidence),
      matchReason: str(d.matchReason, 160),
      photoNotes: (Array.isArray(d.photoNotes) ? d.photoNotes : []).map((x: unknown) => str(x, 80)).filter(Boolean).slice(0, 3),
    },
  };
}

const TONES: Record<string, string> = {
  short: "קצר יותר: 1–2 משפטים, ענייני",
  luxury: "יוקרתי ואלגנטי",
  young: "צעיר, קליל וזורם",
  warm: "חם ואישי, כמו מוכרת שממליצה",
};

export async function rewriteCopy(opts: { title: string; description: string; tone: string; facts: string }): Promise<{ data?: { title: string; description: string }; error?: string }> {
  const system = `${STORE_VOICE}\nשכתב/י שם ותיאור למוצר בסגנון: ${TONES[opts.tone] || TONES.warm}. שמור/י על אותן עובדות בדיוק. ענה/י ב־JSON בלבד: {"title":"","description":""}`;
  const r = await callClaudeJson<any>({
    system,
    messages: [{ role: "user", content: `עובדות: ${opts.facts.slice(0, 600)}\nשם נוכחי: ${opts.title.slice(0, 120)}\nתיאור נוכחי: ${opts.description.slice(0, 1500)}` }],
    maxTokens: 700,
  });
  if (r.error) return { error: r.error };
  const title = str(r.data?.title, 80);
  const description = String(r.data?.description ?? "").trim().slice(0, 1200);
  if (!title && !description) return { error: "ה־AI לא החזיר ניסוח. נסו שוב." };
  return { data: { title: title || opts.title, description: description || opts.description } };
}

/** For text the quick parser couldn't fully read. */
export async function parseStockWithAi(opts: { text: string; colors: ParseColor[]; sizes: string[]; defaultColor: string }): Promise<{ data?: Record<string, Record<string, number>>; error?: string }> {
  const system = `את/ה מפרש/ת הודעות מלאי של חנות נעליים. המשתמש/ת מתאר/ת בחופשיות כמה זוגות יש מכל צבע ומידה.
צבעים מותרים (מפתח: שם): ${opts.colors.map((c) => `${c.key}: ${c.label}`).join(", ")}. צבע ברירת מחדל אם לא נאמר: ${opts.defaultColor}.
מידות אפשריות: ${opts.sizes.join(", ")} (וגם מידות 33–46 אם נאמרו במפורש).
ענה/י ב־JSON בלבד: {"stock":{"<מפתח צבע>":{"<מידה>":<כמות>}}}. כמויות במספרים שלמים. אל תנחש/י: מה שלא נאמר לא נכנס.`;
  const r = await callClaudeJson<any>({ system, messages: [{ role: "user", content: opts.text.slice(0, 800) }], maxTokens: 600 });
  if (r.error) return { error: r.error };
  const keys = new Set(opts.colors.map((c) => c.key));
  const out: Record<string, Record<string, number>> = {};
  for (const [c, row] of Object.entries(r.data?.stock || {})) {
    if (!keys.has(c) || !row || typeof row !== "object") continue;
    for (const [s, q] of Object.entries(row as Record<string, unknown>)) {
      const size = String(s).trim();
      const n = Math.round(Number(q));
      if (!/^\d{2}(\.5)?$/.test(size) || !Number.isFinite(n) || n <= 0) continue;
      out[c] = out[c] || {};
      out[c][size] = Math.min(9999, n);
    }
  }
  return { data: out };
}

/** A price suggestion from the store's own catalogue (no AI): the matched model, else the category median. */
export function suggestPrice(products: Product[], category: string, matchId: number | null): { price: number | null; basis: string } {
  if (matchId) {
    const m = products.find((p) => p.id === matchId);
    if (m) return { price: m.price, basis: `כמו הדגם "${m.name}"` };
  }
  const same = products.filter((p) => p.category === category && p.active && p.price > 0).map((p) => p.price).sort((a, b) => a - b);
  if (!same.length) return { price: null, basis: "" };
  const mid = same[Math.floor(same.length / 2)];
  return { price: mid, basis: `חציון של ${same.length} מוצרים בקטגוריה` };
}
