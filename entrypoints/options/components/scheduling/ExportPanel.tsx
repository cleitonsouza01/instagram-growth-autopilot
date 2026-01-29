import { useState } from "react";

interface ExportPanelProps {
  onExportCSV: () => Promise<void>;
  onExportJSON: () => Promise<void>;
}

export default function ExportPanel({
  onExportCSV,
  onExportJSON,
}: ExportPanelProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (fn: () => Promise<void>) => {
    setExporting(true);
    try {
      await fn();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">
        Follower Export
      </h3>
      <p className="text-xs text-gray-500">
        Export your prospect database with bot scores, engagement status, and
        profile data.
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => handleExport(onExportCSV)}
          disabled={exporting}
          className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          Export CSV
        </button>
        <button
          onClick={() => handleExport(onExportJSON)}
          disabled={exporting}
          className="flex-1 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          Export JSON
        </button>
      </div>
    </div>
  );
}
