import { type UserSettings } from "../../../types/settings";

interface SettingsFormProps {
  settings: UserSettings;
  onSave: (updated: Partial<UserSettings>) => void;
}

export default function SettingsForm({ settings, onSave }: SettingsFormProps) {
  return (
    <div className="space-y-6">
      {/* Platform Configuration */}
      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-sm font-semibold text-blue-800 mb-3">
          Platform Configuration
        </h3>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Platform Base URL
          </span>
          <input
            type="url"
            value={settings.platformBaseUrl}
            onChange={(e) => onSave({ platformBaseUrl: e.target.value })}
            placeholder="https://www.instagram.com"
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-gray-500">
            The base URL of the platform (e.g., https://www.instagram.com)
          </p>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Daily like limit
          </span>
          <input
            type="number"
            min={10}
            max={500}
            value={settings.dailyLikeLimit}
            onChange={(e) =>
              onSave({ dailyLikeLimit: Number(e.target.value) })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Likes per prospect
          </span>
          <input
            type="number"
            min={1}
            max={5}
            value={settings.likesPerProspect}
            onChange={(e) =>
              onSave({ likesPerProspect: Number(e.target.value) })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Active hours start
          </span>
          <input
            type="number"
            min={0}
            max={23}
            value={settings.activeHoursStart}
            onChange={(e) =>
              onSave({ activeHoursStart: Number(e.target.value) })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Active hours end
          </span>
          <input
            type="number"
            min={0}
            max={23}
            value={settings.activeHoursEnd}
            onChange={(e) =>
              onSave({ activeHoursEnd: Number(e.target.value) })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Min delay (seconds)
          </span>
          <input
            type="number"
            min={5}
            max={300}
            value={settings.minDelaySeconds}
            onChange={(e) =>
              onSave({ minDelaySeconds: Number(e.target.value) })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Max delay (seconds)
          </span>
          <input
            type="number"
            min={10}
            max={600}
            value={settings.maxDelaySeconds}
            onChange={(e) =>
              onSave({ maxDelaySeconds: Number(e.target.value) })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Min post count
          </span>
          <input
            type="number"
            min={0}
            max={50}
            value={settings.minPostCount}
            onChange={(e) =>
              onSave({ minPostCount: Number(e.target.value) })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-gray-700">
            Cooldown hours
          </span>
          <input
            type="number"
            min={1}
            max={72}
            value={settings.cooldownHours}
            onChange={(e) =>
              onSave({ cooldownHours: Number(e.target.value) })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="space-y-2 pt-2">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.pauseOnBlock}
            onChange={(e) => onSave({ pauseOnBlock: e.target.checked })}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">
            Auto-pause on action block
          </span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.skipPrivateAccounts}
            onChange={(e) =>
              onSave({ skipPrivateAccounts: e.target.checked })
            }
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">Skip private accounts</span>
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.skipVerifiedAccounts}
            onChange={(e) =>
              onSave({ skipVerifiedAccounts: e.target.checked })
            }
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">
            Skip verified accounts
          </span>
        </label>
      </div>
    </div>
  );
}
