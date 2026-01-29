import { useEffect, useState } from "react";
import { type UserSettings, DEFAULT_SETTINGS } from "../../types/settings";
import { getSettings, saveSettings } from "../../storage/chrome-storage";
import SettingsForm from "./components/SettingsForm";
import CompetitorList from "./components/CompetitorList";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import ControlPanel from "./components/ControlPanel";
import DebugLogs from "./components/DebugLogs";

type Tab = "control" | "analytics" | "publish" | "tools" | "debug" | "settings";

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("control");

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const handleSave = async (updated: Partial<UserSettings>) => {
    const merged = { ...settings, ...updated };
    setSettings(merged);
    await saveSettings(merged);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Platform Growth Autopilot
      </h1>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        <TabButton
          active={activeTab === "control"}
          onClick={() => setActiveTab("control")}
        >
          Control
        </TabButton>
        <TabButton
          active={activeTab === "analytics"}
          onClick={() => setActiveTab("analytics")}
        >
          Analytics
        </TabButton>
        <TabButton
          active={activeTab === "publish"}
          onClick={() => setActiveTab("publish")}
        >
          Publish
        </TabButton>
        <TabButton
          active={activeTab === "tools"}
          onClick={() => setActiveTab("tools")}
        >
          Tools
        </TabButton>
        <TabButton
          active={activeTab === "debug"}
          onClick={() => setActiveTab("debug")}
        >
          Debug
        </TabButton>
        <TabButton
          active={activeTab === "settings"}
          onClick={() => setActiveTab("settings")}
        >
          Settings
        </TabButton>
      </div>

      {saved && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg">
          Settings saved successfully.
        </div>
      )}

      {activeTab === "control" && <ControlPanel />}

      {activeTab === "analytics" && <AnalyticsDashboard />}

      {activeTab === "publish" && (
        <div className="text-center py-12">
          <h2 className="text-lg font-semibold text-gray-700 mb-2">
            Content Publishing
          </h2>
          <p className="text-sm text-gray-500">
            Upload photos, stories, reels, and carousels directly from your
            desktop. Navigate to the platform first to enable publishing.
          </p>
        </div>
      )}

      {activeTab === "tools" && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-700">
            Scheduling &amp; Tools
          </h2>
          <p className="text-sm text-gray-500">
            Schedule posts, manage DM templates, download content, and export
            follower data. Ghost mode lets you view stories anonymously.
          </p>
        </div>
      )}

      {activeTab === "debug" && <DebugLogs />}

      {activeTab === "settings" && (
        <div className="space-y-8">
          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Competitor Accounts
            </h2>
            <CompetitorList
              competitors={settings.competitors}
              onChange={(competitors) => handleSave({ competitors })}
            />
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              Engagement & Safety
            </h2>
            <SettingsForm settings={settings} onSave={handleSave} />
          </section>
        </div>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {children}
    </button>
  );
}
