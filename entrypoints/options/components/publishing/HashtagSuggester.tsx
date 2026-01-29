import { useState } from "react";
import type { HashtagResult } from "../../../../api/endpoints/hashtags";

interface HashtagSuggesterProps {
  onInsert: (hashtag: string) => void;
  onSearch: (query: string) => Promise<HashtagResult[]>;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function HashtagSuggester({
  onInsert,
  onSearch,
}: HashtagSuggesterProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HashtagResult[]>([]);
  const [searching, setSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const hashtags = await onSearch(query);
      setResults(hashtags);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">
        Hashtag Search
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search hashtags..."
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
        <div className="flex flex-wrap gap-1.5">
          {results.map((tag) => (
            <button
              key={tag.id}
              onClick={() => onInsert(`#${tag.name}`)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 hover:bg-primary/10 text-gray-700 hover:text-primary text-xs rounded-full transition-colors"
            >
              <span>#{tag.name}</span>
              <span className="text-gray-400">
                {formatCount(tag.mediaCount)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
