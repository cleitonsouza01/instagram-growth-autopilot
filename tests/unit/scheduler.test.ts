import { describe, it, expect } from "vitest";
import {
  isScheduledPostAlarm,
  getPostIdFromAlarm,
} from "../../lib/scheduler";

describe("Scheduler", () => {
  describe("isScheduledPostAlarm", () => {
    it("should identify scheduled post alarms", () => {
      expect(isScheduledPostAlarm("scheduled-post-123")).toBe(true);
      expect(isScheduledPostAlarm("scheduled-post-0")).toBe(true);
    });

    it("should reject other alarm names", () => {
      expect(isScheduledPostAlarm("harvest-tick")).toBe(false);
      expect(isScheduledPostAlarm("engage-tick")).toBe(false);
      expect(isScheduledPostAlarm("daily-reset")).toBe(false);
    });
  });

  describe("getPostIdFromAlarm", () => {
    it("should extract post ID from alarm name", () => {
      expect(getPostIdFromAlarm("scheduled-post-123")).toBe(123);
      expect(getPostIdFromAlarm("scheduled-post-0")).toBe(0);
      expect(getPostIdFromAlarm("scheduled-post-9999")).toBe(9999);
    });
  });
});
