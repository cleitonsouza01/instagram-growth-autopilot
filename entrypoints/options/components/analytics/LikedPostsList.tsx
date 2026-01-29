import { useEffect, useState } from "react";
import { db } from "../../../../storage/database";

interface LikedPost {
  id: number;
  username: string;
  mediaId: string;
  timestamp: number;
}

interface LikedPostsListProps {
  /** Number of days to look back */
  days: number;
}

export default function LikedPostsList({ days }: LikedPostsListProps) {
  const [likes, setLikes] = useState<LikedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    db.actionLogs
      .where("action")
      .equals("like")
      .toArray()
      .then((logs) => {
        // Filter and sort in JS for reliability
        const filtered = logs
          .filter((log) => log.success && log.timestamp >= cutoff)
          .sort((a, b) => b.timestamp - a.timestamp); // newest first

        const mapped = filtered.map((log) => ({
          id: log.id!,
          username: log.targetUsername,
          mediaId: log.mediaId ?? "unknown",
          timestamp: log.timestamp,
        }));
        setLikes(mapped);
      })
      .catch((err) => {
        console.error("Failed to load liked posts:", err);
      })
      .finally(() => setLoading(false));
  }, [days]);

  const formatTime = (ts: number) => {
    const date = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - ts;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const openPost = (mediaId: string) => {
    window.open(`https://www.instagram.com/p/${mediaId}/`, "_blank");
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Liked Posts
        </h3>
        <p className="text-xs text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">
        Liked Posts
      </h3>

      {likes.length === 0 ? (
        <p className="text-xs text-gray-400">
          No likes recorded in this period.
        </p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {likes.map((like) => (
            <div
              key={like.id}
              className="flex items-center gap-2 text-xs group"
            >
              <span className="w-5 h-5 rounded-full bg-pink-100 flex items-center justify-center text-pink-500 text-[10px] shrink-0">
                ♥
              </span>
              <span className="text-gray-700 font-medium">
                @{like.username}
              </span>
              <button
                onClick={() => openPost(like.mediaId)}
                className="text-gray-400 hover:text-primary truncate max-w-[120px] opacity-0 group-hover:opacity-100 transition-opacity"
                title={`Open post ${like.mediaId}`}
              >
                {like.mediaId.slice(-8)}...
              </button>
              <span className="text-gray-400 ml-auto shrink-0">
                {formatTime(like.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}

      {likes.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400">
          {likes.length} post{likes.length !== 1 ? "s" : ""} liked
        </div>
      )}
    </div>
  );
}
