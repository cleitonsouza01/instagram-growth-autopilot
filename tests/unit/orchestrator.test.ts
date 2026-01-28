import { describe, it, expect } from "vitest";
import { isWithinActiveHours } from "../../lib/orchestrator";

describe("isWithinActiveHours", () => {
  // We test the pure function; the hour is from new Date().getHours()
  // so we test the logic with known start/end values.

  it("returns correct result for normal range (8-23)", () => {
    const currentHour = new Date().getHours();
    const result = isWithinActiveHours(8, 23);

    if (currentHour >= 8 && currentHour < 23) {
      expect(result).toBe(true);
    } else {
      expect(result).toBe(false);
    }
  });

  it("returns correct result for overnight range (22-6)", () => {
    const currentHour = new Date().getHours();
    const result = isWithinActiveHours(22, 6);

    if (currentHour >= 22 || currentHour < 6) {
      expect(result).toBe(true);
    } else {
      expect(result).toBe(false);
    }
  });

  it("returns true for 0-24 range (always active)", () => {
    // 0 to 24 means startHour <= endHour, currentHour >= 0 and < 24
    const result = isWithinActiveHours(0, 24);
    expect(result).toBe(true);
  });
});
