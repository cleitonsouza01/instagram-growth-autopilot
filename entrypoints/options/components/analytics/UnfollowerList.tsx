interface UnfollowerListProps {
  unfollowers: string[];
}

export default function UnfollowerList({ unfollowers }: UnfollowerListProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Recent Unfollowers
      </h3>

      {unfollowers.length === 0 ? (
        <p className="text-xs text-gray-400">
          No unfollowers detected in this period.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {unfollowers.map((name, i) => (
            <div
              key={`${name}-${i}`}
              className="flex items-center gap-2 text-xs"
            >
              <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-[10px] font-medium shrink-0">
                &minus;
              </span>
              <span className="text-gray-700 truncate">{name}</span>
            </div>
          ))}
        </div>
      )}

      {unfollowers.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400">
          {unfollowers.length} unfollower{unfollowers.length !== 1 ? "s" : ""}{" "}
          detected
        </div>
      )}
    </div>
  );
}
