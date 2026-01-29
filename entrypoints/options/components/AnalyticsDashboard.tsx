import { useEffect, useState } from "react";
import {
  getAnalyticsSummary,
  type AnalyticsSummary,
  type AnalyticsPeriod,
} from "../../../lib/engagement-analytics";
import { getGrowthHistory, getUnfollowers } from "../../../lib/follower-tracker";
import type { DailySnapshot } from "../../../storage/database";
import SummaryCards from "./analytics/SummaryCards";
import GrowthChart from "./analytics/GrowthChart";
import CompetitorRanking from "./analytics/CompetitorRanking";
import TimeHeatmap from "./analytics/TimeHeatmap";
import ActionBreakdown from "./analytics/ActionBreakdown";
import ExportButton from "./analytics/ExportButton";
import UnfollowerList from "./analytics/UnfollowerList";
import LikedPostsList from "./analytics/LikedPostsList";

const PERIODS: { label: string; value: AnalyticsPeriod }[] = [
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" },
  { label: "90 days", value: "90d" },
  { label: "All time", value: "all" },
];

export default function AnalyticsDashboard() {
  const [period, setPeriod] = useState<AnalyticsPeriod>("30d");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [unfollowers, setUnfollowers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      getAnalyticsSummary(period),
      getGrowthHistory(periodToDays(period)),
      getUnfollowers(periodToDays(period)),
    ])
      .then(([s, h, u]) => {
        setSummary(s);
        setSnapshots(h);
        setUnfollowers(u);
      })
      .catch((err) => {
        console.error("Failed to load analytics:", err);
      })
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="text-center py-12 text-muted text-sm">
        Loading analytics...
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-12 text-muted text-sm">
        Failed to load analytics data.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Period:</span>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                period === p.value
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <SummaryCards summary={summary} />

      {/* Growth chart */}
      <GrowthChart snapshots={snapshots} />

      {/* Two-column layout for detailed analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ActionBreakdown
          successful={summary.actionBreakdown.successful}
          failed={summary.actionBreakdown.failed}
          blocked={summary.actionBreakdown.blocked}
        />
        <CompetitorRanking competitors={summary.bestCompetitors} />
      </div>

      {/* Time heatmap + unfollowers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <TimeHeatmap hours={summary.bestHours} />
        <UnfollowerList unfollowers={unfollowers} />
      </div>

      {/* Liked posts */}
      <LikedPostsList days={periodToDays(period)} />

      {/* Export */}
      <ExportButton />
    </div>
  );
}

function periodToDays(period: AnalyticsPeriod): number {
  switch (period) {
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "90d":
      return 90;
    case "all":
      return 3650;
  }
}
