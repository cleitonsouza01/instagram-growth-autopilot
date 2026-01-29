import { useEffect, useState, useCallback } from "react";
import type { ActionLog } from "../../../storage/database";
import type { PersistedEngineState, DailyCounters } from "../../../storage/chrome-storage";

interface QueueStats {
  queued: number;
  engaged: number;
  skipped: number;
}

interface ActivityData {
  engineState: PersistedEngineState;
  counters: DailyCounters;
  recentLogs: ActionLog[];
  queueStats: QueueStats;
}

const STATE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  idle: { label: "Idle", color: "text-gray-700", bg: "bg-gray-100" },
  harvesting: { label: "Harvesting", color: "text-blue-700", bg: "bg-blue-100" },
  engaging: { label: "Engaging", color: "text-green-700", bg: "bg-green-100" },
  paused: { label: "Paused", color: "text-yellow-700", bg: "bg-yellow-100" },
  cooldown: { label: "Cooldown", color: "text-orange-700", bg: "bg-orange-100" },
  error: { label: "Error", color: "text-red-700", bg: "bg-red-100" },
};

export default function ControlPanel(): React.ReactElement {
  const [data, setData] = useState<ActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);

  const fetchActivity = useCallback(() => {
    chrome.runtime
      .sendMessage({ type: "ACTIVITY_LOG" })
      .then((response) => {
        if (response?.engineState) {
          setData(response as ActivityData);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchActivity();
    const interval = setInterval(fetchActivity, 3000);
    return () => clearInterval(interval);
  }, [fetchActivity]);

  const handleStart = () => {
    setActionPending(true);
    chrome.runtime
      .sendMessage({ type: "ENGAGEMENT_START" })
      .then(() => {
        setTimeout(fetchActivity, 500);
      })
      .finally(() => setActionPending(false));
  };

  const handleStop = () => {
    setActionPending(true);
    chrome.runtime
      .sendMessage({ type: "ENGAGEMENT_STOP" })
      .then(() => {
        setTimeout(fetchActivity, 500);
      })
      .finally(() => setActionPending(false));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">Loading engine status...</div>
      </div>
    );
  }

  const engineState = data?.engineState;
  const counters = data?.counters;
  const recentLogs = data?.recentLogs ?? [];
  const queueStats = data?.queueStats;
  const currentState = engineState?.state ?? "idle";
  const stateInfo = STATE_LABELS[currentState] ?? STATE_LABELS["idle"];
  const isRunning = ["idle", "harvesting", "engaging"].includes(currentState);
  const isStopped = ["paused", "error"].includes(currentState);

  return (
    <div className="space-y-6">
      {/* Engine State + Controls */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Engine Control</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Start, stop, and monitor the automation engine
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${stateInfo?.bg ?? "bg-gray-100"} ${stateInfo?.color ?? "text-gray-700"}`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning ? "bg-green-500 animate-pulse" : isStopped ? "bg-yellow-500" : "bg-gray-400"
              }`}
            />
            {stateInfo?.label ?? "Unknown"}
          </span>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleStart}
            disabled={actionPending || ["harvesting", "engaging"].includes(currentState)}
            className="flex-1 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Start Engine
          </button>
          <button
            onClick={handleStop}
            disabled={actionPending || isStopped}
            className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Stop Engine
          </button>
        </div>

        {/* Cooldown info */}
        {currentState === "cooldown" && engineState?.cooldownEndsAt && (
          <div className="mt-3 p-3 bg-orange-50 rounded-lg text-sm text-orange-700">
            Cooldown active — resumes{" "}
            {new Date(engineState.cooldownEndsAt).toLocaleString()}
          </div>
        )}

        {/* Error info */}
        {currentState === "error" && (
          <div className="mt-3 p-3 bg-red-50 rounded-lg text-sm text-red-700">
            Engine stopped due to an error. Check your session and restart.
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          label="Today's Likes"
          value={counters?.likes ?? 0}
        />
        <StatCard
          label="Prospects Harvested"
          value={counters?.prospects ?? 0}
        />
        <StatCard
          label="Queue Depth"
          value={queueStats?.queued ?? 0}
        />
        <StatCard
          label="Engaged"
          value={queueStats?.engaged ?? 0}
        />
      </div>

      {/* Processing Indicator */}
      {(currentState === "harvesting" || currentState === "engaging") && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="text-sm font-medium text-blue-800">
                {currentState === "harvesting"
                  ? "Harvesting prospects..."
                  : "Engaging prospects..."}
              </p>
              {engineState?.activeCompetitor && (
                <p className="text-xs text-blue-600 mt-0.5">
                  Current target: @{engineState.activeCompetitor}
                </p>
              )}
              {engineState?.lastAction && (
                <p className="text-xs text-blue-600 mt-0.5">
                  Last action: {formatTimestamp(engineState.lastAction)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Queue Breakdown */}
      {queueStats && (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">
            Queue Breakdown
          </h3>
          <div className="space-y-2">
            <QueueBar label="Queued" count={queueStats.queued} color="bg-blue-500" total={queueStats.queued + queueStats.engaged + queueStats.skipped} />
            <QueueBar label="Engaged" count={queueStats.engaged} color="bg-green-500" total={queueStats.queued + queueStats.engaged + queueStats.skipped} />
            <QueueBar label="Skipped" count={queueStats.skipped} color="bg-gray-400" total={queueStats.queued + queueStats.engaged + queueStats.skipped} />
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Recent Activity
        </h3>
        {recentLogs.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">
            No activity yet. Start the engine to begin.
          </p>
        ) : (
          <div className="space-y-1 max-h-80 overflow-y-auto">
            {recentLogs.map((log) => (
              <ActivityRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value.toLocaleString()}</p>
    </div>
  );
}

function QueueBar({
  label,
  count,
  color,
  total,
}: {
  label: string;
  count: number;
  color: string;
  total: number;
}): React.ReactElement {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-16">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-700 w-12 text-right">
        {count.toLocaleString()}
      </span>
    </div>
  );
}

const ACTION_ICONS: Record<string, { icon: string; color: string }> = {
  like: { icon: "heart", color: "text-red-500" },
  unlike: { icon: "heart-off", color: "text-gray-400" },
  harvest: { icon: "download", color: "text-blue-500" },
  filter: { icon: "filter", color: "text-purple-500" },
};

function ActivityRow({ log }: { log: ActionLog }): React.ReactElement {
  const actionInfo = ACTION_ICONS[log.action] ?? { icon: "circle", color: "text-gray-400" };
  return (
    <div className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-gray-50 text-sm">
      <span className={`${actionInfo.color} font-medium w-14 capitalize`}>
        {log.action}
      </span>
      <span className="text-gray-700 flex-1 truncate">
        @{log.targetUsername}
      </span>
      <span className={`text-xs ${log.success ? "text-green-600" : "text-red-500"}`}>
        {log.success ? "OK" : log.error ?? "failed"}
      </span>
      <span className="text-xs text-gray-400 w-20 text-right">
        {formatTimestamp(log.timestamp)}
      </span>
    </div>
  );
}

function formatTimestamp(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(ts).toLocaleDateString();
}
