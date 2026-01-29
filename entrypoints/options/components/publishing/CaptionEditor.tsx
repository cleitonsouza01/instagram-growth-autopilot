
interface CaptionEditorProps {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
}

const MAX_CAPTION_LENGTH = 2200;

export default function CaptionEditor({
  value,
  onChange,
  maxLength = MAX_CAPTION_LENGTH,
}: CaptionEditorProps) {
  const remaining = maxLength - value.length;
  const isNearLimit = remaining < 100;
  const isOverLimit = remaining < 0;

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-gray-700">Caption</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write a caption..."
        rows={4}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
      />
      <div className="flex justify-between text-xs">
        <span className="text-gray-400">
          Supports @mentions and #hashtags
        </span>
        <span
          className={
            isOverLimit
              ? "text-red-600 font-medium"
              : isNearLimit
                ? "text-yellow-600"
                : "text-gray-400"
          }
        >
          {remaining}
        </span>
      </div>
    </div>
  );
}
