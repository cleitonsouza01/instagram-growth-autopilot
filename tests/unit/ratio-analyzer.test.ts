import { describe, it, expect } from "vitest";
import { analyzeRatio } from "../../lib/ratio-analyzer";

describe("RatioAnalyzer", () => {
  it("should give low score to balanced ratio", () => {
    const result = analyzeRatio(1000, 800);
    expect(result.score).toBe(0);
    expect(result.ratio).toBeCloseTo(1.25, 1);
  });

  it("should flag extreme following count", () => {
    const result = analyzeRatio(500, 6000);
    expect(result.flags).toContain("extreme_following");
    expect(result.score).toBeGreaterThan(0);
  });

  it("should flag high following count", () => {
    const result = analyzeRatio(500, 3000);
    expect(result.flags).toContain("high_following");
  });

  it("should flag very low ratio", () => {
    const result = analyzeRatio(30, 1000);
    expect(result.flags).toContain("very_low_ratio");
    expect(result.score).toBeGreaterThan(0.3);
  });

  it("should flag zero followers with mass following", () => {
    const result = analyzeRatio(0, 500);
    expect(result.flags).toContain("zero_followers_mass_following");
    expect(result.score).toBeGreaterThan(0.3);
  });

  it("should not penalize celebrity-like ratio", () => {
    const result = analyzeRatio(1000000, 50);
    expect(result.score).toBe(0);
  });

  it("should handle zero/zero gracefully", () => {
    const result = analyzeRatio(0, 0);
    expect(result.score).toBe(0);
    expect(result.ratio).toBe(1);
  });

  it("should cap score at 1.0", () => {
    const result = analyzeRatio(0, 10000);
    expect(result.score).toBeLessThanOrEqual(1.0);
  });
});
