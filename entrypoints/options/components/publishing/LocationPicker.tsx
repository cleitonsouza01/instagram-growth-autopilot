import { useState } from "react";
import type { LocationResult } from "../../../../api/endpoints/location";

interface LocationPickerProps {
  selected: LocationResult | null;
  onSelect: (location: LocationResult | null) => void;
  onSearch: (query: string) => Promise<LocationResult[]>;
}

export default function LocationPicker({
  selected,
  onSelect,
  onSearch,
}: LocationPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const locations = await onSearch(query);
      setResults(locations);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  if (selected) {
    return (
      <div className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
        <span className="text-sm">📍</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-700 truncate">
            {selected.name}
          </div>
          {selected.address && (
            <div className="text-xs text-gray-400 truncate">
              {selected.address}
            </div>
          )}
        </div>
        <button
          onClick={() => onSelect(null)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Location</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search location..."
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          onClick={handleSearch}
          disabled={searching}
          className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          {searching ? "..." : "Search"}
        </button>
      </div>

      {results.length > 0 && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-40 overflow-y-auto">
          {results.map((loc) => (
            <button
              key={loc.pk}
              onClick={() => {
                onSelect(loc);
                setResults([]);
                setQuery("");
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
            >
              <div className="text-sm text-gray-700">{loc.name}</div>
              {loc.address && (
                <div className="text-xs text-gray-400">{loc.address}</div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
