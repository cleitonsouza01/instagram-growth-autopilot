import { describe, it, expect } from "vitest";
import { delay, randomDelay, gaussianDelay } from "../../utils/delay";

describe("delay", () => {
  it("resolves after specified ms", async () => {
    const start = Date.now();
    await delay(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40); // allow small tolerance
  });
});

describe("randomDelay", () => {
  it("resolves within the specified range", async () => {
    const start = Date.now();
    await randomDelay(20, 80);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(15);
    expect(elapsed).toBeLessThan(200);
  });
});

describe("gaussianDelay", () => {
  it("returns values within min/max bounds", () => {
    const min = 100;
    const max = 500;
    for (let i = 0; i < 100; i++) {
      const val = gaussianDelay(min, max);
      expect(val).toBeGreaterThanOrEqual(min);
      expect(val).toBeLessThanOrEqual(max);
    }
  });

  it("returns integer values", () => {
    for (let i = 0; i < 50; i++) {
      const val = gaussianDelay(100, 500);
      expect(Number.isInteger(val)).toBe(true);
    }
  });

  it("clusters around the midpoint", () => {
    const min = 0;
    const max = 1000;
    const mid = 500;
    const values = Array.from({ length: 1000 }, () =>
      gaussianDelay(min, max),
    );
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    // Average should be near midpoint (within 100)
    expect(Math.abs(avg - mid)).toBeLessThan(100);
  });
});
