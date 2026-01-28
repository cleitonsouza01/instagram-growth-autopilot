import { useEffect, useState } from "react";
import Header from "./components/Header";
import StatusBadge from "./components/StatusBadge";
import QuickActions from "./components/QuickActions";

interface EngineStatus {
  state: string;
  todayLikes: number;
  lastAction: number | null;
  cooldownEndsAt: number | null;
}

export default function App() {
  const [status, setStatus] = useState<EngineStatus | null>(null);
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

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStart = () => {
    chrome.runtime.sendMessage({ type: "ENGAGEMENT_START" }).then(fetchStatus);
  };

  const handleStop = () => {
    chrome.runtime.sendMessage({ type: "ENGAGEMENT_STOP" }).then(fetchStatus);
  };

  const handleOpenOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <div className="w-80 min-h-64 bg-white p-4">
      <Header />
      {error && (
        <div className="mt-3 p-2 bg-red-50 text-red-700 text-xs rounded">
          {error}
        </div>
      )}
      <StatusBadge status={status} />
      <QuickActions
        state={status?.state ?? "idle"}
        onStart={handleStart}
        onStop={handleStop}
        onOpenOptions={handleOpenOptions}
      />
    </div>
  );
}
