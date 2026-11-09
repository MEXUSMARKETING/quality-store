"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RPointerEvent = { clientX: number; clientY: number; buttons: number; pointerType: string; pointerId: number; target: EventTarget; preventDefault(): void };
import { recut, type Cutout } from "@/lib/bg-remove";

/* Manual touch-up of the cut-out: a finger/mouse brush that erases leftovers (a reflection, a hand,
   part of the floor) or restores parts the AI missed. Edits the full-resolution mask. */

type Mode = "erase" | "restore";
const MAX_UNDO = 8;

function cloneCanvas(c: HTMLCanvasElement) {
  const n = document.createElement("canvas");
  n.width = c.width;
  n.height = c.height;
  n.getContext("2d")!.drawImage(c, 0, 0);
  return n;
}

export default function TouchUp({ cut, onDone, onCancel }: { cut: Cutout; onDone: (c: Cutout) => void; onCancel: () => void }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(cloneCanvas(cut.mask));
  const original = useRef<HTMLCanvasElement>(cloneCanvas(cut.mask));
  const undo = useRef<HTMLCanvasElement[]>([]);
  const last = useRef<{ x: number; y: number } | null>(null);
  const raf = useRef<number | null>(null);
  const [mode, setMode] = useState<Mode>("erase");
  const [size, setSize] = useState(26);
  const [undoCount, setUndoCount] = useState(0);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [view, setView] = useState({ w: 300, h: 300, scale: 1 });

  const W = cut.rawFull.width;
  const H = cut.rawFull.height;

  // fit the photo into the available area
  useEffect(() => {
    const fit = () => {
      const el = wrapRef.current;
      if (!el) return;
      const bw = el.clientWidth;
      const bh = el.clientHeight;
      const scale = Math.min(bw / W, bh / H);
      setView({ w: Math.round(W * scale), h: Math.round(H * scale), scale });
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [W, H]);

  const render = useCallback(() => {
    raf.current = null;
    const c = viewRef.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(view.w * dpr);
    const h = Math.round(view.h * dpr);
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const g = c.getContext("2d")!;
    // checkerboard = transparent
    const t = Math.max(8, Math.round(12 * dpr));
    for (let y = 0; y < h; y += t) for (let x = 0; x < w; x += t) {
      g.fillStyle = ((x / t + y / t) & 1) === 0 ? "#2A2640" : "#353052";
      g.fillRect(x, y, t, t);
    }
    // faint ghost of the whole photo, so you can see what to restore
    g.globalAlpha = 0.28;
    g.drawImage(cut.rawFull, 0, 0, w, h);
    g.globalAlpha = 1;
    // the product as it will be cut
    const tmp = document.createElement("canvas");
    tmp.width = w;
    tmp.height = h;
    const tx = tmp.getContext("2d")!;
    tx.drawImage(maskRef.current, 0, 0, w, h);
    tx.globalCompositeOperation = "source-in";
    tx.drawImage(cut.rawFull, 0, 0, w, h);
    g.drawImage(tmp, 0, 0);
  }, [cut.rawFull, view]);

  const schedule = useCallback(() => {
    if (raf.current == null) raf.current = requestAnimationFrame(render);
  }, [render]);

  useEffect(() => {
    schedule();
  }, [schedule]);

  const toImage = (e: RPointerEvent) => {
    const r = viewRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, vx: e.clientX - r.left, vy: e.clientY - r.top };
  };

  const dab = (x: number, y: number) => {
    const g = maskRef.current.getContext("2d")!;
    const rad = size / view.scale; // brush size is in screen pixels
    const grad = g.createRadialGradient(x, y, rad * 0.55, x, y, rad);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.globalCompositeOperation = mode === "erase" ? "destination-out" : "source-over";
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = "source-over";
  };

  const stroke = (x: number, y: number) => {
    const p = last.current;
    if (p) {
      const step = Math.max(1, size / view.scale / 3);
      const d = Math.hypot(x - p.x, y - p.y);
      for (let s = step; s < d; s += step) dab(p.x + ((x - p.x) * s) / d, p.y + ((y - p.y) * s) / d);
    }
    dab(x, y);
    last.current = { x, y };
    schedule();
  };

  const down = (e: RPointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    undo.current.push(cloneCanvas(maskRef.current));
    if (undo.current.length > MAX_UNDO) undo.current.shift();
    setUndoCount(undo.current.length);
    last.current = null;
    const p = toImage(e);
    setCursor({ x: p.vx, y: p.vy });
    stroke(p.x, p.y);
  };
  const move = (e: RPointerEvent) => {
    const p = toImage(e);
    setCursor({ x: p.vx, y: p.vy });
    if (e.buttons || e.pointerType === "touch") {
      if (last.current) stroke(p.x, p.y);
    }
  };
  const up = () => {
    last.current = null;
  };

  const doUndo = () => {
    const prev = undo.current.pop();
    if (!prev) return;
    const g = maskRef.current.getContext("2d")!;
    g.clearRect(0, 0, W, H);
    g.drawImage(prev, 0, 0);
    setUndoCount(undo.current.length);
    schedule();
  };
  const reset = () => {
    undo.current.push(cloneCanvas(maskRef.current));
    setUndoCount(undo.current.length);
    const g = maskRef.current.getContext("2d")!;
    g.clearRect(0, 0, W, H);
    g.drawImage(original.current, 0, 0);
    schedule();
  };
  const finish = () => {
    try {
      onDone(recut({ rawFull: cut.rawFull, enhancedFull: cut.enhancedFull, mask: maskRef.current }));
    } catch {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-[95] bg-[#07051A] text-white flex flex-col" dir="rtl" role="dialog" aria-modal="true" aria-label="תיקון החיתוך">
      <div className="mx-auto w-full max-w-[560px] h-[100dvh] flex flex-col">
        <header className="flex items-center justify-between gap-3 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-2">
          <button type="button" onClick={onCancel} aria-label="ביטול" className="w-11 h-11 rounded-[14px] border border-white/15 bg-white/[.06] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
          <div className="flex flex-col items-center">
            <b className="text-[17px]">תיקון החיתוך</b>
            <span className="text-[12px] text-[#B4AED6]">מעבירים אצבע על מה שצריך לתקן</span>
          </div>
          <button type="button" onClick={finish} className="h-11 px-4 rounded-[14px] bg-white text-[#07051A] text-[14px] font-bold">סיום</button>
        </header>

        <div ref={wrapRef} className="relative flex-1 min-h-0 mx-3 my-2 flex items-center justify-center overflow-hidden rounded-2xl">
          <canvas
            ref={viewRef}
            style={{ width: view.w, height: view.h, touchAction: "none", cursor: "none" }}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            onPointerLeave={() => setCursor(null)}
            aria-label="תמונת המוצר לתיקון"
            className="rounded-xl"
          />
          {cursor && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute rounded-full border-2"
              style={{
                width: size * 2,
                height: size * 2,
                left: `calc(50% - ${view.w / 2}px + ${cursor.x - size}px)`,
                top: `calc(50% - ${view.h / 2}px + ${cursor.y - size}px)`,
                borderColor: mode === "erase" ? "#FF8FAE" : "#7CF3B5",
                background: mode === "erase" ? "rgba(255,77,122,.15)" : "rgba(124,243,181,.15)",
              }}
            />
          )}
        </div>

        <div className="px-4 pb-[max(22px,env(safe-area-inset-bottom))] pt-1 flex flex-col gap-3">
          <div role="radiogroup" aria-label="מצב מברשת" className="grid grid-cols-2 gap-1 p-1 rounded-[14px] bg-white/[.07]">
            <button type="button" role="radio" aria-checked={mode === "erase"} onClick={() => setMode("erase")} className={`h-11 rounded-[11px] text-[14px] font-bold flex items-center justify-center gap-2 ${mode === "erase" ? "bg-white text-[#07051A]" : "text-[#E3D6FF]"}`}>
              <span className="w-3 h-3 rounded-full bg-[#FF4D7A]" aria-hidden="true" /> מחיקה
            </button>
            <button type="button" role="radio" aria-checked={mode === "restore"} onClick={() => setMode("restore")} className={`h-11 rounded-[11px] text-[14px] font-bold flex items-center justify-center gap-2 ${mode === "restore" ? "bg-white text-[#07051A]" : "text-[#E3D6FF]"}`}>
              <span className="w-3 h-3 rounded-full bg-[#2BD48A]" aria-hidden="true" /> החזרה
            </button>
          </div>
          <label className="flex items-center gap-3 text-[13px] text-[#B4AED6]">
            גודל מברשת
            <input type="range" min={8} max={70} value={size} onChange={(e) => setSize(Number(e.target.value))} className="flex-1 accent-[#8F5BFF]" />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={doUndo} disabled={!undoCount} className="flex-1 h-11 rounded-[14px] border border-white/20 text-[14px] font-semibold disabled:opacity-35 flex items-center justify-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" /></svg>
              ביטול פעולה
            </button>
            <button type="button" onClick={reset} className="flex-1 h-11 rounded-[14px] border border-white/20 text-[14px] font-semibold">חזרה לחיתוך האוטומטי</button>
          </div>
          <p className="text-[12px] text-[#8F89B3] text-center">המשבצות = שקוף. „מחיקה” מוריד שאריות (השתקפות, רצפה, יד), „החזרה” מחזיר חלק שנחתך בטעות.</p>
        </div>
      </div>
    </div>
  );
}
