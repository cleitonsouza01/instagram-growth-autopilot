import { useState, useEffect, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { MessageType } from "../../types/messages";
import type { UserSettings } from "../../types/settings";
import { DEFAULT_SETTINGS } from "../../types/settings";

interface EngineStatus {
  state: string;
  todayLikes: number;
  todayFollows?: number;
}

export function SettingsModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "targets" | "limits" | "filters" | "safety">("general");
  const [newTarget, setNewTarget] = useState("");
  const [newCompetitor, setNewCompetitor] = useState("");

  const fetchSettings = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: MessageType.GET_SETTINGS });
      if (response?.settings) {
        setSettings({ ...DEFAULT_SETTINGS, ...response.settings });
      }
    } catch (err) {
      console.error("Failed to fetch settings:", err);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: "STATUS_REQUEST" });
      if (response?.state) {
        setStatus({
          state: response.state.state || "unknown",
          todayLikes: response.state.todayLikes || 0,
        });
      }
    } catch (err) {
      console.error("Failed to fetch status:", err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      fetchStatus();
    }
  }, [isOpen, fetchSettings, fetchStatus]);

  const updateSetting = async <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    setSaving(true);
    try {
      await chrome.runtime.sendMessage({
        type: MessageType.UPDATE_SETTINGS,
        payload: { settings: { [key]: value } },
      });
    } catch (err) {
      console.error("Failed to save setting:", err);
    } finally {
      setSaving(false);
    }
  };

  const addTargetProfile = async () => {
    if (!newTarget.trim()) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.ADD_TARGET_PROFILE,
        payload: { username: newTarget.trim() },
      });
      if (response?.success) {
        setSettings((s) => ({
          ...s,
          targetProfiles: response.targetProfiles || [...(s.targetProfiles || []), newTarget.trim()],
        }));
        setNewTarget("");
      }
    } catch (err) {
      console.error("Failed to add target profile:", err);
    }
  };

  const removeTargetProfile = async (username: string) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.REMOVE_TARGET_PROFILE,
        payload: { username },
      });
      if (response?.success) {
        setSettings((s) => ({
          ...s,
          targetProfiles: (s.targetProfiles || []).filter((p) => p !== username),
        }));
      }
    } catch (err) {
      console.error("Failed to remove target profile:", err);
    }
  };

  const addCompetitor = async () => {
    if (!newCompetitor.trim()) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.ADD_COMPETITOR,
        payload: { username: newCompetitor.trim() },
      });
      if (response?.success) {
        setSettings((s) => ({
          ...s,
          competitors: response.competitors || [...s.competitors, newCompetitor.trim()],
        }));
        setNewCompetitor("");
      }
    } catch (err) {
      console.error("Failed to add competitor:", err);
    }
  };

  const removeCompetitor = async (username: string) => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.REMOVE_COMPETITOR,
        payload: { username },
      });
      if (response?.success) {
        setSettings((s) => ({
          ...s,
          competitors: s.competitors.filter((c) => c !== username),
        }));
      }
    } catch (err) {
      console.error("Failed to remove competitor:", err);
    }
  };

  const startEngine = async () => {
    setLoading(true);
    try {
      await chrome.runtime.sendMessage({ type: "ENGAGEMENT_START" });
      await fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  const stopEngine = async () => {
    setLoading(true);
    try {
      await chrome.runtime.sendMessage({ type: "ENGAGEMENT_STOP" });
      await fetchStatus();
    } finally {
      setLoading(false);
    }
  };

  const modalWidth = isMaximized ? "90vw" : "480px";
  const modalHeight = isMaximized ? "90vh" : "600px";

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "6px",
    border: "1px solid #d1d5db",
    fontSize: "14px",
    outline: "none",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "13px",
    fontWeight: 500,
    color: "#374151",
    marginBottom: "4px",
  };

  const checkboxLabelStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "14px",
    color: "#374151",
    cursor: "pointer",
  };

  const sectionStyle: React.CSSProperties = {
    marginBottom: "20px",
  };

  const tagStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 10px",
    background: "#e0e7ff",
    color: "#4338ca",
    borderRadius: "16px",
    fontSize: "13px",
    fontWeight: 500,
  };

  return (
    <>
      {/* Settings Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          bottom: "90px",
          right: "20px",
          width: "48px",
          height: "48px",
          borderRadius: "50%",
          background: "#4f46e5",
          color: "white",
          border: "none",
          cursor: "pointer",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          zIndex: 999998,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
          transition: "transform 0.2s, background 0.3s",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
        title="Growth Autopilot Settings"
      >
        {isOpen ? "✕" : "⚙"}
      </button>

      {/* Settings Modal */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            top: isMaximized ? "5vh" : "50%",
            left: isMaximized ? "5vw" : "50%",
            transform: isMaximized ? "none" : "translate(-50%, -50%)",
            width: modalWidth,
            height: modalHeight,
            maxWidth: "95vw",
            maxHeight: "95vh",
            background: "white",
            borderRadius: "16px",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)",
            zIndex: 999999,
            display: "flex",
            flexDirection: "column",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Growth Autopilot Settings</h2>
              <p style={{ margin: "4px 0 0", fontSize: "12px", opacity: 0.9 }}>
                Status: <strong>{status?.state || "loading..."}</strong>
                {saving && " • Saving..."}
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "1px solid rgba(255,255,255,0.3)",
                  background: "rgba(255,255,255,0.1)",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                {isMaximized ? "Minimize" : "Maximize"}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "6px",
                  border: "none",
                  background: "rgba(255,255,255,0.2)",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "16px",
                }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Engine Controls */}
          <div
            style={{
              padding: "12px 20px",
              background: "#f9fafb",
              borderBottom: "1px solid #e5e7eb",
              display: "flex",
              alignItems: "center",
              gap: "12px",
              flexShrink: 0,
            }}
          >
            <button
              onClick={startEngine}
              disabled={loading || status?.state === "engaging" || status?.state === "harvesting"}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                border: "none",
                background: status?.state === "engaging" ? "#d1d5db" : "#22c55e",
                color: "white",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "14px",
              }}
            >
              {loading ? "..." : "Start Engine"}
            </button>
            <button
              onClick={stopEngine}
              disabled={loading || status?.state === "paused" || status?.state === "idle"}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                border: "none",
                background: status?.state === "idle" ? "#d1d5db" : "#ef4444",
                color: "white",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "14px",
              }}
            >
              {loading ? "..." : "Stop Engine"}
            </button>
            <div style={{ marginLeft: "auto", display: "flex", gap: "16px", fontSize: "13px", color: "#6b7280" }}>
              <span>Likes today: <strong style={{ color: "#4f46e5" }}>{status?.todayLikes || 0}</strong></span>
            </div>
          </div>

          {/* Tabs */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid #e5e7eb",
              background: "#f9fafb",
              flexShrink: 0,
            }}
          >
            {[
              { id: "targets", label: "Target Profiles" },
              { id: "general", label: "General" },
              { id: "limits", label: "Limits" },
              { id: "filters", label: "Filters" },
              { id: "safety", label: "Safety" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                style={{
                  padding: "12px 20px",
                  border: "none",
                  borderBottom: activeTab === tab.id ? "2px solid #4f46e5" : "2px solid transparent",
                  background: "transparent",
                  color: activeTab === tab.id ? "#4f46e5" : "#6b7280",
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  cursor: "pointer",
                  fontSize: "14px",
                  transition: "all 0.2s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflow: "auto", padding: "20px" }}>
            {/* Target Profiles Tab */}
            {activeTab === "targets" && (
              <div>
                <div style={sectionStyle}>
                  <h3 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600, color: "#111827" }}>
                    Target Profiles
                  </h3>
                  <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#6b7280" }}>
                    Add profiles whose followers you want to follow and engage with.
                    The bot will follow their followers and like their posts.
                  </p>

                  <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                    <input
                      type="text"
                      value={newTarget}
                      onChange={(e) => setNewTarget(e.target.value)}
                      placeholder="Enter username (e.g., @natgeo)"
                      style={{ ...inputStyle, flex: 1 }}
                      onKeyDown={(e) => e.key === "Enter" && addTargetProfile()}
                    />
                    <button
                      onClick={addTargetProfile}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "6px",
                        border: "none",
                        background: "#4f46e5",
                        color: "white",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      Add
                    </button>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {(settings.targetProfiles || []).map((profile) => (
                      <span key={profile} style={tagStyle}>
                        @{profile}
                        <button
                          onClick={() => removeTargetProfile(profile)}
                          style={{
                            border: "none",
                            background: "none",
                            color: "#4338ca",
                            cursor: "pointer",
                            padding: 0,
                            fontSize: "14px",
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {(settings.targetProfiles || []).length === 0 && (
                      <span style={{ color: "#9ca3af", fontSize: "13px" }}>No target profiles added yet</span>
                    )}
                  </div>
                </div>

                <div style={sectionStyle}>
                  <h3 style={{ margin: "0 0 12px", fontSize: "15px", fontWeight: 600, color: "#111827" }}>
                    Competitors (for likes only)
                  </h3>
                  <p style={{ margin: "0 0 12px", fontSize: "13px", color: "#6b7280" }}>
                    Add competitor profiles to harvest their followers for liking posts (no following).
                  </p>

                  <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
                    <input
                      type="text"
                      value={newCompetitor}
                      onChange={(e) => setNewCompetitor(e.target.value)}
                      placeholder="Enter username"
                      style={{ ...inputStyle, flex: 1 }}
                      onKeyDown={(e) => e.key === "Enter" && addCompetitor()}
                    />
                    <button
                      onClick={addCompetitor}
                      style={{
                        padding: "8px 16px",
                        borderRadius: "6px",
                        border: "none",
                        background: "#6366f1",
                        color: "white",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      Add
                    </button>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {settings.competitors.map((competitor) => (
                      <span key={competitor} style={{ ...tagStyle, background: "#fef3c7", color: "#92400e" }}>
                        @{competitor}
                        <button
                          onClick={() => removeCompetitor(competitor)}
                          style={{
                            border: "none",
                            background: "none",
                            color: "#92400e",
                            cursor: "pointer",
                            padding: 0,
                            fontSize: "14px",
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {settings.competitors.length === 0 && (
                      <span style={{ color: "#9ca3af", fontSize: "13px" }}>No competitors added yet</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* General Tab */}
            {activeTab === "general" && (
              <div>
                <div style={sectionStyle}>
                  <h3 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "#111827" }}>
                    Engagement Actions
                  </h3>

                  <label style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={settings.likesEnabled}
                      onChange={(e) => updateSetting("likesEnabled", e.target.checked)}
                      style={{ width: "18px", height: "18px", accentColor: "#4f46e5" }}
                    />
                    <div>
                      <strong>Enable Likes</strong>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6b7280" }}>
                        Automatically like posts from target followers
                      </p>
                    </div>
                  </label>

                  <div style={{ height: "12px" }} />

                  <label style={checkboxLabelStyle}>
                    <input
                      type="checkbox"
                      checked={settings.followEnabled}
                      onChange={(e) => updateSetting("followEnabled", e.target.checked)}
                      style={{ width: "18px", height: "18px", accentColor: "#4f46e5" }}
                    />
                    <div>
                      <strong>Enable Following</strong>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6b7280" }}>
                        Automatically follow users from target profiles
                      </p>
                    </div>
                  </label>
                </div>

                <div style={sectionStyle}>
                  <h3 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "#111827" }}>
                    Active Hours
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={labelStyle}>Start Hour (0-23)</label>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={settings.activeHoursStart}
                        onChange={(e) => updateSetting("activeHoursStart", parseInt(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>End Hour (0-23)</label>
                      <input
                        type="number"
                        min={0}
                        max={23}
                        value={settings.activeHoursEnd}
                        onChange={(e) => updateSetting("activeHoursEnd", parseInt(e.target.value) || 23)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>

                <div style={sectionStyle}>
                  <h3 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "#111827" }}>
                    Action Delays
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={labelStyle}>Min Delay (seconds)</label>
                      <input
                        type="number"
                        min={10}
                        max={300}
                        value={settings.minDelaySeconds}
                        onChange={(e) => updateSetting("minDelaySeconds", parseInt(e.target.value) || 30)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Max Delay (seconds)</label>
                      <input
                        type="number"
                        min={30}
                        max={600}
                        value={settings.maxDelaySeconds}
                        onChange={(e) => updateSetting("maxDelaySeconds", parseInt(e.target.value) || 120)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Limits Tab */}
            {activeTab === "limits" && (
              <div>
                <div style={sectionStyle}>
                  <h3 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "#111827" }}>
                    Like Limits
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={labelStyle}>Daily Like Limit</label>
                      <input
                        type="number"
                        min={10}
                        max={500}
                        value={settings.dailyLikeLimit}
                        onChange={(e) => updateSetting("dailyLikeLimit", parseInt(e.target.value) || 100)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Likes Per Prospect</label>
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={settings.likesPerProspect}
                        onChange={(e) => updateSetting("likesPerProspect", parseInt(e.target.value) || 2)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>

                <div style={sectionStyle}>
                  <h3 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "#111827" }}>
                    Follow Limits
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={labelStyle}>Daily Follow Limit</label>
                      <input
                        type="number"
                        min={10}
                        max={200}
                        value={settings.dailyFollowLimit}
                        onChange={(e) => updateSetting("dailyFollowLimit", parseInt(e.target.value) || 50)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Unfollow After (days)</label>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={settings.unfollowAfterDays}
                        onChange={(e) => updateSetting("unfollowAfterDays", parseInt(e.target.value) || 0)}
                        style={inputStyle}
                      />
                      <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#9ca3af" }}>
                        0 = never unfollow
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Filters Tab */}
            {activeTab === "filters" && (
              <div>
                <div style={sectionStyle}>
                  <h3 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "#111827" }}>
                    Follower Count Filters
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div>
                      <label style={labelStyle}>Min Followers</label>
                      <input
                        type="number"
                        min={0}
                        max={10000}
                        value={settings.minFollowers}
                        onChange={(e) => updateSetting("minFollowers", parseInt(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Max Followers</label>
                      <input
                        type="number"
                        min={100}
                        max={1000000}
                        value={settings.maxFollowers}
                        onChange={(e) => updateSetting("maxFollowers", parseInt(e.target.value) || 10000)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                </div>

                <div style={sectionStyle}>
                  <h3 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "#111827" }}>
                    Other Filters
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                    <div>
                      <label style={labelStyle}>Min Post Count</label>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={settings.minPostCount}
                        onChange={(e) => updateSetting("minPostCount", parseInt(e.target.value) || 0)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Max Following/Followers Ratio</label>
                      <input
                        type="number"
                        min={0.5}
                        max={10}
                        step={0.1}
                        value={settings.maxFollowingRatio}
                        onChange={(e) => updateSetting("maxFollowingRatio", parseFloat(e.target.value) || 2)}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <label style={checkboxLabelStyle}>
                      <input
                        type="checkbox"
                        checked={settings.skipPrivateAccounts}
                        onChange={(e) => updateSetting("skipPrivateAccounts", e.target.checked)}
                        style={{ width: "18px", height: "18px", accentColor: "#4f46e5" }}
                      />
                      Skip private accounts
                    </label>
                    <label style={checkboxLabelStyle}>
                      <input
                        type="checkbox"
                        checked={settings.skipVerifiedAccounts}
                        onChange={(e) => updateSetting("skipVerifiedAccounts", e.target.checked)}
                        style={{ width: "18px", height: "18px", accentColor: "#4f46e5" }}
                      />
                      Skip verified accounts
                    </label>
                    <label style={checkboxLabelStyle}>
                      <input
                        type="checkbox"
                        checked={settings.skipBusinessAccounts}
                        onChange={(e) => updateSetting("skipBusinessAccounts", e.target.checked)}
                        style={{ width: "18px", height: "18px", accentColor: "#4f46e5" }}
                      />
                      Skip business accounts
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Safety Tab */}
            {activeTab === "safety" && (
              <div>
                <div style={sectionStyle}>
                  <h3 style={{ margin: "0 0 16px", fontSize: "15px", fontWeight: 600, color: "#111827" }}>
                    Safety Settings
                  </h3>

                  <label style={{ ...checkboxLabelStyle, marginBottom: "16px" }}>
                    <input
                      type="checkbox"
                      checked={settings.pauseOnBlock}
                      onChange={(e) => updateSetting("pauseOnBlock", e.target.checked)}
                      style={{ width: "18px", height: "18px", accentColor: "#4f46e5" }}
                    />
                    <div>
                      <strong>Pause on Block</strong>
                      <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#6b7280" }}>
                        Automatically pause when Instagram blocks an action
                      </p>
                    </div>
                  </label>

                  <div>
                    <label style={labelStyle}>Cooldown Period (hours)</label>
                    <input
                      type="number"
                      min={1}
                      max={72}
                      value={settings.cooldownHours}
                      onChange={(e) => updateSetting("cooldownHours", parseInt(e.target.value) || 24)}
                      style={{ ...inputStyle, width: "200px" }}
                    />
                    <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#6b7280" }}>
                      How long to wait after a block before resuming
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    padding: "16px",
                    background: "#fef3c7",
                    borderRadius: "8px",
                    border: "1px solid #fcd34d",
                  }}
                >
                  <h4 style={{ margin: "0 0 8px", fontSize: "14px", fontWeight: 600, color: "#92400e" }}>
                    Safety Tips
                  </h4>
                  <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#78350f" }}>
                    <li>Start with low limits and gradually increase</li>
                    <li>Keep daily actions under 200 total</li>
                    <li>Use realistic delays (30-120 seconds)</li>
                    <li>Don't run 24/7 - use active hours</li>
                    <li>Monitor for any action blocks</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export function injectSettingsModal() {
  if (document.getElementById("ga-settings-modal-root")) {
    return;
  }

  const container = document.createElement("div");
  container.id = "ga-settings-modal-root";
  document.body.appendChild(container);

  const root = createRoot(container);
  root.render(<SettingsModal />);
}
