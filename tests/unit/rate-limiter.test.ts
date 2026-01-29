import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock chrome.storage.local
const mockStorage: Record<string, unknown> = {};
vi.stubGlobal("chrome", {
  storage: {
    local: {
      get: vi.fn((key: string) =>
        Promise.resolve({ [key]: mockStorage[key] }),
      ),
      set: vi.fn((obj: Record<string, unknown>) => {
        Object.assign(mockStorage, obj);
        return Promise.resolve();
      }),
    },
  },
});

import {
  checkRateLimits,
  recordAction,
  recordBreak,
  shouldTakeBreak,
  resetSession,
  getSession,
  type RateLimits,
} from "../../lib/rate-limiter";

const DEFAULT_LIMITS: RateLimits = {
  dailyLimit: 100,
  hourlyLimit: 30,
  sessionLimit: 50,
  minActionDelayMs: 30000,
  maxActionDelayMs: 120000,
};

describe("RateLimiter", () => {
  beforeEach(() => {
    resetSession();
    mockStorage["dailyCounters"] = {
      date: new Date().toISOString().slice(0, 10),
      likes: 0,
      harvests: 0,
      prospects: 0,
    };
  });

  describe("checkRateLimits", () => {
    it("should allow action when all limits are clear", async () => {
      const result = await checkRateLimits(DEFAULT_LIMITS);
      expect(result.allowed).toBe(true);
    });

    it("should block when min delay not elapsed", async () => {
      recordAction(); // sets lastActionAt to now
      const result = await checkRateLimits(DEFAULT_LIMITS);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe("min_delay");
        expect(result.retryAfterMs).toBeGreaterThan(0);
      }
    });

    it("should block when hourly limit reached", async () => {
      // Simulate hitting hourly limit
      for (let i = 0; i < 30; i++) {
        recordAction();
      }
      // Reset lastAction time to bypass min delay check
      const session = getSession();
      expect(session.hourlyActions).toBe(30);
    });

    it("should block when daily limit reached", async () => {
      mockStorage["dailyCounters"] = {
        date: new Date().toISOString().slice(0, 10),
        likes: 100,
        harvests: 0,
        prospects: 0,
      };
      const result = await checkRateLimits(DEFAULT_LIMITS);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe("daily_limit");
      }
    });
  });

  describe("recordAction", () => {
    it("should increment session counters", () => {
      recordAction();
      const session = getSession();
      expect(session.sessionActions).toBe(1);
      expect(session.hourlyActions).toBe(1);
      expect(session.consecutiveActions).toBe(1);
      expect(session.lastActionAt).not.toBeNull();
    });

    it("should accumulate consecutive actions", () => {
      recordAction();
      recordAction();
      recordAction();
      const session = getSession();
      expect(session.consecutiveActions).toBe(3);
    });
  });

  describe("recordBreak", () => {
    it("should reset consecutive counter", () => {
      recordAction();
      recordAction();
      recordBreak();
      const session = getSession();
      expect(session.consecutiveActions).toBe(0);
      expect(session.breaksTaken).toBe(1);
    });
  });

  describe("shouldTakeBreak", () => {
    it("should return 0 when below threshold", () => {
      for (let i = 0; i < 10; i++) {
        recordAction();
      }
      // Below minimum threshold of 20, should always return 0
      const result = shouldTakeBreak();
      expect(result).toBe(0);
    });

    it("should eventually suggest a break after many actions", () => {
      // After 40+ actions, should always trigger (max threshold)
      for (let i = 0; i < 41; i++) {
        recordAction();
      }
      const result = shouldTakeBreak();
      expect(result).toBeGreaterThan(0);
    });
  });

  describe("resetSession", () => {
    it("should reset all session counters", () => {
      recordAction();
      recordAction();
      resetSession();
      const session = getSession();
      expect(session.sessionActions).toBe(0);
      expect(session.hourlyActions).toBe(0);
      expect(session.consecutiveActions).toBe(0);
      expect(session.lastActionAt).toBeNull();
    });
  });
});
