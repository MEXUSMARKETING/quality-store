/* Turns free Hebrew text (typed or dictated) into stock per colour per size, e.g.
   "חום: 34 חמש יחידות, 42 שש. שחור 38 עשר ו־42 שלוש"  →  { brown: {34:5, 42:6}, black: {38:10, 42:3} }
   Runs instantly in the browser and on the server; the AI is only asked for text this can't read.
   Pure code, no dependencies. */

export type ParseColor = { key: string; label: string };
export type ParsedStock = { stock: Record<string, Record<string, number>>; total: number; unknown: string[] };

const WORDS: Record<string, number> = {
  אפס: 0,
  אחת: 1, אחד: 1, זוג: 1,
  שתיים: 2, שניים: 2, שתי: 2, שני: 2, זוגיים: 2,
  שלוש: 3, שלושה: 3, שלושת: 3,
  ארבע: 4, ארבעה: 4, ארבעת: 4,
  חמש: 5, חמישה: 5, חמשת: 5,
  שש: 6, שישה: 6, ששת: 6,
  שבע: 7, שבעה: 7, שבעת: 7,
  שמונה: 8, שמונת: 8,
  תשע: 9, תשעה: 9, תשעת: 9,
  עשר: 10, עשרה: 10, עשרת: 10,
  "אחת עשרה": 11, "אחד עשר": 11, "שתים עשרה": 12, "שנים עשר": 12, "שתיים עשרה": 12,
  "שלוש עשרה": 13, "שלושה עשר": 13, "ארבע עשרה": 14, "ארבעה עשר": 14, "חמש עשרה": 15, "חמישה עשר": 15,
  "שש עשרה": 16, "שישה עשר": 16, "שבע עשרה": 17, "שבעה עשר": 17, "שמונה עשרה": 18, "שמונה עשר": 18,
  "תשע עשרה": 19, "תשעה עשר": 19, עשרים: 20, שלושים: 30, ארבעים: 40, חמישים: 50,
};

const FILLER = new Set(["יחידות", "יחידה", "זוגות", "פריטים", "פריט", "במידה", "מידה", "מידות", "יש", "לי", "של", "בצבע", "צבע", "גם", "עוד", "כל", "אחד", "מכל", "x", "×", "-", "–"]);

/** Strip Hebrew prefixes (ו, ב, ה, מ, ל, ש) that dictation glues to words: "ושחור" → "שחור". */
function stems(w: string): string[] {
  const out = [w];
  let x = w;
  for (let i = 0; i < 2 && x.length > 2 && "ובהמלש".includes(x[0]); i++) {
    x = x.slice(1);
    out.push(x);
  }
  return out;
}

export function parseStockText(text: string, colors: ParseColor[], sizes: string[], defaultColor: string): ParsedStock {
  const stock: Record<string, Record<string, number>> = {};
  const unknown: string[] = [];
  const sizeSet = new Set(sizes.map(String));
  const isSize = (n: number) => sizeSet.has(String(n)) || (n >= 33 && n <= 46);

  // colour names (longest first so "חום כהה" wins over "חום")
  const colorNames = colors
    .flatMap((c) => [c.label, c.key, ...c.label.split(/[\s/]+/).filter((w) => w.length > 2)].map((name) => ({ name: name.toLowerCase(), key: c.key })))
    .sort((a, b) => b.name.length - a.name.length);

  let t = ` ${String(text || "").toLowerCase()} `
    .replace(/[,.;:!?()\n״"'׳]/g, " ")
    .replace(/(\d)\s*[x×*]\s*(\d)/g, "$1 $2")
    .replace(/[־]/g, " ");
  // two-word numbers first
  for (const k of Object.keys(WORDS).filter((k) => k.includes(" ")).sort((a, b) => b.length - a.length)) t = t.split(` ${k} `).join(` ${WORDS[k]} `);
  for (const k of Object.keys(WORDS).filter((k) => k.includes(" ")).sort((a, b) => b.length - a.length)) t = t.split(` ו${k} `).join(` ${WORDS[k]} `);

  const tokens = t.split(/\s+/).filter(Boolean);
  let color = defaultColor;
  let pendingQty: number | null = null;
  let pendingSize: string | null = null;
  const put = (size: string, qty: number) => {
    stock[color] = stock[color] || {};
    stock[color][size] = Math.max(0, Math.min(9999, qty));
  };

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    // colour? (try the token and the token + next, with prefixes stripped)
    const two = `${tok} ${tokens[i + 1] || ""}`.trim();
    const hit = colorNames.find((c) => stems(two).includes(c.name) || stems(tok).includes(c.name)) || null;
    if (hit) {
      pendingSize = null;
      color = hit.key;
      pendingQty = null;
      if (hit.name.includes(" ") && stems(two).includes(hit.name)) i++;
      continue;
    }
    // number (digits or word, with Hebrew prefixes like "ו5" / "ושש")
    let num: number | null = null;
    for (const s of stems(tok)) {
      if (/^\d{1,4}$/.test(s)) { num = Number(s); break; }
      if (s in WORDS) { num = WORDS[s]; break; }
    }
    if (num === null) {
      if (!stems(tok).some((s) => FILLER.has(s)) && tok.length > 1) unknown.push(tok);
      continue;
    }
    // a number that can be a size is a size; anything else is a quantity
    if (isSize(num)) {
      if (pendingQty !== null) {
        put(String(num), pendingQty); // "5 יחידות 34"
        pendingQty = null;
      } else pendingSize = String(num); // "34 חמש" – waits for its quantity
    } else if (pendingSize !== null) {
      put(pendingSize, num);
      pendingSize = null;
    } else pendingQty = num;
  }

  let total = 0;
  for (const c of Object.keys(stock)) for (const q of Object.values(stock[c])) total += q;
  return { stock, total, unknown: Array.from(new Set(unknown)).slice(0, 8) };
}
