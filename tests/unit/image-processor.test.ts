import { describe, it, expect } from "vitest";
import {
  resizeImage,
  cropToAspectRatio,
  validateImageFile,
  ASPECT_RATIOS,
} from "../../lib/image-processor";

// Mock HTMLImageElement with width/height
function mockImg(width: number, height: number): HTMLImageElement {
  return { width, height } as HTMLImageElement;
}

describe("ImageProcessor", () => {
  describe("resizeImage", () => {
    it("should not resize images within max dimensions", () => {
      const dims = resizeImage(mockImg(800, 600), 1080, 1080);
      expect(dims.width).toBe(800);
      expect(dims.height).toBe(600);
    });

    it("should scale down wide images", () => {
      const dims = resizeImage(mockImg(2000, 1000), 1080, 1080);
      expect(dims.width).toBe(1080);
      expect(dims.height).toBe(540);
    });

    it("should scale down tall images", () => {
      const dims = resizeImage(mockImg(500, 2000), 1080, 1080);
      expect(dims.width).toBe(270);
      expect(dims.height).toBe(1080);
    });

    it("should handle square images", () => {
      const dims = resizeImage(mockImg(2000, 2000), 1080, 1080);
      expect(dims.width).toBe(1080);
      expect(dims.height).toBe(1080);
    });

    it("should handle custom max dimensions", () => {
      const dims = resizeImage(mockImg(1000, 1000), 500, 500);
      expect(dims.width).toBe(500);
      expect(dims.height).toBe(500);
    });
  });

  describe("cropToAspectRatio", () => {
    it("should crop wide image to square", () => {
      const crop = cropToAspectRatio(mockImg(2000, 1000), 1);
      expect(crop.sw).toBe(1000); // square = min(w,h)
      expect(crop.sh).toBe(1000);
      expect(crop.sx).toBe(500); // centered
      expect(crop.sy).toBe(0);
    });

    it("should crop tall image to square", () => {
      const crop = cropToAspectRatio(mockImg(1000, 2000), 1);
      expect(crop.sw).toBe(1000);
      expect(crop.sh).toBe(1000);
      expect(crop.sx).toBe(0);
      expect(crop.sy).toBe(500);
    });

    it("should crop to 4:5 portrait", () => {
      const crop = cropToAspectRatio(mockImg(1000, 1000), 4 / 5);
      expect(crop.sw).toBe(800); // 1000 * (4/5)
      expect(crop.sh).toBe(1000);
    });

    it("should crop to 16:9 landscape", () => {
      const crop = cropToAspectRatio(mockImg(1000, 1000), 16 / 9);
      // Image is taller than 16:9, so crop top/bottom
      expect(crop.sw).toBe(1000);
      expect(crop.sh).toBe(563); // 1000 / (16/9) ≈ 562.5
    });
  });

  describe("validateImageFile", () => {
    it("should accept JPEG files", () => {
      const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
      expect(validateImageFile(file)).toBeNull();
    });

    it("should accept PNG files", () => {
      const file = new File(["data"], "photo.png", { type: "image/png" });
      expect(validateImageFile(file)).toBeNull();
    });

    it("should accept WebP files", () => {
      const file = new File(["data"], "photo.webp", { type: "image/webp" });
      expect(validateImageFile(file)).toBeNull();
    });

    it("should reject unsupported file types", () => {
      const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
      const result = validateImageFile(file);
      expect(result).not.toBeNull();
      expect(result).toContain("Unsupported");
    });

    it("should reject files over 8MB", () => {
      // Create a large file
      const data = new Uint8Array(9 * 1024 * 1024);
      const file = new File([data], "big.jpg", { type: "image/jpeg" });
      const result = validateImageFile(file);
      expect(result).not.toBeNull();
      expect(result).toContain("too large");
    });
  });

  describe("ASPECT_RATIOS", () => {
    it("should define standard ratios", () => {
      expect(ASPECT_RATIOS.SQUARE.ratio).toBe(1);
      expect(ASPECT_RATIOS.PORTRAIT.ratio).toBeCloseTo(0.8, 1);
      expect(ASPECT_RATIOS.LANDSCAPE.ratio).toBeCloseTo(1.78, 1);
    });
  });
});
