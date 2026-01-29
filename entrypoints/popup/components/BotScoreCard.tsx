interface BotScoreCardProps {
  averageScore: number;
  distribution: { low: number; medium: number; high: number };
}

function getScoreColor(score: number): string {
  if (score < 0.3) return "text-green-600";
  if (score < 0.6) return "text-yellow-600";
  return "text-red-600";
}

export default function BotScoreCard({
  averageScore,
  distribution,
}: BotScoreCardProps) {
  const total = distribution.low + distribution.medium + distribution.high;

  return (
    <div className="p-3 bg-gray-50 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">
          Bot Detection
        </span>
        <span className={`text-sm font-bold ${getScoreColor(averageScore)}`}>
          {(averageScore * 100).toFixed(0)}% avg
        </span>
      </div>

      {total > 0 && (
        <>
          {/* Distribution bar */}
          <div className="flex h-2 rounded-full overflow-hidden bg-gray-200">
            {distribution.low > 0 && (
              <div
                className="bg-green-400"
                style={{ width: `${(distribution.low / total) * 100}%` }}
              />
            )}
            {distribution.medium > 0 && (
              <div
                className="bg-yellow-400"
                style={{ width: `${(distribution.medium / total) * 100}%` }}
              />
            )}
            {distribution.high > 0 && (
              <div
                className="bg-red-400"
                style={{ width: `${(distribution.high / total) * 100}%` }}
              />
            )}
          </div>

          {/* Legend */}
          <div className="flex justify-between text-xs text-gray-500">
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />
              {distribution.low} clean
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 mr-1" />
              {distribution.medium} suspect
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />
              {distribution.high} bot
            </span>
          </div>
        </>
      )}

      {total === 0 && (
        <p className="text-xs text-gray-400">No prospects scanned yet</p>
      )}
    </div>
  );
}
