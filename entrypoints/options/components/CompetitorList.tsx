import { useState } from "react";

interface CompetitorListProps {
  competitors: string[];
  onChange: (competitors: string[]) => void;
}

export default function CompetitorList({
  competitors,
  onChange,
}: CompetitorListProps) {
  const [input, setInput] = useState("");

  const handleAdd = () => {
    const username = input.trim().replace(/^@/, "").toLowerCase();
    if (username && !competitors.includes(username)) {
      onChange([...competitors, username]);
      setInput("");
    }
  };

  const handleRemove = (username: string) => {
    onChange(competitors.filter((c) => c !== username));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="@competitor_username"
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          onClick={handleAdd}
          disabled={!input.trim()}
          className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {competitors.length === 0 ? (
        <p className="text-sm text-muted">
          No competitors added yet. Add competitor usernames to start
          harvesting their followers.
        </p>
      ) : (
        <ul className="space-y-1">
          {competitors.map((username) => (
            <li
              key={username}
              className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
            >
              <span className="text-sm text-gray-800">@{username}</span>
              <button
                onClick={() => handleRemove(username)}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
