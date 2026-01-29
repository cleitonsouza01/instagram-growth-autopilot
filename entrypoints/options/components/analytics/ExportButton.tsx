import { useState } from "react";
import {
  exportFollowerHistory,
  exportActionLogs,
  exportProspects,
  downloadBlob,
} from "../../../../lib/data-export";

type ExportType = "followers" | "actions" | "prospects";
type ExportFormat = "csv" | "json";

export default function ExportButton() {
  const [exporting, setExporting] = useState(false);

  const handleExport = async (type: ExportType, format: ExportFormat) => {
    setExporting(true);
    try {
      let blob: Blob;
      const timestamp = new Date().toISOString().slice(0, 10);

      switch (type) {
        case "followers":
          blob = await exportFollowerHistory(format);
          downloadBlob(blob, `followers-${timestamp}.${format}`);
          break;
        case "actions":
          blob = await exportActionLogs(format);
          downloadBlob(blob, `action-logs-${timestamp}.${format}`);
          break;
        case "prospects":
          blob = await exportProspects(format);
          downloadBlob(blob, `prospects-${timestamp}.${format}`);
          break;
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-800 mb-2">
        Export Data
      </h3>
      <div className="bg-gray-50 rounded-lg p-3 space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <ExportRow
            label="Follower History"
            type="followers"
            onExport={handleExport}
            disabled={exporting}
          />
          <ExportRow
            label="Action Logs"
            type="actions"
            onExport={handleExport}
            disabled={exporting}
          />
          <ExportRow
            label="Prospects"
            type="prospects"
            onExport={handleExport}
            disabled={exporting}
          />
        </div>
        {exporting && (
          <p className="text-xs text-muted text-center">Exporting...</p>
        )}
      </div>
    </div>
  );
}

function ExportRow({
  label,
  type,
  onExport,
  disabled,
}: {
  label: string;
  type: ExportType;
  onExport: (type: ExportType, format: ExportFormat) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-600">{label}</p>
      <div className="flex gap-1">
        <button
          onClick={() => onExport(type, "csv")}
          disabled={disabled}
          className="flex-1 px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50"
        >
          CSV
        </button>
        <button
          onClick={() => onExport(type, "json")}
          disabled={disabled}
          className="flex-1 px-2 py-1 text-xs bg-white border border-gray-200 rounded hover:bg-gray-100 disabled:opacity-50"
        >
          JSON
        </button>
      </div>
    </div>
  );
}
