"use client";

/* Studio-quality product photos, entirely in the browser – no account, no API key, no per-photo cost.
   1. Auto-enhance: exposure/levels, white balance from the photo's own neutral highlights (so a brown boot
      stays brown – only the camera's colour cast is removed), gentle contrast and sharpening.
   2. U²-Net-P (Apache-2.0, 4.6MB, served from /models) finds the product and gives a soft mask.
   3. The real product is cut out and placed in the "Quality style": same size and position in the frame,
      soft contact shadow, on one of the backgrounds.
   onnxruntime-web is loaded on demand from jsDelivr (pinned version). */

const ORT_VERSION = "1.19.2";
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const MODEL_URL = "/models/u2netp.onnx";
const SIZE = 320;
const MAX_SIDE = 2000;

export type BgId = "original" | "white" | "studio" | "quality" | "wood" | "street";
export const BACKGROUNDS: { id: BgId; name: string; swatch: string }[] = [
  { id: "original", name: "המקורי", swatch: "linear-gradient(180deg,#5E4636,#2A1E18)" },
  { id: "white", name: "לבן נקי", swatch: "#FFFFFF" },
  { id: "studio", name: "סטודיו אפור", swatch: "radial-gradient(circle at 50% 35%,#F2F1EE,#C9C6BF)" },
  { id: "quality", name: "רקע Quality", swatch: "radial-gradient(circle at 50% 30%,#2A2925,#0E0E0E 70%)" },
  { id: "wood", name: "רצפת עץ", swatch: "linear-gradient(180deg,#EDE3D6 0,#E2D3C0 60%,#B98B5E 60%,#9C6F45 100%)" },
  { id: "street", name: "רחוב עירוני", swatch: "linear-gradient(180deg,#9FB3C8 0,#D8DEE4 62%,#7D7F83 62%,#5D5F63 100%)" },
];

let ortPromise: Promise<any> | null = null;
let sessionPromise: Promise<any> | null = null;

function loadOrt(): Promise<any> {
  if ((window as any).ort) return Promise.resolve((window as any).ort);
  if (!ortPromise) {
    ortPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = ORT_BASE + "ort.min.js";
      s.async = true;
      s.crossOrigin = "anonymous";
      s.onload = () => {
        const ort = (window as any).ort;
        if (!ort) return reject(new Error("ort missing"));
        ort.env.wasm.wasmPaths = ORT_BASE;
        ort.env.wasm.numThreads = 1; // no cross-origin isolation needed
        resolve(ort);
      };
      s.onerror = () => {
        ortPromise = null;
        reject(new Error("ort load failed"));
      };
      document.head.appendChild(s);
    });
  }
  return ortPromise;
}

/** Warm up early (e.g. when the identify step opens) so the photo step feels instant. */
export function preloadCutout(): Promise<void> {
  if (!sessionPromise) {
    sessionPromise = loadOrt()
      .then((ort) => ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"], graphOptimizationLevel: "all" }))
      .catch((e) => {
        sessionPromise = null;
        throw e;
      });
  }
  return sessionPromise.then(() => undefined);
}

const canvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/* ------------------------------------------------------------------ */
/* 1. auto-enhance                                                     */
/* ------------------------------------------------------------------ */

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

export type Gains = [number, number, number];

/** Camera colour cast, measured on the background around the product (a table, wall or floor is
    roughly neutral). A clearly coloured background is left alone, so a real colour is never "fixed". */
export function castGains(photo: HTMLCanvasElement, alpha?: Uint8ClampedArray): Gains {
  const W = photo.width, H = photo.height;
  const d = photo.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, W, H).data;
  const ys: number[] = [];
  const px: number[] = [];
  for (let i = 0; i < W * H; i += 5) {
    if (alpha && alpha[i * 4 + 3] > 24) continue; // product – skip
    const p = i * 4;
    const y = d[p] * 0.2126 + d[p + 1] * 0.7152 + d[p + 2] * 0.0722;
    if (y < 30 || y > 252) continue;
    ys.push(y);
    px.push(p);
  }
  if (ys.length < 200) return [1, 1, 1];
  const sorted = ys.slice().sort((x, y) => x - y);
  const cut = sorted[Math.floor(sorted.length * 0.4)];
  let r = 0, g = 0, b = 0, n = 0;
  for (let k = 0; k < px.length; k++) {
    if (ys[k] < cut) continue;
    const p = px[k];
    r += d[p]; g += d[p + 1]; b += d[p + 2]; n++;
  }
  r /= n; g /= n; b /= n;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx / Math.max(1, mn) > 1.7) return [1, 1, 1]; // a genuinely coloured backdrop
  const avg = (r + g + b) / 3;
  const k = 0.8;
  const lim = (x: number) => Math.max(0.8, Math.min(1.25, x));
  return [lim(1 + (avg / r - 1) * k), lim(1 + (avg / g - 1) * k), lim(1 + (avg / b - 1) * k)];
}

/** Light, colour and sharpness fixes. Conservative on purpose: the product must stay true to life. */
export function enhance(src: HTMLCanvasElement, gains: Gains = [1, 1, 1]): HTMLCanvasElement {
  const W = src.width;
  const H = src.height;
  const g = src.getContext("2d", { willReadFrequently: true })!;
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  const n = W * H;
  const [wr, wg, wb] = gains;

  // luminance histogram (after the colour-cast fix), every 3rd pixel is plenty
  const hist = new Uint32Array(256);
  let samples = 0;
  for (let i = 0; i < n; i += 3) {
    const p = i * 4;
    const y = (clamp(d[p] * wr) * 0.2126 + clamp(d[p + 1] * wg) * 0.7152 + clamp(d[p + 2] * wb) * 0.0722) | 0;
    hist[y]++;
    samples++;
  }
  const pct = (q: number) => {
    let acc = 0;
    const target = samples * q;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= target) return v;
    }
    return 255;
  };
  const lo = pct(0.005);
  const hi = pct(0.995);

  // levels (limited gain) + exposure (gamma towards a pleasant mid-tone) + soft S-curve + a touch of saturation
  const black = Math.min(lo, 28);
  const white = Math.max(hi, 205);
  const gain = Math.min(1.35, 255 / Math.max(1, white - black));
  let meanY = 0;
  for (let v = 0; v < 256; v++) meanY += v * hist[v];
  meanY = (meanY / samples - black) * gain / 255;
  const gamma = Math.max(0.82, Math.min(1.2, Math.log(0.5) / Math.log(Math.max(0.05, Math.min(0.95, meanY)))));
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    let x = Math.max(0, Math.min(1, ((v - black) * gain) / 255));
    x = Math.pow(x, 1 / gamma);
    x = x + 0.08 * x * (1 - x) * (2 * x - 1) * 2; // gentle S-curve
    lut[v] = Math.round(Math.max(0, Math.min(1, x)) * 255);
  }
  const SAT = 1.03;
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const r = lut[clamp(d[p] * wr) | 0];
    const gg = lut[clamp(d[p + 1] * wg) | 0];
    const b = lut[clamp(d[p + 2] * wb) | 0];
    const y = r * 0.2126 + gg * 0.7152 + b * 0.0722;
    d[p] = clamp(y + (r - y) * SAT);
    d[p + 1] = clamp(y + (gg - y) * SAT);
    d[p + 2] = clamp(y + (b - y) * SAT);
  }
  const out = canvas(W, H);
  const o = out.getContext("2d", { willReadFrequently: true })!;
  o.putImageData(img, 0, 0);

  // unsharp mask: sharpened = img + amount * (img - blur)
  const blur = canvas(W, H);
  const bx = blur.getContext("2d", { willReadFrequently: true })!;
  bx.filter = `blur(${Math.max(1, Math.round(Math.max(W, H) / 900))}px)`;
  bx.drawImage(out, 0, 0);
  const bd = bx.getImageData(0, 0, W, H).data;
  const AMOUNT = 0.45;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = d[i + c] - bd[i + c];
      if (diff > 3 || diff < -3) d[i + c] = clamp(d[i + c] + diff * AMOUNT);
    }
  }
  o.putImageData(img, 0, 0);
  return out;
}

/* ------------------------------------------------------------------ */
/* 2. cut-out                                                          */
/* ------------------------------------------------------------------ */

export type Cutout = {
  /** product with transparent background, cropped to its bounds – raw and enhanced */
  raw: HTMLCanvasElement;
  enhanced: HTMLCanvasElement;
  /** whole photo – raw and enhanced (for "המקורי") */
  rawFull: HTMLCanvasElement;
  enhancedFull: HTMLCanvasElement;
};

/** Find the product in the photo, enhance it and cut it out. */
export async function cutOut(file: Blob): Promise<Cutout> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const W = Math.round(bmp.width * scale);
  const H = Math.round(bmp.height * scale);
  const rawFull = canvas(W, H);
  const rf = rawFull.getContext("2d", { willReadFrequently: true })!;
  rf.imageSmoothingQuality = "high";
  rf.drawImage(bmp, 0, 0, W, H);

  await preloadCutout();
  const session = await sessionPromise!;
  const ort = (window as any).ort;

  // model input: 320×320, ImageNet-normalised, scaled by the image max (as U²-Net was trained)
  const c = canvas(SIZE, SIZE);
  const cx = c.getContext("2d", { willReadFrequently: true })!;
  cx.drawImage(rawFull, 0, 0, SIZE, SIZE);
  const px = cx.getImageData(0, 0, SIZE, SIZE).data;
  let max = 1;
  for (let i = 0; i < px.length; i += 4) max = Math.max(max, px[i], px[i + 1], px[i + 2]);
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  const n = SIZE * SIZE;
  const input = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) for (let ch = 0; ch < 3; ch++) input[ch * n + i] = (px[i * 4 + ch] / max - mean[ch]) / std[ch];
  const out = await session.run({ [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]) });
  const pred: Float32Array = out[session.outputNames[0]].data;

  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) {
    if (pred[i] < lo) lo = pred[i];
    if (pred[i] > hi) hi = pred[i];
  }
  const mask = canvas(SIZE, SIZE);
  const mx = mask.getContext("2d")!;
  const md = mx.createImageData(SIZE, SIZE);
  for (let i = 0; i < n; i++) {
    const v = (pred[i] - lo) / (hi - lo || 1);
    md.data[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, (v - 0.12) / 0.7)) * 255);
  }
  mx.putImageData(md, 0, 0);
  return finishCutout(rawFull, mask);
}

/** Shared by the model path and tests: scale the 320px mask up, tighten the edge, fix light/colour, cut. */
export function finishCutout(rawFull: HTMLCanvasElement, mask: CanvasImageSource): Cutout {
  const W = rawFull.width;
  const H = rawFull.height;
  const fullMask = canvas(W, H);
  const fm = fullMask.getContext("2d", { willReadFrequently: true })!;
  fm.imageSmoothingQuality = "high";
  fm.filter = `blur(${Math.max(0.6, Math.max(W, H) / 1800)}px)`;
  fm.drawImage(mask, 0, 0, W, H);
  fm.filter = "none";
  // choke the edge a little so no rim of the old background is left around the product
  const md = fm.getImageData(0, 0, W, H);
  const a = md.data;
  for (let i = 3; i < a.length; i += 4) {
    const v = a[i];
    a[i] = v <= 70 ? 0 : v >= 235 ? 255 : Math.round(((v - 70) / 165) * 255);
  }
  fm.putImageData(md, 0, 0);

  const enhancedFull = enhance(rawFull, castGains(rawFull, a));

  // bounds
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (a[(y * W + x) * 4 + 3] > 40) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 <= x0 || y1 <= y0) throw new Error("no product found");
  const pad = 4;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(W, x1 + pad);
  y1 = Math.min(H, y1 + pad);

  const cut = (photo: HTMLCanvasElement) => {
    const full = canvas(W, H);
    const fx = full.getContext("2d")!;
    fx.drawImage(fullMask, 0, 0);
    fx.globalCompositeOperation = "source-in";
    fx.drawImage(photo, 0, 0);
    const crop = canvas(x1 - x0, y1 - y0);
    crop.getContext("2d")!.drawImage(full, x0, y0, crop.width, crop.height, 0, 0, crop.width, crop.height);
    return crop;
  };
  return { raw: cut(rawFull), enhanced: cut(enhancedFull), rawFull, enhancedFull };
}

/* ------------------------------------------------------------------ */
/* 3. backgrounds + "Quality style" placement                          */
/* ------------------------------------------------------------------ */

function paintBackground(g: CanvasRenderingContext2D, S: number, id: BgId): number {
  // returns the y of the "floor" line where the product stands
  let floor = S * 0.84;
  if (id === "white") {
    g.fillStyle = "#FFFFFF";
    g.fillRect(0, 0, S, S);
  } else if (id === "studio") {
    const r = g.createRadialGradient(S * 0.5, S * 0.35, 0, S * 0.5, S * 0.35, S * 0.8);
    r.addColorStop(0, "#F2F1EE");
    r.addColorStop(1, "#C9C6BF");
    g.fillStyle = r;
    g.fillRect(0, 0, S, S);
  } else if (id === "quality") {
    const r = g.createRadialGradient(S * 0.5, S * 0.3, 0, S * 0.5, S * 0.3, S * 0.75);
    r.addColorStop(0, "#2A2925");
    r.addColorStop(1, "#0E0E0E");
    g.fillStyle = r;
    g.fillRect(0, 0, S, S);
    const glow = g.createLinearGradient(0, S * 0.7, 0, S);
    glow.addColorStop(0, "rgba(201,162,74,0)");
    glow.addColorStop(1, "rgba(201,162,74,.20)");
    g.fillStyle = glow;
    g.fillRect(0, S * 0.7, S, S * 0.3);
  } else if (id === "wood") {
    floor = S * 0.8;
    const wall = g.createLinearGradient(0, 0, 0, S * 0.62);
    wall.addColorStop(0, "#EDE3D6");
    wall.addColorStop(1, "#E2D3C0");
    g.fillStyle = wall;
    g.fillRect(0, 0, S, S * 0.62);
    const wood = g.createLinearGradient(0, S * 0.62, 0, S);
    wood.addColorStop(0, "#B98B5E");
    wood.addColorStop(1, "#9C6F45");
    g.fillStyle = wood;
    g.fillRect(0, S * 0.62, S, S * 0.38);
    g.strokeStyle = "rgba(80,50,25,.22)";
    g.lineWidth = Math.max(1, S / 600);
    for (let i = -6; i <= 6; i++) {
      g.beginPath();
      g.moveTo(S / 2 + i * S * 0.07, S * 0.62);
      g.lineTo(S / 2 + i * S * 0.2, S);
      g.stroke();
    }
    g.fillStyle = "rgba(255,255,255,.18)";
    g.fillRect(0, S * 0.62, S, Math.max(2, S / 300));
  } else if (id === "street") {
    floor = S * 0.82;
    const sky = g.createLinearGradient(0, 0, 0, S * 0.64);
    sky.addColorStop(0, "#9FB3C8");
    sky.addColorStop(1, "#D8DEE4");
    g.fillStyle = sky;
    g.fillRect(0, 0, S, S * 0.64);
    g.save();
    g.filter = `blur(${Math.round(S / 90)}px)`;
    const blocks = [[0.02, 0.22, 0.16], [0.17, 0.3, 0.12], [0.3, 0.14, 0.18], [0.5, 0.26, 0.14], [0.65, 0.18, 0.2], [0.86, 0.28, 0.14]];
    blocks.forEach(([x, y, w], k) => {
      g.fillStyle = k % 2 ? "rgba(120,132,148,.55)" : "rgba(150,160,172,.55)";
      g.fillRect(S * x, S * y, S * w, S * (0.64 - y));
    });
    g.restore();
    const pave = g.createLinearGradient(0, S * 0.64, 0, S);
    pave.addColorStop(0, "#7D7F83");
    pave.addColorStop(1, "#5D5F63");
    g.fillStyle = pave;
    g.fillRect(0, S * 0.64, S, S * 0.36);
    g.strokeStyle = "rgba(255,255,255,.10)";
    g.lineWidth = Math.max(1, S / 500);
    for (let i = 1; i < 5; i++) {
      const y = S * 0.64 + (S * 0.36 * i * i) / 25;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(S, y);
      g.stroke();
    }
  }
  return floor;
}

async function toFile(c: HTMLCanvasElement, name: string): Promise<{ file: File; url: string }> {
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.9));
  return { file: new File([blob], `${name}.jpg`, { type: "image/jpeg" }), url: URL.createObjectURL(blob) };
}

/** Draw the product on a background (square, S px) in the "Quality style" and return a JPEG. */
export async function compose(cut: Cutout, id: BgId, S = 1600, name = "photo", improve = true): Promise<{ file: File; url: string }> {
  if (id === "original") return toFile(improve ? cut.enhancedFull : cut.rawFull, `${name}-original`);
  const out = canvas(S, S);
  const g = out.getContext("2d")!;
  const floor = paintBackground(g, S, id);
  const p = improve ? cut.enhanced : cut.raw;
  // same framing for every product: fits a 78%×66% box, standing on the floor line, centred
  const k = Math.min((S * 0.78) / p.width, (S * 0.66) / p.height);
  const w = p.width * k;
  const h = p.height * k;
  const x = (S - w) / 2;
  const y = floor - h;
  const dark = id === "quality";
  // soft ambient shadow
  g.save();
  g.filter = `blur(${Math.round(S / 45)}px)`;
  g.fillStyle = dark ? "rgba(0,0,0,.55)" : "rgba(0,0,0,.16)";
  g.beginPath();
  g.ellipse(S / 2, floor, w * 0.5, Math.max(8, h * 0.07), 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // tight contact shadow right under the product
  g.save();
  g.filter = `blur(${Math.round(S / 160)}px)`;
  g.fillStyle = dark ? "rgba(0,0,0,.8)" : "rgba(0,0,0,.32)";
  g.beginPath();
  g.ellipse(S / 2, floor - h * 0.004, w * 0.42, Math.max(3, h * 0.02), 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.imageSmoothingQuality = "high";
  g.drawImage(p, x, y, w, h);
  return toFile(out, `${name}-${id}`);
}

/* ------------------------------------------------------------------ */
/* 4. marketing images                                                 */
/* ------------------------------------------------------------------ */

export type PromoFormat = "post" | "story" | "ad";
export const PROMO_FORMATS: { id: PromoFormat; name: string; w: number; h: number }[] = [
  { id: "post", name: "פוסט · 1:1", w: 1080, h: 1080 },
  { id: "story", name: "סטורי · 9:16", w: 1080, h: 1920 },
  { id: "ad", name: "מודעה · 4:5", w: 1080, h: 1350 },
];

function wrap(g: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? line + " " + w : w;
    if (g.measureText(t).width > maxW && line) {
      lines.push(line);
      line = w;
      if (lines.length === maxLines - 1) break;
    } else line = t;
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

function pill(g: CanvasRenderingContext2D, cx: number, cy: number, text: string, font: string, bg: string, fg: string, padX: number, h: number, align: "center" | "right" | "left" = "center") {
  g.font = font;
  const w = g.measureText(text).width + padX * 2;
  const x = align === "center" ? cx - w / 2 : align === "left" ? cx : cx - w;
  g.fillStyle = bg;
  g.beginPath();
  (g as any).roundRect ? (g as any).roundRect(x, cy - h / 2, w, h, h / 2) : g.rect(x, cy - h / 2, w, h);
  g.fill();
  g.fillStyle = fg;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, x + w / 2, cy + 2);
}

/** Post / story / ad from the product photo, with headline, name and price. */
export async function makePromo(photo: Blob, f: PromoFormat, o: { headline: string; name: string; price: string; store: string; cta: string }): Promise<{ file: File; url: string }> {
  try {
    await (document as any).fonts?.load?.("700 40px Heebo");
  } catch {}
  const spec = PROMO_FORMATS.find((x) => x.id === f)!;
  const { w: W, h: H } = spec;
  const img = await createImageBitmap(photo);
  const c = canvas(W, H);
  const g = c.getContext("2d")!;
  g.direction = "rtl";
  const F = (wgt: number, px: number) => `${wgt} ${px}px Heebo, Arial, sans-serif`;
  const gold = "#C9A24A";

  if (f === "post") {
    const s = Math.max(W / img.width, H / img.height);
    g.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s);
    const grad = g.createLinearGradient(0, H * 0.62, 0, H);
    grad.addColorStop(0, "rgba(10,9,8,0)");
    grad.addColorStop(1, "rgba(10,9,8,.82)");
    g.fillStyle = grad;
    g.fillRect(0, H * 0.62, W, H * 0.38);
    if (o.headline) pill(g, W - 56, 86, o.headline, F(700, 38), gold, "#141414", 30, 72, "right");
    g.textAlign = "right";
    g.textBaseline = "alphabetic";
    g.fillStyle = "#FFFFFF";
    g.font = F(700, 54);
    const lines = wrap(g, o.name, W - 112 - 260, 2);
    lines.forEach((l, i) => g.fillText(l, W - 56, H - 70 - (lines.length - 1 - i) * 64));
    if (o.price) {
      g.textAlign = "left";
      g.fillStyle = gold;
      g.font = F(700, 64);
      g.direction = "ltr";
      g.fillText(o.price, 56, H - 70);
      g.direction = "rtl";
    }
  } else if (f === "story") {
    g.fillStyle = "#0E0E0E";
    g.fillRect(0, 0, W, H);
    // blurred photo as ambience
    g.save();
    g.filter = "blur(60px) brightness(.45)";
    const s0 = Math.max(W / img.width, H / img.height) * 1.1;
    g.drawImage(img, (W - img.width * s0) / 2, (H - img.height * s0) / 2, img.width * s0, img.height * s0);
    g.restore();
    const box = W - 120;
    const s = box / Math.max(img.width, img.height);
    const iw = img.width * s, ih = img.height * s;
    const iy = 420;
    g.save();
    g.beginPath();
    (g as any).roundRect ? (g as any).roundRect((W - iw) / 2, iy, iw, ih, 36) : g.rect((W - iw) / 2, iy, iw, ih);
    g.clip();
    g.drawImage(img, (W - iw) / 2, iy, iw, ih);
    g.restore();
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    if (o.headline) {
      g.fillStyle = gold;
      g.font = F(700, 84);
      wrap(g, o.headline, W - 140, 2).forEach((l, i) => g.fillText(l, W / 2, 250 + i * 96));
    }
    g.fillStyle = "#FFFFFF";
    g.font = F(700, 60);
    const ny = iy + ih + 120;
    const nl = wrap(g, o.name, W - 140, 2);
    nl.forEach((l, i) => g.fillText(l, W / 2, ny + i * 72));
    if (o.price) {
      g.fillStyle = gold;
      g.font = F(700, 72);
      g.direction = "ltr";
      g.fillText(o.price, W / 2, ny + nl.length * 72 + 40);
      g.direction = "rtl";
    }
    pill(g, W / 2, H - 230, o.cta, F(700, 44), "#FFFFFF", "#141414", 56, 104);
    g.fillStyle = "rgba(255,255,255,.7)";
    g.font = F(500, 34);
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    if (o.store) g.fillText(o.store, W / 2, H - 100);
  } else {
    // ad 4:5 – photo on top, white band with copy
    const top = W;
    const s = Math.max(W / img.width, top / img.height);
    g.drawImage(img, (W - img.width * s) / 2, (top - img.height * s) / 2, img.width * s, img.height * s);
    g.fillStyle = "#FFFFFF";
    g.fillRect(0, top, W, H - top);
    if (o.headline) pill(g, W - 48, 76, o.headline, F(700, 36), gold, "#141414", 28, 68, "right");
    g.textAlign = "right";
    g.textBaseline = "alphabetic";
    g.fillStyle = "#141414";
    g.font = F(700, 50);
    const nl = wrap(g, o.name, W - 96 - 330, 2);
    nl.forEach((l, i) => g.fillText(l, W - 48, top + 92 + i * 58));
    g.fillStyle = "#5C5A55";
    g.font = F(500, 32);
    if (o.store) g.fillText(o.store, W - 48, H - 48);
    if (o.price) {
      g.textAlign = "left";
      g.fillStyle = "#141414";
      g.font = F(700, 60);
      g.direction = "ltr";
      g.fillText(o.price, 48, top + 100);
      g.direction = "rtl";
    }
    pill(g, 48, H - 70, o.cta, F(700, 34), "#141414", "#FFFFFF", 34, 74, "left");
  }
  return toFile(c, `${f}`);
}
