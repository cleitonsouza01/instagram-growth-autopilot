interface CompetitorRankingProps {
  competitors: Array<{
    username: string;
    conversionRate: number;
    engaged: number;
  }>;
}

export default function CompetitorRanking({
  competitors,
}: CompetitorRankingProps) {
  if (competitors.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-muted">
        No competitor data yet. Start harvesting to see rankings.
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-800 mb-2">
        Competitor Effectiveness
      </h3>
      <div className="bg-gray-50 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-200">
              <th className="text-left px-3 py-2 font-medium">#</th>
              <th className="text-left px-3 py-2 font-medium">Competitor</th>
              <th className="text-right px-3 py-2 font-medium">Engaged</th>
              <th className="text-right px-3 py-2 font-medium">Conv. Rate</th>
            </tr>
          </thead>
          <tbody>
            {competitors.map((c, i) => (
              <tr
                key={c.username}
                className="border-b border-gray-100 last:border-0"
              >
                <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                <td className="px-3 py-2 text-gray-800 font-medium">
                  @{c.username}
                </td>
                <td className="px-3 py-2 text-right text-gray-600">
                  {c.engaged}
                </td>
                <td className="px-3 py-2 text-right font-medium text-primary">
                  {(c.conversionRate * 100).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
