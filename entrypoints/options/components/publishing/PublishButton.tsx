interface PublishButtonProps {
  onPublish: () => void;
  disabled: boolean;
  publishing: boolean;
  progress?: number; // 0-100
}

export default function PublishButton({
  onPublish,
  disabled,
  publishing,
  progress,
}: PublishButtonProps) {
  return (
    <div className="space-y-2">
      <button
        onClick={onPublish}
        disabled={disabled || publishing}
        className="w-full py-2.5 rounded-lg text-sm font-medium text-white bg-primary hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {publishing ? "Publishing..." : "Publish Now"}
      </button>

      {publishing && progress !== undefined && (
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className="bg-primary h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {disabled && !publishing && (
        <p className="text-xs text-gray-400 text-center">
          Add at least one image and a caption to publish.
        </p>
      )}
    </div>
  );
}
