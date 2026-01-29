import type { AnalyticsSummary } from "../../../../lib/engagement-analytics";

interface SummaryCardsProps {
  summary: AnalyticsSummary;
}

export default function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Card
        label="Total Likes"
        value={String(summary.totalLikes)}
        sub={`${summary.totalProspectsEngaged} prospects`}
      />
      <Card
        label="Net Growth"
        value={`${summary.netGrowth >= 0 ? "+" : ""}${summary.netGrowth}`}
        sub={`${summary.dailyGrowthRate >= 0 ? "+" : ""}${summary.dailyGrowthRate.toFixed(1)}/day`}
        color={summary.netGrowth >= 0 ? "text-success" : "text-danger"}
      />
      <Card
        label="Conversion Rate"
        value={`${(summary.conversionRate * 100).toFixed(1)}%`}
        sub={`${summary.newFollowers} new followers`}
        color="text-primary"
      />
      <Card
        label="Likes / Follow"
        value={
          summary.likesPerFollow > 0
            ? summary.likesPerFollow.toFixed(1)
            : "N/A"
        }
        sub="avg. likes needed"
      />
    </div>
  );
}

function Card({
  label,
  value,
  sub,
  color = "text-gray-900",
}: {
  label: string;
  value: string;
  sub: string;
  color?: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
    </div>
  );
}
