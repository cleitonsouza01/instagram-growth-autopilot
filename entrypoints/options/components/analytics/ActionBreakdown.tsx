interface ActionBreakdownProps {
  successful: number;
  failed: number;
  blocked: number;
}

export default function ActionBreakdown({
  successful,
  failed,
  blocked,
}: ActionBreakdownProps) {
  const total = successful + failed + blocked;

  if (total === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-sm text-muted">
        No actions performed yet.
      </div>
    );
  }

  const successPct = (successful / total) * 100;
  const failedPct = (failed / total) * 100;
  const blockedPct = (blocked / total) * 100;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-800 mb-2">
        Action Breakdown
      </h3>
      <div className="bg-gray-50 rounded-lg p-3 space-y-3">
        {/* Stacked bar */}
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden flex">
          {successPct > 0 && (
            <div
              className="bg-success h-full"
              style={{ width: `${successPct}%` }}
              title={`Successful: ${successful}`}
            />
          )}
          {failedPct > 0 && (
            <div
              className="bg-warning h-full"
              style={{ width: `${failedPct}%` }}
              title={`Failed: ${failed}`}
            />
          )}
          {blockedPct > 0 && (
            <div
              className="bg-danger h-full"
              style={{ width: `${blockedPct}%` }}
              title={`Blocked: ${blocked}`}
            />
          )}
        </div>

        {/* Legend */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-success" />
              <span className="text-xs text-gray-500">Success</span>
            </div>
            <p className="text-sm font-bold text-gray-900">{successful}</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-warning" />
              <span className="text-xs text-gray-500">Failed</span>
            </div>
            <p className="text-sm font-bold text-gray-900">{failed}</p>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-danger" />
              <span className="text-xs text-gray-500">Blocked</span>
            </div>
            <p className="text-sm font-bold text-gray-900">{blocked}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
