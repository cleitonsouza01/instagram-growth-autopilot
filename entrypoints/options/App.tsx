import { useEffect, useState } from "react";
import { type UserSettings, DEFAULT_SETTINGS } from "../../types/settings";
import { getSettings, saveSettings } from "../../storage/chrome-storage";
import SettingsForm from "./components/SettingsForm";
import CompetitorList from "./components/CompetitorList";

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

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
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Instagram Growth Autopilot — Settings
      </h1>

      {saved && (
        <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg">
          Settings saved successfully.
        </div>
      )}

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
    </div>
  );
}
