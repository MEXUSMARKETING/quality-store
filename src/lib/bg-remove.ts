"use client";

/* Background replacement that runs entirely in the browser – no account, no API key, no per-photo cost.
   1. U²-Net-P (Apache-2.0, 4.6MB, served from /models) finds the product and gives a soft mask.
   2. The product is cut out unchanged (its real colours and details stay as photographed)
      and placed on a drawn background with a natural contact shadow.
   onnxruntime-web is loaded on demand from jsDelivr (pinned version). */

const ORT_VERSION = "1.19.2";
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
const MODEL_URL = "/models/u2netp.onnx";
const SIZE = 320;

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

/** Warm up early (e.g. when the identify step opens) so the background step feels instant. */
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

export type Cutout = {
  /** the product with a transparent background, cropped to its bounds */
  canvas: HTMLCanvasElement;
  /** original photo (for "המקורי") */
  source: ImageBitmap;
};

/** Find the product in the photo and cut it out. */
export async function cutOut(file: Blob): Promise<Cutout> {
  await preloadCutout();
  const session = await sessionPromise!;
  const ort = (window as any).ort;
  const bmp = await createImageBitmap(file);

  // model input: 320×320, ImageNet-normalised, scaled by the image max (as U²-Net was trained)
  const c = document.createElement("canvas");
  c.width = SIZE;
  c.height = SIZE;
  const cx = c.getContext("2d", { willReadFrequently: true })!;
  cx.drawImage(bmp, 0, 0, SIZE, SIZE);
  const px = cx.getImageData(0, 0, SIZE, SIZE).data;
  let max = 1;
  for (let i = 0; i < px.length; i += 4) max = Math.max(max, px[i], px[i + 1], px[i + 2]);
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  const n = SIZE * SIZE;
  const input = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    for (let ch = 0; ch < 3; ch++) input[ch * n + i] = (px[i * 4 + ch] / max - mean[ch]) / std[ch];
  }
  const feeds: Record<string, any> = { [session.inputNames[0]]: new ort.Tensor("float32", input, [1, 3, SIZE, SIZE]) };
  const out = await session.run(feeds);
  const pred: Float32Array = out[session.outputNames[0]].data;

  // normalise, then sharpen the edge a little so the cut looks clean (soft, not jagged)
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < n; i++) {
    if (pred[i] < lo) lo = pred[i];
    if (pred[i] > hi) hi = pred[i];
  }
  const mask = document.createElement("canvas");
  mask.width = SIZE;
  mask.height = SIZE;
  const mx = mask.getContext("2d")!;
  const md = mx.createImageData(SIZE, SIZE);
  for (let i = 0; i < n; i++) {
    const v = (pred[i] - lo) / (hi - lo || 1);
    const a = Math.max(0, Math.min(1, (v - 0.12) / 0.7));
    md.data[i * 4 + 3] = Math.round(a * 255);
  }
  mx.putImageData(md, 0, 0);

  // full-resolution cutout (long side up to 1600px)
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const W = Math.round(bmp.width * scale);
  const H = Math.round(bmp.height * scale);
  const full = document.createElement("canvas");
  full.width = W;
  full.height = H;
  const fx = full.getContext("2d", { willReadFrequently: true })!;
  fx.imageSmoothingQuality = "high";
  fx.drawImage(mask, 0, 0, W, H);
  fx.globalCompositeOperation = "source-in";
  fx.drawImage(bmp, 0, 0, W, H);
  fx.globalCompositeOperation = "source-over";

  // crop to the product's bounds
  const data = fx.getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (data[(y * W + x) * 4 + 3] > 40) {
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
  const crop = document.createElement("canvas");
  crop.width = x1 - x0;
  crop.height = y1 - y0;
  crop.getContext("2d")!.drawImage(full, x0, y0, crop.width, crop.height, 0, 0, crop.width, crop.height);
  return { canvas: crop, source: bmp };
}

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
    // planks in perspective
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
    // soft, out-of-focus buildings
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

/** Draw the product on a background (square, S px) and return a JPEG file. */
export async function compose(cut: Cutout, id: BgId, S = 1200, name = "photo"): Promise<{ file: File; url: string }> {
  const out = document.createElement("canvas");
  if (id === "original") {
    const scale = Math.min(1, 1600 / Math.max(cut.source.width, cut.source.height));
    out.width = Math.round(cut.source.width * scale);
    out.height = Math.round(cut.source.height * scale);
    out.getContext("2d")!.drawImage(cut.source, 0, 0, out.width, out.height);
  } else {
    out.width = S;
    out.height = S;
    const g = out.getContext("2d")!;
    const floor = paintBackground(g, S, id);
    const p = cut.canvas;
    const k = Math.min((S * 0.78) / p.width, (S * 0.68) / p.height);
    const w = p.width * k;
    const h = p.height * k;
    const x = (S - w) / 2;
    const y = floor - h;
    // contact shadow
    const dark = id === "quality";
    g.save();
    g.filter = `blur(${Math.round(S / 70)}px)`;
    g.fillStyle = dark ? "rgba(0,0,0,.65)" : "rgba(0,0,0,.30)";
    g.beginPath();
    g.ellipse(S / 2, floor - h * 0.01, w * 0.46, Math.max(6, h * 0.045), 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
    g.imageSmoothingQuality = "high";
    g.drawImage(p, x, y, w, h);
  }
  const blob: Blob = await new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.9));
  const file = new File([blob], `${name}-${id}.jpg`, { type: "image/jpeg" });
  return { file, url: URL.createObjectURL(blob) };
}
