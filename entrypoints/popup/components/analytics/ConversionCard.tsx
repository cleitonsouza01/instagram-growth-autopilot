interface ConversionCardProps {
  conversionRate: number;
  netGrowth: number;
  successRate: number;
}

export default function ConversionCard({
  conversionRate,
  netGrowth,
  successRate,
}: ConversionCardProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <MetricCard
        label="Conversion"
        value={`${(conversionRate * 100).toFixed(1)}%`}
        color={conversionRate > 0.05 ? "text-success" : "text-muted"}
      />
      <MetricCard
        label="Net growth"
        value={netGrowth >= 0 ? `+${netGrowth}` : String(netGrowth)}
        color={netGrowth > 0 ? "text-success" : netGrowth < 0 ? "text-danger" : "text-muted"}
      />
      <MetricCard
        label="Success rate"
        value={`${(successRate * 100).toFixed(0)}%`}
        color={successRate > 0.9 ? "text-success" : successRate > 0.7 ? "text-warning" : "text-danger"}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg px-2.5 py-2 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-sm font-bold ${color}`}>{value}</p>
    </div>
  );
}
