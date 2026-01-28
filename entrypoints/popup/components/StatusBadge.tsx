interface EngineStatus {
  state: string;
  todayLikes: number;
  lastAction: number | null;
  cooldownEndsAt: number | null;
}

const STATE_COLORS: Record<string, string> = {
  idle: "bg-gray-100 text-gray-700",
  harvesting: "bg-blue-100 text-blue-700",
  engaging: "bg-green-100 text-green-700",
  paused: "bg-yellow-100 text-yellow-700",
  cooldown: "bg-orange-100 text-orange-700",
  error: "bg-red-100 text-red-700",
};

const STATE_LABELS: Record<string, string> = {
  idle: "Idle",
  harvesting: "Harvesting",
  engaging: "Engaging",
  paused: "Paused",
  cooldown: "Cooldown",
  error: "Error",
};

export default function StatusBadge({
  status,
}: {
  status: EngineStatus | null;
}) {
  if (!status) {
    return (
      <div className="mt-3 p-3 bg-gray-50 rounded-lg">
        <p className="text-xs text-muted">Loading status...</p>
      </div>
    );
  }

  const colorClass = STATE_COLORS[status.state] ?? STATE_COLORS.idle;
  const label = STATE_LABELS[status.state] ?? status.state;

  return (
    <div className="mt-3 p-3 bg-gray-50 rounded-lg space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500">Engine</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
          {label}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">Today&apos;s likes</span>
        <span className="text-sm font-semibold text-gray-900">
          {status.todayLikes}
        </span>
      </div>
      {status.lastAction && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Last action</span>
          <span className="text-xs text-gray-700">
            {formatTimeAgo(status.lastAction)}
          </span>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
