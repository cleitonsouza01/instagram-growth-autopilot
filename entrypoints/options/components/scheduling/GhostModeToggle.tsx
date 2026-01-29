interface GhostModeToggleProps {
  enabled: boolean;
  onToggle: () => void;
}

export default function GhostModeToggle({
  enabled,
  onToggle,
}: GhostModeToggleProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div>
        <div className="text-sm font-medium text-gray-700">
          Ghost Mode
        </div>
        <div className="text-xs text-gray-500">
          View stories without being seen.
          {enabled && (
            <span className="text-primary font-medium"> Active</span>
          )}
        </div>
      </div>
      <button
        onClick={onToggle}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          enabled ? "bg-primary" : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            enabled ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
