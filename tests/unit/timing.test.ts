import { describe, it, expect } from "vitest";
import {
  generateDelay,
  generateLikeDelay,
  generateBreakDuration,
  suggestSessionPause,
} from "../../lib/timing";

describe("Timing", () => {
  describe("generateDelay", () => {
    it("should return a positive number", () => {
      const delay = generateDelay();
      expect(delay).toBeGreaterThan(0);
    });

    it("should respect custom min/max bounds loosely", () => {
      // The final value can exceed maxDelayMs due to multipliers, but
      // is clamped to maxDelayMs * 2
      const delays: number[] = [];
      for (let i = 0; i < 50; i++) {
        delays.push(generateDelay({ minDelayMs: 10000, maxDelayMs: 50000 }));
      }
      const min = Math.min(...delays);
      const max = Math.max(...delays);
      // All should be positive and within extended bounds
      expect(min).toBeGreaterThan(0);
      expect(max).toBeLessThanOrEqual(100000); // maxDelayMs * 2
    });

    it("should produce varied delays (not all identical)", () => {
      const delays = new Set<number>();
      for (let i = 0; i < 20; i++) {
        delays.add(generateDelay());
      }
      expect(delays.size).toBeGreaterThan(1);
    });
  });

  describe("generateLikeDelay", () => {
    it("should return shorter delays than main delay", () => {
      const likeDelays: number[] = [];
      for (let i = 0; i < 20; i++) {
        likeDelays.push(generateLikeDelay());
      }
      const avg = likeDelays.reduce((a, b) => a + b, 0) / likeDelays.length;
      // Like delays should average well under 30s
      expect(avg).toBeLessThan(30000);
    });
  });

  describe("generateBreakDuration", () => {
    it("should return 5-15 minute duration", () => {
      for (let i = 0; i < 20; i++) {
        const d = generateBreakDuration();
        expect(d).toBeGreaterThanOrEqual(5 * 60000);
        expect(d).toBeLessThanOrEqual(15 * 60000);
      }
    });
  });

  describe("suggestSessionPause", () => {
    it("should return 0 for low action counts", () => {
      expect(suggestSessionPause(5)).toBe(0);
      expect(suggestSessionPause(10)).toBe(0);
      expect(suggestSessionPause(15)).toBe(0);
    });

    it("should eventually return non-zero for high action counts", () => {
      // At 41+ actions, threshold is always met (max random is 40)
      const result = suggestSessionPause(41);
      expect(result).toBeGreaterThan(0);
    });
  });
});
