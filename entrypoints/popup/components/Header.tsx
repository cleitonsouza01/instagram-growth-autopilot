export default function Header() {
  return (
    <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
        <span className="text-white text-sm font-bold">IG</span>
      </div>
      <div>
        <h1 className="text-sm font-semibold text-gray-900">
          Growth Autopilot
        </h1>
        <p className="text-xs text-muted">Organic Instagram growth</p>
      </div>
    </div>
  );
}
