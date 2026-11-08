import type { Chart, ValType } from "@/lib/reports";
import { fmtVal } from "@/lib/reports";

/* Server-rendered SVG charts (same approach as the dashboard: paths computed on the server). */

const W = 640;
const H = 200;

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
}

function LineChart({ chart }: { chart: Extract<Chart, { kind: "line" }> }) {
  const len = Math.max(...chart.series.map((s) => s.values.length), 1);
  const maxY = niceMax(Math.max(0, ...chart.series.flatMap((s) => s.values)));
  const x = (i: number) => (len <= 1 ? W / 2 : (i / (len - 1)) * W);
  const y = (v: number) => H - 10 - (Math.max(0, v) / maxY) * (H - 30);
  const path = (vals: number[]) => vals.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const main = chart.series[0];
  const area = main && main.values.length > 1 ? `${path(main.values)} L${W} ${H} L0 ${H} Z` : "";
  const ticks = len <= 1 ? [0] : Array.from(new Set([0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * (len - 1)))));
  const total = (vals: number[]) => vals.reduce((a, b) => a + b, 0);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-[16px] font-bold">{chart.title}</h2>
        <div className="flex gap-3.5 text-[12px] text-adm-muted flex-wrap">
          {chart.series.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              {s.dashed ? <span className="w-3.5 border-t-2 border-dashed" style={{ borderColor: s.color }} /> : <span className="w-3.5 h-[3px] rounded" style={{ background: s.color }} />}
              {s.name}
            </span>
          ))}
        </div>
      </div>
      <div className="relative" dir="ltr">
        <span className="absolute top-0 left-1 text-[11px] text-adm-muted bg-white/80 px-1 rounded">{fmtVal(maxY, chart.type)}</span>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height="220"
          preserveAspectRatio="none"
          role="img"
          aria-label={`${chart.title}: ${chart.series.map((s) => `${s.name} ${fmtVal(total(s.values), chart.type as ValType)}`).join(", ")}`}
        >
          <path d={`M0 ${H * 0.25}H${W}M0 ${H * 0.5}H${W}M0 ${H * 0.75}H${W}`} stroke="#F0EEF6" />
          {area && <path d={area} fill={main.color} fillOpacity="0.08" />}
          {[...chart.series].reverse().map((s) => (
            <path
              key={s.name}
              d={s.values.length === 1 ? `M${x(0) - 4} ${y(s.values[0])} H${x(0) + 4}` : path(s.values)}
              stroke={s.color}
              strokeWidth={s.dashed ? 2 : 2.5}
              strokeDasharray={s.dashed ? "5 5" : undefined}
              fill="none"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={`M0 ${H}H${W}`} stroke="#E8E5F3" />
        </svg>
      </div>
      <div className="flex justify-between text-[12px] text-adm-muted" dir="ltr">
        {ticks.map((i) => <span key={i}>{chart.labels[i] ?? ""}</span>)}
      </div>
    </div>
  );
}

function BarsChart({ chart }: { chart: Extract<Chart, { kind: "bars" }> }) {
  const items = chart.items;
  const hasPrev = items.some((i) => i.prev !== null && i.prev !== undefined);
  const maxV = Math.max(1, ...items.map((i) => Math.max(0, i.value, Number(i.prev) || 0)));
  const short = items.length <= 16 && items.every((i) => i.label.length <= 10);

  const legend = hasPrev && (
    <div className="flex gap-3.5 text-[12px] text-adm-muted">
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-adm-blue" />התקופה הנוכחית</span>
      <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#C5CEDB]" />התקופה הקודמת</span>
    </div>
  );

  if (short) {
    // vertical columns (sizes, categories)
    const n = Math.max(1, items.length);
    const slot = W / n;
    const bw = Math.min(46, slot * (hasPrev ? 0.36 : 0.6));
    const y = (v: number) => (Math.max(0, v) / maxV) * (H - 26);
    return (
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h2 className="text-[16px] font-bold">{chart.title}</h2>
          {legend}
        </div>
        <div dir="ltr">
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="220" role="img" aria-label={`${chart.title}: ${items.map((i) => `${i.label} ${fmtVal(i.value, chart.type)}`).join(", ")}`}>
            <path d={`M0 ${H * 0.25}H${W}M0 ${H * 0.5}H${W}M0 ${H * 0.75}H${W}`} stroke="#F0EEF6" />
            {/* RTL reading order: first item on the right */}
            {items.map((it, i) => {
              const cx = W - (i + 0.5) * slot;
              const h = y(it.value);
              const ph = hasPrev ? y(Number(it.prev) || 0) : 0;
              return (
                <g key={i}>
                  {hasPrev && <rect x={cx + 2} y={H - ph} width={bw} height={ph} rx="3" fill="#C5CEDB"><title>{`${it.label} – תקופה קודמת: ${fmtVal(it.prev ?? 0, chart.type)}`}</title></rect>}
                  <rect x={hasPrev ? cx - bw - 2 : cx - bw / 2} y={H - h} width={bw} height={h} rx="3" fill="#6C1CF5"><title>{`${it.label}: ${fmtVal(it.value, chart.type)}`}</title></rect>
                  {it.value > 0 && (
                    <text x={hasPrev ? cx - bw / 2 - 2 : cx} y={H - h - 6} textAnchor="middle" fontSize="12" fill="#17142E" fontWeight="600">
                      {chart.type === "money" ? fmtVal(it.value, "money") : Math.round(it.value)}
                    </text>
                  )}
                </g>
              );
            })}
            <path d={`M0 ${H}H${W}`} stroke="#E8E5F3" />
          </svg>
        </div>
        <div className="flex text-[12px] text-adm-muted" dir="rtl">
          {items.map((it, i) => <span key={i} className="flex-1 text-center truncate" title={it.label}>{it.label}</span>)}
        </div>
      </div>
    );
  }

  // horizontal bars (product names)
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h2 className="text-[16px] font-bold">{chart.title}</h2>
        {legend}
      </div>
      <ul className="flex flex-col gap-2.5">
        {items.map((it, i) => (
          <li key={i} className="flex flex-col gap-1">
            <div className="flex justify-between gap-3 text-[14px]">
              <span className="truncate" title={it.label}>{it.label}</span>
              <b className="whitespace-nowrap">{fmtVal(it.value, chart.type)}{hasPrev && <span className="text-adm-muted font-normal text-[12px]"> · קודם {fmtVal(it.prev ?? 0, chart.type)}</span>}</b>
            </div>
            <svg viewBox="0 0 100 8" width="100%" height="8" preserveAspectRatio="none" aria-hidden="true">
              <rect x="0" y="0" width="100" height={hasPrev ? 4 : 8} rx="2" fill="#F0EEF6" />
              <rect x={100 - (Math.max(0, it.value) / maxV) * 100} y="0" width={(Math.max(0, it.value) / maxV) * 100} height={hasPrev ? 4 : 8} rx="2" fill="#6C1CF5" />
              {hasPrev && <rect x={100 - (Math.max(0, Number(it.prev) || 0) / maxV) * 100} y="5" width={(Math.max(0, Number(it.prev) || 0) / maxV) * 100} height="3" rx="1.5" fill="#9AA6B8" />}
            </svg>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ReportChart({ chart }: { chart: Chart }) {
  if (chart.kind === "line") return <LineChart chart={chart} />;
  if (!chart.items.length) return null;
  return <BarsChart chart={chart} />;
}
