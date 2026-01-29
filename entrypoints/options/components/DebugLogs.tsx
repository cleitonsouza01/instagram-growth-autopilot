import { useEffect, useState, useCallback, useRef } from "react";
import type { LogEntry, LogLevel } from "../../../utils/logger";

const LEVEL_BADGES: Record<LogLevel, string> = {
  debug: "bg-gray-200 text-gray-700",
  info: "bg-blue-200 text-blue-800",
  warn: "bg-yellow-200 text-yellow-800",
  error: "bg-red-200 text-red-800",
};

export default function DebugLogs(): React.ReactElement {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<LogLevel | "all">("all");
  const [contextFilter, setContextFilter] = useState<string>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(() => {
    chrome.runtime
      .sendMessage({ type: "GET_LOGS" })
      .then((response) => {
        if (response?.logs) {
          setLogs(response.logs as LogEntry[]);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleClearLogs = () => {
    chrome.runtime
      .sendMessage({ type: "CLEAR_LOGS" })
      .then((response) => {
        if (response?.success) {
          setLogs([]);
        }
      })
      .catch((err) => {
        console.error("Failed to clear logs:", err);
      });
  };

  const handleCopyLogs = () => {
    const filteredLogs = getFilteredLogs();
    const text = filteredLogs
      .map((log) => {
        const dataStr = log.data ? ` ${log.data}` : "";
        return `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.context}] ${log.message}${dataStr}`;
      })
      .join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleExportLogs = () => {
    const filteredLogs = getFilteredLogs();
    const text = filteredLogs
      .map((log) => {
        const dataStr = log.data ? ` ${log.data}` : "";
        return `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.context}] ${log.message}${dataStr}`;
      })
      .join("\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `engine-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getFilteredLogs = () => {
    return logs.filter((log) => {
      if (filter !== "all" && log.level !== filter) return false;
      if (contextFilter !== "all" && log.context !== contextFilter) return false;
      return true;
    });
  };

  const contexts = [...new Set(logs.map((l) => l.context))].sort();
  const filteredLogs = getFilteredLogs();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-sm text-gray-500">Loading logs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Debug Logs</h2>
          <p className="text-sm text-gray-500">
            {filteredLogs.length} of {logs.length} log entries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyLogs}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            {copied ? "Copied!" : "Copy All"}
          </button>
          <button
            onClick={handleExportLogs}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Export
          </button>
          <button
            onClick={handleClearLogs}
            className="px-3 py-1.5 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Level:</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as LogLevel | "all")}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="all">All</option>
            <option value="debug">Debug</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">Context:</span>
          <select
            value={contextFilter}
            onChange={(e) => setContextFilter(e.target.value)}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="all">All</option>
            {contexts.map((ctx) => (
              <option key={ctx} value={ctx}>
                {ctx}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 ml-auto">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">Auto-scroll</span>
        </label>
      </div>

      {/* Log entries */}
      <div
        ref={logContainerRef}
        className="h-96 overflow-y-auto bg-gray-900 rounded-lg p-3 font-mono text-xs"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            No logs yet. Start the engine to see activity.
          </div>
        ) : (
          <div className="space-y-1">
            {filteredLogs.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>
          Debug: {logs.filter((l) => l.level === "debug").length}
        </span>
        <span>
          Info: {logs.filter((l) => l.level === "info").length}
        </span>
        <span className="text-yellow-600">
          Warn: {logs.filter((l) => l.level === "warn").length}
        </span>
        <span className="text-red-600">
          Error: {logs.filter((l) => l.level === "error").length}
        </span>
      </div>
    </div>
  );
}

function LogRow({ log }: { log: LogEntry }): React.ReactElement {
  const time = log.timestamp.slice(11, 23); // HH:MM:SS.mmm

  return (
    <div className={`flex items-start gap-2 py-0.5 ${log.level === "error" ? "text-red-400" : log.level === "warn" ? "text-yellow-400" : "text-gray-300"}`}>
      <span className="text-gray-500 shrink-0">{time}</span>
      <span
        className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${LEVEL_BADGES[log.level]}`}
      >
        {log.level.slice(0, 3)}
      </span>
      <span className="text-cyan-400 shrink-0">[{log.context}]</span>
      <span className="flex-1 break-all">
        {log.message}
        {log.data && (
          <span className="text-gray-500 ml-1">{log.data}</span>
        )}
      </span>
    </div>
  );
}
