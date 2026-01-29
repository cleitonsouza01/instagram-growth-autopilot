import type { DailySnapshot } from "../../../../storage/database";

interface GrowthChartProps {
  snapshots: DailySnapshot[];
}

/**
 * SVG-based line chart showing follower growth over time.
 * Lightweight — no external chart library needed.
 */
export default function GrowthChart({ snapshots }: GrowthChartProps) {
  if (snapshots.length < 2) {
    return (
      <div className="bg-gray-50 rounded-lg p-6 text-center text-sm text-muted">
        Not enough data yet. Growth chart will appear after 2+ days of snapshots.
      </div>
    );
  }

  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const followerCounts = snapshots.map((s) => s.followerCount);
  const minVal = Math.min(...followerCounts);
  const maxVal = Math.max(...followerCounts);
  const range = maxVal - minVal || 1;

  // Generate SVG path points
  const points = snapshots.map((s, i) => {
    const x = padding.left + (i / (snapshots.length - 1)) * chartW;
    const y =
      padding.top + chartH - ((s.followerCount - minVal) / range) * chartH;
    return { x, y, snapshot: s };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Area fill under the line
  const areaPath = `${linePath} L ${points[points.length - 1]!.x} ${padding.top + chartH} L ${points[0]!.x} ${padding.top + chartH} Z`;

  // Y-axis labels (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const value = minVal + (range * i) / 4;
    const y = padding.top + chartH - (i / 4) * chartH;
    return { value: Math.round(value), y };
  });

  // X-axis labels (show first, middle, last dates)
  const xLabels = [
    { label: formatDate(snapshots[0]!.date), x: points[0]!.x },
  ];
  if (snapshots.length > 2) {
    const mid = Math.floor(snapshots.length / 2);
    xLabels.push({
      label: formatDate(snapshots[mid]!.date),
      x: points[mid]!.x,
    });
  }
  xLabels.push({
    label: formatDate(snapshots[snapshots.length - 1]!.date),
    x: points[points.length - 1]!.x,
  });

  // Net growth indicator
  const firstCount = snapshots[0]!.followerCount;
  const lastCount = snapshots[snapshots.length - 1]!.followerCount;
  const totalGrowth = lastCount - firstCount;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-800">
          Follower Growth
        </h3>
        <span
          className={`text-sm font-bold ${totalGrowth >= 0 ? "text-success" : "text-danger"}`}
        >
          {totalGrowth >= 0 ? "+" : ""}
          {totalGrowth} ({snapshots.length} days)
        </span>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full bg-gray-50 rounded-lg"
      >
        {/* Grid lines */}
        {yTicks.map((tick) => (
          <line
            key={tick.value}
            x1={padding.left}
            y1={tick.y}
            x2={width - padding.right}
            y2={tick.y}
            stroke="#e5e7eb"
            strokeDasharray="4 4"
          />
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="rgb(99 102 241 / 0.1)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke="#6366f1" strokeWidth="2" />

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="#6366f1"
            stroke="white"
            strokeWidth="1.5"
          >
            <title>
              {p.snapshot.date}: {p.snapshot.followerCount} followers (
              {p.snapshot.netGrowth >= 0 ? "+" : ""}
              {p.snapshot.netGrowth})
            </title>
          </circle>
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick) => (
          <text
            key={tick.value}
            x={padding.left - 8}
            y={tick.y + 4}
            textAnchor="end"
            className="text-[10px] fill-gray-400"
          >
            {formatNumber(tick.value)}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((label, i) => (
          <text
            key={i}
            x={label.x}
            y={height - 8}
            textAnchor="middle"
            className="text-[10px] fill-gray-400"
          >
            {label.label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}
