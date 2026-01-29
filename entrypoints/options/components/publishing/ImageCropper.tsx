import { ASPECT_RATIOS, type AspectRatioKey } from "../../../../lib/image-processor";

interface ImageCropperProps {
  previewUrl: string;
  selectedRatio: AspectRatioKey;
  onRatioChange: (ratio: AspectRatioKey) => void;
}

export default function ImageCropper({
  previewUrl,
  selectedRatio,
  onRatioChange,
}: ImageCropperProps) {
  const ratioKeys = Object.keys(ASPECT_RATIOS) as AspectRatioKey[];

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">
        Aspect Ratio
      </label>

      {/* Ratio selector */}
      <div className="flex gap-2">
        {ratioKeys.map((key) => {
          const { label } = ASPECT_RATIOS[key];
          return (
            <button
              key={key}
              onClick={() => onRatioChange(key)}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                selectedRatio === key
                  ? "bg-primary text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Preview with aspect ratio overlay */}
      {previewUrl && (
        <div className="relative bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center"
          style={{ maxHeight: 400 }}
        >
          <img
            src={previewUrl}
            alt="Crop preview"
            className="max-w-full max-h-96 object-contain"
          />
          <div className="absolute inset-0 pointer-events-none border-2 border-white/50 rounded-lg" />
        </div>
      )}
    </div>
  );
}
