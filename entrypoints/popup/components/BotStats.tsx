interface BotStatsProps {
  totalProspects: number;
  botsDetected: number;
  scannedCount: number;
}

export default function BotStats({
  totalProspects,
  botsDetected,
  scannedCount,
}: BotStatsProps) {
  const botRate =
    scannedCount > 0 ? ((botsDetected / scannedCount) * 100).toFixed(1) : "0";

  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      <div className="p-2 bg-gray-50 rounded">
        <div className="text-sm font-bold text-gray-800">
          {totalProspects}
        </div>
        <div className="text-xs text-gray-500">Prospects</div>
      </div>
      <div className="p-2 bg-gray-50 rounded">
        <div className="text-sm font-bold text-red-600">{botsDetected}</div>
        <div className="text-xs text-gray-500">Bots Found</div>
      </div>
      <div className="p-2 bg-gray-50 rounded">
        <div className="text-sm font-bold text-gray-800">{botRate}%</div>
        <div className="text-xs text-gray-500">Bot Rate</div>
      </div>
    </div>
  );
}
