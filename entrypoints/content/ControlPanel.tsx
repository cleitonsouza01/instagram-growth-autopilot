import { useState, useEffect, useCallback, useRef } from "react";
import { createRoot } from "react-dom/client";
import { MessageType } from "../../types/messages";

interface ActivityItem {
  id: number;
  type: "harvest" | "filter" | "engage" | "like" | "follow" | "error" | "info";
  message: string;
  timestamp: number;
  username?: string;
  success?: boolean;
}

// Grouped engagement for a single prospect
interface ProspectEngagement {
  username: string;
  likes: number;
  followed: boolean;
  startTime: number;
  endTime: number;
  status: "in_progress" | "completed" | "failed";
}

interface EngineStatus {
  state: "idle" | "harvesting" | "engaging" | "paused" | "cooldown";
  todayLikes: number;
  todayFollows: number;
  queueDepth: number;
  currentTask?: string;
  lastError?: string;
  debugSettings?: {
    followEnabled: boolean;
    likesEnabled: boolean;
  };
}

interface TaskStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "error" | "skipped";
  detail?: string;
}

const PHASE_COLORS = {
  idle: "#6b7280",
  harvesting: "#f59e0b",
  engaging: "#22c55e",
  paused: "#ef4444",
  cooldown: "#8b5cf6",
};

const PHASE_LABELS = {
  idle: "Idle",
  harvesting: "Harvesting Followers",
  engaging: "Engaging Prospects",
  paused: "Paused",
  cooldown: "Cooldown",
};

type TabId = "workflow" | "activity";

export function ControlPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("workflow");
  const [status, setStatus] = useState<EngineStatus>({
    state: "idle",
    todayLikes: 0,
    todayFollows: 0,
    queueDepth: 0,
  });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [engagements, setEngagements] = useState<ProspectEngagement[]>([]);
  const [currentProspect, setCurrentProspect] = useState<string | null>(null);
  const [tasks, setTasks] = useState<TaskStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const activityRef = useRef<HTMLDivElement>(null);
  const activityIdRef = useRef(0);

  const addActivity = useCallback((type: ActivityItem["type"], message: string, username?: string, success?: boolean) => {
    const newActivity: ActivityItem = {
      id: activityIdRef.current++,
      type,
      message,
      timestamp: Date.now(),
      username,
      success,
    };
    setActivities(prev => [newActivity, ...prev].slice(0, 50));
  }, []);

  const updateTasks = useCallback((state: string, currentTask?: string) => {
    const baseSteps: TaskStep[] = [
      { id: "init", label: "Initialize", status: "done" },
      { id: "harvest", label: "Harvest Followers", status: "pending", detail: "Fetch from competitors" },
      { id: "filter", label: "Filter Prospects", status: "pending", detail: "Apply quality filters" },
      { id: "engage", label: "Engage Users", status: "pending", detail: "Like posts & follow" },
    ];

    if (state === "idle") {
      setTasks(baseSteps.map(t => ({ ...t, status: t.id === "init" ? "done" : "pending" })));
    } else if (state === "harvesting") {
      setTasks(baseSteps.map(t => {
        if (t.id === "init") return { ...t, status: "done" };
        if (t.id === "harvest") return { ...t, status: "running", detail: currentTask || "Fetching followers..." };
        return { ...t, status: "pending" };
      }));
    } else if (state === "engaging") {
      setTasks(baseSteps.map(t => {
        if (t.id === "init" || t.id === "harvest" || t.id === "filter") return { ...t, status: "done" };
        if (t.id === "engage") return { ...t, status: "running", detail: currentTask || "Processing queue..." };
        return t;
      }));
    } else if (state === "paused" || state === "cooldown") {
      setTasks(baseSteps.map(t => ({ ...t, status: t.id === "init" ? "done" : "pending" })));
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: "STATUS_REQUEST" });
      if (response?.state) {
        const newState = response.state.state || "idle";
        const newStatus: EngineStatus = {
          state: newState,
          todayLikes: response.state.todayLikes || 0,
          todayFollows: response.state.todayFollows || 0,
          queueDepth: response.state.queueDepth || 0,
          currentTask: response.state.currentTask,
          lastError: response.state.lastError,
          debugSettings: response.state.debugSettings,
        };

        // Add activity if state changed
        if (newState !== status.state) {
          addActivity("info", `Engine state: ${PHASE_LABELS[newState as keyof typeof PHASE_LABELS] || newState}`);
        }

        setStatus(newStatus);
        updateTasks(newState, newStatus.currentTask);
      }
    } catch (err) {
      console.error("Failed to fetch status:", err);
    }
  }, [status.state, addActivity, updateTasks]);

  const fetchActivityLog = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: "ACTIVITY_LOG" });
      if (response?.recentLogs && response.recentLogs.length > 0) {
        const logs = response.recentLogs.slice(0, 50);

        // Map raw activities
        const mapped: ActivityItem[] = logs.map((log: any, i: number) => ({
          id: log.id || i,
          type: log.action === "like" ? "like" : log.action === "follow" ? "follow" : "info",
          message: log.action === "like"
            ? `Liked post by @${log.targetUsername}`
            : log.action === "follow"
            ? `Followed @${log.targetUsername}`
            : log.message || "Action completed",
          timestamp: log.timestamp,
          username: log.targetUsername,
          success: log.success,
        }));
        setActivities(mapped);

        // Group by prospect for engagement view
        const prospectMap = new Map<string, { likes: number; followed: boolean; startTime: number; endTime: number }>();

        // Process in reverse chronological order (oldest first for grouping)
        const sortedLogs = [...logs].sort((a: any, b: any) => a.timestamp - b.timestamp);

        for (const log of sortedLogs) {
          if (!log.targetUsername) continue;
          const username = log.targetUsername;

          if (!prospectMap.has(username)) {
            prospectMap.set(username, { likes: 0, followed: false, startTime: log.timestamp, endTime: log.timestamp });
          }

          const entry = prospectMap.get(username)!;
          entry.endTime = log.timestamp;

          if (log.action === "like") {
            entry.likes++;
          } else if (log.action === "follow") {
            entry.followed = true;
          }
        }

        // Convert to sorted array (most recent first)
        const grouped: ProspectEngagement[] = Array.from(prospectMap.entries())
          .map(([username, data]) => ({
            username,
            likes: data.likes,
            followed: data.followed,
            startTime: data.startTime,
            endTime: data.endTime,
            status: data.followed ? "completed" as const : "in_progress" as const,
          }))
          .sort((a, b) => b.endTime - a.endTime);

        setEngagements(grouped);

        // Set current prospect (most recent one that's in progress)
        const inProgress = grouped.find(e => e.status === "in_progress");
        setCurrentProspect(inProgress?.username || null);
      }
    } catch (err) {
      console.error("Failed to fetch activity:", err);
    }
  }, []);

  const startEngine = async () => {
    setLoading(true);
    setError(null);
    addActivity("info", "Starting engine...");

    try {
      await chrome.runtime.sendMessage({ type: "ENGAGEMENT_START" });
      addActivity("info", "Engine started successfully");
      await fetchStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      addActivity("error", `Failed to start: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const stopEngine = async () => {
    setLoading(true);
    setError(null);
    addActivity("info", "Stopping engine...");

    try {
      await chrome.runtime.sendMessage({ type: "ENGAGEMENT_STOP" });
      addActivity("info", "Engine stopped");
      await fetchStatus();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      addActivity("error", `Failed to stop: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      fetchActivityLog();
      const interval = setInterval(() => {
        fetchStatus();
        fetchActivityLog();
      }, 2000); // More frequent updates
      return () => clearInterval(interval);
    }
  }, [isOpen, fetchStatus, fetchActivityLog]);

  // Auto-scroll activity log
  useEffect(() => {
    if (activityRef.current) {
      activityRef.current.scrollTop = 0;
    }
  }, [activities]);

  const formatTime = (ts: number) => {
    const now = Date.now();
    const diff = now - ts;
    if (diff < 60000) return "just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(ts).toLocaleTimeString();
  };

  const getActivityIcon = (type: ActivityItem["type"]) => {
    switch (type) {
      case "like": return "♥";
      case "follow": return "👤";
      case "harvest": return "🌾";
      case "filter": return "🔍";
      case "engage": return "✨";
      case "error": return "⚠️";
      default: return "ℹ️";
    }
  };

  const getActivityColor = (type: ActivityItem["type"]) => {
    switch (type) {
      case "like": return "#ec4899";
      case "follow": return "#3b82f6";
      case "harvest": return "#f59e0b";
      case "error": return "#ef4444";
      default: return "#6b7280";
    }
  };

  const getTaskIcon = (status: TaskStep["status"]) => {
    switch (status) {
      case "done": return "✓";
      case "running": return "●";
      case "error": return "✕";
      case "skipped": return "○";
      default: return "○";
    }
  };

  const isRunning = status.state === "harvesting" || status.state === "engaging";
  const phaseColor = PHASE_COLORS[status.state] || PHASE_COLORS.idle;

  const panelWidth = isExpanded ? "420px" : "340px";
  const panelHeight = isExpanded ? "600px" : "480px";

  return (
    <>
      {/* Floating Toggle Button with pulse animation when running */}
      <button
        id="ga-autopilot-toggle"
        data-testid="panel-toggle"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          background: phaseColor,
          color: "white",
          border: "none",
          cursor: "pointer",
          boxShadow: isRunning
            ? `0 0 0 4px ${phaseColor}40, 0 4px 12px rgba(0,0,0,0.3)`
            : "0 4px 12px rgba(0,0,0,0.3)",
          zIndex: 999999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
          transition: "all 0.3s ease",
          animation: isRunning ? "ga-pulse 2s infinite" : "none",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        title={`Growth Autopilot - ${PHASE_LABELS[status.state]}`}
      >
        {isOpen ? "✕" : isRunning ? "⚡" : "⚡"}
      </button>

      {/* Inject pulse animation */}
      <style>{`
        @keyframes ga-pulse {
          0%, 100% { box-shadow: 0 0 0 4px ${phaseColor}40, 0 4px 12px rgba(0,0,0,0.3); }
          50% { box-shadow: 0 0 0 8px ${phaseColor}20, 0 4px 12px rgba(0,0,0,0.3); }
        }
        @keyframes ga-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

      {/* Control Panel */}
      {isOpen && (
        <div
          id="ga-autopilot-panel"
          data-testid="control-panel"
          style={{
            position: "fixed",
            bottom: "90px",
            right: "20px",
            width: panelWidth,
            maxHeight: panelHeight,
            background: "white",
            borderRadius: "16px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            zIndex: 999998,
            overflow: "hidden",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            display: "flex",
            flexDirection: "column",
            transition: "width 0.3s, max-height 0.3s",
          }}
        >
          {/* Header with status indicator */}
          <div
            style={{
              padding: "16px",
              background: `linear-gradient(135deg, ${phaseColor} 0%, ${phaseColor}dd 100%)`,
              color: "white",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Animated background when running */}
            {isRunning && (
              <div style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `repeating-linear-gradient(
                  -45deg,
                  transparent,
                  transparent 10px,
                  rgba(255,255,255,0.1) 10px,
                  rgba(255,255,255,0.1) 20px
                )`,
                animation: "ga-stripes 1s linear infinite",
              }} />
            )}
            <style>{`
              @keyframes ga-stripes {
                from { background-position: 0 0; }
                to { background-position: 28px 0; }
              }
            `}</style>

            <div style={{ position: "relative", zIndex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600 }}>
                  Growth Autopilot
                </h3>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  style={{
                    background: "rgba(255,255,255,0.2)",
                    border: "none",
                    borderRadius: "4px",
                    padding: "4px 8px",
                    color: "white",
                    cursor: "pointer",
                    fontSize: "11px",
                  }}
                >
                  {isExpanded ? "Collapse" : "Expand"}
                </button>
              </div>
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "8px",
              }}>
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "rgba(255,255,255,0.2)",
                  padding: "4px 10px",
                  borderRadius: "12px",
                  fontSize: "12px",
                  fontWeight: 500,
                }}>
                  {isRunning && (
                    <span style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      background: "white",
                      animation: "ga-blink 1s infinite",
                    }} />
                  )}
                  <style>{`
                    @keyframes ga-blink {
                      0%, 100% { opacity: 1; }
                      50% { opacity: 0.3; }
                    }
                  `}</style>
                  {PHASE_LABELS[status.state]}
                </span>
                {status.currentTask && (
                  <span style={{ fontSize: "11px", opacity: 0.9 }}>
                    {status.currentTask}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "8px",
              padding: "12px 16px",
              background: "#f9fafb",
              borderBottom: "1px solid #e5e7eb",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#ec4899" }} data-testid="stat-likes">
                {status.todayLikes}
              </div>
              <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>Likes</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#3b82f6" }} data-testid="stat-follows">
                {status.todayFollows}
              </div>
              <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>Follows</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "20px", fontWeight: 700, color: "#f59e0b" }} data-testid="stat-queue">
                {status.queueDepth}
              </div>
              <div style={{ fontSize: "10px", color: "#6b7280", textTransform: "uppercase" }}>Queue</div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid #e5e7eb",
              background: "#fff",
            }}
            data-testid="tab-navigation"
          >
            <button
              onClick={() => setActiveTab("workflow")}
              data-testid="tab-workflow"
              style={{
                flex: 1,
                padding: "10px 16px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: activeTab === "workflow" ? 600 : 400,
                color: activeTab === "workflow" ? "#3b82f6" : "#6b7280",
                borderBottom: activeTab === "workflow" ? "2px solid #3b82f6" : "2px solid transparent",
                transition: "all 0.2s ease",
              }}
            >
              ⚡ Workflow
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              data-testid="tab-activity"
              style={{
                flex: 1,
                padding: "10px 16px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: activeTab === "activity" ? 600 : 400,
                color: activeTab === "activity" ? "#3b82f6" : "#6b7280",
                borderBottom: activeTab === "activity" ? "2px solid #3b82f6" : "2px solid transparent",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
              }}
            >
              📋 Activity
              {engagements.length > 0 && (
                <span style={{
                  background: "#3b82f6",
                  color: "white",
                  fontSize: "10px",
                  padding: "1px 6px",
                  borderRadius: "10px",
                  minWidth: "18px",
                }}>
                  {engagements.length}
                </span>
              )}
            </button>
          </div>

          {/* Task Progress - Only show in Workflow tab */}
          {activeTab === "workflow" && (
          <>
          {/* Task Progress */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb" }}>
            <h4 style={{ margin: "0 0 10px", fontSize: "12px", color: "#374151", fontWeight: 600 }}>
              WORKFLOW
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {tasks.map((task, index) => (
                <div
                  key={task.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "6px 10px",
                    background: task.status === "running" ? "#f0fdf4" : "transparent",
                    borderRadius: "6px",
                    border: task.status === "running" ? "1px solid #bbf7d0" : "1px solid transparent",
                  }}
                >
                  <span style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: 600,
                    background: task.status === "done" ? "#22c55e"
                      : task.status === "running" ? "#f59e0b"
                      : task.status === "error" ? "#ef4444"
                      : "#e5e7eb",
                    color: task.status === "pending" || task.status === "skipped" ? "#9ca3af" : "white",
                    animation: task.status === "running" ? "ga-spin 1.5s linear infinite" : "none",
                    border: task.status === "running" ? "2px solid #fbbf24" : "none",
                  }}>
                    {task.status === "running" ? "◐" : getTaskIcon(task.status)}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontSize: "12px",
                      fontWeight: task.status === "running" ? 600 : 400,
                      color: task.status === "pending" ? "#9ca3af" : "#111827",
                    }}>
                      {task.label}
                    </div>
                    {task.detail && task.status === "running" && (
                      <div style={{ fontSize: "10px", color: "#6b7280", marginTop: "2px" }}>
                        {task.detail}
                      </div>
                    )}
                  </div>
                  {index < tasks.length - 1 && (
                    <div style={{
                      position: "absolute",
                      left: "25px",
                      top: "26px",
                      width: "2px",
                      height: "20px",
                      background: task.status === "done" ? "#22c55e" : "#e5e7eb",
                    }} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={startEngine}
                disabled={loading || isRunning}
                data-testid="btn-start"
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: "none",
                  background: isRunning ? "#d1d5db" : "#22c55e",
                  color: "white",
                  fontWeight: 600,
                  cursor: loading || isRunning ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  fontSize: "13px",
                }}
              >
                {loading ? (
                  <span style={{ animation: "ga-spin 1s linear infinite" }}>⟳</span>
                ) : (
                  <>▶ Start</>
                )}
              </button>
              <button
                onClick={stopEngine}
                disabled={loading || !isRunning}
                data-testid="btn-stop"
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "8px",
                  border: "none",
                  background: !isRunning ? "#d1d5db" : "#ef4444",
                  color: "white",
                  fontWeight: 600,
                  cursor: loading || !isRunning ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  fontSize: "13px",
                }}
              >
                ■ Stop
              </button>
              <button
                onClick={() => { fetchStatus(); fetchActivityLog(); }}
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #e5e7eb",
                  background: "white",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
                title="Refresh"
              >
                ↻
              </button>
            </div>
            {error && (
              <div style={{
                marginTop: "8px",
                padding: "8px",
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "6px",
                fontSize: "12px",
                color: "#dc2626",
              }}>
                ⚠️ {error}
              </div>
            )}
          </div>
          </>
          )}

          {/* Current Engagement Target - Show in both tabs when engaging */}
          {currentProspect && status.state === "engaging" && (
            <div style={{
              padding: "12px 16px",
              background: "linear-gradient(135deg, #dbeafe 0%, #e0e7ff 100%)",
              borderBottom: "1px solid #93c5fd",
            }}>
              <div style={{ fontSize: "10px", color: "#3730a3", fontWeight: 600, marginBottom: "6px" }}>
                NOW ENGAGING
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "50%",
                  background: "#3b82f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontSize: "16px",
                  fontWeight: 600,
                }}>
                  {currentProspect.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#1e3a8a" }}>
                    @{currentProspect}
                  </div>
                  <div style={{ fontSize: "11px", color: "#3730a3", marginTop: "2px" }}>
                    {engagements.find(e => e.username === currentProspect)?.likes || 0} likes
                    {engagements.find(e => e.username === currentProspect)?.followed && " → followed ✓"}
                  </div>
                </div>
              </div>
              {/* Progress bar */}
              <div style={{
                marginTop: "10px",
                height: "4px",
                background: "#bfdbfe",
                borderRadius: "2px",
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%",
                  background: "#3b82f6",
                  width: `${Math.min(100, ((engagements.find(e => e.username === currentProspect)?.likes || 0) / 2) * 50 + (engagements.find(e => e.username === currentProspect)?.followed ? 50 : 0))}%`,
                  transition: "width 0.3s ease",
                }} />
              </div>
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "6px",
                fontSize: "9px",
                color: "#6366f1",
              }}>
                <span>♥ Like 1</span>
                <span>♥ Like 2</span>
                <span>👤 Follow</span>
                <span>✓ Done</span>
              </div>
            </div>
          )}

          {/* Engagement History - Shown in Activity tab (full) and Workflow tab (compact) */}
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }} data-testid="engagement-history">
            <div style={{
              padding: "10px 16px 6px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}>
              <h4 style={{ margin: 0, fontSize: "12px", color: "#374151", fontWeight: 600 }}>
                {activeTab === "activity" ? "ALL ACTIVITY" : "RECENT ENGAGEMENT"}
              </h4>
              <span style={{ fontSize: "10px", color: "#9ca3af" }}>
                {engagements.length} prospects
              </span>
            </div>

            {/* Activity Tab: Clean, scannable prospect list */}
            {activeTab === "activity" && (
              <div
                ref={activityRef}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "0 16px 12px",
                }}
                data-testid="activity-feed"
              >
                {engagements.length === 0 ? (
                  <div style={{
                    textAlign: "center",
                    padding: "30px 20px",
                    color: "#9ca3af",
                  }}>
                    <div style={{ fontSize: "32px", marginBottom: "12px" }}>📋</div>
                    <div style={{ fontSize: "14px", fontWeight: 500, color: "#6b7280" }}>No activity yet</div>
                    <div style={{ fontSize: "12px", marginTop: "4px" }}>Start the engine to begin engaging</div>
                  </div>
                ) : (
                  <>
                    {/* Session Summary - Compact header */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "16px",
                      padding: "10px",
                      marginBottom: "12px",
                      background: "linear-gradient(135deg, #f0f9ff 0%, #fdf4ff 100%)",
                      borderRadius: "10px",
                      border: "1px solid #e0e7ff",
                    }}>
                      <div style={{ textAlign: "center" }}>
                        <span style={{ fontSize: "18px", fontWeight: 700, color: "#ec4899" }}>
                          {engagements.reduce((sum, e) => sum + e.likes, 0)}
                        </span>
                        <span style={{ fontSize: "11px", color: "#6b7280", marginLeft: "4px" }}>likes</span>
                      </div>
                      <div style={{ width: "1px", height: "20px", background: "#d1d5db" }} />
                      <div style={{ textAlign: "center" }}>
                        <span style={{ fontSize: "18px", fontWeight: 700, color: "#3b82f6" }}>
                          {engagements.filter(e => e.followed).length}
                        </span>
                        <span style={{ fontSize: "11px", color: "#6b7280", marginLeft: "4px" }}>follows</span>
                      </div>
                      <div style={{ width: "1px", height: "20px", background: "#d1d5db" }} />
                      <div style={{ textAlign: "center" }}>
                        <span style={{ fontSize: "18px", fontWeight: 700, color: "#22c55e" }}>
                          {engagements.filter(e => e.status === "completed").length}
                        </span>
                        <span style={{ fontSize: "11px", color: "#6b7280", marginLeft: "4px" }}>done</span>
                      </div>
                    </div>

                    {/* Prospect List - Simple table-like layout */}
                    <div style={{
                      background: "#fff",
                      borderRadius: "10px",
                      border: "1px solid #e5e7eb",
                      overflow: "hidden",
                    }}>
                      {/* Table Header */}
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 60px 60px 70px",
                        padding: "8px 12px",
                        background: "#f9fafb",
                        borderBottom: "1px solid #e5e7eb",
                        fontSize: "10px",
                        fontWeight: 600,
                        color: "#6b7280",
                        textTransform: "uppercase",
                      }}>
                        <span>Prospect</span>
                        <span style={{ textAlign: "center" }}>Likes</span>
                        <span style={{ textAlign: "center" }}>Follow</span>
                        <span style={{ textAlign: "center" }}>Status</span>
                      </div>

                      {/* Table Rows */}
                      {engagements.map((engagement, index) => (
                        <div
                          key={engagement.username}
                          data-testid="prospect-card"
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 60px 60px 70px",
                            padding: "10px 12px",
                            alignItems: "center",
                            borderBottom: index < engagements.length - 1 ? "1px solid #f3f4f6" : "none",
                            background: engagement.status === "completed" ? "#f0fdf4" : "#fff",
                          }}
                        >
                          {/* Username */}
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                            <div style={{
                              width: "24px",
                              height: "24px",
                              borderRadius: "50%",
                              background: engagement.status === "completed" ? "#22c55e" : "#f59e0b",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "white",
                              fontSize: "10px",
                              fontWeight: 600,
                              flexShrink: 0,
                            }}>
                              {engagement.status === "completed" ? "✓" : engagement.username.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: "12px",
                                  fontWeight: 500,
                                  color: "#111827",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                                data-testid="prospect-username"
                              >
                                @{engagement.username}
                              </div>
                              <div style={{ fontSize: "9px", color: "#9ca3af" }}>
                                {formatTime(engagement.endTime)}
                              </div>
                            </div>
                          </div>

                          {/* Likes - Visual dots */}
                          <div style={{ display: "flex", justifyContent: "center", gap: "4px" }}>
                            <span style={{
                              width: "18px",
                              height: "18px",
                              borderRadius: "50%",
                              background: engagement.likes >= 1 ? "#ec4899" : "#e5e7eb",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              color: "white",
                            }}>
                              {engagement.likes >= 1 ? "♥" : ""}
                            </span>
                            <span style={{
                              width: "18px",
                              height: "18px",
                              borderRadius: "50%",
                              background: engagement.likes >= 2 ? "#ec4899" : "#e5e7eb",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              color: "white",
                            }}>
                              {engagement.likes >= 2 ? "♥" : ""}
                            </span>
                          </div>

                          {/* Follow */}
                          <div style={{ display: "flex", justifyContent: "center" }}>
                            <span style={{
                              width: "22px",
                              height: "22px",
                              borderRadius: "50%",
                              background: engagement.followed ? "#3b82f6" : "#e5e7eb",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "11px",
                              color: "white",
                            }}>
                              {engagement.followed ? "✓" : ""}
                            </span>
                          </div>

                          {/* Status Badge */}
                          <div style={{ display: "flex", justifyContent: "center" }}>
                            <span
                              style={{
                                fontSize: "9px",
                                fontWeight: 600,
                                padding: "3px 6px",
                                borderRadius: "4px",
                                background: engagement.status === "completed" ? "#dcfce7" : "#fef3c7",
                                color: engagement.status === "completed" ? "#166534" : "#92400e",
                              }}
                              data-testid="prospect-status"
                            >
                              {engagement.status === "completed" ? "Done" : "Active"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Workflow Tab: Compact recent engagement list */}
            {activeTab === "workflow" && (
              <div
                ref={activityRef}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "0 16px 12px",
                }}
              >
                {engagements.length === 0 ? (
                  <div style={{
                    textAlign: "center",
                    padding: "20px",
                    color: "#9ca3af",
                    fontSize: "12px",
                  }}>
                    <div style={{ fontSize: "24px", marginBottom: "8px" }}>📋</div>
                    No engagement yet. Start the engine to begin.
                  </div>
                ) : (
                  engagements.slice(0, 5).map((engagement) => (
                    <div
                      key={engagement.username}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "8px 10px",
                        marginBottom: "6px",
                        background: engagement.status === "completed" ? "#f0fdf4" : "#fffbeb",
                        border: `1px solid ${engagement.status === "completed" ? "#bbf7d0" : "#fde68a"}`,
                        borderRadius: "6px",
                      }}
                    >
                      <div style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: engagement.status === "completed" ? "#22c55e" : "#f59e0b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "white",
                        fontSize: "10px",
                        fontWeight: 600,
                      }}>
                        {engagement.status === "completed" ? "✓" : engagement.likes}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, fontSize: "12px", color: "#111827" }}>
                          @{engagement.username}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: "4px", fontSize: "10px" }}>
                        <span style={{ color: engagement.likes >= 1 ? "#ec4899" : "#d1d5db" }}>♥{engagement.likes}</span>
                        <span style={{ color: engagement.followed ? "#3b82f6" : "#d1d5db" }}>
                          {engagement.followed ? "👤✓" : "👤"}
                        </span>
                      </div>
                    </div>
                  ))
                )}
                {engagements.length > 5 && (
                  <button
                    onClick={() => setActiveTab("activity")}
                    style={{
                      width: "100%",
                      padding: "8px",
                      background: "#f3f4f6",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "11px",
                      color: "#6b7280",
                      cursor: "pointer",
                    }}
                  >
                    View all {engagements.length} prospects →
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function injectControlPanel() {
  if (document.getElementById("ga-autopilot-root")) {
    return;
  }

  const container = document.createElement("div");
  container.id = "ga-autopilot-root";
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(<ControlPanel />);
}
