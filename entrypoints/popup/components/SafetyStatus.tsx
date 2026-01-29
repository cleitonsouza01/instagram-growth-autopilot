interface SafetyStatusProps {
  level: "safe" | "caution" | "warning" | "danger";
  message: string;
  cooldownEndsAt: number | null;
}

const LEVEL_STYLES = {
  safe: {
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    icon: "🟢",
    label: "Safe",
  },
  caution: {
    bg: "bg-yellow-50",
    border: "border-yellow-200",
    text: "text-yellow-700",
    icon: "🟡",
    label: "Caution",
  },
  warning: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    icon: "🟠",
    label: "Warning",
  },
  danger: {
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    icon: "🔴",
    label: "Danger",
  },
} as const;

function formatCooldown(endsAt: number): string {
  const remaining = endsAt - Date.now();
  if (remaining <= 0) return "Resuming...";

  const hours = Math.floor(remaining / (60 * 60 * 1000));
  const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}

export default function SafetyStatus({
  level,
  message,
  cooldownEndsAt,
}: SafetyStatusProps) {
  const style = LEVEL_STYLES[level];

  return (
    <div
      className={`flex items-center gap-2 p-2 rounded border ${style.bg} ${style.border}`}
    >
      <span className="text-sm">{style.icon}</span>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-medium ${style.text}`}>
          {style.label}
        </div>
        <div className="text-xs text-gray-600 truncate">{message}</div>
        {cooldownEndsAt && cooldownEndsAt > Date.now() && (
          <div className="text-xs text-gray-500 mt-0.5">
            {formatCooldown(cooldownEndsAt)}
          </div>
        )}
      </div>
    </div>
  );
}
