type P = { size?: number; className?: string; stroke?: string; strokeWidth?: number };

const base = (size = 22, stroke = "currentColor", strokeWidth = 1.8) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke,
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export const BagIcon = ({ size, className, stroke, strokeWidth }: P) => (
  <svg {...base(size, stroke, strokeWidth)} className={className}><path d="M5 8h14l-1.2 12H6.2L5 8z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></svg>
);
export const SearchIcon = ({ size, className, stroke, strokeWidth }: P) => (
  <svg {...base(size, stroke, strokeWidth)} className={className}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
);
export const HeartIcon = ({ size, className, stroke, strokeWidth }: P) => (
  <svg {...base(size, stroke, strokeWidth)} className={className}><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" /></svg>
);
export const MenuIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 7h16M4 12h16M4 17h10" /></svg>
);
export const CloseIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const ChevronLeft = ({ size = 18, className, stroke, strokeWidth = 2 }: P) => (
  <svg {...base(size, stroke, strokeWidth)} className={className}><path d="M15 6l-6 6 6 6" /></svg>
);
export const ChevronRight = ({ size = 18, className, stroke, strokeWidth = 2 }: P) => (
  <svg {...base(size, stroke, strokeWidth)} className={className}><path d="M9 6l6 6-6 6" /></svg>
);
export const WhatsAppIcon = ({ size, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z" /><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8c-1-.5-1.8-1.3-2.3-2.3l.8-1-1-2z" /></svg>
);
export const TruckIcon = ({ size, className, stroke, strokeWidth }: P) => (
  <svg {...base(size, stroke, strokeWidth)} className={className}><path d="M3 6h11v10H3zM14 10h4l3 3v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></svg>
);
export const CardIcon = ({ size, className, stroke, strokeWidth }: P) => (
  <svg {...base(size, stroke, strokeWidth)} className={className}><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M7 15h4" /></svg>
);
export const TagIcon = ({ size, className, stroke, strokeWidth }: P) => (
  <svg {...base(size, stroke, strokeWidth)} className={className}><path d="M20 12l-8 8-9-9V3h8z" /><circle cx="7.5" cy="7.5" r="1.5" /></svg>
);
export const StarIcon = ({ size, className, stroke, strokeWidth }: P) => (
  <svg {...base(size, stroke, strokeWidth)} className={className}><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" /></svg>
);
export const ShieldIcon = ({ size, className, stroke, strokeWidth }: P) => (
  <svg {...base(size, stroke, strokeWidth)} className={className}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></svg>
);
export const PinIcon = ({ size, className, stroke, strokeWidth }: P) => (
  <svg {...base(size, stroke, strokeWidth)} className={className}><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>
);
export const CashIcon = ({ size, className, stroke, strokeWidth }: P) => (
  <svg {...base(size, stroke, strokeWidth)} className={className}><rect x="3" y="6" width="18" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>
);
export const LockIcon = ({ size, className, stroke, strokeWidth }: P) => (
  <svg {...base(size, stroke, strokeWidth)} className={className}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>
);
export const TrashIcon = ({ size = 18, className }: P) => (
  <svg {...base(size)} className={className}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
);
