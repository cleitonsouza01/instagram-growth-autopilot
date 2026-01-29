interface TimeHeatmapProps {
  hours: Array<{ hour: number; actions: number; successRate: number }>;
}

export default function TimeHeatmap({ hours }: TimeHeatmapProps) {
  const maxActions = Math.max(...hours.map((h) => h.actions), 1);

  // Only show hours that have data or are in the typical active range
  const relevantHours = hours.filter(
    (h) => h.actions > 0 || (h.hour >= 6 && h.hour <= 23),
  );

  if (relevantHours.every((h) => h.actions === 0)) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-muted">
        No activity data yet. Engagement times will appear after actions are performed.
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-800 mb-2">
        Activity by Hour
      </h3>
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="grid grid-cols-12 gap-1">
          {relevantHours
            .sort((a, b) => a.hour - b.hour)
            .map((h) => {
              const intensity = h.actions / maxActions;
              const bgColor = h.actions === 0
                ? "bg-gray-100"
                : intensity > 0.7
                  ? "bg-primary"
                  : intensity > 0.4
                    ? "bg-indigo-300"
                    : "bg-indigo-200";
              const textColor = intensity > 0.7 ? "text-white" : "text-gray-600";

              return (
                <div
                  key={h.hour}
                  className={`${bgColor} rounded p-1.5 text-center`}
                  title={`${formatHour(h.hour)}: ${h.actions} actions, ${(h.successRate * 100).toFixed(0)}% success`}
                >
                  <p className={`text-[9px] ${textColor}`}>
                    {formatHour(h.hour)}
                  </p>
                  <p className={`text-[10px] font-bold ${textColor}`}>
                    {h.actions > 0 ? h.actions : "-"}
                  </p>
                </div>
              );
            })}
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] text-gray-400">
          <span>Less active</span>
          <div className="flex gap-1">
            <div className="w-3 h-3 rounded bg-gray-100" />
            <div className="w-3 h-3 rounded bg-indigo-200" />
            <div className="w-3 h-3 rounded bg-indigo-300" />
            <div className="w-3 h-3 rounded bg-primary" />
          </div>
          <span>Most active</span>
        </div>
      </div>
    </div>
  );
}

function formatHour(h: number): string {
  if (h === 0) return "12a";
  if (h < 12) return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}
