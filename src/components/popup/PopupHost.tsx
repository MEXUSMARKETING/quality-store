"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import PopupView, { type LeadData } from "./PopupView";
import { pageGroup, type PublicPopup } from "@/lib/popups-shared";
import { submitPopupLead } from "@/app/popup-actions";

const KEY = (id: number) => `qpp:${id}`;

type Memo = { last?: number; done?: boolean };

function readMemo(id: number): Memo {
  try {
    return JSON.parse(localStorage.getItem(KEY(id)) || "{}") || {};
  } catch {
    return {};
  }
}
function writeMemo(id: number, m: Memo) {
  try {
    localStorage.setItem(KEY(id), JSON.stringify({ ...readMemo(id), ...m }));
  } catch {}
}
function seenThisSession(id: number) {
  try {
    return sessionStorage.getItem(KEY(id)) === "1";
  } catch {
    return false;
  }
}
function markSession(id: number) {
  try {
    sessionStorage.setItem(KEY(id), "1");
  } catch {}
}

function allowed(p: PublicPopup): boolean {
  const c = p.config;
  const m = readMemo(p.id);
  if (m.done) return false; // already signed up / used it
  if (c.frequency === "session" && seenThisSession(p.id)) return false;
  if (c.frequency === "once" && m.last) return false;
  if (c.frequency === "days" && m.last && Date.now() - m.last < c.days * 86400000) return false;
  return true;
}

function track(id: number, type: "view" | "click") {
  try {
    fetch("/api/popups/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, type }), keepalive: true }).catch(() => {});
  } catch {}
}

export default function PopupHost({ popups }: { popups: PublicPopup[] }) {
  const path = usePathname() || "/";
  const [open, setOpen] = useState<PublicPopup | null>(null);
  const [compact, setCompact] = useState(false);
  const shownRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const set = () => setCompact(mq.matches);
    set();
    mq.addEventListener?.("change", set);
    return () => mq.removeEventListener?.("change", set);
  }, []);

  // Pick the first eligible popup for this page and arm its trigger.
  useEffect(() => {
    if (!popups.length || open) return;
    const group = pageGroup(path);
    const mobile = window.matchMedia("(max-width: 767px)").matches;
    const p = popups.find(
      (x) =>
        !shownRef.current.has(x.id) &&
        x.config.pages.includes(group) &&
        (x.config.devices === "all" || (x.config.devices === "mobile") === mobile) &&
        allowed(x)
    );
    if (!p) return;

    let fired = false;
    const fire = () => {
      if (fired) return;
      fired = true;
      cleanup();
      shownRef.current.add(p.id);
      writeMemo(p.id, { last: Date.now() });
      markSession(p.id);
      track(p.id, "view");
      setOpen(p);
    };

    const timers: ReturnType<typeof setTimeout>[] = [];
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (max <= 0 || (window.scrollY / max) * 100 >= p.config.scroll) fire();
    };
    const onLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !e.relatedTarget) fire();
    };
    const cleanup = () => {
      timers.forEach(clearTimeout);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("mouseout", onLeave);
    };

    const c = p.config;
    if (c.trigger === "scroll") {
      window.addEventListener("scroll", onScroll, { passive: true });
    } else if (c.trigger === "exit") {
      if (mobile) timers.push(setTimeout(fire, Math.max(c.delay, 20) * 1000)); // no mouse on phones: fall back to time on page
      else document.addEventListener("mouseout", onLeave);
    } else {
      timers.push(setTimeout(fire, c.delay * 1000));
    }
    return cleanup;
  }, [path, popups, open]);

  // Escape closes; lock page scroll behind modal popups
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    const modal = ["center", "split", "fullscreen"].includes(open.config.layout);
    const prev = document.documentElement.style.overflow;
    if (modal) document.documentElement.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      if (modal) document.documentElement.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  const p = open;

  const onSubmit = async (d: LeadData) => {
    const r = await submitPopupLead(p.id, { ...d, page: path });
    if (r.ok) writeMemo(p.id, { done: true });
    return r;
  };

  return (
    <PopupView
      key={p.id}
      config={p.config}
      compact={compact}
      coupon={p.config.couponMode === "always" ? p.config.coupon : ""}
      onClose={() => setOpen(null)}
      onCta={() => track(p.id, "click")}
      onSubmit={onSubmit}
    />
  );
}
