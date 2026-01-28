interface QuickActionsProps {
  state: string;
  onStart: () => void;
  onStop: () => void;
  onOpenOptions: () => void;
}

export default function QuickActions({
  state,
  onStart,
  onStop,
  onOpenOptions,
}: QuickActionsProps) {
  const isRunning =
    state === "harvesting" || state === "engaging" || state === "idle";
  const isPaused = state === "paused";

  return (
    <div className="mt-3 space-y-2">
      {isPaused || state === "error" || state === "cooldown" ? (
        <button
          onClick={onStart}
          className="w-full py-2 px-3 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
        >
          Start Engine
        </button>
      ) : isRunning ? (
        <button
          onClick={onStop}
          className="w-full py-2 px-3 bg-danger text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors"
        >
          Pause Engine
        </button>
      ) : (
        <button
          onClick={onStart}
          className="w-full py-2 px-3 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors"
        >
          Start Engine
        </button>
      )}
      <button
        onClick={onOpenOptions}
        className="w-full py-2 px-3 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
      >
        Settings
      </button>
    </div>
  );
}
