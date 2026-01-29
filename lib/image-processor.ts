import { logger } from "../utils/logger";

/**
 * Client-side image processing using Canvas API.
 * Resize, compress, crop, and strip EXIF data.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

export interface ProcessedImage {
  blob: Blob;
  width: number;
  height: number;
  originalSize: number;
  processedSize: number;
}

export const ASPECT_RATIOS = {
  SQUARE: { label: "1:1", ratio: 1 },
  PORTRAIT: { label: "4:5", ratio: 4 / 5 },
  LANDSCAPE: { label: "16:9", ratio: 16 / 9 },
} as const;

export type AspectRatioKey = keyof typeof ASPECT_RATIOS;

const MAX_DIMENSION = 1080;
const JPEG_QUALITY = 0.85;
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB

/**
 * Load an image file into an HTMLImageElement.
 */
export function loadImage(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Resize an image to fit within max dimensions while maintaining aspect ratio.
 */
export function resizeImage(
  img: HTMLImageElement,
  maxWidth = MAX_DIMENSION,
  maxHeight = MAX_DIMENSION,
): ImageDimensions {
  let { width, height } = img;

  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  if (height > maxHeight) {
    width = Math.round((width * maxHeight) / height);
    height = maxHeight;
  }

  return { width, height };
}

/**
 * Crop an image to a target aspect ratio.
 */
export function cropToAspectRatio(
  img: HTMLImageElement,
  aspect: number,
): { sx: number; sy: number; sw: number; sh: number } {
  const imgAspect = img.width / img.height;

  let sx = 0;
  let sy = 0;
  let sw = img.width;
  let sh = img.height;

  if (imgAspect > aspect) {
    // Image is wider - crop sides
    sw = Math.round(img.height * aspect);
    sx = Math.round((img.width - sw) / 2);
  } else {
    // Image is taller - crop top/bottom
    sh = Math.round(img.width / aspect);
    sy = Math.round((img.height - sh) / 2);
  }

  return { sx, sy, sw, sh };
}

/**
 * Process an image: crop, resize, compress, strip EXIF.
 * Returns a JPEG Blob ready for upload.
 */
export async function processImage(
  file: File | Blob,
  options: {
    aspectRatio?: number;
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  } = {},
): Promise<ProcessedImage> {
  const quality = options.quality ?? JPEG_QUALITY;
  const maxWidth = options.maxWidth ?? MAX_DIMENSION;
  const maxHeight = options.maxHeight ?? MAX_DIMENSION;
  const originalSize = file.size;

  const img = await loadImage(file);

  // Crop to aspect ratio if specified
  let crop = { sx: 0, sy: 0, sw: img.width, sh: img.height };
  if (options.aspectRatio) {
    crop = cropToAspectRatio(img, options.aspectRatio);
  }

  // Calculate output dimensions
  const tempImg = {
    width: crop.sw,
    height: crop.sh,
  } as HTMLImageElement;
  const dims = resizeImage(tempImg, maxWidth, maxHeight);

  // Draw to canvas (this strips EXIF data automatically)
  const canvas = document.createElement("canvas");
  canvas.width = dims.width;
  canvas.height = dims.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas 2D context not available");
  }

  ctx.drawImage(
    img,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    0,
    0,
    dims.width,
    dims.height,
  );

  // Export as JPEG blob
  const blob = await canvasToBlob(canvas, quality);

  logger.debug(
    "image-processor",
    `Processed: ${img.width}x${img.height} → ${dims.width}x${dims.height} (${formatBytes(originalSize)} → ${formatBytes(blob.size)})`,
  );

  return {
    blob,
    width: dims.width,
    height: dims.height,
    originalSize,
    processedSize: blob.size,
  };
}

/**
 * Generate a thumbnail for preview.
 */
export async function generateThumbnail(
  file: File | Blob,
  maxSize = 200,
): Promise<string> {
  const img = await loadImage(file);
  const dims = resizeImage(img, maxSize, maxSize);

  const canvas = document.createElement("canvas");
  canvas.width = dims.width;
  canvas.height = dims.height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  ctx.drawImage(img, 0, 0, dims.width, dims.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to create blob from canvas"));
      },
      "image/jpeg",
      quality,
    );
  });
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Validate image file before processing.
 */
export function validateImageFile(file: File): string | null {
  const validTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!validTypes.includes(file.type)) {
    return `Unsupported file type: ${file.type}. Use JPEG, PNG, or WebP.`;
  }

  if (file.size > MAX_FILE_SIZE) {
    return `File too large (${formatBytes(file.size)}). Maximum is ${formatBytes(MAX_FILE_SIZE)}.`;
  }

  return null;
}
