import { describe, it, expect, beforeEach } from "vitest";
import {
  classifyBlock,
  recordSuccess,
  recordFailure,
  getSafetyLevel,
  resetBlockState,
  resetDailyBlocks,
  getBlockState,
  BlockSeverity,
} from "../../lib/block-detector";

describe("BlockDetector", () => {
  beforeEach(() => {
    resetBlockState();
  });

  describe("classifyBlock", () => {
    it("should classify checkpoint as CRITICAL", () => {
      const event = classifyBlock("checkpoint_required");
      expect(event.severity).toBe(BlockSeverity.CRITICAL);
      expect(event.cooldownMs).toBe(48 * 60 * 60 * 1000);
    });

    it("should classify feedback_required as HIGH", () => {
      const event = classifyBlock("feedback_required");
      expect(event.severity).toBe(BlockSeverity.HIGH);
      expect(event.cooldownMs).toBe(24 * 60 * 60 * 1000);
    });

    it("should classify spam_detected as MEDIUM", () => {
      const event = classifyBlock("spam_detected");
      expect(event.severity).toBe(BlockSeverity.MEDIUM);
      expect(event.cooldownMs).toBe(12 * 60 * 60 * 1000);
    });

    it("should classify 429 as LOW", () => {
      const event = classifyBlock("rate_limit", 429);
      expect(event.severity).toBe(BlockSeverity.LOW);
      expect(event.cooldownMs).toBe(60 * 60 * 1000);
    });

    it("should escalate LOW to MEDIUM after 3+ daily blocks", () => {
      classifyBlock("rate_limit", 429); // 1
      classifyBlock("rate_limit", 429); // 2
      classifyBlock("rate_limit", 429); // 3
      const event = classifyBlock("rate_limit", 429); // 4th — escalated
      expect(event.severity).toBe(BlockSeverity.MEDIUM);
    });

    it("should escalate MEDIUM to HIGH after 5+ daily blocks", () => {
      for (let i = 0; i < 5; i++) {
        classifyBlock("spam_detected");
      }
      const event = classifyBlock("spam_detected"); // 6th
      expect(event.severity).toBe(BlockSeverity.HIGH);
    });

    it("should track block events in state", () => {
      classifyBlock("rate_limit", 429);
      classifyBlock("spam_detected");
      const state = getBlockState();
      expect(state.recentBlocks).toHaveLength(2);
      expect(state.totalBlocksToday).toBe(2);
    });
  });

  describe("recordSuccess", () => {
    it("should reset consecutive failure counter", () => {
      recordFailure();
      recordFailure();
      recordSuccess();
      const state = getBlockState();
      expect(state.consecutiveFailures).toBe(0);
    });
  });

  describe("recordFailure", () => {
    it("should increment consecutive failures", () => {
      recordFailure();
      const state = getBlockState();
      expect(state.consecutiveFailures).toBe(1);
    });

    it("should return null below threshold", () => {
      expect(recordFailure()).toBeNull();
      expect(recordFailure()).toBeNull();
    });

    it("should return block event at 3 consecutive failures", () => {
      recordFailure();
      recordFailure();
      const event = recordFailure();
      expect(event).not.toBeNull();
      expect(event?.signal).toBe("consecutive_failures");
    });
  });

  describe("getSafetyLevel", () => {
    it("should return safe when no issues", () => {
      const result = getSafetyLevel();
      expect(result.level).toBe("safe");
    });

    it("should return caution after 1 failure", () => {
      recordFailure();
      const result = getSafetyLevel();
      expect(result.level).toBe("caution");
    });

    it("should return warning after 2 blocks", () => {
      classifyBlock("rate_limit", 429);
      classifyBlock("rate_limit", 429);
      const result = getSafetyLevel();
      expect(result.level).toBe("warning");
    });

    it("should return danger after 5+ blocks", () => {
      for (let i = 0; i < 5; i++) {
        classifyBlock("rate_limit", 429);
      }
      const result = getSafetyLevel();
      expect(result.level).toBe("danger");
    });
  });

  describe("resetDailyBlocks", () => {
    it("should reset daily counters but keep state structure", () => {
      classifyBlock("rate_limit", 429);
      classifyBlock("spam_detected");
      resetDailyBlocks();
      const state = getBlockState();
      expect(state.totalBlocksToday).toBe(0);
      expect(state.recentBlocks).toHaveLength(0);
    });
  });
});
