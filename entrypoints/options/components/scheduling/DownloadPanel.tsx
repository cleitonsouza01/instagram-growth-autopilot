import { useState } from "react";

interface DownloadPanelProps {
  onDownloadPost: (url: string) => Promise<void>;
  onDownloadProfilePic: (username: string) => Promise<void>;
}

export default function DownloadPanel({
  onDownloadPost,
  onDownloadProfilePic,
}: DownloadPanelProps) {
  const [url, setUrl] = useState("");
  const [username, setUsername] = useState("");
  const [downloading, setDownloading] = useState(false);

  const handleDownloadPost = async () => {
    if (!url.trim()) return;
    setDownloading(true);
    try {
      await onDownloadPost(url.trim());
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadPic = async () => {
    if (!username.trim()) return;
    setDownloading(true);
    try {
      await onDownloadProfilePic(username.trim().replace("@", ""));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">
        Content Download
      </h3>

      {/* Download by URL */}
      <div className="space-y-2">
        <label className="text-xs text-gray-500">Post / Story / Reel URL</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.platform.com/p/..."
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
          />
          <button
            onClick={handleDownloadPost}
            disabled={downloading || !url.trim()}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded hover:bg-gray-200 disabled:opacity-50"
          >
            {downloading ? "..." : "Download"}
          </button>
        </div>
      </div>

      {/* Download profile pic */}
      <div className="space-y-2">
        <label className="text-xs text-gray-500">Profile Picture</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="@username"
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm"
          />
          <button
            onClick={handleDownloadPic}
            disabled={downloading || !username.trim()}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 text-sm rounded hover:bg-gray-200 disabled:opacity-50"
          >
            {downloading ? "..." : "Download"}
          </button>
        </div>
      </div>
    </div>
  );
}
