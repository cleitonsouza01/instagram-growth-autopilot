interface CarouselBuilderProps {
  images: Array<{ file: File; preview: string }>;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (index: number) => void;
}

export default function CarouselBuilder({
  images,
  onReorder,
  onRemove,
}: CarouselBuilderProps) {
  if (images.length < 2) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">
          Carousel Order
        </label>
        <span className="text-xs text-gray-400">
          {images.length}/10 images
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {images.map((img, index) => (
          <div
            key={index}
            className="relative shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 group"
          >
            <img
              src={img.preview}
              alt={`Image ${index + 1}`}
              className="w-full h-full object-cover"
            />

            {/* Order badge */}
            <div className="absolute top-1 left-1 w-5 h-5 bg-black/60 text-white text-xs rounded-full flex items-center justify-center">
              {index + 1}
            </div>

            {/* Controls overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-end justify-center pb-1 gap-1 opacity-0 group-hover:opacity-100">
              {index > 0 && (
                <button
                  onClick={() => onReorder(index, index - 1)}
                  className="w-5 h-5 bg-white/90 rounded text-xs"
                >
                  &larr;
                </button>
              )}
              <button
                onClick={() => onRemove(index)}
                className="w-5 h-5 bg-red-500/90 text-white rounded text-xs"
              >
                &times;
              </button>
              {index < images.length - 1 && (
                <button
                  onClick={() => onReorder(index, index + 1)}
                  className="w-5 h-5 bg-white/90 rounded text-xs"
                >
                  &rarr;
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
