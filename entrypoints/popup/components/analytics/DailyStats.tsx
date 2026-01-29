interface DailyStatsProps {
  likesToday: number;
  prospectsEngaged: number;
  queueDepth: number;
  dailyLimit: number;
}

export default function DailyStats({
  likesToday,
  prospectsEngaged,
  queueDepth,
  dailyLimit,
}: DailyStatsProps) {
  const progress = dailyLimit > 0 ? (likesToday / dailyLimit) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Daily progress</span>
        <span className="font-medium text-gray-700">
          {likesToday} / {dailyLimit} likes
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 pt-1">
        <StatBox label="Prospects engaged" value={prospectsEngaged} />
        <StatBox label="Queue depth" value={queueDepth} />
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-50 rounded-lg px-2.5 py-1.5">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}
