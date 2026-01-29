import { useEffect, useState } from "react";
import Header from "./components/Header";
import StatusBadge from "./components/StatusBadge";
import QuickActions from "./components/QuickActions";
import DailyStats from "./components/analytics/DailyStats";
import ConversionCard from "./components/analytics/ConversionCard";

interface EngineStatus {
  state: string;
  todayLikes: number;
  dailyLimit: number;
  queueDepth: number;
  lastAction: number | null;
  cooldownEndsAt: number | null;
}

interface TodayStats {
  likesToday: number;
  prospectsEngaged: number;
  queueDepth: number;
  successRate: number;
}

interface AnalyticsQuick {
  conversionRate: number;
  netGrowth: number;
}

export default function App() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [todayStats, setTodayStats] = useState<TodayStats | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsQuick | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = () => {
    chrome.runtime
      .sendMessage({ type: "STATUS_REQUEST" })
      .then((response) => {
        if (response?.state) {
          setStatus(response.state as EngineStatus);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        setError(String(err));
      });
  };

  const fetchAnalytics = () => {
    chrome.runtime
      .sendMessage({ type: "ANALYTICS_TODAY" })
      .then((response) => {
        if (response?.todayStats) {
          setTodayStats(response.todayStats as TodayStats);
        }
        if (response?.analytics) {
          setAnalytics(response.analytics as AnalyticsQuick);
        }
      })
      .catch(() => {
        // Analytics not critical — fail silently
      });
  };

  useEffect(() => {
    fetchStatus();
    fetchAnalytics();
    const statusInterval = setInterval(fetchStatus, 3000);
    const analyticsInterval = setInterval(fetchAnalytics, 10000);
    return () => {
      clearInterval(statusInterval);
      clearInterval(analyticsInterval);
    };
  }, []);

  const handleStart = () => {
    chrome.runtime.sendMessage({ type: "ENGAGEMENT_START" }).then(fetchStatus);
  };

  const handleStop = () => {
    chrome.runtime.sendMessage({ type: "ENGAGEMENT_STOP" }).then(fetchStatus);
  };

  const handleOpenAnalytics = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <div className="w-80 min-h-64 bg-white p-4 space-y-3">
      <Header />

      {error && (
        <div className="p-2 bg-red-50 text-red-700 text-xs rounded">
          {error}
        </div>
      )}

      <StatusBadge status={status} />

      {/* Quick analytics */}
      {todayStats && (
        <DailyStats
          likesToday={todayStats.likesToday}
          prospectsEngaged={todayStats.prospectsEngaged}
          queueDepth={todayStats.queueDepth}
          dailyLimit={status?.dailyLimit ?? 100}
        />
      )}

      {analytics && todayStats && (
        <ConversionCard
          conversionRate={analytics.conversionRate}
          netGrowth={analytics.netGrowth}
          successRate={todayStats.successRate}
        />
      )}

      <QuickActions
        state={status?.state ?? "idle"}
        onStart={handleStart}
        onStop={handleStop}
        onOpenOptions={handleOpenAnalytics}
      />

      {/* Link to full analytics */}
      <button
        onClick={handleOpenAnalytics}
        className="w-full text-xs text-primary hover:text-primary-dark text-center py-1"
      >
        View full analytics &rarr;
      </button>
    </div>
  );
}
