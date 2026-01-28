import { describe, it, expect } from "vitest";
import { DEFAULT_SETTINGS } from "../../types/settings";

describe("DEFAULT_SETTINGS", () => {
  it("has conservative default limits", () => {
    expect(DEFAULT_SETTINGS.dailyLikeLimit).toBe(100);
    expect(DEFAULT_SETTINGS.likesPerProspect).toBe(2);
    expect(DEFAULT_SETTINGS.minDelaySeconds).toBe(30);
    expect(DEFAULT_SETTINGS.maxDelaySeconds).toBe(120);
  });

  it("has safety defaults enabled", () => {
    expect(DEFAULT_SETTINGS.pauseOnBlock).toBe(true);
    expect(DEFAULT_SETTINGS.cooldownHours).toBe(24);
    expect(DEFAULT_SETTINGS.skipPrivateAccounts).toBe(true);
  });

  it("has reasonable active hours", () => {
    expect(DEFAULT_SETTINGS.activeHoursStart).toBe(8);
    expect(DEFAULT_SETTINGS.activeHoursEnd).toBe(23);
  });

  it("starts with empty competitor list", () => {
    expect(DEFAULT_SETTINGS.competitors).toEqual([]);
  });
});
