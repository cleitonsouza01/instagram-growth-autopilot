import { useState, useRef } from "react";
import { validateImageFile } from "../../../../lib/image-processor";

interface PhotoUploaderProps {
  onFilesSelected: (files: File[]) => void;
  maxFiles?: number;
  previews: string[];
}

export default function PhotoUploader({
  onFilesSelected,
  maxFiles = 10,
  previews,
}: PhotoUploaderProps) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setError(null);

    const files = Array.from(fileList).slice(0, maxFiles);
    for (const file of files) {
      const err = validateImageFile(file);
      if (err) {
        setError(err);
        return;
      }
    }

    onFilesSelected(files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <div className="text-gray-500 text-sm">
          <p className="font-medium">
            Drop images here or click to browse
          </p>
          <p className="text-xs mt-1 text-gray-400">
            JPEG, PNG, or WebP up to 8MB. {maxFiles > 1 ? `Up to ${maxFiles} images.` : ""}
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={maxFiles > 1}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {error && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}

      {/* Image previews */}
      {previews.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {previews.map((src, i) => (
            <div key={i} className="aspect-square rounded overflow-hidden bg-gray-100">
              <img
                src={src}
                alt={`Preview ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
