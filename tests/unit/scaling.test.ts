import { describe, it, expect } from "vitest";
import {
  getAccountTier,
  getScalingRecommendation,
  validateSettingsAgainstScaling,
  AccountTier,
} from "../../lib/scaling";

describe("Scaling", () => {
  describe("getAccountTier", () => {
    it("should classify <14 days as NEW", () => {
      expect(getAccountTier(0)).toBe(AccountTier.NEW);
      expect(getAccountTier(13)).toBe(AccountTier.NEW);
    });

    it("should classify 14-29 days as YOUNG", () => {
      expect(getAccountTier(14)).toBe(AccountTier.YOUNG);
      expect(getAccountTier(29)).toBe(AccountTier.YOUNG);
    });

    it("should classify 30-89 days as GROWING", () => {
      expect(getAccountTier(30)).toBe(AccountTier.GROWING);
      expect(getAccountTier(89)).toBe(AccountTier.GROWING);
    });

    it("should classify 90-179 days as ESTABLISHED", () => {
      expect(getAccountTier(90)).toBe(AccountTier.ESTABLISHED);
      expect(getAccountTier(179)).toBe(AccountTier.ESTABLISHED);
    });

    it("should classify 180+ days as MATURE", () => {
      expect(getAccountTier(180)).toBe(AccountTier.MATURE);
      expect(getAccountTier(365)).toBe(AccountTier.MATURE);
    });
  });

  describe("getScalingRecommendation", () => {
    it("should return correct limits for new accounts", () => {
      const rec = getScalingRecommendation(7);
      expect(rec.tier).toBe(AccountTier.NEW);
      expect(rec.dailyLimit).toBe(50);
      expect(rec.hourlyLimit).toBe(10);
      expect(rec.warning).not.toBeNull();
    });

    it("should return correct limits for mature accounts", () => {
      const rec = getScalingRecommendation(365);
      expect(rec.tier).toBe(AccountTier.MATURE);
      expect(rec.dailyLimit).toBe(500);
      expect(rec.hourlyLimit).toBe(50);
      expect(rec.warning).toBeNull();
    });

    it("should scale limits progressively", () => {
      const tiers = [7, 20, 60, 120, 365].map(getScalingRecommendation);
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i]!.dailyLimit).toBeGreaterThanOrEqual(
          tiers[i - 1]!.dailyLimit,
        );
      }
    });
  });

  describe("validateSettingsAgainstScaling", () => {
    it("should return no warnings for safe settings", () => {
      const warnings = validateSettingsAgainstScaling(365, 400);
      expect(warnings).toHaveLength(0);
    });

    it("should warn when daily limit exceeds recommendation", () => {
      const warnings = validateSettingsAgainstScaling(7, 200);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some((w) => w.includes("Daily limit"))).toBe(true);
    });

    it("should warn when hourly limit exceeds recommendation", () => {
      const warnings = validateSettingsAgainstScaling(7, 50, 30);
      expect(warnings.some((w) => w.includes("Hourly limit"))).toBe(true);
    });

    it("should include tier warning for new accounts", () => {
      const warnings = validateSettingsAgainstScaling(5, 30);
      expect(warnings.some((w) => w.includes("not recommended"))).toBe(true);
    });
  });
});
