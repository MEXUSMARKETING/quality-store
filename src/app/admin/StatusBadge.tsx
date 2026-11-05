import { ORDER_STATUS } from "@/lib/config";

export default function StatusBadge({ status }: { status: string }) {
  const s = ORDER_STATUS[status] || { label: status, color: "#5F5E5A" };
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-bold whitespace-nowrap" style={{ color: s.color }}>
      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
      {s.label}
    </span>
  );
}
